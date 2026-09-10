/* 한국어 위키백과에서 '지금 이 자리'의 사실 자료를 가져온다.
   origin=* 를 붙이면 브라우저에서 바로 부를 수 있다. 키가 필요 없다. */

const API = 'https://ko.wikipedia.org/w/api.php';

/* 위키백과는 짧은 사이에 몰아치면 429로 막아 선다.
   홈 한 화면에 카드가 스무 장이면 요청도 스무 개가 한꺼번에 나갔고,
   막힌 요청만큼 썸네일과 한 줄 소개가 비어 보였다.
   한 번에 넷까지만 내보내고, 막히면 잠깐 쉬었다 다시 묻는다. */
const MAX_LIVE = 4;
let live = 0;
const queue = [];

function slot() {
  if (live < MAX_LIVE) { live += 1; return Promise.resolve(); }
  return new Promise(go => queue.push(go));
}
function release() {
  const go = queue.shift();
  if (go) go();               // 자리를 그대로 넘긴다
  else live -= 1;
}
const nap = ms => new Promise(r => setTimeout(r, ms));

async function get(params) {
  const q = new URLSearchParams({
    ...params, format: 'json', formatversion: '2', origin: '*',
  });
  const url = `${API}?${q}`;
  await slot();
  try {
    for (let tries = 0; ; tries += 1) {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      // 429·503 은 '지금은 말고'라는 뜻이다. 세 번까지 기다렸다 다시 묻는다.
      if ((r.status === 429 || r.status === 503) && tries < 3) {
        await nap(500 * (tries + 1));
        continue;
      }
      throw new Error('위키백과 ' + r.status);
    }
  } finally { release(); }
}

/* 같은 자리를 다시 물으면 그대로 돌려준다. 지도를 열 때 미리 받아 둘 수 있게 한다. */
const nearCache = new Map();

export function nearby(lat, lon, radius = 1500, limit = 10) {
  const key = `${(+lat).toFixed(3)},${(+lon).toFixed(3)}|${radius}|${limit}`;
  if (nearCache.has(key)) return nearCache.get(key);
  const job = nearbyOnce(lat, lon, radius, limit);
  nearCache.set(key, job);
  job.catch(() => nearCache.delete(key));
  return job;
}

async function nearbyOnce(lat, lon, radius, limit) {
  try {
    const d = await get({ action: 'query', list: 'geosearch',
      gscoord: `${lat}|${lon}`, gsradius: radius, gslimit: limit });
    // 지도에 꽂으려면 좌표가 필요하다. 지오서치가 이미 주고 있었다.
    return (d.query?.geosearch || []).map(x =>
      ({ title: x.title, dist: Math.round(x.dist), lat: x.lat, lon: x.lon }));
  } catch (_) { return []; }
}

export async function search(term, limit = 3) {
  try {
    const d = await get({ action: 'query', list: 'search', srsearch: term, srlimit: limit });
    return (d.query?.search || []).map(x => x.title);
  } catch (_) { return []; }
}

export async function extracts(titles, introOnly = true, limitChars = 2000) {
  if (!titles.length) return {};
  const p = { action: 'query', prop: 'extracts', explaintext: '1',
              titles: titles.slice(0, 6).join('|') };
  if (introOnly) p.exintro = '1';
  try {
    const d = await get(p);
    const out = {};
    for (const page of d.query?.pages || []) {
      const t = (page.extract || '').trim();
      if (t) out[page.title] = t.slice(0, limitChars);
    }
    return out;
  } catch (_) { return {}; }
}

export async function pageImage(title, size = 900) {
  try {
    const d = await get({ action: 'query', prop: 'pageimages', piprop: 'thumbnail',
      pithumbsize: size, titles: title });
    for (const p of d.query?.pages || [])
      if (realPhoto(p.thumbnail?.source)) return p.thumbnail.source;
  } catch (_) {}
  return '';
}

/* 위키백과는 사진이 없는 문서에 '사진이 없습니다' 안내 그림을 대표 이미지로 단다.
   그걸 그대로 썸네일에 걸면 화면에 빈 액자만 늘어선다. 없는 셈 친다. */
const PLACEHOLDER = /replace[_-]?this[_-]?image|no[_-]?free[_-]?image|question[_-]?book|nuvola|image[_-]?manquante|sin[_-]?imagen/i;
export function realPhoto(url) {
  return url && !PLACEHOLDER.test(url) ? url : '';
}

// 사진이 아닌 것 / 여러 장을 붙인 것
const NOT_PHOTO = ['icon', 'logo', 'map', '지도', 'symbol', 'flag', 'seal', 'emblem',
  'commons', 'wikimedia', 'wiki', 'ambox', 'disambig', 'question', 'arrow', 'edit',
  'star', 'crystal', '가지', '문장'];
const COMPOSITE = ['collage', 'montage', 'composite', 'panorama', 'panoramic', 'combo',
  'series', 'set of', 'plate', 'diagram', 'chart', 'layout', '도면', '배치도', '모음',
  '전경도', 'stitched', 'before and after', 'comparison', 'grid'];

