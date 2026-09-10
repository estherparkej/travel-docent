/* 해설 대본 생성. Gemini 키가 있으면 이야기꾼 말투로,
   없거나 막히면 위키백과 원문을 말하는 투로 다듬어 읽는다. */

import { getKey } from './keys.js';

export const SYSTEM = `당신은 역사적 랜드마크를 안내하는 AI 역사 여행 도슨트입니다.

정보를 읽어 주는 것이 아닙니다. 듣는 사람을 그 시대와 장소로 데려가는 것이 일입니다.
다 듣고 나면 세 가지가 남아야 합니다.
왜 만들어졌는가. 어떤 일을 겪었는가. 왜 지금까지 중요한가.

[절대 원칙 — 어기면 안 됩니다]
1. 아래 자료에 적힌 사실만 쓰세요. 없는 연도·인물·숫자·일화를 지어내지 마세요.
   자료가 부족하면 짧게 끝내세요. 분량을 채우려고 지어내면 안 됩니다.
2. 확실하지 않은 것은 그대로 드러내세요.
   "~라고 전해집니다", "~로 추정됩니다", "정확한 기록은 남아 있지 않지만".
3. 백과사전처럼 나열하지 마세요.
   "○○은 조선시대에 건립된 궁궐로 서울에 위치하며" 같은 문장은 쓰지 않습니다.
4. 건설 → 사건 → 파괴 → 복원 식으로 늘어놓지 마세요.
   상황 → 문제 → 선택 → 갈등 → 변화 → 결과 → 현재로 이어 붙이세요.
   무슨 일이 있었는지가 아니라 왜 그런 일이 일어났는지를 알게 해야 합니다.

[반드시 담을 것]
· WHY — 왜 만들었는지를 크기나 구조보다 먼저 말합니다.
· 사람 — 건물보다 사람이 중심입니다. 이름만 소개하지 말고,
  그가 무엇을 원했고 어떤 선택을 했으며 그래서 무엇이 달라졌는지 말하세요.
· 갈등 — 반대, 자금 부족, 전쟁, 화재, 권력 다툼. 실제 자료에 있는 것만.
· "하지만" — 이야기에는 뒤집히는 대목이 있어야 합니다. 억지로 넣지는 마세요.
· 놀라운 사실 하나 — 처음엔 반대받았다, 원래 다른 목적이었다, 한 번 사라졌다,
  지금 모습이 원래 모습이 아니다 같은 것. 잡학이 아니라 이야기와 이어져야 합니다.
· 현재의 의미 — 마지막은 반드시 지금 눈앞의 장소로 돌아옵니다.

[말투 — 듣는 글입니다]
· "여러분", "~예요", "~했어요", "~거든요" 처럼 다정한 존댓말.
· 한 문장에 정보는 하나. 짧게 쓰세요. 다시 읽을 수 없습니다.
· 중요한 문장은 따로 한 줄로 두어 숨을 쉬게 하세요.
· 전문 용어를 그대로 쓰지 마세요.
  "정치적 정당성" 대신 "사람들에게 인정받기 위해",
  "중앙집권" 대신 "나라의 힘을 왕에게 모으는 일",
  "석조 건축물" 대신 "돌로 쌓아 올린 건물".
· 목록, 번호, 마크다운 기호, 이모지를 쓰지 마세요. 흐르는 말로만.
· 국보 제몇 호 같은 지정 번호는 읽지 마세요.
· 이어 주는 말을 자연스럽게 쓰되 같은 말을 반복하지 마세요.
  그런데 · 하지만 · 그렇다면 · 여기서 중요한 점이 있습니다 ·
  이야기는 여기서 끝나지 않습니다 · 그러던 어느 날 · 결국 · 그래서

[숫자]
연도를 잇달아 늘어놓지 마세요.
"1395년에 짓고 1592년에 불타고 1867년에 다시 세웠다"가 아니라
"조선이 시작되고 얼마 지나지 않아 지어졌습니다. 그런데 이백 년쯤 뒤 전쟁으로 불타 버립니다."
숫자는 꼭 기억할 연도, 놀라운 규모, 이야기를 이해하는 데 필요할 때만 쓰고
쓸 때는 몸으로 느끼게 바꾸세요. "9.4미터"는 "어른 키의 다섯 배".

[하지 말 것]
· 위키백과 요약처럼 쓰기
· 처음부터 모든 정보를 쏟아내기 — 이야기 흐름에 따라 하나씩 꺼내세요
· 근거 없는 드라마 만들기 — 실제 역사보다 더 극적으로 꾸미지 마세요
· "정말 놀랍습니다", "믿기 어려운 이야기입니다" 같은 감탄사 반복

[위치를 말할 때]
방향을 알 수 없습니다. 오른쪽·왼쪽·앞·뒤를 쓰지 마세요.
대신 이렇게 씁니다. 주변을 둘러보면 · 가까이 있는 · 중앙에 있는 ·
가장 눈에 띄는 · 높은 곳을 보면.
듣는 사람이 실제로 무엇을 보고 있는지 넘겨짚지 마세요.`;

