-- FinMind 全資料集 Migration
-- 建立 34 個免費資料集所需的資料表

-- ============================================================
-- 技術面
-- ============================================================

-- 1. TaiwanStockInfo (台股總覽) - 已有 stocks 表，新增擴展欄位
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS stock_type VARCHAR(50);
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS listing_date DATE;

-- 2. TaiwanStockInfoWithWarrant (含權證) - 用同一張 stocks 表即可

-- 3. TaiwanStockTradingDate (交易日)
CREATE TABLE IF NOT EXISTS trading_dates (
    date DATE PRIMARY KEY,
    description VARCHAR(100)
);

-- 4. TaiwanStockPrice (日成交) - 已有 daily_prices 表
-- 新增 finmind 來源的股價表以避免衝突
CREATE TABLE IF NOT EXISTS fm_stock_price (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    close NUMERIC,
    volume BIGINT,
    spread NUMERIC,
    trading_value BIGINT,
    trading_turnover BIGINT,
    PRIMARY KEY (stock_id, date)
);

-- 5. TaiwanStockPER (PER/PBR) - 已有 fundamentals 表
CREATE TABLE IF NOT EXISTS fm_stock_per (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    pe_ratio NUMERIC,
    pb_ratio NUMERIC,
    dividend_yield NUMERIC,
    PRIMARY KEY (stock_id, date)
);

-- 6. TaiwanStockDayTrading (當沖)
CREATE TABLE IF NOT EXISTS fm_day_trading (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    buy_after_sell_volume BIGINT,
    buy_after_sell_amount BIGINT,
    sell_after_buy_volume BIGINT,
    sell_after_buy_amount BIGINT,
    day_trade_volume BIGINT,
    day_trade_amount BIGINT,
    PRIMARY KEY (stock_id, date)
);

-- 7. TaiwanStockTotalReturnIndex (報酬指數)
CREATE TABLE IF NOT EXISTS fm_total_return_index (
    date DATE NOT NULL,
    price NUMERIC,
    stock_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (stock_id, date)
);

-- ============================================================
-- 基本面
-- ============================================================

-- 8. TaiwanStockFinancialStatements (損益表) - 已有 financial_statements 表
-- 建立更完整的 FinMind 專用表
CREATE TABLE IF NOT EXISTS fm_financial_statements (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(200) NOT NULL,
    value NUMERIC,
    origin_name VARCHAR(200),
    PRIMARY KEY (stock_id, date, type)
);

-- 9. TaiwanStockBalanceSheet (資產負債表)
CREATE TABLE IF NOT EXISTS fm_balance_sheet (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(200) NOT NULL,
    value NUMERIC,
    origin_name VARCHAR(200),
    PRIMARY KEY (stock_id, date, type)
);

-- 10. TaiwanStockCashFlowsStatement (現金流量表)
CREATE TABLE IF NOT EXISTS fm_cash_flows (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(200) NOT NULL,
    value NUMERIC,
    origin_name VARCHAR(200),
    PRIMARY KEY (stock_id, date, type)
);

-- 11. TaiwanStockDividend (股利政策) - 已有 dividend_policy 表
CREATE TABLE IF NOT EXISTS fm_dividend (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    year INTEGER,
    stock_earnings_distribution NUMERIC,
    stock_statutory_surplus_distribution NUMERIC,
    stock_surplus_distribution NUMERIC,
    cash_earnings_distribution NUMERIC,
    cash_statutory_surplus_distribution NUMERIC,
    cash_surplus_distribution NUMERIC,
    cash_dividend NUMERIC,
    stock_dividend NUMERIC,
    total_dividend NUMERIC,
    PRIMARY KEY (stock_id, date)
);

-- 12. TaiwanStockDividendResult (除權息結果)
CREATE TABLE IF NOT EXISTS fm_dividend_result (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    before_price NUMERIC,
    after_price NUMERIC,
    stock_and_cash_dividend NUMERIC,
    rate_of_return NUMERIC,
    cash_dividend NUMERIC,
    stock_dividend NUMERIC,
    PRIMARY KEY (stock_id, date)
);

-- 13. TaiwanStockMonthRevenue (月營收) - 已有 monthly_revenue 表
CREATE TABLE IF NOT EXISTS fm_month_revenue (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    country VARCHAR(10),
    revenue BIGINT,
    revenue_month INTEGER,
    revenue_year INTEGER,
    PRIMARY KEY (stock_id, date)
);

-- 14. TaiwanStockCapitalReductionReferencePrice (減資參考價)
CREATE TABLE IF NOT EXISTS fm_capital_reduction (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    closing_price NUMERIC,
    reduction_per_share NUMERIC,
    reference_price NUMERIC,
    limit_up NUMERIC,
    limit_down NUMERIC,
    open_date DATE,
    reason VARCHAR(200),
    PRIMARY KEY (stock_id, date)
);

