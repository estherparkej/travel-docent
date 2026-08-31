/* 어떤 곳을 먼저 들려줄지 정한다.

   네 가지를 본다 — 얼마나 가까운가, 들려줄 이야기가 있는가,
   사람들이 실제로 찾는가, 지금 가기 좋은가.

   무료로 얻을 수 없는 것은 솔직히 뺐다.
   재생 완독률(들려준 적이 없으니 표본이 없다)과
   구글 트렌드·SNS 언급량(공개 API 가 없다)이 그렇다.
   대신 위키백과 조회수를 인지도의 대용치로 쓴다. 실제로 재보니 잘 갈린다. */

const KO = 'https://ko.wikipedia.org/w/api.php';
const WD = 'https://www.wikidata.org/w/api.php';

const HERITAGE = /사적|국보|보물|명승|세계유산|문화재|천연기념물|유적|고분|왕릉|사찰|사원|궁|성당|서원|향교|한옥|고택|정자|누각/;

/* ── 걸러낼 것 ────────────────────────────────────────────
   위치만 가깝다는 이유로 올라오는 곳들. 들려줄 이야기가 없다. */
const DROP_TYPE = /초등학교|중학교|고등학교|학교$|대학|유치원|학술기관|연구소|우체국|경찰서|소방서|파출소|병원|의원|약국|아파트|공동주택|주상복합|오피스텔|마천루|사무소|사옥$|은행|공장|발전소|변전소|정수장|철도교|고가도로|나들목|요금소|정류장|터미널|주차장|편의점|주유소|관공서|행정기관|정부 ?기관|공공기관|청사|관청|철도역|지하철역|도시철도역|기차역|지하역|행정 ?구역|대한민국의 [시군구도]|경기장|체육관|운동장|축구장|야구장|실내경기장/;
const MOVABLE = /어찰첩|서첩|화첩|첩$|책$|문서$|고문서|목판$|활자$|초상$|병풍$|족자$|불화$|탱화$|금관$|왕관$|유물|토기$|도자기|자기$|장신구|서기석$|비문$|사리장엄구|사리구$|향로$|범종$|동종$|촛대$|검$|투구$|갑옷$/;
const DROP_NAME = /초등학교|중학교|고등학교|우체국|소방서|경찰서|파출소|지구대|교육지원청|주민센터|행정복지센터|보건소|세무서|등기소|법원|검찰청|위원회$|대사관|영사관|본부$|공사$|공단$|아파트|힐스테이트|자이$|푸르지오|래미안|e편한세상|더샵|트리마제|팰리스|아이파크|위브|센트레빌|캐슬$|포레$|포레스트$|나들목|톨게이트|발전소|변전소|[가-힣]+역$|오비즈|아크로|타워$|빌딩$|센터$|플라자$|스퀘어$/;

/* ── 남길 것 ──────────────────────────────────────────────
   위 그물에 걸리지만 이 앱에서는 이야깃거리가 되는 곳들.
   외국인이 실제로 찾는 곳은 무료 데이터로 알아낼 방법이 없어 손으로 적었다.
   K-팝 기획사는 '기업'으로 분류돼 자동으로는 걸러지므로 여기 둔다. */
const KEEP_TYPE = /연예 기획사|음반사|방송국|박물관|미술관|공원|시장|사찰|사원|성당|교회|궁|왕릉|유적|타워|전망대|극장|서점|온천|해수욕장|전통시장/;
const KEEP_NAME = new RegExp([
  // K-팝·한류
  '하이브', 'HYBE', 'SM엔터', 'JYP', 'YG엔터', '카카오엔터', '큐브엔터', '스타쉽',
  'KBS', 'MBC', 'SBS', '방송국', '한류',
  // 외국인이 자주 찾는 곳
  '명동', '홍대', '광장시장', '남대문시장', '동대문', '인사동', '북촌', '서촌', '익선동',
  '이태원', '가로수길', '성수동', '연남동', '을지로', '청계천', '한강공원', '남산',
  'N서울타워', '롯데월드', '코엑스', '반포', '해운대', '감천문화마을', '전주한옥마을',
  'DMZ', '판문점', '경복궁', '창덕궁', '덕수궁', '종묘', '북한산', '한옥마을',
].join('|'));