/* 길이와 구성 — 스펙의 SHORT / NORMAL / DEEP */
const LENGTHS = {
  short: {
    size: '300자에서 600자 사이. 듣는 시간 30초에서 1분.',
    plan: ['훅 — 한 방에 관심을 끄는 첫마디',
           '왜 만들었는가',
           '가장 중요한 사건 하나',
           '놀라운 사실 하나',
           '지금의 의미'],
    note: '연도는 최소로. 인물은 한두 명. 사건은 하나만.',
  },
  normal: {
    size: '1500자에서 2500자 사이. 듣는 시간 3분에서 5분.',
    plan: ['훅', '지금 이 장소', '시간 여행 — 과거로 넘어가기',
           '그 시대는 어떤 때였나', '왜 만들었는가',
           '사람 — 무엇을 원했고 어떤 선택을 했나',
           '갈등 — 어떤 문제가 있었나', '흐름을 바꾼 사건',
           '놀라운 사실', '다시 현재 — 그래서 지금 이 모습인 이유'],
    note: '',
  },
  deep: {
    size: '3000자에서 5000자 사이. 듣는 시간 7분에서 10분.',
    plan: ['훅', '지금 이 장소', '시간 여행', '그 시대는 어떤 때였나',
           '왜 만들었는가', '사람', '갈등', '흐름을 바꾼 사건',
           '놀라운 사실', '다시 현재'],
    note: '여기에 더합니다. 당시 정치와 권력, 비용을 누가 댔는지, '
        + '평범한 사람들이 받은 영향, 해석이 갈리는 대목과 그 이유, '
        + '다른 사건과의 연결. 깊어져도 나열은 안 됩니다.',
  },
};

/* 학습 수준 — 스펙의 elementary / middle_school / high_school */
const LEVELS = {
  elementary: `초등학생이 듣습니다. 목표는 정확한 정보량이 아니라 흥미입니다.
문장을 아주 짧게. 어려운 말은 쓰지 마세요. 복잡한 정치 구조와 많은 인물은 빼세요.
사람과 사건 중심으로. "아주 오래전", "그런데 문제가 생겼습니다",
"여기서 중요한 사람이 등장합니다", "놀라운 사실은", "그래서 지금" 같은 말을 쓰세요.`,
  middle: `중학생이 듣습니다. 목표는 원인과 결과를 이해하는 것입니다.
상황 → 문제 → 선택 → 결과 → 역사적 의미 순으로 이어 주세요.
시대 배경을 설명하고, 누가 어떤 선택을 했으며 그래서 무엇이 달라졌는지 짚어 주세요.`,
  high: `고등학생이 듣습니다. 목표는 비판적이고 구조적인 이해입니다.
정치·경제·사회 배경과 권력 관계를 함께 다루세요.
누가 이익을 얻었는지, 비용은 누가 댔는지, 다른 선택은 가능했는지,
오늘날 어떻게 평가되는지까지. 해석이 갈리면 여러 해석을 함께 보여 주세요.`,
  adult: `역사에 관심 있는 어른이 듣습니다.
쉬운 말로 쓰되 내용을 얕게 만들지 마세요. 배경과 맥락을 곁들여 주세요.`,
};

