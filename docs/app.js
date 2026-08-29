import * as wiki from './lib/wiki.js';
import * as llm from './lib/llm.js';
import * as tts from './lib/tts.js';
import * as photos from './lib/photos.js';
import { KR, WW, BANNERS } from './lib/places.js';
import * as geo from './lib/geo.js';
import { getKey, setKey, getKeys, provider } from './lib/keys.js';

window.__boot = [];
window.addEventListener('error', e => window.__boot.push(e.message + ' @' + e.lineno));


/* 여행 도슨트 — 플레이어
   해설 한 편이 한 곡, 문장 하나가 가사 한 줄이다.
   문장 단위로 이전·다음·탐색이 되고, 아트워크에서 뽑은 색이 화면 배경이 된다. */

const $ = id => document.getElementById(id);
const els = {
  // 좌측 상단 상태 문구는 없앴다. 로딩은 버튼 스피너가 알려준다.
  status: $('statusLabel') || document.createElement('span'), name: $('placeName'), addr: $('placeAddr'),
  chip: $('providerChip'),
  rail: $('rail'), dots: $('dots'), lower: document.querySelector('.lower'),
  times: $('times'),
  play: $('playBtn'), prev: $('prevBtn'), next: $('nextBtn'),
  again: $('againBtn'), auto: $('autoBtn'),
  icoPlay: $('icoPlay'), icoPause: $('icoPause'), icoWait: $('icoWait'),
  icoReplay: $('icoReplay'),
  track: $('seekTrack'), fill: $('seekFill'),
  tCur: $('tCur'), tDur: $('tDur'),
  peek: $('peek'), peekLine: $('peekLine'),
  transcript: $('transcript'), scriptPanel: $('scriptPanel'), scriptPlace: $('scriptPlace'),
  modes: document.querySelector('.modes'),
  viewer: $('viewer'), viewerImg: $('viewerImg'), viewerStage: $('viewerStage'),
  viewerCap: $('viewerCap'), viewerBg: $('viewerBg'),
  viewerCount: $('viewerCount'), viewerClose: $('viewerClose'),
  heroWrap: $('heroWrap'), heroTrack: $('heroTrack'), heroDots: $('heroDots'),
  krChips: $('krChips'), krList: $('krList'),
  wwChips: $('wwChips'), wwList: $('wwList'), toTop: $('toTop'),
  pickList: $('pickList'), nearShelf: $('nearShelf'), nearList: $('nearList'),
  sugList: $('sugList'), searchForm: $('searchForm'), searchInput: $('searchInput'),
  logList: $('logList'), logEmpty: $('logEmpty'),
  mini: $('mini'), miniImg: $('miniImg'), miniEq: $('miniEq'), miniTitle: $('miniTitle'),
  miniSub: $('miniSub'), miniPlay: $('miniPlay'), miniRing: $('miniRing'),
  settings: $('settings'), lengthSeg: $('lengthSeg'), toneList: $('toneList'),
  voiceSel: $('voiceSel'), preview: $('previewVoice'), voiceHint: $('voiceHint'),
  engineSeg: $('engineSeg'), quotaNote: $('quotaNote'), quotaTxt: $('quotaTxt'),
  deviceField: $('deviceField'), googleField: $('googleField'), gvoiceList: $('gvoiceList'),
  rateSel: $('rateSel'), rateVal: $('rateVal'),
  pitchSel: $('pitchSel'), pitchVal: $('pitchVal'),
  openApi: $('openApi'), apiDot: $('apiDot'),
  apiSheet: $('apiSheet'), apiInner: $('apiInner'), apiHead: $('apiHead'),
  geminiKey: $('geminiKey'), pexelsKey: $('pexelsKey'), saveKeys: $('saveKeys'),
  accHead: $('voiceAccHead'), accBody: $('voiceAccBody'), voiceNow: $('voiceNow'),
};

const ICO = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.6 5.2c0-.83.9-1.34 1.6-.9l9.1 5.75a1.05 1.05 0 0 1 0 1.78L10.2 17.6c-.7.44-1.6-.07-1.6-.9V5.2Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.6" height="14" rx="1.3"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.3"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4.5V10h5.5"/></svg>',
  spin: '<svg class="spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-opacity=".25" stroke-width="2.4"/><path d="M20 12a8 8 0 0 0-8-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  // 탭바 가운데 아이콘 — 동그라미 안에서 상태가 바뀐다
  tabPlay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.4"/><path d="M10.4 9.2c0-.5.55-.8.96-.54l4.1 2.6c.38.24.38.8 0 1.04l-4.1 2.6c-.41.26-.96-.04-.96-.54V9.2Z" fill="currentColor" stroke="none"/></svg>',
  tabPause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.4"/><rect x="9.3" y="8.6" width="2" height="6.8" rx=".9" fill="currentColor" stroke="none"/><rect x="12.7" y="8.6" width="2" height="6.8" rx=".9" fill="currentColor" stroke="none"/></svg>',
  tabSpin: '<svg class="spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-opacity=".28" stroke-width="1.8"/><path d="M20.4 12A8.4 8.4 0 0 0 12 3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/* ── 설정값 ──────────────────────────────────────────────── */
const prefs = Object.assign(
  { length: 'normal', rate: 0.95, pitch: 1.06, tone: 'warm', auto: false, voice: '',
    engine: 'device', gvoice: 'sulafat' },
  JSON.parse(localStorage.getItem('prefs') || '{}'));
const savePrefs = () => localStorage.setItem('prefs', JSON.stringify(prefs));

/* 같은 음성이라도 속도·높낮이·쉼을 바꾸면 다른 사람이 된다 */
const TONES = {
  warm:   { rate: 0.95, pitch: 1.06, gap: 420,
            label: '다정한 해설가', desc: '느리고 따뜻하게. 기본값' },
  lively: { rate: 1.05, pitch: 1.14, gap: 300,
            label: '신나는 이야기꾼', desc: '빠르고 들뜬 목소리. 아이와 함께' },
  calm:   { rate: 0.85, pitch: 0.96, gap: 520,
            label: '차분한 내레이터', desc: '천천히 낮게. 혼자 걸을 때' },
  deep:   { rate: 0.90, pitch: 0.82, gap: 460,
            label: '낮고 묵직한 목소리', desc: '남성에 가까운 저음' },
  clear:  { rate: 1.00, pitch: 1.00, gap: 360,
            label: '또박또박 선생님', desc: '표준 속도로 정확하게' },
};
const gap = () => (TONES[prefs.tone] || TONES.warm).gap;

/* 구글 목소리를 쓸 차례인가. 이번 해설에서 한 번 실패했으면 잠시 기기 목소리로. */
/* 무료 한도에 걸린 시각. 설정 화면에서 안내한다. */
const QUOTA_WAIT = 60;                 // 대략 이 정도 지나면 풀린다 (초)
function markQuota() {
  state.quotaAt = Date.now();
  try { localStorage.setItem('quota-at', String(state.quotaAt)); } catch (_) {}
  renderQuota();
}

function renderQuota() {
  const left = state.quotaAt
    ? QUOTA_WAIT - Math.floor((Date.now() - state.quotaAt) / 1000) : 0;
  if (left <= 0) {
    state.quotaAt = 0;
    els.quotaNote.classList.add('hidden');
    return;
  }
  els.quotaNote.classList.remove('hidden');
  els.quotaTxt.innerHTML =
    `<b>구글 무료 한도에 걸렸어요.</b> 분당 요청 수 제한이라 ` +
    `<b>${left}초</b>쯤 뒤에 다시 됩니다. 그동안은 기기 목소리로 읽어드려요.`;
}
setInterval(() => { if (state.quotaAt) renderQuota(); }, 1000);

const inQuota = () => state.quotaAt && Date.now() - state.quotaAt < QUOTA_WAIT * 1000;
/* 한도에 걸린 동안에는 물어보지도 않는다.
   묶음마다 실패를 다시 겪으면 그때마다 재생이 끊긴다. */
const useGoogle = () => prefs.engine === 'google' && !state.fallback
  && !inQuota() && tts.available();

/* ── 상태 ────────────────────────────────────────────────── */
const state = {
  pos: null, place: '', address: '', image: '',
  geocodedAt: null, narratedAt: null,
  heard: JSON.parse(localStorage.getItem('heard') || '[]'),
  streaming: false, unlocked: false, resolved: '', view: 'player', scriptOpen: false,
  manual: '',   // 검색이나 카드로 고른 장소
  mode: 'full',  // full | summary
  fallback: false, quotaAt: +(localStorage.getItem('quota-at') || 0),
  shots: [], slide: 0, railT: null, followT: 0,
};

const P = {
  lines: [], idx: -1,
  playing: false, paused: false, speaking: false, ended: false,
  seq: 0, lineAt: 0, heldFor: 0, voices: [], audio: null, waiting: false,
  chunks: [], ci: 0, pendingNext: null,
};

/* 슬라이더가 채워진 만큼만 오렌지로 — 트랙은 옅은 그레이 */
function paintRange(el) {
  const min = +el.min || 0, max = +el.max || 100;
  el.style.setProperty('--p', ((+el.value - min) / (max - min) * 100).toFixed(1) + '%');
}

