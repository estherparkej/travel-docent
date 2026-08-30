#!/usr/bin/env python3
"""여행 도슨트 - 로컬 서버.

  - 정적 파일 서빙 (web/)
  - /api/geocode : 좌표 -> 주소 (OpenStreetMap Nominatim, 화면 표시용)
  - /api/docent  : 좌표 -> 위키백과 자료 -> 해설 대본 (SSE 스트리밍)

실행:  .venv/bin/python server.py
"""

import json
import os
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import llm
import photos
import tts
import wiki

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "docs"   # GitHub Pages 가 /docs 를 지원해서 이름을 맞췄다
CERT = ROOT / ".certs"
USER_AGENT = "travel-docent/1.0 (personal learning project)"

PROVIDER_LABEL = {
    "claude": "Claude (유료 API)",
    "gemini": "Gemini (무료 한도)",
    "wiki":   "위키백과 원문 (키 없음)",
}


def reverse_geocode(lat, lon):
    q = urllib.parse.urlencode({
        "format": "jsonv2", "lat": lat, "lon": lon,
        "zoom": 18, "addressdetails": 1, "accept-language": "ko",
    })
    req = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/reverse?{q}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode("utf-8"))
    addr = data.get("address") or {}
    name = (data.get("name")
            or addr.get("tourism") or addr.get("historic") or addr.get("building")
            or addr.get("attraction") or addr.get("amenity")
            or addr.get("neighbourhood") or addr.get("suburb")
            or addr.get("village") or addr.get("town") or addr.get("city") or "")
    return {"place": name, "address": data.get("display_name", "")}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "TravelDocent"

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            sys.stderr.write("  %s %s\n" % (self.command, self.path.split("?")[0]))

    # --- helpers -----------------------------------------------------
    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _static(self, rel):
        path = (WEB / rel).resolve()
        if not str(path).startswith(str(WEB)) or not path.is_file():
            return self._json({"error": "not found"}, 404)
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".webmanifest": "application/manifest+json; charset=utf-8",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
        }.get(path.suffix, "application/octet-stream")
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _sse_open(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def _sse(self, event, data):
        chunk = "event: %s\ndata: %s\n\n" % (event, json.dumps(data, ensure_ascii=False))
        self.wfile.write(chunk.encode("utf-8"))
        self.wfile.flush()

    # --- routes ------------------------------------------------------
    def do_GET(self):
        route = urllib.parse.urlparse(self.path)
        if route.path in ("/", "/index.html"):
            return self._static("index.html")
        if route.path == "/api/geocode":
            qs = urllib.parse.parse_qs(route.query)
            try:
                return self._json(reverse_geocode(qs["lat"][0], qs["lon"][0]))
            except Exception as e:
                return self._json({"place": "", "address": "", "warn": str(e)})
        if route.path == "/api/preview":
            qs = urllib.parse.parse_qs(route.query)
            name = (qs.get("place") or [""])[0].strip()
            if not name:
                return self._json({"error": "place 없음"}, 400)
            try:
                titles = wiki.search(name, limit=1)
                title = titles[0] if titles else name
                text = (wiki.extracts([title], limit_chars=160) or {}).get(title, "")
                return self._json({"place": title,
                                   "image": wiki.page_image(title, 900),
                                   "summary": wiki.for_speech(text)[:110]})
            except Exception as e:
                return self._json({"place": name, "image": "", "summary": "", "warn": str(e)})

        if route.path == "/api/nearby":
            qs = urllib.parse.parse_qs(route.query)
            try:
                near = wiki.nearby(qs["lat"][0], qs["lon"][0], radius=3000, limit=12)
                return self._json({"places": near})
            except Exception as e:
                return self._json({"places": [], "warn": str(e)})

        if route.path == "/api/voices":
            return self._json({"ok": tts.available(),
                               "voices": [{"id": v, "label": l, "desc": d}
                                          for v, l, d in tts.VOICES]})
        if route.path == "/api/health":
            p = llm.provider()
            return self._json({"ok": True, "provider": p, "label": PROVIDER_LABEL[p]})
        return self._static(route.path.lstrip("/"))

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        n = int(self.headers.get("Content-Length") or 0)
        payload = json.loads(self.rfile.read(n) or b"{}")

        if path == "/api/tts":
            try:
                wav = tts.synth(payload.get("text", ""),
                                payload.get("voice", "sulafat"),
                                payload.get("tone", "warm"))
            except RuntimeError as e:
                msg = str(e)
                return self._json({"error": msg},
                                  429 if msg == "QUOTA" else 503)
            except Exception as e:
                return self._json({"error": f"음성 오류: {e}"}, 500)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            return self.wfile.write(wav)

        if path != "/api/docent":
            return self._json({"error": "not found"}, 404)

        self._sse_open()

        try:
            manual = (payload.get("manual") or "").strip()
            data = wiki.gather(lat=payload.get("lat"), lon=payload.get("lon"),
                               manual=manual or None)

            if not data["sources"]:
                self._sse("error", {"message":
                    "이 근처에서 위키백과 문서를 찾지 못했습니다. "
                    "설정에서 장소를 직접 입력하거나, 조금 이동한 뒤 다시 눌러보세요."})
                return

            self._sse("place", {"place": data["place"],
                                "nearby": data["nearby"][:3],
                                "image": data.get("image", ""),
                                "provider": llm.provider()})

            # 캐러셀 사진 — 대본을 기다리는 동안 볼 것을 먼저 준다
            titles = [s["title"] for s in data["sources"]] or [data["place"]]
            self._sse("photos", {"shots": photos.collect(
                data["place"], titles, data.get("image", ""))})

            for text in llm.stream(data,
                                   length=payload.get("length", "normal"),
                                   heard=payload.get("heard"),
                                   again=bool(payload.get("again"))):
                self._sse("delta", {"text": text})
            self._sse("done", {})

        except RuntimeError as e:
            self._sse("error", {"message": str(e)})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            self._sse("error", {"message": f"오류: {e}"})


def ensure_cert():
    """휴대폰 브라우저는 HTTPS에서만 GPS를 허용한다."""
    CERT.mkdir(exist_ok=True)
    crt, key = CERT / "cert.pem", CERT / "key.pem"
    if crt.exists() and key.exists():
        return crt, key
    try:
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
             "-keyout", str(key), "-out", str(crt), "-days", "825",
             "-subj", "/CN=travel-docent",
             "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"],
            check=True, capture_output=True)
        return crt, key
    except Exception as e:
        print(f"  (인증서 생성 실패, HTTP로 실행합니다: {e})")
        return None, None


def local_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8443"))
    httpd = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    scheme = "http"
    if "--http" not in sys.argv:
        crt, key = ensure_cert()
        if crt:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(str(crt), str(key))
            httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
            scheme = "https"

    which = llm.provider()
    print("\n  🎧  여행 도슨트")
    print(f"      이 컴퓨터    {scheme}://localhost:{port}")
    print(f"      휴대폰       {scheme}://{local_ip()}:{port}   (같은 와이파이)")
    if scheme == "https":
        print("      ※ 휴대폰에서 '안전하지 않음' 경고가 뜨면 '고급 → 계속'을 눌러주세요.")
    print(f"      해설 생성    {PROVIDER_LABEL[which]}")
    if which == "wiki":
        print("      ※ .env 에 GEMINI_API_KEY 를 넣으면 도슨트 말투로 바뀝니다.")
        print("         무료 키 발급: https://aistudio.google.com/apikey")
    print("      종료: Ctrl+C\n", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  안녕히 가세요.\n")
