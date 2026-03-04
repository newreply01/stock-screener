import React, { useState, useEffect } from 'react';
import { Search, Flame } from 'lucide-react';
import { getRealtimeTicks, getRealtimeActive } from '../utils/api';

const RealtimeExplorer = ({ onStockSelect }) => {
    const [symbol, setSymbol] = useState('2330');
    const [stockName, setStockName] = useState('');
    const [industry, setIndustry] = useState('');
    const [date, setDate] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(null);
    const [activeSymbols, setActiveSymbols] = useState([]);

    const loadActiveSymbols = async () => {
        try {
            const res = await getRealtimeActive();
            if (res.success && res.data) {
                setActiveSymbols(res.data);
            }
        } catch (e) { console.error('Failed to load active symbols', e); }
    };

    const fetchData = async (sym, dt) => {
        if (!sym) return;
        setLoading(true);
        try {
            const res = await getRealtimeTicks(sym, dt);
            if (res.success) {
                setData(res.data || []);
                setCurrentDate(res.date);
                setStockName(res.name || '');
                setIndustry(res.industry || '');
                if (!dt && res.date) setDate(res.date);

                // If data is empty, load suggestions
                if (!res.data || res.data.length === 0) {
                    loadActiveSymbols();
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load initial data
    useEffect(() => {
        fetchData(symbol, date);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        fetchData(symbol, date);
    };

    const formatPrice = (p) => p ? parseFloat(p).toFixed(2) : '-.--';

    // Simple logic for coloring
    const getRowColor = (tick) => {
        const basePrice = tick.previous_close || tick.open_price;
        if (!tick.price || !basePrice) return 'text-slate-700';
        if (tick.price > basePrice) return 'text-red-600 bg-red-50/50';
        if (tick.price < basePrice) return 'text-green-600 bg-green-50/50';
        return 'text-yellow-600 bg-yellow-50/50';
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-[calc(100vh-120px)]">
            {/* Header / Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-4 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        🕰️ 盤中分時資料查詢 (1 分K)
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        {stockName && (
                            <span className="text-sm font-black text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/10">
                                {stockName} ({symbol})
                            </span>
                        )}
                        {industry && (
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                {industry}
                            </span>
                        )}
                        {!stockName && (
                            <p className="text-sm text-slate-500">
                                查詢高頻資料庫中記錄的歷史或即時 1 分鐘級別市場快照
                            </p>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="border border-slate-300 rounded px-3 py-1.5 text-sm outline-none focus:border-brand-primary"
                    />
                    <div className="relative">
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            placeholder="股票代號"
                            className="w-32 border border-slate-300 rounded px-3 py-1.5 text-sm outline-none focus:border-brand-primary pl-8"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-2 top-2" />
                    </div>
                    <button type="submit" className="bg-brand-primary hover:bg-brand-dark text-white rounded px-4 py-1.5 text-sm font-bold transition-colors shadow-sm">
                        查詢
                    </button>
                </form>
            </div>

            {/* Content Body */}
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="font-bold text-slate-700 text-lg">
                    {symbol}
                </span>
                <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    資料日期: {currentDate || date || 'N/A'}
                </span>
            </div>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-center">
                    <thead className="bg-slate-50 text-slate-600 sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200 w-32">時間</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">最新成交價</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">昨收</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">漲跌</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">漲跌幅</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">開盤價</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">最高價</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">最低價</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">成交張數</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">單分量</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">內盤力道</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">外盤力道</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="8" className="py-12 text-slate-400 text-center">正在讀取巨量資料...</td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="py-12 bg-white text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500 min-h-[150px]">
                                        <Search className="w-8 h-8 text-slate-300 mb-3" />
                                        <p className="font-bold text-base mb-1">({symbol}) 查無分時資料</p>
                                        <p className="text-sm mb-4">這可能是因為該標的在查詢日期無交易紀錄，<br />或者是即時爬蟲尚未在此時段擷取到新的成交快照。</p>

                                        {activeSymbols.length > 0 && (
                                            <div className="mt-4 max-w-lg w-full">
                                                <div className="flex items-center gap-2 justify-center mb-3">
                                                    <Flame className="w-4 h-4 text-orange-500" />
                                                    <span className="text-sm font-bold text-slate-700">您可以試試看目前最活躍的標的：</span>
                                                </div>
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    {activeSymbols.map(st => (
                                                        <button
                                                            key={st.symbol}
                                                            onClick={() => {
                                                                setSymbol(st.symbol);
                                                                fetchData(st.symbol, date);
                                                            }}
                                                            className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5"
                                                        >
                                                            <span>{st.symbol}</span>
                                                            <span className="text-[10px] bg-orange-200/50 px-1 rounded text-orange-800">
                                                                筆數 {st.ticks_count}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map((tick, i) => {
                                const basePrice = tick.previous_close || tick.open_price;
                                const diff = tick.price && basePrice ? tick.price - basePrice : null;
                                const diffPct = diff !== null && basePrice ? (diff / basePrice) * 100 : null;
                                const diffColor = diff > 0 ? 'text-red-600 font-bold' : (diff < 0 ? 'text-green-600 font-bold' : 'text-slate-500 font-bold');
                                const diffSign = diff > 0 ? '▲' : (diff < 0 ? '▼' : '');

                                return (
                                    <tr key={i} className={`hover:bg-slate-100/50 transition-colors ${getRowColor(tick)}`}>
                                        <td className="py-2.5 px-4 font-mono text-slate-500 font-medium">
                                            {tick.time_str}
                                        </td>
                                        <td className="py-2.5 px-4 font-bold">
                                            {formatPrice(tick.price)}
                                        </td>
                                        <td className="py-2.5 px-4 text-purple-600 font-medium">{formatPrice(tick.previous_close)}</td>
                                        <td className={`py-2.5 px-4 ${diffColor}`}>
                                            {diff !== null ? `${diffSign} ${Math.abs(diff).toFixed(2)}` : '--'}
                                        </td>
                                        <td className={`py-2.5 px-4 ${diffColor}`}>
                                            {diffPct !== null ? `${diffPct.toFixed(2)}%` : '--'}
                                        </td>
                                        <td className="py-2.5 px-4">{formatPrice(tick.open_price)}</td>
                                        <td className="py-2.5 px-4 text-red-500">{formatPrice(tick.high_price)}</td>
                                        <td className="py-2.5 px-4 text-green-500">{formatPrice(tick.low_price)}</td>
                                        <td className="py-2.5 px-4 font-bold text-blue-600">{tick.trade_volume}</td>
                                        <td className="py-2.5 px-4 font-bold text-amber-600">{tick.volume}</td>
                                        <td className="py-2.5 px-4 text-green-600">{tick.sell_intensity}%</td>
                                        <td className="py-2.5 px-4 text-red-600">{tick.buy_intensity}%</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-slate-400">
                <span>共載入 {data.length} 筆資料</span>
                <span>雙擊股票代號欄位可追蹤其即時走勢</span>
            </div>
        </div>
    );
};

export default RealtimeExplorer;
