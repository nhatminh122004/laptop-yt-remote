// Khởi tạo kết nối Socket.IO tới chính Server đã cung cấp trang web này
const socket = io();

// Các phần tử giao diện
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const btnRefresh = document.getElementById('btn-refresh');

const trackThumb = document.getElementById('track-thumb');
const thumbnailGlow = document.getElementById('thumbnail-glow');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');

const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const progressSlider = document.getElementById('progress-slider');
const progressFill = document.getElementById('progress-fill');

const btnPrev = document.getElementById('btn-prev');
const btnPlay = document.getElementById('btn-play');
const btnNext = document.getElementById('btn-next');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

const btnMute = document.getElementById('btn-mute');
const volumeActiveIcon = document.getElementById('volume-icon-active');
const volumeMutedIcon = document.getElementById('volume-icon-muted');
const volumeSlider = document.getElementById('volume-slider');
const volumeFill = document.getElementById('volume-fill');
const volumeVal = document.getElementById('volume-val');

const rgbAura = document.getElementById('rgb-aura');

// Trạng thái cục bộ
let isPlaying = false;
let currentTrackDuration = 0;
let isDraggingProgress = false;
let isDraggingVolume = false;

// Hàm định dạng giây thành dạng phút:giây (m:ss)
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Xử lý marquee cho tiêu đề bài hát nếu quá dài
function handleTitleMarquee(title) {
  trackTitle.textContent = title;
  
  // Xóa hiệu ứng cũ
  trackTitle.classList.remove('marquee-animation');
  trackTitle.style.transform = 'none';
  
  // Đợi DOM cập nhật rồi đo độ dài
  setTimeout(() => {
    const containerWidth = trackTitle.parentElement.clientWidth;
    const textWidth = trackTitle.scrollWidth;
    
    if (textWidth > containerWidth) {
      // Nhân đôi tiêu đề để tạo vòng lặp mượt mà
      trackTitle.textContent = `${title}   •   ${title}   •   `;
      trackTitle.classList.add('marquee-animation');
      // Thiết lập thời gian chạy động dựa trên độ dài chữ
      const duration = Math.max(8, textWidth / 25); 
      trackTitle.style.animationDuration = `${duration}s`;
    }
  }, 100);
}

/* ==========================================================================
   KẾT NỐI SOCKET & CẬP NHẬT TRẠNG THÁI
   ========================================================================== */

socket.on('connect', () => {
  statusText.textContent = 'Searching for Laptop...';
  console.log('Connected to cloud server. Waiting for Laptop...');
});

socket.on('disconnect', () => {
  statusDot.className = 'dot disconnected';
  statusText.textContent = 'Connecting to Cloud...';
  console.log('Disconnected from cloud server.');
});

// Nhận cập nhật trạng thái kết nối của Laptop
socket.on('laptop-connection', (status) => {
  if (status.online) {
    statusDot.className = 'dot connected';
    statusText.textContent = 'Laptop Online';
  } else {
    statusDot.className = 'dot disconnected';
    statusText.textContent = 'Laptop Offline';
  }
});

// Nhận cập nhật nhạc YouTube từ Laptop
socket.on('yt-status', (status) => {
  isPlaying = status.playing;
  currentTrackDuration = status.duration;

  // Cập nhật tên và tác giả
  handleTitleMarquee(status.title);
  trackArtist.textContent = status.artist;

  // Cập nhật hình ảnh thu nhỏ
  if (status.thumbnail) {
    trackThumb.src = status.thumbnail;
  } else {
    trackThumb.src = 'default-thumb.jpg';
  }

  // Cập nhật trạng thái xoay của đĩa nhạc (thumbnail)
  if (isPlaying) {
    trackThumb.classList.remove('paused');
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    trackThumb.classList.add('paused');
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }

  // Cập nhật thanh tiến trình chạy (nếu người dùng không kéo)
  if (!isDraggingProgress) {
    progressSlider.max = status.duration || 100;
    progressSlider.value = status.progress || 0;
    timeCurrent.textContent = formatTime(status.progress);
    timeTotal.textContent = formatTime(status.duration);
    
    const percentage = status.duration ? (status.progress / status.duration) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
  }
});

