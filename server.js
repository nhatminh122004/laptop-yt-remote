const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// 1. Cấu hình Socket.IO cho Điện thoại Android
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 2. Khởi tạo các WebSocket Server thuần không tự lắng nghe cổng riêng
const wssExtension = new WebSocket.Server({ noServer: true });
const wssLaptop = new WebSocket.Server({ noServer: true });

let extensionSocket = null;
let laptopSocket = null;
let laptopOnline = false;

// Bộ nhớ đệm lưu trạng thái nhạc YouTube và âm lượng Laptop
let ytStatus = {
  title: 'No track playing',
  artist: 'YouTube',
  thumbnail: '',
  duration: 0,
  progress: 0,
  playing: false
};

let sysVolume = {
  volume: 50,
  muted: false
};

// Định tuyến các yêu cầu nâng cấp kết nối (Upgrade HTTP -> WebSocket) trên cùng một cổng
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/extension') {
    wssExtension.handleUpgrade(request, socket, head, (ws) => {
      wssExtension.emit('connection', ws, request);
    });
  } else if (pathname === '/laptop') {
    wssLaptop.handleUpgrade(request, socket, head, (ws) => {
      wssLaptop.emit('connection', ws, request);
    });
  } else {
    // Để Socket.IO tự xử lý yêu cầu nâng cấp của nó (mặc định chạy qua đường dẫn /socket.io/)
  }
});

// Phục vụ giao diện tĩnh cho điện thoại từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

/* ==========================================================================
   XỬ LÝ KẾT NỐI TỪ CHROME EXTENSION (YOUTUBE REMOTE)
   ========================================================================== */
wssExtension.on('connection', (ws) => {
  console.log('[WS] Chrome Extension connected.');
  extensionSocket = ws;

  // Yêu cầu lấy thông tin bài hát ngay khi extension kết nối
  ws.send(JSON.stringify({ action: 'request-status' }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'yt-status-update') {
        ytStatus = { ...ytStatus, ...parsed.data };
        // Gửi cập nhật trạng thái bài nhạc về cho điện thoại
        io.emit('yt-status', ytStatus);
      }
    } catch (err) {
      console.error('[WS Extension Error] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Chrome Extension disconnected.');
    if (extensionSocket === ws) {
      extensionSocket = null;
    }
  });
});

/* ==========================================================================
   XỬ LÝ KẾT NỐI TỪ LAPTOP AGENT (AUDIO HELPER C#)
   ========================================================================== */
wssLaptop.on('connection', (ws) => {
  console.log('[WS] Laptop Agent connected.');
  laptopSocket = ws;
  laptopOnline = true;

  // Thông báo cho điện thoại biết Laptop đã online
  io.emit('laptop-connection', { online: true });

  // Yêu cầu laptop gửi âm lượng hệ thống hiện tại
  ws.send(JSON.stringify({ action: 'get-volume' }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'volume-status') {
        sysVolume = { ...sysVolume, ...parsed.data };
        // Gửi trạng thái âm lượng về cho điện thoại
        io.emit('volume-status', sysVolume);
      } else if (parsed.type === 'audio-peak') {
        // Gửi liên tục cường độ âm thanh về để nhấp nháy LED RGB trên điện thoại
        io.emit('audio-peak', parsed.data);
      }
    } catch (err) {
      console.error('[WS Laptop Error] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Laptop Agent disconnected.');
    if (laptopSocket === ws) {
      laptopSocket = null;
      laptopOnline = false;
      // Báo cho điện thoại biết Laptop đã offline
      io.emit('laptop-connection', { online: false });
    }
  });
});

/* ==========================================================================
   XỬ LÝ KẾT NỐI TỪ ĐIỆN THOẠI ANDROID (SOCKET.IO)
   ========================================================================== */
io.on('connection', (socket) => {
  console.log('[Socket] Android Phone connected.');

  // Gửi ngay lập tức trạng thái kết nối của laptop, thông tin nhạc và âm lượng cho điện thoại
  socket.emit('laptop-connection', { online: laptopOnline });
  socket.emit('yt-status', ytStatus);
  socket.emit('volume-status', sysVolume);

  // Nhận lệnh điều khiển YouTube từ điện thoại -> chuyển tiếp tới Chrome Extension
  socket.on('yt-command', (cmd) => {
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      extensionSocket.send(JSON.stringify(cmd));
    }
  });

  // Nhận lệnh điều khiển âm lượng từ điện thoại -> chuyển tiếp tới Laptop Agent C#
  socket.on('volume-command', (cmd) => {
    if (laptopSocket && laptopSocket.readyState === WebSocket.OPEN) {
      laptopSocket.send(JSON.stringify(cmd));
    }
  });

  // Yêu cầu làm mới/đồng bộ lại trạng thái từ điện thoại
  socket.on('request-status-refresh', () => {
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      extensionSocket.send(JSON.stringify({ action: 'request-status' }));
    }
    if (laptopSocket && laptopSocket.readyState === WebSocket.OPEN) {
      laptopSocket.send(JSON.stringify({ action: 'get-volume' }));
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Android Phone disconnected.');
  });
});

// Chạy Server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  CLOUD SERVER ĐANG HOẠT ĐỘNG!`);
  console.log(`======================================================`);
  console.log(`  Cổng máy chủ: ${PORT}`);
  console.log(`  Chế độ: Đám mây (Hỗ trợ Glitch / Render)`);
  console.log(`======================================================\n`);
});
