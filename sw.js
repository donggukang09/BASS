/* BASS LOG 서비스 워커 — 신호 없는 저수지에서도 앱이 열리게
   DEVELOPED BY DONGGU KANG */
const CACHE = 'bass-log-v3';
const TILES = 'bass-log-tiles';
const MAX_TILES = 1500;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trimTiles(){
  const c = await caches.open(TILES), keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  // 데이터·날씨는 항상 네트워크 (앱이 직접 오프라인 처리)
  // 네이버 지도는 약관상 저장 금지 → 캐시하지 않음
  if (/script\.google|googleusercontent|open-meteo|naver\.com|naver\.net|pstatic\.net/.test(u.hostname)) return;

  // 앱 파일: 네트워크 우선 → 새 버전 바로 반영, 안 되면 캐시
  if (u.origin === location.origin) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }

  // 폰트·지도 라이브러리·지도 타일: 캐시 우선 (한 번 본 지도는 오프라인에서도 보임)
  const isTile = /arcgisonline|cartocdn/.test(u.hostname);
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') {
      const cp = r.clone();
      caches.open(isTile ? TILES : CACHE).then(c => c.put(req, cp)).then(() => { if (isTile) trimTiles(); });
    }
    return r;
  })));
});