/* 시대의 흔적이 담긴 이름들. 구석기부터 근현대까지. */
const ERA = /[가-힣]{1,4}사$|[가-힣]{1,3}암$|[가-힣]{1,3}사지$|[가-힣]{1,3}묘$|[가-힣]{1,3}총$|구석기|신석기|청동기|철기|고조선|삼한|삼국|고구려|백제|신라|가야|발해|고려|조선|대한제국|일제강점기|근대|개화기|독립|의병|항일|전쟁|유적|고분|왕릉|산성|읍성|서원|향교|사찰|사지$|폐사지|고택|종택|생가|기념관|박물관|성지|순교|선사/;

/* 들려줄 이야기가 있는 종류인가 */
const WORTH_TYPE = /박물관|미술관|기념관|사찰|사원|성당|교회|궁|왕릉|고분|유적|사적|성$|산성|읍성|서원|향교|한옥|고택|전통시장|시장|공원|정원|수목원|폭포|동굴|해수욕장|섬$|산$|전망대|극장|온천|다리|누각|정자|탑$|비석|연예 기획사|음반사|방송국/;

/* ── 남길지 뺄지 ─────────────────────────────────────────
   '없는 것만 빼는' 방식은 한계가 있었다. 동안초등학교·귀인초등학교처럼
   그물을 빠져나가는 게 계속 나온다.
   그래서 반대로 바꿨다 — 남길 근거가 있어야 남긴다.
   근거는 셋 중 하나면 된다:
     ① 나라가 지정한 문화재이거나
     ② 시대의 흔적이 이름에 담겼거나
     ③ 들려줄 이야기가 있는 종류이거나 (박물관·시장·공원·사찰…)
   여기에 외국인이 자주 찾는 곳은 무조건 남긴다. */
export const dropped = (name, types = [], facts = {}) => {
  const t = types.join(' ');
  const text = `${name} ${t}`;
  if (KEEP_NAME.test(name) || KEEP_TYPE.test(t)) return false;   // 한류·외국인 명소는 예외 없이
  if (MOVABLE.test(name)) return true;                            // 들고 다니는 문화재는 갈 곳이 아니다
  if (DROP_NAME.test(name) || DROP_TYPE.test(t)) return true;

  const worth = facts.heritage || ERA.test(text) || WORTH_TYPE.test(text)
             || (facts.year != null && facts.year < 1950);
  if (worth) return false;
  /* 근거가 없는 것과, 아직 알아보지 못한 것은 다르다.
     위키데이터가 잠깐 응답하지 않았다고 목록을 통째로 비우면 안 된다.
     이름에 문제가 없으면 남겨 둔다. */
  return !facts.unknown;
};

/* ── 무엇인가 ─────────────────────────────────────────────
   문서 이름 → 위키데이터 항목 → 분류. 쉰 개를 세 번의 요청으로 끝낸다. */
const typeCache = new Map();
const factCache = new Map();   // 문화재 지정 여부·지어진 해

export const factsOf = t => factCache.get(t) || { heritage: false, year: null, style: false };

export async function typesOf(titles) {
  const need = titles.filter(t => !typeCache.has(t));
  for (let i = 0; i < need.length; i += 50) await fetchTypes(need.slice(i, i + 50));
  const out = {};
  for (const t of titles) out[t] = typeCache.get(t) || [];
  return out;
}

