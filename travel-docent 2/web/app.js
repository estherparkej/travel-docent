import * as wiki from './lib/wiki.js';
import * as llm from './lib/llm.js';
import * as tts from './lib/tts.js';
import * as photos from './lib/photos.js';
import * as geo from './lib/geo.js';
import { getKey, setKey, getKeys, provider } from './lib/keys.js';

window.__boot = [];
window.addEventListener('error', e => window.__boot.push(e.message + ' @' + e.lineno));


/* 여행 도슨트 — 플레이어
   해설 한 편이 한 곡, 문장 하나가 가사 한 줄이다.
   문장 단위로 이전·다음·탐색이 되고, 아트워크에서 뽑은 색이 화면 배경이 된다. */

const $ = id => document.getElementById(id);
const els = {
  status: $('statusLabel'), name: $('placeName'), addr: $('placeAddr'),
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
  banner: $('homeBanner'), bannerImg: $('bannerImg'), bannerTitle: $('bannerTitle'),
  bannerDesc: $('bannerDesc'), recentShelf: $('recentShelf'), recentRow: $('recentRow'),
  pickList: $('pickList'), nearShelf: $('nearShelf'), nearList: $('nearList'),
  sugList: $('sugList'), searchForm: $('searchForm'), searchInput: $('searchInput'),
  logList: $('logList'), logEmpty: $('logEmpty'),
  mini: $('mini'), miniImg: $('miniImg'), miniEq: $('miniEq'), miniTitle: $('miniTitle'),
  miniSub: $('miniSub'), miniPlay: $('miniPlay'), miniFill: $('miniFill'),
  settings: $('settings'), lengthSeg: $('lengthSeg'), toneList: $('toneList'),
  voiceSel: $('voiceSel'), preview: $('previewVoice'), voiceHint: $('voiceHint'),
  engineSeg: $('engineSeg'), engineNote: $('engineNote'),
  deviceField: $('deviceField'), googleField: $('googleField'), gvoiceList: $('gvoiceList'),
  rateSel: $('rateSel'), rateVal: $('rateVal'),
  pitchSel: $('pitchSel'), pitchVal: $('pitchVal'),
  diag: $('diag'),
  keyAccHead: $('keyAccHead'), keyAccBody: $('keyAccBody'), keyState: $('keyState'),
  geminiKey: $('geminiKey'), pexelsKey: $('pexelsKey'), saveKeys: $('saveKeys'),
  sheetInner: $('sheetInner'), sheetHead: $('sheetHead'),
  accHead: $('voiceAccHead'), accBody: $('voiceAccBody'), voiceNow: $('voiceNow'),
};

const ICO = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.6 5.2c0-.83.9-1.34 1.6-.9l9.1 5.75a1.05 1.05 0 0 1 0 1.78L10.2 17.6c-.7.44-1.6-.07-1.6-.9V5.2Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.6" height="14" rx="1.3"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.3"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4.5V10h5.5"/></svg>',
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