/* 위치 — 스펙의 SEARCH / NEARBY / INSIDE */
const PLACES = {
  inside: `듣는 사람이 지금 그 장소에 있습니다.
"지금 여러분이 서 계신 이곳은", "이 공간에서는" 처럼 현장을 살려 쓰세요.
단, 무엇을 보고 있는지는 넘겨짚지 마세요.`,
  search: `듣는 사람이 그 장소에 있는지 알 수 없습니다. 현장에 있다고 가정하지 마세요.
"이곳은", "이곳을 찾으면" 처럼 씁니다.
"지금 보고 계신", "눈앞에 있는" 같은 말은 쓰지 마세요.`,
};

export function buildPrompt(data, length = 'normal', heard = [], again = false,
                            here = true, tone = '', level = '') {
  const L = LENGTHS[length] || LENGTHS.normal;
  const lines = [];

  if (data.sources.length) {
    lines.push('[자료 — 여기 적힌 사실만 쓰세요]');
    for (const s of data.sources) {
      const where = s.dist != null ? ` — 여기서 약 ${s.dist}m` : '';
      lines.push(`\n《${s.title}》${where}\n${s.text}`);
    }
  } else {
    lines.push('[자료 없음] 이 좌표 주변에서 문서를 찾지 못했습니다.');
  }
  if (data.nearby.length) lines.push(`\n[걸어서 갈 만한 주변] ${data.nearby.join(', ')}`);

  lines.push(`\n[해설할 대상] ${data.place}`);
  lines.push(`[길이] ${L.size}`);
  lines.push('[구성 — 이 순서로 이어 가세요]');
  L.plan.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  if (L.note) lines.push(L.note);

  lines.push(`\n[듣는 사람] ${LEVELS[level] || LEVELS.adult}`);
  if (tone) lines.push(tone);
  lines.push(`\n[위치] ${here ? PLACES.inside : PLACES.search}`);

  /* 지금 그 자리에 서 있는 사람과, 집에서 찾아 듣는 사람에게
     같은 말로 시작하면 어색하다. 첫 문장을 갈라 준다. */
  lines.push(here
    ? `[첫 문장] "여러분, 지금 여러분이 서 계신 곳은 ${data.place}입니다."`
    : `[첫 문장] "이곳은 ${data.place}입니다."`);
  lines.push('이 문장으로 시작한 뒤, 바로 훅을 던지세요.');

  const h = (heard || []).filter(Boolean);
  if (h.length) lines.push(`\n[이미 들은 곳] ${h.slice(-12).join(', ')}`);
  if (again) lines.push('[요청] 같은 자리입니다. 방금과 다른 대목을 골라 새로 이야기해 주세요.');

  lines.push(`\n[마지막 점검] 왜 만들었는지 말했는가. 사람이 나오는가.
갈등이 있는가. 놀라운 사실이 하나 있는가. 마지막이 지금의 의미로 돌아왔는가.
자료에 없는 사실을 넣지 않았는가.`);
  return lines.join('\n');
}

/* ── 위키백과 낭독 (키 없이) ─────────────────────────────── */
const SOFTEN = [
  ['하였으며,', '했어요.'], ['되었으며,', '됐어요.'], ['있으며,', '있어요.'],
  ['없으며,', '없어요.'], ['이며,', '이에요.'], ['였으며,', '였어요.'],
  ['았으며,', '았어요.'], ['었으며,', '었어요.'],
  ['하였다.', '했어요.'], ['되었다.', '됐어요.'], ['이었다.', '이었어요.'],
  ['아니다.', '아니에요.'], ['불린다.', '불려요.'], ['보인다.', '보여요.'],
  ['여겨진다.', '여겨져요.'], ['웠다.', '웠어요.'], ['였다.', '였어요.'],
  ['았다.', '았어요.'], ['었다.', '었어요.'], ['이다.', '이에요.'],
  ['있다.', '있어요.'], ['없다.', '없어요.'], ['된다.', '돼요.'],
  ['한다.', '해요.'], ['진다.', '져요.'], ['난다.', '나요.'],
  ['준다.', '줘요.'], ['온다.', '와요.'], ['간다.', '가요.'],
  ['많다.', '많아요.'], ['높다.', '높아요.'], ['크다.', '커요.'], ['같다.', '같아요.'],
  ['받는다.', '받아요.'], ['남는다.', '남아요.'], ['만든다.', '만들어요.'],
  ['부른다.', '불러요.'], ['오른다.', '올라요.'], ['걷는다.', '걸어요.'],
  ['듣는다.', '들어요.'], ['묻는다.', '물어요.'], ['앉는다.', '앉아요.'],
  ['먹는다.', '먹어요.'], ['짓는다.', '지어요.'], ['닫는다.', '닫아요.'],
  ['열린다.', '열려요.'], ['놓인다.', '놓여요.'], ['쌓인다.', '쌓여요.'],
  ['본다.', '봐요.'], ['산다.', '살아요.'], ['쓴다.', '써요.'],
].sort((a, b) => b[0].length - a[0].length);

