"""Vercel Serverless Function: GET /api/shipments"""
import os
import sys
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from server import LogisticsAPIHandler


class handler(LogisticsAPIHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        self.handle_get_shipments(query)