/* SVG 요소를 확실히 보이고 숨긴다 */
function showIcon(el, on) {
  if (!el) return;
  if (on) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

const CPS = 5.4;
const durOf = t => Math.max(1.1, t.length / (CPS * +els.rateSel.value) + 0.32);
const fmt = s => {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/* 바탕은 흰색 그라데이션으로 고정한다.
   예전엔 사진에서 색을 뽑아 배경에 깔았지만, 사진마다 배경색이 널뛰고
   글자색까지 뒤집혀야 해서 읽기가 불안정했다. 지금은 사진만 흰 바탕으로 녹인다. */
/* 사진 위에 얹힌 글자를 읽히게 한다.
   사진은 아래로 갈수록 흰 배경에 녹아 사라지므로, 글자가 실제로 놓이는
   띠만 골라내고 거기에 남아 있는 사진의 농도만큼만 섞어서 밝기를 잰다. */
const FADE = [[0,1],[.44,1],[.46,.96],[.54,.73],[.60,.41],[.66,.14],
              [.71,.03],[.75,0],[1,0]];
function fadeAt(t) {
  for (let i = 1; i < FADE.length; i++) {
    const [x1, a1] = FADE[i], [x0, a0] = FADE[i - 1];
    if (t <= x1) return a0 + (a1 - a0) * ((t - x0) / (x1 - x0) || 0);
  }
  return 0;
}

let artToken = 0;
function applyArtColor(url) {
  const art = document.getElementById('rail');
  const view = document.getElementById('view-player');
  if (!art || !view) return;
  const clear = () => view.classList.remove('on-dark', 'on-busy');
  if (!url) { clear(); return; }

  const me = ++artToken;
  const im = new Image();
  im.crossOrigin = 'anonymous';
  im.onerror = () => { if (me === artToken) clear(); };
  im.onload = () => {
    if (me !== artToken) return;
    try {
      const box = art.getBoundingClientRect();
      const t = document.querySelector('.title');
      const p = document.querySelector('.peek-line') || t;
      if (!t || !box.height) return;
      const top = (t.getBoundingClientRect().top - box.top) / box.height;
      const bot = (p.getBoundingClientRect().bottom - box.top) / box.height;

      const W = 24, H = 40;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      const sc = Math.max(W / im.width, H / im.height);
      const dw = im.width * sc, dh = im.height * sc;
      g.drawImage(im, (W - dw) / 2, (H - dh) * 0.4, dw, dh);
      const d = g.getImageData(0, 0, W, H).data;

      const lums = [];
      for (let y = 0; y < H; y++) {
        const r = (y + .5) / H;
        if (r < top || r > bot) continue;
        const a = fadeAt(r);
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const l = (.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]) / 255;
          lums.push(l * a + (1 - a));   // 남은 농도만큼만 사진, 나머지는 흰 종이
        }
      }
      if (!lums.length) return;
      lums.sort((x, y) => x - y);
      const at = q => lums[Math.min(lums.length - 1, Math.floor(lums.length * q))];
      const lo = at(0.10), hi = at(0.90);

      /* 평균만 보면 안 된다. 밝은 난간과 어두운 처마가 섞인 사진은
         평균이 밝게 나오지만 검은 글자가 처마 위에서 사라진다.
         그래서 가장 어두운 쪽(하위 10%)과 밝은 쪽(상위 10%)을 각각 본다. */
      const dark = hi <= 0.25;              // 어디를 봐도 어둡다 → 흰 글자
      /* 경계값 하나로 켜고 끄면 사진을 넘길 때마다 바탕이 깜빡인다.
         들어갈 때와 나올 때의 기준을 달리 둔다. */
      const was = view.classList.contains('on-busy');
      const busy = !dark && (was ? lo < 0.58 : lo < 0.48);
      view.classList.toggle('on-dark', dark);
      view.classList.toggle('on-busy', busy);
      state.artLum = { lo: +lo.toFixed(2), hi: +hi.toFixed(2), dark, busy };
    } catch (_) { /* 다른 출처의 사진이면 읽을 수 없다 — 원래 색을 쓴다 */ }
  };
  im.src = url;
}


/* ── 목소리 ──────────────────────────────────────────────── */
/* 애플 기기의 한국어 음성 중 도슨트로 쓸 수 있는 건 사실상 유나 하나뿐이다.
   Eddy·Grandma·Rocko 같은 것들은 장난감 음성이라 목록에서 뺀다. */
/* 애플이 넣어둔 장난감 음성만 거른다. 그 밖에는 모두 목록에 남긴다. */
const NOVELTY = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bells|bubbles|jester|organ|superstar|trinoids|whisper|wobble|boing|bahh|zarvox|cellos|albert|bad news|good news|deranged|hysterical|junior|ralph|fred|kathy|princess|novelty|trinoids)\b/i;
const WARM = ['유나', 'yuna', 'sora', 'nara', 'heami', 'sunhi', 'seoyeon', 'jiwon'];

function voiceScore(v) {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/premium|프리미엄/.test(n)) s += 60;
  else if (/enhanced|고급|향상/.test(n)) s += 40;
  const i = WARM.findIndex(w => n.includes(w));
  if (i >= 0) s += 30 - i * 2;
  if (/google/.test(n)) s += 24;       // 크롬이 주는 구글 네트워크 음성
  if (!v.localService) s += 10;
  if (NOVELTY.test(n)) s -= 100;
  return s;
}

function loadVoices() {
  P.voices = speechSynthesis.getVoices();
  const ko = P.voices.filter(v => v.lang.toLowerCase().startsWith('ko'));
  const pool = ko.length ? ko : P.voices;
  // 크롬이 주는 네트워크 음성(Google 한국의 등)은 어떤 경우에도 거르지 않는다
  const keep = v => !NOVELTY.test(v.name) || !v.localService || /google/i.test(v.name);
  const usable = pool.filter(keep).sort((a, b) => voiceScore(b) - voiceScore(a));

  els.voiceSel.innerHTML = usable.length
    ? usable.map(v => {
        const tag = v.localService ? '' : ' · 네트워크';
        return `<option value="${v.name}">${v.name}${ko.length ? '' : ` (${v.lang})`}${tag}</option>`;
      }).join('')
    : '<option value="">쓸 수 있는 목소리 없음</option>';

  if (prefs.voice && usable.some(v => v.name === prefs.voice)) els.voiceSel.value = prefs.voice;
  else if (usable.length) { els.voiceSel.value = usable[0].name; prefs.voice = usable[0].name; }

  els.voiceNow.textContent = els.voiceSel.value || '없음';
  const best = usable[0];
  const premium = best && /premium|enhanced|프리미엄|고급/i.test(best.name);
  const dropped = pool.length - usable.length;
  const net = usable.filter(v => !v.localService).length;
  els.voiceHint.classList.toggle('hidden', !!premium);
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

const ICO_PLAY_SM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 5.6c0-.72.78-1.16 1.39-.78l8.2 5.18a.92.92 0 0 1 0 1.56l-8.2 5.2c-.61.38-1.39-.06-1.39-.78V5.6Z"/></svg>';
const ICO_SPIN_SM = '<svg class="spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-opacity=".25" stroke-width="2.4"/><path d="M20 12a8 8 0 0 0-8-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const ICO_PAUSE_SM = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7.6" y="5.5" width="3.1" height="13" rx="1.4"/><rect x="13.3" y="5.5" width="3.1" height="13" rx="1.4"/></svg>';

function renderTones() {
  els.toneList.innerHTML = Object.entries(TONES).map(([k, t]) => `
    <div class="vrow${k === prefs.tone ? ' on' : ''}" data-v="${k}">
      <span class="vtext"><b>${t.label}</b><em>${t.desc}</em></span>
      <button class="vplay" data-v="${k}" aria-label="${t.label} 들어보기">${ICO_PLAY_SM}</button>
    </div>`).join('');
}

function markToneRows() {
  [...els.toneList.querySelectorAll('.vrow')].forEach(r =>
    r.classList.toggle('on', r.dataset.v === prefs.tone));
}

/* iOS 는 사용자가 누른 그 순간에만 소리를 열어준다.
   구글 목소리는 합성에 몇 초가 걸려서, 그때 새 Audio 를 만들면
   이미 제스처가 끝난 뒤라 재생이 거부된다.
   그래서 오디오 엘리먼트를 하나 만들어 두고 누른 순간에 풀어둔 뒤,
   나중에는 src 만 갈아끼운다. */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
const audioEl = new Audio();
audioEl.preload = 'auto';

/* 눌린 그 순간에 목소리 엔진을 깨워 둔다.
   운영체제의 음성 엔진은 한동안 안 쓰면 잠들고, 깨어나는 데만 0.8초가 걸린다.
   해설을 받아오는 1.8초 동안 미리 깨워 두면 그 시간이 통째로 사라진다.
   아이폰에서는 이 한 번이 '손가락으로 눌러 허락받은' 재생 권한이 되기도 한다. */
function warmVoice() {
  // 말하는 중에 끼워 넣으면 그 문장이 취소되면서 크롬의 말하기 큐가 망가진다.
  if (speechSynthesis.speaking || speechSynthesis.pending) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    const v = P.voices.find(x => x.name === els.voiceSel.value);
    if (v) u.voice = v;                 // 쓸 목소리를 그대로 깨워야 효과가 있다
    u.lang = 'ko-KR';
    speechSynthesis.speak(u);
  } catch (_) {}
}

function unlockAudio() {
  warmVoice();                          // 재생을 누를 때마다 깨운다
  if (state.unlocked) return;
  try {
    audioEl.src = SILENT;
    audioEl.play().then(() => { audioEl.pause(); }).catch(() => {});
  } catch (_) {}
  state.unlocked = true;
}

/* ── 재생 ────────────────────────────────────────────────── */
function relayout(keepDur = false) {
  let t = 0;
  for (const l of P.lines) {
    if (!keepDur || !l.dur) l.dur = durOf(l.text);
    l.start = t;
    t += l.dur;
  }
}
const total = () => P.lines.length ? P.lines.at(-1).start + P.lines.at(-1).dur : 0;

/* ── 구글 목소리 엔진 ─────────────────────────────────────
   무료 한도가 '분당 요청 수'로 걸려 있어서 문장마다 부르면 못 쓴다.
   그래서 문장을 200자쯤씩 묶어 한 번에 합성하고,
   문장별 위치는 글자 수 비례로 나눠 가사를 따라가게 한다.
   묶음 하나를 듣는 동안 다음 묶음을 미리 받아둔다. */

const audioCache = new Map();     // 요청키 → Promise<{url, dur}>
let gvoices = [];
const CHUNK_CHARS = 200;

