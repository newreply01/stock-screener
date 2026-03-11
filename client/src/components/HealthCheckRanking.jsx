import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, TrendingUp, TrendingDown, Shield, Target, Coins, Users, Award, BarChart3, PieChart, Activity, Layout } from 'lucide-react';
import { API_BASE } from '../utils/api';
import { useGlobalFilters } from '../context/GlobalFilterContext';
import GlobalFilterBar from './GlobalFilterBar';
import StockSearchAutocomplete from './StockSearchAutocomplete';
import HealthCheckView from './HealthCheckView';
import ValuationRiverView from './ValuationRiverView';
import StockCompareView from './StockCompareView';
import TrendView from './TrendView';
import StockChart from './StockChart';
import AIReportView from './AIReportView';

const GRADE_STYLES = {
    green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', badge: 'bg-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', badge: 'bg-blue-500' },
    yellow: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', badge: 'bg-amber-500' },
    red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', badge: 'bg-red-500' }
};

function ScoreBar({ score, size = 'sm' }) {
    const color = score >= 75 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 45 ? '#f59e0b' : '#ef4444';
    const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
    return (
        <div className={`w-full bg-slate-100 rounded-full ${h}`}>
            <div className={`${h} rounded-full transition-all duration-700`} style={{ width: `${score}%`, backgroundColor: color }}></div>
        </div>
    );
}

function getScoreColor(score) {
    if (score >= 75) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 45) return '#f59e0b';
    return '#ef4444';
}

const SORT_OPTIONS = [
    { value: 'overall_score', label: '綜合分數' },
    { value: 'profit_score', label: '獲利能力' },
    { value: 'growth_score', label: '成長能力' },
    { value: 'safety_score', label: '安全性' },
    { value: 'value_score', label: '價值衡量' },
    { value: 'dividend_score', label: '配息能力' },
    { value: 'chip_score', label: '籌碼面' },
    { value: 'pe', label: '本益比' },
    { value: 'dividend_yield', label: '殖利率' },
    { value: 'revenue_growth', label: '營收年增率' }
];

const GRADE_OPTIONS = [
    { value: '', label: '全部等級' },
    { value: '優秀', label: '🏆 優秀 (≥75)' },
    { value: '良好', label: '⭐ 良好 (60-74)' },
    { value: '普通', label: '📊 普通 (45-59)' },
    { value: '待改善', label: '⚠️ 待改善 (<45)' }
];

