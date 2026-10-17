"""Local static server for dist/ with explicit MIME types.

Python's http.server takes MIME types from the OS registry on Windows, which can
serve JavaScript as text/plain and break ES modules. Usage: python tools/serve.py [port]
"""
import http.server
import socketserver
import sys
from pathlib import Path

DIST = Path(__file__).resolve().parents[1] / 'dist'
TYPES = {
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8114
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', port), Handler) as server:
        print(f'Serving {DIST} at http://localhost:{port}')
        server.serve_forever()
