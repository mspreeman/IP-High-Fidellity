-- LuMaCo development schema (SQLite). NOT a production security model.
-- API is intentionally localhost-only and lacks authentication. Never store real customer data here.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('personal','company'))
);
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    workspace_id TEXT NOT NULL REFERENCES workspaces(id)
);
CREATE INDEX IF NOT EXISTS idx_companies_workspace ON companies(workspace_id);

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    company_id TEXT REFERENCES companies(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('High','Medium','Low')),
    starred INTEGER NOT NULL DEFAULT 0 CHECK(starred IN (0,1)),
    detailed_reports INTEGER NOT NULL DEFAULT 0 CHECK(detailed_reports IN (0,1)),
    outreach_cadence_days INTEGER NOT NULL DEFAULT 30,
    engagement_cadence_days INTEGER NOT NULL DEFAULT 90,
    last_outreach TEXT,
    last_engagement TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

CREATE TABLE IF NOT EXISTS contact_identities (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('email','phone','calendar_name','other')),
    value TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
    UNIQUE(type,value)
);
CREATE INDEX IF NOT EXISTS idx_identities_contact ON contact_identities(contact_id);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Planning',
    workspace_id TEXT NOT NULL REFERENCES workspaces(id)
);
CREATE TABLE IF NOT EXISTS project_contacts (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    PRIMARY KEY(project_id,contact_id)
);

CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    occurred_on TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team','manager')),
    outreach INTEGER NOT NULL DEFAULT 0 CHECK(outreach IN (0,1)),
    engagement INTEGER NOT NULL DEFAULT 0 CHECK(engagement IN (0,1)),
    confidence TEXT NOT NULL DEFAULT 'recorded',
    explanation TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_date ON interactions(contact_id,occurred_on);

CREATE TABLE IF NOT EXISTS open_promises (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    project_id TEXT REFERENCES projects(id),
    title TEXT NOT NULL,
    due_on TEXT,
    direction TEXT NOT NULL CHECK(direction IN ('made_by_me','made_to_me')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','dismissed')),
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team','manager')),
    source TEXT NOT NULL DEFAULT 'manual',
    source_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promises_contact_status ON open_promises(contact_id,status);

CREATE TABLE IF NOT EXISTS connection_sources (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_connected',
    last_sync_at TEXT,
    last_error TEXT
);
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    contact_id TEXT REFERENCES contacts(id),
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'system',
    occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO workspaces(id,name,kind) VALUES('local-demo-personal','Private demo','personal');
INSERT OR IGNORE INTO workspaces(id,name,kind) VALUES('local-demo-company','Fictional company','company');