function ttsKey(text) { return `${prefs.gvoice}|${prefs.tone}|${text}`; }

function fetchAudio(text) {
  return tts.synth(text, prefs.gvoice, prefs.tone);
}

/* 문장을 묶음으로 나눈다.
   첫 묶음은 작게(빨리 소리가 나야 하니까), 뒤로 갈수록 크게(요청 수를 아끼려고).
   이미 재생에 들어간 묶음은 경계를 바꾸지 않는다. */
const capFor = n => (n === 0 ? 32 : n === 1 ? 110 : CHUNK_CHARS);

function buildChunks() {
  const locked = P.chunks.filter(c => c.locked);
  const out = locked.slice();
  let i = locked.length ? locked[locked.length - 1].to + 1 : 0;
  let cur = null;
  for (; i < P.lines.length; i++) {
    if (!cur || cur.chars >= capFor(out.length - 1)) {
      cur = { from: i, to: i, chars: 0, text: '', dur: 0 };
      out.push(cur);
    }
    cur.to = i;
    cur.chars += P.lines[i].text.length;
    cur.text += (cur.text ? ' ' : '') + P.lines[i].text;
  }
  P.chunks = out;
  return out;
}
const chunkOf = i => P.chunks.findIndex(c => i >= c.from && i <= c.to);

/* 묶음 길이를 문장별로 글자 수 비례 배분 — 가사 따라가기의 근거 */
function spread(chunk) {
  let t = 0;
  for (let i = chunk.from; i <= chunk.to; i++) {
    const l = P.lines[i];
    l.dur = chunk.dur * (l.text.length / chunk.chars);
    l.offset = t;                 // 묶음 안에서의 시작 위치
    t += l.dur;
  }
  relayout(true);
}

function lineAtTime(chunk, t) {
  for (let i = chunk.to; i >= chunk.from; i--)
    if (t >= P.lines[i].offset) return i;
  return chunk.from;
}

async function playChunk(ci, startLine) {
  const chunk = P.chunks[ci];
  if (!chunk) { finish(); return; }
  // startLine 이 -1 로 들어오는 경우가 있다. ?? 로는 못 걸러낸다.
  const from = (startLine == null || startLine < chunk.from || startLine > chunk.to)
    ? chunk.from : startLine;
  const seq = ++P.seq;
  P.ci = ci;
  chunk.locked = true;
  P.waiting = true;
  paint();

  let got;
  const tick = setInterval(() => {
    if (seq === P.seq && P.waiting)
      els.status.textContent = ci ? '다음 대목을 준비하는 중' : '목소리를 만드는 중';
  }, 1000);
  try {
    // 30초를 넘기면 기다리게 두지 않고 기기 목소리로 넘긴다
    got = await Promise.race([
      fetchAudio(chunk.text),
      new Promise((_, rej) => setTimeout(() => rej(new Error('SLOW')), 30000)),
    ]);
  } catch (e) {
    clearInterval(tick);
    P.waiting = false;
    if (seq !== P.seq) return;
    return googleFailed(e.message, from);
  }
  clearInterval(tick);
  P.waiting = false;
  if (seq !== P.seq) return;

  chunk.dur = got.dur || chunk.chars / 5.4;
  spread(chunk);

  const a = audioEl;                    // 잠금이 풀린 그 엘리먼트를 재사용
  a.src = got.url;
  a.playbackRate = +els.rateSel.value || 1;
  let queued = false;
  a.ontimeupdate = () => {
    if (seq !== P.seq) return;
    const i = lineAtTime(chunk, a.currentTime / a.playbackRate);
    if (i !== P.idx) { P.idx = i; highlight(); }
    // 다음 묶음은 이 묶음을 3분의 1쯤 들은 뒤에 부른다.
    // 한꺼번에 부르면 분당 요청 한도에 걸린다.
    if (!queued && a.duration && a.currentTime > a.duration * 0.34) {
      queued = true;
      const nx = P.chunks[ci + 1];
      if (nx) fetchAudio(nx.text).catch(() => {});
    }
  };
  a.onended = () => {
    if (seq !== P.seq) return;
    P.audio = null;
    P.speaking = false;
    if (ci + 1 < P.chunks.length) playChunk(ci + 1);
    else if (state.streaming) P.pendingNext = ci + 1;   // 뒷문장이 오면 이어서
    else finish();
  };
  a.onerror = a.onended;

  if (from > chunk.from) a.currentTime = P.lines[from].offset * a.playbackRate;

  P.audio = a;
  P.speaking = true;
  P.idx = from;
  highlight();
  a.play().catch(() => {
    if (seq !== P.seq) return;
    notify('소리를 열지 못했어요. 재생 버튼을 한 번 더 눌러 주세요.');
    P.speaking = false; P.playing = false; paint();
  });
  paint();
}

/* 구글 목소리가 막히면 조용히 멈추지 않고 기기 목소리로 이어 읽는다 */
function googleFailed(msg, fromLine) {
  if (msg === 'QUOTA') markQuota();
  notify(msg === 'QUOTA'
    ? '구글 목소리 분당 한도에 걸렸어요. 기기 목소리로 이어 읽을게요.'
    : msg === 'SLOW'
      ? '구글 목소리가 너무 오래 걸려서 기기 목소리로 이어 읽을게요.'
      : '구글 목소리를 불러오지 못했어요. 기기 목소리로 이어 읽을게요.');
  // 설정 자체는 건드리지 않는다. 이번 해설에만 기기 목소리로 대신한다.
  state.fallback = true;
  killAudio();
  P.chunks.forEach(c => { c.locked = false; });
  P.speaking = false;
  P.pendingNext = null;
  P.idx = Math.max(0, Math.min(fromLine, P.lines.length - 1));
  if (P.playing && P.lines.length) speakCurrent();
  paint();
}

function speakCurrent() {
  const line = P.lines[P.idx];
  if (!line) return;
  const seq = ++P.seq;
  if (useGoogle()) {
    if (!P.chunks.length) buildChunks();
    const i = Math.max(0, P.idx);
    return playChunk(Math.max(0, chunkOf(i)), i);
  }
  const u = new SpeechSynthesisUtterance(line.text);
  u.lang = 'ko-KR';
  u.rate = +els.rateSel.value;
  u.pitch = +els.pitchSel.value;
  const v = P.voices.find(x => x.name === els.voiceSel.value);
  if (v) u.voice = v;
  u.onstart = () => { if (seq === P.seq) { P.lineAt = performance.now(); P.retried = false; highlight(); paint(); } };
  u.onend = u.onerror = () => {
    if (seq !== P.seq) return;
    P.speaking = false;
    advance();
  };
  P.speaking = true;
  P.lineAt = 0;                     // 소리가 나기 시작하면 그때 켠다
  speechSynthesis.speak(u);
  highlight();
  paint();

  /* 사파리와 아이폰은 말하기 요청을 소리 없이 버리는 일이 있다.
     그러면 onstart 도 onend 도 오지 않아 영영 멈춰 선다.
     잠깐 기다려 보고 소식이 없으면 한 번 더 시도하고, 그래도 안 되면 사실대로 알린다. */
  clearTimeout(P.startT);
  P.startT = setTimeout(() => {
    if (seq !== P.seq || P.lineAt || P.paused || !P.playing) return;
    // 소리는 나고 있는데 시작 알림만 오지 않는 경우가 있다(크롬).
    // 이때 다시 시도하면 멀쩡한 재생을 끊는 꼴이 된다. 시계만 조용히 켠다.
    if (speechSynthesis.speaking) { P.lineAt = performance.now(); P.retried = false; paint(); return; }
    if (P.retried) {
      P.retried = false;
      P.speaking = false; P.playing = false;
      notify('기기 목소리가 열리지 않았어요. 재생을 한 번 더 눌러 주세요.');
      paint();
      return;
    }
    P.retried = true;
    speechSynthesis.cancel();
    setTimeout(() => { if (seq === P.seq && P.playing && !P.paused) speakCurrent(); }, 60);
  }, 1500);
}

function advance() {
  if (!P.playing) return;
  if (P.idx + 1 < P.lines.length) {
    P.idx++;
    const seq = P.seq;
    // 사람은 문장 사이에 잠깐 쉰다. 이 틈이 기계 티를 크게 줄인다.
    setTimeout(() => { if (seq === P.seq && P.playing && !P.paused) speakCurrent(); }, gap());
    return;
  }
  if (state.streaming) return;      // 다음 문장이 도착하면 이어 읽는다
  finish();
}

function finish() {
  P.playing = false; P.speaking = false; P.ended = true;
  P.lines.forEach(l => l.el.classList.remove('on'));
  paint();
}

function playFrom(i) {
  if (!P.lines.length) return;
  i = Math.max(0, Math.min(i, P.lines.length - 1));
  P.seq++;
  speechSynthesis.cancel();
  killAudio();
  P.idx = i;
  P.playing = true; P.paused = false; P.ended = false;
  unlockAudio();
  speakCurrent();
}

/* 말하기 알림(onend)은 크롬·사파리에서 종종 통째로 사라진다.
   그러면 한 문장만 읽고 그대로 멈춰 선다.
   알림에만 기대지 않고, 실제로 말이 끝났는지 직접 들여다본다. */
setInterval(() => {
  if (!P.playing || P.paused || P.audio) return;   // 구글 목소리는 오디오가 알려준다
  if (!P.speaking || !P.lineAt) return;
  if (speechSynthesis.speaking || speechSynthesis.pending) return;
  P.speaking = false;
  advance();
}, 250);

function killAudio() {
  if (P.audio) { P.audio.pause(); P.audio = null; }
  P.waiting = false;
}

/* 미리듣기용 — 본 재생과 섞이지 않게 따로 둔다 */
const previewEl = new Audio();
let previewOf = '';

function stopAll() {
  P.playing = false; P.paused = false; P.speaking = false; P.ended = false;
  P.seq++;
  speechSynthesis.cancel();
  killAudio();
}