async function fetchTypes(batch) {
  try {
    const pp = await fetch(`${KO}?origin=*&format=json&action=query&prop=pageprops` +
      `&ppprop=wikibase_item&titles=${encodeURIComponent(batch.join('|'))}`).then(r => r.json());
    const toQ = {};
    for (const p of Object.values(pp.query?.pages || {}))
      if (p.pageprops?.wikibase_item) toQ[p.title] = p.pageprops.wikibase_item;

    const ids = [...new Set(Object.values(toQ))];
    if (!ids.length) { batch.forEach(t => typeCache.set(t, [])); return; }

    const ent = await fetch(`${WD}?origin=*&format=json&action=wbgetentities` +
      `&props=claims&ids=${ids.join('|')}`).then(r => r.json());
    const p31 = {}, extra = {};
    for (const [id, e] of Object.entries(ent.entities || {})) {
      const c = e.claims || {};
      p31[id] = (c.P31 || []).map(x => x.mainsnak?.datavalue?.value?.id).filter(Boolean).slice(0, 4);
      // P1435 문화재 지정 · P571 지어진 때 · P1885 유적 · P149 건축 양식
      const when = c.P571?.[0]?.mainsnak?.datavalue?.value?.time;
      extra[id] = {
        heritage: !!(c.P1435 || c.P1893),
        year: when ? parseInt(String(when).replace(/^[+-]/, '').slice(0, 4), 10) : null,
        style: !!c.P149,
      };
    }

    const allQ = [...new Set(Object.values(p31).flat())];
    const labels = {};
    for (let i = 0; i < allQ.length; i += 50) {
      const lab = await fetch(`${WD}?origin=*&format=json&action=wbgetentities` +
        `&props=labels&languages=ko|en&ids=${allQ.slice(i, i + 50).join('|')}`).then(r => r.json());
      for (const [id, e] of Object.entries(lab.entities || {}))
        labels[id] = e.labels?.ko?.value || e.labels?.en?.value || '';
    }
    for (const t of batch) {
      const id = toQ[t];
      typeCache.set(t, (p31[id] || []).map(q => labels[q]).filter(Boolean));
      factCache.set(t, extra[id] || { heritage: false, year: null, style: false, unknown: !id });
    }
  } catch (_) {
    // 받아오지 못한 것은 '분류 없음'이 아니라 '아직 모름'이다. 함부로 빼면 안 된다.
    batch.forEach(t => { typeCache.set(t, []); factCache.set(t, { unknown: true }); });
  }
}

/* ── 인지도 ───────────────────────────────────────────────
   위키백과 월간 조회수. 문서마다 한 번씩 물어야 하지만 동시에 보내면 빠르다.
   (한 번에 여러 개를 주는 prop=pageviews 도 있는데, 재보니 값이 0 으로 오는 문서가 많아 못 쓴다.) */
const viewCache = new Map();
const MONTHS = () => {
  const end = new Date(); end.setMonth(end.getMonth() - 1);
  const start = new Date(end); start.setFullYear(start.getFullYear() - 1);
  const f = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}0100`;
  return [f(start), f(end)];
};

export async function viewsOf(titles) {
  const [from, to] = MONTHS();
  await Promise.all(titles.filter(t => !viewCache.has(t)).map(async t => {
    try {
      const j = await fetch('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article' +
        `/ko.wikipedia/all-access/all-agents/${encodeURIComponent(t.replace(/ /g, '_'))}` +
        `/monthly/${from}/${to}`).then(r => r.json());
      const v = (j.items || []).map(i => i.views);
      viewCache.set(t, v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
    } catch (_) { viewCache.set(t, 0); }
  }));
  const out = {};
  for (const t of titles) out[t] = viewCache.get(t) || 0;
  return out;
}

/* ── 지금 가기 좋은가 ─────────────────────────────────────
   시간대·계절·날씨. 비 오면 실내를, 저녁이면 야경 명소를 올린다. */
const INDOOR = /박물관|미술관|전시|수족관|도서관|백화점|시장|카페|온천|극장/;
const NIGHT  = /타워|전망대|야경|다리|교량|한강|해변|해수욕장|광장/;
const SPRING = /벚꽃|봄|수목원|정원|식물원/;
const AUTUMN = /단풍|산$|계곡|사찰|고궁|한옥/;

export function contextScore(name, types, { rain = false, hour = 12, month = 1 } = {}) {
  const t = `${name} ${types.join(' ')}`;
  let s = 0.5;
  if (rain) s += INDOOR.test(t) ? 0.5 : -0.3;
  if (hour >= 18 || hour <= 5) s += NIGHT.test(t) ? 0.4 : -0.15;
  if (month >= 3 && month <= 5 && SPRING.test(t)) s += 0.3;
  if (month >= 9 && month <= 11 && AUTUMN.test(t)) s += 0.3;
  return Math.max(0, Math.min(1, s));
}

/* 비가 오는지만 알면 된다. 키가 필요 없다. */
export async function isRaining(lat, lon) {
  try {
    const j = await fetch('https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat}&longitude=${lon}&current=weather_code`).then(r => r.json());
    const c = j.current?.weather_code ?? 0;
    return (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95);
  } catch (_) { return false; }
}