-- 15. TaiwanStockDelisting (下市櫃表)
CREATE TABLE IF NOT EXISTS fm_delisting (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    stock_name VARCHAR(100),
    reason VARCHAR(500),
    PRIMARY KEY (stock_id, date)
);

-- 16. TaiwanStockSplitPrice (分割參考價)
CREATE TABLE IF NOT EXISTS fm_split_price (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    before_price NUMERIC,
    after_price NUMERIC,
    PRIMARY KEY (stock_id, date)
);

-- 17. TaiwanStockParValueChange (面額變更參考價)
CREATE TABLE IF NOT EXISTS fm_par_value_change (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    before_price NUMERIC,
    after_price NUMERIC,
    PRIMARY KEY (stock_id, date)
);

-- ============================================================
-- 籌碼面
-- ============================================================

-- 18. TaiwanStockMarginPurchaseShortSale (融資融券)
CREATE TABLE IF NOT EXISTS fm_margin_trading (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    margin_purchase_buy BIGINT,
    margin_purchase_sell BIGINT,
    margin_purchase_cash_repayment BIGINT,
    margin_purchase_yesterday_balance BIGINT,
    margin_purchase_today_balance BIGINT,
    margin_purchase_limit BIGINT,
    short_sale_buy BIGINT,
    short_sale_sell BIGINT,
    short_sale_cash_repayment BIGINT,
    short_sale_yesterday_balance BIGINT,
    short_sale_today_balance BIGINT,
    short_sale_limit BIGINT,
    offsetting_margin_short BIGINT,
    note VARCHAR(200),
    PRIMARY KEY (stock_id, date)
);

-- 19. TaiwanStockTotalMarginPurchaseShortSale (整體融資融券)
CREATE TABLE IF NOT EXISTS fm_total_margin (
    date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    margin_purchase_buy BIGINT,
    margin_purchase_sell BIGINT,
    margin_purchase_cash_repayment BIGINT,
    margin_purchase_yesterday_balance BIGINT,
    margin_purchase_today_balance BIGINT,
    short_sale_buy BIGINT,
    short_sale_sell BIGINT,
    short_sale_cash_repayment BIGINT,
    short_sale_yesterday_balance BIGINT,
    short_sale_today_balance BIGINT,
    PRIMARY KEY (date, name)
);

-- 20. TaiwanStockInstitutionalInvestorsBuySell (三大法人)
CREATE TABLE IF NOT EXISTS fm_institutional (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    buy BIGINT,
    sell BIGINT,
    PRIMARY KEY (stock_id, date, name)
);

-- 21. TaiwanStockTotalInstitutionalInvestors (整體法人)
CREATE TABLE IF NOT EXISTS fm_total_institutional (
    date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    buy BIGINT,
    sell BIGINT,
    PRIMARY KEY (date, name)
);

-- 22. TaiwanStockShareholding (外資持股)
CREATE TABLE IF NOT EXISTS fm_shareholding (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    foreign_invest_volume BIGINT,
    foreign_invest_ratio NUMERIC,
    PRIMARY KEY (stock_id, date)
);

-- 23. TaiwanStockSecuritiesLending (借券)
CREATE TABLE IF NOT EXISTS fm_securities_lending (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    volume BIGINT,
    fee_rate NUMERIC,
    close NUMERIC,
    PRIMARY KEY (stock_id, date, transaction_type)
);

-- 24. TaiwanStockMarginShortSaleSuspension (融券回補日)
CREATE TABLE IF NOT EXISTS fm_short_sale_suspension (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    reason VARCHAR(200),
    start_date DATE,
    end_date DATE,
    PRIMARY KEY (stock_id, date)
);

-- 25. TaiwanDailyShortSaleBalances (信用額度)
CREATE TABLE IF NOT EXISTS fm_short_sale_balances (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    margin_short_balance_previous_day BIGINT,
    margin_short_sell_volume BIGINT,
    margin_short_buy_volume BIGINT,
    margin_short_cash_repayment BIGINT,
    margin_short_balance BIGINT,
    margin_short_quota BIGINT,
    PRIMARY KEY (stock_id, date)
);

-- 26. TaiwanSecuritiesTraderInfo (券商資訊)
CREATE TABLE IF NOT EXISTS fm_securities_trader_info (
    securities_trader_id VARCHAR(20) PRIMARY KEY,
    securities_trader VARCHAR(100),
    address VARCHAR(300),
    phone VARCHAR(50),
    is_main BOOLEAN
);

