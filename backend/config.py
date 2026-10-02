"""Prototype settings. Admin login for the hackathon demo — override via env vars if you like."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

ADMIN_ID = os.getenv("ATELIER_ADMIN_ID", "admin@atelier.market")
ADMIN_PASSWORD = os.getenv("ATELIER_ADMIN_PASSWORD", "Atelier@Demo2026")

# Optional shared secret for /api/cron. When set, callers must send it as ?key=... or X-Cron-Key.
CRON_SECRET = os.getenv("CRON_SECRET", "")

# Supabase Postgres when DATABASE_URL is set (backend/.env), otherwise the local SQLite file.
DB_URL = os.getenv("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'atelier.db'}"
if DB_URL.startswith("postgres://"):
    DB_URL = "postgresql://" + DB_URL.removeprefix("postgres://")