export default function HealthCheckRanking({ onSelectStock }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [sort, setSort] = useState('overall_score');
    const [order, setOrder] = useState('DESC');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const { marketForApi, stockTypesForApi, industry: globalIndustry, setIndustry: setGlobalIndustry } = useGlobalFilters();
    const [grade, setGrade] = useState('');
    const [industries, setIndustries] = useState([]);
    const [calcDate, setCalcDate] = useState(null);

    // Tab & Stock Management
    const [activeTab, setActiveTab] = useState('ranking'); // ranking, health, valuation, pk, trend, chart
    const [selectedStock, setSelectedStock] = useState(null);

    const TABS = [
        { id: 'ranking', label: '健診排行', icon: Award },
        { id: 'health', label: '健診分析', icon: Shield },
        { id: 'ai_report', label: 'AI分析報告', icon: Activity },
        { id: 'valuation', label: '估價模型', icon: Coins },
        { id: 'trend', label: '趨勢強弱', icon: Activity },
        { id: 'chart', label: '股價量圖', icon: BarChart3 },
        { id: 'pk', label: '個股 PK', icon: Users }
    ];

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                sort, order, page, limit,
                ...(search && { search }),
                ...(globalIndustry && globalIndustry !== 'all' && { industry: globalIndustry }),
                ...(marketForApi && { market: marketForApi }),
                ...(stockTypesForApi && { stock_types: stockTypesForApi }),
                ...(grade && { grade })
            });
            const res = await fetch(`${API_BASE}/health-check-ranking?${params}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data || []);
                setTotal(json.total || 0);
                setIndustries(json.industries || []);
                setCalcDate(json.calcDate);
            }
        } catch (e) {
            console.error('Health ranking error:', e);
        } finally {
            setLoading(false);
        }
    }, [sort, order, page, limit, search, globalIndustry, marketForApi, stockTypesForApi, grade]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleSort = (col) => {
        if (sort === col) setOrder(o => o === 'DESC' ? 'ASC' : 'DESC');
        else { setSort(col); setOrder('DESC'); }
        setPage(1);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    const totalPages = Math.ceil(total / limit);

    // Stats
    const excellentCount = data.filter(d => d.grade === '優秀').length;
    const goodCount = data.filter(d => d.grade === '良好').length;

    return (
        <div className="space-y-0 min-h-screen bg-slate-50/50 pb-20">
            <GlobalFilterBar />

            {/* Sub Navigation Tabs */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 pt-4 shadow-sm">
                <div className="max-w-[1400px] mx-auto flex flex-wrap gap-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-t-xl text-sm font-black transition-all relative ${activeTab === tab.id
                                ? 'text-teal-600 bg-teal-50/50'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-teal-600' : 'text-slate-400'}`} />
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-500 rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-6 max-w-[1400px] mx-auto space-y-6">
                {/* Search Bar for Analysis Tabs */}
                {activeTab !== 'ranking' && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-teal-50 p-3 rounded-2xl">
                                <Search className="w-6 h-6 text-teal-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-brand-primary tracking-tight">
                                    {selectedStock ? `${selectedStock.name} (${selectedStock.symbol})` : '切換分析標的'}
                                </h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {selectedStock ? `目前分析標的：${selectedStock.industry || '未指定行業'}` : '請搜尋或從排行中選擇股票進行分析'}
                                </p>
                            </div>
                        </div>
                        <div className="w-full sm:w-96">
                            <StockSearchAutocomplete onSelectStock={(s) => setSelectedStock(s)} />
                        </div>
                    </div>
                )}

                {activeTab === 'ranking' ? (
                    <>
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-2">
                    <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-3 rounded-2xl shadow-lg shadow-teal-200/50">
                        <Heart className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">個股健診排行</h1>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Stock Health Check Ranking · {total} 檔個股
                            {calcDate && <span className="ml-2">· 更新日期: {new Date(calcDate).toLocaleDateString('zh-TW')}</span>}
                        </p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: '總評估數', value: total, icon: BarChart3, color: 'text-slate-600', bg: 'bg-slate-50' },
                        { label: '優秀 (≥75)', value: `${excellentCount}`, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: '良好 (60-74)', value: `${goodCount}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: '目前篩選結果', value: `${total} 檔`, icon: Filter, color: 'text-violet-600', bg: 'bg-violet-50' }
                    ].map((stat, i) => (
                        <div key={i} className={`${stat.bg} p-4 rounded-xl border border-slate-200 shadow-sm`}>
                            <div className="flex items-center gap-2 mb-1">
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <div className={`text-2xl font-black ${stat.color} tabular-nums`}>{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* Filters Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    placeholder="搜尋股票代碼或名稱..."
                                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 font-medium"
                                />
                            </div>
                            <button type="submit" className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors shadow-sm">
                                搜尋
                            </button>
                        </form>

                        {/* Grade Filter */}
                        <select
                            value={grade}
                            onChange={e => { setGrade(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer bg-white min-w-[140px]"
                        >
                            {GRADE_OPTIONS.map(g => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </select>


                        {/* Sort */}
                        <select
                            value={sort}
                            onChange={e => { setSort(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer bg-white"
                        >
                            {SORT_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>排序: {s.label}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => setOrder(o => o === 'DESC' ? 'ASC' : 'DESC')}
                            className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
                            title={order === 'DESC' ? '降序' : '升序'}
                        >
                            <ArrowUpDown className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500 mb-4"></div>
                            <p className="font-bold text-sm">載入健診資料...</p>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
                            <Heart className="w-12 h-12 text-slate-300 mb-4" />
                            <p className="font-bold text-slate-600">無符合條件的結果</p>
                            <p className="text-sm mt-1">請調整篩選條件後再試</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider sticky left-0 bg-slate-50 z-10 w-[50px]">#</th>
                                        <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider sticky left-[50px] bg-slate-50 z-10 min-w-[160px]">股票</th>
                                        <th className="text-center px-3 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider cursor-pointer hover:text-teal-600 transition-colors" onClick={() => toggleSort('overall_score')}>
                                            <div className="flex items-center justify-center gap-1">綜合 {sort === 'overall_score' && (order === 'DESC' ? '↓' : '↑')}</div>
                                        </th>
                                        <th className="text-center px-2 py-3 font-bold text-slate-500 text-xs tracking-wider">等級</th>
                                        <th className="text-center px-2 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('profit_score')}>
                                            獲利 {sort === 'profit_score' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-center px-2 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('growth_score')}>
                                            成長 {sort === 'growth_score' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-center px-2 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('safety_score')}>
                                            安全 {sort === 'safety_score' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-center px-2 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('value_score')}>
                                            價值 {sort === 'value_score' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-center px-2 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('dividend_score')}>
                                            配息 {sort === 'dividend_score' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-center px-2 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('chip_score')}>
                                            籌碼 {sort === 'chip_score' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-right px-3 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('close_price')}>
                                            股價 {sort === 'close_price' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-right px-3 py-3 font-bold text-slate-500 text-xs tracking-wider">漲跌%</th>
                                        <th className="text-right px-3 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('pe')}>
                                            PE {sort === 'pe' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                        <th className="text-right px-3 py-3 font-bold text-slate-500 text-xs tracking-wider cursor-pointer hover:text-teal-600" onClick={() => toggleSort('dividend_yield')}>
                                            殖利率 {sort === 'dividend_yield' && (order === 'DESC' ? '↓' : '↑')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((stock, idx) => {
                                        const rank = (page - 1) * limit + idx + 1;
                                        const gradeStyle = GRADE_STYLES[stock.grade_color] || GRADE_STYLES.yellow;
                                        const changePct = parseFloat(stock.change_percent);
                                        const isUp = changePct > 0;
                                        const isDown = changePct < 0;

                                        return (
                                            <tr
                                                key={stock.symbol}
                                                className={`border-b border-slate-100 hover:bg-teal-50/30 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                                onClick={() => {
                                                    setSelectedStock({ symbol: stock.symbol, name: stock.name, industry: stock.industry, market: stock.market });
                                                    setActiveTab('health');
                                                }}
                                            >
                                                <td className="px-4 py-3 font-black text-slate-400 text-xs sticky left-0 bg-inherit z-10">
                                                    {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                                                </td>
                                                <td className="px-4 py-3 sticky left-[50px] bg-inherit z-10">
                                                    <div className="flex items-center gap-2">
                                                        <div>
                                                            <div className="font-black text-slate-800 text-sm">{stock.name}</div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] text-slate-400 font-bold">{stock.symbol}</span>
                                                                {stock.industry && <span className="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">{stock.industry}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-lg font-black tabular-nums" style={{ color: getScoreColor(stock.overall_score) }}>{stock.overall_score}</span>
                                                        <ScoreBar score={stock.overall_score} />
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <span className={`text-[11px] font-black px-2 py-1 rounded-full text-white ${gradeStyle.badge}`}>
                                                        {stock.grade}
                                                    </span>
                                                </td>
                                                {['profit_score', 'growth_score', 'safety_score', 'value_score', 'dividend_score', 'chip_score'].map(field => (
                                                    <td key={field} className="px-2 py-3 text-center">
                                                        <span className="text-xs font-bold tabular-nums" style={{ color: getScoreColor(stock[field]) }}>
                                                            {stock[field]}
                                                        </span>
                                                    </td>
                                                ))}
                                                <td className="px-3 py-3 text-right font-bold text-slate-800 tabular-nums text-sm">
                                                    {parseFloat(stock.close_price)?.toFixed(2)}
                                                </td>
                                                <td className={`px-3 py-3 text-right font-bold tabular-nums text-sm ${isUp ? 'text-red-500' : isDown ? 'text-green-600' : 'text-slate-500'}`}>
                                                    {isUp ? '+' : ''}{changePct?.toFixed(2)}%
                                                </td>
                                                <td className="px-3 py-3 text-right font-bold text-slate-700 tabular-nums text-sm">
                                                    {parseFloat(stock.pe) ? parseFloat(stock.pe).toFixed(1) : '--'}
                                                </td>
                                                <td className="px-3 py-3 text-right font-bold text-slate-700 tabular-nums text-sm">
                                                    {parseFloat(stock.dividend_yield) ? parseFloat(stock.dividend_yield).toFixed(2) + '%' : '--'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                            <div className="text-xs text-slate-500 font-medium">
                                第 {page} / {totalPages} 頁 · 共 {total} 筆
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let p;
                                    if (totalPages <= 5) p = i + 1;
                                    else if (page <= 3) p = i + 1;
                                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                                    else p = page - 2 + i;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${page === p ? 'bg-teal-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-white'}`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </>
        ) : (

                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[700px]">
                    {!selectedStock && activeTab !== 'pk' ? (
                        <div className="h-[600px] flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                            <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6 border border-teal-100 shadow-inner">
                                <Search className="w-10 h-10 text-teal-300" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-700 mb-3 tracking-tight">尚未選擇分析標的</h3>
                            <p className="text-sm font-bold text-slate-400 max-w-sm leading-relaxed mb-8">請在上方搜尋框輸入股票代號，<br />或從「健診排行」中點擊股票進行深入分析。</p>
                            <div className="w-64">
                                <StockSearchAutocomplete onSelectStock={(s) => setSelectedStock(s)} />
                            </div>
                        </div>
                    ) : activeTab === 'health' ? (
                        <div className="p-0">
                            <HealthCheckView symbol={selectedStock.symbol} />
                        </div>
                    ) : activeTab === 'ai_report' ? (
                        <div className="p-0">
                            <AIReportView symbol={selectedStock.symbol} name={selectedStock.name} />
                        </div>
                    ) : activeTab === 'valuation' ? (
                        <div className="p-8">
                            <ValuationRiverView symbol={selectedStock.symbol} />
                        </div>
                    ) : activeTab === 'pk' ? (
                        <div className="p-0">
                            <StockCompareView initialSymbols={selectedStock ? [selectedStock.symbol] : []} />
                        </div>
                    ) : activeTab === 'trend' ? (
                        <div className="p-0">
                            <TrendView stock={selectedStock} />
                        </div>
                    ) : activeTab === 'chart' ? (
                        <div className="p-8 min-h-[800px]">
                            <StockChart stock={selectedStock} />
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    </div>
    );
}

