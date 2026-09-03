import * as wiki from './lib/wiki.js';
import * as geo2 from './lib/geoindex.js';
import * as score from './lib/score.js';
import * as place from './lib/place.js';

import * as llm from './lib/llm.js';
import * as tts from './lib/tts.js';
import * as photos from './lib/photos.js';
import { KR, WW, BANNERS, KIDS, TOP_KR, TOP_WW, pickForDay } from './lib/places.js';
import * as geo from './lib/geo.js';
import { getKey, setKey, getKeys, provider } from './lib/keys.js';

window.__boot = [];
window.addEventListener('error', e => window.__boot.push(e.message + ' @' + e.lineno));

/* 여행 도슨트 — 플레이어
   해설 한 편이 한 곡, 문장 하나가 가사 한 줄이다.
   문장 단위로 이전·다음·탐색이 되고, 아트워크에서 뽑은 색이 화면 배경이 된다. */

/* 화면에 없는 요소를 찾으면 빈 자리를 대신 내준다.
   예전에는 여기서 null 이 나와 그 다음 줄에서 통째로 멈췄고,
   그러면 탭도 버튼도 아무것도 걸리지 않아 앱이 죽은 것처럼 보였다.
   (파일을 나눠 올리다 index.html 만 뒤처지면 실제로 그렇게 됐다.)
   단추 하나가 없다고 앱 전체가 멈추면 안 된다. */
const MISSING = new Set();
function $(id) {
  const el = document.getElementById(id);
  if (el) return el;
  if (!MISSING.has(id)) {
    MISSING.add(id);
    console.warn('[도슨트] 화면에 없는 요소:', id);
  }
  return document.createElement('span');   // 만지든 말든 아무 일도 없다
}
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
  resultShelf: $('resultShelf'), resultTitle: $('resultTitle'), resultHero: $('resultHero'),
  resultList: $('resultList'), resultEmpty: $('resultEmpty'),
  drillDown: $('drillDown'), drillUp: $('drillUp'),
  recentShelf: $('recentShelf'), recentList: $('recentList'),
  sugShelf: $('sugShelf'), typeahead: $('typeahead'), searchClear: $('searchClear'),
  resultCount: $('resultCount'), resultGroups: $('resultGroups'),
  aroundShelf: $('aroundShelf'), aroundList: $('aroundList'), aroundCount: $('aroundCount'),
  pickSeg: $('pickSeg'), homeSearch: $('homeSearch'),
  playedShelf: $('playedShelf'), playedList: $('playedList'), playedMore: $('playedMore'),
  kidSeg: $('kidSeg'), kidList: $('kidList'), searchBack: $('searchBack'),
  scThumb: $('scThumb'), scSub: $('scSub'), scPlay: $('scPlay'),
  scTrack: $('scTrack'), scFill: $('scFill'), scCur: $('scCur'), scDur: $('scDur'),
  downChips: $('downChips'), upChips: $('upChips'),
  logList: $('logList'), logEmpty: $('logEmpty'),
  mini: $('mini'), miniImg: $('miniImg'), miniEq: $('miniEq'),
  miniPlay: $('miniPlay'), miniRing: $('miniRing'),
  settings: $('settings'), lengthSeg: $('lengthSeg'), toneList: $('toneList'),
  voiceSel: $('voiceSel'), preview: $('previewVoice'), voiceHint: $('voiceHint'),
  engineSeg: $('engineSeg'), quotaNote: $('quotaNote'), quotaTxt: $('quotaTxt'),
  deviceField: $('deviceField'), googleField: $('googleField'), gvoiceList: $('gvoiceList'),
  rateSel: $('rateSel'), rateVal: $('rateVal'),
  pitchSel: $('pitchSel'), pitchVal: $('pitchVal'),
  openApi: $('openApi'), apiDot: $('apiDot'),
  apiSheet: $('apiSheet'), apiInner: $('apiInner'), apiHead: $('apiHead'),
  geminiKey: $('geminiKey'), pexelsKey: $('pexelsKey'), saveKeys: $('saveKeys'),
  azureKey: $('azureKey'), azureRegion: $('azureRegion'), elevenKey: $('elevenKey'),
  netVoiceLabel: $('netVoiceLabel'),
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
    `<b>구글 무료 한도에 걸렸어요.</b> 분당 횟수 제한이라 ` +
    `<b>${left}초</b> 뒤에 다시 됩니다. 그동안은 기기 목소리로 읽어드려요.`;
}
setInterval(() => { if (state.quotaAt) renderQuota(); }, 1000);

const inQuota = () => state.quotaAt && Date.now() - state.quotaAt < QUOTA_WAIT * 1000;
/* 한도에 걸린 동안에는 물어보지도 않는다.
   묶음마다 실패를 다시 겪으면 그때마다 재생이 끊긴다. */
const NET = ['google', 'azure', 'eleven'];
const isNet = e => NET.includes(e);
const useGoogle = () => isNet(prefs.engine) && !state.fallback
  && !inQuota() && tts.available(prefs.engine);

/* ── 상태 ────────────────────────────────────────────────── */
const state = {
  pos: null, place: '', address: '', image: '',
  geocodedAt: null, narratedAt: null,
  heard: JSON.parse(localStorage.getItem('heard') || '[]'),
  streaming: false, unlocked: false, resolved: '', view: 'player', scriptOpen: false,
  manual: '',   // 검색이나 카드로 고른 장소
  mode: 'full',  // full | summary
  fallback: false, quotaAt: +(localStorage.getItem('quota-at') || 0),
  prog: (() => { try { return JSON.parse(localStorage.getItem('prog') || '{}'); } catch (_) { return {}; } })(),
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

/* 엔진마다 목소리 이름 체계가 달라 따로 기억해야 한다.
   구글은 'sulafat', Azure 는 'ko-KR-SunHiNeural', Eleven 은 긴 아이디다. */
function voiceOf(engine = prefs.engine) {
  if (engine === 'google') return prefs.gvoice;
  return (prefs.netVoice || {})[engine] || '';
}
function setVoiceOf(id, engine = prefs.engine) {
  if (engine === 'google') { prefs.gvoice = id; return; }
  prefs.netVoice = { ...(prefs.netVoice || {}), [engine]: id };
}
function ttsKey(text) { return `${voiceOf()}|${prefs.tone}|${text}`; }

function fetchAudio(text) {
  return tts.synth(text, voiceOf(), prefs.tone, prefs.engine);
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
      els.status.textContent = ci ? '다음 이야기 준비 중' : '목소리 준비 중';
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
    notify('소리가 열리지 않았어요. 재생을 한 번 더 눌러 주세요.');
    P.speaking = false; P.playing = false; paint();
  });
  paint();
}

/* 구글 목소리가 막히면 조용히 멈추지 않고 기기 목소리로 이어 읽는다 */
function googleFailed(msg, fromLine) {
  if (msg === 'QUOTA') markQuota();
  notify(msg === 'QUOTA'
    ? '구글 한도에 걸렸어요. 기기 목소리로 이어 읽을게요.'
    : msg === 'SLOW'
      ? '구글 목소리가 너무 늦어요. 기기 목소리로 이어 읽을게요.'
      : '구글 목소리를 못 불렀어요. 기기 목소리로 이어 읽을게요.');
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
  els.miniRing.style.strokeDashoffset = (186 * (1 - pct / 100)).toFixed(1);  // 2πr(29.5) ≈ 186
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
  /* 해설 화면의 조작부도 같은 상태를 따라간다.
     같은 것을 두 군데서 그리게 되므로 한 곳에서 함께 갱신한다. */
  if (!$('scriptPanel').classList.contains('hidden')) {
    els.scPlay.innerHTML = busy ? ICO_SPIN_SM : on ? ICO_PAUSE_SM : ICO_PLAY_SM;
    els.scPlay.setAttribute('aria-label', on ? '일시정지' : '재생');
    els.scFill.style.width = pct + '%';
    els.scCur.textContent = fmt(cur);
    els.scDur.textContent = !dur ? '--:--'
      : (P.playing && !P.ended) ? '-' + fmt(Math.max(0, dur - cur)) : fmt(dur);
  }

  if (P.playing && dur) saveProgress(state.resolved || state.manual, cur / dur);

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

  if (P.waiting) els.status.textContent = P.ci ? '다음 이야기 준비 중' : '목소리 준비 중';
  else if (busy) els.status.textContent = '이야기 쓰는 중';
  else if (on) els.status.textContent = '재생 중';
  else if (P.paused) els.status.textContent = '일시정지';
  else if (P.lines.length) els.status.textContent = P.ended ? '다 들었어요' : '들을 준비 완료';
}

function highlight() {
  P.lines.forEach((l, i) => l.el.classList.toggle('on', i === P.idx));
  const cur = P.lines[P.idx];
  if (!cur) return;
  els.peekLine.textContent = cur.text;
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
  relayout(isNet(prefs.engine));
  if (isNet(prefs.engine)) buildChunks();
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
    notify('먼저 장소를 골라 주세요.');
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
  els.peekLine.textContent = '이야기를 쓰고 있어요…';
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
      showError('이 근처에서는 자료를 찾지 못했어요. '
              + '장소 이름으로 검색하거나, 조금 이동한 뒤 다시 눌러 보세요.');
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
    const here = standingHere(data);
    /* 아이와 함께에서 고른 곳이면 그 학년에 맞춘 말로 읽는다 */
    const tone = kidPlaces.has(state.manual)
      ? (KIDS[prefs.kidGrade || 'elementary'] || KIDS.elementary).tone : '';
    for await (const text of llm.stream(data, { length: len, heard: state.heard, again, here, tone })) {
      got = true;
      buf += text;
      const { sentences, rest } = drainSentences(buf);
      buf = rest;
      sentences.forEach(addLine);
    }

    if (buf.trim()) addLine(buf.trim());
    if (got) remember(state.resolved || state.place || manual);
  } catch (e) {
    showError('해설을 못 불렀어요. 연결을 확인하고 다시 눌러 주세요.');
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

/* 지금 그 자리에 서 있는가.
   GPS 로 찾은 자리면 당연히 '여기'다.
   검색으로 고른 곳이라도 마침 가까이 있으면 '여기'로 본다. */
function standingHere(data) {
  if (!state.manual) return true;              // 위치로 찾은 해설
  if (!state.pos) return false;                // 위치를 모르면 '이곳은'
  const c = data && data.coord;
  if (!c || c.lat == null) return false;
  return metersBetween(state.pos, c) < 2000;   // 2km 안이면 서 있는 것으로 본다
}

/* 어디까지 들었는지 기억해 둔다. 홈의 '이어 듣기' 고리에 쓴다. */
let progAt = 0;
function saveProgress(place, pct) {
  if (!place || !(pct >= 0)) return;
  if (Date.now() - progAt < 1500) return;      // 너무 자주 적지 않는다
  progAt = Date.now();
  state.prog = { ...(state.prog || {}), [place]: Math.min(1, pct) };
  try { localStorage.setItem('prog', JSON.stringify(state.prog)); } catch (_) {}
}

/* ── 지나온 길 ───────────────────────────────────────────── */
function remember(place) {
  if (!place) return;
  if (state.heard.at(-1) === place) return;
  state.heard.push(place);
  state.heard = state.heard.slice(-40);
  localStorage.setItem('heard', JSON.stringify(state.heard));
  renderLog();
  renderPlayed();
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
      els.name.textContent = state.place || '이름 없는 곳';
      els.addr.textContent = state.address;
      els.status.textContent = '지금 계신 곳';
    }
  } catch (_) {
    els.status.textContent = '위치 이름을 못 찾았어요';
  } finally {
    geocoding = false;
  }
}

function onPosition(p) {
  const next = { lat: p.coords.latitude, lon: p.coords.longitude };
  const moved = metersBetween(state.geocodedAt, next);
  state.pos = next;
  warmNearby(next);          // 지도에 꽂을 것들을 미리 받아 둔다
  if (moved > 25) refreshPlace();
  if (prefs.auto && !state.streaming &&
      metersBetween(state.narratedAt, next) > 70) narrate();
}

function onPositionError(err) {
  els.status.textContent = {
    1: '위치 권한이 꺼져 있어요', 2: '위치를 못 찾았어요', 3: '위치 찾기가 오래 걸려요',
  }[err.code] || '위치 오류';
  els.name.textContent = '어디를 들어볼까요';
  els.addr.textContent = '장소를 검색해 보세요';
}

