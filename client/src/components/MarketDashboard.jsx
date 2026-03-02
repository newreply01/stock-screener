import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3, Flame, Calendar, ArrowRight } from 'lucide-react';
import { getMarketSummary, screenStocks } from '../utils/api';
import MarketFocus from './MarketFocus';
import MarketMarginChart from './MarketMarginChart';
import ResultTable from './ResultTable';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';

export default function MarketDashboard({ onStockSelect, watchedSymbols, onToggleWatchlist }) {
    const [market, setMarket] = useState('all');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Filter and table state
    const [filters, setFilters] = useState({});
    const [results, setResults] = useState({ data: [], total: 0, page: 1, totalPages: 0, latestDate: null });
    const [tableLoading, setTableLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('volume');
    const [sortDir, setSortDir] = useState('desc');

    const fetchTableData = useCallback(async () => {
        setTableLoading(true);
        try {
            const res = await screenStocks({
                ...filters,
                market: market === 'all' ? undefined : market,
                sort_by: sortBy,
                sort_dir: sortDir,
                page,
                limit: 50
            });
            setResults(res || { data: [], total: 0, page: 1, totalPages: 0, latestDate: null });
        } catch (err) {
            console.error('Table fetch error:', err);
        } finally {
            setTableLoading(false);
        }
    }, [filters, sortBy, sortDir, page, market]);

    useEffect(() => {
        fetchTableData();
    }, [fetchTableData]);

    useEffect(() => {
        const fetchSummary = async () => {
            setLoading(true);
            try {
                const res = await getMarketSummary({ market });
                if (res.success) {
                    setData(res);
                }
            } catch (err) {
                console.error('Fetch market summary failed', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [market]);

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-white/50 rounded-2xl border border-gray-100 animate-pulse">
                <Activity className="w-12 h-12 text-brand-primary mb-4 opacity-50" />
                <span className="font-bold text-gray-400 uppercase tracking-[0.2em]">正在彙整市場大數據...</span>
            </div>
        );
    }

    if (!data || !data.success) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-dashed border-gray-200">
                <Activity className="w-12 h-12 text-gray-300 mb-4" />
                <span className="font-bold text-gray-500">暫無大盤資料，請稍後再試</span>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold shadow-md"
                >
                    重新整理
                </button>
            </div>
        );
    }

    const { distribution, industries, twseVolume, tpexVolume, latestDate } = data || {};

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Selector */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100 shadow-inner">
                        <Activity className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">台股大盤觀測站</h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-0.5">Market Intelligence Dashboard</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                        {[
                            { id: 'all', label: '全部' },
                            { id: 'twse', label: '上市' },
                            { id: 'tpex', label: '上櫃' }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMarket(m.id)}
                                className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${market === m.id ? 'bg-white text-brand-primary shadow-md' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    <div className="hidden lg:flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                        <Calendar className="w-4 h-4" />
                        最後更新: {latestDate || '---'}
                    </div>
                </div>
            </div>

            <MarketFocus market={market} onStockSelect={onStockSelect} />
            <MarketMarginChart />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 1. Price Distribution (Histogram) - 4 Cols */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-indigo-500" />
                                個股漲跌分佈
                            </h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Price Movement Histogram</p>
                        </div>
                        <div className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase tracking-tighter">Real-time Stats</div>
                    </div>

                    <div className="flex-1 flex justify-between gap-2 h-48 mb-4">
                        {[
                            { id: 'limit_up', label: '漲停', count: distribution?.limit_up, color: 'bg-red-600', hoverColor: 'hover:bg-red-700' },
                            { id: 'up_5', label: '5%↑', count: distribution?.up_5, color: 'bg-red-500', hoverColor: 'hover:bg-red-600' },
                            { id: 'up_2_5', label: '2-5%', count: distribution?.up_2_5, color: 'bg-red-400', hoverColor: 'hover:bg-red-500' },
                            { id: 'up_0_2', label: '0-2%', count: distribution?.up_0_2, color: 'bg-red-300', hoverColor: 'hover:bg-red-400' },
                            { id: 'flat', label: '平盤', count: distribution?.flat, color: 'bg-gray-400', hoverColor: 'hover:bg-gray-500' },
                            { id: 'down_0_2', label: '0-2%↓', count: distribution?.down_0_2, color: 'bg-green-300', hoverColor: 'hover:bg-green-400' },
                            { id: 'down_2_5', label: '2-5%↓', count: distribution?.down_2_5, color: 'bg-green-400', hoverColor: 'hover:bg-green-500' },
                            { id: 'down_5', label: '5%↓', count: distribution?.down_5, color: 'bg-green-500', hoverColor: 'hover:bg-green-600' },
                            { id: 'limit_down', label: '跌停', count: distribution?.limit_down, color: 'bg-green-600', hoverColor: 'hover:bg-green-700' },
                        ].map((bar, i) => {
                            const histogramValues = distribution ? [
                                distribution.limit_up, distribution.up_5, distribution.up_2_5, distribution.up_0_2,
                                distribution.flat,
                                distribution.down_0_2, distribution.down_2_5, distribution.down_5, distribution.limit_down
                            ].map(v => Number(v) || 0) : [1];
                            const maxVal = Math.max(...histogramValues, 1);
                            const countNum = Number(bar.count) || 0;
                            const height = `${(countNum / maxVal) * 100}%`;

                            // 點擊後發送事件給 Screener 讓他跳轉或篩選
                            const getCategoryFilter = (id) => {
                                switch (id) {
                                    case 'limit_up': return { change_min: '9.5', change_max: '' };
                                    case 'up_5': return { change_min: '5.0', change_max: '9.49' };
                                    case 'up_2_5': return { change_min: '2.0', change_max: '4.99' };
                                    case 'up_0_2': return { change_min: '0.01', change_max: '1.99' };
                                    case 'flat': return { change_min: '0', change_max: '0' };
                                    case 'down_0_2': return { change_min: '-1.99', change_max: '-0.01' };
                                    case 'down_2_5': return { change_min: '-4.99', change_max: '-2.0' };
                                    case 'down_5': return { change_min: '-9.49', change_max: '-5.0' };
                                    case 'limit_down': return { change_min: '', change_max: '-9.5' };
                                    default: return {};
                                }
                            };

                            const handleBarClick = () => {
                                setFilters(getCategoryFilter(bar.id));
                                setPage(1);
                                document.getElementById('market-result-table')?.scrollIntoView({ behavior: 'smooth' });
                            };

                            return (
                                <div key={i} className="flex-1 h-full flex flex-col items-center group cursor-pointer" onClick={handleBarClick}>
                                    <div className="relative w-full flex-1 flex flex-col items-center mb-2 justify-end">
                                        <div className="absolute -top-6 text-[10px] font-black text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-10 whitespace-nowrap">{countNum} 家</div>
                                        <div
                                            className={`w-full rounded-t-lg transition-all duration-700 ease-out shadow-sm ${bar.color} ${bar.hoverColor} group-hover:-translate-y-1`}
                                            style={{ height: height, minHeight: countNum > 0 ? '4px' : '2px' }}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-black text-gray-400 mt-2 whitespace-nowrap tracking-tighter group-hover:text-gray-700">{bar.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Industry Sector Performance - 7 Cols */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-red-500" />
                                產業類股表現
                            </h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Sector Performance Rank</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {/* 顯示漲幅前 5 與 跌幅前 5 */}
                        {[
                            ...(industries?.slice(0, 5) || []),
                            ...(industries?.slice(-5).reverse() || [])
                        ].map((ind, i) => {
                            const change = parseFloat(ind.avg_change);
                            return (
                                <div
                                    key={i}
                                    className="flex flex-col gap-1.5 group cursor-pointer"
                                    onClick={() => {
                                        setFilters({ industry: ind.industry });
                                        setPage(1);
                                        document.getElementById('market-result-table')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                >
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-black text-gray-700 group-hover:text-brand-primary transition-colors">{ind.industry}</span>
                                        <span className={`text-xs font-black ${change >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${change >= 0 ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-green-400 to-green-600'}`}
                                            style={{ width: `${Math.min(Math.abs(change) * 10, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Hot Volume Charts - Split TWSE / TPEX */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {/* TWSE Top Volume */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center border border-blue-200">
                                <Flame className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-800 tracking-tight">上市成交量榜</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">TWSE Hot Volume</p>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={twseVolume} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" fontSize={10} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                    <YAxis type="category" dataKey="name" width={70} fontSize={11} fontWeight="bold" />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                const isUp = parseFloat(data.change_percent) >= 0;
                                                return (
                                                    <div className="z-50 bg-white/95 backdrop-blur-sm p-3 border border-gray-200 shadow-lg rounded-xl">
                                                        <p className="font-black text-gray-800 text-sm mb-1">{data.name} ({data.symbol})</p>
                                                        <p className="font-bold text-gray-600 text-xs">成交價: <span className="text-gray-900">{data.close_price}</span></p>
                                                        <p className="font-bold text-xs mt-0.5">漲跌: <span className={isUp ? 'text-red-500' : 'text-green-500'}>{isUp ? '+' : ''}{data.change_percent}%</span></p>
                                                        <p className="font-bold text-indigo-500 text-xs mt-0.5">成交量: {(data.volume / 1000).toFixed(0)} 張</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                                        {twseVolume?.map((entry, index) => {
                                            const isUp = parseFloat(entry.change_percent) >= 0;
                                            return <Cell key={`cell-${index}`} fill={isUp ? '#ef4444' : '#22c55e'} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* TPEX Top Volume */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center border border-amber-200">
                                <Flame className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-800 tracking-tight">上櫃成交量榜</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">TPEX Hot Volume</p>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tpexVolume} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" fontSize={10} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                                    <YAxis type="category" dataKey="name" width={70} fontSize={11} fontWeight="bold" />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                const isUp = parseFloat(data.change_percent) >= 0;
                                                return (
                                                    <div className="z-50 bg-white/95 backdrop-blur-sm p-3 border border-gray-200 shadow-lg rounded-xl">
                                                        <p className="font-black text-gray-800 text-sm mb-1">{data.name} ({data.symbol})</p>
                                                        <p className="font-bold text-gray-600 text-xs">成交價: <span className="text-gray-900">{data.close_price}</span></p>
                                                        <p className="font-bold text-xs mt-0.5">漲跌: <span className={isUp ? 'text-red-500' : 'text-green-500'}>{isUp ? '+' : ''}{data.change_percent}%</span></p>
                                                        <p className="font-bold text-indigo-500 text-xs mt-0.5">成交量: {(data.volume / 1000).toFixed(0)} 張</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                                        {tpexVolume?.map((entry, index) => {
                                            const isUp = parseFloat(entry.change_percent) >= 0;
                                            return <Cell key={`cell-${index}`} fill={isUp ? '#ef4444' : '#22c55e'} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* 4. Embedded ResultTable */}
                <div id="market-result-table" className="lg:col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-8">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center border border-indigo-200">
                                <Activity className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-800 tracking-tight">盤中篩選結果</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Screening Results</p>
                            </div>
                        </div>
                        {Object.keys(filters).length > 0 && (
                            <button
                                onClick={() => {
                                    setFilters({});
                                    setPage(1);
                                }}
                                className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-black hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-2 shadow-sm"
                            >
                                清除篩選
                            </button>
                        )}
                    </div>
                    <ResultTable
                        results={results}
                        loading={tableLoading}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={(c) => {
                            if (sortBy === c) setSortDir(p => p === 'desc' ? 'asc' : 'desc');
                            else { setSortBy(c); setSortDir('desc'); }
                            setPage(1);
                        }}
                        page={page}
                        onPageChange={setPage}
                        onStockClick={onStockSelect}
                        watchedSymbols={watchedSymbols}
                        onToggleWatchlist={onToggleWatchlist}
                    />
                </div>
            </div>
        </div>
    );
}
