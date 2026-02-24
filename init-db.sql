-- 台股篩選器資料庫 Schema (PostgreSQL)

-- 股票基本資料
CREATE TABLE IF NOT EXISTS stocks (
  symbol VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  market VARCHAR(10) NOT NULL DEFAULT 'twse', -- twse / tpex
  industry VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 每日收盤行情
CREATE TABLE IF NOT EXISTS daily_prices (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  trade_date DATE NOT NULL,
  open_price NUMERIC(10,2),
  high_price NUMERIC(10,2),
  low_price NUMERIC(10,2),
  close_price NUMERIC(10,2),
  change_amount NUMERIC(10,2),
  change_percent NUMERIC(8,4),
  volume BIGINT,
  trade_value BIGINT,
  transactions INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, trade_date)
);

-- 基本面資料（本益比、殖利率、淨值比）
CREATE TABLE IF NOT EXISTS fundamentals (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  trade_date DATE NOT NULL,
  pe_ratio NUMERIC(10,2),       -- 本益比
  dividend_yield NUMERIC(8,4),  -- 殖利率
  pb_ratio NUMERIC(10,2),       -- 股價淨值比
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, trade_date)
);

-- 三大法人買賣超
CREATE TABLE IF NOT EXISTS institutional (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  trade_date DATE NOT NULL,
  foreign_buy BIGINT DEFAULT 0,     -- 外資買進
  foreign_sell BIGINT DEFAULT 0,    -- 外資賣出
  foreign_net BIGINT DEFAULT 0,     -- 外資買賣超
  trust_buy BIGINT DEFAULT 0,       -- 投信買進
  trust_sell BIGINT DEFAULT 0,      -- 投信賣出
  trust_net BIGINT DEFAULT 0,       -- 投信買賣超
  dealer_buy BIGINT DEFAULT 0,      -- 自營商買進
  dealer_sell BIGINT DEFAULT 0,     -- 自營商賣出
  dealer_net BIGINT DEFAULT 0,      -- 自營商買賣超
  total_net BIGINT DEFAULT 0,       -- 三大法人合計
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, trade_date)
);

-- 財經新聞儲存表
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  news_id BIGINT UNIQUE NOT NULL, -- 鉅亨網原始 ID
  category VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  image_url TEXT,
  publish_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 月營收資料 (FinMind: TaiwanStockMonthRevenue)
CREATE TABLE IF NOT EXISTS monthly_revenue (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  revenue_year INTEGER NOT NULL,
  revenue_month INTEGER NOT NULL,
  revenue BIGINT, -- 當月營收
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, revenue_year, revenue_month)
);

-- 季財報資料 (FinMind: TaiwanStockFinancialStatements)
CREATE TABLE IF NOT EXISTS financial_statements (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  date DATE NOT NULL, -- 財報日期
  type VARCHAR(50), -- 財報類型 (e.g., EPS, Revenue)
  value NUMERIC(15, 4),
  origin_name VARCHAR(50), -- 原始項目名稱 (e.g., EarningsPerShare)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, date, type, origin_name)
);

-- 股里政策 (FinMind: TaiwanStockDividend)
CREATE TABLE IF NOT EXISTS dividend_policy (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  year INTEGER NOT NULL,
  cash_dividend NUMERIC(10, 4) DEFAULT 0,
  stock_dividend NUMERIC(10, 4) DEFAULT 0,
  total_dividend NUMERIC(10, 4) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, year)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON daily_prices(trade_date);
CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol ON daily_prices(symbol);
CREATE INDEX IF NOT EXISTS idx_fundamentals_date ON fundamentals(trade_date);
CREATE INDEX IF NOT EXISTS idx_institutional_date ON institutional(trade_date);
CREATE INDEX IF NOT EXISTS idx_news_publish_at ON news(publish_at);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);

-- 技術指標表
CREATE TABLE IF NOT EXISTS indicators (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL REFERENCES stocks(symbol),
  trade_date DATE NOT NULL,
  rsi_14 NUMERIC(10,2),
  macd_value NUMERIC(10,2),
  macd_signal NUMERIC(10,2),
  macd_hist NUMERIC(10,2),
  ma_5 NUMERIC(10,2),
  ma_10 NUMERIC(10,2),
  ma_20 NUMERIC(10,2),
  ma_60 NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, trade_date)
);
CREATE INDEX IF NOT EXISTS idx_indicators_date ON indicators(trade_date);
CREATE INDEX IF NOT EXISTS idx_indicators_symbol ON indicators(symbol);

-- 自選股清單
CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO watchlists (name) SELECT '我的自選股' WHERE NOT EXISTS (SELECT 1 FROM watchlists);

CREATE TABLE IF NOT EXISTS watchlist_items (
    watchlist_id INTEGER REFERENCES watchlists(id) ON DELETE CASCADE,
    symbol VARCHAR(10) REFERENCES stocks(symbol) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (watchlist_id, symbol)
);

-- 儲存的篩選條件
CREATE TABLE IF NOT EXISTS saved_filters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    filters JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
