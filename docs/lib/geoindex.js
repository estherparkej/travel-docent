/* 검색어가 나라인지 동네인지 랜드마크인지 가려내고,
   그 자리에 어울리는 장소들을 찾아 온다.

   위키데이터를 뼈대로 쓴다. OpenStreetMap 은 해외 지명의 한국어 이름이 거의 없어서
   '프로방스'가 강남 미용실로, '몽마르트르'는 아예 없는 것으로 나온다.
   위키데이터는 한국어 이름과 '무엇인가(P31)'를 함께 주므로 계층을 정확히 가릴 수 있다. */

const WD = 'https://www.wikidata.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';

/* P31(무엇인가)의 한국어 이름으로 계층을 가른다.
   실제로 재보고 정한 순서다. 먼저 걸리는 쪽이 이긴다.
   예를 들어 서울의 '국가수도'는 '도'를 품고 있어서, 도시를 지역보다 먼저 봐야 한다. */
const TIER_RULES = [
  ['landmark', /사찰|사원|절$|탑|성당|교회|궁궐|궁$|박물관|미술관|유적|고분|왕릉|능$|산성|다리|교량|공원|정원|타워|랜드마크|건축물|기념물|폭포|동굴|해수욕장|누각|서원|향교|사적|명승|유산|heritage site|temple|palace|museum|shrine|castle|fortress|monument|landmark|cathedral|basilica|park$/i],
  ['country',  /국가$|나라$|주권국|sovereign state|^country$/i],
  ['district', /동$|동네|근린|지구|구$|읍$|면$|마을|arrondissement|neighbourhood|neighborhood|quarter|borough|ward|district of/i],
  ['city',     /도시|시$|시단위|행정시|수도|코뮌|commune|city\b|town|municipality/i],
  ['region',   /도$|주$|지방|레지옹|지역|문화권|섬$|현$|island|province|state|region|county|prefecture/i],
];

/* 이름은 지명인데 갈 수 있는 곳이 아닌 항목들.
   '경주시 국회의원 선거구'가 '구'로 끝난다는 이유로 진짜 경주시를 밀어냈다. */
const NOT_A_PLACE = new RegExp([
  // 사람
  '선수', '배우', '가수', '모델', '정치인', '작가', '편집인', '감독', '아나운서',
  '기업인', '학자', '교수', '의사', '변호사', '군인', '장군', '승려', '화가', '작곡가',
  '왕후', '황후', '왕자', '공주', '황제', '국왕', '대통령', '인물',
  // 작품·개념
  '영화', '드라마', '음반', '앨범', '노래', '곡$', '소설', '만화', '게임', '장르',
  '방송 ?프로그램', '예능', '웹툰', '뮤지컬', '연극',
  // 그 밖
  '선거구', '정당', '기업', '상표', '축구단', '구단', '방언', '언어', '성씨', '이름',
  '동음이의', '위키미디어', '분류', '목록', '대회', '경기$', '지진$', '사건$', '전투$',
  'competition', 'given name', 'family name', 'disambiguation', 'genre', 'video game',
].join('|'), 'i');

export const TIER_LABEL = {
  country: '나라', region: '지역', city: '도시', district: '동네', landmark: '장소',
};

function tierOf(text) {
  for (const [tier, re] of TIER_RULES) if (re.test(text)) return tier;
  return '';
}

/* 공개 질의 서버는 처음 한 번이 2~5초고 가끔 응답하지 않는다.
   화면을 붙잡아 두지 않도록 제한 시간을 두고, 실패하면 조용히 비운다. */
