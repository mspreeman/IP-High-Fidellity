"""Minimal local-only SQLite access for the next development stage.

Not a secure production persistence layer. No authentication or user isolation exists yet.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get('LUMACO_DB', str(ROOT / 'data' / 'lumaco-demo.sqlite3')))
SCHEMA_PATH = ROOT / 'database' / 'schema.sql'


def connect(db_path: str | Path | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path is not None else DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=5)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys = ON')
    return con


def initialize(db_path: str | Path | None = None) -> None:
    with connect(db_path) as con:
        con.executescript(SCHEMA_PATH.read_text(encoding='utf-8'))