// Nhận cập nhật âm lượng hệ thống
socket.on('volume-status', (status) => {
  if (!isDraggingVolume) {
    volumeSlider.value = status.volume;
    volumeVal.textContent = `${status.volume}%`;
    volumeFill.style.width = `${status.volume}%`;

    if (status.muted) {
      volumeActiveIcon.classList.add('hidden');
      volumeMutedIcon.classList.remove('hidden');
    } else {
      volumeActiveIcon.classList.remove('hidden');
      volumeMutedIcon.classList.add('hidden');
    }
  }
});

// Nhận luồng âm thanh đỉnh (Peak Level) từ laptop chạy hiệu ứng RGB
socket.on('audio-peak', (peak) => {
  // peak là float từ 0.0 đến 1.0 đại diện cho cường độ âm thanh
  const root = document.documentElement;

  // Cập nhật các biến CSS tùy biến
  const glowRadius = peak * 45; // Tăng bán kính shadow lên tối đa 45px
  const scale = 1.0 + (peak * 0.08); // Phóng to viền nhấp nháy 8%
  
  root.style.setProperty('--peak-glow', `${glowRadius}px`);
  root.style.setProperty('--peak-scale', scale);

  // Thay đổi màu sắc RGB viền động dựa trên mức cường độ nhạc (Bass drop, v.v.)
  let color = 'var(--accent-violet)'; // Nhạc nhẹ/Mặc định
  if (peak > 0.1 && peak < 0.5) {
    color = 'var(--accent-cyan)'; // Nhạc vừa
  } else if (peak >= 0.5) {
    color = 'var(--accent-pink)'; // Nhạc sôi động / Nhiều bass
  }
  root.style.setProperty('--peak-color', color);
});

/* ==========================================================================
   TƯƠNG TÁC NGƯỜI DÙNG (GỬI LỆNH)
   ========================================================================== */

// Nút Play/Pause
btnPlay.addEventListener('click', () => {
  socket.emit('yt-command', { action: isPlaying ? 'pause' : 'play' });
});

// Nút chuyển bài
btnNext.addEventListener('click', () => {
  socket.emit('yt-command', { action: 'next' });
});

// Nút quay lại bài trước
btnPrev.addEventListener('click', () => {
  socket.emit('yt-command', { action: 'prev' });
});

// Sự kiện tua tiến trình nhạc (Seek)
progressSlider.addEventListener('input', () => {
  isDraggingProgress = true;
  timeCurrent.textContent = formatTime(progressSlider.value);
  const percentage = (progressSlider.value / progressSlider.max) * 100;
  progressFill.style.width = `${percentage}%`;
});

progressSlider.addEventListener('change', () => {
  isDraggingProgress = false;
  socket.emit('yt-command', { action: 'seek', value: parseInt(progressSlider.value, 10) });
});

// Sự kiện thay đổi âm lượng
volumeSlider.addEventListener('input', () => {
  isDraggingVolume = true;
  volumeVal.textContent = `${volumeSlider.value}%`;
  volumeFill.style.width = `${volumeSlider.value}%`;
});

volumeSlider.addEventListener('change', () => {
  isDraggingVolume = false;
  socket.emit('volume-command', { action: 'set', value: parseInt(volumeSlider.value, 10) });
});

// Nút tắt tiếng (Mute)
btnMute.addEventListener('click', () => {
  socket.emit('volume-command', { action: 'mute', value: 'toggle' });
});

// Nút yêu cầu đồng bộ làm mới
btnRefresh.addEventListener('click', () => {
  socket.emit('request-status-refresh');
  
  // Hiệu ứng xoay nhẹ nút làm mới khi bấm
  btnRefresh.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    btnRefresh.style.transform = 'none';
  }, 500);
});

// Đăng ký Service Worker cho PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registered successfully.', reg))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}
