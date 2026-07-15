document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('server-url');
  const btn = document.getElementById('btn-save');
  const statusSpan = document.getElementById('status');

  // Lấy URL lưu trữ và trạng thái hiện tại
  chrome.storage.local.get(['serverUrl', 'connected'], (res) => {
    if (res.serverUrl) {
      input.value = res.serverUrl;
    } else {
      input.value = '';
    }
    updateStatus(res.connected);
  });

  // Sự kiện lưu cấu hình
  btn.addEventListener('click', () => {
    let url = input.value.trim();
    if (!url) {
      alert('Vui lòng nhập URL máy chủ.');
      return;
    }
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      alert('URL phải bắt đầu bằng ws:// hoặc wss://');
      return;
    }

    // Đảm bảo không có dấu / thừa ở cuối
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    chrome.storage.local.set({ serverUrl: url }, () => {
      // Gửi tín hiệu báo cho background.js biết để ngắt kết nối cũ và kết nối tới URL mới
      chrome.runtime.sendMessage({ type: 'reconnect' });
      alert('Lưu cài đặt thành công! Hệ thống đang kết nối...');
    });
  });

  // Hàm hiển thị trạng thái kết nối
  function updateStatus(connected) {
    if (connected) {
      statusSpan.textContent = 'Online';
      statusSpan.className = 'connected';
    } else {
      statusSpan.textContent = 'Offline';
      statusSpan.className = 'disconnected';
    }
  }

  // Nhận thông báo thay đổi trạng thái từ background.js gửi sang
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'status-change') {
      updateStatus(msg.connected);
    }
  });
});