/* 0~1 로 눌러 담는다. 조회수는 편차가 커서 로그를 씌운다. */
const norm = (v, max) => Math.max(0, Math.min(1, v / max));
const logNorm = v => Math.min(1, Math.log10(1 + v) / Math.log10(1 + 5000));

/* ── 정렬 ────────────────────────────────────────────────
   현장에 있으면 거리가 가장 중요하고,
   집에서 찾아볼 때는 얼마나 알려졌고 들려줄 게 있는지가 중요하다. */
export async function rank(items, { pos = null, weather = null } = {}) {
  const titles = items.map(i => i.name);
  const [types, views] = await Promise.all([typesOf(titles), viewsOf(titles)]);

  const now = new Date();
  const ctx = { rain: !!weather, hour: now.getHours(), month: now.getMonth() + 1 };
  const W = pos ? { d: .35, c: .30, p: .20, x: .15 }
                : { d: 0,   c: .35, p: .40, x: .25 };

  return items
    .filter(i => !dropped(i.name, types[i.name] || [], factsOf(i.name)))
    .map(i => {
      const ty = types[i.name] || [];
      const text = `${i.name} ${ty.join(' ')}`;
      const dist = pos && i.dist != null ? 1 - norm(i.dist, 5000) : 0;
      const f = factsOf(i.name);
      // 나라가 지정한 문화재 > 이름에 시대가 담김 > 그 밖.
      // 오래될수록 이야기가 쌓인다.
      let story = f.heritage ? 0.8 : (HERITAGE.test(text) || ERA.test(text)) ? 0.6 : 0.2;
      if (f.year != null) story += f.year < 1900 ? 0.2 : f.year < 1950 ? 0.1 : 0;
      if (i.links) story += norm(i.links, 40) * 0.2;
      const pop = logNorm(views[i.name] || 0);
      const x = contextScore(i.name, ty, ctx);
      const score = W.d * dist + W.c * Math.min(1, story) + W.p * pop + W.x * x;
      return { ...i, types: ty, views: views[i.name] || 0, score };
    })
    .sort((a, b) => b.score - a.score);
}


/* ── 갈래 나누기 ─────────────────────────────────────────
   한 줄로 길게 늘어놓기보다, 성격이 같은 것끼리 묶어 두면 고르기 쉽다.
   앞에 오는 갈래가 이깁니다 — 불국사는 '절'이지 '유적'이 아니다. */
export const GROUPS = [
  { id: 'temple',  label: '절과 사당',     re: /사찰|사원|절$|암자|사당|서원|향교|종묘|성당|교회|대성당|모스크|신사/ },
  { id: 'palace',  label: '궁궐과 성',     re: /궁궐|궁$|행궁|성$|산성|읍성|성곽|요새|관아|누각|정자/ },
  { id: 'ruin',    label: '유적과 무덤',   re: /유적|유적지|고분|무덤|왕릉|능$|총$|선사|패총|지석묘|고인돌|사적/ },
  { id: 'museum',  label: '박물관과 전시', re: /박물관|미술관|기념관|전시|과학관|도서관|아카이브/ },
  { id: 'nature',  label: '자연',          re: /산$|봉$|섬$|폭포|동굴|계곡|호수|해수욕장|해변|공원|정원|수목원|천$|강$|온천/ },
  { id: 'town',    label: '거리와 마을',   re: /마을|한옥|시장|거리|골목|상가|촌$|테마파크|전망대|타워/ },
];

export function grouped(items) {
  const buckets = GROUPS.map(g => ({ ...g, items: [] }));
  const rest = [];
  for (const it of items) {
    const text = `${it.name} ${(it.types || []).join(' ')}`;
    const g = buckets.find(b => b.re.test(text));
    (g ? g.items : rest).push(it);
  }
  const out = buckets.filter(b => b.items.length);
  if (rest.length) out.push({ id: 'etc', label: '그 밖의 장소', items: rest });
  return out;
}
