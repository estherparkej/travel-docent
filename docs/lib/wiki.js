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

export async function gather({ lat, lon, manual }) {
  let titles, near = [];
  if (manual) {
    titles = await search(manual);
  } else {
    near = await nearby(lat, lon);
    titles = near.map(x => x.title);
  }
  if (!titles.length)
    return { place: manual || '', primary: '', image: '', sources: [], nearby: [] };

  const primary = titles[0];
  const distOf = Object.fromEntries(near.map(x => [x.title, x.dist]));

  const [main, rest, image] = await Promise.all([
    extracts([primary], false, 2600),
    extracts(titles.slice(1, 4), true, 500),
    pageImage(primary),
  ]);

  const sources = [];
  for (const t of titles.slice(0, 4)) {
    const text = main[t] || rest[t];
    if (text) sources.push({ title: t, dist: distOf[t] ?? null, text: forSpeech(text) });
  }
  return { place: primary, primary, image, sources, nearby: near.slice(1, 6).map(x => x.title) };
}
