import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, ChevronRight, Star, Heart, Activity, BarChart2, List } from 'lucide-react';
import { getInstitutionalRank, getInstitutionalTotal } from '../utils/api';
import { useGlobalFilters } from '../context/GlobalFilterContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const InstitutionalRankView = ({ watchedSymbols, onToggleWatchlist }) => {
  const [viewMode, setViewMode] = useState('rank'); // rank, total
  const [data, setData] = useState([]);
  const [totalData, setTotalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('foreign'); // foreign, investment, dealer
  const [activeAction, setActiveAction] = useState('buy'); // buy, sell
  const [timeRange, setTimeRange] = useState('3d'); // 3d, 5d, 10d
  const { marketForApi, stockTypesForApi } = useGlobalFilters();

  useEffect(() => {
    if (viewMode === 'rank') {
      const fetchData = async () => {
        setLoading(true);
        try {
          const res = await getInstitutionalRank({
            type: activeType,
            range: timeRange,
            action: activeAction,
            market: marketForApi,
            stock_types: stockTypesForApi
          });
          if (res.success) setData(res.data);
        } catch (e) {
          console.error('Fetch institutional rank error:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      const fetchTotalData = async () => {
        setLoading(true);
        try {
          const res = await getInstitutionalTotal({ days: 30 });
          if (res.success) setTotalData(res.data);
        } catch (e) {
          console.error('Fetch institutional total error:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchTotalData();
    }
  }, [viewMode, activeType, timeRange, activeAction, marketForApi, stockTypesForApi]);

  const tabs = [
    { label: '外資', id: 'foreign', icon: <TrendingUp className="w-4 h-4" /> },
    { label: '投信', id: 'investment', icon: <Users className="w-4 h-4" /> },
    { label: '自營商', id: 'dealer', icon: <Activity className="w-4 h-4" /> },
  ];

  const ranges = [
    { label: '近 3 日', id: '3d' },
    { label: '近 5 日', id: '5d' },
    { label: '近 10 日', id: '10d' },
  ];

  const MarketTotalView = () => {
    const chartData = [...totalData].reverse().map(d => ({
        ...d,
        foreign: parseFloat(parseFloat(d.foreign_net).toFixed(2)),
        investment: parseFloat(parseFloat(d.trust_net).toFixed(2)),
        dealer: parseFloat(parseFloat(d.dealer_net).toFixed(2)),
        total: parseFloat(parseFloat(d.total_net).toFixed(2)),
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* 圖表區塊 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-slate-800 flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-brand-primary" />
                        法人大盤買賣趨勢 (單位: 億元)
                    </h3>
                    <div className="flex gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div>外資</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-orange-500"></div>投信</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-teal-500"></div>自營商</div>
                    </div>
                </div>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="date" 
                                fontSize={10} 
                                fontWeight="bold"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(str) => str.split('-').slice(1).join('/')}
                                dy={10}
                            />
                            <YAxis 
                                fontSize={10} 
                                fontWeight="bold" 
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                            />
                            <ReferenceLine y={0} stroke="#94a3b8" />
                            <Bar dataKey="foreign" name="外資" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="investment" name="投信" fill="#f97316" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="dealer" name="自營商" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 表格區塊 */}
            <div className="bg-white overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">日期</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">外資 (億)</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">投信 (億)</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">自營商 (億)</th>
                            <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">合計 (億)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {totalData.map((row, idx) => (
                            <tr key={row.date} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 text-sm font-bold text-slate-600 tabular-nums">{row.date}</td>
                                <td className={`px-6 py-4 text-sm font-black text-right tabular-nums ${row.foreign_net > 0 ? 'text-red-500' : row.foreign_net < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                    {row.foreign_net > 0 ? '+' : ''}{parseFloat(row.foreign_net).toFixed(2)}
                                </td>
                                <td className={`px-6 py-4 text-sm font-black text-right tabular-nums ${row.trust_net > 0 ? 'text-red-500' : row.trust_net < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                    {row.trust_net > 0 ? '+' : ''}{parseFloat(row.trust_net).toFixed(2)}
                                </td>
                                <td className={`px-6 py-4 text-sm font-black text-right tabular-nums ${row.dealer_net > 0 ? 'text-red-500' : row.dealer_net < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                    {row.dealer_net > 0 ? '+' : ''}{parseFloat(row.dealer_net).toFixed(2)}
                                </td>
                                <td className={`px-6 py-4 text-sm font-black text-right tabular-nums ${row.total_net > 0 ? 'text-red-500' : row.total_net < 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                    {row.total_net > 0 ? '+' : ''}{parseFloat(row.total_net).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 頂部導航與標題 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-brand-primary/10 rounded-2xl">
              <Users className="text-brand-primary w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">三大法人資金流向</h2>
          </div>
          <p className="text-slate-500 text-sm font-medium">追蹤市場主力資金動態，掌握盤勢與個股先機</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
           <button 
             onClick={() => setViewMode('rank')}
             className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${viewMode === 'rank' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
           >
             <List className="w-4 h-4" />
             個股排名
           </button>
           <button 
             onClick={() => setViewMode('total')}
             className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${viewMode === 'total' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
           >
             <BarChart2 className="w-4 h-4" />
             大盤統計
           </button>
        </div>
      </div>

      {viewMode === 'rank' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 排行篩選控制項 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {[
                    { label: '買超排行', id: 'buy' },
                    { label: '賣超排行', id: 'sell' },
                    ].map(a => (
                    <button
                        key={a.id}
                        onClick={() => setActiveAction(a.id)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeAction === a.id
                        ? (activeAction === 'buy' ? 'bg-red-500 text-white shadow-sm' : 'bg-green-600 text-white shadow-sm')
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        {a.label}
                    </button>
                    ))}
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {ranges.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setTimeRange(r.id)}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${timeRange === r.id
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                        }`}
                    >
                        {r.label}
                    </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveType(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all whitespace-nowrap font-bold ${activeType === tab.id
                    ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    {tab.icon}
                    {tab.label}
                </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                Array(6).fill(0).map((_, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 animate-pulse h-40 shadow-sm"></div>
                ))
                ) : data.length > 0 ? (
                data.map((stock, idx) => (
                    <div
                    key={stock.symbol}
                    className="group bg-white border border-slate-100 hover:border-brand-primary/30 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                    >
                    <div className={`absolute -top-1 -right-1 w-12 h-12 flex items-center justify-center rounded-bl-3xl ${idx < 3 ? 'bg-brand-primary/10' : 'bg-slate-100'}`}>
                        <span className={`font-black italic text-lg opacity-80 ${idx < 3 ? 'text-brand-primary' : 'text-slate-400'}`}>#{idx + 1}</span>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-slate-800 group-hover:text-brand-primary transition-colors">{stock.name}</h3>
                            <div className="text-brand-primary font-bold text-sm bg-brand-primary/10 px-1.5 py-0.5 rounded">{stock.symbol}</div>
                        </div>
                        {stock.industry && (
                            <span className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm w-fit bg-slate-100 text-slate-500">
                            {stock.industry}
                            </span>
                        )}
                        </div>
                        <button
                        onClick={() => onToggleWatchlist(stock.symbol)}
                        className={`p-2 rounded-xl transition-colors ${watchedSymbols.has(stock.symbol) ? 'bg-yellow-50 text-yellow-500' : 'bg-slate-50 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50'
                            }`}
                        >
                        <Star className={`w-4 h-4 ${watchedSymbols.has(stock.symbol) ? 'fill-current' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-end justify-between">
                        <div className="space-y-1">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">法人淨{activeAction === 'buy' ? '買超' : '賣超'}</div>
                        <div className={`text-xl font-black tabular-nums ${activeAction === 'buy' ? 'text-red-500' : 'text-green-600'}`}>
                            {activeAction === 'buy' ? '+' : '-'}{Math.abs(stock.net_buy).toLocaleString()} <span className="text-[10px] font-bold ml-0.5 text-slate-500">張</span>
                        </div>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-brand-primary transition-colors">
                        查看詳情 <ChevronRight className="w-3 h-3" />
                        </div>
                    </div>
                    </div>
                ))
                ) : (
                <div className="col-span-full py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">查無相關排名數據</p>
                </div>
                )}
            </div>
        </div>
      ) : (
          loading && totalData.length === 0 ? (
              <div className="py-20 text-center animate-pulse">
                  <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">大盤數據加載中...</p>
              </div>
          ) : (
              <MarketTotalView />
          )
      )}
    </div>
  );
};

export default InstitutionalRankView;
