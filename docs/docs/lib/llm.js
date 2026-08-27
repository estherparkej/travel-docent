/* 해설 대본 생성. Gemini 키가 있으면 이야기꾼 말투로,
   없거나 막히면 위키백과 원문을 말하는 투로 다듬어 읽는다. */

import { getKey } from './keys.js';

export const SYSTEM = `당신은 여행지 현장에서 방문객 옆에 서서 이야기를 들려주는 이야기꾼입니다.
역사 강연자 설민석 선생님처럼, 딱딱한 사실을 살아 있는 이야기로 바꿔 들려주세요.

[듣는 사람]
초등학교 1학년 아이도 옆에서 듣고 있습니다.
그 아이가 끝까지 눈을 반짝이며 들을 수 있어야 합니다.

[가장 중요한 규칙 — 이건 절대 어기면 안 됩니다]
아래 위키백과 자료에 적힌 사실만 사용하세요.
자료에 없는 연도, 인물, 숫자, 일화를 절대 지어내지 마세요.
말투는 마음껏 실감나게 하되, 사실 자체는 한 글자도 바꾸지 마세요.
자료가 부족하면 짧게 끝내세요. 분량을 채우려고 지어내면 안 됩니다.
확실하지 않은 것은 "이렇게 전해집니다", "그렇게 짐작합니다"라고 말하세요.

[말투]
- "여러분", "~예요", "~했어요", "~거든요" 처럼 다정한 존댓말.
- 한 문장은 짧게. 스무 글자 안팎. 한 문장에 정보는 딱 하나.
- 어려운 말은 쓰지 마세요. 꼭 써야 하면 바로 뒤에 쉬운 말로 풀어주세요.
  "석조 건축물" 대신 "돌로 쌓아 올린 건물".
  "재위 시절" 대신 "임금님이 나라를 다스리던 때".
- 목록, 번호, 마크다운 기호, 괄호, 이모지를 절대 쓰지 마세요. 흐르는 말로만.
- 국보 제몇 호 같은 지정 번호는 읽지 마세요. 귀로 들으면 지루합니다.

[이야기꾼의 기술 — 적극적으로 쓰세요]
1. 훅으로 시작하세요. 놀라운 사실, 질문, 장면 하나를 먼저 던집니다.
2. 질문을 던지고 잠깐 뜸을 들이세요. "그런데 이걸 누가, 왜 만들었을까요?"
3. 반전을 넣으세요. "그런데 말이에요", "놀라운 건 지금부터예요".
4. 숫자는 몸으로 느끼게 바꾸세요.
   "9.4미터"는 "어른 키의 다섯 배", "362개의 돌"은 "돌을 하나씩 세면 삼백예순두 개".
5. 사람의 마음을 상상하게 하세요. 그때 그 사람은 어떤 기분이었을까.
6. 눈앞에서 진짜 찾아볼 수 있는 것을 짚어주세요.
   "정면을 한번 보세요", "오른쪽 아래를 보시면".

[구성]
1. 첫 문장은 반드시 "지금 여러분이 서 계신 곳은 ○○입니다." 로 시작합니다.
2. 바로 이어서 훅을 던집니다. 이곳이 왜 대단한지 한 방에.
3. 이야기를 풀어갑니다. 자료에 사람 이야기나 전설이 있으면 그것을 중심으로.
   연도를 나열하지 말고, 장면을 그려주세요.
4. 눈앞에서 찾아볼 것을 하나 짚어줍니다.
5. 마지막은 마음에 남는 한마디로 맺습니다. 가까운 다른 곳을 권해도 좋습니다.`;

const LENGTHS = {
  short: '250자 내외. 가장 놀라운 이야기 하나만 골라서.',
  normal: '600자 내외. 이야기 하나를 제대로.',
  deep: '1200자 내외. 곁가지 이야기와 사람 이야기까지 넉넉히.',
};

export function buildPrompt(data, length = 'normal', heard = [], again = false) {
  const lines = [];
  if (data.sources.length) {
    lines.push('[위키백과 자료]');
    for (const s of data.sources) {
      const where = s.dist != null ? ` — 여기서 약 ${s.dist}m` : '';
      lines.push(`\n《${s.title}》${where}\n${s.text}`);
    }
  } else {
    lines.push('[자료 없음] 이 좌표 주변에서 위키백과 문서를 찾지 못했습니다.');
  }
  if (data.nearby.length) lines.push(`\n[걸어서 갈 만한 주변] ${data.nearby.join(', ')}`);
  lines.push(`\n[해설 길이] ${LENGTHS[length] || LENGTHS.normal}`);
  lines.push(`[해설할 대상] ${data.place}`);
  const h = (heard || []).filter(Boolean);
  if (h.length) lines.push(`[이미 들은 곳] ${h.slice(-12).join(', ')}`);
  if (again) lines.push('[요청] 같은 자리입니다. 방금과 다른 대목을 골라 새로 이야기해 주세요.');
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
function pastToPolite(text) {
  return text.replace(/([가-힣])다\./g, (m, ch) =>
    ((ch.charCodeAt(0) - 0xAC00) % 28 === 20) ? ch + '어요.' : m);
}

export function soften(text) {
  for (const [a, b] of SOFTEN) text = text.split(a).join(b);
  text = pastToPolite(text);
  for (const [rx, rep] of UNITS) text = text.replace(rx, rep);
  return text;
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

function* streamWiki(data, length) {
  if (!data.sources.length) {
    yield '이 근처에서는 소개할 만한 자료를 찾지 못했어요. 조금 더 걸어가 보시겠어요?\n';
    return;
  }
  const src = data.sources[0];
  let body = src.text.replace(/^==+.*?==+$/gm, '').replace(/\n{2,}/g, '\n').trim();
  body = soften(body);
  const cap = { short: 320, normal: 950, deep: 2000 }[length] ?? 950;

  yield `여러분, 지금 여러분이 서 계신 곳은 ${src.title}입니다.\n`;
  let used = 0;
  for (const sent of body.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean)) {
    if (boring(sent)) continue;
    if (used + sent.length > cap) break;
    used += sent.length;
    yield sent + '\n';
  }
  if (data.nearby.length)
    yield `여기까지 보셨으면, 가까이에 있는 ${data.nearby[0]}에도 한번 가보세요.\n`;
  else yield '천천히 한 바퀴 둘러보세요.\n';
}

/* ── Gemini ──────────────────────────────────────────────── */
const PREFERRED = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.7-flash',
                   'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
let candidates = null;

async function models(key) {
  if (candidates) return candidates;
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
    && !['image', 'tts', 'lite', 'preview'].some(x => m.includes(x))));
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
export async function* stream(data, { length = 'normal', heard = [], again = false } = {}) {
  const key = getKey('gemini');
  if (!key) { yield* streamWiki(data, length); return; }

  const prompt = buildPrompt(data, length, heard, again);
  const list = await models(key);
  let started = false;

  for (const model of list.slice(0, 4)) {
    try {
      for await (const t of geminiOnce(model, key, prompt)) { started = true; yield t; }
      if (started) return;
    } catch (e) {
      if (started) throw new Error('해설이 중간에 끊겼어요.');
      if (e.status === 429) break;          // 한도 — 위키백과로 넘어간다
      if (![400, 403, 404].includes(e.status)) break;
    }
  }
  // 한 글자도 못 받았다. 빈손으로 두지 말고 위키백과라도 읽어준다.
  yield* streamWiki(data, length);
}