if (!window.isSecureContext) {
  els.status.textContent = 'HTTPS가 아니면 위치를 쓸 수 없어요';
  els.name.textContent = '어디를 들어볼까요';
  els.addr.textContent = '장소를 검색해 보세요';
} else if (navigator.geolocation) {
  navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true, maximumAge: 5000, timeout: 20000,
  });
} else {
  els.status.textContent = '이 브라우저는 위치를 못 씁니다';
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

/* 카드 한 줄 소개 — 제목 아래에 다시 제목을 쓰지 않는다.
   '불국사는 대한민국 경상북도 …' 대신 '경상북도 경주시에 있는 호국사찰이에요'. */
function blurb(title, text, max = 40) {
  let t = llm.soften(wiki.forSpeech(text || '')).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const esc0 = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  t = t.replace(new RegExp('^' + esc0 + '\\s*(?:은|는|이|가)\\s*'), '');
  t = t.split(/(?<=[.!?])\s/)[0];
  /* '종로구 사직로에 있는'까지 적으면 한 줄에 안 들어간다 — 큰 단위까지만 */
  t = t.replace(/([가-힣]+(?:시|도|구|군))\s+[가-힣0-9]+(?:로|길|동|가|리)\s*\d*(?:번지)?에\s*있는/, '$1에 있는');
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(' ', max);
  return (cut > 20 ? t.slice(0, cut) : t.slice(0, max)) + '…';
}

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
      return { place: title, image, summary: blurb(title, ex[title] || '') };
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
    <span class="meta"><b>${place}</b><em>${sub || '들려드릴 수 있어요'}</em></span>
    <span class="go">${GO}</span></button>`;
}

/* 순위를 앞에 세운 목록 */
function fillRanked(host, places) {
  fillCards(host, places);
  [...host.children].forEach((btn, i) => {
    const n = document.createElement('span');
    n.className = 'rank';
    n.textContent = i + 1;
    btn.prepend(n);
  });
}

function fillCards(host, places, subs) {
  host.innerHTML = places.map((p, i) => cardHTML(p, subs && subs[i])).join('');
  /* 화면에 보이는 카드는 모두 미리 받아 둔다.
     한 카드에 한 번의 요청이고, 받아 둔 것은 캐시에 남아 다시 부르지 않는다.
     누르는 순간 자료를 기다릴 일이 없어진다. */
  places.slice(0, 8).forEach(p => wiki.gather({ manual: p }).catch(() => {}));
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
/* 카드를 누른 순간 자료를 먼저 부른다.
   화면이 넘어가는 사이에 받아 두면 재생 버튼을 누를 때 이미 도착해 있다. */
function warmPlace(name) {
  if (name) wiki.gather({ manual: name }).catch(() => {});
}

/* 예전에는 누르는 즉시 재생이 시작됐다.
   무엇을 듣게 되는지 모르고 소리부터 나오는 건 불친절하다.
   이제 한 장을 사이에 두고, 듣기로 마음먹은 사람만 재생으로 간다. */
function playPlace(name) {
  openPlace(name);
}

function startNarration(name) {
  warmPlace(name);
  state.manual = name;
  els.name.textContent = name;
  els.addr.textContent = '';
  goto('player');
  narrate();
}

/* ── 배너 캐러셀 ──────────────────────────────────────────
   8장을 국내·해외 번갈아. 3초에 걸쳐 부드럽게 넘어가고,
   손을 대면 멈췄다가 손을 떼면 다시 돈다. */
/* 영상에서 재보니 2.5초마다 한 장씩, 넘어가는 데는 0.4초쯤 걸렸다.
   예전에는 2초에 걸쳐 천천히 밀려서 '넘어가는 중'이 너무 길었다. */
const SLIDE_MS = 700;       // 넘어가는 데 걸리는 시간
const SWIPE_MS = 380;       // 손으로 넘길 때 (손을 놓은 뒤라 조금 빠르게)
const HOLD_MS = 2800;       // 머무는 시간 (합쳐서 3.5초)
const hero = { i: 0, timer: null, w: 0, dragging: false, x0: 0, dx: 0 };

async function bannerImage(b) {
  const shots = await photos.pexels(b.query, 1);
  if (shots.length) return { url: shots[0].url, credit: shots[0].credit };
  const d = await preview(b.place);          // Pexels 키가 없으면 위키 사진으로
  return { url: d.image, credit: '위키백과' };
}

/* 오늘 보여줄 여덟 장. 아침 7시에 바뀐다. */
let TODAY = pickForDay(BANNERS, 8);


/* 장을 겹쳐 쌓아 두고, 새 장이 기존 장 위를 덮으며 들어온다.
   나란히 늘어놓고 통째로 미는 방식은 두 장이 같이 움직여 밋밋하다.
   덮는 방식은 아래 장이 제자리에 있어서 '벗겨내는' 느낌이 난다. */
function buildHero() {
  els.heroTrack.innerHTML = TODAY.map((b, i) => `
    <div class="hslide${i ? '' : ' cur'}" data-place="${b.place}">
      <img alt="" loading="${i < 2 ? 'eager' : 'lazy'}">
      <span class="hveil"></span>
      <span class="htxt"><span class="htag">${b.tag}</span><strong>${b.lead}, ${b.place}</strong>
        <em class="hdesc">${b.desc || ''}</em></span>
    </div>`).join('');
  $('heroAll').textContent = TODAY.length;
  $('heroNow').textContent = 1;

  [...els.heroTrack.children].forEach((el, i) => {
    el.onclick = () => { if (Math.abs(hero.dx) < 8) playPlace(el.dataset.place); };
    bannerImage(TODAY[i]).then(d => {
      if (d.url) el.querySelector('img').src = d.url;
    }).catch(() => {});
  });
  hero.i = 0;
  hero.w = els.heroWrap.clientWidth;
}
addEventListener('resize', () => { hero.w = els.heroWrap.clientWidth; });

const slideAt = i => els.heroTrack.children[i];
const wrapIdx = i => ((i % TODAY.length) + TODAY.length) % TODAY.length;

/* 들어올 장을 한쪽에 세워 둔다. from 은 +1(오른쪽) 또는 -1(왼쪽). */
/* 장을 한쪽에 세워 둔다. 안의 글자는 반대로 밀어 화면에서는 제자리에 있게 한다. */
function put(el, pct, ms) {
  const t = ms ? `transform ${ms}ms cubic-bezier(.42,.02,.2,1)` : 'none';
  el.style.transition = t;
  el.style.transform = `translate3d(${pct}%,0,0)`;
  const tx = el.querySelector('.htxt');
  if (tx) {
    tx.style.transition = t;
    // 장이 오른쪽으로 pct 만큼 나가 있으면 글자는 그만큼 왼쪽으로 당긴다
    tx.style.transform = `translate3d(${-pct}%,0,0)`;
  }
}

function arm(next, from) {
  const el = slideAt(next);
  put(el, from * 100, 0);
  el.classList.add('top');
  void el.offsetWidth;                       // 여기서 한 번 끊어야 다음 값이 애니메이션된다
  return el;
}

/* 덮기를 끝맺는다. done 이면 새 장이 자리를 차지한다. */
function settle(next, done, ms) {
  const cur = slideAt(hero.i), el = slideAt(next);
  put(el, done ? 0 : hero.dir * 100, ms);
  setTimeout(() => {
    el.style.transition = '';
    const tx = el.querySelector('.htxt');
    if (tx) tx.style.transition = '';
    if (done) {
      cur.classList.remove('cur');
      cur.style.transform = '';              // 다음에 쓸 때 다시 세워진다
      const ct = cur.querySelector('.htxt');
      if (ct) ct.style.transform = '';
      el.classList.remove('top');
      el.classList.add('cur');
      hero.i = next;
      $('heroNow').textContent = next + 1;
    } else {
      el.classList.remove('top');
    }
  }, ms + 20);
}

function nextHero() {
  const nx = wrapIdx(hero.i + 1);
  hero.dir = 1;
  arm(nx, 1);
  requestAnimationFrame(() => settle(nx, true, SLIDE_MS));
}

function startHero() {
  clearInterval(hero.timer);
  hero.timer = setInterval(nextHero, SLIDE_MS + HOLD_MS);
}
const stopHero = () => clearInterval(hero.timer);

/* 손으로 넘기기 — 끌리는 만큼 새 장이 따라 들어온다 */
function heroDrag() {
  const wrap = els.heroWrap;
  let armed = -1;

  wrap.addEventListener('pointerdown', e => {
    hero.dragging = true; hero.x0 = e.clientX; hero.dx = 0;
    hero.t0 = Date.now(); armed = -1;
    stopHero();
  });

  wrap.addEventListener('pointermove', e => {
    if (!hero.dragging) return;
    hero.dx = e.clientX - hero.x0;
    if (Math.abs(hero.dx) < 6) return;

    const dir = hero.dx < 0 ? 1 : -1;         // 왼쪽으로 끌면 다음 장
    if (armed < 0 || hero.dir !== dir) {
      if (armed >= 0) {                        // 방향이 바뀌면 세워둔 장을 치운다
        const old = slideAt(armed);
        old.classList.remove('top');
        old.style.transform = '';
        const ot = old.querySelector('.htxt');
        if (ot) ot.style.transform = '';
      }
      hero.dir = dir;
      armed = wrapIdx(hero.i + dir);
      arm(armed, dir);
    }
    const pct = dir * 100 + (hero.dx / hero.w) * 100;
    put(slideAt(armed), pct, 0);
  }, { passive: true });

  const end = () => {
    if (!hero.dragging) return;
    hero.dragging = false;
    if (armed < 0) { setTimeout(startHero, 1200); return; }
    /* 세게 튕기면 조금만 밀어도 넘어간다. 천천히 끌었을 때만 화면의 12%를 요구한다. */
    const dt = Math.max(1, Date.now() - hero.t0);
    const fast = Math.abs(hero.dx) / dt > 0.45;
    const done = Math.abs(hero.dx) > (fast ? 24 : Math.min(60, hero.w * 0.12));
    settle(armed, done, SWIPE_MS);
    armed = -1;
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
/* 들었던 곳 여섯 개와 '더보기'. 홈에서 바로 이어 듣게 한다. */
function renderPlayed() {
  const list = state.heard.slice().reverse().slice(0, 6);
  if (!list.length) { els.playedShelf.classList.add('hidden'); return; }
  els.playedShelf.classList.remove('hidden');
  /* 원 둘레에 어디까지 들었는지 그린다.
     반지름 38 · 굵기 4 → 고리가 36~40 을 덮어 바깥 끝이 사진 가장자리(40)와 딱 맞는다.
     둘레 2πr = 238.8 */
  els.playedList.innerHTML = list.map(q => {
    const pct = (state.prog || {})[q] || 0;
    return `<div class="recent" data-q="${q}">
      <span class="rthumb">${PIN_SM}</span>
      <svg class="rprog" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="38"/>
        <circle cx="40" cy="40" r="38" class="fg"
                style="stroke-dashoffset:${(238.8 * (1 - pct)).toFixed(1)}"/>
      </svg>
      <b>${q}</b></div>`;
  }).join('');
  [...els.playedList.children].forEach(el => {
    const q = el.dataset.q;
    el.onclick = () => playPlace(q);
    preview(q).then(d => {
      if (d.image) el.querySelector('.rthumb').innerHTML = `<img src="${d.image}" alt="">`;
    }).catch(() => {});
  });
}
els.playedMore.onclick = () => goto('history');

/* 아이와 함께 — 학년마다 갈 곳도, 들려줄 깊이도 다르다 */
let kidPlaces = new Set();
function renderKids(grade) {
  prefs.kidGrade = grade;
  savePrefs();
  [...els.kidSeg.children].forEach(b => b.classList.toggle('on', b.dataset.v === grade));
  const set = KIDS[grade] || KIDS.elementary;
  const picks = pickForDay(set.places, 4);
  kidPlaces = new Set(picks);
  fillCards(els.kidList, picks);
}
els.kidSeg.onclick = e => {
  const b = e.target.closest('button');
  if (b && b.dataset.v !== prefs.kidGrade) renderKids(b.dataset.v);
};

/* 위치를 알게 된 순간 지도에 쓸 것들을 미리 받아 둔다.
   탭을 누르고 나서 받기 시작하면 1.7초가 걸린다. */
let warmedAt = null;
async function warmNearby(at) {
  if (!at || (warmedAt && metersBetween(warmedAt, at) < 500)) return;
  warmedAt = at;
  try {
    const raw = await wiki.nearby(at.lat, at.lon, 8000, 60);
    const names = raw.map(x => x.title)
      .filter(n => !geo2.adminName(n) && !geo2.boring(n) && !score.dropped(n, [], { unknown: true }))
      .slice(0, 12);
    if (names.length) wiki.thumbs(names, 160).catch(() => {});
  } catch (_) {}
}

/* ── 내 주변 ──────────────────────────────────────────────
   지도 위에 이야깃거리가 있는 곳만 꽂는다.
   지도 라이브러리는 이 화면을 처음 열 때만 받아온다 — 쓰지 않는 사람에게
   45KB 를 미리 물릴 이유가 없다. */
const MAP_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
/* bright — 색이 들어간 지도. 물은 파랗고 공원은 초록이다. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
let mapObj = null, mapReady = null, pins = [], pickedPin = null, mapAt = null;

function loadMapLib() {
  if (window.maplibregl) return Promise.resolve();
  if (mapReady) return mapReady;
  mapReady = new Promise((ok, no) => {
    const el = document.createElement('script');
    el.src = MAP_JS; el.onload = ok; el.onerror = no;
    document.head.appendChild(el);
  });
  return mapReady;
}

const SEOUL = { lat: 37.5665, lon: 126.9780 };

/* 처음 찾은 자리에서 충분히 멀어졌는가 */
function mapMoved() {
  if (!mapObj || !mapAt) return false;
  const c = mapObj.getCenter();
  return metersBetween(mapAt, { lat: c.lat, lon: c.lng }) > 700;
}

/* 지도에서 걷어낼 것들.
   래스터 타일은 그림 한 장이라 도로만 지울 수가 없다.
   벡터 타일은 층이 나뉘어 있어 필요 없는 층만 빼고 그릴 수 있다.
   도로·행정경계·항로를 빼면 물, 공원, 건물, 지명은 색 그대로 남는다. */
const DROP_LAYERS = /^(boundary|aeroway|aerodrome_label)$/;
const DROP_IDS = /^(waterway_tunnel|poi_transit|building-3d)$|shield|highway-name|road_shield|_label_shield/;
/* waterway_tunnel: 복개천 점선 — 지상에 없는 물길이다
   poi_transit: 버스·전철 정류장. 지도를 통째로 덮는데
                여행 해설을 고르는 데는 아무 쓸모가 없다.
   building-3d: 솟아오른 건물. 평평한 지도가 읽기 쉽다. */

/* 지명은 한국어로만.
   원래 스타일은 'Seoul' 과 '서울특별시' 를 줄바꿈으로 붙여 두 줄로 찍는다. */
const KO_ONLY = ['coalesce', ['get', 'name:ko'], ['get', 'name:nonlatin'], ['get', 'name']];

function trimStyle(style) {
  const layers = style.layers
    .filter(l => !DROP_LAYERS.test(l['source-layer'] || '') && !DROP_IDS.test(l.id))
    .map(l => (l.layout && l.layout['text-field'])
      ? { ...l, layout: { ...l.layout, 'text-field': KO_ONLY } }
      : l);
  return { ...style, layers };
}

async function renderNearby() {
  try { await loadMapLib(); } catch (_) {
    notify('지도를 못 불렀어요. 연결을 확인해 주세요.');
    return;
  }
  const at = state.pos || SEOUL;
  if (!mapObj) {
    const raw = await fetch(MAP_STYLE).then(r => r.json());
    mapObj = new maplibregl.Map({
      container: 'map',
      style: trimStyle(raw),
      center: [at.lon, at.lat],
      zoom: 13.5,
      attributionControl: { compact: true },
      pitch: 0, bearing: 0,
      pitchWithRotate: false, dragRotate: false,   // 기울거나 돌아가지 않게
    });
    mapObj.touchZoomRotate.disableRotation();
    mapObj.on('click', () => pickPin(null));
    mapObj.on('move', () => { clearTimeout(layoutT); layoutT = setTimeout(layout, 90); });
    mapObj.on('moveend', () => {
      layout();
      // 장소 카드가 떠 있을 때는 자리가 겹치므로 내놓지 않는다
      const show = mapMoved() && $('placeCard').classList.contains('hidden');
      $('research').classList.toggle('hidden', !show);
    });
    await new Promise(ok => mapObj.on('load', ok));
  }
  // 숨겨진 채로 만들어지면 크기를 0 으로 잰다
  [0, 80, 300].forEach(ms => setTimeout(() => mapObj.resize(), ms));

  if (mapAt && metersBetween(mapAt, at) < 300 && pins.length) return;
  mapAt = at;
  mapObj.setCenter([at.lon, at.lat]);
  await dropPins(at);
}

async function dropPins(at, { keepView = false } = {}) {
  pins.forEach(p => p.marker.remove());
  pins = [];

  const raw = await wiki.nearby(at.lat, at.lon, 8000, 60);
  const coords = Object.fromEntries(raw.map(x => [x.title, x]));

  /* 점수를 다 매기고 나서 꽂으면 5초가 걸린다. 분류를 물어보는 데만 4.8초가 든다.
     이름만 보고 걸러 먼저 꽂고, 제대로 된 점수는 뒤에서 매겨 갈아 끼운다. */
  let names = raw.map(x => x.title)
    .filter(n => !geo2.adminName(n) && !geo2.boring(n) && !score.dropped(n, [], { unknown: true }))
    .slice(0, 20);
  if (!names.length) return;

  // 사진도 한 번에 받는다. 한 곳씩 부르면 열두 곳에 스물네 번이 나간다.
  const shots = await wiki.thumbs(names, 160);
  paintPins(names, coords, shots, keepView);
  /* 다듬기는 잠시 미룬다. 지도 타일이 먼저 내려와야 화면이 빨리 찬다. */
  setTimeout(() => refinePins(at, raw, coords, shots, keepView).catch(() => {}), 1200);
}

function paintPins(names, coords, shots, keepView) {
  pins.forEach(p => p.marker && p.marker.remove());
  clusters.forEach(m => m.remove());
  pins = []; clusters = [];

  let w = 180, s = 90, e = -180, n = -90;
  for (const name of names) {
    const c = coords[name];
    if (!c) continue;
    pins.push({ name, lon: c.lon, lat: c.lat, dist: c.dist, image: shots[name], marker: null });
    w = Math.min(w, c.lon); e = Math.max(e, c.lon);
    s = Math.min(s, c.lat); n = Math.max(n, c.lat);
  }
  /* 화면 크기가 잡히기 전에 범위를 맞추면 배율이 엉뚱하게 멀어진다.
     (지도가 0픽셀로 잡히면 세상 전체를 담으려 한다.)
     크기를 다시 재고 한 프레임 기다린 뒤에 맞춘다. */
  const fit = () => {
    if (pins.length > 1 && !keepView) {
      mapObj.resize();
      mapObj.fitBounds([[w, s], [e, n]], {
        padding: { top: 80, bottom: 170, left: 56, right: 56 },
        maxZoom: 14.6, minZoom: 11, animate: false,
      });
    }
    layout();
  };
  requestAnimationFrame(() => requestAnimationFrame(fit));
}

/* ── 겹치는 핀 묶기 ──────────────────────────────────────
   지도를 줄이면 핀들이 서로 포개져 무엇이 무엇인지 알 수 없다.
   화면에서 가까운 것들을 하나로 묶고 개수를 적어 준다. */
const CLUSTER_PX = 58;
let clusters = [], layoutT = 0;

function makePin(rec) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.innerHTML = `<i>${rec.image ? `<img src="${rec.image}" alt="">` : PIN_SM}</i>`;
  el.addEventListener('click', ev => { ev.stopPropagation(); pickPin(rec); });
  if (pickedPin && pickedPin.name === rec.name) el.classList.add('picked');
  return new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([rec.lon, rec.lat]).addTo(mapObj);
}

function makeCluster(group) {
  const lon = group.reduce((a, p) => a + p.lon, 0) / group.length;
  const lat = group.reduce((a, p) => a + p.lat, 0) / group.length;
  const el = document.createElement('div');
  el.className = 'pin cluster';
  el.innerHTML = `<i><b>${group.length}</b></i>`;
  el.addEventListener('click', ev => {
    ev.stopPropagation();
    // 누르면 그 무리가 풀릴 만큼 다가간다
    mapObj.easeTo({ center: [lon, lat], zoom: Math.min(17, mapObj.getZoom() + 2.2), duration: 380 });
  });
  return new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([lon, lat]).addTo(mapObj);
}

function layout() {
  if (!mapObj || !pins.length) return;
  pins.forEach(p => { if (p.marker) { p.marker.remove(); p.marker = null; } });
  clusters.forEach(m => m.remove());
  clusters = [];

  // 화면 좌표로 옮겨 놓고 가까운 것끼리 묶는다
  const pts = pins.map(p => ({ p, xy: mapObj.project([p.lon, p.lat]) }));
  const used = new Set();
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    const group = [pts[i].p];
    used.add(i);
    for (let k = i + 1; k < pts.length; k++) {
      if (used.has(k)) continue;
      const dx = pts[i].xy.x - pts[k].xy.x, dy = pts[i].xy.y - pts[k].xy.y;
      if (Math.hypot(dx, dy) < CLUSTER_PX) { group.push(pts[k].p); used.add(k); }
    }
    if (group.length === 1) group[0].marker = makePin(group[0]);
    else clusters.push(makeCluster(group));
  }
}

/* 뒤에서 제대로 점수를 매겨, 목록이 달라졌을 때만 다시 그린다 */
async function refinePins(at, raw, coords, shots, keepView) {
  const ranked = await score.rank(raw.slice(0, 24).map(x => ({ name: x.title, dist: x.dist })),
                                  { pos: state.pos, views: false });
  if (mapAt !== at || !ranked.length) return;
  const names = ranked.map(x => x.name).filter(n => coords[n]).slice(0, 20);
  const now = pins.map(p => p.name).join('|');
  if (!names.length || names.join('|') === now) return;
  const more = await wiki.thumbs(names.filter(n => !shots[n]), 160);
  if (mapAt !== at) return;
  paintPins(names, coords, { ...shots, ...more }, true);
}

function pickPin(rec) {
  if (pickedPin && pickedPin.marker) pickedPin.marker.getElement().classList.remove('picked');
  pickedPin = rec;
  if (!rec) {
    $('placeCard').classList.add('hidden');
    els.mini.classList.remove('above-card');
    if (mapMoved()) $('research').classList.remove('hidden');
    return;
  }

  if (rec.marker) rec.marker.getElement().classList.add('picked');
  mapObj.easeTo({ center: [rec.lon, rec.lat], duration: 320 });

  $('pcName').textContent = rec.name;
  $('pcDesc').textContent = rec.summary
    || (rec.dist != null ? `여기서 ${rec.dist}m` : '들려드릴 수 있어요');
  $('pcThumb').innerHTML = rec.image ? `<img src="${rec.image}" alt="">` : PIN_SM;
  $('placeCard').classList.remove('hidden');
  els.mini.classList.add('above-card');     // 카드에 가리지 않게 위로
  $('research').classList.add('hidden');    // 카드와 자리가 겹친다
  warmPlace(rec.name);

  if (!rec.summary) preview(rec.name).then(d => {
    if (pickedPin !== rec) return;
    rec.image = d.image; rec.summary = d.summary;
    if (d.summary) $('pcDesc').textContent = d.summary;
    if (d.image) $('pcThumb').innerHTML = `<img src="${d.image}" alt="">`;
  }).catch(() => {});
}

/* 지금 보고 있는 자리에서 다시 찾는다 */
async function researchHere() {
  if (!mapObj) return;
  const btn = $('research');
  if (btn.classList.contains('busy')) return;      // 두 번 눌러도 한 번만

  const c = mapObj.getCenter();
  const at = { lat: c.lat, lon: c.lng };
  /* 누르자마자 사라지면 눌린 건지 알 수 없다.
     찾는 동안 그 자리에서 돌다가, 핀이 다 꽂히면 줄어들며 사라진다. */
  btn.classList.add('busy');
  $('researchLabel').textContent = '찾는 중';
  pickPin(null);
  mapAt = at;
  try {
    await dropPins(at, { keepView: true });
  } finally {
    btn.classList.remove('busy');
    $('researchLabel').textContent = '현위치에서 검색';
    btn.classList.add('going');
    setTimeout(() => { btn.classList.add('hidden'); btn.classList.remove('going'); }, 190);
  }
}
$('research').onclick = researchHere;

/* 배너의 사진을 전체화면으로 연다.
   플레이어의 사진첩과 같은 화면을 쓰되, 보여줄 목록만 잠시 갈아 끼운다. */
$('heroCount').onclick = e => {
  e.stopPropagation();
  const b = TODAY[wrapIdx(hero.i)];
  const img = els.heroTrack.children[hero.i]?.querySelector('img');
  if (!b || !img || !img.src) return;
  vwList = [{ url: img.src, title: `${b.lead}, ${b.place}` }];
  openViewer(0);
};

$('pcBody').onclick = () => { if (pickedPin) playPlace(pickedPin.name); };

/* 길찾기는 이 기기가 쓰는 지도 앱에 넘긴다.
   애플 지도와 구글 지도를 웹 화면에 직접 띄우려면 각각
   유료 개발자 계정(MapKit JS)과 결제 등록된 키가 필요하다. */
function openInMaps(name, lat, lon) {
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const android = /Android/.test(ua);
  const q = encodeURIComponent(name);
  const url = apple
    ? `https://maps.apple.com/?q=${q}&ll=${lat},${lon}`
    : android
      ? `geo:${lat},${lon}?q=${lat},${lon}(${q})`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  window.open(url, '_blank', 'noopener');
}

