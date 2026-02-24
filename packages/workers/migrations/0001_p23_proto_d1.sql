-- P2.3 Sub-A (Infra): minimal executable D1 schema
-- Apply:
--   wrangler d1 execute xgvst_quote --file=packages/workers/migrations/0001_p23_proto_d1.sql
--   wrangler d1 execute xgvst_quote --remote --file=packages/workers/migrations/0001_p23_proto_d1.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS self_selects (
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, symbol),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Required for P2.3 注意点4: user_id + symbol partition/index plan.
CREATE INDEX IF NOT EXISTS idx_self_selects_user_symbol ON self_selects(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_self_selects_user_updated ON self_selects(user_id, updated_at DESC);

-- Keep table name aligned with plan doc (quote_history).
-- In this phase we store self-select mutations for per-user history query.
CREATE TABLE IF NOT EXISTS quote_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  ts TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_history_user_symbol_ts ON quote_history(user_id, symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_quote_history_user_ts ON quote_history(user_id, ts DESC);
