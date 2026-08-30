"""해설 대본 생성. 쓸 수 있는 것을 자동으로 고른다.

  1) Gemini   (GEMINI_API_KEY)      — 무료 한도, 기본
  2) Claude   (ANTHROPIC_API_KEY)   — 유료, 있으면 우선
  3) 없으면    위키백과 원문을 다듬어서 그대로 읽어줌 (키 없이 동작)
"""

import json
import os
import re
import socket
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

SYSTEM = """당신은 여행지 현장에서 방문객 옆에 서서 이야기를 들려주는 이야기꾼입니다.
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
   "여러분, 지금 여러분 앞에 있는 이 돌탑이요. 천삼백 년을 버텼습니다."
2. 질문을 던지고 잠깐 뜸을 들이세요.
   "그런데 이걸 누가, 왜 만들었을까요?"
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
5. 마지막은 마음에 남는 한마디로 맺습니다. 가까운 다른 곳을 권해도 좋습니다."""

LENGTHS = {
    "short":  "250자 내외. 가장 놀라운 이야기 하나만 골라서.",
    "normal": "600자 내외. 이야기 하나를 제대로.",
    "deep":   "1200자 내외. 곁가지 이야기와 사람 이야기까지 넉넉히.",
}


# ── 키 읽기 ────────────────────────────────────────────────
def _env(name):
    key = os.environ.get(name, "").strip()
    if not key and (ROOT / ".env").exists():
        for line in (ROOT / ".env").read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == name:
                key = v.strip().strip('"').strip("'")
    if "..." in key or "여기에" in key or len(key) < 20:
        return ""
    return key


def provider():
    if _env("ANTHROPIC_API_KEY"):
        return "claude"
    if _env("GEMINI_API_KEY"):
        return "gemini"
    return "wiki"


# ── 프롬프트 ───────────────────────────────────────────────
def build_prompt(data, length="normal", heard=None, again=False):
    lines = []
    if data["sources"]:
        lines.append("[위키백과 자료]")
        for s in data["sources"]:
            where = f" — 여기서 약 {s['dist']}m" if s.get("dist") is not None else ""
            lines.append(f"\n《{s['title']}》{where}\n{s['text']}")
    else:
        lines.append("[자료 없음] 이 좌표 주변에서 위키백과 문서를 찾지 못했습니다.")

    if data["nearby"]:
        lines.append(f"\n[걸어서 갈 만한 주변] {', '.join(data['nearby'])}")

    lines.append(f"\n[해설 길이] {LENGTHS.get(length, LENGTHS['normal'])}")
    lines.append(f"[해설할 대상] {data['place']}")

    heard = [h for h in (heard or []) if h]
    if heard:
        lines.append(f"[이미 들은 곳] {', '.join(heard[-12:])}")
    if again:
        lines.append("[요청] 같은 자리입니다. 방금과 다른 대목을 골라 새로 이야기해 주세요.")
    return "\n".join(lines)


# ── Gemini ─────────────────────────────────────────────────
_gemini_candidates = None
# 새 모델부터. 구글이 옛 모델을 신규 사용자에게 막아버리는 일이 있다.
_PREFERRED = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.7-flash",
              "gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.5-flash"]


def gemini_models(key):
    """쓸 수 있는 모델을 실제 목록에서 골라 순서대로. 이름을 추측하지 않는다."""
    global _gemini_candidates
    if _gemini_candidates:
        return _gemini_candidates
    forced = os.environ.get("GEMINI_MODEL", "").strip()
    if forced:
        _gemini_candidates = [forced]
        return _gemini_candidates
    try:
        req = urllib.request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
        with urllib.request.urlopen(req, timeout=15) as r:
            models = json.loads(r.read().decode("utf-8")).get("models", [])
        usable = [m["name"].split("/")[-1] for m in models
                  if "generateContent" in m.get("supportedGenerationMethods", [])]
    except Exception:
        usable = []

    order = [m for m in _PREFERRED if m in usable]
    # 목록에 없던 flash 계열도 뒤에 붙여 둔다. 앞의 것이 막히면 여기로 넘어간다.
    order += [m for m in usable
              if "flash" in m and m not in order
              and not any(x in m for x in ("image", "tts", "lite", "preview"))]
    _gemini_candidates = order or ["gemini-3.6-flash"]
    return _gemini_candidates


def gemini_model(key):
    """지금 쓰는 모델 하나. (표시용)"""
    return gemini_models(key)[0]


