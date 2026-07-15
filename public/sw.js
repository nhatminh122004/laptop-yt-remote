const CACHE_NAME = 'yt-remote-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './default-thumb.jpg',
  './icon-192.png',
  './icon-512.png'
];

// Cài đặt Service Worker và lưu trữ tài nguyên vào cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Kích hoạt Service Worker và dọn dẹp các cache cũ
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Chặn các yêu cầu mạng và trả về từ cache nếu có sẵn
self.addEventListener('fetch', (e) => {
  // Chỉ cache các request HTTP/HTTPS thông thường (tránh cache socket.io)
  if (e.request.url.startsWith(self.location.origin) && !e.request.url.includes('/socket.io/')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
    );
  }
});
