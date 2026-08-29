/* 한국어 위키백과에서 '지금 이 자리'의 사실 자료를 가져온다.
   origin=* 를 붙이면 브라우저에서 바로 부를 수 있다. 키가 필요 없다. */

const API = 'https://ko.wikipedia.org/w/api.php';

async function get(params) {
  const q = new URLSearchParams({
    ...params, format: 'json', formatversion: '2', origin: '*',
  });
  const r = await fetch(`${API}?${q}`);
  if (!r.ok) throw new Error('위키백과 ' + r.status);
  return r.json();
}

export async function nearby(lat, lon, radius = 1500, limit = 10) {
  try {
    const d = await get({ action: 'query', list: 'geosearch',
      gscoord: `${lat}|${lon}`, gsradius: radius, gslimit: limit });
    return (d.query?.geosearch || []).map(x => ({ title: x.title, dist: Math.round(x.dist) }));
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
      if (p.thumbnail?.source) return p.thumbnail.source;
  } catch (_) {}
  return '';
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
    prop: 'extracts|pageimages',
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

  if (!pages.length)
    return { place: manual || '', primary: '', image: '', sources: [], nearby: [] };

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

  return {
    place: primary.title,
    primary: primary.title,
    image: primary.thumbnail?.source || '',
    sources,
    nearby: pages.slice(1, 6).map(x => x.title),
  };
}