$('pcMap').onclick = e => {
  e.stopPropagation();
  if (!pickedPin) return;
  openInMaps(pickedPin.name, pickedPin.lat, pickedPin.lon);
};

$('recenter').onclick = () => {
  const at = state.pos || SEOUL;
  if (!mapObj) return;
  mapObj.easeTo({ center: [at.lon, at.lat], zoom: 13.5, duration: 420 });
  $('research').classList.add('hidden');
};

/* 검색 화면으로. 어디서 왔는지 기억해 두고 뒤로 가기를 띄운다. */
let cameFrom = '';
function openSearch(from) {
  cameFrom = from || '';
  els.searchBack.classList.toggle('hidden', !cameFrom);
  goto('search');
  /* 저절로 커서를 놓지 않는다.
     들어오자마자 자판이 올라오고 아래가 접히면, 둘러보러 온 사람은
     자기가 하지 않은 일이 벌어진 것처럼 느낀다.
     입력창을 직접 눌렀을 때만 검색하는 상태로 들어간다. */
}
els.homeSearch.onclick = () => openSearch('home');

/* 검색 문구를 한 글자씩 찍는다. 3초에 한 번 다시 시작한다.
   화면을 보고 있지 않을 때는 돌리지 않는다 — 배터리를 쓸 이유가 없다. */
