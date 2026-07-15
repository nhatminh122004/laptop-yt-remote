let ws = null;
let activeTabId = null;

console.log('[Background] Extension Background Service Worker loaded (Local Mode).');

function connectSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  console.log('[Background] Connecting to local server ws://localhost:3001...');
  ws = new WebSocket('ws://localhost:3001');

  ws.onopen = () => {
    console.log('[Background] Connected to local server.');
    requestStatusFromActiveTab();
  };

  ws.onmessage = (event) => {
    try {
      const cmd = JSON.parse(event.data);
      console.log('[Background] Received command from server:', cmd);

      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, cmd, (response) => {
          if (chrome.runtime.lastError) {
            findAndSendCommand(cmd);
          }
        });
      } else {
        findAndSendCommand(cmd);
      }
    } catch (e) {
      console.error('[Background] Error parsing message:', e);
    }
  };

  ws.onclose = () => {
    console.log('[Background] Disconnected from local server.');
  };

  ws.onerror = (err) => {
    console.error('[Background] WebSocket error:', err);
  };
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

// Kết nối lần đầu
connectSocket();

// Tự động kiểm tra và kết nối lại sau mỗi 5 giây nếu đóng
setInterval(() => {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    connectSocket();
  }
}, 5000);

// Lắng nghe cập nhật trạng thái bài nhạc từ content.js gửi lên
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'yt-status-update') {
    if (sender.tab) {
      activeTabId = sender.tab.id;
    }

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