// 크롬 데스크톱은 15초쯤 뒤 음성이 멎는 버그가 있어 주기적으로 깨워준다
setInterval(() => {
  if (P.speaking && !P.paused && speechSynthesis.speaking) {
    speechSynthesis.pause(); speechSynthesis.resume();
  }
}, 10000);

/* ── 화면 ────────────────────────────────────────────────── */
function elapsed() {
  const l = P.lines[P.idx];
  if (!l) return 0;
  if (P.ended) return total();
  if (P.audio) {
    const c = P.chunks[P.ci];
    if (c) return P.lines[c.from].start + P.audio.currentTime / (P.audio.playbackRate || 1);
  }
  // 아직 소리가 시작되지 않았으면 진행을 붙잡아 둔다.
  // 예전에는 말하기를 요청한 순간부터 시계를 돌려서,
  // 기기가 조용히 요청을 버려도 진행바만 혼자 흘러갔다.
  if (!P.speaking || !P.lineAt) return l.start;
  const held = P.paused ? P.heldFor : performance.now() - P.lineAt;
  return l.start + Math.min(held / 1000, l.dur);
}

function paint() {
  const dur = total(), cur = Math.min(elapsed(), dur);
  const pct = dur ? (cur / dur) * 100 : 0;
  if (!els.track.classList.contains('drag')) els.fill.style.width = pct + '%';
  els.miniRing.style.strokeDashoffset = (110 * (1 - pct / 100)).toFixed(1);
  if (!els.track.classList.contains('drag')) els.tCur.textContent = fmt(cur);
  /* 듣는 동안에는 '얼마나 남았나'가 궁금하고, 멈춰 있을 때는 '얼마나 긴가'가 궁금하다.
     일시정지마다 값이 뒤바뀌면 어지러우니 한 번 재생이 시작되면 끝날 때까지 남은 시간을 둔다. */
  const live = P.playing && !P.ended;
  els.tDur.textContent = !dur ? '--:--'          // 아직 길이를 모른다
    : live ? '-' + fmt(Math.max(0, dur - cur)) : fmt(dur);

  const busy = (state.streaming && !P.lines.length) || P.waiting;   // 대본·목소리를 만드는 중
  const on = P.playing && !P.paused;
  const replay = P.ended && !on;
  // <svg> 는 HTML 요소가 아니라 .hidden 프로퍼티가 없다.
  // 속성을 직접 넣고 빼야 실제로 숨겨지고 드러난다.
  showIcon(els.icoWait, busy);
  showIcon(els.icoReplay, !busy && replay);
  showIcon(els.icoPlay, !busy && !on && !replay);
  showIcon(els.icoPause, !busy && on);
  els.play.setAttribute('aria-label', on ? '일시정지' : replay ? '처음부터 다시' : '재생');
  els.miniPlay.innerHTML = busy ? ICO.spin : (on ? ICO.pause : (P.ended ? ICO.replay : ICO.play));

  els.lower.classList.toggle('loading', busy);
  els.status.classList.toggle('mute', on);
  showIcon(els.miniEq, on && !state.image);
  els.prev.disabled = P.idx <= 0;
  els.next.disabled = P.idx < 0 || P.idx >= P.lines.length - 1;
  els.again.disabled = state.streaming;

  if (P.waiting) els.status.textContent = P.ci ? '다음 대목을 준비하는 중' : '목소리를 만드는 중';
  else if (busy) els.status.textContent = '이야기를 쓰는 중';
  else if (on) els.status.textContent = '지금 재생 중';
  else if (P.paused) els.status.textContent = '일시정지';
  else if (P.lines.length) els.status.textContent = P.ended ? '해설이 끝났어요' : '지금 이 자리';
}

function highlight() {
  P.lines.forEach((l, i) => l.el.classList.toggle('on', i === P.idx));
  const cur = P.lines[P.idx];
  if (!cur) return;
  els.peekLine.textContent = cur.text;
  els.miniSub.textContent = cur.text;
  if (state.scriptOpen && Date.now() > state.followT)
    cur.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/* 상태가 어디서 바뀌든 아이콘이 늘 따라오도록 항상 그린다.
   재생 중에만 그리면, 다른 경로로 멈췄을 때 아이콘이 옛 상태로 남는다. */
setInterval(paint, 250);

// 직접 스크롤하면 4초간 자동 따라가기를 멈춘다
els.transcript.addEventListener('touchstart', () => { state.followT = Date.now() + 4000; }, { passive: true });
els.transcript.addEventListener('wheel', () => { state.followT = Date.now() + 4000; }, { passive: true });

/* ── 문장 나누기 ─────────────────────────────────────────── */
const ENDERS = '.!?…';
const CLOSERS = '”"\'’)』」》]';

function drainSentences(buf) {
  const out = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === '\n') {
      const s = buf.slice(start, i).trim();
      if (s) out.push(s);
      start = i + 1;
      continue;
    }
    if (ENDERS.includes(c)) {
      let j = i + 1;
      while (j < buf.length && CLOSERS.includes(buf[j])) j++;
      if (j >= buf.length) break;
      if (/\s/.test(buf[j])) {
        const s = buf.slice(start, j).trim();
        if (s) out.push(s);
        start = j;
      }
    }
  }
  return { sentences: out, rest: buf.slice(start) };
}

function addLine(text) {
  const el = document.createElement('button');
  el.className = 'sent';
  el.textContent = text;
  const i = P.lines.length;
  el.onclick = () => { playFrom(i); };
  els.transcript.appendChild(el);
  P.lines.push({ text, el, dur: 0, start: 0, offset: 0 });
  relayout(prefs.engine === 'google');
  if (prefs.engine === 'google') buildChunks();
  if (P.idx < 0) P.idx = 0;
  if (useGoogle()) {
    if (P.playing && !P.paused && P.pendingNext != null && P.chunks[P.pendingNext]) {
      const n = P.pendingNext; P.pendingNext = null; playChunk(n);
    } else if (P.playing && !P.speaking && !P.paused && !P.chunks.some(c => c.locked)) {
      speakCurrent();
    }
  } else if (P.playing && !P.speaking && !P.paused) speakCurrent();

  paint();
}