/* 검색창 문구는 몇 가지를 번갈아 보여준다.
   한 글자씩 찍는 방식은 글자 수에 따라 속도가 달라지고 기계 소리가 난다.
   통째로 부드럽게 갈아 끼우는 편이 눈이 편하다. */
const TYPE_LINES = [
  '오늘은 어떤 이야기를 들려 드릴까요?',
  '지금 어디에 계신가요?',
  '가보고 싶은 곳이 있나요?',
  '오늘은 어디를 걸어 볼까요?',
];
const HOLD = 3600;          // 한 문구가 머무는 시간
const SWAP = 500;           // 갈아 끼우는 데 걸리는 시간
let typeTimer = 0, typeIdx = 0;

function stopTyping() { clearTimeout(typeTimer); }

function runTyping() {
  stopTyping();
  const out = $('typeText');
  if (!out) return;
  out.textContent = TYPE_LINES[typeIdx % TYPE_LINES.length];
  out.classList.remove('in', 'out');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cycle = () => {
    if (state.view !== 'home' || document.hidden) {
      typeTimer = setTimeout(cycle, HOLD);       // 안 보이면 그냥 기다린다
      return;
    }
    out.classList.add('out');                    // 위로 올라가며 사라지고
    typeTimer = setTimeout(() => {
      typeIdx++;
      out.textContent = TYPE_LINES[typeIdx % TYPE_LINES.length];
      out.classList.remove('out');
      out.classList.add('in');                   // 아래에서 올라오며 나타난다
      requestAnimationFrame(() => requestAnimationFrame(() => out.classList.remove('in')));
      typeTimer = setTimeout(cycle, HOLD);
    }, SWAP);
  };
  typeTimer = setTimeout(cycle, HOLD);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopTyping();
  else if (state.view === 'home') runTyping();
});
$('playerSearch').onclick = () => openSearch('player');
$('histSearch').onclick = () => openSearch('history');
els.searchBack.onclick = () => {
  const back = cameFrom || 'home';
  cameFrom = '';
  els.searchBack.classList.add('hidden');
  goto(back);
};

function renderHome() {
  if (homeReady) return;
  homeReady = true;

  
  buildHero();
  heroDrag();
  startHero();          // 저절로 넘어가기 시작
  wiki.gather({ manual: TODAY[0].place }).catch(() => {});
  renderPlayed();
  renderKids(prefs.kidGrade || 'elementary');
  runTyping();
  fillCards(els.pickList, pickForDay(PICKS, 3, 5));   // 오늘의 추천 세 곳
  buildRegion(KR, els.krChips, els.krList);
  buildRegion(WW, els.wwChips, els.wwList);

  els.toTop.onclick = () =>
    $('view-home').scrollTo({ top: 0, behavior: 'smooth' });
}

/* 추천 도슨트 — 국내와 해외를 나눠 1~10위로 보여준다 */
function drawPicks(which) {
  prefs.pickTab = which;
  savePrefs();
  [...els.pickSeg.children].forEach(b => b.classList.toggle('on', b.dataset.v === which));
  fillRanked(els.sugList, which === 'kr' ? TOP_KR : TOP_WW);
}
els.pickSeg.onclick = e => {
  const b = e.target.closest('button');
  if (b && b.dataset.v !== prefs.pickTab) drawPicks(b.dataset.v);
};

let searchReady = false;
function renderSearch() {
  searchMode(false);
  if (!searchReady) {
    searchReady = true;
    drawPicks(prefs.pickTab || 'kr');
  }
  if (state.pos && !els.nearList.children.length) {
    /* 여기에도 같은 잣대를 댄다. 예전에는 거르지 않아서
       동안초등학교·귀인초등학교가 '가까운 도슨트'로 올라왔다. */
    wiki.nearby(state.pos.lat, state.pos.lon, 5000, 60).then(async list => {
      if (!list.length) return;
      const dist = Object.fromEntries(list.map(x => [x.title, x.dist]));
      let picked = list.map(x => ({ name: x.title, dist: x.dist }));
      try {
        const rain = await score.isRaining(state.pos.lat, state.pos.lon);
        const ranked = await score.rank(picked, { pos: state.pos, weather: rain });
        if (ranked.length) picked = ranked;
      } catch (_) {}
      const near = picked.slice(0, 6);
      if (!near.length) return;
      els.nearShelf.classList.remove('hidden');
      fillCards(els.nearList, near.map(x => x.name),
                near.map(x => `여기서 ${dist[x.name] ?? '?'}m`));
    }).catch(() => {});
  }
}

/* ── 검색 ────────────────────────────────────────────────
   예전에는 무엇을 치든 곧바로 재생이 시작됐다.
   '프랑스'처럼 넓은 말을 친 사람에게는 고를 기회가 없었다.
   이제 검색어가 나라인지 동네인지 장소인지 가려서 다르게 답한다. */
let searchSeq = 0;

function heroHTML(name, note) {
  return `<button class="hero-card" data-place="${name}">
    <span class="hero-meta"><b>${name}</b><em>${note}</em></span>
    <span class="hero-play" aria-hidden="true">${GO}</span></button>`;
}

async function runSearch(q) {
  const seq = ++searchSeq;
  searchMode(false);
  els.sugShelf.classList.add('hidden');
  els.resultShelf.classList.remove('hidden');
  els.resultHero.innerHTML = '';
  els.resultList.innerHTML = '';
  els.resultGroups.innerHTML = '';
  els.resultCount.textContent = '';
  els.aroundShelf.classList.add('hidden');
  els.resultEmpty.classList.add('hidden');
  els.drillDown.classList.add('hidden');
  els.drillUp.classList.add('hidden');
  els.resultTitle.textContent = `'${q}' 찾는 중`;

  let hit = null;
  try { hit = await geo2.identify(q); } catch (_) {}
  if (seq !== searchSeq) return;

  if (!hit) {
    // 위키데이터가 모르는 말이어도 위키백과에는 있을 수 있다
    els.resultTitle.textContent = `'${q}'`;
    els.resultHero.innerHTML = heroHTML(q, '이 이름으로 들려드릴게요');
    bindPlaces(els.resultHero);
    return;
  }

  const tier = hit.tier;
  els.resultTitle.textContent = `${hit.label} · ${geo2.TIER_LABEL[tier]}`;

  if (tier === 'landmark') {
    // 장소를 정확히 찾아 친 경우다. 예전의 빠른 길을 그대로 남겨 둔다.
    els.resultHero.innerHTML = heroHTML(hit.label, hit.desc || '바로 들어보세요');
    bindPlaces(els.resultHero);
    drawDrills(hit, seq);
    nearbyOf(hit, seq, 6, '이 근처');
    return;
  }

  els.resultEmpty.textContent = '이 지역을 찾아보는 중이에요.';
  els.resultEmpty.classList.remove('hidden');
  drawDrills(hit, seq);

  let names = [];
  if (tier === 'district') {
    /* 동네는 위키데이터에 걸린 명소가 거의 없다(성수동은 자기 자신 하나뿐).
       좌표 둘레를 훑는 쪽이 훨씬 촘촘하다. */
    try {
      // 여기서 미리 추리면 아파트가 자리를 차지한다. 점수 매기기에 그대로 넘긴다.
      const list = await wiki.nearby(hit.lat, hit.lon, 2500, 60);
      names = list.map(x => x.title).filter(n => !geo2.adminName(n));
    } catch (_) {}
  } else {
    /* 나라·지역·도시는 위키데이터가 낫다.
       지오서치는 반경이 10km까지라 경주시를 쳐도 불국사가 안 잡힌다. */
    try { names = (await geo2.topIn(hit.id, tier, 12)).map(x => x.name); } catch (_) {}
    if (!names.length && hit.lat != null) {
      try {
        const list = await wiki.nearby(hit.lat, hit.lon, 10000, 150);
        names = list.map(x => x.title).filter(n => !geo2.adminName(n));
      } catch (_) {}
    }
  }
  if (seq !== searchSeq) return;

  names = names.filter(n => n && n !== hit.label && !geo2.boring(n));
  els.resultEmpty.classList.add('hidden');
  if (!names.length) {
    els.resultEmpty.textContent = '들려드릴 곳을 찾지 못했어요. 장소 이름으로 검색해 보세요.';
    els.resultEmpty.classList.remove('hidden');
    return;
  }

  // 먼저 보여주고 나서 줄을 세운다. 점수를 다 매길 때까지 빈 화면으로 두지 않는다.
  fillCards(els.resultList, names.slice(0, 8));
  els.resultCount.textContent = `${names.length}곳`;

  /* 이야깃거리가 없는 곳을 걷어내고, 가까움·이야기·인지도·지금 상황으로 다시 줄을 세운다.
     현장에 있으면 거리가 가장 무겁고, 집에서 찾아볼 때는 인지도가 가장 무겁다. */
  try {
    const rain = state.pos ? await score.isRaining(state.pos.lat, state.pos.lon) : false;
    const ranked = await score.rank(names.slice(0, 40).map(n => ({ name: n })),
                                    { pos: state.pos, weather: rain });
    if (seq !== searchSeq || !ranked.length) return;
    els.resultList.innerHTML = '';
    els.resultCount.textContent = `${ranked.length}곳`;
    drawGroups(ranked.slice(0, 24));
    aroundOf(hit, seq, ranked.map(x => x.name));
  } catch (_) { /* 점수를 못 매기면 처음 순서 그대로 둔다 */ }
}

/* 좁혀 들어가는 칩과 넓혀 나가는 칩.
   나라·지역에서는 아래로 좁히고, 도시·동네·장소에서는 위로 넓힌다.
   목록과 따로 부르기 때문에 늦게 도착해도 결과를 기다리게 하지 않는다. */
function drawChips(host, box, list) {
  // 비었으면 지운다. 남겨 두면 다음 검색에 지난 칩이 딸려 온다.
  if (!list.length) { host.innerHTML = ''; box.classList.add('hidden'); return; }
  host.innerHTML = list.map(x => `<button class="rchip" data-go="${x.name}">${x.name}</button>`).join('');
  [...host.children].forEach(b => {
    b.onclick = () => {
      els.searchInput.value = b.dataset.go;
      $('view-search').scrollTo({ top: 0, behavior: 'smooth' });
      runSearch(b.dataset.go);
    };
  });
  box.classList.remove('hidden');
}

async function drawDrills(hit, seq) {
  const wantDown = hit.tier === 'country' || hit.tier === 'region';
  const wantUp = hit.tier !== 'country';
  const [down, up] = await Promise.all([
    wantDown ? geo2.children(hit.id, hit.tier, 8).catch(() => []) : Promise.resolve([]),
    wantUp ? geo2.parents(hit.id, 3).catch(() => []) : Promise.resolve([]),
  ]);
  if (seq !== searchSeq) return;
  drawChips(els.downChips, els.drillDown, down);
  drawChips(els.upChips, els.drillUp, up.filter(x => x.name !== hit.label));
}

/* 성격이 같은 것끼리 묶어 보여준다.
   한 줄로 스무 개를 늘어놓는 것보다 '절과 사당 4곳' 처럼 나뉘어 있는 편이 고르기 쉽다. */
function drawGroups(items) {
  const groups = score.grouped(items);
  els.resultGroups.innerHTML = groups.map((g, i) =>
    `<div class="group"><h3>${g.label} ${g.items.length}곳</h3>
       <div class="cards" id="grp-${i}"></div></div>`).join('');
  groups.forEach((g, i) => fillCards($(`grp-${i}`), g.items.map(x => x.name)));
}

/* 검색한 곳 둘레에서, 목록에 없는 곳들을 더 권한다.
   같은 잣대로 고르되 이미 보여준 것은 뺀다. */