def _gemini_once(model, key, prompt):
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model}:streamGenerateContent?alt=sse&key={key}")
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        # thinkingLevel low — 첫 문장이 나오기까지 11초에서 5초로 줄어든다
        "generationConfig": {"temperature": 0.9, "maxOutputTokens": 2048,
                             "thinkingConfig": {"thinkingLevel": "low"}},
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        for raw in r:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data:"):
                continue
            try:
                chunk = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            for cand in chunk.get("candidates", []):
                for part in cand.get("content", {}).get("parts", []):
                    if part.get("text"):
                        yield part["text"]


def _stream_gemini(prompt):
    key = _env("GEMINI_API_KEY")
    candidates = gemini_models(key)
    last = None
    for i, model in enumerate(candidates[:4]):
        try:
            started = False
            for text in _gemini_once(model, key, prompt):
                started = True
                yield text
            if started:
                # 이 모델이 되더라. 다음부터는 이걸 먼저 쓴다.
                candidates.insert(0, candidates.pop(i))
                return
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            if e.code == 429:
                raise RuntimeError("Gemini 무료 한도를 다 썼습니다. 잠시 후 다시 시도해 주세요.")
            if e.code in (400, 403, 404):
                last = f"{e.code} (모델 {model}): {detail}"
                continue          # 다음 모델로
            raise RuntimeError(f"Gemini 오류 {e.code} (모델 {model}): {detail}")
        except (socket.timeout, TimeoutError, urllib.error.URLError) as e:
            # 한 글자도 못 받고 늦어지는 모델은 버리고 다음으로 넘어간다
            if started:
                return
            last = f"{model} 응답이 너무 느림"
            continue
    raise RuntimeError(f"Gemini 오류 — 쓸 수 있는 모델을 찾지 못했습니다. {last or ''}")


