-- Users table: authentication and roles
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Banks table: supported banks
CREATE TABLE IF NOT EXISTS banks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- POS branches table
CREATE TABLE IF NOT EXISTS pos_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id TEXT NOT NULL,
    name TEXT NOT NULL,
    terminal_id TEXT,
    bank_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (bank_id) REFERENCES banks(id)
);

-- Templates table: Excel parsing templates
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('bank', 'pos_summary', 'pos_detail', 'accounting')),
    bank_id INTEGER,
    column_mapping TEXT NOT NULL,
    cleanup_rules TEXT NOT NULL DEFAULT '{}',
    extraction_rules TEXT NOT NULL DEFAULT '{}',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (bank_id) REFERENCES banks(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Uploaded files table
CREATE TABLE IF NOT EXISTS uploaded_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    upload_date TEXT NOT NULL DEFAULT (datetime('now')),
    uploaded_by INTEGER,
    row_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES templates(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Bank transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    row_number INTEGER NOT NULL,
    date_jalali TEXT NOT NULL,
    time TEXT,
    branch_code TEXT,
    reference TEXT,
    payer_payee TEXT,
    deposit_ref TEXT,
    deposit_amount REAL NOT NULL DEFAULT 0,
    withdrawal_amount REAL NOT NULL DEFAULT 0,
    balance REAL,
    description TEXT,
    tx_type TEXT NOT NULL DEFAULT 'other' CHECK(tx_type IN ('shaparak', 'fee', 'check', 'transfer', 'other')),
    status TEXT NOT NULL DEFAULT 'unmatched' CHECK(status IN ('unmatched', 'pending', 'matched', 'manual')),
    FOREIGN KEY (file_id) REFERENCES uploaded_files(id)
);

-- POS summaries table
CREATE TABLE IF NOT EXISTS pos_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    branch_id TEXT NOT NULL,
    branch_name TEXT,
    terminal_id TEXT,
    tx_count INTEGER NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    date_jalali TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unmatched' CHECK(status IN ('unmatched', 'pending', 'matched', 'manual')),
    FOREIGN KEY (file_id) REFERENCES uploaded_files(id)
);

-- POS transactions table
CREATE TABLE IF NOT EXISTS pos_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    ref_number TEXT NOT NULL,
    card_number_masked TEXT,
    branch_name TEXT,
    time TEXT,
    amount REAL NOT NULL DEFAULT 0,
    pos_status TEXT,
    date_jalali TEXT,
    status TEXT NOT NULL DEFAULT 'unmatched' CHECK(status IN ('unmatched', 'pending', 'matched', 'manual')),
    FOREIGN KEY (file_id) REFERENCES uploaded_files(id)
);

-- Accounting entries table
CREATE TABLE IF NOT EXISTS accounting_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    entry_id INTEGER NOT NULL,
    date_jalali TEXT NOT NULL,
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0,
    description TEXT,
    entry_type TEXT NOT NULL DEFAULT 'other' CHECK(entry_type IN ('receipt', 'payment', 'fee', 'check', 'other')),
    status TEXT NOT NULL DEFAULT 'unmatched' CHECK(status IN ('unmatched', 'pending', 'matched', 'manual')),
    FOREIGN KEY (file_id) REFERENCES uploaded_files(id)
);

-- Reconciliation links table
CREATE TABLE IF NOT EXISTS reconciliation_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layer INTEGER NOT NULL CHECK(layer IN (1, 2, 3, 4)),
    bank_tx_id INTEGER,
    pos_summary_id INTEGER,
    pos_tx_id INTEGER,
    accounting_id INTEGER,
    match_type TEXT NOT NULL CHECK(match_type IN ('auto', 'manual', 'suggested')),
    confidence REAL NOT NULL DEFAULT 1.0,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    note TEXT,
    FOREIGN KEY (bank_tx_id) REFERENCES bank_transactions(id),
    FOREIGN KEY (pos_summary_id) REFERENCES pos_summaries(id),
    FOREIGN KEY (pos_tx_id) REFERENCES pos_transactions(id),
    FOREIGN KEY (accounting_id) REFERENCES accounting_entries(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Fee aggregations table
CREATE TABLE IF NOT EXISTS fee_aggregations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_jalali TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    registered INTEGER NOT NULL DEFAULT 0,
    registered_by INTEGER,
    registered_at TEXT,
    FOREIGN KEY (registered_by) REFERENCES users(id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(date_jalali);
CREATE INDEX IF NOT EXISTS idx_bank_tx_type ON bank_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_bank_tx_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pos_summary_date ON pos_summaries(date_jalali);
CREATE INDEX IF NOT EXISTS idx_pos_summary_branch ON pos_summaries(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_ref ON pos_transactions(ref_number);
CREATE INDEX IF NOT EXISTS idx_accounting_date ON accounting_entries(date_jalali);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_id ON accounting_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_recon_layer ON reconciliation_links(layer);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);