"""Local developer server: static LuMaCo prototype + demonstrative SQLite REST endpoints.

Run: python -m backend.server
WARNING: No login, authorization, OAuth, or production security controls are implemented.
The server binds to 127.0.0.1 only, and is for fictional data only.
"""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from backend.logic import classify_interaction
from backend.store import connect, initialize

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'frontend'


def new_id(prefix: str) -> str:
    return f'{prefix}_{uuid.uuid4().hex[:12]}'


def rows(sql: str, params: tuple = ()) -> list[dict]:
    with connect() as db:
        return [dict(x) for x in db.execute(sql, params).fetchall()]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def send_json(self, status: int, obj: dict | list) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get('Content-Length', '0'))
        if length < 1 or length > 100_000:
            raise ValueError('Request body must contain less than 100KB of JSON')
        val = json.loads(self.rfile.read(length))
        if not isinstance(val, dict):
            raise ValueError('Expected a JSON object')
        return val

    def do_GET(self):
        path = urlparse(self.path).path
        if not path.startswith('/api/'):
            return super().do_GET()
        try:
            if path == '/api/health':
                return self.send_json(200, {
                    'status':'ok','mode':'local-development-only','data':'fictional',
                    'frontend_storage':'browser-localStorage','backend_storage':'separate SQLite demo',
                    'live_integrations':False,'authentication':False
                })
            if path == '/api/v1/companies':
                return self.send_json(200, rows('SELECT * FROM companies ORDER BY name'))
            if path == '/api/v1/contacts':
                return self.send_json(200, rows('SELECT * FROM contacts ORDER BY name'))
            if path == '/api/v1/interactions':
                return self.send_json(200, rows('SELECT * FROM interactions ORDER BY occurred_on DESC'))
            if path == '/api/v1/promises':
                return self.send_json(200, rows('SELECT * FROM open_promises ORDER BY due_on'))
            if path == '/api/v1/integrations':
                return self.send_json(200, {
                    'outlook':'not_connected','gmail':'not_connected',
                    'google_calendar':'not_connected','microsoft_calendar':'not_connected',
                    'phone_calls':'not_connected','sms':'not_connected'
                })
            if path == '/api/v1/manager/summary':
                return self.send_json(501, {'error':'Not implemented: requires role-based authorization and verified workspace-scoped queries'})
            return self.send_json(404, {'error':'Unknown API endpoint'})
        except (sqlite3.Error, ValueError) as e:
            return self.send_json(400, {'error':str(e)})

    def do_POST(self):
        path = urlparse(self.path).path
        if path not in ('/api/v1/companies','/api/v1/contacts','/api/v1/interactions','/api/v1/promises'):
            return self.send_json(404, {'error':'Unknown API endpoint'})
        try:
            data = self.read_json()
            with connect() as db:
                if path == '/api/v1/companies':
                    name = str(data.get('name', '')).strip()
                    if not name: raise ValueError('Company name is required')
                    id = new_id('co')
                    db.execute('INSERT INTO companies(id,name,category,workspace_id) VALUES(?,?,?,?)',
                               (id,name,str(data.get('category','Other')),'local-demo-company'))
                elif path == '/api/v1/contacts':
                    name = str(data.get('name', '')).strip()
                    if not name: raise ValueError('Contact name is required')
                    company_id = data.get('company_id')
                    if company_id and not db.execute('SELECT id FROM companies WHERE id=?',(company_id,)).fetchone():
                        raise ValueError('Unknown company ID')
                    id = new_id('ct')
                    # Backend scaffold creates only company-demo contacts. Real privacy needs login / ownership.
                    db.execute('''INSERT INTO contacts(id,name,title,company_id,workspace_id,priority,starred,detailed_reports)
                                  VALUES(?,?,?,?,?,?,?,?)''',
                               (id,name,str(data.get('title','')),company_id,'local-demo-company',
                                str(data.get('priority','Medium')),int(data.get('starred',False)),
                                int(data.get('detailed_reports',False))))
                elif path == '/api/v1/interactions':
                    contact_id = str(data.get('contact_id',''))
                    if not db.execute('SELECT id FROM contacts WHERE id=?',(contact_id,)).fetchone():
                        raise ValueError('Approved contact ID required; unapproved senders must not be tracked')
                    when = str(data.get('occurred_on',date.today().isoformat()))
                    date.fromisoformat(when)
                    outreach,engagement,confidence,reason=classify_interaction(data)
                    id = new_id('act')
                    db.execute('''INSERT INTO interactions(id,contact_id,kind,occurred_on,summary,source,visibility,
                                  outreach,engagement,confidence,explanation) VALUES(?,?,?,?,?,?,?,?,?,?,?)''',
                               (id,contact_id,str(data.get('kind','note')),when,str(data.get('summary','')),
                                'local-demo-api', 'private', int(outreach),int(engagement),confidence,reason))
                    # Dates update independently, and never move backwards.
                    if outreach:
                        db.execute('''UPDATE contacts SET last_outreach=CASE
                                      WHEN last_outreach IS NULL OR last_outreach<? THEN ? ELSE last_outreach END
                                      WHERE id=?''',(when,when,contact_id))
                    if engagement:
                        db.execute('''UPDATE contacts SET last_engagement=CASE
                                      WHEN last_engagement IS NULL OR last_engagement<? THEN ? ELSE last_engagement END
                                      WHERE id=?''',(when,when,contact_id))
                else:
                    contact_id = str(data.get('contact_id',''))
                    if not db.execute('SELECT id FROM contacts WHERE id=?',(contact_id,)).fetchone():
                        raise ValueError('Approved contact ID required')
                    title = str(data.get('title','')).strip()
                    if not title: raise ValueError('Promise title is required')
                    id = new_id('promise')
                    db.execute('''INSERT INTO open_promises(id,contact_id,title,due_on,direction,source,visibility)
                                  VALUES(?,?,?,?,?,?,?)''',
                               (id,contact_id,title,data.get('due_on'),data.get('direction','made_by_me'),
                                'local-demo-api','private'))
            return self.send_json(201, {'id':id,'stored_in':'separate local SQLite demo','frontend_synced':False})
        except (ValueError, json.JSONDecodeError, sqlite3.Error) as e:
            return self.send_json(400, {'error':str(e)})


def main() -> None:
    initialize()
    port = int(os.environ.get('LUMACO_PORT','8000'))
    server = ThreadingHTTPServer(('127.0.0.1',port),Handler)
    print(f'LuMaCo local developer server: http://127.0.0.1:{port}/')
    print('Demo only; no live integrations or authentication. Ctrl+C to stop.')
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__ == '__main__':
    main()