async function aroundOf(hit, seq, already) {
  if (!hit || hit.lat == null) return;
  try {
    const list = await wiki.nearby(hit.lat, hit.lon, 6000, 60);
    if (seq !== searchSeq) return;
    const seen = new Set(already);
    const cand = list.map(x => x.title)
      .filter(n => !seen.has(n) && n !== hit.label && !geo2.adminName(n) && !geo2.boring(n));
    if (!cand.length) return;
    const ranked = await score.rank(cand.slice(0, 30).map(n => ({ name: n })), { pos: state.pos });
    if (seq !== searchSeq || !ranked.length) return;
    els.aroundCount.textContent = `${Math.min(ranked.length, 6)}곳`;
    fillCards(els.aroundList, ranked.slice(0, 6).map(x => x.name));
    els.aroundShelf.classList.remove('hidden');
  } catch (_) {}
}

/* 카드가 아닌 곳(히어로 카드)에도 같은 동작을 붙인다 */
function bindPlaces(host) {
  [...host.querySelectorAll('[data-place]')].forEach(el => {
    el.onclick = () => playPlace(el.dataset.place);
  });
}

async function nearbyOf(hit, seq, n, title) {
  if (hit.lat == null) return;
  try {
    const list = await wiki.nearby(hit.lat, hit.lon, 4000, n + 4);
    if (seq !== searchSeq) return;
    const names = list.map(x => x.title)
      .filter(x => x !== hit.label && !geo2.boring(x)).slice(0, n);
    if (!names.length) return;
    els.resultTitle.textContent += ` — ${title}`;
    fillCards(els.resultList, names);
  } catch (_) {}
}

/* ── 최근 검색 ───────────────────────────────────────────
   찾아본 말을 기억해 두고 썸네일과 함께 다시 보여준다. */
let searched = [];
try { searched = JSON.parse(localStorage.getItem('searched') || '[]'); } catch (_) {}

function rememberSearch(q) {
  searched = [q, ...searched.filter(x => x !== q)].slice(0, 12);
  localStorage.setItem('searched', JSON.stringify(searched));
  renderRecents();
}

function forgetSearch(q) {
  searched = searched.filter(x => x !== q);
  localStorage.setItem('searched', JSON.stringify(searched));
  renderRecents();
}

function renderRecents() {
  if (!searched.length) { els.recentShelf.classList.add('hidden'); return; }
  els.recentShelf.classList.remove('hidden');
  els.recentList.innerHTML = searched.map(q =>
    `<div class="recent" data-q="${q}">
       <span class="rthumb">${PIN_SM}</span><b>${q}</b>
       <button class="rdel" aria-label="${q} 검색 기록 지우기">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m7.5 7.5 9 9M16.5 7.5l-9 9"/></svg>
       </button>
     </div>`).join('');
  [...els.recentList.children].forEach(btn => {
    const q = btn.dataset.q;
    btn.querySelector('.rdel').onclick = e => { e.stopPropagation(); forgetSearch(q); };
    btn.onclick = () => { els.searchInput.value = q; showClear(); runSearch(q); };
    // 썸네일은 나중에 채워 넣는다. 없으면 핀 아이콘 그대로 둔다.
    preview(q).then(d => {
      if (d.image) btn.querySelector('.rthumb').innerHTML = `<img src="${d.image}" alt="">`;
    }).catch(() => {});
  });
}

/* ── 입력 중 제안 ────────────────────────────────────────
   검색창을 누르면 아래 것들은 접히고, 친 말에 맞는 곳만 남는다. */
function searchMode(on) {
  els.sugShelf.classList.toggle('hidden', !on || !els.typeahead.children.length);
  if (on) {
    // 최근 검색은 남긴다 — 다시 찾는 곳이 대부분 그 안에 있다
    for (const el of [els.nearShelf, $('sugList').parentElement, els.resultShelf])
      el && el.classList.add('hidden');
    renderRecents();
    return;
  }
  // 검색을 그만두면 접어 뒀던 것들을 되돌린다
  renderRecents();
  if (els.nearList.children.length) els.nearShelf.classList.remove('hidden');
  const sug = $('sugList').parentElement;
  if (sug) sug.classList.remove('hidden');
}

let typeT = 0, typeSeq = 0;

/* 제안 카드는 가볍게 그린다.
   예전에는 카드마다 사진과 요약을 따로 받아와서 여섯 장이면 요청이 열두 번 나갔다.
   위키데이터가 한 줄 설명을 함께 주므로 그것만으로 충분하다. */
function fillSuggestions(list) {
  els.typeahead.innerHTML = list.map(x => `
    <button class="card" data-place="${x.name}">
      <span class="thumb">${PIN_SM}</span>
      <span class="meta"><b>${x.name}</b><em>${x.desc}</em></span>
      <span class="go">${GO}</span>
    </button>`).join('');
  [...els.typeahead.children].forEach(btn => {
    btn.onclick = () => {
      const q = btn.dataset.place;
      els.searchInput.value = q;
      showClear();
      rememberSearch(q);
      runSearch(q);
    };
  });
}

async function typeahead(term) {
  const seq = ++typeSeq;
  const q = term.trim();
  if (q.length < 2) { els.typeahead.innerHTML = ''; els.sugShelf.classList.add('hidden'); return; }
  try {
    /* 위키백과 검색은 이강인·신민아·경주 이씨까지 그대로 준다.
       위키데이터는 설명문으로 사람과 장소를 갈라 주고, 요청도 한 번이면 된다. */
    const list = await geo2.suggest(q, 6);
    if (seq !== typeSeq) return;
    if (!list.length) { els.typeahead.innerHTML = ''; els.sugShelf.classList.add('hidden'); return; }
    els.sugShelf.classList.remove('hidden');
    fillSuggestions(list);
  } catch (_) {}
}

/* 지우기 버튼 — 글자가 있을 때만 보인다 */
const showClear = () =>
  els.searchClear.classList.toggle('hidden', !els.searchInput.value.length);

els.searchClear.onclick = () => {
  els.searchInput.value = '';
  showClear();
  /* 이미 날아간 제안 요청이 뒤늦게 돌아와 목록을 다시 채우는 일이 있다.
     기다리는 것과 진행 중인 것을 모두 무효로 만든다. */
  clearTimeout(typeT);
  typeSeq++;
  els.typeahead.innerHTML = '';
  els.sugShelf.classList.add('hidden');
  els.searchInput.focus();          // 지운 뒤 바로 다시 칠 수 있게
};

els.searchInput.addEventListener('focus', () => searchMode(true));
els.searchInput.addEventListener('blur', () => {
  // 잠깐 기다린다. 제안 카드를 누르는 중일 수 있다.
  setTimeout(() => {
    if (document.activeElement === els.searchInput) return;
    if (!els.searchInput.value.trim()) searchMode(false);
  }, 180);
});
els.searchInput.addEventListener('input', () => {
  showClear();
  searchMode(true);
  clearTimeout(typeT);
  typeT = setTimeout(() => typeahead(els.searchInput.value), 220);
});

els.searchForm.onsubmit = e => {
  e.preventDefault();
  const q = els.searchInput.value.trim();
  if (!q) return;
  els.searchInput.blur();
  els.sugShelf.classList.add('hidden');
  els.typeahead.innerHTML = '';
  rememberSearch(q);
  showClear();
  runSearch(q);
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
let vwList = null;                 // 잠시 다른 목록을 보여줄 때만 채운다
const shotsOf = () => vwList || state.shots;

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
  const shot = shotsOf()[i];
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
    shotsOf().length > 1 ? `${i + 1} / ${shotsOf().length}` : '';
}

function openViewer(i) {
  if (!shotsOf().length) return;
  els.viewer.classList.remove('hidden', 'closing');
  els.viewerBg.style.opacity = '1';
  vwShow(typeof i === 'number' ? i : state.slide, 0);
  document.addEventListener('keydown', vwKey);
}

function closeViewer() {
  vwList = null;                    // 배너 사진을 보고 나면 원래 목록으로 돌아온다
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
  if (n < 0 || n >= shotsOf().length) { vwReset(true); return; }
  vwShow(n, step);
  // 플레이어의 캐러셀도 같은 자리로 옮겨 둔다
  if (!vwList) els.rail.scrollLeft = n * els.rail.clientWidth;
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
const VIEWS = ['home', 'nearby', 'place', 'search', 'player', 'history', 'settings'];

/* 활성 알약을 그 탭 자리로 미끄러뜨린다.
   탭마다 배경을 켜고 끄면 깜빡이지만, 하나가 옮겨 다니면 이어져 보인다. */
/* 세그먼트 컨트롤 — 켜진 칸을 흰 판이 따라간다.
   각 그룹의 클릭 처리를 건드리지 않고, 'on' 이 옮겨 붙는 것만 지켜본다. */
(() => {
  /* classList.add 는 이미 있는 값이어도 class 속성을 다시 쓴다.
     그 쓰기가 아래 관찰자를 또 깨우므로, 바뀔 때만 건드린다. */
  const ready = (ink, on) => {
    if (ink.classList.contains('ready') !== on) ink.classList.toggle('ready', on);
  };
  const place = (seg) => {
    const ink = seg.querySelector('.seg-ink');
    const on = seg.querySelector('button.on');
    if (!ink) return;
    if (!on || !seg.offsetParent) { ready(ink, false); return; }
    ink.style.width = on.offsetWidth + 'px';
    ink.style.transform = `translate3d(${on.offsetLeft}px,0,0)`;
    requestAnimationFrame(() => ready(ink, true));
  };
  const segs = [...document.querySelectorAll('.seg')];
  segs.forEach(seg => {
    const ink = document.createElement('span');
    ink.className = 'seg-ink';
    seg.prepend(ink);
    // 처음 자리는 소리 없이 잡는다
    ink.style.transition = 'none';
    requestAnimationFrame(() => { place(seg); requestAnimationFrame(() => { ink.style.transition = ''; }); });
    new MutationObserver(ms => {
      // 판 자신의 변화는 되돌아온 메아리다
      if (ms.every(m => m.target === ink)) return;
      place(seg);
    }).observe(seg, { attributes: true, attributeFilter: ['class'], subtree: true });
  });
  const all = () => segs.forEach(place);
  addEventListener('resize', all);
  window.__segInk = all;   // 숨어 있던 화면이 열리면 자리를 다시 잡는다
})();

const DEEP = new Set(['place']);
function moveTabInk(view) {
  const ink = $('tabInk');
  const tabs = [...document.querySelectorAll('.tab')];
  const i = tabs.findIndex(t => t.dataset.view === view);
  if (!ink) return;
  if (i < 0) { ink.classList.toggle('ready', false); return; }
  ink.style.transform = `translate3d(${i * 100}%,0,0)`;
  requestAnimationFrame(() => ink.classList.toggle('ready', true));
}

function goto(view) {
  const first = !state.view;
  state.view = view;
  VIEWS.forEach(v => $('view-' + v).classList.toggle('hidden', v !== view));
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.view === view));
  /* 상세는 2뎁스다 — 탭으로 갈 곳이 아니라 뒤로 나올 곳이다 */
  document.body.classList.toggle('deep', DEEP.has(view));
  if (first) { const k = $('tabInk'); if (k) k.style.transition = 'none'; }
  moveTabInk(view);
  if (window.__segInk) requestAnimationFrame(window.__segInk);
  if (first) requestAnimationFrame(() => { const k = $('tabInk'); if (k) k.style.transition = ''; });
  els.mini.classList.toggle('hidden', view === 'player' || !P.lines.length);
  if (view !== 'nearby') els.mini.classList.remove('above-card');
  if (view === 'home') { renderHome(); if (homeReady) startHero(); }
  else stopHero();
  if (view === 'search') renderSearch();
  if (view === 'nearby') renderNearby();
  if (window.__plDockCheck) setTimeout(window.__plDockCheck, 60);
  if (view === 'settings') renderQuota();
  if (view === 'player') closeScript();
}
/* 손이 화면을 훑는 동안에는 탭바를 조금 물린다.
   위로 굴리든 아래로 굴리든 같다. 멈추면 제자리로 돌아온다. */
(() => {
  const bar = document.querySelector('.tabbar');
  let idle = 0;
  const onScroll = () => {
    bar.classList.add('shrink');
    clearTimeout(idle);
    idle = setTimeout(() => bar.classList.remove('shrink'), 420);
  };
  for (const el of document.querySelectorAll('.scroller, .transcript'))
    el.addEventListener('scroll', onScroll, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
})();

document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  // 탭으로 들어온 검색에는 뒤로 갈 곳이 없다
  if (b.dataset.view === 'search') { cameFrom = ''; els.searchBack.classList.add('hidden'); }
  goto(b.dataset.view);
});
/* 원 안에 재생 표시가 들어 있으니, 누르면 재생·일시정지가 되는 게 자연스럽다.
   플레이어 화면은 아래 탭으로 바로 갈 수 있다. */

/* 해설 패널 — 플레이어 안에서 열고 닫는다 */
function openScript() {
  els.scriptPanel.classList.remove('hidden');
  state.scriptOpen = true;
  fillScriptHead();
  paint();
  if (P.lines[P.idx]) P.lines[P.idx].el.scrollIntoView({ block: 'center' });
}
function fillScriptHead() {
  const shot = state.shots[state.slide] || state.shots[0];
  const url = shot?.url || state.image || '';
  els.scThumb.innerHTML = url ? `<img src="${url}" alt="">` : PIN_SM;
  els.scSub.textContent = els.addr.textContent || 'AI 도슨트';
}

