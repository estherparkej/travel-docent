"""구글 Gemini 음성으로 문장을 소리로 바꾼다.

브라우저 내장 음성합성과 달리 신경망 음성이라 사람 목소리에 가깝다.
대신 문장 하나에 3~5초가 걸리므로, 앱이 미리 받아둔다.
"""

import base64
import hashlib
import json
import re
import struct
import threading
import time
import urllib.error
import urllib.request
from collections import OrderedDict

import llm

MODELS = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"]

# 구글이 제공하는 30개 중 도슨트에 어울리는 것만 골랐다.
# 성격 설명은 구글 문서의 characteristic 을 우리말로 옮긴 것.
VOICES = [
    ("sulafat",       "따뜻한 목소리",   "포근하게 감싸는 톤. 기본값"),
    ("vindemiatrix",  "다정한 목소리",   "옆에서 조곤조곤 이야기하듯"),
    ("achernar",      "부드러운 목소리", "낮고 나긋한 톤"),
    ("aoede",         "산뜻한 목소리",   "가볍고 시원한 톤"),
    ("leda",          "밝은 목소리",     "젊고 생기 있는 톤. 아이와 함께"),
    ("kore",          "또렷한 목소리",   "단단하고 분명한 발음"),
    ("charon",        "설명하는 목소리", "다큐멘터리 내레이션 같은 톤"),
    ("gacrux",        "중후한 목소리",   "묵직하고 원숙한 톤"),
]
VOICE_IDS = {v[0] for v in VOICES}

# 말투는 프롬프트로 지시한다. Gemini TTS 는 이걸 실제로 반영한다.
STYLES = {
    "warm":   "다정하고 따뜻한 도슨트의 목소리로, 천천히",
    "lively": "신나고 들뜬 목소리로, 조금 빠르게",
    "calm":   "차분하고 낮은 목소리로, 아주 천천히",
    "deep":   "낮고 묵직한 목소리로",
    "clear":  "또박또박 정확한 발음으로",
}

_cache = OrderedDict()
_lock = threading.Lock()
_model = None
CACHE_MAX = 240

# 무료 한도는 분당 요청 수로 걸린다. 한꺼번에 몰아치면 429 가 난다.
# 한 번에 하나씩, 최소 간격을 두고 보낸다.
_gate = threading.Lock()
_last = [0.0]
MIN_GAP = 1.1


def available():
    return bool(llm._env("GEMINI_API_KEY"))


def _wav(pcm, rate=24000, channels=1, bits=16):
    """Gemini 는 헤더 없는 PCM 을 준다. 브라우저가 읽도록 WAV 로 감싼다."""
    byte_rate = rate * channels * bits // 8
    block = channels * bits // 8
    return (b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt "
            + struct.pack("<IHHIIHH", 16, 1, channels, rate, byte_rate, block, bits)
            + b"data" + struct.pack("<I", len(pcm)) + pcm)


def _pace():
    """앞 요청과 최소 간격을 둔다."""
    wait = MIN_GAP - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.time()


def _retry_delay(detail, default=6.0):
    m = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', detail)
    return min(float(m.group(1)) if m else default, 20.0)


def _call(model, key, prompt, voice):
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model}:generateContent?key={key}")
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {
                "prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read().decode("utf-8"))
    part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
    return base64.b64decode(part["data"])


def synth(text, voice="sulafat", tone="warm"):
    """문장 하나를 WAV 로. 같은 문장은 다시 만들지 않는다."""
    text = (text or "").strip()
    if not text:
        raise RuntimeError("읽을 문장이 없습니다.")
    if voice not in VOICE_IDS:
        voice = "sulafat"

    ckey = hashlib.sha1(f"{voice}|{tone}|{text}".encode()).hexdigest()
    with _lock:
        if ckey in _cache:
            _cache.move_to_end(ckey)
            return _cache[ckey]

    key = llm._env("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("구글 목소리를 쓰려면 GEMINI_API_KEY 가 필요합니다.")

    prompt = f"{STYLES.get(tone, STYLES['warm'])} 읽어주세요: {text}"
    global _model
    order = ([_model] if _model else []) + [m for m in MODELS if m != _model]
    last = None
    for m in order:
        try:
            with _gate:
                _pace()
                try:
                    pcm = _call(m, key, prompt, voice)
                except urllib.error.HTTPError as e:
                    if e.code != 429:
                        raise
                    # 분당 한도에 걸렸다. 구글이 알려준 만큼 기다렸다 한 번만 더.
                    time.sleep(_retry_delay(e.read().decode("utf-8", "replace")))
                    _pace()
                    pcm = _call(m, key, prompt, voice)
            wav = _wav(pcm)
            _model = m
            with _lock:
                _cache[ckey] = wav
                while len(_cache) > CACHE_MAX:
                    _cache.popitem(last=False)
            return wav
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:200]
            if e.code == 429:
                raise RuntimeError("QUOTA")
            last = f"{e.code} {detail}"
        except Exception as e:
            last = type(e).__name__
    raise RuntimeError(f"음성을 만들지 못했습니다. {last or ''}")


if __name__ == "__main__":
    import sys, time
    v = sys.argv[1] if len(sys.argv) > 1 else "sulafat"
    t0 = time.time()
    w = synth("여러분, 지금 여러분이 서 계신 곳은 첨성대입니다.", v)
    secs = (len(w) - 44) / (24000 * 2)
    print(f"{v}: {len(w):,}바이트 · 소리 {secs:.1f}초 · 만드는 데 {time.time()-t0:.1f}초")
