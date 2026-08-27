/* 캐러셀 사진. 위키미디어(실제 장소)를 앞에, Pexels(분위기)를 뒤에. */

import { getKey } from './keys.js';
import * as wiki from './wiki.js';

export async function pexels(query, n = 4) {
  const key = getKey('pexels');
  if (!key || !query) return [];
  try {
    const q = new URLSearchParams({ query, per_page: n, orientation: 'portrait' });
    const r = await fetch(`https://api.pexels.com/v1/search?${q}`,
                          { headers: { Authorization: key } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.photos || []).map(p => ({
      url: p.src?.large2x || p.src?.large,
      title: (p.alt || '').trim().slice(0, 60),
      credit: `Pexels · ${p.photographer || ''}`.replace(/ · $/, ''),
    })).filter(x => x.url);
  } catch (_) { return []; }
}

export async function collect(place, titles, cover = '', limit = 10) {
  const shots = [];
  const seen = new Set();
  const add = (url, title = '', credit = '위키백과') => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    shots.push({ url, title, credit });
  };

  add(cover, place);
  const [stock, gal] = await Promise.all([
    pexels(place, 4),
    wiki.gallery(titles, limit),
  ]);

  const roomForWiki = limit - shots.length - Math.min(stock.length, 4);
  for (const x of gal) {
    if (shots.length - 1 >= roomForWiki) break;
    add(x.url, x.title);
  }
  for (const x of stock) {
    if (shots.length >= limit) break;
    add(x.url, x.title, x.credit);
  }
  return shots.slice(0, limit);
}
