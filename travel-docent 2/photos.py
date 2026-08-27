"""캐러셀에 띄울 사진을 모은다.

  1) 위키미디어 — 그 장소의 실제 사진. 키가 필요 없다. (기본)
  2) Pexels    — 분위기 사진. PEXELS_API_KEY 가 있을 때만.

도슨트가 "정면을 보세요" 하고 말하는 앱이라 실제 사진이 먼저 온다.
"""

import json
import urllib.parse
import urllib.request

import llm
import wiki

UA = "travel-docent/1.0 (personal learning project)"


def pexels(query, n=4):
    """분위기 사진. 키가 없으면 조용히 빈 목록."""
    key = llm._env("PEXELS_API_KEY")
    if not key or not query:
        return []
    q = urllib.parse.urlencode({"query": query, "per_page": n,
                                "orientation": "portrait"})
    req = urllib.request.Request(
        f"https://api.pexels.com/v1/search?{q}",
        headers={"Authorization": key, "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception:
        return []
    out = []
    for p in data.get("photos", []):
        src = (p.get("src") or {}).get("large2x") or (p.get("src") or {}).get("large")
        if src:
            out.append({"url": src,
                        "title": (p.get("alt") or "").strip()[:60],
                        "credit": f"Pexels · {p.get('photographer', '')}".strip(" ·")})
    return out


def collect(place, titles, cover="", limit=10):
    """캐러셀용 사진 묶음.

    대표 사진이 첫 장. 그 다음 실제 장소 사진, 마지막에 분위기 사진.
    한쪽이 칸을 다 먹지 않도록 몫을 나눠 담는다.
    """
    shots = []
    seen = set()

    def add(url, title="", credit="위키백과"):
        if not url or url in seen:
            return False
        seen.add(url)
        shots.append({"url": url, "title": title, "credit": credit})
        return True

    add(cover, place)

    stock = pexels(place, n=4)
    room_for_wiki = limit - len(shots) - min(len(stock), 4)

    for x in wiki.gallery(titles, limit=room_for_wiki + 2):
        if len(shots) - 1 >= room_for_wiki:
            break
        add(x["url"], x["title"])

    for x in stock:
        if len(shots) >= limit:
            break
        add(x["url"], x["title"], x["credit"])

    return shots[:limit]


if __name__ == "__main__":
    import sys
    name = " ".join(sys.argv[1:]) or "불국사"
    d = wiki.gather(manual=name)
    got = collect(d["place"], [d["place"]], d.get("image", ""))
    print(f"{d['place']} — 사진 {len(got)}장 "
          f"(Pexels 키: {'있음' if llm._env('PEXELS_API_KEY') else '없음'})")
    for s in got:
        print(f"  · {s['credit']:<12} {s['title'][:34]}")
