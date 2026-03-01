import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3, Flame, Calendar, ArrowRight } from 'lucide-react';
import { getMarketSummary } from '../utils/api';

export default function MarketDashboard({ onStockSelect }) {
    const [market, setMarket] = useState('all');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

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

    const { distribution, industries, hotStocks, latestDate } = data || {};

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

                    <div className="flex-1 flex items-end justify-between gap-2 h-48 mb-4">
                        {[
                            { label: '漲停', count: distribution?.limit_up, color: 'bg-red-600', hoverColor: 'hover:bg-red-700' },
                            { label: '5%↑', count: distribution?.up_5, color: 'bg-red-500', hoverColor: 'hover:bg-red-600' },
                            { label: '2-5%', count: distribution?.up_2_5, color: 'bg-red-400', hoverColor: 'hover:bg-red-500' },
                            { label: '0-2%', count: distribution?.up_0_2, color: 'bg-red-300', hoverColor: 'hover:bg-red-400' },
                            { label: '平盤', count: distribution?.flat, color: 'bg-gray-400', hoverColor: 'hover:bg-gray-500' },
                            { label: '0-2%↓', count: distribution?.down_0_2, color: 'bg-green-300', hoverColor: 'hover:bg-green-400' },
                            { label: '2-5%↓', count: distribution?.down_2_5, color: 'bg-green-400', hoverColor: 'hover:bg-green-500' },
                            { label: '5%↓', count: distribution?.down_5, color: 'bg-green-500', hoverColor: 'hover:bg-green-600' },
                            { label: '跌停', count: distribution?.limit_down, color: 'bg-green-600', hoverColor: 'hover:bg-green-700' },
                        ].map((bar, i) => {
                            const histogramValues = distribution ? [
                                distribution.limit_up, distribution.up_5, distribution.up_2_5, distribution.up_0_2,
                                distribution.flat,
                                distribution.down_0_2, distribution.down_2_5, distribution.down_5, distribution.limit_down
                            ].map(Number) : [1];
                            const maxVal = Math.max(...histogramValues, 1);
                            const height = `${(Number(bar.count) / maxVal) * 100}%`;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center group">
                                    <div className="relative w-full flex flex-col items-center mb-2">
                                        <div className="absolute -top-6 text-[10px] font-black text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100 z-10">{bar.count}</div>
                                        <div
                                            className={`w-full rounded-t-lg transition-all duration-700 ease-out shadow-sm ${bar.color} ${bar.hoverColor} group-hover:-translate-y-1`}
                                            style={{ height: height || '2px', minHeight: '2px' }}
                                        ></div>
                                    </div>
                                    <span className="text-[10px] font-black text-gray-400 mt-2 whitespace-nowrap tracking-tighter">{bar.label}</span>
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
                                <div key={i} className="flex flex-col gap-1.5 group cursor-default">
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

                {/* 3. Hot Stocks Table - full width or grid */}
                <div className="lg:col-span-12 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center border border-amber-200">
                                <Flame className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-800 tracking-tight">盤中成交量榜</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Today's Hot Trading Tickers</p>
                            </div>
                        </div>
                        <button
                            className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-black hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-2 shadow-sm"
                            onClick={() => window.dispatchEvent(new CustomEvent('muchstock-view', { detail: 'screener-config' }))}
                        >
                            智能篩選 <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">代號 / 名稱</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">成交價</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">漲跌幅</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">成交量 (張)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {hotStocks?.map((stock, i) => {
                                    const change = parseFloat(stock.change_percent);
                                    return (
                                        <tr key={i} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => onStockSelect(stock)}>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-gray-900 group-hover:text-brand-primary transition-colors">{stock.name}</span>
                                                    <span className="text-[11px] font-bold text-gray-400 group-hover:text-brand-primary/60 transition-colors">{stock.symbol}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-black text-gray-800 tracking-tight">{parseFloat(stock.close_price).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-sm font-black flex items-center justify-end gap-1 ${change >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-black text-indigo-600 tracking-tight">{Math.floor(Number(stock.volume) / 1000).toLocaleString()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button className="text-[10px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-brand-primary border border-transparent group-hover:border-brand-primary/20 bg-transparent group-hover:bg-brand-primary/5 px-2.5 py-1.5 rounded-lg transition-all">
                                                    View Chart
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