function closeScript() {
  els.scriptPanel.classList.add('hidden');
  state.scriptOpen = false;
}
$('scriptClose').onclick = closeScript;

els.peek.onclick = openScript;

/* 해설 화면의 조작 — 플레이어와 같은 동작에 묶는다 */
els.scPlay.onclick = togglePlay;
$('scPrev').onclick = () => playFrom(P.idx - 1);
$('scNext').onclick = () => playFrom(P.idx + 1);
els.scTrack.onpointerdown = e => {
  if (!P.lines.length) return;
  els.scTrack.setPointerCapture(e.pointerId);
  const at = ev => {
    const r = els.scTrack.getBoundingClientRect();
    return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
  };
  const move = ev => { els.scFill.style.width = at(ev) * 100 + '%'; };
  move(e);
  els.scTrack.onpointermove = move;
  els.scTrack.onpointerup = ev => {
    els.scTrack.onpointermove = els.scTrack.onpointerup = null;
    const t = at(ev) * total();
    let i = P.lines.findIndex(l => t < l.start + l.dur);
    playFrom(i < 0 ? P.lines.length - 1 : i);
  };
};

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
els.mini.onclick = () => togglePlay();
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
  els.status.textContent = '목소리 준비 중';
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
  if (isNet(prefs.engine) && tts.available(prefs.engine)) return previewGoogle();
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

const ENGINE_NAME = { google: '구글', azure: 'Azure', eleven: 'ElevenLabs' };

