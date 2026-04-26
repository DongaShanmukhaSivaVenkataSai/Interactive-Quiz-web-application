-- Supabase SQL Schema for Interactive Quiz Application
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Users table (for JWT auth)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id BIGSERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    percentage REAL NOT NULL,
    difficulty TEXT DEFAULT 'mixed',
    category TEXT DEFAULT 'mixed',
    played_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz history table
CREATE TABLE IF NOT EXISTS quiz_history (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL UNIQUE,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    percentage REAL NOT NULL,
    difficulty TEXT DEFAULT 'mixed',
    category_id INTEGER,
    started_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard (percentage DESC, score DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Enable RLS - allow public read/insert
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert on users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read on leaderboard" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Allow public insert on leaderboard" ON leaderboard FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read on quiz_history" ON quiz_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on quiz_history" ON quiz_history FOR INSERT WITH CHECK (true);