const NB = '(?![A-Za-z])';
const UNITS = [
  [new RegExp(`(\\d)\\s*km${NB}`, 'g'), '$1킬로미터'],
  [new RegExp(`(\\d)\\s*cm${NB}`, 'g'), '$1센티미터'],
  [new RegExp(`(\\d)\\s*mm${NB}`, 'g'), '$1밀리미터'],
  [new RegExp(`(\\d)\\s*kg${NB}`, 'g'), '$1킬로그램'],
  [new RegExp(`(\\d)\\s*m${NB}`, 'g'), '$1미터'],
  [/㎡/g, '제곱미터'], [/㎞/g, '킬로미터'],
];

// 받침이 ㅆ인 과거형(했다·왔다·오르내렸다…)을 '~어요'로
/* 받침이 없으면 '타워이에요'가 아니라 '타워예요'다 */
function fixYeyo(text) {
  return text.replace(/([가-힣])이에요/g, (m, ch) =>
    (ch.charCodeAt(0) - 0xAC00) % 28 === 0 ? ch + '예요' : m);
}

function pastToPolite(text) {
  return text.replace(/([가-힣])다\./g, (m, ch) =>
    ((ch.charCodeAt(0) - 0xAC00) % 28 === 20) ? ch + '어요.' : m);
}

/* 백과사전 상투구 — 소리로 들으면 특히 거슬린다.
   '사적 제12호로, 대한민국 충청남도 …에 소재하고 있는' 은 아무것도 남기지 않는다. */
const CLICHE = [
  [/[가-힣]{1,4}\s*제\s*\d+\s*호(?:로|이며|이고|로서),?\s*/g, ''],
  [/(?:대한민국|한국)\s+(?=[가-힣]{2,}(?:도|시|군|구)\s)/g, ''],
  [/에\s*(?:소재|위치)하고\s*있는/g, '에 있는'],
  [/에\s*(?:소재|위치)한/g, '에 있는'],
];

/* 괄호 — 한자나 원어 표기는 소리로 들으면 방해만 된다.
   '(538년)'처럼 한글이 든 괄호는 뜻이 있으니 남긴다. */
const dropParens = t => t.replace(/\s*\(([^)]*)\)/g, (m, inner) =>
  (/^(?:영어|한자|중국어|일본어|라틴어)\s*:/.test(inner.trim()) || !/[가-힣]/.test(inner)) ? '' : m);

export function soften(text) {
  text = dropParens(text);
  for (const [a, b] of SOFTEN) text = text.split(a).join(b);
  for (const [rx, rep] of CLICHE) text = text.replace(rx, rep);
  text = pastToPolite(text);
  for (const [rx, rep] of UNITS) text = text.replace(rx, rep);
  text = fixYeyo(text);   // 'm'을 '미터'로 바꾼 뒤라야 받침을 알 수 있다
  return text.replace(/,(?=[가-힣])/g, ', ').replace(/[ \t]{2,}/g, ' ');
}

const ADMIN = ['교구', '말사', '문화재청', '소재지', '등록문화재',
               '행정구역', '지정번호', '관리단체', '제곱미터'];
const DESIG = /제\s*\d+\s*호/;

function boring(s) {
  if (DESIG.test(s) && s.includes('지정')) return true;
  if (ADMIN.some(w => s.includes(w))) return true;
  if (s.startsWith('이 문서') || s.includes('다음과 같')) return true;
  return s.length < 6;
}

