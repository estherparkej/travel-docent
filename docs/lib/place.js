/* 장소 상세에 쓰는 것들.
   지도 앱으로 길을 넘기고, 사람들이 언제 이곳을 궁금해했는지 세어 온다. */

/* ── 길안내 ──────────────────────────────────────────────
   앱이 깔려 있으면 앱으로, 없으면 웹으로 간다.
   앱 주소로 먼저 가 보고, 잠시 뒤에도 화면이 그대로면 웹으로 넘긴다. */
/* 각 앱의 상징색과 머리글자로 동그란 표를 만든다.
   실제 앱 로고는 상표라 앱 안에 넣지 않았다. 색과 글자만으로도 알아볼 수 있다. */
export const ROUTE_APPS = [
  { id: 'naver',  name: '네이버', mark: 'N', color: '#03C75A' },
  { id: 'tmap',   name: '티맵',   mark: 'T', color: '#0F4CFF' },
  { id: 'kakao',  name: '카카오', mark: 'K', color: '#FFE300', ink: '#2B1A17' },
  { id: 'google', name: '구글',   mark: 'G', color: '#4285F4' },
];

function urls(app, from, to, name) {
  const q = encodeURIComponent(name);
  const s = from ? `${from.lat},${from.lon}` : '';
  switch (app) {
    case 'naver':
      return [
        from ? `nmap://route/car?slat=${from.lat}&slng=${from.lon}&sname=${encodeURIComponent('현위치')}` +
               `&dlat=${to.lat}&dlng=${to.lon}&dname=${q}&appname=travel.docent`
             : `nmap://place?lat=${to.lat}&lng=${to.lon}&name=${q}&appname=travel.docent`,
        `https://map.naver.com/p/search/${q}`,
      ];
    case 'tmap':
      return [
        `tmap://route?goalname=${q}&goalx=${to.lon}&goaly=${to.lat}`,
        `https://tmap.life/route?goalname=${q}&goalx=${to.lon}&goaly=${to.lat}`,
      ];
    case 'kakao':
      return [
        from ? `kakaomap://route?sp=${s}&ep=${to.lat},${to.lon}&by=CAR`
             : `kakaomap://look?p=${to.lat},${to.lon}`,
        `https://map.kakao.com/link/to/${q},${to.lat},${to.lon}`,
      ];
    default:
      return [
        `https://www.google.com/maps/dir/?api=1${from ? `&origin=${s}` : ''}` +
        `&destination=${to.lat},${to.lon}&travelmode=driving`,
        null,
      ];
  }
}

export function openRoute(app, from, to, name) {
  const [deep, web] = urls(app, from, to, name);
  if (!web) { window.open(deep, '_blank', 'noopener'); return; }

  /* 앱이 없으면 아무 일도 일어나지 않는다.
     화면이 그대로면 앱이 없다는 뜻이므로 웹으로 보낸다. */
  const t0 = Date.now();
  let done = false;
  const gone = () => { done = true; };
  document.addEventListener('visibilitychange', gone, { once: true });
  window.addEventListener('pagehide', gone, { once: true });
  location.href = deep;
  setTimeout(() => {
    document.removeEventListener('visibilitychange', gone);
    if (!done && Date.now() - t0 < 2200) window.open(web, '_blank', 'noopener');
  }, 1100);
}

/* ── 언제 많이 찾을까 ────────────────────────────────────
   위키백과를 찾아본 사람 수를 달마다 센다.
   방문객 수 자체는 무료로 구할 길이 없다. 관심의 크기를 대신 본다. */
export async function monthlyInterest(title) {
  const end = new Date(); end.setMonth(end.getMonth() - 1);
  const start = new Date(end); start.setMonth(start.getMonth() - 11);
  const f = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}0100`;
  try {
    const j = await fetch('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article' +
      `/ko.wikipedia/all-access/all-agents/${encodeURIComponent(title.replace(/ /g, '_'))}` +
      `/monthly/${f(start)}/${f(end)}`).then(r => r.json());
    const items = (j.items || []).map(i => ({
      month: +i.timestamp.slice(4, 6), views: i.views,
    }));
    return items.length >= 6 ? items : null;
  } catch (_) { return null; }
}

/* ── 찜한 곳 ─────────────────────────────────────────── */
const LIKED = 'liked';
export function liked() {
  try { return JSON.parse(localStorage.getItem(LIKED) || '[]'); } catch (_) { return []; }
}
export function toggleLike(name) {
  const all = liked();
  const i = all.indexOf(name);
  if (i >= 0) all.splice(i, 1); else all.unshift(name);
  localStorage.setItem(LIKED, JSON.stringify(all.slice(0, 200)));
  return i < 0;
}

/* ── 나누기 ──────────────────────────────────────────── */
export async function share(name, text) {
  const data = { title: `${name} · 여행 도슨트`, text, url: location.href };
  if (navigator.share) {
    try { await navigator.share(data); return 'shared'; } catch (_) { return 'cancel'; }
  }
  try {
    await navigator.clipboard.writeText(`${data.title}\n${data.url}`);
    return 'copied';
  } catch (_) { return 'fail'; }
}
