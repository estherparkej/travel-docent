/* 구글 Gemini 음성. 브라우저에서 직접 부른다.
   무료 한도가 분당 요청 수로 걸려 있어 한 번에 하나씩, 간격을 두고 보낸다. */

import { getKey } from './keys.js';

const MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];

/* 구글이 제공하는 30개 전부.
   구글은 성별을 공식 표기하지 않고 '성격'만 밝힌다. 그래서 그 성격을
   우리말로 옮겨 두고, 직접 들어보고 고르시게 했다.
   낮고 묵직한 쪽(중후한·자갈 같은·묵직한)이 대체로 남성처럼 들린다. */
export const VOICES = [
  { id: 'sulafat',      label: '따뜻한 목소리',     desc: '포근하게 감싸는 톤' },
  { id: 'charon',       label: '설명하는 목소리',   desc: '다큐멘터리 내레이션 같은 톤' },
  { id: 'gacrux',       label: '중후한 목소리',     desc: '원숙하고 묵직한 톤' },
  { id: 'algenib',      label: '자갈 같은 목소리',  desc: '거칠고 낮은 톤' },
  { id: 'alnilam',      label: '단단한 목소리',     desc: '흔들림 없는 톤' },
  { id: 'orus',         label: '굳건한 목소리',     desc: '분명하고 단단한 톤' },
  { id: 'rasalgethi',   label: '알려주는 목소리',   desc: '차분한 설명조' },
  { id: 'schedar',      label: '고른 목소리',       desc: '기복 없이 평탄한 톤' },
  { id: 'iapetus',      label: '맑은 목소리',       desc: '또렷하고 깨끗한 톤' },
  { id: 'algieba',      label: '매끄러운 목소리',   desc: '부드럽게 이어지는 톤' },
  { id: 'umbriel',      label: '느긋한 목소리',     desc: '서두르지 않는 톤' },
  { id: 'enceladus',    label: '숨결 섞인 목소리',  desc: '바람 소리가 도는 톤' },
  { id: 'zubenelgenubi',label: '편안한 목소리',     desc: '동네 친구 같은 톤' },
  { id: 'achird',       label: '다정한 친구 목소리',desc: '친근하고 편한 톤' },
  { id: 'sadaltager',   label: '박식한 목소리',     desc: '아는 사람이 알려주듯' },
  { id: 'puck',         label: '들뜬 목소리',       desc: '기분 좋게 통통 튀는 톤' },
  { id: 'fenrir',       label: '신난 목소리',       desc: '흥이 오른 톤' },
  { id: 'vindemiatrix', label: '다정한 목소리',     desc: '옆에서 조곤조곤 이야기하듯' },
  { id: 'achernar',     label: '부드러운 목소리',   desc: '낮고 나긋한 톤' },
  { id: 'aoede',        label: '산뜻한 목소리',     desc: '가볍고 시원한 톤' },
  { id: 'leda',         label: '밝은 목소리',       desc: '젊고 생기 있는 톤' },
  { id: 'kore',         label: '또렷한 목소리',     desc: '단단하고 분명한 발음' },
  { id: 'zephyr',       label: '환한 목소리',       desc: '맑고 밝은 톤' },
  { id: 'autonoe',      label: '해맑은 목소리',     desc: '밝고 가벼운 톤' },
  { id: 'callirrhoe',   label: '수월한 목소리',     desc: '힘 빼고 편안한 톤' },
  { id: 'despina',      label: '고운 목소리',       desc: '매끄럽고 정갈한 톤' },
  { id: 'erinome',      label: '또박한 목소리',     desc: '발음이 선명한 톤' },
  { id: 'laomedeia',    label: '경쾌한 목소리',     desc: '가볍게 튀는 톤' },
  { id: 'pulcherrima',  label: '앞서가는 목소리',   desc: '적극적이고 또렷한 톤' },
  { id: 'sadachbia',    label: '생기 있는 목소리',  desc: '활기찬 톤' },
];

const IDS = new Set(VOICES.map(v => v.id));

const STYLES = {
  warm:   '다정하고 따뜻한 도슨트의 목소리로, 천천히',
  lively: '신나고 들뜬 목소리로, 조금 빠르게',
  calm:   '차분하고 낮은 목소리로, 아주 천천히',
  deep:   '낮고 묵직한 목소리로',
  clear:  '또박또박 정확한 발음으로',
};

export const available = () => !!getKey('gemini');

/* Gemini 는 헤더 없는 PCM 을 준다. 브라우저가 읽도록 WAV 로 감싼다. */
function toWav(pcm, rate = 24000, ch = 1, bits = 16) {
  const head = new ArrayBuffer(44);
  const v = new DataView(head);
  const put = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  const blockAlign = ch * bits / 8;
  put(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); put(8, 'WAVE');
  put(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * blockAlign, true); v.setUint16(32, blockAlign, true);
  v.setUint16(34, bits, true); put(36, 'data'); v.setUint32(40, pcm.byteLength, true);
  return new Blob([head, pcm], { type: 'audio/wav' });
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 요청을 한 줄로 세우고 최소 간격을 둔다
let gate = Promise.resolve();
let lastAt = 0;
const MIN_GAP = 600;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function paced(fn) {
  const run = gate.then(async () => {
    const wait = MIN_GAP - (Date.now() - lastAt);
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    return fn();
  });
  gate = run.catch(() => {});
  return run;
}

async function call(model, key, prompt, voice) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}` +
              `:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!res.ok) {
    const e = new Error(await res.text());
    e.status = res.status;
    throw e;
  }
  const d = await res.json();
  const part = d.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) throw new Error('소리가 오지 않았어요');
  return b64ToBytes(part.data);
}

const cache = new Map();          // 키 → Promise<{url, dur}>
let model = null;

export function synth(text, voice = 'sulafat', tone = 'warm') {
  text = (text || '').trim();
  if (!text) return Promise.reject(new Error('읽을 문장이 없어요'));
  if (!IDS.has(voice)) voice = 'sulafat';

  const ck = `${voice}|${tone}|${text}`;
  if (cache.has(ck)) return cache.get(ck);

  const key = getKey('gemini');
  if (!key) return Promise.reject(new Error('NOKEY'));

  const prompt = `${STYLES[tone] || STYLES.warm} 읽어주세요: ${text}`;
  const order = (model ? [model] : []).concat(MODELS.filter(m => m !== model));

  const job = (async () => {
    let last = null;
    for (const m of order) {
      try {
        /* 429 는 이 열쇠의 한도가 찼다는 뜻이다. 모델을 바꿔도 같은 한도를 쓰므로
           다른 모델로 다시 물어봐야 소용이 없다. 곧바로 알려서 기기 목소리로 넘긴다.
           예전에는 모델마다 6초씩 기다렸다가 다시 물어보느라 13초를 버렸다. */
        const pcm = await paced(() => call(m, key, prompt, voice));
        model = m;
        const url = URL.createObjectURL(toWav(pcm));
        const dur = await new Promise(res => {
          const a = new Audio(url);
          a.onloadedmetadata = () => res(a.duration);
          a.onerror = () => res(0);
        });
        return { url, dur };
      } catch (e) {
        if (e.status === 429) throw new Error('QUOTA');   // 기다리지 않고 바로 넘긴다
        last = e.message;
      }
    }
    throw new Error(last === 'QUOTA' ? 'QUOTA' : (last || '음성을 만들지 못했어요'));
  })();

  cache.set(ck, job);
  job.catch(() => cache.delete(ck));
  return job;
}