function renderGVoices() {
  const name = ENGINE_NAME[prefs.engine] || '구글';
  if (els.netVoiceLabel) els.netVoiceLabel.textContent = `${name} 목소리`;
  if (!gvoices.length) {
    els.gvoiceList.innerHTML =
      `<p class="empty">${name} 키를 넣으면 목소리를 고를 수 있어요.</p>`;
    return;
  }
  // 왼쪽 동그라미로 고르고, 오른쪽 버튼으로 들어본다
  const picked = voiceOf();
  els.gvoiceList.innerHTML = gvoices.map(v => `
    <div class="vrow pick${v.id === picked ? ' on' : ''}" data-v="${v.id}"
         role="radio" aria-checked="${v.id === picked}" tabindex="0">
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
  const now = voiceOf();
  [...els.gvoiceList.querySelectorAll('.vrow')].forEach(r => {
    const on = r.dataset.v === now;
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

  if (alsoPick) { setVoiceOf(id); savePrefs(); }
  previewOf = id;
  previewLoading = id;            // 만드는 동안 스피너
  markVoiceButtons();

  try {
    const got = await tts.synth(SAMPLE, id, prefs.tone, prefs.engine);
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
  const g = isNet(prefs.engine);
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
  state.fallback = false;          // 엔진을 바꾸면 지난번 실패는 잊는다
  savePrefs();
  applyEngine();
  stopAll(); paint();
  loadNetVoices();
};

/* 고른 엔진의 목소리 목록을 받아 온다.
   구글은 붙박이지만 Azure·Eleven 은 열쇠로 물어봐야 알 수 있다. */
async function loadNetVoices() {
  if (!isNet(prefs.engine)) { gvoices = []; renderGVoices(); return; }
  if (!tts.available(prefs.engine)) {
    gvoices = []; renderGVoices(); openKeyBox(); return;
  }
  els.gvoiceList.innerHTML = '<p class="empty">목소리를 불러오는 중이에요.</p>';
  try {
    gvoices = await tts.voices(prefs.engine);
    if (!voiceOf() && gvoices.length) { setVoiceOf(gvoices[0].id); savePrefs(); }
  } catch (err) {
    gvoices = [];
    els.gvoiceList.innerHTML =
      `<p class="empty">${err.message === 'BADKEY'
        ? '키가 맞지 않아요. 다시 확인해 주세요.'
        : '목소리를 못 불렀어요. 키와 지역을 확인해 주세요.'}</p>`;
    return;
  }
  renderGVoices();
}

els.gvoiceList.onclick = e => {
  const play = e.target.closest('.vplay');
  if (play) { playVoiceSample(play.dataset.v, false); return; }   // 들어보기만
  const row = e.target.closest('.vrow');
  if (!row) return;
  setVoiceOf(row.dataset.v);                                      // 이 보이스로 정한다
  savePrefs();
  markVoiceButtons();
};

setTimeout(() => warmNearby(state.pos || SEOUL), 1200);   // 켜고 잠시 뒤 조용히

/* 지도 라이브러리(약 200KB)와 스타일을 한가할 때 미리 받아 둔다.
   탭을 누른 뒤에 받기 시작하면 휴대폰에서는 몇 초씩 걸린다.
   prefetch 라 다른 요청을 밀어내지 않고 남는 대역폭만 쓴다. */
const idle = window.requestIdleCallback || (fn => setTimeout(fn, 2500));
idle(() => {
  for (const href of [MAP_JS, MAP_STYLE]) {
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = href; l.as = href.endsWith('.js') ? 'script' : 'fetch';
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
}, { timeout: 4000 });

(async () => {
  // 화면에서 뺀 엔진이 저장돼 있으면 되돌린다
  if (prefs.engine === 'google' || prefs.engine === 'eleven') {
    prefs.engine = tts.available('azure') ? 'azure' : 'device';
    savePrefs();
  }
  if (isNet(prefs.engine) && !tts.available(prefs.engine)) prefs.engine = 'device';
  applyEngine();
  await loadNetVoices();
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
  els.apiDot.classList.toggle('on',
    !!(getKey('gemini') || getKey('azure') || getKey('eleven')));
  setChip(provider());
}

function openApiSheet() {
  const k = getKeys();
  els.geminiKey.value = k.gemini || '';
  els.azureKey.value = k.azure || '';
  els.azureRegion.value = k.azureRegion || '';
  els.elevenKey.value = k.eleven || '';
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
  setKey('azure', els.azureKey.value);
  setKey('azureRegion', els.azureRegion.value.trim().toLowerCase());
  setKey('eleven', els.elevenKey.value);
  setKey('pexels', els.pexelsKey.value);
  refreshKeyState();
  state.fallback = false;
  if (isNet(prefs.engine) && !tts.available(prefs.engine)) { prefs.engine = 'device'; savePrefs(); }
  applyEngine();
  loadNetVoices();
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
window.docent = { P, state, prefs, buildChunks, playChunk, fetchAudio,
  get map() { return mapObj; }, researchHere };

/* ══════════ 장소 상세 ══════════════════════════════════
   듣기 전에 한 장. 무엇을 듣게 되는지 보고 고르게 한다. */
const PL = { name: '', coord: null, data: null, seq: 0, back: 'home' };

/* 목소리 얼굴 — 보내주신 3D 캐릭터 사진의 결을 보고 SVG 로 그렸다.
   사진 자체는 저작권이 있어 쓰지 못하고 형태만 참고했다.
   48px 에서도 읽히도록 머리는 통으로 얹고 그 위에 얼굴을 올린다. */
const AV_SKIN = ['#FFE3D0', '#F8CBAE'];
const AV_DEEP = ['#F0BE9C', '#E5AF8D'];
const AV_HAIR = [['#8A5E40', '#5C3A26'], ['#6A4530', '#3B2519']];
/* 머리 모양은 셋뿐이라, 배경과 피부 톤을 따로 돌려 다섯이 다 달라 보이게 한다 */
const AV_BG = ['#BFCBEF', '#F0C6B2', '#EAC2DC', '#BADEC9', '#CCC6ED', '#AACBE8'];

/* 여성 셋 · 남성 셋 — 보내주신 사진의 머리와 옷을 따랐다 */
const AV_STYLE = [
  { s: 'f', hair: 'long',  wear: 'blazer', bg: '#BFCBEF', tone: 0 },  // 긴 생머리 · 회색 재킷
  { s: 'm', hair: 'crop',  wear: 'tee',    bg: '#AACBE8', tone: 1 },  // 단정한 머리 · 하늘 티셔츠
  { s: 'f', hair: 'half',  wear: 'blazer', bg: '#F0C6B2', tone: 1 },  // 반묶음 · 회색 재킷
  { s: 'm', hair: 'messy', wear: 'hood',   bg: '#BADEC9', tone: 0 },  // 부스스한 머리 · 후드
  { s: 'f', hair: 'pony',  wear: 'shirt',  bg: '#EAC2DC', tone: 0 },  // 포니테일 · 흰 셔츠
  { s: 'm', hair: 'side',  wear: 'shirt',  bg: '#CCC6ED', tone: 1 },  // 옆가르마 · 흰 셔츠
];

/* 얼굴 뒤로 흐르는 머리 — 어깨까지 내려온다 */
const AV_BACK = {
  long: '<path d="M23 46c0-17 12-28 27-28s27 11 27 28c0 16-2 30-5 42H62c3-12 5-25 5-38 0-12-7-19-17-19s-17 7-17 19c0 13 2 26 5 38H28c-3-12-5-26-5-42Z"/>',
  half: '<path d="M25 46c0-16 11-26 25-26s25 10 25 26c0 11-1 21-3 30h-9c2-9 3-19 3-28 0-11-6-17-16-17s-16 6-16 17c0 9 1 19 3 28h-9c-2-9-3-19-3-30Z"/>'
      + '<path d="M70 24c8 3 12 10 12 19 0 7-2 14-5 20l-7-3c3-6 4-11 4-16 0-7-2-12-7-15l3-5Z"/>',
  pony: '<path d="M26 46c0-15 11-25 24-25s24 10 24 25c0 6-.4 12-1 17h-8c.8-5 1-11 1-16 0-11-6-17-16-17s-16 6-16 17c0 5 .2 11 1 16h-8c-.6-5-1-11-1-17Z"/>'
      + '<path d="M67 25c9 3 14 11 14 22 0 9-3 17-7 24l-8-4c4-6 6-13 6-20 0-8-3-14-9-17l4-5Z"/>',
  crop: '', messy: '', side: '',
};

/* 앞머리 — 얼굴 위에 얹는다.
   위쪽 곡선은 얼굴 타원을 그대로 따라가고, 아래 곡선이 머리 모양을 만든다. */
const AV_FRINGE = {
  long:  'M29.8 48A20.5 22.5 0 0 1 70.2 48C66 42.6 59.6 40 50 40s-16 2.6-20.2 8Z',
  pony:  'M31.4 43.6A20.5 22.5 0 0 1 68.6 43.6C64.6 38.8 58.2 36.6 50 36.6s-14.6 2.2-18.6 7Z',
  half:  'M30.6 45.8A20.5 22.5 0 0 1 69.4 45.8C66 40.2 59 37.4 50 37.4s-16 2.8-19.4 8.4Z',
  crop:  'M30.4 46.6A20.5 22.5 0 0 1 69.6 46.6C66.4 41 59.4 38.2 50 38.2s-16.4 2.8-19.6 8.4Z',
  messy: 'M29.8 48A20.5 22.5 0 0 1 70.2 48c-1.6-4-4.4-6-6.6-5.2 1-2.4 0-4.6-1.8-5.4-2 3-5 4.4-8.4 4-1.4-2-3.6-2.8-5.8-2.2-2.6 2.6-6 3.6-9.6 3-3.4 1-6.4 3.6-8.2 8Z',
  side:  'M29.8 48A20.5 22.5 0 0 1 70.2 48c-1-6.6-5.4-10.6-12-11.6C50 35.2 40.4 39 33.8 43c-1.8 1.2-3.2 2.8-4 5Z',
};
/* 여성은 앞으로 흘러내린 옆머리로 한눈에 구분된다 */
const AV_LOCK = {
  long: '<path d="M28.6 44c-2 8-2.6 18-1.6 30l6 .6c-1-11-.6-20 1-27l-5.4-3.6Z"/>'
      + '<path d="M71.4 44c2 8 2.6 18 1.6 30l-6 .6c1-11 .6-20-1-27l5.4-3.6Z"/>',
  half: '<path d="M29 46c-1.4 6-1.8 13-1.2 21l5 .4c-.6-8-.4-14 .8-19L29 46Z"/>',
  pony: '<path d="M30 45c-1 5-1.2 10-.8 16l4.4.4c-.4-6-.3-11 .6-15L30 45Z"/>',
  crop: '', messy: '', side: '',
};

/* 옷 — 어깨선과 깃 */
const AV_WEAR = {
  blazer: `<path d="M50 80c-19 0-32 10-35 28-.5 3-.8 5-.8 7h71.6c0-2-.3-4-.8-7-3-18-16-28-35-28Z" fill="#B4B8C2"/>
    <path d="M41 81l9 14 9-14c-3-1-6-1.5-9-1.5s-6 .5-9 1.5Z" fill="#FDFDFE"/>
    <path d="M39 81c-6 2-11 5-14 8l11 26h4l-1-34Z" fill="#989DA8"/>
    <path d="M61 81c6 2 11 5 14 8l-11 26h-4l1-34Z" fill="#989DA8"/>`,
  shirt: `<path d="M50 80c-19 0-32 10-35 28-.5 3-.8 5-.8 7h71.6c0-2-.3-4-.8-7-3-18-16-28-35-28Z" fill="#FCFCFD"/>
    <path d="M40 80l10 12-5 6-9-15 4-3Z" fill="#E9EAEE"/>
    <path d="M60 80l-10 12 5 6 9-15-4-3Z" fill="#E9EAEE"/>
    <path d="M50 92v23" stroke="#DDDFE4" stroke-width="1.3" fill="none"/>`,
  tee: `<path d="M50 80c-19 0-32 10-35 28-.5 3-.8 5-.8 7h71.6c0-2-.3-4-.8-7-3-18-16-28-35-28Z" fill="#A6CEEA"/>
    <path d="M39 81c4 7 8 11 11 11s7-4 11-11c-3.4-1-7-1.5-11-1.5s-7.6.5-11 1.5Z" fill="#8ABAD9"/>`,
  hood: `<path d="M50 80c-19 0-32 10-35 28-.5 3-.8 5-.8 7h71.6c0-2-.3-4-.8-7-3-18-16-28-35-28Z" fill="#E2E3E8"/>
    <path d="M38 80c3.4 9 8 14 12 14s8.6-5 12-14c-3.6-1-7.6-1.5-12-1.5s-8.4.5-12 1.5Z" fill="#FBFBFC"/>
    <path d="M35 81c-6 2-10 5-13 9 6 5 10 11 12 18l5-27h-4Z" fill="#CCCED5"/>
    <path d="M65 81c6 2 10 5 13 9-6 5-10 11-12 18l-5-27h4Z" fill="#CCCED5"/>
    <path d="M50 94v21" stroke="#C3C5CD" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
};

function faceSVG(i, male) {
  /* 성별에 맞는 것들 중에서 골라, 옆자리와 겹치지 않게 한다 */
  const pool = AV_STYLE.filter(a => a.s === (male ? 'm' : 'f'));
  const a = pool[i % pool.length];
  const tone = (i + (male ? 1 : 0)) % 2;
  const bg = AV_BG[(i * 2 + (male ? 1 : 0)) % AV_BG.length];
  const sk = AV_SKIN[tone], dp = AV_DEEP[tone];
  const [h1, h2] = AV_HAIR[tone];
  const u = `v${male ? 'm' : 'f'}${i}`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <radialGradient id="bg${u}" cx="34%" cy="18%" r="94%">
      <stop offset="0" stop-color="#FFF" stop-opacity=".66"/>
      <stop offset="1" stop-color="${bg}"/>
    </radialGradient>
    <linearGradient id="sk${u}" x1="24%" y1="6%" x2="80%" y2="98%">
      <stop offset="0" stop-color="#FFF3E9"/><stop offset=".55" stop-color="${sk}"/>
      <stop offset="1" stop-color="${dp}"/>
    </linearGradient>
    <linearGradient id="hr${u}" x1="18%" y1="0%" x2="82%" y2="86%">
      <stop offset="0" stop-color="${h1}"/><stop offset="1" stop-color="${h2}"/>
    </linearGradient>
    <clipPath id="cp${u}"><circle cx="50" cy="50" r="50"/></clipPath>
  </defs>
  <g clip-path="url(#cp${u})">
    <circle cx="50" cy="50" r="50" fill="url(#bg${u})"/>
    <g fill="url(#hr${u})">${AV_BACK[a.hair] || ''}</g>
    ${AV_WEAR[a.wear]}
    <path d="M42 66h16v14a8 8 0 0 1-16 0V66Z" fill="${dp}"/>
    <ellipse cx="50" cy="79" rx="10" ry="4" fill="#000" opacity=".07"/>
    <ellipse cx="50" cy="45" rx="24" ry="25" fill="url(#hr${u})"/>
    <ellipse cx="28.5" cy="53" rx="3.8" ry="4.8" fill="${sk}"/>
    <ellipse cx="71.5" cy="53" rx="3.8" ry="4.8" fill="${sk}"/>
    <ellipse cx="50" cy="52" rx="20.5" ry="22.5" fill="url(#sk${u})"/>
    <ellipse cx="41" cy="40" rx="9" ry="7" fill="#FFF" opacity=".2"/>
    <ellipse cx="36.5" cy="59" rx="4.2" ry="2.8" fill="#F79A8C" opacity=".38"/>
    <ellipse cx="63.5" cy="59" rx="4.2" ry="2.8" fill="#F79A8C" opacity=".38"/>
    <ellipse cx="41.8" cy="53.5" rx="4.4" ry="5" fill="#FFF"/>
    <ellipse cx="58.2" cy="53.5" rx="4.4" ry="5" fill="#FFF"/>
    <ellipse cx="42.1" cy="54" rx="3.4" ry="4" fill="#513524"/>
    <ellipse cx="58.5" cy="54" rx="3.4" ry="4" fill="#513524"/>
    <circle cx="42.1" cy="54.4" r="1.7" fill="#241811"/>
    <circle cx="58.5" cy="54.4" r="1.7" fill="#241811"/>
    <circle cx="43.4" cy="52.2" r="1.4" fill="#FFF"/>
    <circle cx="59.8" cy="52.2" r="1.4" fill="#FFF"/>
    <path d="M36.5 45.6c1.8-1.8 5.4-2.2 7.7-.9" stroke="${h2}" stroke-width="2"
          stroke-linecap="round" fill="none"/>
    <path d="M63.5 45.6c-1.8-1.8-5.4-2.2-7.7-.9" stroke="${h2}" stroke-width="2"
          stroke-linecap="round" fill="none"/>
    <path d="M48.8 60.6c1 .9 1.4 .9 2.4 0" stroke="${dp}" stroke-width="1.3"
          stroke-linecap="round" fill="none"/>
    <path d="M45.6 64.6c1.7 2.2 3 3.1 4.4 3.1s2.7-.9 4.4-3.1" fill="#E58A80"/>
    <path d="M45.6 64.6c1.7 2.2 3 3.1 4.4 3.1s2.7-.9 4.4-3.1" stroke="#C4685F" stroke-width="1.4"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="${AV_FRINGE[a.hair]}" fill="url(#hr${u})"/>
    <g fill="url(#hr${u})">${AV_LOCK[a.hair] || ''}</g>
    <path d="M38 30c5 4 12 6 19 5" stroke="#FFF" stroke-width="1.6" stroke-linecap="round"
          fill="none" opacity=".26"/>
  </g>
</svg>`;
}

async function openPlace(name) {
  if (!name) return;
  PL.name = name;
  PL.back = state.view === 'place' ? PL.back : (state.view || 'home');
  const seq = ++PL.seq;
  warmPlace(name);
  goto('place');
  $('view-place').scrollTo({ top: 0 });

  // 아는 것부터 먼저 채운다
  $('plName').textContent = name;
  $('plKind').textContent = '';
  $('plAddr').textContent = '';
  $('plSummary').textContent = '요약하고 있어요';
  $('plStory').textContent = '';
  $('plImg').removeAttribute('src');
  $('plDistWrap').hidden = true;
  for (const id of ['plGeoSec', 'plTrendSec', 'plNearSec']) $(id).classList.add('hidden');
  markLiked();
  drawVoicePicks();
  drawPostLinks(name);

  let hit = null;
  try { hit = await geo2.identify(name); } catch (_) {}
  if (seq !== PL.seq) return;
  if (hit) {
    PL.coord = hit.lat != null ? { lat: hit.lat, lon: hit.lon } : null;
    /* 위키데이터에 한국어 설명이 없으면 영어가 온다.
       'Korean cultural heritage item' 같은 건 읽는 사람에게 도움이 안 된다. */
    /* 칩은 한 낱말 자리다 — '경기도 수원시에 위치한 조선시대의 성'은 설명이지 종류가 아니다 */
    const d = (hit.desc || '').trim();
    const ko = /[가-힣]/.test(d) && d.length <= 10 ? d : '';
    PL.kindFixed = !!ko;
    $('plKind').textContent = ko || geo2.TIER_LABEL[hit.tier] || '장소';
    if (!ko) score.typesOf([name]).then(m => {
      if (seq !== PL.seq || PL.kindFixed) return;
      const t = (m[name] || []).find(x => /[가-힣]/.test(x));
      if (t) $('plKind').textContent = t;
    }).catch(() => {});
  }

  let data = null;
  try { data = await wiki.gather({ manual: name }); } catch (_) {}
  if (seq !== PL.seq) return;
  PL.data = data;
  if (data) {
    if (data.coord) PL.coord = data.coord;
    if (data.image) $('plImg').src = data.image;
    $('plName').textContent = data.place || name;
    /* '요새'보다 '산성'이 낫다 — 백과사전 첫 문장의 정의어가 가장 정확하다 */
    if (!PL.kindFixed) {
      const k = kindFrom(data.sources?.[0]?.text || '', data.place || name);
      if (k) { PL.kindFixed = true; $('plKind').textContent = k; }
      else if (!$('plKind').textContent) $('plKind').textContent = '장소';
    }
    fillSummary(data);
    fillStory(data, seq);
  }
  fillWhere();
  fillTrend(data?.place || name, seq);
  fillNear(seq);
}

/* 종류 — '…은 백제 시대의 산성이다'에서 '산성'만 꺼낸다.
   문장 끝 정의어를 먼저 보고, 안 잡히면 장소 낱말을 훑는다. */
const KIND_SKIP = /이름|하나|것|곳|말|약칭|줄임말|지역명|지역|장소|건축물|구조물|시설|건물/;
const KIND_WORDS = ['해수욕장','국립공원','도립공원','놀이공원','테마파크','전망대','미술관','박물관',
  '기념관','도서관','식물원','동물원','수목원','유원지','대성당','성당','사찰','사원','향교','서원',
  '궁궐','궁전','왕궁','고궁','산성','읍성','성곽','고분','왕릉','유적','폭포','계곡','저수지','호수',
  '해변','해안','항구','등대','시장','거리','광장','공원','다리','타워','마을','온천','산책로',
  '천문대','고택','정자','누각','고분군','사지','능','묘','터',
  '섬','산','강','절','탑','성','문','역','댐','길'];
function kindFrom(text, title = '') {
  let c = (text || '').replace(/\s+/g, ' ').split(/(?<=다)\.\s/)[0] || '';
  if (title && c.startsWith(title)) c = c.slice(title.length);
  const m = c.match(/([가-힣]{1,8})(?:이다|입니다|이었다|였다)\s*\.?\s*$/)
         || c.match(/([가-힣]{1,8})(?:이자|이며)/)
         || c.match(/([가-힣]{2,8})(?:으로|로),/);   // '…석조 건축물로, 가장 오래된…'
  let k = m?.[1] || '';
  if (k && KIND_SKIP.test(k)) k = '';
  if (k.length > 1) return k;
  for (const w of KIND_WORDS) if (c.includes(w)) return w;
  return k;
}

/* AI 요약 — 백과사전 말투를 걷어내고 세 줄 안에 담는다.
   '사적 제12호로, 대한민국 충청남도 …에 소재하고 있는 성이다' 같은 문장은
   읽는 사람에게 아무것도 남기지 않는다. */
/* 글자 수로 어림잡으면 어떤 문장은 두 줄, 어떤 문장은 네 줄이 된다.
   그려 놓고 높이를 재서 세 줄을 넘기 직전까지만 담는다. */
const SUM_LINES = 3;
function tidy(line) {
  return llm.soften(line).replace(/\s+([,.])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
function fillSummary(data) {
  const el = $('plSummary');
  const raw = (data.sources?.[0]?.text || '').replace(/\s+/g, ' ').trim();
  if (!raw) { el.textContent = '아직 자료가 없어요'; return; }
  /* 제목이 바로 위에 있는데 문장마다 '불국사는'으로 시작하면 지겹다 */
  const name = data.place || '';
  const dup = name && new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:은|는|이|가)\\s*');
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 21;
  const cap = lh * SUM_LINES + 2;

  el.textContent = '';
  let out = '';
  for (const line of raw.split(/(?<=[.!?])\s+/)) {
    let t = tidy(line);
    if (out && dup) t = t.replace(dup, '');
    if (!t) continue;
    const next = out ? `${out} ${t}` : t;
    el.textContent = next;
    if (out && el.clientHeight > cap) { el.textContent = out; return; }
    out = next;
  }
  if (!out) el.textContent = tidy(raw);
}

/* 이야기 — 첫 문장을 굵게 세워 눈이 걸리게 한다 */
async function fillStory(data, seq) {
  const el = $('plStory');
  el.textContent = '이야기를 쓰고 있어요';
  let out = '';
  try {
    for await (const t of llm.stream(data, { length: 'normal', here: false })) {
      if (seq !== PL.seq) return;
      out += t;
      const [first, ...rest] = out.split(/(?<=[.!?])\s+/);
      el.innerHTML = `<b>${esc(first)}</b> ${esc(rest.join(' '))}`;
    }
  } catch (_) {
    if (out) return;
    el.textContent = (data.sources?.[0]?.text || '').slice(0, 600) || '이야기를 못 불렀어요';
  }
}
const esc = t => (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* 어디에 있나 — 주소와 여기서부터의 거리 */
async function fillWhere() {
  const d = PL.data;
  /* 본문에서 주소를 긁어내면 '충청남도 공주시'까지밖에 안 나온다.
     좌표를 주소로 되돌리면 번지까지 온전히 얻을 수 있다. */
  $('plAddr').textContent = (d?.sources?.[0]?.text || '')
    .match(/[가-힣]+(특별시|광역시|특별자치시|특별자치도|도)\s?[가-힣]+[시군구]/)?.[0] || '';
  if (PL.coord) {
    const seq = PL.seq;
    geo.reverse(PL.coord.lat, PL.coord.lon).then(r => {
      if (seq === PL.seq && r.address) $('plAddr').textContent = r.address;
    }).catch(() => {});
  }
  if (state.pos && PL.coord) {
    const m = metersBetween(state.pos, PL.coord);
    $('plDist').textContent = m > 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
    $('plDistWrap').hidden = false;
  }
  const facts = [];
  if (PL.coord) facts.push(['좌표', `${PL.coord.lat.toFixed(4)}, ${PL.coord.lon.toFixed(4)}`]);
  if (PL.data?.nearby?.length) facts.push(['가까운 곳', PL.data.nearby.slice(0, 3).join(' · ')]);
  if (facts.length) {
    $('plFacts').innerHTML = facts.map(([k, v]) =>
      `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('plGeoSec').classList.remove('hidden');
  }
}

