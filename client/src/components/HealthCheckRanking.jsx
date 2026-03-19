import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, TrendingUp, TrendingDown, Shield, Target, Coins, Users, Award, BarChart3, PieChart, Activity, Layout, Zap, AlertCircle, Brain, Info } from 'lucide-react';
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
import QuickDiagnosisView from './QuickDiagnosisView';
import StockAnalyzer from './StockAnalyzer';
import HealthBacktestDashboard from './HealthBacktestDashboard';

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

const SMART_RATING_OPTIONS = [
    { value: '', label: '全部建議' },
    { value: '強力買進', label: '💎 強力買進' },
    { value: '買進', label: '🚀 買進' },
    { value: '觀望', label: '⚖️ 觀望' },
    { value: '賣出', label: '📉 賣出' },
    { value: '強力賣出', label: '🛑 強力賣出' }
];

const SMART_RATING_STYLES = {
    "強力買進": "bg-emerald-500",
    "買進": "bg-green-500",
    "觀望": "bg-slate-500",
    "賣出": "bg-orange-500",
    "強力賣出": "bg-red-500"
};

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
    const [smartRating, setSmartRating] = useState('');
    const [industries, setIndustries] = useState([]);
    const [calcDate, setCalcDate] = useState(null);
    const [smartRatingCounts, setSmartRatingCounts] = useState({});
    const [gradeCounts, setGradeCounts] = useState({});

    // Tab & Stock Management
    const [activeTab, setActiveTab] = useState('ranking'); // ranking, health, analyzer, ai_report, valuation, pk, trend, chart
    const [selectedStock, setSelectedStock] = useState({ symbol: '2330', name: '台積電', industry: '半導體業', market: '上市' });

    const TABS = [
        { id: 'ranking', label: '健診排行', icon: Award },
        { id: 'analyzer', label: '股票分析 (Beta)', icon: Brain },
        { id: 'quick_diagnosis', label: '快速診斷', icon: Zap },
        { id: 'health', label: '健診分析', icon: Shield },
        { id: 'ai_report', label: 'AI分析報告', icon: Activity },
        { id: 'backtest', label: '回測監控', icon: Target },
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
                ...(grade && { grade }),
                ...(smartRating && { smart_rating: smartRating })
            });
            const res = await fetch(`${API_BASE}/health-check-ranking?${params}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data || []);
                setTotal(json.total || 0);
                setIndustries(json.industries || []);
                setCalcDate(json.calcDate);
                if (json.smartRatingCounts) {
                    setSmartRatingCounts(json.smartRatingCounts);
                }
                if (json.gradeCounts) {
                    setGradeCounts(json.gradeCounts);
                }
            }
        } catch (e) {
            console.error('Health ranking error:', e);
        } finally {
            setLoading(false);
        }
    }, [sort, order, page, limit, search, globalIndustry, marketForApi, stockTypesForApi, grade, smartRating]);

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
                {activeTab !== 'ranking' && activeTab !== 'analyzer' && (
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

                {/* Grade Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {[
                        { label: '目前篩選', value: `${total} 檔`, icon: Filter, color: 'text-violet-600', bg: 'bg-violet-50', active: false, logic: '當前所有過濾條件下的個股總數' },
                        { label: '優秀', value: gradeCounts['優秀'] || 0, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50', active: grade === '優秀', logic: '綜合分數 ≥ 75 分', onClick: () => { setGrade(grade === '優秀' ? '' : '優秀'); setPage(1); } },
                        { label: '良好', value: gradeCounts['良好'] || 0, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', active: grade === '良好', logic: '綜合分數介於 60 ~ 74 分', onClick: () => { setGrade(grade === '良好' ? '' : '良好'); setPage(1); } },
                        { label: '普通', value: gradeCounts['普通'] || 0, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50', active: grade === '普通', logic: '綜合分數介於 45 ~ 59 分', onClick: () => { setGrade(grade === '普通' ? '' : '普通'); setPage(1); } },
                        { label: '待改善', value: gradeCounts['待改善'] || 0, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', active: grade === '待改善', logic: '綜合分數低於 45 分', onClick: () => { setGrade(grade === '待改善' ? '' : '待改善'); setPage(1); } }
                    ].map((stat, i) => (
                        <div 
                            key={i} 
                            onClick={stat.onClick}
                            className={`${stat.bg} p-4 rounded-xl border-2 transition-all cursor-pointer shadow-sm group relative ${stat.active ? 'border-current ring-2 ring-offset-1 ring-slate-100' : 'border-slate-200 hover:border-slate-300'}`}
                            style={stat.active ? { borderColor: 'currentColor' } : {}}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <div className="relative group/info">
                                    <Info className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 transition-colors" />
                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible lg:group-hover:opacity-100 lg:group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                                        <div className="font-bold mb-1 border-b border-white/20 pb-1">{stat.label} 條件說明</div>
                                        {stat.logic}
                                    </div>
                                </div>
                            </div>
                            <div className={`text-2xl font-black ${stat.color} tabular-nums`}>{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* Smart Rating Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                        { label: '強力買進', value: smartRatingCounts['強力買進'] || 0, icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50', active: smartRating === '強力買進', logic: '智慧評分 > 0.45。代表技術面、位置、情緒三者均處於極佳狀態。', onClick: () => { setSmartRating(smartRating === '強力買進' ? '' : '強力買進'); setPage(1); } },
                        { label: '買進', value: smartRatingCounts['買進'] || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', active: smartRating === '買進', logic: '智慧評分介於 0.15 ~ 0.45。整體面向上看好。', onClick: () => { setSmartRating(smartRating === '買進' ? '' : '買進'); setPage(1); } },
                        { label: '觀望', value: smartRatingCounts['觀望'] || 0, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', active: smartRating === '觀望', logic: '智慧評分介於 -0.15 ~ 0.15。市場方向不明朗或指標互相抵消。', onClick: () => { setSmartRating(smartRating === '觀望' ? '' : '觀望'); setPage(1); } },
                        { label: '賣出', value: smartRatingCounts['賣出'] || 0, icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50', active: smartRating === '賣出', logic: '智慧評分介於 -0.45 ~ -0.15。整體面向趨於保守或看空。', onClick: () => { setSmartRating(smartRating === '賣出' ? '' : '賣出'); setPage(1); } },
                        { label: '強力賣出', value: smartRatingCounts['強力賣出'] || 0, icon: AlertCircle, color: 'text-slate-600', bg: 'bg-slate-50', active: smartRating === '強力賣出', logic: '智慧評分 < -0.45。代表技術面過熱、位置偏高且情緒不佳。', onClick: () => { setSmartRating(smartRating === '強力賣出' ? '' : '強力賣出'); setPage(1); } }
                    ].map((stat, i) => (
                        <div 
                            key={i} 
                            onClick={stat.onClick}
                            className={`${stat.bg} p-4 rounded-xl border-2 transition-all cursor-pointer shadow-sm group relative ${stat.active ? 'border-current ring-2 ring-offset-1 ring-slate-100' : 'border-slate-200 hover:border-slate-300'}`}
                            style={stat.active ? { borderColor: 'currentColor' } : {}}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <div className="relative group/info">
                                    <Info className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 transition-colors" />
                                    <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible lg:group-hover:opacity-100 lg:group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                                        <div className="font-bold mb-1 border-b border-white/20 pb-1">{stat.label} 條件說明</div>
                                        <div className="space-y-1">
                                            <p>{stat.logic}</p>
                                            <p className="border-t border-white/10 pt-1 text-slate-400 italic">智慧評分 = 技術指標(40%) + 價格位階(30%) + 市場情緒(30%)</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={`text-2xl font-black ${stat.color} tabular-nums`}>{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase">
                                    <th className="px-4 py-3 text-left w-12 sticky left-0 bg-slate-50 z-10">#</th>
                                    <th className="px-4 py-3 text-left sticky left-12 bg-slate-50 z-10">股票</th>
                                    <th className="px-3 py-3 text-center cursor-pointer" onClick={() => toggleSort('overall_score')}>綜合</th>
                                    <th className="px-2 py-3 text-center">操作建議</th>
                                    <th className="px-2 py-3 text-center">等級</th>
                                    <th className="px-2 py-3 text-center">獲利</th>
                                    <th className="px-2 py-3 text-center">成長</th>
                                    <th className="px-2 py-3 text-center">安全</th>
                                    <th className="px-2 py-3 text-center">價值</th>
                                    <th className="px-2 py-3 text-center">配息</th>
                                    <th className="px-2 py-3 text-center">籌碼</th>
                                    <th className="px-3 py-3 text-right">股價</th>
                                    <th className="px-3 py-3 text-right">漲跌%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((stock, idx) => {
                                    const rank = (page - 1) * limit + idx + 1;
                                    const gradeStyle = GRADE_STYLES[stock.grade_color] || GRADE_STYLES.yellow;
                                    return (
                                        <tr 
                                            key={stock.symbol} 
                                            className="border-b border-slate-100 hover:bg-teal-50/50 cursor-pointer transition-colors"
                                            onClick={() => {
                                                setSelectedStock({ symbol: stock.symbol, name: stock.name, industry: stock.industry, market: stock.market });
                                                setActiveTab('health');
                                            }}
                                        >
                                            <td className="px-4 py-3 text-slate-400 font-bold sticky left-0 bg-white z-10">{rank}</td>
                                            <td className="px-4 py-3 sticky left-12 bg-white z-10">
                                                <div className="font-bold text-slate-800">{stock.name}</div>
                                                <div className="text-[10px] text-slate-400">{stock.symbol}</div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="font-black" style={{ color: getScoreColor(stock.overall_score) }}>{stock.overall_score}</span>
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${SMART_RATING_STYLES[stock.smart_rating] || 'bg-slate-400'}`}>
                                                    {stock.smart_rating}
                                                </span>
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${gradeStyle.badge}`}>
                                                    {stock.grade}
                                                </span>
                                            </td>
                                            {[stock.profit_score, stock.growth_score, stock.safety_score, stock.value_score, stock.dividend_score, stock.chip_score].map((s, i) => (
                                                <td key={i} className="px-2 py-3 text-center font-bold" style={{ color: getScoreColor(s) }}>{s}</td>
                                            ))}
                                            <td className="px-3 py-3 text-right font-bold text-slate-700">{stock.close_price}</td>
                                            <td className={`px-3 py-3 text-right font-bold ${parseFloat(stock.change_percent) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                {stock.change_percent}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                    </>
                ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[700px]">
                        {!selectedStock && activeTab !== 'pk' ? (
                            <div className="h-[600px] flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                                <Search className="w-12 h-12 text-teal-200 mb-4" />
                                <h3 className="text-xl font-bold text-slate-700">尚未選擇分析標的</h3>
                                <p className="text-sm mt-2">請從排行中點擊股票進行分析</p>
                            </div>
                        ) : activeTab === 'quick_diagnosis' ? (
                            <div className="p-8"><QuickDiagnosisView symbol={selectedStock.symbol} /></div>
                        ) : activeTab === 'health' ? (
                            <div className="p-0"><HealthCheckView symbol={selectedStock.symbol} /></div>
                        ) : activeTab === 'analyzer' ? (
                            <div className="p-8"><StockAnalyzer symbol={selectedStock.symbol} /></div>
                        ) : activeTab === 'ai_report' ? (
                            <div className="p-0"><AIReportView symbol={selectedStock.symbol} name={selectedStock.name} /></div>
                        ) : activeTab === 'backtest' ? (
                            <div className="p-0"><HealthBacktestDashboard /></div>
                        ) : activeTab === 'valuation' ? (
                            <div className="p-8"><ValuationRiverView symbol={selectedStock.symbol} /></div>
                        ) : activeTab === 'pk' ? (
                            <div className="p-0"><StockCompareView initialSymbols={selectedStock ? [selectedStock.symbol] : []} /></div>
                        ) : activeTab === 'trend' ? (
                            <div className="p-0"><TrendView stock={selectedStock} /></div>
                        ) : activeTab === 'chart' ? (
                            <div className="p-8 min-h-[800px]"><StockChart stock={selectedStock} /></div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}