# ── Claude ─────────────────────────────────────────────────
def _stream_claude(prompt, effort="medium"):
    import anthropic
    client = anthropic.Anthropic(api_key=_env("ANTHROPIC_API_KEY"))
    try:
        with client.messages.stream(
            model="claude-opus-5", max_tokens=8000, system=SYSTEM,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield text
    except anthropic.APIStatusError as e:
        raise RuntimeError(f"Claude API 오류 {e.status_code}: {e.message}")


# ── 키가 없을 때: 위키백과를 귀에 들리게 다듬어서 ─────────────
_HEADING = re.compile(r"^==+.*?==+$", re.M)
_DESIG = re.compile(r"제\s*\d+\s*호")

# 백과사전 문어체를 말하는 투로. 긴 것부터 바꿔야 한다.
_SOFTEN = sorted([
    # 문장을 잇는 '~으며,' 는 아예 문장을 끊어준다. 한 문장이 짧아진다.
    ("하였으며,", "했어요."), ("되었으며,", "됐어요."), ("있으며,", "있어요."),
    ("없으며,", "없어요."), ("이며,", "이에요."), ("였으며,", "였어요."),
    ("았으며,", "았어요."), ("었으며,", "었어요."),
    # 문장 끝맺음
    ("하였다.", "했어요."), ("되었다.", "됐어요."), ("이었다.", "이었어요."),
    ("아니다.", "아니에요."), ("불린다.", "불려요."), ("보인다.", "보여요."),
    ("여겨진다.", "여겨져요."), ("웠다.", "웠어요."), ("였다.", "였어요."),
    ("았다.", "았어요."), ("었다.", "었어요."), ("이다.", "이에요."),
    ("있다.", "있어요."), ("없다.", "없어요."), ("된다.", "돼요."),
    ("한다.", "해요."), ("진다.", "져요."), ("난다.", "나요."),
    ("준다.", "줘요."), ("온다.", "와요."), ("간다.", "가요."),
    ("많다.", "많아요."), ("높다.", "높아요."), ("크다.", "커요."),
    ("같다.", "같아요."),
    # 현재형 '~ㄴ다' 는 불규칙이라 자주 나오는 것만 손으로
    ("받는다.", "받아요."), ("남는다.", "남아요."), ("만든다.", "만들어요."),
    ("부른다.", "불러요."), ("오른다.", "올라요."), ("걷는다.", "걸어요."),
    ("듣는다.", "들어요."), ("묻는다.", "물어요."), ("앉는다.", "앉아요."),
    ("먹는다.", "먹어요."), ("짓는다.", "지어요."), ("닫는다.", "닫아요."),
    ("열린다.", "열려요."), ("놓인다.", "놓여요."), ("쌓인다.", "쌓여요."),
    ("본다.", "봐요."), ("산다.", "살아요."), ("쓴다.", "써요."),
], key=lambda kv: -len(kv[0]))


# 눈으로 읽는 단위 기호는 귀로 들리게 풀어준다
_NB = r"(?![A-Za-z])"
_UNITS = [(re.compile(r"(\d)\s*km" + _NB), r"\1킬로미터"),
          (re.compile(r"(\d)\s*cm" + _NB), r"\1센티미터"),
          (re.compile(r"(\d)\s*mm" + _NB), r"\1밀리미터"),
          (re.compile(r"(\d)\s*kg" + _NB), r"\1킬로그램"),
          (re.compile(r"(\d)\s*m" + _NB),  r"\1미터"),
          (re.compile(r"㎡"), "제곱미터"), (re.compile(r"㎞"), "킬로미터")]

_PAST = re.compile(r"([가-힣])다\.")


def _past_to_polite(m):
    """받침이 ㅆ인 과거형(했다, 왔다, 오르내렸다…)을 '~어요'로."""
    ch = m.group(1)
    return ch + "어요." if (ord(ch) - 0xAC00) % 28 == 20 else m.group(0)


def soften(text):
    for a, b in _SOFTEN:
        text = text.replace(a, b)
    text = _PAST.sub(_past_to_polite, text)
    for rx, rep in _UNITS:
        text = rx.sub(rep, text)
    return text


def _sentences(text):
    out = []
    for chunk in re.split(r"(?<=[.!?])\s+", text):
        chunk = chunk.strip()
        if chunk:
            out.append(chunk)
    return out


# 아이가 들으면 무슨 말인지 알 수 없는 행정·분류 이야기
_ADMIN = ("교구", "말사", "문화재청", "소재지", "등록문화재",
          "행정구역", "지정번호", "관리단체", "제곱미터")


def _boring(sent):
    """귀로 들으면 지루하기만 한 문장은 빼버린다."""
    if _DESIG.search(sent) and "지정" in sent:
        return True
    if any(w in sent for w in _ADMIN):
        return True
    if sent.startswith("이 문서") or "다음과 같" in sent:
        return True
    return len(sent) < 6


def _stream_wiki(data, length="normal"):
    """AI 키가 없을 때. 위키백과 원문을 말하는 투로 다듬어 읽어준다.

    말투만 부드럽게 할 뿐, 이야기로 재구성하지는 못한다.
    진짜 도슨트 말투는 .env 에 GEMINI_API_KEY 를 넣어야 나온다.
    """
    if not data["sources"]:
        yield "이 근처에서는 소개할 만한 자료를 찾지 못했어요. 조금 더 걸어가 보시겠어요?\n"
        return

    src = data["sources"][0]
    body = _HEADING.sub("", src["text"])
    body = re.sub(r"\n{2,}", "\n", body).strip()
    body = soften(body)

    cap = {"short": 320, "normal": 950, "deep": 2000}.get(length, 950)

    yield f"여러분, 지금 여러분이 서 계신 곳은 {src['title']}입니다.\n"

    used = 0
    for sent in _sentences(body):
        if _boring(sent):
            continue
        if used + len(sent) > cap:
            break
        used += len(sent)
        yield sent + "\n"

    if data["nearby"]:
        yield f"여기까지 보셨으면, 가까이에 있는 {data['nearby'][0]}에도 한번 가보세요.\n"
    else:
        yield "천천히 한 바퀴 둘러보세요.\n"


# ── 공개 진입점 ────────────────────────────────────────────
def stream(data, length="normal", heard=None, again=False):
    """해설 대본을 조각조각 흘려보낸다. (텍스트 조각 제너레이터)

    AI 가 막히면(무료 한도 등) 조용히 실패하지 않고
    위키백과 낭독으로 갈아탄다. 말투는 밋밋해도 안내는 계속된다.
    """
    which = provider()
    if which == "wiki":
        yield from _stream_wiki(data, length)
        return

    prompt = build_prompt(data, length, heard, again)
    if which == "claude":
        gen = _stream_claude(prompt, "low" if length == "short" else "medium")
    else:
        gen = _stream_gemini(prompt)

    started = False
    try:
        for text in gen:
            started = True
            yield text
    except RuntimeError:
        if started:
            raise                      # 이미 읽던 중이면 그대로 알린다
        # 한 글자도 못 받았다. 빈손으로 두지 말고 위키백과라도 읽어준다.
        yield from _stream_wiki(data, length)
