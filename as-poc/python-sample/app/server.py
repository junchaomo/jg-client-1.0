import base64
import hashlib
import hmac
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = os.environ.get('AS_HOST', '127.0.0.1')
PORT = int(os.environ.get('AS_PORT') or os.environ.get('PORT') or 0)
DATA_ROOT = Path(os.environ.get('AS_DATA_ROOT') or os.environ.get('AS_DATA_DIR') or (Path.cwd() / 'as-data'))
CONTEXT_SECRET = os.environ.get('AS_CONTEXT_SECRET', '')
APP_ID = os.environ.get('AS_APP_ID', 'as-python-sample')
DATA_ROOT.mkdir(parents=True, exist_ok=True)


def context_user(path: str, headers) -> str:
    if not CONTEXT_SECRET:
        return ''
    token = (parse_qs(urlparse(path).query).get('asContext') or [''])[0] or (headers.get('X-AS-Context') or '')
    if not token or '.' not in token:
        return ''
    encoded, signature = token.split('.', 1)
    expected = hmac.new(CONTEXT_SECRET.encode('utf-8'), encoded.encode('utf-8'), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return ''
    try:
        payload = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)).decode('utf-8'))
        if str(payload.get('appId', '')) != APP_ID or int(payload.get('exp', 0)) < int(time.time() * 1000):
            return ''
        user = str(payload.get('userId', ''))
        return user if re.fullmatch(r'[A-Za-z0-9._-]{1,80}', user) else ''
    except Exception:
        return ''


def user_dir(path: str, user: str) -> Path:
    safe = ''.join(ch for ch in user if ch.isalnum() or ch in '._-')[:80] or 'guest'
    target = DATA_ROOT / safe
    target.mkdir(parents=True, exist_ok=True)
    return target


def read_state(target: Path) -> dict:
    try:
        return json.loads((target / 'state.json').read_text(encoding='utf-8'))
    except Exception:
        return {'opens': 0, 'lastOpenAt': ''}


def write_state(target: Path, state: dict) -> None:
    (target / 'state.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def resolve_user(self):
        if CONTEXT_SECRET:
            user = context_user(self.path, self.headers)
            if not user:
                self.send_json({'error': 'AS 上下文令牌缺失、无效或已过期'}, 401)
                return ''
            return user
        return (parse_qs(urlparse(self.path).query).get('asUser') or ['guest'])[0]

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/health':
            self.send_json({'ok': True, 'appId': APP_ID, 'pid': os.getpid(), 'dataRoot': str(DATA_ROOT)})
            return
        user = self.resolve_user()
        if not user:
            return
        if path == '/api/tools/state':
            target = user_dir(self.path, user)
            self.send_json({'appId': APP_ID, 'pid': os.getpid(), 'dataRoot': str(DATA_ROOT), 'dataDir': str(target), 'state': read_state(target)})
            return
        target = user_dir(self.path, user)
        state = read_state(target)
        html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AS Python 示例</title>
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#111827;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{width:min(680px,calc(100vw - 48px));padding:32px;border:1px solid #e5e7eb;border-radius:18px;background:#fff;box-shadow:0 12px 36px rgba(17,24,39,.08)}}h1{{margin:0 0 6px;font-size:24px}}p{{margin:0 0 18px;color:#6b7280;line-height:1.7}}dl{{display:grid;grid-template-columns:112px 1fr;gap:10px 16px;margin:0;font-size:14px}}dt{{color:#6b7280}}dd{{margin:0;word-break:break-all}}button{{margin-top:24px;border:0;border-radius:10px;padding:10px 16px;background:#111827;color:#fff;cursor:pointer}}</style>
</head><body><main><h1>AS Python 示例</h1><p>由 AS Runtime 启动的 Python 独立进程。标准库 HTTP，无第三方依赖。</p>
<dl><dt>应用 ID</dt><dd>{os.environ.get('AS_APP_ID', 'as-python-sample')}</dd><dt>进程 PID</dt><dd>{os.getpid()}</dd><dt>监听地址</dt><dd>{HOST}:{PORT}</dd><dt>账号数据目录</dt><dd>{target}</dd><dt>打开次数</dt><dd id="count">{state['opens']}</dd></dl>
<button id="open">记录一次打开</button></main>
<script>document.getElementById('open').addEventListener('click',async()=>{{const q=new URLSearchParams(location.search);const r=await fetch('/api/open?asUser='+encodeURIComponent(q.get('asUser')||'guest')+'&asContext='+encodeURIComponent(q.get('asContext')||''),{{method:'POST'}});const j=await r.json();document.getElementById('count').textContent=j.opens}})</script>
</body></html>'''
        body = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlparse(self.path).path != '/api/open':
            self.send_json({'error': 'not found'}, 404)
            return
        user = self.resolve_user()
        if not user:
            return
        target = user_dir(self.path, user)
        state = read_state(target)
        state['opens'] = int(state.get('opens') or 0) + 1
        state['lastOpenAt'] = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat().replace('+00:00', 'Z')
        write_state(target, state)
        self.send_json({**state, 'dataDir': str(target)})


if __name__ == '__main__':
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
