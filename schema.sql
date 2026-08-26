-- FonAnaliz D1 / SQLite Şeması

CREATE TABLE IF NOT EXISTS funds (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manager TEXT NOT NULL,
  fund_type TEXT NOT NULL DEFAULT 'HSYF',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stocks (
  ticker TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT
);

CREATE TABLE IF NOT EXISTS fund_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_code TEXT NOT NULL REFERENCES funds(code),
  report_date TEXT NOT NULL,
  aum REAL NOT NULL,
  monthly_return REAL,
  ingested_at TEXT DEFAULT (datetime('now')),
  source_url TEXT,
  UNIQUE(fund_code, report_date)
);

CREATE TABLE IF NOT EXISTS fund_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_code TEXT NOT NULL REFERENCES funds(code),
  stock_ticker TEXT NOT NULL REFERENCES stocks(ticker),
  report_date TEXT NOT NULL,
  qty INTEGER NOT NULL,
  weight REAL NOT NULL,
  entry_date TEXT,   -- hissenin bu fona ilk giriş tarihi
  exit_date TEXT,    -- portföyden çıkış tarihi (varsa)
  ingested_at TEXT DEFAULT (datetime('now')),
  UNIQUE(fund_code, stock_ticker, report_date)
);

CREATE INDEX IF NOT EXISTS idx_holdings_lookup ON fund_holdings(stock_ticker, report_date);
CREATE INDEX IF NOT EXISTS idx_holdings_fund   ON fund_holdings(fund_code, report_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_date  ON fund_snapshots(report_date);
