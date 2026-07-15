let ws = null;
let activeTabId = null;
let currentServerUrl = '';

console.log('[Background] Extension Background Service Worker loaded.');

// Hàm thiết lập trạng thái kết nối và lưu/gửi thông báo
function setConnectionStatus(connected) {
  chrome.storage.local.set({ connected: connected });
  // Gửi thông tin trạng thái cho popup.js nếu popup đang mở
  chrome.runtime.sendMessage({ type: 'status-change', connected: connected }).catch((err) => {
    // Bỏ qua lỗi khi popup đóng (không có người nghe)
  });
}

// Khởi động kết nối tới Server đám mây
function connectSocket() {
  chrome.storage.local.get(['serverUrl'], (res) => {
    const url = res.serverUrl;
    if (!url) {
      console.log('[Background] No server URL configured yet.');
      setConnectionStatus(false);
      return;
    }

    // Nếu đã kết nối đúng URL này rồi thì bỏ qua
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) && currentServerUrl === url) {
      return;
    }

    // Ngắt kết nối cũ nếu có
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
    }

    currentServerUrl = url;
    const wsEndpoint = `${url}/extension`;
    console.log('[Background] Connecting to Cloud WS:', wsEndpoint);

    ws = new WebSocket(wsEndpoint);

    ws.onopen = () => {
      console.log('[Background] Connected to cloud server:', wsEndpoint);
      setConnectionStatus(true);
      requestStatusFromActiveTab();
    };

    ws.onmessage = (event) => {
      try {
        const cmd = JSON.parse(event.data);
        console.log('[Background] Received command:', cmd);

        // Gửi lệnh điều khiển xuống content.js trên tab YouTube
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, cmd, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[Background] Tab not responding, searching alternative tabs...');
              findAndSendCommand(cmd);
            }
          });
        } else {
          findAndSendCommand(cmd);
        }
      } catch (e) {
        console.error('[Background] Error parsing server message:', e);
      }
    };

    ws.onclose = () => {
      console.log('[Background] Disconnected from cloud server.');
      setConnectionStatus(false);
    };

    ws.onerror = (err) => {
      console.error('[Background] WebSocket error:', err);
      setConnectionStatus(false);
    };
  });
}

function findAndSendCommand(cmd) {
  chrome.tabs.query({ url: "https://*.youtube.com/watch*" }, (tabs) => {
    if (tabs && tabs.length > 0) {
      activeTabId = tabs[0].id;
      chrome.tabs.sendMessage(activeTabId, cmd, () => {
        if (chrome.runtime.lastError) {
          // Bỏ qua lỗi âm thầm
        }
      });
    }
  });
}

function requestStatusFromActiveTab() {
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { action: 'request-status' }, () => {
      if (chrome.runtime.lastError) {
        // Bỏ qua lỗi âm thầm
      }
    });
  }
}

// Lắng nghe sự kiện từ popup.js hoặc content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Nhận tín hiệu kết nối lại khi người dùng đổi URL lưu trữ ở Popup
  if (message.type === 'reconnect') {
    console.log('[Background] Reconnect signal received. Connecting to new URL...');
    connectSocket();
    sendResponse({ success: true });
  }
  // Nhận thông tin bài nhạc cập nhật từ content.js gửi lên
  else if (message.type === 'yt-status-update') {
    if (sender.tab) {
      activeTabId = sender.tab.id;
    }

    // Chuyển tiếp dữ liệu bài hát lên máy chủ Cloud
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'yt-status-update',
        data: message.data
      }));
    }
    sendResponse({ success: true });
  }
  return true;
});

// Kết nối ban đầu
connectSocket();

// Tự động kiểm tra kết nối định kỳ và kết nối lại nếu bị ngắt
setInterval(() => {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    connectSocket();
  }
}, 5000);