/* 언제 많이 찾을까 — 위키백과 조회수의 달별 흐름 */
/* 막대는 눈에 들어온 뒤에 자란다 — 스크롤해 내려오면 그때 움직인다 */
let trendWatch = null;
function growOnView(el) {
  trendWatch?.disconnect();
  if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
  trendWatch = new IntersectionObserver((es, o) => {
    if (!es.some(e => e.isIntersecting)) return;
    requestAnimationFrame(() => el.classList.add('in'));
    o.disconnect();
  }, { root: $('view-place'), threshold: 0.25 });
  trendWatch.observe(el);
}

async function fillTrend(title, seq) {
  const rows = await place.monthlyInterest(title);
  if (seq !== PL.seq || !rows) return;
  const max = Math.max(...rows.map(r => r.views)) || 1;
  const peak = rows.reduce((a, b) => (b.views > a.views ? b : a));
  const chart = $('plTrend');
  chart.classList.remove('in');
  chart.innerHTML = rows.map((r, i) => `
    <span class="${r === peak ? 'peak' : ''}">
      <i style="--h:${Math.max(4, (r.views / max) * 100)}%;--i:${i}"></i>
      <em>${r.month}</em>
    </span>`).join('');
  growOnView(chart);
  $('plTrendNote').textContent =
    `${peak.month}월에 가장 많이 찾아봤어요. 위키백과 조회수 기준이라 실제 방문객 수는 아니에요.`;
  $('plTrendSec').classList.remove('hidden');
}

/* 같이 둘러볼 곳 — 셋에서 여덟 곳 */
async function fillNear(seq) {
  if (!PL.coord) return;
  try {
    const list = await wiki.nearby(PL.coord.lat, PL.coord.lon, 5000, 40);
    if (seq !== PL.seq) return;
    const cand = list.map(x => x.title)
      .filter(n => n !== PL.name && !geo2.adminName(n) && !geo2.boring(n));
    const ranked = await score.rank(cand.slice(0, 24).map(n => ({ name: n })),
                                    { pos: state.pos, views: false });
    if (seq !== PL.seq) return;
    const names = ranked.map(x => x.name).slice(0, 8);
    if (names.length < 3) return;
    fillCards($('plNear'), names);
    $('plNearSec').classList.remove('hidden');
  } catch (_) {}
}

/* 목소리 고르기 */
/* 원 아래 이름은 한 단어면 충분하다.
   'Hyunsu (Korea)' 처럼 길면 잘려서 '…' 만 남는다. */
function shortVoice(label) {
  const t = (label || '').replace(/\s*\([^)]*\)/g, '').replace(/ 목소리$/, '').trim();
  return t.split(/[\s·]/)[0] || t;
}

function drawVoicePicks() {
  const host = $('plVoices');
  /* 인터넷 보이스가 없으면 이 기기의 목소리를 보여준다.
     '설정에서 고르세요'라고만 하면 아무것도 못 고른다. */
  /* 옆으로 미는 줄이라 다 담아도 된다 — 고를 수 있는 목소리를 감출 이유가 없다 */
  const net = gvoices.length ? gvoices.slice(0, 9) : [];
  const list = net.length ? net
    : [...els.voiceSel.options].slice(0, 9).map(o => ({ id: o.value, label: shortVoice(o.text) }));
  if (!list.length) {
    host.innerHTML = '<p class="pl-note">설정에서 목소리를 먼저 골라 주세요</p>';
    return;
  }
  const now = net.length ? voiceOf() : els.voiceSel.value;
  host.dataset.kind = net.length ? 'net' : 'device';
  /* 얼굴은 성별 안에서 차례로 돌린다 — 나란히 선 둘이 겹치지 않게 */
  const seen = { m: 0, f: 0 };
  host.innerHTML = list.map((v) => {
    const male = /남성|male/i.test(v.desc || '');
    const i = male ? seen.m++ : seen.f++;
    return `<button class="vpick${v.id === now ? ' on' : ''}" data-v="${v.id}">
      <span class="vface">${faceSVG(i, male)}</span>
      <b>${shortVoice(v.label)}</b></button>`;
  }).join('');
  [...host.children].forEach(b => {
    b.onclick = () => {
      if (host.dataset.kind === 'net') { setVoiceOf(b.dataset.v); markVoiceButtons(); }
      else { els.voiceSel.value = b.dataset.v; prefs.voice = b.dataset.v; els.voiceNow.textContent = b.dataset.v; }
      savePrefs();
      [...host.children].forEach(x => x.classList.toggle('on', x === b));
    };
  });
}

/* 다른 사람들의 기록 — 검색 서비스 열쇠가 없어 결과로 이어 준다 */
const OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M8.5 6h9.5v9.5M18 6 6 18"/></svg>';
function drawPostLinks(name) {
  const q = encodeURIComponent(name + ' 여행');
  $('plPosts').innerHTML = [
    ['네이버 블로그', `https://search.naver.com/search.naver?where=blog&query=${q}`],
    ['인스타그램', `https://www.instagram.com/explore/tags/${encodeURIComponent(name.replace(/\s/g, ''))}/`],
    ['유튜브', `https://www.youtube.com/results?search_query=${q}`],
  ].map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}${OUT}</a>`).join('');
}

/* 찜 · 공유 */
function markLiked() {
  $('plLike').classList.toggle('on', place.liked().includes(PL.name));
}
$('plLike').onclick = () => {
  const on = place.toggleLike(PL.name);
  markLiked();
  notify(on ? '찜했어요' : '찜을 풀었어요');
};
$('plShare').onclick = async () => {
  const r = await place.share(PL.name, $('plSummary').textContent.slice(0, 80));
  if (r === 'copied') notify('링크를 복사했어요');
  if (r === 'fail') notify('공유하지 못했어요');
};

$('plBack').onclick = () => goto(PL.back || 'home');

/* 왼쪽 가장자리에서 오른쪽으로 밀면 뒤로 — 한 손으로 빠져나올 수 있게.
   손가락을 따라 화면이 같이 밀리고, 절반쯤 왔을 때 놓으면 넘어간다. */
(() => {
  const EDGE = 30, TAKE = 0.32, FLICK = 0.5;   // 시작 폭, 넘길 비율, 던지는 속도(px/ms)
  const PANES = { place: () => PL.back || 'home', search: () => cameFrom || 'home' };
  let pane = null, back = '', x0 = 0, y0 = 0, t0 = 0, dx = 0, live = false, judged = false;

  const paint = (v, ms) => {
    pane.style.transition = ms ? `transform ${ms}ms cubic-bezier(.32,.72,0,1)` : 'none';
    pane.style.transform = v ? `translate3d(${v}px,0,0)` : '';
  };
  const done = () => { pane.style.transition = ''; pane.style.transform = ''; pane = null; };

  addEventListener('touchstart', e => {
    const go = PANES[state.view];
    if (!go || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (t.clientX > EDGE) return;
    pane = $('view-' + state.view); back = go();
    x0 = t.clientX; y0 = t.clientY; t0 = performance.now();
    dx = 0; live = false; judged = false;
    pane.style.willChange = 'transform';
  }, { passive: true });

  addEventListener('touchmove', e => {
    if (!pane) return;
    const t = e.touches[0];
    dx = t.clientX - x0;
    if (!judged) {
      // 세로로 먼저 움직였다면 스크롤이지 뒤로가기가 아니다
      if (Math.abs(t.clientY - y0) > Math.abs(dx)) { pane.style.willChange = ''; pane = null; return; }
      if (Math.abs(dx) < 8) return;
      judged = true; live = true;
    }
    if (live) paint(Math.max(0, dx), 0);
  }, { passive: true });

  const finish = () => {
    if (!pane) return;
    const p = pane;
    if (!live) { p.style.willChange = ''; pane = null; return; }
    const speed = dx / Math.max(1, performance.now() - t0);
    if (dx > innerWidth * TAKE || speed > FLICK) {
      paint(innerWidth, 260);
      setTimeout(() => { goto(back); p.style.transition = ''; p.style.transform = ''; p.style.willChange = ''; }, 250);
      pane = null;
    } else {
      paint(0, 220);
      setTimeout(() => { p.style.transition = ''; p.style.transform = ''; p.style.willChange = ''; }, 220);
      pane = null;
    }
  };
  addEventListener('touchend', finish, { passive: true });
  addEventListener('touchcancel', finish, { passive: true });
})();
$('plHero').onclick = () => {
  const url = $('plImg').getAttribute('src');
  if (!url) return;
  vwList = [{ url, title: PL.name }];
  openViewer(0);
};
const goListen = () => { if (PL.name) startNarration(PL.name); };
$('plCta').onclick = goListen;
$('plCta2').onclick = goListen;

/* 위쪽 버튼이 화면 밖으로 나가면 아래에서 올라온다 */
(() => {
  const view = $('view-place'), dock = $('plDock'), btn = $('plCta'), bar = $('plBar');
  const check = () => {
    if (state.view !== 'place') { dock.classList.remove('on'); return; }
    // 위 버튼이 화면 아래로 사라지면 그때 아래 버튼이 올라온다
    const r = btn.getBoundingClientRect();
    dock.classList.toggle('on', r.top > innerHeight - 96 || r.bottom < 0);
    // 사진을 지나면 막대에 흰 바탕이 깔린다
    bar.classList.toggle('solid', view.scrollTop > 190);
  };
  view.addEventListener('scroll', check, { passive: true });
  window.__plDockCheck = check;
})();

/* 길안내 — 이 기기에 깔린 지도 앱으로 넘긴다 */
$('plRoute').onclick = () => {
  if (!PL.coord) { notify('좌표를 찾지 못했어요'); return; }
  $('routeApps').innerHTML = place.ROUTE_APPS.map(a =>
    `<button class="appbtn" data-a="${a.id}">
       <i style="background:${a.color};color:${a.ink || '#FFF'}">${a.mark}</i>
       <b>${a.name}</b></button>`).join('');
  [...$('routeApps').children].forEach(b => {
    b.onclick = () => {
      place.openRoute(b.dataset.a, state.pos, PL.coord, PL.name);
      closeRoute();
    };
  });
  $('routeSheet').classList.remove('hidden');
  $('routeInner').style.transform = '';
};
function closeRoute() {
  $('routeInner').style.transition = 'transform .22s ease';
  $('routeInner').style.transform = 'translateY(100%)';
  setTimeout(() => {
    $('routeSheet').classList.add('hidden');
    $('routeInner').style.transition = '';
    $('routeInner').style.transform = '';
  }, 220);
}
/* 손잡이를 끌어 여닫는다. 아래로 끌면 닫히고, 살짝 올리면 제자리로 돌아온다. */
(() => {
  const inner = $('routeInner'), head = $('routeHead');
  let y0 = 0, dy = 0, on = false;
  const start = e => { on = true; dy = 0; y0 = e.clientY; inner.style.transition = 'none'; };
  const move = e => {
    if (!on) return;
    dy = e.clientY - y0;
    inner.style.transform = `translateY(${Math.max(-12, dy)}px)`;   // 위로는 살짝만
  };
  const end = () => {
    if (!on) return;
    on = false;
    inner.style.transition = 'transform .26s var(--gentle)';
    if (dy > 80) { closeRoute(); return; }
    inner.style.transform = '';
  };
  head.addEventListener('pointerdown', start);
  addEventListener('pointermove', move);
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
})();
