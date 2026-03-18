import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, Award, Target, Calendar, BarChart3, AlertCircle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { API_BASE } from '../utils/api';

const SMART_RATING_COLORS = {
    "強力買進": "text-rose-600",
    "買進": "text-emerald-600",
    "觀望": "text-blue-600",
    "賣出": "text-orange-600",
    "強力賣出": "text-slate-600"
};

const GRADE_COLORS = {
    "優秀": "text-emerald-600",
    "良好": "text-blue-600",
    "普通": "text-orange-600",
    "待改善": "text-rose-600"
};

export default function HealthBacktestDashboard() {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDateIdx, setSelectedDateIdx] = useState(0);
    const [chartTarget, setChartTarget] = useState("強力買進"); // 強力買進, 優秀, 良好, 成長指標
    const [showStockList, setShowStockList] = useState(false);
    const [categoryStocks, setCategoryStocks] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${API_BASE}/health-check/backtest-stats`);
                const json = await res.json();
                if (json.success) {
                    setStats(json.data || []);
                }
            } catch (e) {
                console.error('Backtest fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);
    
    const fetchCategoryStocks = async (item) => {
        setListLoading(true);
        setSelectedCategory(item);
        setShowStockList(true);
        try {
            const currentDay = stats[selectedDateIdx];
            const type = item.smart_rating ? 'rating' : 'grade';
            const category = item.smart_rating || item.grade;
            const res = await fetch(`${API_BASE}/health-check/backtest-category-stocks?recommend_date=${currentDay.recommend_date}&test_date=${currentDay.test_date}&category=${category}&type=${type}`);
            const json = await res.json();
            if (json.success) {
                setCategoryStocks(json.data || []);
            }
        } catch (e) {
            console.error('Fetch category stocks error:', e);
        } finally {
            setListLoading(false);
        }
    };

    const trendData = useMemo(() => {
        if (!stats || !stats.length) return [];
        let targetCum = 0;
        let marketCum = 0;
        return [...stats].reverse().map(s => {
            const metrics = s?.metrics || [];
            let targetMetric;
            if (chartTarget === "成長指標") {
                targetMetric = metrics.find(m => m.dimension === 'growth_score');
            } else if (chartTarget === "優秀") {
                targetMetric = metrics.find(m => m.grade === '優秀');
            } else if (chartTarget === "良好") {
                targetMetric = metrics.find(m => m.grade === '良好');
            } else {
                targetMetric = metrics.find(m => m.smart_rating === "強力買進");
            }

            const targetRet = targetMetric ? (parseFloat(targetMetric.avg_return_pct) || 0) : 0;
            const marketRet = parseFloat(s?.taiex_return) || 0;
            
            targetCum += targetRet;
            marketCum += marketRet;
            
            return {
                date: s?.test_date || '---',
                [chartTarget]: parseFloat(targetCum.toFixed(2)),
                "大盤指數": parseFloat(marketCum.toFixed(2))
            };
        });
    }, [stats, chartTarget]);

    if (loading) return <div className="p-20 text-center text-slate-400 font-bold">加載回測數據中...</div>;
    if (stats.length === 0) return <div className="p-20 text-center text-slate-400 font-bold">尚無足夠的歷史數據進行回測</div>;

    const currentDay = stats[selectedDateIdx];
    const metrics = currentDay?.metrics || [];
    const smartRatings = metrics.filter(m => m?.smart_rating).sort((a, b) => (parseFloat(b.avg_return_pct) || 0) - (parseFloat(a.avg_return_pct) || 0));
    const grades = metrics.filter(m => !m?.smart_rating && m?.grade).sort((a, b) => (parseFloat(b.avg_return_pct) || 0) - (parseFloat(a.avg_return_pct) || 0));

    return (
        <div className="space-y-8 p-6 bg-white animate-in fade-in duration-500">
            {/* Header & Date Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <Target className="w-8 h-8 text-teal-600" />
                        評分回測監控
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                        Accuracy & Performance Backtest · {currentDay.recommend_date} 推薦對比 {currentDay.test_date} 表現
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    {stats.map((d, i) => (
                        <button
                            key={i}
                            onClick={() => setSelectedDateIdx(i)}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${selectedDateIdx === i ? 'bg-white shadow-sm text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {d?.test_date?.split('-')?.slice(1)?.join('/') || '---'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Performance Trend Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-800">歷史累計報酬趨勢</h3>
                        <div className="flex gap-2 mt-2">
                            {["強力買進", "優秀", "良好", "成長指標"].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setChartTarget(t)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${chartTarget === t ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">最近 {stats.length} 次回測總結</div>
                        <div className="text-xl font-black text-teal-600">
                            {trendData.length > 0 ? (trendData[trendData.length - 1][chartTarget]).toFixed(2) : 0}%
                        </div>
                    </div>
                </div>
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" hide />
                            <YAxis fontSize={10} tickFormatter={(v) => `${v}%`} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            <Legend iconType="circle" />
                            <Line type="monotone" dataKey={chartTarget} stroke="#0d9488" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="大盤指數" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Smart Rating Performance */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-rose-500" />
                    <h3 className="text-lg font-black text-slate-800">智慧評級回測 (Smart Rating)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {smartRatings.map((m, i) => (
                        <div 
                            key={i} 
                            onClick={() => fetchCategoryStocks(m)}
                            className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer hover:bg-teal-50/50 hover:border-teal-100"
                        >
                            {/* Performance vs Market Indicator */}
                            <div className={`absolute top-0 right-0 px-3 py-1 text-[8px] font-black uppercase tracking-tighter rounded-bl-xl ${m.avg_return_pct > currentDay.taiex_return ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {m.avg_return_pct > currentDay.taiex_return ? '超額收益' : '落後大盤'}
                            </div>

                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-sm font-black ${SMART_RATING_COLORS[m.smart_rating] || 'text-slate-600'}`}>
                                    {m.smart_rating}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100 italic">
                                    N={m.count}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs font-bold text-slate-400 flex justify-between">
                                    <span>擊敗大盤勝率</span>
                                    <span className={m.active_win_rate_pct >= 50 ? 'text-rose-500' : 'text-slate-500'}>{m.active_win_rate_pct}%</span>
                                </div>
                                <div className="text-2xl font-black tabular-nums tracking-tighter flex items-center gap-2">
                                    <span className={m.avg_return_pct >= 0 ? 'text-red-500' : 'text-green-600'}>
                                        {m.avg_return_pct >= 0 ? '+' : ''}{m.avg_return_pct}%
                                    </span>
                                    {m.avg_return_pct >= 0 ? <TrendingUp className="w-5 h-5 text-red-400" /> : <TrendingDown className="w-5 h-5 text-green-400" />}
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-slate-400 font-medium">平均漲跌幅</span>
                                    <span className="text-slate-400 font-bold">大盤: {currentDay.taiex_return}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Grade Performance */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-teal-500" />
                    <h3 className="text-lg font-black text-slate-800">等級表現回測 (Overall Grade)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {grades.map((m, i) => (
                        <div 
                            key={i} 
                            onClick={() => fetchCategoryStocks(m)}
                            className={`bg-white border-2 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all cursor-pointer ${m.avg_return_pct > currentDay.taiex_return ? 'border-rose-100 bg-rose-50/20 hover:bg-rose-50' : 'border-slate-50 hover:bg-slate-50'}`}
                        >
                            <div className={`p-3 rounded-2xl ${m.avg_return_pct >= 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                                {m.avg_return_pct >= 0 ? <TrendingUp className={`w-6 h-6 ${m.avg_return_pct >= 0 ? 'text-rose-500' : 'text-emerald-500'}`} /> : <TrendingDown className="w-6 h-6 text-emerald-500" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className={`text-base font-black ${GRADE_COLORS[m.grade] || 'text-slate-600'}`}>{m.grade}</span>
                                    <span className="text-[10px] font-bold text-slate-300">N={m.count}</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className={`text-xl font-black ${m.avg_return_pct >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                        {m.avg_return_pct}%
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-slate-400">大盤勝率</span>
                                        <span className="text-[10px] font-black text-indigo-500">{m.active_win_rate_pct}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Note */}
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <Info className="w-6 h-6 text-amber-500" />
                </div>
                <div className="text-xs text-amber-700 font-medium leading-relaxed">
                    <p className="font-black text-sm mb-2 uppercase tracking-widest">回測邏輯與專用術語</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 list-disc pl-4">
                        <li><strong>比較日</strong>：以「健診計算日」後的下一個交易日收盤價為準。</li>
                        <li><strong>擊敗大盤勝率</strong>：該等級中，漲幅優於當日大盤（TAIEX）漲跌幅的個股比例。</li>
                        <li><strong>超額收益</strong>：該等級的平均報酬率減去當日大盤漲跌幅。</li>
                        <li><strong>N 樣本數</strong>：代表當日被歸類為該等級的股票總數。N &lt; 5 時結果僅供參考。</li>
                        <li><strong>累計報酬趨勢</strong>：假設每日均等權重持有「強力買進」標的之累計滾動收益。</li>
                    </ul>
                </div>
            </div>

            {/* Stock List Modal */}
            {showStockList && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    {selectedCategory?.smart_rating || selectedCategory?.grade} 相關個股
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    回測表現：{selectedCategory?.avg_return_pct}% · 共 {categoryStocks.length} 檔
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowStockList(false)}
                                className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <Activity className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {listLoading ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 font-bold">讀取中...</div>
                            ) : categoryStocks.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-slate-400 font-bold">查無符合條件的個股</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">
                                            <th className="px-4 py-3">股票</th>
                                            <th className="px-4 py-3 text-right">推薦價</th>
                                            <th className="px-4 py-3 text-right">回測價</th>
                                            <th className="px-4 py-3 text-right">漲跌%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {categoryStocks.map(stock => (
                                            <tr key={stock.symbol} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-4 py-4">
                                                    <div className="font-black text-slate-800">{stock.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400">{stock.symbol}</div>
                                                </td>
                                                <td className="px-4 py-4 text-right font-bold text-slate-600 tabular-nums">{stock.recommend_price}</td>
                                                <td className="px-4 py-4 text-right font-bold text-slate-600 tabular-nums">{stock.test_price}</td>
                                                <td className={`px-4 py-4 text-right font-black tabular-nums ${stock.return_pct >= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                    {stock.return_pct > 0 ? '+' : ''}{stock.return_pct}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

