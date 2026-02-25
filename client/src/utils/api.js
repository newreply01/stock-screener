const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function screenStocks(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            searchParams.append(key, value);
        }
    });
    const res = await fetch(`${API_BASE}/screen?${searchParams.toString()}`);
    if (!res.ok) throw new Error('篩選請求失敗');
    return res.json();
}

export async function getStats(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.append('date', params.date);
    const res = await fetch(`${API_BASE}/stats?${searchParams.toString()}`);
    if (!res.ok) throw new Error('統計請求失敗');
    return res.json();
}

export async function getMarketStats() {
    const res = await fetch(`${API_BASE}/market-stats`);
    if (!res.ok) throw new Error('獲取市場統計失敗');
    return res.json();
}

export async function getInstitutionalRank(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.append('type', params.type);
    if (params.range) searchParams.append('range', params.range);
    const res = await fetch(`${API_BASE}/institutional-rank?${searchParams.toString()}`);
    if (!res.ok) throw new Error('獲取法人排行失敗');
    return res.json();
}

export async function getNews(category = 'all', limit = 10) {
    const res = await fetch(`${API_BASE}/news?category=${category}&limit=${limit}`);
    if (!res.ok) throw new Error('獲取新聞失敗');
    return res.json();
}

export async function getHistory(symbol, limit = 200) {
    if (!symbol) return [];
    const res = await fetch(`${API_BASE}/history/${symbol}?limit=${limit}`);
    if (!res.ok) throw new Error('獲取歷史資料失敗');
    return res.json();
}

export async function getComparisonData(symbols, limit = 100) {
    if (!symbols || symbols.length === 0) return {};
    const symbolStr = symbols.join(',');
    const res = await fetch(`${API_BASE}/compare?symbols=${symbolStr}&limit=${limit}`);
    if (!res.ok) throw new Error('獲取多股比較資料失敗');
    return res.json();
}

export async function getStockFinancials(symbol) {
    if (!symbol) return null;
    const res = await fetch(`${API_BASE}/stock/${symbol}/financials`);
    if (!res.ok) throw new Error('獲取財務資料失敗');
    return res.json();
}

export async function getInstitutionalData(symbol, limit = 60) {
    if (!symbol) return [];
    const res = await fetch(`${API_BASE}/stock/${symbol}/institutional?limit=${limit}`);
    if (!res.ok) throw new Error('獲取籌碼資料失敗');
    return res.json();
}

export async function getAIReport(symbol) {
    if (!symbol) return null;
    const res = await fetch(`${API_BASE}/stock/${symbol}/ai-report`);
    if (!res.ok) throw new Error('獲取 AI 報告失敗');
    return res.json();
}

export async function getWatchlists() {
    const res = await fetch(`${API_BASE}/watchlists`);
    if (!res.ok) throw new Error('獲取自選股失敗');
    return res.json();
}

export async function addStockToWatchlist(watchlistId, symbol) {
    const res = await fetch(`${API_BASE}/watchlists/${watchlistId}/symbols`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
    });
    if (!res.ok) throw new Error('加入自選股失敗');
    return res.json();
}

export async function removeStockFromWatchlist(watchlistId, symbol) {
    const res = await fetch(`${API_BASE}/watchlists/${watchlistId}/symbols/${symbol}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('移除自選股失敗');
    return res.json();
}

export async function getSavedFilters() {
    const res = await fetch(`${API_BASE}/filters`);
    if (!res.ok) throw new Error('獲取篩選器失敗');
    return res.json();
}

export async function saveFilter(name, filters) {
    const res = await fetch(`${API_BASE}/filters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters })
    });
    if (!res.ok) throw new Error('儲存篩選器失敗');
    return res.json();
}

export async function deleteFilter(id) {
    const res = await fetch(`${API_BASE}/filters/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('刪除篩選器失敗');
    return res.json();
}
