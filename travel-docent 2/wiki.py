"""한국어 위키백과에서 '지금 이 자리'의 사실 자료를 가져온다.

API 키도 가입도 필요 없다. 좌표로 주변 문화재를 찾고 본문을 읽어온다.
"""

import json
import re
import urllib.parse
import urllib.request

API = "https://ko.wikipedia.org/w/api.php"
UA = "travel-docent/1.0 (personal learning project)"


def _get(params):
    params = dict(params, format="json", formatversion=2)
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=12) as r:
        return json.loads(r.read().decode("utf-8"))


def nearby(lat, lon, radius=1500, limit=10):
    """좌표 주변 문서를 가까운 순서로. [{title, dist}]"""
    try:
        d = _get({
            "action": "query", "list": "geosearch",
            "gscoord": f"{lat}|{lon}", "gsradius": radius, "gslimit": limit,
        })
    except Exception:
        return []
    return [{"title": x["title"], "dist": round(x["dist"])}
            for x in d.get("query", {}).get("geosearch", [])]


def search(term, limit=3):
    """장소 이름으로 문서 찾기. 직접 입력 모드에서 쓴다."""
    try:
        d = _get({"action": "query", "list": "search",
                  "srsearch": term, "srlimit": limit})
    except Exception:
        return []
    return [x["title"] for x in d.get("query", {}).get("search", [])]


def page_image(title, size=900):
    """문서 대표 사진. 없으면 빈 문자열. (앨범아트로 쓴다)"""
    try:
        d = _get({"action": "query", "prop": "pageimages", "piprop": "thumbnail",
                  "pithumbsize": size, "titles": title})
    except Exception:
        return ""
    for p in d.get("query", {}).get("pages", []):
        src = (p.get("thumbnail") or {}).get("source")
        if src:
            return src
    return ""


# 문서 사진이 아닌 것들 — 지도, 아이콘, 국기, 문장 따위
_NOT_PHOTO = ("icon", "logo", "map", "지도", "symbol", "flag", "seal", "emblem",
              "commons", "wikimedia", "wiki", "ambox", "disambig", "question",
              "arrow", "edit", "star", "crystal", "가지", "문장")

# 여러 장을 한 판에 붙인 것들. 앨범아트로 쓰면 지저분하다.
_COMPOSITE = ("collage", "montage", "composite", "panorama", "panoramic",
              "combo", "series", "set of", "plate", "diagram", "chart",
              "layout", "도면", "배치도", "모음", "전경도", "stitched",
              "before and after", "comparison", "vs", "grid")


def gallery(titles, limit=8, width=1400):
    """문서에 실린 사진들. 앨범아트 캐러셀에 쓴다. [{url, title}]"""
    if not titles:
        return []
    try:
        d = _get({"action": "query", "prop": "images", "imlimit": 40,
                  "titles": "|".join(titles[:3])})
    except Exception:
        return []

    files = []
    for page in d.get("query", {}).get("pages", []):
        for im in page.get("images", []):
            name = im["title"]
            low = name.lower()
            if low.endswith((".svg", ".ogg", ".ogv", ".webm", ".pdf", ".gif")):
                continue
            if any(w in low for w in _NOT_PHOTO):
                continue
            if name not in files:
                files.append(name)
    if not files:
        return []

    try:
        d = _get({"action": "query", "titles": "|".join(files[:20]),
                  "prop": "imageinfo", "iiprop": "url|size",
                  "iiurlwidth": width})
    except Exception:
        return []

    out = []
    for page in d.get("query", {}).get("pages", []):
        info = (page.get("imageinfo") or [{}])[0]
        url = info.get("thumburl") or info.get("url")
        w, h = info.get("width") or 0, info.get("height") or 0
        if not url or w < 500:
            continue

        name = page["title"].split(":", 1)[-1].rsplit(".", 1)[0]
        if any(k in name.lower() for k in _COMPOSITE):
            continue
        # 한 장짜리 사진의 비율은 대체로 1:2 ~ 2:1 안에 든다.
        # 파노라마나 여러 컷을 이어 붙인 것은 이 범위를 벗어난다.
        if h:
            ratio = w / h
            if ratio > 2.0 or ratio < 0.5:
                continue

        out.append({"url": url, "title": name})
        if len(out) >= limit:
            break
    return out


def extracts(titles, intro_only=True, limit_chars=2000):
    """문서 본문을 평문으로. {title: text}"""
    if not titles:
        return {}
    params = {"action": "query", "prop": "extracts", "explaintext": 1,
              "titles": "|".join(titles[:6])}
    if intro_only:
        params["exintro"] = 1
    try:
        d = _get(params)
    except Exception:
        return {}
    out = {}
    for p in d.get("query", {}).get("pages", []):
        text = (p.get("extract") or "").strip()
        if text:
            out[p["title"]] = text[:limit_chars]
    return out


# 소리내어 읽을 때 방해가 되는 것들을 걷어낸다
_HANJA_PAREN = re.compile(r"\(\s*[^)]*[一-鿿][^)]*\)")
_LATIN_PAREN = re.compile(r"\(\s*[A-Za-z][^)]*\)")
_SPACES = re.compile(r"[ \t]{2,}")


def for_speech(text):
    """한자 병기와 영문 괄호를 지운다. TTS가 '불국사 불국사'처럼 읽는 걸 막는다."""
    text = _HANJA_PAREN.sub("", text)
    text = _LATIN_PAREN.sub("", text)
    text = _SPACES.sub(" ", text)
    return text.strip()


def gather(lat=None, lon=None, manual=None):
    """도슨트에게 넘길 자료 묶음을 만든다.

    반환: {place, primary, image, sources: [{title, dist, text}], nearby: [title]}
    """
    if manual:
        titles = search(manual)
        near = []
    else:
        near = nearby(lat, lon)
        titles = [x["title"] for x in near]

    if not titles:
        return {"place": manual or "", "primary": "", "image": "",
                "sources": [], "nearby": []}

    primary = titles[0]
    dist_of = {x["title"]: x["dist"] for x in near}

    main = extracts([primary], intro_only=False, limit_chars=2600)
    rest = extracts(titles[1:4], intro_only=True, limit_chars=500)

    sources = []
    for t in titles[:4]:
        text = main.get(t) or rest.get(t)
        if text:
            sources.append({"title": t, "dist": dist_of.get(t), "text": for_speech(text)})

    return {
        "place": primary,
        "primary": primary,
        "image": page_image(primary),
        "sources": sources,
        "nearby": [x["title"] for x in near[1:6]],
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        data = gather(manual=" ".join(sys.argv[1:]))
    else:
        data = gather(lat=35.790115, lon=129.332099)
    print("장소:", data["place"])
    print("주변:", ", ".join(data["nearby"]) or "없음")
    for s in data["sources"]:
        d = f" ({s['dist']}m)" if s["dist"] is not None else ""
        print(f"\n── {s['title']}{d}\n{s['text'][:220]}…")