/* ── 상태 ────────────────────────────────────────────────── */
const state = {
  pos: null, place: '', address: '', image: '',
  geocodedAt: null, narratedAt: null,
  heard: JSON.parse(localStorage.getItem('heard') || '[]'),
  streaming: false, unlocked: false, resolved: '', view: 'player', scriptOpen: false,
  manual: '',   // 검색이나 카드로 고른 장소
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

const CPS = 5.4;
const durOf = t => Math.max(1.1, t.length / (CPS * +els.rateSel.value) + 0.32);
const fmt = s => {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/* 바탕은 흰색 그라데이션으로 고정한다.
   예전엔 사진에서 색을 뽑아 배경에 깔았지만, 사진마다 배경색이 널뛰고
   글자색까지 뒤집혀야 해서 읽기가 불안정했다. 지금은 사진만 흰 바탕으로 녹인다. */
function applyArtColor() { /* 의도적으로 아무것도 하지 않는다 */ }

/* ── 목소리 ──────────────────────────────────────────────── */
/* 애플 기기의 한국어 음성 중 도슨트로 쓸 수 있는 건 사실상 유나 하나뿐이다.
   Eddy·Grandma·Rocko 같은 것들은 장난감 음성이라 목록에서 뺀다. */
const NOVELTY = /eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bells|bubbles|jester|organ|superstar|trinoids|whisper|wobble|boing|bahh|zarvox|cellos|albert|bad news|good news|deranged|hysterical|junior|ralph|fred|kathy|princess|novelty/i;
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
  els.diag.textContent = !usable.length
    ? '한국어 목소리를 찾지 못했어요. 기기 설정에서 한국어 음성을 먼저 추가해 주세요.'
    : `이 기기의 한국어 음성 ${pool.length}개 중 ${usable.length}개를 씁니다`
      + (dropped ? ` (장난감 음성 ${dropped}개 제외)` : '')
      + `. 네트워크 음성 ${net}개.`
      + (premium ? ' 프리미엄 음성이 적용됐어요.'
                 : ' 프리미엄 음성을 받으면 훨씬 자연스러워집니다.');
  els.voiceHint.classList.toggle('hidden', !!premium);
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function renderTones() {
  els.toneList.innerHTML = Object.entries(TONES).map(([k, t]) => `
    <button class="vcard${k === prefs.tone ? ' on' : ''}" data-v="${k}">
      <span><b>${t.label}</b><em>${t.desc}</em></span>
      <span class="vp">${ICO.play}</span>
    </button>`).join('');
}

// iOS/사파리는 사용자가 직접 누른 순간에만 음성을 열어준다
function unlockAudio() {
  if (state.unlocked) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
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
const capFor = n => (n === 0 ? 55 : n === 1 ? 130 : CHUNK_CHARS);

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
  try {
    got = await fetchAudio(chunk.text);
  } catch (e) {
    P.waiting = false;
    if (seq !== P.seq) return;
    return googleFailed(e.message, from);
  }
  P.waiting = false;
  if (seq !== P.seq) return;

  chunk.dur = got.dur || chunk.chars / 5.4;
  spread(chunk);

  const a = new Audio(got.url);
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
  a.play().catch(() => {});
  paint();
}

/* 구글 목소리가 막히면 조용히 멈추지 않고 기기 목소리로 이어 읽는다 */
function googleFailed(msg, fromLine) {
  notify(msg === 'QUOTA'
    ? '구글 목소리 분당 한도에 걸렸어요. 기기 목소리로 이어 읽을게요.'
    : '구글 목소리를 불러오지 못했어요. 기기 목소리로 이어 읽을게요.');
  prefs.engine = 'device';
  savePrefs();
  applyEngine();
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
  if (prefs.engine === 'google') {
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
  u.onstart = () => { if (seq === P.seq) { P.lineAt = performance.now(); highlight(); } };
  u.onend = u.onerror = () => {
    if (seq !== P.seq) return;
    P.speaking = false;
    advance();
  };
  P.speaking = true;
  P.lineAt = performance.now();
  speechSynthesis.speak(u);
  highlight();
  paint();
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

function killAudio() {
  if (P.audio) { P.audio.pause(); P.audio = null; }
  P.waiting = false;
}

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
  if (!P.speaking) return l.start;
  const held = P.paused ? P.heldFor : performance.now() - P.lineAt;
  return l.start + Math.min(held / 1000, l.dur);
}

function paint() {
  const dur = total(), cur = Math.min(elapsed(), dur);
  const pct = dur ? (cur / dur) * 100 : 0;
  if (!els.track.classList.contains('drag')) els.fill.style.width = pct + '%';
  els.miniFill.style.width = pct + '%';
  if (!els.track.classList.contains('drag')) els.tCur.textContent = fmt(cur);
  els.tDur.textContent = (state.streaming && !dur) ? '--:--' : fmt(dur);

  const busy = (state.streaming && !P.lines.length) || P.waiting;
  const on = P.playing && !P.paused;
  const replay = P.ended && !on;
  els.icoWait.hidden = !busy;
  els.icoReplay.hidden = busy || !replay;
  els.icoPlay.hidden = busy || on || replay;
  els.icoPause.hidden = busy || !on;
  els.play.setAttribute('aria-label', on ? '일시정지' : replay ? '처음부터 다시' : '재생');
  els.miniPlay.innerHTML = busy ? '' : (on ? ICO.pause : (P.ended ? ICO.replay : ICO.play));

  els.lower.classList.toggle('loading', busy);
  els.status.classList.toggle('mute', on);
  els.miniEq.hidden = !on || !!state.image;
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

setInterval(() => { if (P.playing && !P.paused) paint(); }, 250);

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
  if (prefs.engine === 'google') {
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
    showError('아직 위치를 확인하지 못했어요. 위치 권한을 허용했는지 확인해 주세요. '
            + '실내라면 설정에서 장소를 직접 입력할 수 있어요.');
    goto('script');
    return;
  }

  unlockAudio();
  stopAll();
  state.streaming = true;
  state.resolved = '';
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

    for await (const text of llm.stream(data, { length: prefs.length, heard: state.heard, again })) {
      got = true;
      buf += text;
      const { sentences, rest } = drainSentences(buf);
      buf = rest;
      sentences.forEach(addLine);
    }

    if (buf.trim()) addLine(buf.trim());
    if (got) remember(state.resolved || state.place || manual);
  } catch (e) {
    showError('해설을 받아오지 못했어요. ' + e.message);
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
  if (homeReady) renderRecent();
}

function renderLog() {
  const list = state.heard.slice().reverse();
  els.logEmpty.classList.toggle('hidden', !!list.length);
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
  els.name.textContent = '장소를 직접 입력해 주세요';
  els.addr.textContent = '오른쪽 위에서 지명을 적어 주세요';
}

if (!window.isSecureContext) {
  els.status.textContent = 'HTTPS가 아니어서 GPS를 쓸 수 없어요';
  els.name.textContent = '장소를 직접 입력해 주세요';
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

let homeReady = false;
function renderHome() {
  if (homeReady) { renderRecent(); return; }
  homeReady = true;

  const hour = new Date().getHours();
  $('homeGreet').textContent = hour < 11 ? '오늘 아침엔 어디를 걸어볼까요'
    : hour < 18 ? '오늘은 어디를 걸어볼까요' : '오늘 저녁엔 어디를 걸어볼까요';
  $('pickTitle').textContent = `${MONTH}월의 추천 도슨트`;

  // 배너는 날마다 바뀐다
  const seed = new Date().getDate() % PICKS.length;
  const top = PICKS[seed];
  els.bannerTitle.textContent = top;
  els.banner.onclick = () => playPlace(top);
  preview(top).then(d => {
    if (d.image) { els.bannerImg.src = d.image; els.bannerImg.hidden = false; }
    els.bannerDesc.textContent = d.summary || '지금 이 자리의 이야기를 들려드려요';
  });

  fillCards(els.pickList, PICKS.filter(p => p !== top).slice(0, 6));
  renderRecent();
}

function renderRecent() {
  const list = state.heard.slice().reverse().slice(0, 8);
  els.recentShelf.classList.toggle('hidden', !list.length);
  els.recentRow.innerHTML = list.map(p =>
    `<button class="chip" data-place="${p}"><img alt="" hidden><span>${p}</span></button>`).join('');
  [...els.recentRow.children].forEach(btn => {
    const name = btn.dataset.place;
    btn.onclick = () => playPlace(name);
    preview(name).then(d => {
      const img = btn.querySelector('img');
      if (d.image) { img.src = d.image; img.hidden = false; }
    });
  });
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

/* ── 화면 전환 ────────────────────────────────────────────
   홈 · 검색 · 플레이어 · 히스토리 · 설정 */
const VIEWS = ['home', 'search', 'player', 'history'];

function goto(view) {
  if (view === 'settings') { openSheet(); return; }
  state.view = view;
  VIEWS.forEach(v => $('view-' + v).classList.toggle('hidden', v !== view));
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.view === view));
  els.mini.classList.toggle('hidden', view === 'player' || !P.lines.length);
  if (view === 'home') renderHome();
  if (view === 'search') { renderSearch(); setTimeout(() => els.searchInput.focus(), 250); }
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
/* ── 설정 시트 열고 닫기 ─────────────────────────────────── */
function openSheet() {
  state.beforeSettings = state.view;
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('on', t.dataset.view === 'settings'));
  els.settings.classList.remove('hidden', 'closing');
  els.sheetInner.style.transform = '';
}
function closeSheet() {
  els.settings.classList.add('closing');
  els.sheetInner.style.transition = 'transform .22s ease';
  els.sheetInner.style.transform = 'translateY(100%)';
  setTimeout(() => {
    els.settings.classList.add('hidden');
    els.settings.classList.remove('closing');
    els.sheetInner.style.transition = '';
    els.sheetInner.style.transform = '';
    goto(state.beforeSettings || 'player');
  }, 220);
}
$('closeSettings').onclick = closeSheet;


/* 손잡이를 쓸어내리면 닫힌다 */
(() => {
  let y0 = 0, dy = 0, dragging = false;
  const start = e => {
    dragging = true; dy = 0;
    y0 = (e.touches ? e.touches[0].clientY : e.clientY);
    els.sheetInner.classList.add('drag');
  };
  const move = e => {
    if (!dragging) return;
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    dy = Math.max(0, y - y0);
    els.sheetInner.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    els.sheetInner.classList.remove('drag');
    if (dy > 110) { closeSheet(); return; }
    els.sheetInner.classList.add('snapback');
    els.sheetInner.style.transform = '';
    setTimeout(() => els.sheetInner.classList.remove('snapback'), 320);
  };
  els.sheetHead.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
})();

/* 음성 선택 아코디언 */
els.accHead.onclick = () => {
  const open = els.accHead.getAttribute('aria-expanded') === 'true';
  els.accHead.setAttribute('aria-expanded', String(!open));
  els.accBody.classList.toggle('hidden', open);
};
$('clearLog').onclick = () => {
  state.heard = []; localStorage.removeItem('heard'); renderLog();
  if (homeReady) renderRecent();
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
    els.diag.textContent = e.message === 'QUOTA'
      ? '구글 목소리 분당 한도에 걸렸어요. 20초쯤 뒤에 다시 눌러 주세요.'
      : '구글 목소리를 불러오지 못했어요. ' + e.message;
  }
  paint();
}

function previewVoice() {
  unlockAudio();
  if (P.playing && P.lines.length) { playFrom(P.idx); return; }  // 듣는 중이면 끊지 않는다
  if (prefs.engine === 'google') return previewGoogle();
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
function renderGVoices() {
  els.gvoiceList.innerHTML = gvoices.map(v => `
    <button class="vcard${v.id === prefs.gvoice ? ' on' : ''}" data-v="${v.id}">
      <span><b>${v.label}</b><em>${v.desc}</em></span>
      <span class="vp">${ICO.play}</span>
    </button>`).join('');
}

function applyEngine() {
  const g = prefs.engine === 'google';
  [...els.engineSeg.children].forEach(b => b.classList.toggle('on', b.dataset.v === prefs.engine));
  els.deviceField.classList.toggle('hidden', g);
  els.googleField.classList.toggle('hidden', !g);
  els.pitchSel.parentElement.style.opacity = g ? .35 : 1;
  els.pitchSel.disabled = g;
  els.engineNote.textContent = g
    ? '구글 신경망 음성이라 사람 목소리에 훨씬 가깝습니다. 문장마다 만드는 데 몇 초가 걸려서, 앱이 다음 문장을 미리 받아둡니다. 인터넷이 필요하고 Gemini 무료 한도를 씁니다.'
    : '기기에 설치된 음성으로 바로 읽습니다. 인터넷 없이도 되고 기다림이 없지만, 억양은 기계적입니다.';
}

els.engineSeg.onclick = e => {
  const b = e.target.closest('button');
  if (!b || b.dataset.v === prefs.engine) return;
  if (b.dataset.v === 'google' && !gvoices.length) {
    els.engineNote.textContent = '구글 목소리를 쓰려면 .env 에 GEMINI_API_KEY 가 필요합니다.';
    return;
  }
  prefs.engine = b.dataset.v;
  savePrefs();
  applyEngine();
  stopAll(); paint();
};

els.gvoiceList.onclick = e => {
  const b = e.target.closest('.vcard');
  if (!b) return;
  prefs.gvoice = b.dataset.v;
  [...els.gvoiceList.children].forEach(x => x.classList.toggle('on', x === b));
  savePrefs();
  previewVoice();
};

(async () => {
  const d = { ok: tts.available(), voices: tts.VOICES };
  gvoices = d.ok ? d.voices : [];
  if (!gvoices.length && prefs.engine === 'google') prefs.engine = 'device';
  renderGVoices();
  applyEngine();
})();

els.toneList.onclick = e => {
  const b = e.target.closest('.vcard');
  if (!b) return;
  prefs.tone = b.dataset.v;
  const t = TONES[prefs.tone];
  prefs.rate = t.rate; prefs.pitch = t.pitch;
  els.rateSel.value = t.rate; els.rateVal.textContent = t.rate.toFixed(2).replace(/0$/, '');
  els.pitchSel.value = t.pitch; els.pitchVal.textContent = t.pitch.toFixed(2).replace(/0$/, '');
  paintRange(els.rateSel); paintRange(els.pitchSel);
  [...els.toneList.children].forEach(x => x.classList.toggle('on', x === b));
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
  const g = getKey('gemini'), x = getKey('pexels');
  els.keyState.textContent = g ? (x ? 'Gemini · Pexels' : 'Gemini') : '없음';
  els.keyState.style.color = g ? 'var(--acc-deep)' : 'var(--dim2)';
  setChip(provider());
}

els.keyAccHead.onclick = () => {
  const open = els.keyAccHead.getAttribute('aria-expanded') === 'true';
  els.keyAccHead.setAttribute('aria-expanded', String(!open));
  els.keyAccBody.classList.toggle('hidden', open);
  if (!open) {
    const k = getKeys();
    els.geminiKey.value = k.gemini || '';
    els.pexelsKey.value = k.pexels || '';
  }
};

els.saveKeys.onclick = () => {
  setKey('gemini', els.geminiKey.value);
  setKey('pexels', els.pexelsKey.value);
  refreshKeyState();
  gvoices = tts.available() ? tts.VOICES : [];
  if (!gvoices.length && prefs.engine === 'google') { prefs.engine = 'device'; savePrefs(); }
  renderGVoices();
  applyEngine();
  els.diag.textContent = getKey('gemini')
    ? '키를 저장했어요. 이제 이야기꾼 말투로 해설합니다.'
    : '키를 지웠어요. 위키백과를 읽어주는 방식으로 동작합니다.';
};

/* ── 시작 ────────────────────────────────────────────────── */
els.rateSel.value = prefs.rate;
els.rateVal.textContent = (+prefs.rate).toFixed(2).replace(/0$/, '');
els.pitchSel.value = prefs.pitch;
els.pitchVal.textContent = (+prefs.pitch).toFixed(2).replace(/0$/, '');
paintRange(els.rateSel); paintRange(els.pitchSel);
[...els.lengthSeg.children].forEach(b => b.classList.toggle('on', b.dataset.v === prefs.length));
renderTones();
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
    navigator.mediaSession.playbackState =
      (P.playing && !P.paused) ? 'playing' : P.lines.length ? 'paused' : 'none';
  } catch (_) {}
}

if ('mediaSession' in navigator) {
  const set = (k, fn) => { try { navigator.mediaSession.setActionHandler(k, fn); } catch (_) {} };
  set('play', () => { if (!P.playing || P.paused) togglePlay(); });
  set('pause', () => { if (P.playing && !P.paused) togglePlay(); });
  set('previoustrack', () => playFrom(P.idx - 1));
  set('nexttrack', () => playFrom(P.idx + 1));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* 디버그용 — 콘솔에서 docent.P / docent.state */
window.docent = { P, state, prefs, buildChunks, playChunk, fetchAudio };
