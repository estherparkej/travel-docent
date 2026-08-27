/* 여행 도슨트 서비스워커
   껍데기(HTML·CSS·JS·아이콘)만 캐시한다.
   해설과 사진은 매번 새로 받아야 하므로 캐시하지 않는다. */

const SHELL = 'docent-shell-v6';
const FILES = ['./', './index.html', './style.css', './app.js',
               './manifest.webmanifest',
               './lib/wiki.js', './lib/llm.js', './lib/tts.js',
               './lib/photos.js', './lib/geo.js', './lib/keys.js',
               './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // API 와 외부 사진은 항상 네트워크
  if (url.pathname.startsWith('/api/') || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