/* ── 해설 받아오기 ───────────────────────────────────────── */
async function narrate({ again = false } = {}) {
  if (state.streaming) return;
  const manual = (state.manual || '').trim();
  if (!manual && !state.pos) {
    notify('어디를 들려드릴지 먼저 골라 주세요.');
    goto('search');
    return;
  }

  unlockAudio();
  stopAll();
  state.streaming = true;
  state.resolved = '';
  state.fallback = false;   // 이번엔 다시 구글 목소리로 시도한다
  P.lines = []; P.idx = -1; P.chunks = []; P.ci = 0; P.pendingNext = null;
  els.transcript.innerHTML = '';
  els.peekLine.textContent = '이 자리의 이야기를 쓰고 있어요…';
  els.addr.textContent = '';
  P.playing = true;                 // 첫 문장이 도착하면 바로 읽기 시작
  paint();

  if (state.pos) state.narratedAt = { ...state.pos };

  const body = {
    lat: state.pos?.lat, lon: state.pos?.lon,
    place: state.place, address: state.address,
    manual, again, length: prefs.length, heard: state.heard,
  };

  let buf = '', got = false;
  try {
    const data = await wiki.gather({ lat: body.lat, lon: body.lon, manual });

    if (!data.sources.length) {
      showError('이 근처에서 위키백과 문서를 찾지 못했어요. '
              + '검색에서 장소를 직접 적거나, 조금 이동한 뒤 다시 눌러보세요.');
      return;
    }

    onResolvedPlace({ place: data.place, nearby: data.nearby.slice(0, 3),
                      image: data.image, provider: provider() });

    // 사진은 기다리지 않고 따로 채운다
    const titles = data.sources.map(x => x.title);
    photos.collect(data.place, titles.length ? titles : [data.place], data.image)
      .then(shots => { if (shots.length) setPhotos(shots); })
      .catch(() => {});

    const len = state.mode === 'summary' ? 'short' : prefs.length;
    for await (const text of llm.stream(data, { length: len, heard: state.heard, again })) {
      got = true;
      buf += text;
      const { sentences, rest } = drainSentences(buf);
      buf = rest;
      sentences.forEach(addLine);
    }

    if (buf.trim()) addLine(buf.trim());
    if (got) remember(state.resolved || state.place || manual);
  } catch (e) {
    showError('해설을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    console.error(e);
  } finally {
    state.streaming = false;
    if (!P.speaking) advance();
    paint();
  }
}

function onResolvedPlace(d) {
  state.resolved = d.place || '';
  if (state.resolved) {
    els.name.textContent = state.resolved;
    els.miniTitle.textContent = state.resolved;
    els.scriptPlace.textContent = state.resolved;
  }
  if (d.provider) setChip(d.provider);
  setArt(d.image || '');
}

function setChip(p) {
  els.chip.textContent =
    { claude: 'Claude 해설', gemini: 'AI 도슨트', wiki: '위키백과 낭독' }[p] || '여행 도슨트';
}

const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 21.5s7.2-5.7 7.2-11.4a7.2 7.2 0 1 0-14.4 0c0 5.7 7.2 11.4 7.2 11.4Z"/><circle cx="12" cy="10" r="2.4"/></svg>';

function setArt(url) {
  state.image = url;
  els.miniImg.hidden = !url;
  if (url) els.miniImg.src = url;
  setPhotos(url ? [{ url }] : []);
}

/* 사진 캐러셀 — 좌우로 넘기면 배경색도 그 사진의 색으로 바뀐다 */
function setPhotos(shots) {
  state.shots = shots || [];
  if (!state.shots.length) {
    els.rail.innerHTML = `<div class="slide blank">${PIN}</div>`;
    els.dots.innerHTML = '';
    return;
  }
  els.rail.innerHTML = state.shots.map(s =>
    `<div class="slide"><img src="${s.url}" alt="" crossorigin="anonymous" loading="lazy"></div>`).join('');
  els.dots.innerHTML = state.shots.length > 1
    ? state.shots.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('') : '';
  els.rail.scrollLeft = 0;
  state.slide = 0;
  applyArtColor(state.shots[0].url);
}

// 위키미디어 파일명은 한자·로마자인 경우가 많다. 읽을 수 없으면 위치만 알려준다.
const HANGUL = /[가-힣]/;
function caption(title, i) {
  const t = (title || '').replace(/[-_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return (t && HANGUL.test(t)) ? t : `사진 ${i + 1} / ${state.shots.length}`;
}

function onRailScroll() {
  if (!state.shots.length) return;
  const i = Math.round(els.rail.scrollLeft / els.rail.clientWidth);
  if (i === state.slide || !state.shots[i]) return;
  state.slide = i;
  [...els.dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  applyArtColor(state.shots[i].url);
  const sh = state.shots[i];
  els.addr.textContent = sh.credit && sh.credit.startsWith('Pexels')
    ? sh.credit : caption(sh.title, i);
}
els.rail.addEventListener('scroll', () => {
  clearTimeout(state.railT);
  state.railT = setTimeout(onRailScroll, 90);
}, { passive: true });

/* 플레이어 화면에서도 보이도록 — 해설 탭에만 있으면 아무도 못 본다 */
function notify(msg) {
  els.peekLine.textContent = msg;
  els.status.textContent = msg.slice(0, 24);
  clearTimeout(state.noticeT);
  state.noticeT = setTimeout(() => paint(), 6000);
}

function showError(msg) {
  notify(msg);
  const el = document.createElement('div');
  el.className = 'err';
  el.textContent = msg;
  els.transcript.appendChild(el);
}

/* ── 지나온 길 ───────────────────────────────────────────── */
function remember(place) {
  if (!place) return;
  if (state.heard.at(-1) === place) return;
  state.heard.push(place);
  state.heard = state.heard.slice(-40);
  localStorage.setItem('heard', JSON.stringify(state.heard));
  renderLog();
}

function renderLog() {
  const list = state.heard.slice().reverse();
  const empty = !list.length;
  els.logEmpty.classList.toggle('hidden', !empty);
  $('clearLog').classList.toggle('hidden', empty);
  els.logList.innerHTML = list.map((_, i) => `
    <li><span class="n">${String(list.length - i).padStart(2, '0')}</span>
        <span class="t"></span>
        <button class="go" aria-label="다시 듣기">${ICO.play}</button></li>`).join('');
  [...els.logList.children].forEach((li, i) => {
    li.querySelector('.t').textContent = list[i];
    li.querySelector('.go').onclick = () => {
      goto('player');
      narrate();
    };
  });
}
renderLog();

/* ── 위치 ────────────────────────────────────────────────── */
function metersBetween(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

let geocoding = false;
async function refreshPlace() {
  if (geocoding) return;
  geocoding = true;
  try {
    const { lat, lon } = state.pos;
    const d = await geo.reverse(lat, lon);
    state.place = d.place || '';
    state.address = d.address || '';
    state.geocodedAt = { lat, lon };
    // 해설 대상이 이미 정해졌으면 GPS 지명이 제목을 덮지 않는다
    if (!state.resolved && !P.lines.length && !state.streaming) {
      els.name.textContent = state.place || '이름 없는 자리';
      els.addr.textContent = state.address;
      els.status.textContent = '지금 계신 곳';
      els.miniTitle.textContent = state.place || '여행 도슨트';
    }
  } catch (_) {
    els.status.textContent = '지명을 불러오지 못했어요';
  } finally {
    geocoding = false;
  }
}

function onPosition(p) {
  const next = { lat: p.coords.latitude, lon: p.coords.longitude };
  const moved = metersBetween(state.geocodedAt, next);
  state.pos = next;
  if (moved > 25) refreshPlace();
  if (prefs.auto && !state.streaming &&
      metersBetween(state.narratedAt, next) > 70) narrate();
}

function onPositionError(err) {
  els.status.textContent = {
    1: '위치 권한이 꺼져 있어요', 2: '위치를 확인할 수 없어요', 3: '위치 확인이 오래 걸려요',
  }[err.code] || '위치 오류';
  els.name.textContent = '어디를 들어볼까요';
  els.addr.textContent = '검색 탭에서 장소를 찾아보세요';
}

if (!window.isSecureContext) {
  els.status.textContent = 'HTTPS가 아니어서 GPS를 쓸 수 없어요';
  els.name.textContent = '어디를 들어볼까요';
  els.addr.textContent = '검색 탭에서 장소를 찾아보세요';
} else if (navigator.geolocation) {
  navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true, maximumAge: 5000, timeout: 20000,
  });
} else {
  els.status.textContent = '이 브라우저는 위치를 지원하지 않아요';
}

/* ── 홈 · 검색 ────────────────────────────────────────────
   추천 목록은 한국의 대표 문화재로 고정해 두고,
   표지 사진과 한 줄 소개만 위키백과에서 그때그때 받아온다. */
const PICKS = [
  '경주 불국사', '경주 첨성대', '수원 화성', '창덕궁', '종묘',
  '해인사', '경주 석굴암', '안동 하회마을', '남한산성', '병산서원',
  '부석사', '공산성',
];
const MONTH = new Date().getMonth() + 1;
const previewCache = new Map();

function preview(place) {
  if (previewCache.has(place)) return previewCache.get(place);
  const job = (async () => {
    try {
      const titles = await wiki.search(place, 1);
      const title = titles[0] || place;
      const [image, ex] = await Promise.all([
        wiki.pageImage(title, 900),
        wiki.extracts([title], true, 160),
      ]);
      return { place: title, image,
               summary: wiki.forSpeech(ex[title] || '').slice(0, 110) };
    } catch (_) { return { place, image: '', summary: '' }; }
  })();
  previewCache.set(place, job);
  return job;
}

const PIN_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const GO = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 5.6c0-.72.78-1.16 1.39-.78l8.2 5.18a.92.92 0 0 1 0 1.56l-8.2 5.2c-.61.38-1.39-.06-1.39-.78V5.6Z"/></svg>';

function cardHTML(place, sub) {
  return `<button class="card" data-place="${place}">
    <span class="thumb">${PIN_SM}</span>
    <span class="meta"><b>${place}</b><em>${sub || '해설을 준비할 수 있어요'}</em></span>
    <span class="go">${GO}</span></button>`;
}

function fillCards(host, places, subs) {
  host.innerHTML = places.map((p, i) => cardHTML(p, subs && subs[i])).join('');
  // 앞쪽 두어 개는 미리 받아둔다. 누르는 순간 기다림이 없다.
  places.slice(0, 2).forEach(p => wiki.gather({ manual: p }).catch(() => {}));
  [...host.children].forEach(btn => {
    const name = btn.dataset.place;
    btn.onclick = () => playPlace(name);
    preview(name).then(d => {
      if (d.image) btn.querySelector('.thumb').innerHTML = `<img src="${d.image}" alt="">`;
      if (d.summary) btn.querySelector('em').textContent = d.summary;
    });
  });
}

/* 카드나 검색에서 고른 장소를 바로 재생 */
function playPlace(name) {
  state.manual = name;
  els.name.textContent = name;
  els.addr.textContent = '';
  goto('player');
  narrate();
}

/* ── 배너 캐러셀 ──────────────────────────────────────────
   8장을 국내·해외 번갈아. 3초에 걸쳐 부드럽게 넘어가고,
   손을 대면 멈췄다가 손을 떼면 다시 돈다. */
const SLIDE_MS = 2000;      // 저절로 넘어갈 때 (부드럽게)
const SWIPE_MS = 320;       // 손으로 넘길 때 (곧바로 따라오게)
const HOLD_MS = 3000;       // 머무는 시간
const hero = { i: 0, timer: null, w: 0, dragging: false, x0: 0, dx: 0 };

async function bannerImage(b) {
  const shots = await photos.pexels(b.query, 1);
  if (shots.length) return { url: shots[0].url, credit: shots[0].credit };
  const d = await preview(b.place);          // Pexels 키가 없으면 위키 사진으로
  return { url: d.image, credit: '위키백과' };
}

function buildHero() {
  const slides = BANNERS.concat([BANNERS[0]]);   // 끝에 첫 장을 덧붙여 이어지게
  els.heroTrack.innerHTML = slides.map((b, i) => `
    <div class="hslide" data-place="${b.place}">
      <img alt="" loading="${i < 2 ? 'eager' : 'lazy'}">
      <span class="hveil"></span>
      <span class="htxt"><span class="htag">${b.tag}</span><strong>${b.lead}, ${b.place}</strong></span>
    </div>`).join('');
  els.heroDots.innerHTML = BANNERS.map((_, i) =>
    `<i class="${i ? '' : 'on'}"></i>`).join('');

  [...els.heroTrack.children].forEach((el, i) => {
    el.onclick = () => { if (Math.abs(hero.dx) < 8) playPlace(el.dataset.place); };
    bannerImage(BANNERS[i % BANNERS.length]).then(d => {
      if (d.url) el.querySelector('img').src = d.url;
    }).catch(() => {});
  });

  measureHero();
  place(0, false);
  startHero();
}

const measureHero = () => { hero.w = els.heroWrap.clientWidth; };
addEventListener('resize', () => { measureHero(); place(hero.i, false); });

function place(i, animate = true, ms = SLIDE_MS) {
  hero.i = i;
  els.heroTrack.style.transition = animate
    ? `transform ${ms}ms cubic-bezier(.22,.61,.36,1)` : 'none';
  els.heroTrack.style.transform = `translate3d(${-i * hero.w}px,0,0)`;
  const real = i % BANNERS.length;
  [...els.heroDots.children].forEach((d, k) => d.classList.toggle('on', k === real));
  [...els.heroTrack.children].forEach((el, k) => el.classList.toggle('on', k === i));
}

function nextHero() {
  place(hero.i + 1);
  if (hero.i >= BANNERS.length) {              // 덧붙인 장에 닿으면 조용히 처음으로
    setTimeout(() => place(0, false), SLIDE_MS + 40);
  }
}
function startHero() {
  clearInterval(hero.timer);
  hero.timer = setInterval(nextHero, SLIDE_MS + HOLD_MS);
}
const stopHero = () => clearInterval(hero.timer);

/* 손으로 넘기기 */
function heroDrag() {
  const wrap = els.heroWrap;
  wrap.addEventListener('pointerdown', e => {
    hero.dragging = true; hero.x0 = e.clientX; hero.dx = 0;
    stopHero();
    els.heroTrack.style.transition = 'none';
  });
  wrap.addEventListener('pointermove', e => {
    if (!hero.dragging) return;
    hero.dx = e.clientX - hero.x0;
    els.heroTrack.style.transform = `translate3d(${-hero.i * hero.w + hero.dx}px,0,0)`;
  }, { passive: true });
  const end = () => {
    if (!hero.dragging) return;
    hero.dragging = false;
    let i = hero.i;
    const th = Math.min(60, hero.w * 0.12);      // 화면의 12%만 밀어도 넘어간다
    if (hero.dx < -th) i++;
    else if (hero.dx > th) i--;
    if (i < 0) { place(BANNERS.length, false); i = BANNERS.length - 1; }
    place(i, true, SWIPE_MS);
    if (i >= BANNERS.length) setTimeout(() => place(0, false), SWIPE_MS + 40);
    setTimeout(startHero, 1200);
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  wrap.addEventListener('pointerleave', end);
}

/* ── 지역 랜드마크 ───────────────────────────────────────── */
function buildRegion(data, chipHost, listHost) {
  const keys = Object.keys(data);
  chipHost.innerHTML = keys.map((k, i) =>
    `<button class="rchip${i ? '' : ' on'}" data-k="${k}">${k}</button>`).join('');
  const show = k => {
    [...chipHost.children].forEach(c => c.classList.toggle('on', c.dataset.k === k));
    fillCards(listHost, data[k].slice(0, 5));
  };
  chipHost.onclick = e => {
    const c = e.target.closest('.rchip');
    if (!c) return;
    show(c.dataset.k);
    c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  };
  show(keys[0]);
}

let homeReady = false;
function renderHome() {
  if (homeReady) return;
  homeReady = true;

  
  buildHero();
  heroDrag();
  wiki.gather({ manual: BANNERS[new Date().getDate() % BANNERS.length].place }).catch(() => {});
  fillCards(els.pickList, PICKS.slice(0, 5));
  buildRegion(KR, els.krChips, els.krList);
  buildRegion(WW, els.wwChips, els.wwList);

  els.toTop.onclick = () =>
    $('view-home').scrollTo({ top: 0, behavior: 'smooth' });
}

let searchReady = false;
function renderSearch() {
  if (!searchReady) {
    searchReady = true;
    fillCards(els.sugList, PICKS.slice(0, 6));
  }
  if (state.pos && !els.nearList.children.length) {
    wiki.nearby(state.pos.lat, state.pos.lon, 3000, 12).then(list => {
      const near = list.slice(0, 6);
      if (!near.length) return;
      els.nearShelf.classList.remove('hidden');
      fillCards(els.nearList, near.map(x => x.title),
                near.map(x => `여기서 약 ${x.dist}m`));
    }).catch(() => {});
  }
}

els.searchForm.onsubmit = e => {
  e.preventDefault();
  const q = els.searchInput.value.trim();
  if (!q) return;
  els.searchInput.blur();
  playPlace(q);
};

/* ── 요약 / 전체 ──────────────────────────────────────────
   같은 자리를 짧게도, 길게도 들을 수 있게. */
function applyMode() {
  [...els.modes.querySelectorAll('.mode')].forEach(b =>
    b.classList.toggle('on', b.dataset.mode === state.mode));
}

els.modes.onclick = e => {
  const b = e.target.closest('.mode');
  if (!b || b.dataset.mode === state.mode) return;
  state.mode = b.dataset.mode;
  applyMode();
  if (state.manual || state.pos) narrate();   // 고른 길이로 다시 들려준다
};

/* ── 사진 크게 보기 ──────────────────────────────────────
   플레이어의 사진을 누르면 전체 화면으로 열린다.
   당근 미리보기와 같은 조작: 핀치·더블탭으로 확대, 좌우로 넘기기,
   아래로 쓸어내리면 사진이 손끝을 따라오다가 놓으면 닫힌다. */
const vw = {
  s: 1, x: 0, y: 0,            // 지금 배율과 위치
  s0: 1, x0: 0, y0: 0,         // 손을 댄 순간의 값
  bw: 0, bh: 0,                // 확대 전 사진이 차지하던 크기
  i: 0, mode: '', d0: 0, mx: 0, my: 0,
  px: 0, py: 0, t0: 0, lastTap: 0, tapX: 0, tapY: 0,
  pts: new Map(),
};

function vwDraw(anim) {
  els.viewerImg.classList.toggle('snap', !!anim);
  els.viewerImg.style.transform =
    `translate3d(${vw.x}px,${vw.y}px,0) scale(${vw.s})`;
}

/* 확대한 사진이 화면 밖으로 빠져나가지 않게 붙든다 */
function vwClamp() {
  const mx = Math.max(0, (vw.bw * vw.s - innerWidth) / 2);
  const my = Math.max(0, (vw.bh * vw.s - innerHeight) / 2);
  vw.x = Math.min(mx, Math.max(-mx, vw.x));
  vw.y = Math.min(my, Math.max(-my, vw.y));
}

function vwReset(anim) {
  vw.s = 1; vw.x = 0; vw.y = 0;
  els.viewerBg.style.opacity = '1';
  vwDraw(anim);
}

/* 확대 전 사진 크기를 재둔다. 경계 계산의 기준이 된다. */
function vwMeasure() {
  const im = els.viewerImg;
  if (!im.naturalWidth) return;
  const k = Math.min(innerWidth / im.naturalWidth, innerHeight / im.naturalHeight, 1);
  vw.bw = im.naturalWidth * k;
  vw.bh = im.naturalHeight * k;
}

function vwShow(i, dir) {
  const shot = state.shots[i];
  if (!shot) return;
  vw.i = i;
  const im = els.viewerImg;
  if (dir) {                                   // 넘기는 방향으로 살짝 밀어 넣는다
    im.classList.remove('snap');
    im.style.opacity = '0';
    im.style.transform = `translate3d(${dir * 40}px,0,0) scale(1)`;
  }
  im.src = shot.url;
  const done = () => {
    vwMeasure();
    vw.s = 1; vw.x = 0; vw.y = 0;
    im.classList.add('snap');
    im.style.opacity = '1';
    vwDraw(true);
  };
  im.complete && im.naturalWidth ? done() : (im.onload = done);

  els.viewerCap.textContent = shot.credit && shot.credit.startsWith('Pexels')
    ? shot.credit : (shot.title || '');
  els.viewerCount.textContent =
    state.shots.length > 1 ? `${i + 1} / ${state.shots.length}` : '';
}

function openViewer(i) {
  if (!state.shots.length) return;
  els.viewer.classList.remove('hidden', 'closing');
  els.viewerBg.style.opacity = '1';
  vwShow(typeof i === 'number' ? i : state.slide, 0);
  document.addEventListener('keydown', vwKey);
}

function closeViewer() {
  document.removeEventListener('keydown', vwKey);
  els.viewer.classList.add('closing');
  setTimeout(() => {
    els.viewer.classList.add('hidden');
    els.viewer.classList.remove('closing');
    vwReset(false);
    els.viewerImg.removeAttribute('src');
  }, 200);
}

function vwKey(e) {
  if (e.key === 'Escape') closeViewer();
  else if (e.key === 'ArrowRight') vwGo(1);
  else if (e.key === 'ArrowLeft') vwGo(-1);
}

function vwGo(step) {
  const n = vw.i + step;
  if (n < 0 || n >= state.shots.length) { vwReset(true); return; }
  vwShow(n, step);
  // 플레이어의 캐러셀도 같은 자리로 옮겨 둔다
  els.rail.scrollLeft = n * els.rail.clientWidth;
}

els.viewerClose.onclick = closeViewer;

/* 플레이어의 사진을 누르면 열린다. 넘기는 동작과 구분한다. */
(() => {
  const stage = document.querySelector('.stage');
  if (!stage) return;
  let sx = 0, sy = 0, st = 0;
  stage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; st = Date.now(); });
  stage.addEventListener('pointerup', e => {
    const moved = Math.hypot(e.clientX - sx, e.clientY - sy);
    if (moved < 10 && Date.now() - st < 400) openViewer(state.slide);
  });
})();

(() => {
  const st = els.viewerStage;
  const two = () => {
    const p = [...vw.pts.values()];
    return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2,
             d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) };
  };

  /* 어느 점을 기준으로 확대할지 — 그 점이 화면에서 제자리에 머물게 한다 */
  function zoomAt(ns, cx, cy) {
    const k = ns / vw.s;
    vw.x = cx - (cx - vw.x) * k;
    vw.y = cy - (cy - vw.y) * k;
    vw.s = ns;
    vwClamp();
  }

  st.addEventListener('pointerdown', e => {
    st.setPointerCapture(e.pointerId);
    vw.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    els.viewerImg.classList.remove('snap');
    if (vw.pts.size === 2) {
      const m = two();
      vw.mode = 'pinch'; vw.d0 = m.d; vw.mx = m.x; vw.my = m.y;
      vw.s0 = vw.s; vw.x0 = vw.x; vw.y0 = vw.y;
    } else {
      vw.mode = 'down';
      vw.px = e.clientX; vw.py = e.clientY;
      vw.x0 = vw.x; vw.y0 = vw.y; vw.t0 = Date.now();
    }
  });

  st.addEventListener('pointermove', e => {
    if (!vw.pts.has(e.pointerId)) return;
    vw.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (vw.mode === 'pinch' && vw.pts.size === 2) {
      const m = two();
      const ns = Math.min(6, Math.max(1, vw.s0 * (m.d / vw.d0)));
      const k = ns / vw.s0;
      vw.x = vw.mx - (vw.mx - vw.x0) * k;
      vw.y = vw.my - (vw.my - vw.y0) * k;
      vw.s = ns;
      vwClamp(); vwDraw(false);
      return;
    }
    if (vw.pts.size !== 1) return;

    const dx = e.clientX - vw.px, dy = e.clientY - vw.py;

    if (vw.s > 1.02) {                       // 확대 상태 — 사진을 끈다
      vw.mode = 'pan';
      vw.x = vw.x0 + dx; vw.y = vw.y0 + dy;
      vwClamp(); vwDraw(false);
      return;
    }
    // 원래 크기 — 첫 방향으로 좌우 넘기기인지 아래로 닫기인지 정한다
    if (vw.mode === 'down' && Math.hypot(dx, dy) > 10)
      vw.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'dismiss';

    if (vw.mode === 'swipe') {
      vw.x = dx * 0.9; vw.y = 0; vwDraw(false);
    } else if (vw.mode === 'dismiss') {
      vw.x = dx * 0.5; vw.y = dy;
      // 손을 따라 조금씩 작아지고 배경이 옅어진다
      vw.s = Math.max(0.75, 1 - Math.abs(dy) / (innerHeight * 1.6));
      els.viewerBg.style.opacity = String(Math.max(0.25, 1 - Math.abs(dy) / (innerHeight * 0.7)));
      vwDraw(false);
    }
  });

  const up = e => {
    vw.pts.delete(e.pointerId);
    if (vw.pts.size) {                       // 핀치 중 한 손가락만 뗐다
      const p = [...vw.pts.values()][0];
      vw.mode = 'pan'; vw.px = p.x; vw.py = p.y; vw.x0 = vw.x; vw.y0 = vw.y;
      return;
    }

    const dt = Date.now() - vw.t0;
    const dx = vw.x - (vw.mode === 'swipe' ? 0 : vw.x0);

    if (vw.mode === 'dismiss') {
      const fast = Math.abs(vw.y) / Math.max(dt, 1) > 0.5;   // 빠르게 튕기면 조금만 내려도 닫는다
      if (vw.y > 110 || (fast && vw.y > 40)) { closeViewer(); return; }
      vwReset(true); vw.mode = ''; return;
    }
    if (vw.mode === 'swipe') {
      const th = Math.min(70, innerWidth * 0.18);
      if (dx < -th) vwGo(1);
      else if (dx > th) vwGo(-1);
      else vwReset(true);
      vw.mode = ''; return;
    }
    if (vw.mode === 'pinch' || vw.mode === 'pan') {
      if (vw.s <= 1.02) vwReset(true);
      else { vwClamp(); vwDraw(true); }
      vw.mode = ''; return;
    }

    // 움직이지 않았다면 탭 — 두 번 두드리면 그 자리를 확대한다
    if (vw.mode === 'down') {
      const now = Date.now();
      const near = Math.hypot(e.clientX - vw.tapX, e.clientY - vw.tapY) < 40;
      if (now - vw.lastTap < 300 && near) {
        if (vw.s > 1.02) vwReset(true);
        else { zoomAt(2.5, e.clientX - innerWidth / 2, e.clientY - innerHeight / 2); vwDraw(true); }
        vw.lastTap = 0;
      } else {
        vw.lastTap = now; vw.tapX = e.clientX; vw.tapY = e.clientY;
      }
    }
    vw.mode = '';
  };
  st.addEventListener('pointerup', up);
  st.addEventListener('pointercancel', up);

  /* 데스크톱 — 휠은 확대, 원래 크기에서 아래로 굴리면 닫는다 */
  st.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || vw.s > 1.02) {
      vwMeasure();
      const ns = Math.min(6, Math.max(1, vw.s * (1 - e.deltaY / 400)));
      zoomAt(ns, e.clientX - innerWidth / 2, e.clientY - innerHeight / 2);
      if (vw.s <= 1.02) vwReset(true); else vwDraw(false);
    } else if (e.deltaY > 24) closeViewer();
  }, { passive: false });

  addEventListener('resize', () => { if (!els.viewer.classList.contains('hidden')) { vwMeasure(); vwReset(false); } });
})();

