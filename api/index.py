"""
Vercel Serverless Function entry point for MAVEN FREIGHT OS.
Wraps LogisticsAPIHandler from server.py.
"""
import os
import sys

# Ensure parent directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from server import LogisticsAPIHandler


class handler(LogisticsAPIHandler):
    """Vercel Serverless Function request handler."""
    pass
