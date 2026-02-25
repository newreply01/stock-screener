import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, ChevronRight, Star, Heart, Activity } from 'lucide-react';
import { getInstitutionalRank } from '../utils/api';

const InstitutionalRankView = ({ watchedSymbols, onToggleWatchlist }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('foreign'); // foreign, investment, dealer
  const [timeRange, setTimeRange] = useState('3d'); // 3d, 5d, 10d

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getInstitutionalRank({ type: activeType, range: timeRange });
        if (res.success) setData(res.data);
      } catch (e) {
        console.error('Fetch institutional rank error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeType, timeRange]);

  const tabs = [
    { label: '外資買超', id: 'foreign', icon: <TrendingUp className="w-4 h-4" /> },
    { label: '投信買超', id: 'investment', icon: <Users className="w-4 h-4" /> },
    { label: '自營商買超', id: 'dealer', icon: <Activity className="w-4 h-4" /> },
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
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-brand-primary w-6 h-6" />
            三大法人買超排行榜
          </h2>
          <p className="text-gray-400 text-sm mt-1">追蹤市場主力資金流向，鎖定法人同步作多強勢股</p>
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
          {ranges.map(r => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                timeRange === r.id 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all whitespace-nowrap ${
              activeType === tab.id
                ? 'bg-white text-brand-dark border-white font-bold'
                : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:text-white'
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
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 animate-pulse h-32"></div>
          ))
        ) : data.length > 0 ? (
          data.map((stock, idx) => (
            <div 
              key={stock.symbol}
              className="group bg-brand-light border border-white/5 hover:border-brand-primary/30 rounded-xl p-5 transition-all hover:bg-brand-light/80 relative overflow-hidden"
            >
              {idx < 3 && (
                <div className="absolute -top-1 -right-1 w-12 h-12 flex items-center justify-center bg-brand-primary/10 rounded-bl-3xl">
                  <span className="text-brand-primary font-black italic text-lg opacity-40">#{idx + 1}</span>
                </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-brand-primary transition-colors">{stock.name}</h3>
                  <div className="text-brand-primary font-mono text-sm">{stock.symbol}</div>
                </div>
                <button 
                  onClick={() => onToggleWatchlist(stock.symbol)}
                  className={`p-2 rounded-lg transition-colors ${
                    watchedSymbols.has(stock.symbol) ? 'bg-brand-primary/20 text-brand-primary' : 'bg-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  <Star className={`w-4 h-4 ${watchedSymbols.has(stock.symbol) ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">法人淨買超</div>
                  <div className="text-xl font-black text-brand-success">
                    +{stock.net_buy.toLocaleString()} <span className="text-[10px] font-medium ml-0.5">張</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-white">
                  查看詳情 <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4 opacity-50" />
            <p className="text-gray-500 font-medium">查無相關排名數據</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstitutionalRankView;
