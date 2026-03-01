import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, ChevronRight, Star, Heart, Activity } from 'lucide-react';
import { getInstitutionalRank } from '../utils/api';

const InstitutionalRankView = ({ watchedSymbols, onToggleWatchlist }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('foreign'); // foreign, investment, dealer
  const [activeAction, setActiveAction] = useState('buy'); // buy, sell
  const [timeRange, setTimeRange] = useState('3d'); // 3d, 5d, 10d

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getInstitutionalRank({
          type: activeType,
          range: timeRange,
          action: activeAction
        });
        if (res.success) setData(res.data);
      } catch (e) {
        console.error('Fetch institutional rank error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeType, timeRange, activeAction]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-brand-primary w-6 h-6" />
            三大法人{activeAction === 'buy' ? '買超' : '賣超'}排行榜
          </h2>
          <p className="text-slate-500 text-sm mt-1">追蹤市場主力資金流向，鎖定法人同步{activeAction === 'buy' ? '作多強勢股' : '撤資弱勢股'}</p>
        </div>

        <div className="flex gap-4 items-center">
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
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
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
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 animate-pulse h-32 shadow-sm"></div>
          ))
        ) : data.length > 0 ? (
          data.map((stock, idx) => (
            <div
              key={stock.symbol}
              className="group bg-white border border-slate-100 hover:border-brand-primary/30 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
            >
              {idx < 3 && (
                <div className="absolute -top-1 -right-1 w-12 h-12 flex items-center justify-center bg-brand-primary/10 rounded-bl-3xl">
                  <span className="text-brand-primary font-black italic text-lg opacity-80">#{idx + 1}</span>
                </div>
              )}

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
  );
};

export default InstitutionalRankView;
