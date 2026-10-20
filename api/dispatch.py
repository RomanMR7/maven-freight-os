"""Vercel Serverless Function: POST /api/dispatch"""
import os
import sys
import json
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from server import LogisticsAPIHandler


class handler(LogisticsAPIHandler):
    def do_POST(self):
        query = parse_qs(urlparse(self.path).query)
        content_len = int(self.headers.get("Content-Length", 0))
        body = {}
        if content_len > 0:
            try:
                body = json.loads(self.rfile.read(content_len).decode("utf-8"))
            except Exception:
                body = {}
        self.handle_post_dispatch(body, query)
