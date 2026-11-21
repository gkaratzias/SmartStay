-- ==========================================================
-- SmartStay Pro - SQL Database Schema (SQLite / PostgreSQL / MySQL compliant DDL)
-- ==========================================================

CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    lock_id TEXT NOT NULL,
    locked INTEGER DEFAULT 1,
    battery INTEGER DEFAULT 90,
    power_on INTEGER DEFAULT 1,
    guest TEXT DEFAULT 'Κενό (Standby)',
    pin TEXT DEFAULT '------',
    check_out TEXT DEFAULT '—',
    source TEXT DEFAULT 'Airbnb',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    box_id TEXT NOT NULL,
    box_name TEXT NOT NULL,
    slot TEXT NOT NULL,
    room TEXT NOT NULL,
    status TEXT DEFAULT 'free', -- 'key_inside', 'picked_up', 'free'
    guest TEXT DEFAULT '—',
    source TEXT DEFAULT '—',
    pin TEXT DEFAULT '------',
    validity TEXT DEFAULT 'Έτοιμο για ανάθεση',
    door_open INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(box_id, slot)
);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    guest TEXT NOT NULL,
    property_name TEXT NOT NULL,
    source TEXT NOT NULL,
    dates TEXT NOT NULL,
    pin TEXT NOT NULL,
    status TEXT DEFAULT 'Προγραμματισμένο',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    schedule TEXT NOT NULL,
    properties TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_name TEXT NOT NULL,
    event TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'unlock', 'energy', 'staff'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    package_name TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_properties_lock ON properties(lock_id);
CREATE INDEX IF NOT EXISTS idx_lockers_box ON lockers(box_id);
CREATE INDEX IF NOT EXISTS idx_bookings_prop ON bookings(property_name);
CREATE INDEX IF NOT EXISTS idx_logs_prop ON audit_logs(property_name);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at);
