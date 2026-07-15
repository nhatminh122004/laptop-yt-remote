let videoElement = null;
let statusInterval = null;

console.log('[YT-Remote] Content script running and monitoring YouTube video elements.');

// Hàm lấy ID video từ URL
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// Lấy thông tin trạng thái trình phát hiện tại
function getPlayerStatus() {
  if (!videoElement) {
    videoElement = document.querySelector('video');
  }

  if (!videoElement) return null;

  const videoId = getVideoId();
  if (!videoId) return null;

  // Tiêu đề video
  let title = 'Unknown Track';
  const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') || 
                  document.querySelector('h1.ytd-watch-metadata') ||
                  document.querySelector('yt-formatted-string.ytd-video-primary-info-renderer');
  if (titleEl) {
    title = titleEl.textContent.trim();
  } else {
    title = document.title.replace(' - YouTube', '').trim();
  }

  // Tên kênh
  let artist = 'YouTube';
  const artistEl = document.querySelector('ytd-channel-name yt-formatted-string a') ||
                   document.querySelector('#owner-name a');
  if (artistEl) {
    artist = artistEl.textContent.trim();
  }

  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return {
    title: title,
    artist: artist,
    thumbnail: thumbnail,
    duration: Math.floor(videoElement.duration || 0),
    progress: Math.floor(videoElement.currentTime || 0),
    playing: !videoElement.paused && !videoElement.ended
  };
}

// Gửi trạng thái về cho background.js thay vì gửi trực tiếp tới socket
function sendStatusToBackground() {
  const status = getPlayerStatus();
  if (status) {
    chrome.runtime.sendMessage({ type: 'yt-status-update', data: status }, (response) => {
      // Bắt lỗi âm thầm khi background chưa sẵn sàng kết nối
      if (chrome.runtime.lastError) {
        // Đôi khi xảy ra khi tải lại extension
      }
    });
  }
}

// Thiết lập lắng nghe sự kiện từ thẻ video
function setupVideoEvents() {
  if (!videoElement) {
    videoElement = document.querySelector('video');
  }

  if (!videoElement) return false;

  videoElement.removeEventListener('play', sendStatusToBackground);
  videoElement.removeEventListener('pause', sendStatusToBackground);
  videoElement.removeEventListener('seeking', sendStatusToBackground);

  videoElement.addEventListener('play', sendStatusToBackground);
  videoElement.addEventListener('pause', sendStatusToBackground);
  videoElement.addEventListener('seeking', sendStatusToBackground);

  return true;
}

function checkAndHookVideo() {
  const hooked = setupVideoEvents();
  if (!hooked) {
    setTimeout(checkAndHookVideo, 1000);
  } else {
    sendStatusToBackground();
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(sendStatusToBackground, 1000);
  }
}

// Theo dõi sự thay đổi URL của YouTube
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(checkAndHookVideo, 1000);
  }
}).observe(document, { subtree: true, childList: true });

checkAndHookVideo();

// Lắng nghe lệnh điều khiển gửi từ background.js xuống
chrome.runtime.onMessage.addListener((cmd, sender, sendResponse) => {
  if (!videoElement) {
    videoElement = document.querySelector('video');
  }
  if (!videoElement) return;

  console.log('[YT-Remote] Command received in tab:', cmd);

  switch (cmd.action) {
    case 'play':
      videoElement.play();
      break;
    case 'pause':
      videoElement.pause();
      break;
    case 'next':
      const nextBtn = document.querySelector('.ytp-next-button');
      if (nextBtn) nextBtn.click();
      break;
    case 'prev':
      const prevBtn = document.querySelector('.ytp-prev-button');
      if (prevBtn && prevBtn.style.display !== 'none') {
        prevBtn.click();
      } else {
        window.history.back();
      }
      break;
    case 'seek':
      if (cmd.value !== undefined) {
        videoElement.currentTime = cmd.value;
      }
      break;
    case 'request-status':
      sendStatusToBackground();
      break;
  }
  
  setTimeout(sendStatusToBackground, 200);
  sendResponse({ success: true });
});