/* ── 화면 전환 ────────────────────────────────────────────
   홈 · 검색 · 플레이어 · 히스토리 · 설정 */
const VIEWS = ['home', 'search', 'player', 'history', 'settings'];

function goto(view) {
  state.view = view;
  VIEWS.forEach(v => $('view-' + v).classList.toggle('hidden', v !== view));
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.view === view));
  els.mini.classList.toggle('hidden', view === 'player' || !P.lines.length);
  if (view === 'home') renderHome();
  if (view === 'search') renderSearch();
  if (view === 'settings') renderQuota();
  if (view === 'player') closeScript();
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => goto(b.dataset.view));
els.mini.onclick = e => { if (!e.target.closest('.ico')) goto('player'); };

/* 해설 패널 — 플레이어 안에서 열고 닫는다 */
function openScript() {
  els.scriptPanel.classList.remove('hidden');
  state.scriptOpen = true;
  if (P.lines[P.idx]) P.lines[P.idx].el.scrollIntoView({ block: 'center' });
}
function closeScript() {
  els.scriptPanel.classList.add('hidden');
  state.scriptOpen = false;
}
$('scriptClose').onclick = closeScript;

els.peek.onclick = openScript;


/* ── 조작 ────────────────────────────────────────────────── */
function togglePlay() {
  unlockAudio();
  if (state.streaming) return;
  if (!P.lines.length) { narrate(); return; }
  if (P.playing && !P.paused) {
    P.heldFor = performance.now() - P.lineAt;
    P.paused = true;
    if (P.audio) P.audio.pause(); else speechSynthesis.pause();
    paint();
  } else if (P.paused) {
    P.paused = false;
    P.lineAt = performance.now() - P.heldFor;
    if (P.audio) P.audio.play().catch(() => {}); else speechSynthesis.resume();
    paint();
  } else {
    playFrom(P.ended ? 0 : Math.max(0, P.idx));
  }
}
els.play.onclick = togglePlay;
els.miniPlay.onclick = e => { e.stopPropagation(); togglePlay(); };
els.prev.onclick = () => playFrom(P.idx - 1);
els.next.onclick = () => playFrom(P.idx + 1);
els.again.onclick = () => narrate({ again: true });
els.auto.onclick = () => {
  prefs.auto = !prefs.auto;
  els.auto.setAttribute('aria-pressed', String(prefs.auto));
  savePrefs();
};
els.auto.setAttribute('aria-pressed', String(!!prefs.auto));

