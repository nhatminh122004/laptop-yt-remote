const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const WebSocket = require('ws');
const { exec, spawn } = require('child_process');

const app = express();
const server = http.createServer(app);

// 1. Khởi tạo Socket.IO cho Điện thoại Android
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Bộ nhớ đệm lưu trạng thái nhạc YouTube
let ytStatus = {
  title: 'No track playing',
  artist: 'YouTube',
  thumbnail: '',
  duration: 0,
  progress: 0,
  playing: false
};

// 2. Khởi tạo WebSocket Server (Cổng 3001) dành riêng cho Chrome Extension
const wss = new WebSocket.Server({ port: 3001 }, () => {
  console.log('[WS] Chrome Extension server listening on port 3001');
});
let extensionSocket = null;

wss.on('connection', (ws) => {
  console.log('[WS] Chrome Extension connected.');
  extensionSocket = ws;

  // Yêu cầu thông tin nhạc ngay khi Extension kết nối
  ws.send(JSON.stringify({ action: 'request-status' }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'yt-status-update') {
        ytStatus = { ...ytStatus, ...parsed.data };
        // Phát dữ liệu nhạc sang cho điện thoại
        io.emit('yt-status', ytStatus);
      }
    } catch (err) {
      console.error('[WS Error] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Chrome Extension disconnected.');
    if (extensionSocket === ws) {
      extensionSocket = null;
    }
  });
});

// Phục vụ giao diện tĩnh cho điện thoại từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

/* ==========================================================================
   TƯƠNG TÁC VỚI HỆ THỐNG ÂM THANH WINDOWS (C# AGENT)
   ========================================================================== */

// Hàm lấy âm lượng hệ thống hiện tại
function getSystemVolume(callback) {
  exec('AudioHelper.exe get', (error, stdout, stderr) => {
    if (error) {
      console.error('[Volume Error] Fail to get volume:', error);
      return;
    }
    const match = stdout.match(/Volume:(\d+)\|Muted:(true|false)/);
    if (match) {
      callback({
        volume: parseInt(match[1]),
        muted: match[2] === 'true'
      });
    }
  });
}

// Hàm đặt âm lượng hệ thống
function setSystemVolume(val) {
  exec(`AudioHelper.exe set ${val}`, (error, stdout, stderr) => {
    if (error) console.error('[Volume Error] Fail to set volume:', error);
  });
}

// Hàm bật/tắt tiếng hệ thống (Mute)
function setSystemMute(val) {
  exec(`AudioHelper.exe mute ${val}`, (error, stdout, stderr) => {
    if (error) console.error('[Volume Error] Fail to set mute:', error);
  });
}

// Tiến trình chạy ẩn để lấy cường độ âm thanh (Peak level) làm nhấp nháy LED RGB
let audioStreamProcess = null;

function startAudioStreaming() {
  if (audioStreamProcess) {
    try {
      audioStreamProcess.kill();
    } catch (e) {}
  }

  console.log('[Server] Spawning AudioHelper.exe to stream peak audio level...');
  audioStreamProcess = spawn('AudioHelper.exe', ['stream', '33']);

  audioStreamProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    const lines = output.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    const peak = parseFloat(lastLine);
    if (!isNaN(peak) && peak >= 0) {
      // Stream peak level trực tiếp về điện thoại
      io.emit('audio-peak', peak);
    }
  });

  audioStreamProcess.on('close', (code) => {
    console.log(`[Server] AudioHelper stream process exited with code ${code}`);
    // Khởi động lại sau 3 giây nếu bị tắt đột ngột
    setTimeout(startAudioStreaming, 3000);
  });
}

// Khởi chạy tiến trình stream
startAudioStreaming();

/* ==========================================================================
   KẾT NỐI TỪ ĐIỆN THOẠI ANDROID (SOCKET.IO)
   ========================================================================== */
io.on('connection', (socket) => {
  console.log('[Socket] Phone connected.');

  // Gửi thông tin nhạc YouTube hiện tại
  socket.emit('yt-status', ytStatus);

  // Gửi âm lượng hệ thống hiện tại
  getSystemVolume((vol) => {
    socket.emit('volume-status', vol);
  });

  // Nhận lệnh điều khiển YouTube từ điện thoại -> chuyển tiếp tới Chrome Extension
  socket.on('yt-command', (cmd) => {
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      extensionSocket.send(JSON.stringify(cmd));
    }
  });

  // Nhận lệnh điều khiển âm lượng từ điện thoại -> thực thi trên Windows
  socket.on('volume-command', (cmd) => {
    if (cmd.action === 'set') {
      setSystemVolume(cmd.value);
      io.emit('volume-status', { volume: cmd.value, muted: false });
    } else if (cmd.action === 'mute') {
      setSystemMute(cmd.value);
      getSystemVolume((vol) => {
        io.emit('volume-status', vol);
      });
    }
  });

  // Đồng bộ lại trạng thái khi điện thoại yêu cầu
  socket.on('request-status-refresh', () => {
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      extensionSocket.send(JSON.stringify({ action: 'request-status' }));
    }
    getSystemVolume((vol) => {
      socket.emit('volume-status', vol);
    });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Phone disconnected.');
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  CỔNG KẾT NỐI ĐANG HOẠT ĐỘNG!`);
  console.log(`======================================================`);
  console.log(`  Địa chỉ máy tính: http://localhost:${PORT}`);
  console.log(`  Địa chỉ Mạng LAN (Nhập địa chỉ này trên điện thoại):`);
  console.log(`   👉 http://192.168.90.81:${PORT}`);
  console.log(`======================================================\n`);
});
