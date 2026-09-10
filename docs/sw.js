/* 여행 도슨트 서비스워커
   껍데기(HTML·CSS·JS·아이콘)만 캐시한다.
   해설과 사진은 매번 새로 받아야 하므로 캐시하지 않는다. */

const SHELL = 'docent3-shell-v74';
const FILES = ['./', './index.html', './style.css', './app.js',
               './manifest.webmanifest',
               './lib/wiki.js', './lib/llm.js', './lib/tts.js',
               './lib/photos.js', './lib/geo.js', './lib/keys.js', './lib/places.js', './lib/geoindex.js', './lib/score.js', './lib/place.js',
               './icons/icon-192.png',
               './icons/icon-512.png', './icons/maskable-512.png',
               './icons/apple-touch-152.png', './icons/apple-touch-167.png',
               './icons/apple-touch-180.png'];

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

  /* 예전에는 매번 네트워크를 먼저 기다렸다.
     껍데기 파일 열한 개가 전부 왕복을 기다리니 켤 때마다 그만큼 늦었다.
     이제 캐시에 있으면 곧바로 내주고, 새 것은 뒤에서 받아 다음 실행에 쓴다. */
  /* 화면(HTML)은 늘 새것을 받는다.
     이것만 캐시에서 내주면, 새 app.js 와 옛 index.html 이 섞여
     없는 요소를 찾다가 앱이 멈추는 일이 생긴다. */
  const isPage = e.request.mode === 'navigate' ||
                 (e.request.destination === 'document');
  if (isPage) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(SHELL).then(c => c.put(e.request, res.clone())).catch(() => {});
          return res;
        })
        /* caches.match 는 약속(Promise)을 돌려준다. 약속은 언제나 참이라
           예전의 `a || b` 는 b 로 넘어가는 법이 없었고, 캐시가 비어 있으면
           undefined 를 내주어 화면이 아예 뜨지 않았다. */
        .catch(() => caches.match('./index.html', { cacheName: SHELL })
          .then(hit => hit || caches.match('./index.html'))
          .then(hit => hit || new Response(
            '<!doctype html><meta charset=utf-8><p style="font:16px/1.6 system-ui;padding:24px">'
            + '연결이 없어 화면을 불러오지 못했어요. 연결된 뒤 다시 열어 주세요.',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
    );
    return;
  }

  /* 나머지는 캐시를 먼저 내주고 새것은 뒤에서 받아 둔다.
     반드시 지금 판(SHELL) 안에서만 찾는다 — 옛 판이 남아 있으면
     새 파일과 옛 파일이 섞여 내려간다. */
  e.respondWith(
    caches.open(SHELL).then(cache => cache.match(e.request).then(hit => {
      const fresh = fetch(e.request)
        .then(res => {
          if (res && res.ok) cache.put(e.request, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }))
  );
});
