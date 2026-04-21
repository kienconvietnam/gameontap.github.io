const CACHE_NAME = 'youtube-music-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Trả về từ cache nếu có, nếu không thì lấy từ mạng
            return response || fetch(event.request);
        })
    );
});