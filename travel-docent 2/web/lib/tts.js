/* 구글 Gemini 음성. 브라우저에서 직접 부른다.
   무료 한도가 분당 요청 수로 걸려 있어 한 번에 하나씩, 간격을 두고 보낸다. */

import { getKey } from './keys.js';

const MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];

export const VOICES = [
  { id: 'sulafat',      label: '따뜻한 목소리',   desc: '포근하게 감싸는 톤. 기본값' },
  { id: 'vindemiatrix', label: '다정한 목소리',   desc: '옆에서 조곤조곤 이야기하듯' },
  { id: 'achernar',     label: '부드러운 목소리', desc: '낮고 나긋한 톤' },
  { id: 'aoede',        label: '산뜻한 목소리',   desc: '가볍고 시원한 톤' },
  { id: 'leda',         label: '밝은 목소리',     desc: '젊고 생기 있는 톤. 아이와 함께' },
  { id: 'kore',         label: '또렷한 목소리',   desc: '단단하고 분명한 발음' },
  { id: 'charon',       label: '설명하는 목소리', desc: '다큐멘터리 내레이션 같은 톤' },
  { id: 'gacrux',       label: '중후한 목소리',   desc: '묵직하고 원숙한 톤' },
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
const MIN_GAP = 1100;
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
        let pcm;
        try {
          pcm = await paced(() => call(m, key, prompt, voice));
        } catch (e) {
          if (e.status !== 429) throw e;
          await sleep(6000);                       // 분당 한도 — 한 번만 더
          pcm = await paced(() => call(m, key, prompt, voice));
        }
        model = m;
        const url = URL.createObjectURL(toWav(pcm));
        const dur = await new Promise(res => {
          const a = new Audio(url);
          a.onloadedmetadata = () => res(a.duration);
          a.onerror = () => res(0);
        });
        return { url, dur };
      } catch (e) {
        if (e.status === 429) { last = 'QUOTA'; continue; }
        last = e.message;
      }
    }
    throw new Error(last === 'QUOTA' ? 'QUOTA' : (last || '음성을 만들지 못했어요'));
  })();

  cache.set(ck, job);
  job.catch(() => cache.delete(ck));
  return job;
}