/* 진행바 — 끌면 문장 단위로 붙는다 */
els.track.onpointerdown = e => {
  if (!P.lines.length) return;
  els.track.classList.add('drag');
  els.times.classList.add('show');
  els.track.setPointerCapture(e.pointerId);
  const at = ev => {
    const r = els.track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
  };
  const move = ev => {
    const f = at(ev);
    els.fill.style.width = f * 100 + '%';
    els.tCur.textContent = fmt(total() * f);
  };
  move(e);
  els.track.onpointermove = move;
  els.track.onpointerup = ev => {
    els.track.classList.remove('drag');
    setTimeout(() => els.times.classList.remove('show'), 900);
    els.track.onpointermove = els.track.onpointerup = null;
    const t = at(ev) * total();
    let i = P.lines.findIndex(l => t < l.start + l.dur);
    playFrom(i < 0 ? P.lines.length - 1 : i);
  };
};

/* ── 설정 ────────────────────────────────────────────────── */
/* 음성 선택 아코디언 */
els.accHead.onclick = () => {
  const open = els.accHead.getAttribute('aria-expanded') === 'true';
  els.accHead.setAttribute('aria-expanded', String(!open));
  els.accBody.classList.toggle('hidden', open);
};
$('goSearch').onclick = () => goto('search');

$('clearLog').onclick = () => {
  state.heard = []; localStorage.removeItem('heard'); renderLog();
};

els.lengthSeg.onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  prefs.length = b.dataset.v;
  [...els.lengthSeg.children].forEach(x => x.classList.toggle('on', x === b));
  savePrefs();
};

const SAMPLE = '여러분, 지금 여러분이 서 계신 곳은 첨성대입니다. '
             + '천삼백 년 전에 쌓아 올린 돌탑이에요. 놀랍지 않나요?';

async function previewGoogle() {
  killAudio();
  P.seq++;
  els.status.textContent = '목소리를 만드는 중';
  try {
    const got = await fetchAudio(SAMPLE);
    const a = new Audio(got.url);
    a.playbackRate = +els.rateSel.value || 1;
    a.play().catch(() => {});
  } catch (e) {
    if (e.message === 'QUOTA') markQuota();
  }
  paint();
}