function* streamWiki(data, length, here = true) {
  if (!data.sources.length) {
    yield '이 근처에서는 소개할 만한 자료를 찾지 못했어요. 조금 더 걸어가 보시겠어요?\n';
    return;
  }
  const src = data.sources[0];
  let body = src.text.replace(/^==+.*?==+$/gm, '').replace(/\n{2,}/g, '\n').trim();
  body = soften(body);
  const cap = { short: 320, normal: 950, deep: 2000 }[length] ?? 950;

  yield here
    ? `여러분, 지금 여러분이 서 계신 곳은 ${src.title}입니다.\n`
    : `이곳은 ${src.title}입니다.\n`;
  let used = 0;
  let first = true;
  for (const sent of body.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean)) {
    if (boring(sent)) continue;
    /* 방금 이름을 말했는데 본문이 또 '○○은 …'으로 시작하면 겹친다.
       뜻은 남기고 주어만 덜어낸다. */
    let line = sent;
    if (first) {
      first = false;
      const dup = new RegExp('^' + src.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:은|는|이|가)\\s*');
      line = line.replace(dup, '');
    }
    if (used + line.length > cap) break;
    used += line.length;
    yield line + '\n';
  }
  if (data.nearby.length)
    yield `여기까지 보셨으면, 가까이에 있는 ${data.nearby[0]}에도 한번 가보세요.\n`;
  else yield '천천히 한 바퀴 둘러보세요.\n';
}

/* ── Gemini ──────────────────────────────────────────────── */
/* 첫 글자가 나오기까지의 시간을 재보고 순서를 정했다.
   lite 계열이 1.1초, 일반 flash 는 6~10초. 아홉 배 차이다. */
const PREFERRED = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest',
                   'gemini-3.1-flash-lite', 'gemini-3.5-flash',
                   'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
const PICKED = 'gemini-model';
let candidates = null;

async function models(key) {
  if (candidates) return candidates;
  // 지난번에 쓰던 모델을 기억해 두면 목록 조회(약 0.35초)를 건너뛴다
  const saved = localStorage.getItem(PICKED);
  if (saved) { candidates = [saved, ...PREFERRED.filter(m => m !== saved)]; return candidates; }
  let usable = [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const d = await r.json();
    usable = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.split('/').pop());
  } catch (_) {}
  const order = PREFERRED.filter(m => usable.includes(m));
  order.push(...usable.filter(m => m.includes('flash') && !order.includes(m)
    && !['image', 'tts', 'preview'].some(x => m.includes(x))));
  candidates = order.length ? order : ['gemini-3.6-flash'];
  return candidates;
}

async function* geminiOnce(model, key, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}` +
              `:streamGenerateContent?alt=sse&key=${key}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: 'low' } },
    }),
  });
  if (!res.ok) { const e = new Error(await res.text()); e.status = res.status; throw e; }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop();
    for (const line of parts) {
      if (!line.startsWith('data:')) continue;
      let chunk;
      try { chunk = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
      for (const c of chunk.candidates || [])
        for (const p of c.content?.parts || [])
          if (p.text) yield p.text;
    }
  }
}

/* 공개 진입점 — 대본을 조각조각 흘려보낸다 */
export async function* stream(data, { length = 'normal', heard = [], again = false,
                                     here = true, tone = '', level = '' } = {}) {
  const key = getKey('gemini');
  if (!key) { yield* streamWiki(data, length, here); return; }

  const prompt = buildPrompt(data, length, heard, again, here, tone, level);
  const list = await models(key);
  let started = false;

  for (const model of list.slice(0, 4)) {
    try {
      for await (const t of geminiOnce(model, key, prompt)) {
        if (!started) { started = true; localStorage.setItem(PICKED, model); }
        yield t;
      }
      if (started) return;
    } catch (e) {
      if (started) throw new Error('해설이 중간에 끊겼어요.');
      if (e.status === 429) break;          // 한도 — 위키백과로 넘어간다
      if (![400, 403, 404].includes(e.status)) break;
    }
  }
  // 한 글자도 못 받았다. 빈손으로 두지 말고 위키백과라도 읽어준다.
  yield* streamWiki(data, length, here);
}
