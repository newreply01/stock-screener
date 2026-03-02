import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { getRealtimeTicks } from '../utils/api';

const RealtimeExplorer = ({ onStockSelect }) => {
    const [symbol, setSymbol] = useState('2330');
    const [date, setDate] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(null);

    const fetchData = async (sym, dt) => {
        if (!sym) return;
        setLoading(true);
        try {
            const res = await getRealtimeTicks(sym, dt);
            if (res.success) {
                setData(res.data || []);
                setCurrentDate(res.date);
                if (!dt && res.date) setDate(res.date);
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
        if (!tick.price || !tick.open_price) return 'text-slate-700';
        if (tick.price > tick.open_price) return 'text-red-600 bg-red-50/50';
        if (tick.price < tick.open_price) return 'text-green-600 bg-green-50/50';
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
                    <p className="text-sm text-slate-500 mt-1">
                        查詢高頻資料庫中記錄的歷史或即時 1 分鐘級別市場快照
                    </p>
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
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">開盤價</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">最高價</th>
                            <th className="py-3 px-4 font-semibold border-b border-slate-200">最低價</th>
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
                                <td colSpan="8" className="py-12 text-slate-400 text-center">此日期沒有找到分時資料</td>
                            </tr>
                        ) : (
                            data.map((tick, i) => (
                                <tr key={i} className={`hover:bg-slate-100/50 transition-colors ${getRowColor(tick)}`}>
                                    <td className="py-2.5 px-4 font-mono text-slate-500 font-medium">
                                        {tick.time_str}
                                    </td>
                                    <td className="py-2.5 px-4 font-bold">
                                        {formatPrice(tick.price)}
                                    </td>
                                    <td className="py-2.5 px-4">{formatPrice(tick.open_price)}</td>
                                    <td className="py-2.5 px-4 text-red-500">{formatPrice(tick.high_price)}</td>
                                    <td className="py-2.5 px-4 text-green-500">{formatPrice(tick.low_price)}</td>
                                    <td className="py-2.5 px-4 font-bold text-amber-600">{tick.volume}</td>
                                    <td className="py-2.5 px-4 text-green-600">{tick.sell_intensity}%</td>
                                    <td className="py-2.5 px-4 text-red-600">{tick.buy_intensity}%</td>
                                </tr>
                            ))
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