function previewVoice() {
  unlockAudio();
  if (P.playing && P.lines.length) { playFrom(P.idx); return; }  // 듣는 중이면 끊지 않는다
  if (prefs.engine === 'google' && tts.available()) return previewGoogle();
  speechSynthesis.cancel();
  P.seq++;
  const u = new SpeechSynthesisUtterance(SAMPLE);
  u.lang = 'ko-KR';
  u.rate = +els.rateSel.value;
  u.pitch = +els.pitchSel.value;
  const v = P.voices.find(x => x.name === els.voiceSel.value);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
els.preview.onclick = previewVoice;

/* ── 목소리 종류 전환 ────────────────────────────────────── */
const openKeyBox = () => openApiSheet();

function renderGVoices() {
  if (!gvoices.length) {
    els.gvoiceList.innerHTML =
      '<p class="empty">AI 키를 넣으면 여덟 가지 구글 목소리를 고를 수 있어요.</p>';
    return;
  }
  // 왼쪽 동그라미로 고르고, 오른쪽 버튼으로 들어본다
  els.gvoiceList.innerHTML = gvoices.map(v => `
    <div class="vrow pick${v.id === prefs.gvoice ? ' on' : ''}" data-v="${v.id}"
         role="radio" aria-checked="${v.id === prefs.gvoice}" tabindex="0">
      <span class="vcheck" aria-hidden="true"><i></i></span>
      <span class="vtext"><b>${v.label}</b><em>${v.desc}</em></span>
      <button class="vplay" data-v="${v.id}" aria-label="${v.label} 들어보기">${ICO_PLAY_SM}</button>
    </div>`).join('');
}

/* 목록에서 미리듣기 — 누르면 재생, 다시 누르면 멈춤 */
let previewLoading = '';

function markVoiceButtons() {
  [...els.gvoiceList.querySelectorAll('.vplay')].forEach(b => {
    const id = b.dataset.v;
    const loading = id === previewLoading;
    const playing = !loading && id === previewOf && !previewEl.paused;
    b.innerHTML = loading ? ICO_SPIN_SM : playing ? ICO_PAUSE_SM : ICO_PLAY_SM;
    b.classList.toggle('playing', playing || loading);
  });
  [...els.gvoiceList.querySelectorAll('.vrow')].forEach(r => {
    const on = r.dataset.v === prefs.gvoice;
    r.classList.toggle('on', on);
    r.setAttribute('aria-checked', String(on));
  });
}

function stopPreview() {
  previewEl.pause();
  previewOf = ''; previewLoading = '';
  markVoiceButtons();
}

async function playVoiceSample(id, alsoPick = true) {
  if (previewOf === id && !previewEl.paused) { stopPreview(); return; }
  stopPreview();
  unlockAudio();

  if (alsoPick) { prefs.gvoice = id; savePrefs(); }
  previewOf = id;
  previewLoading = id;            // 만드는 동안 스피너
  markVoiceButtons();

  try {
    const got = await tts.synth(SAMPLE, id, prefs.tone);
    previewLoading = '';
    if (previewOf !== id) { markVoiceButtons(); return; }
    previewEl.src = got.url;
    previewEl.playbackRate = +els.rateSel.value || 1;
    previewEl.onended = stopPreview;
    await previewEl.play();
  } catch (e) {
    previewOf = ''; previewLoading = '';
    if (e.message === 'QUOTA') markQuota();
  }
  markVoiceButtons();
}

function applyEngine() {
  const g = prefs.engine === 'google';
  [...els.engineSeg.children].forEach(b => b.classList.toggle('on', b.dataset.v === prefs.engine));
  els.deviceField.classList.toggle('hidden', g);
  els.googleField.classList.toggle('hidden', !g);
  els.pitchSel.parentElement.style.opacity = g ? .35 : 1;
  els.pitchSel.disabled = g;
}

els.engineSeg.onclick = e => {
  const b = e.target.closest('button');
  if (!b || b.dataset.v === prefs.engine) return;
  prefs.engine = b.dataset.v;
  savePrefs();
  applyEngine();
  stopAll(); paint();
  // 키가 없으면 어디에 넣는지 바로 열어 보여준다
  if (prefs.engine === 'google' && !gvoices.length) openKeyBox();
};

els.gvoiceList.onclick = e => {
  const play = e.target.closest('.vplay');
  if (play) { playVoiceSample(play.dataset.v, false); return; }   // 들어보기만
  const row = e.target.closest('.vrow');
  if (!row) return;
  prefs.gvoice = row.dataset.v;                                   // 이 보이스로 정한다
  savePrefs();
  markVoiceButtons();
};

(async () => {
  const d = { ok: tts.available(), voices: tts.VOICES };
  gvoices = d.ok ? d.voices : [];
  if (!gvoices.length && prefs.engine === 'google') prefs.engine = 'device';
  renderGVoices();
  applyEngine();
})();

els.toneList.onclick = e => {
  const b = e.target.closest('.vplay');
  if (!b) return;                 // 재생 버튼 밖은 반응하지 않는다
  prefs.tone = b.dataset.v;
  const t = TONES[prefs.tone];
  prefs.rate = t.rate; prefs.pitch = t.pitch;
  els.rateSel.value = t.rate; els.rateVal.textContent = t.rate.toFixed(2).replace(/0$/, '');
  els.pitchSel.value = t.pitch; els.pitchVal.textContent = t.pitch.toFixed(2).replace(/0$/, '');
  paintRange(els.rateSel); paintRange(els.pitchSel);
  markToneRows();
  relayout(); paint(); savePrefs();
  previewVoice();
};

els.rateSel.oninput = () => {
  paintRange(els.rateSel);
  prefs.rate = +els.rateSel.value;
  els.rateVal.textContent = prefs.rate.toFixed(2).replace(/0$/, '');
  relayout(); paint(); savePrefs();
};
els.pitchSel.oninput = () => {
  paintRange(els.pitchSel);
  prefs.pitch = +els.pitchSel.value;
  els.pitchVal.textContent = prefs.pitch.toFixed(2).replace(/0$/, '');
  savePrefs();
};
els.voiceSel.onchange = () => {
  prefs.voice = els.voiceSel.value;
  els.voiceNow.textContent = prefs.voice;
  savePrefs(); previewVoice();
};


/* ── API 키 ──────────────────────────────────────────────
   키는 이 기기의 localStorage 에만 있다. 코드에도 서버에도 없다. */
function refreshKeyState() {
  els.apiDot.classList.toggle('on', !!getKey('gemini'));
  setChip(provider());
}

function openApiSheet() {
  const k = getKeys();
  els.geminiKey.value = k.gemini || '';
  els.pexelsKey.value = k.pexels || '';
  els.apiSheet.classList.remove('hidden');
  els.apiInner.style.transform = '';
}

function closeApiSheet() {
  els.apiInner.style.transition = 'transform .22s ease';
  els.apiInner.style.transform = 'translateY(100%)';
  setTimeout(() => {
    els.apiSheet.classList.add('hidden');
    els.apiInner.style.transition = '';
    els.apiInner.style.transform = '';
  }, 220);
}

els.openApi.onclick = openApiSheet;
$('closeApi').onclick = closeApiSheet;
els.apiSheet.onclick = e => { if (e.target === els.apiSheet) closeApiSheet(); };

/* 손잡이를 쓸어내리면 닫힌다 */
(() => {
  let y0 = 0, dy = 0, on = false;
  const start = e => { on = true; dy = 0; y0 = e.clientY; els.apiInner.classList.add('drag'); };
  const move = e => {
    if (!on) return;
    dy = Math.max(0, e.clientY - y0);
    els.apiInner.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (!on) return;
    on = false;
    els.apiInner.classList.remove('drag');
    if (dy > 110) { closeApiSheet(); return; }
    els.apiInner.classList.add('snapback');
    els.apiInner.style.transform = '';
    setTimeout(() => els.apiInner.classList.remove('snapback'), 320);
  };
  els.apiHead.addEventListener('pointerdown', start);
  addEventListener('pointermove', move);
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
})();

els.saveKeys.onclick = () => {
  setKey('gemini', els.geminiKey.value);
  setKey('pexels', els.pexelsKey.value);
  refreshKeyState();
  gvoices = tts.available() ? tts.VOICES : [];
  if (!gvoices.length && prefs.engine === 'google') { prefs.engine = 'device'; savePrefs(); }
  renderGVoices();
  applyEngine();
  closeApiSheet();
};

/* ── 시작 ────────────────────────────────────────────────── */
els.rateSel.value = prefs.rate;
els.rateVal.textContent = (+prefs.rate).toFixed(2).replace(/0$/, '');
els.pitchSel.value = prefs.pitch;
els.pitchVal.textContent = (+prefs.pitch).toFixed(2).replace(/0$/, '');
paintRange(els.rateSel); paintRange(els.pitchSel);
[...els.lengthSeg.children].forEach(b => b.classList.toggle('on', b.dataset.v === prefs.length));
renderTones();
applyMode();
els.miniPlay.innerHTML = ICO.play;
setPhotos([]);          // 첫 화면에도 자리표시자를 둔다
goto('home');           // 처음 열면 홈부터
refreshKeyState();
paint();

/* ── 잠금화면 컨트롤 · 서비스워커 ────────────────────────
   주머니에 넣고 걷는 앱이라 잠금화면에서 조작이 돼야 한다.
   구글 목소리는 진짜 오디오라 화면을 꺼도 이어진다. */
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const place = state.resolved || state.place || '여행 도슨트';
  const art = state.image ? [{ src: state.image, sizes: '512x512', type: 'image/jpeg' }]
                          : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: place,
      artist: els.chip.textContent || '여행 도슨트',
      album: P.lines.length ? `${P.lines.length}문장` : '',
      artwork: art,
    });
    // 실제 오디오가 있을 때만 상태를 알린다.
    // 기기 음성합성은 미디어가 아니어서, playing 이라고 알리면
    // 브라우저가 "재생 중이 아닌데?" 하며 pause 를 되돌려 보낸다.
    navigator.mediaSession.playbackState = P.audio
      ? ((P.playing && !P.paused) ? 'playing' : 'paused')
      : 'none';
  } catch (_) {}
}

if ('mediaSession' in navigator) {
  const set = (k, fn) => { try { navigator.mediaSession.setActionHandler(k, fn); } catch (_) {} };
  // 잠금화면 조작은 진짜 오디오(구글 목소리)일 때만 받는다
  set('play', () => { if (P.audio && (!P.playing || P.paused)) togglePlay(); });
  set('pause', () => { if (P.audio && P.playing && !P.paused) togglePlay(); });
  set('previoustrack', () => { if (P.audio) playFrom(P.idx - 1); });
  set('nexttrack', () => { if (P.audio) playFrom(P.idx + 1); });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* 디버그용 — 콘솔에서 docent.P / docent.state */
window.docent = { P, state, prefs, buildChunks, playChunk, fetchAudio };
