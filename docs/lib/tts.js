/* 구글 Gemini 음성. 브라우저에서 직접 부른다.
   무료 한도가 분당 요청 수로 걸려 있어 한 번에 하나씩, 간격을 두고 보낸다. */

import { getKey, getPlain } from './keys.js';

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

/* ── 엔진 ────────────────────────────────────────────────
   기기 목소리 말고, 인터넷으로 받아오는 곳들. */
export const ENGINES = [
  { id: 'google', label: '구글',    key: 'gemini', note: 'Gemini · 30가지 목소리' },
  { id: 'azure',  label: 'Azure',   key: 'azure',  note: '한국어 전용 목소리 · 넉넉한 무료 한도' },
  { id: 'eleven', label: 'Eleven',  key: 'eleven', note: '가장 사람 같지만 무료 한도가 적음' },
];

export const available = (engine = 'google') =>
  !!getKey(ENGINES.find(e => e.id === engine)?.key || 'gemini');

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

function synthGemini(text, voice, tone) {
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


/* ── Azure 음성 ──────────────────────────────────────────
   한국어를 위해 만들어진 목소리라 억양이 자연스럽다.
   무료 등급(F0)이 한 달 50만 자로 넉넉해서 이 앱에는 가장 잘 맞는다. */
const AZ_REGION = () => getPlain('azureRegion', 'koreacentral');
const azHost = () => `https://${AZ_REGION()}.tts.speech.microsoft.com`;

/* 한국어 목소리는 감정 스타일을 거의 지원하지 않는다.
   대신 어느 목소리에서나 통하는 빠르기·높낮이로 결을 만든다. */
const AZ_TONE = {
  warm:   { rate: '-8%',  pitch: '0%'  },
  lively: { rate: '+8%',  pitch: '+4%' },
  calm:   { rate: '-15%', pitch: '-4%' },
  deep:   { rate: '-10%', pitch: '-8%' },
  clear:  { rate: '0%',   pitch: '0%'  },
};

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;');

async function azVoices(key) {
  const res = await fetch(`${azHost()}/cognitiveservices/voices/list`,
    { headers: { 'Ocp-Apim-Subscription-Key': key } });
  if (!res.ok) { const e = new Error(await res.text()); e.status = res.status; throw e; }
  const all = await res.json();
  return all
    .filter(v => v.Locale === 'ko-KR')
    .map(v => ({
      id: v.ShortName,
      // LocalName 은 '선히'처럼 우리말 이름이라 그대로 쓰면 알아보기 쉽다
      label: `${v.LocalName || v.DisplayName} 목소리`,
      desc: (v.Gender === 'Male' ? '남성' : '여성')
            + (v.VoiceType === 'Neural' ? ' · 자연스러운 신경망' : ''),
    }));
}

async function azSynth(text, voice, tone, key) {
  const t = AZ_TONE[tone] || AZ_TONE.warm;
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">` +
    `<voice name="${voice}"><prosody rate="${t.rate}" pitch="${t.pitch}">` +
    `${esc(text)}</prosody></voice></speak>`;
  const res = await fetch(`${azHost()}/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    },
    body: ssml,
  });
  if (!res.ok) { const e = new Error(await res.text()); e.status = res.status; throw e; }
  return new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' });
}

/* ── ElevenLabs ──────────────────────────────────────────
   목소리 자체는 가장 사람 같다. 다만 한국어 전용 목소리가 아니라
   영어권 목소리가 한국어를 읽는 구조라 억양이 묻어난다.
   무료 한도도 한 달 1만 크레딧뿐이라 오래 못 쓴다. */
const EL_MODEL = 'eleven_flash_v2_5';        // 빠르고 크레딧을 절반만 쓴다
const EL_TONE = {
  warm:   { stability: 0.45, similarity_boost: 0.80, speed: 0.94 },
  lively: { stability: 0.30, similarity_boost: 0.75, speed: 1.06 },
  calm:   { stability: 0.65, similarity_boost: 0.80, speed: 0.88 },
  deep:   { stability: 0.60, similarity_boost: 0.85, speed: 0.92 },
  clear:  { stability: 0.55, similarity_boost: 0.75, speed: 1.00 },
};

async function elVoices(key) {
  const res = await fetch('https://api.elevenlabs.io/v1/voices',
    { headers: { 'xi-api-key': key } });
  if (!res.ok) { const e = new Error(await res.text()); e.status = res.status; throw e; }
  const d = await res.json();
  return (d.voices || []).map(v => ({
    id: v.voice_id,
    label: (v.name || '').split(' - ')[0],
    desc: [v.labels?.gender === 'male' ? '남성' : v.labels?.gender === 'female' ? '여성' : '',
           v.labels?.description || ''].filter(Boolean).join(' · ') || '영어권 목소리',
  }));
}

async function elSynth(text, voice, tone, key) {
  const t = EL_TONE[tone] || EL_TONE.warm;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: EL_MODEL, voice_settings: t }),
    });
  if (!res.ok) { const e = new Error(await res.text()); e.status = res.status; throw e; }
  return new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' });
}

/* ── 공통 ────────────────────────────────────────────────── */
/* 서비스마다 실패를 알리는 방식이 다르다. Azure 는 본문 없이 401 만 주고,
   ElevenLabs 는 JSON 을 통째로 준다. 화면에 그대로 내보내면 읽을 수 없으므로
   여기서 세 가지로만 추린다: 한도 / 키 문제 / 그 밖. */
function tidy(e) {
  if (e.status === 429) return new Error('QUOTA');
  if (e.status === 401 || e.status === 403) return new Error('BADKEY');
  const m = String(e.message || '');
  if (/authentication|unauthor|invalid[_ ]api[_ ]key/i.test(m)) return new Error('BADKEY');
  if (/quota|rate[_ ]limit|too many/i.test(m)) return new Error('QUOTA');
  return new Error(m.slice(0, 120) || '목소리를 불러오지 못했어요');
}
const durOf = url => new Promise(res => {
  const a = new Audio(url);
  a.onloadedmetadata = () => res(a.duration);
  a.onerror = () => res(0);
});

const listCache = new Map();

/* 고를 수 있는 목소리 목록. 구글은 붙박이고, 나머지는 열쇠로 물어본다. */
export function voices(engine = 'google') {
  if (engine === 'google') return Promise.resolve(VOICES);
  const key = getKey(engine === 'azure' ? 'azure' : 'eleven');
  if (!key) return Promise.reject(new Error('NOKEY'));
  const ck = `${engine}|${key.slice(-6)}|${engine === 'azure' ? AZ_REGION() : ''}`;
  if (listCache.has(ck)) return listCache.get(ck);
  const job = (engine === 'azure' ? azVoices(key) : elVoices(key))
    .catch(e => { throw tidy(e); });
  listCache.set(ck, job);
  job.catch(() => listCache.delete(ck));
  return job;
}

export function synth(text, voice, tone = 'warm', engine = 'google') {
  text = (text || '').trim();
  if (!text) return Promise.reject(new Error('읽을 문장이 없어요'));
  if (engine === 'google') return synthGemini(text, voice, tone);

  const key = getKey(engine === 'azure' ? 'azure' : 'eleven');
  if (!key) return Promise.reject(new Error('NOKEY'));

  const ck = `${engine}|${voice}|${tone}|${text}`;
  if (cache.has(ck)) return cache.get(ck);

  const job = (async () => {
    try {
      const blob = engine === 'azure'
        ? await azSynth(text, voice, tone, key)
        : await elSynth(text, voice, tone, key);
      const url = URL.createObjectURL(blob);
      return { url, dur: await durOf(url) };
    } catch (e) {
      throw tidy(e);
    }
  })();

  cache.set(ck, job);
  job.catch(() => cache.delete(ck));
  return job;
}