-- ============================================================
-- 衍生性金融商品
-- ============================================================

-- 27. TaiwanFutOptDailyInfo (期貨選擇權總覽)
CREATE TABLE IF NOT EXISTS fm_futopt_daily_info (
    date DATE NOT NULL,
    call_put VARCHAR(10),
    contract_date VARCHAR(20) NOT NULL,
    close NUMERIC,
    change_percent NUMERIC,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    volume BIGINT,
    settlement_price NUMERIC,
    open_interest BIGINT,
    trading_session VARCHAR(20),
    futures_id VARCHAR(30) NOT NULL,
    PRIMARY KEY (date, futures_id, contract_date)
);

-- 28. TaiwanFuturesDaily (期貨日成交)
CREATE TABLE IF NOT EXISTS fm_futures_daily (
    date DATE NOT NULL,
    futures_id VARCHAR(30) NOT NULL,
    contract_date VARCHAR(20) NOT NULL,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    close NUMERIC,
    change NUMERIC,
    change_percent NUMERIC,
    volume BIGINT,
    settlement_price NUMERIC,
    open_interest BIGINT,
    trading_session VARCHAR(20),
    PRIMARY KEY (date, futures_id, contract_date)
);

-- 29. TaiwanOptionDaily (選擇權日成交)
CREATE TABLE IF NOT EXISTS fm_option_daily (
    date DATE NOT NULL,
    option_id VARCHAR(30) NOT NULL,
    contract_date VARCHAR(20) NOT NULL,
    call_put VARCHAR(10),
    strike_price NUMERIC,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    close NUMERIC,
    volume BIGINT,
    settlement_price NUMERIC,
    open_interest BIGINT,
    trading_session VARCHAR(20),
    PRIMARY KEY (date, option_id, contract_date, call_put, strike_price)
);

-- 30. TaiwanFuturesInstitutionalInvestors (期貨法人)
CREATE TABLE IF NOT EXISTS fm_futures_institutional (
    date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    institutional_investors VARCHAR(100) NOT NULL,
    long_deal_volume BIGINT,
    long_deal_amount BIGINT,
    short_deal_volume BIGINT,
    short_deal_amount BIGINT,
    long_open_interest_volume BIGINT,
    long_open_interest_amount BIGINT,
    short_open_interest_volume BIGINT,
    short_open_interest_amount BIGINT,
    PRIMARY KEY (date, name, institutional_investors)
);

-- 31. TaiwanOptionInstitutionalInvestors (選擇權法人)
CREATE TABLE IF NOT EXISTS fm_option_institutional (
    date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    institutional_investors VARCHAR(100) NOT NULL,
    long_deal_volume BIGINT,
    long_deal_amount BIGINT,
    short_deal_volume BIGINT,
    short_deal_amount BIGINT,
    long_open_interest_volume BIGINT,
    long_open_interest_amount BIGINT,
    short_open_interest_volume BIGINT,
    short_open_interest_amount BIGINT,
    PRIMARY KEY (date, name, institutional_investors)
);

-- 32. TaiwanFuturesDealerTradingVolumeDaily (期貨券商交易)
CREATE TABLE IF NOT EXISTS fm_futures_dealer (
    date DATE NOT NULL,
    futures_id VARCHAR(30) NOT NULL,
    dealer_id VARCHAR(20) NOT NULL,
    dealer_name VARCHAR(100),
    volume BIGINT,
    is_buy BOOLEAN,
    PRIMARY KEY (date, futures_id, dealer_id, is_buy)
);

-- 33. TaiwanOptionDealerTradingVolumeDaily (選擇權券商交易)
CREATE TABLE IF NOT EXISTS fm_option_dealer (
    date DATE NOT NULL,
    option_id VARCHAR(30) NOT NULL,
    dealer_id VARCHAR(20) NOT NULL,
    dealer_name VARCHAR(100),
    volume BIGINT,
    is_buy BOOLEAN,
    PRIMARY KEY (date, option_id, dealer_id, is_buy)
);

-- ============================================================
-- 其他
-- ============================================================

-- 34. TaiwanStockNews (新聞) - 已有 news 表
CREATE TABLE IF NOT EXISTS fm_stock_news (
    stock_id VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    title TEXT,
    source VARCHAR(200),
    description TEXT,
    PRIMARY KEY (stock_id, date, title)
);

-- ============================================================
-- 同步進度追蹤表
-- ============================================================
CREATE TABLE IF NOT EXISTS fm_sync_progress (
    dataset VARCHAR(100) NOT NULL,
    stock_id VARCHAR(10) NOT NULL DEFAULT '',
    last_sync_date TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'done',
    PRIMARY KEY (dataset, stock_id)
);