export async function gallery(titles, limit = 8, width = 1400) {
  if (!titles.length) return [];
  let d;
  try {
    d = await get({ action: 'query', prop: 'images', imlimit: 40,
      titles: titles.slice(0, 3).join('|') });
  } catch (_) { return []; }

  const files = [];
  for (const page of d.query?.pages || [])
    for (const im of page.images || []) {
      const low = im.title.toLowerCase();
      if (/\.(svg|ogg|ogv|webm|pdf|gif)$/.test(low)) continue;
      if (NOT_PHOTO.some(w => low.includes(w))) continue;
      if (!files.includes(im.title)) files.push(im.title);
    }
  if (!files.length) return [];

  try {
    d = await get({ action: 'query', titles: files.slice(0, 20).join('|'),
      prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: width });
  } catch (_) { return []; }

  const out = [];
  for (const page of d.query?.pages || []) {
    const info = (page.imageinfo || [{}])[0];
    const url = info.thumburl || info.url;
    const w = info.width || 0, h = info.height || 0;
    if (!url || w < 500) continue;
    const name = page.title.split(':').slice(1).join(':').replace(/\.[^.]+$/, '');
    if (COMPOSITE.some(k => name.toLowerCase().includes(k))) continue;
    if (h) { const ratio = w / h; if (ratio > 2.0 || ratio < 0.5) continue; }
    out.push({ url, title: name });
    if (out.length >= limit) break;
  }
  return out;
}

// 소리내어 읽을 때 방해가 되는 것들을 걷어낸다
const HANJA_PAREN = /\(\s*[^)]*[一-鿿][^)]*\)/g;
const LATIN_PAREN = /\(\s*[A-Za-z][^)]*\)/g;

export function forSpeech(text) {
  return text.replace(HANJA_PAREN, '').replace(LATIN_PAREN, '')
             .replace(/[ \t]{2,}/g, ' ').trim();
}

const gatherCache = new Map();      // 같은 자리를 다시 들을 땐 그대로 쓴다

export async function gather({ lat, lon, manual }) {
  const ck = manual || `${(+lat).toFixed(3)},${(+lon).toFixed(3)}`;
  if (gatherCache.has(ck)) return gatherCache.get(ck);
  const job = gatherOnce({ lat, lon, manual });
  gatherCache.set(ck, job);
  job.catch(() => gatherCache.delete(ck));
  return job;
}

/* 한 번의 호출로 검색·본문·대표사진을 함께 받는다.
   예전엔 검색 → 본문 두 번 오갔는데, generator 를 쓰면 왕복이 한 번이면 된다. */
async function gatherOnce({ lat, lon, manual }) {
  const base = {
    action: 'query',
    // 좌표는 '지금 그 자리에 서 있는지' 가려내는 데 쓴다. 같은 요청이라 값이 들지 않는다.
    prop: 'extracts|pageimages|coordinates',
    explaintext: '1', exintro: '1', exlimit: 'max',
    piprop: 'thumbnail', pithumbsize: 900,
  };
  const p = manual
    ? { ...base, generator: 'search', gsrsearch: manual, gsrlimit: 5 }
    : { ...base, generator: 'geosearch', ggscoord: `${lat}|${lon}`,
        ggsradius: 1500, ggslimit: 6 };

  let pages = [];
  try {
    const d = await get(p);
    pages = d.query?.pages || [];
  } catch (_) { pages = []; }

  // 검색은 관련도순, 좌표는 가까운 순으로 돌려준다
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  /* 관련도만 믿으면 '경주 불국사'를 물었을 때 '경주 불국사 삼층석탑'이 먼저 온다.
     이름이 같은 문서를 앞에 세우고, 없으면 물어본 이름 안에 들어 있는 쪽을 고른다. */
  if (manual) {
    const norm = x => x.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, '');
    const q = norm(manual);
    const rank = pg => {
      const t = norm(pg.title);
      if (t === q) return 0;
      if (t.length >= 2 && q.includes(t)) return 1;
      return 2;
    };
    pages.sort((a, b) => rank(a) - rank(b) || (a.index ?? 0) - (b.index ?? 0));
  }

  if (!pages.length)
    return { place: manual || '', primary: '', intro: '', image: '',
             sources: [], nearby: [], coord: null };

  const primary = pages[0];
  const sources = [];
  pages.slice(0, 5).forEach((pg, i) => {
    const text = (pg.extract || '').trim();
    if (!text) return;
    sources.push({
      title: pg.title,
      dist: null,
      text: forSpeech(text.slice(0, i === 0 ? 1800 : 700)),
    });
  });

  const c = primary.coordinates?.[0];
  return {
    place: primary.title,
    primary: primary.title,
    // 카드의 한 줄 소개도 여기서 나온다 — 따로 물으면 요청만 늘어난다
    intro: forSpeech((primary.extract || '').trim()),
    image: realPhoto(primary.thumbnail?.source || ''),
    sources,
    nearby: pages.slice(1, 6).map(x => x.title),
    coord: c ? { lat: c.lat, lon: c.lon } : null,
  };
}



/* 여러 곳의 대표 사진을 한 번에 받아 온다.
   한 곳씩 부르면 열두 곳에 스물네 번의 요청이 나간다. 한 번이면 된다. */
const thumbCache = new Map();

export async function thumbs(titles, size = 160) {
  const out = {};
  const need = titles.filter(t => {
    if (thumbCache.has(t)) { out[t] = thumbCache.get(t); return false; }
    return true;
  });
  titles = need;
  for (let i = 0; i < titles.length; i += 50) {
    try {
      const d = await get({
        action: 'query', prop: 'pageimages', piprop: 'thumbnail',
        pithumbsize: size, pilimit: 'max',
        titles: titles.slice(i, i + 50).join('|'),
      });
      for (const p of (d.query?.pages || [])) {
        const u = realPhoto(p.thumbnail?.source || '');
        thumbCache.set(p.title, u);
        if (u) out[p.title] = u;
      }
    } catch (_) {}
  }
  return out;
}