async function sparql(query, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`,
      { headers: { Accept: 'application/sparql-results+json' }, signal: c.signal });
    if (!r.ok) return [];
    return (await r.json()).results.bindings;
  } catch (_) { return []; }
  finally { clearTimeout(t); }
}

const idCache = new Map();

/* 공개 질의 서버는 같은 곳을 자꾸 물으면 응답을 늦추거나 끊는다.
   지역의 대표 장소는 하루 이틀 사이에 바뀌지 않으므로 기기에 적어 둔다. */
const DISK = 'geo-top';
const DAY = 24 * 60 * 60 * 1000;
function remember(key, val) {
  try {
    const all = JSON.parse(localStorage.getItem(DISK) || '{}');
    all[key] = { at: Date.now(), val };
    localStorage.setItem(DISK, JSON.stringify(all));
  } catch (_) {}
}
function recall(key) {
  try {
    const all = JSON.parse(localStorage.getItem(DISK) || '{}');
    const hit = all[key];
    if (hit && Date.now() - hit.at < 7 * DAY) return hit.val;
  } catch (_) {}
  return null;
}

/* 검색어 → 무엇을 가리키는지.
   질의 서버(SPARQL)는 처음 한 번이 2~5초라 여기에 두면 검색이 통째로 느려진다.
   설명문과 좌표만 있으면 계층은 가려낼 수 있으므로, 가벼운 API 두 번으로 끝낸다. */
export async function identify(query) {
  const q = (query || '').trim();
  if (!q) return null;
  if (idCache.has(q)) return idCache.get(q);

  const job = (async () => {
    const r = await fetch(`${WD}?origin=*&format=json&action=wbsearchentities` +
      `&language=ko&uselang=ko&limit=5&search=${encodeURIComponent(q)}`);
    const hits = ((await r.json()).search || []).filter(h => h.id);
    if (!hits.length) return null;

    // 설명문만으로 이미 대부분 갈린다 — '서유럽의 국가', '서울특별시 성동구에 위치한 동'
    const guessed = hits.map(h => ({ ...h, tier: tierOf(h.description || '') }));

    // 좌표와 '무엇인가'는 한 번에 받아 온다 (SPARQL 아님)
    const ids = hits.map(h => h.id).join('|');
    let ents = {};
    try {
      const e = await fetch(`${WD}?origin=*&format=json&action=wbgetentities` +
        `&props=claims&languages=ko&ids=${ids}`);
      ents = (await e.json()).entities || {};
    } catch (_) {}

    const scored = guessed.map(h => {
      const claims = ents[h.id]?.claims || {};
      const pt = claims.P625?.[0]?.mainsnak?.datavalue?.value;
      const hasAdmin = !!claims.P131 || !!claims.P17;
      const bad = NOT_A_PLACE.test(h.description || '');
      return { id: h.id, label: h.label, desc: h.description || '',
               tier: bad ? '' : h.tier, lat: pt?.latitude ?? null, lon: pt?.longitude ?? null,
               place: !bad && (!!pt || hasAdmin) };
    });

    // 장소가 아닌 것(사람·책·영화)은 좌표도 행정 상위도 없다
    const norm = t => (t || '').replace(/\s+/g, '');
    const key = norm(q);
    const rank = s => {
      let r = 0;
      if (!s.place) r += 100;                       // 장소가 아니면 뒤로
      if (!s.tier) r += 20;                          // 계층을 못 가렸으면 뒤로
      if (norm(s.label) === key) r -= 30;            // 이름이 정확히 같으면 앞으로
      else if (norm(s.label).startsWith(key)) r -= 15;
      if (s.lat == null) r += 8;                     // 좌표가 있는 쪽이 낫다
      return r;
    };
    const best = scored.slice().sort((a, b) => rank(a) - rank(b))[0];
    if (!best) return null;
    return { ...best, tier: best.tier || 'landmark' };
  })();

  idCache.set(q, job);
  job.catch(() => idCache.delete(q));
  return job;
}

/* 갈 만한 곳이 아닌 것들. 위치만 가깝다는 이유로 올라오는 관공서·학교를 걸러낸다. */
const BORING = /우체국|소방서|경찰서|파출소|지구대|교육지원청|주민센터|행정복지센터|보건소|세무서|등기소|법원|검찰청|시청$|군청$|구청$|초등학교|중학교|고등학교|아파트|병원$|의원$|은행$|지진$|나들목|톨게이트|발전소|변전소|정수장|하수처리/;
export const boring = name => BORING.test(name || '');

/* 동네를 찾는데 '동두천시' 같은 행정구역 이름이 섞여 오는 일이 있다.
   위키백과의 좌표가 엉뚱하게 찍힌 문서들인데, 조회수가 높아 맨 위로 올라온다. */
const ADMIN_NAME = /^[가-힣]{2,}(특별시|광역시|특별자치시|특별자치도|시|군|구|도|읍|면)$/;
export const adminName = name => ADMIN_NAME.test((name || '').trim());

/* 그 단위의 대표 장소들.
   나라는 P131* 로 훑으면 공개 서버가 버티지 못해 세계유산으로 좁힌다.
   지역·도시는 범위가 작아 P131* 가 통하고, 결과도 훨씬 촘촘하다.
   sitelinks(다른 언어판 문서 수)는 그 자체로 좋은 인지도 지표다. */
export async function topIn(qid, tier, limit = 10) {
  const saved = recall(qid);
  if (saved) return saved;
  const q = tier === 'country'
    ? `SELECT ?sLabel ?links WHERE {
         ?s wdt:P1435 wd:Q9259 ; wdt:P17 wd:${qid} ; wikibase:sitelinks ?links .
         SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
       } ORDER BY DESC(?links) LIMIT ${limit}`
    : `SELECT ?sLabel ?links WHERE {
         ?s wdt:P131* wd:${qid} ; wdt:P625 ?c ; wikibase:sitelinks ?links .
         FILTER(?links > 5)
         SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
       } ORDER BY DESC(?links) LIMIT ${limit}`;
  const rows = await sparql(q, 5000);
  const out = dedupe(rows.map(b => ({ name: b.sLabel.value, links: +b.links.value })))
    .filter(x => !boring(x.name));
  if (out.length) remember(qid, out);
  return out;
}

/* 질의 서버가 조용할 때 쓰는 길.
   좌표 둘레를 넓게 훑어 후보를 모으고, 위키백과 조회수로 고른다.
   조회수는 한 번에 쉰 개씩 물어볼 수 있어 요청이 몇 번 안 든다. */
export async function rankByViews(titles, keep = 8) {
  const list = titles.filter(t => !boring(t));
  if (list.length <= keep) return list;
  const views = {};
  const chunks = [];
  for (let i = 0; i < list.length; i += 50) chunks.push(list.slice(i, i + 50));
  await Promise.all(chunks.map(async c => {
    try {
      const r = await fetch('https://ko.wikipedia.org/w/api.php?origin=*&format=json' +
        '&action=query&prop=pageviews&titles=' + encodeURIComponent(c.join('|')));
      for (const pg of Object.values((await r.json()).query?.pages || {})) {
        const v = Object.values(pg.pageviews || {}).filter(x => typeof x === 'number');
        views[pg.title] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      }
    } catch (_) {}
  }));
  return list.slice().sort((a, b) => (views[b] || 0) - (views[a] || 0)).slice(0, keep);
}

/* ── 한 단계 아래로 · 한 단계 위로 ───────────────────────
   좁혀 들어가는 칩과 넓혀 나가는 칩에 쓴다. */

/* P150(하위 행정구역)은 위키데이터에 거의 채워져 있지 않다 — 다 비어서 나온다.
   반대로 '나를 상위로 둔 것들'을 물으면 촘촘하다. 대신 도시와 명소가 섞여 오므로
   계층에 맞는 이름만 남긴다. */
const CHILD_NAME = {
  country:  /(도|주|지방|현|성|레지옹|자치구|자치주)$/,
  region:   /(시|군)$/,
  city:     /(구|동|읍|면)$/,
  district: null,          // 동네 아래로는 내려가지 않는다
};

export async function children(qid, tier, limit = 8) {
  const re = CHILD_NAME[tier];
  if (!re) return [];
  const key = `${qid}|down`;
  const saved = recall(key);
  if (saved) return saved;

  const rows = await sparql(`SELECT ?cLabel ?links WHERE {
    ?c wdt:P131 wd:${qid} ; wikibase:sitelinks ?links .
    FILTER(?links > 3)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
  } ORDER BY DESC(?links) LIMIT 40`, 6000);

  const out = dedupe(rows.map(b => ({ name: b.cLabel.value, links: +b.links.value })))
    .filter(x => re.test(x.name) && !boring(x.name) && !/(의|의 )\S*$/.test(x.name.replace(/^\S+\s/, '')) && !x.name.includes('의 '))
    .slice(0, limit);
  if (out.length) remember(key, out);
  return out;
}

/* 넓혀 나가기 — 나를 품은 곳들. 성수동 → 성동구 → 서울특별시 */
export async function parents(qid, limit = 3) {
  const key = `${qid}|up`;
  const saved = recall(key);
  if (saved) return saved;

  const rows = await sparql(`SELECT ?pLabel ?links WHERE {
    wd:${qid} wdt:P131+ ?p . ?p wikibase:sitelinks ?links .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
  } ORDER BY ASC(?links) LIMIT ${limit + 3}`, 6000);

  // 언어판 수가 적을수록 가까운(좁은) 상위다. 그 순서가 사람이 읽기 자연스럽다.
  const out = dedupe(rows.map(b => ({ name: b.pLabel.value, links: +b.links.value })))
    .filter(x => !boring(x.name)).slice(0, limit);
  if (out.length) remember(key, out);
  return out;
}

// 위키데이터는 같은 것을 여러 줄로 주는 일이 잦다. 이름이 겹치면 하나만 남긴다.
function dedupe(list) {
  const seen = new Set();
  return list.filter(x => {
    const k = x.name.trim();
    if (!k || seen.has(k) || /^Q\d+$/.test(k)) return false;   // 라벨이 없으면 Q숫자가 온다
    seen.add(k); return true;
  });
}


/* ── 입력 중 제안 ────────────────────────────────────────
   위키백과 검색은 이강인·신민아·경주 이씨까지 그대로 준다.
   위키데이터는 항목마다 한 줄 설명이 붙어 있어 사람인지 장소인지 바로 갈린다.
   요청 한 번이면 끝나서 위키백과 검색보다 오히려 빠르다. */
export async function suggest(term, limit = 6) {
  const q = (term || '').trim();
  if (q.length < 2) return [];
  const r = await fetch(`${WD}?origin=*&format=json&action=wbsearchentities` +
    `&language=ko&uselang=ko&limit=15&search=${encodeURIComponent(q)}`);
  const hits = ((await r.json()).search || []);

  const seen = new Set();
  const out = [];
  for (const h of hits) {
    const d = h.description || '';
    if (!d) continue;                        // 설명이 없으면 무엇인지 알 수 없다
    if (NOT_A_PLACE.test(d)) continue;
    const tier = tierOf(d);
    if (!tier) continue;                     // 장소로 읽히지 않으면 뺀다
    if (boring(h.label) || seen.has(h.label)) continue;
    seen.add(h.label);
    out.push({ id: h.id, name: h.label, desc: d, tier });
    if (out.length >= limit) break;
  }
  return out;
}
