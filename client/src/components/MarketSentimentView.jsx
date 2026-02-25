import React, { useState, useEffect } from 'react';
import { Shield, Target, Zap, Waves, Activity, AlertCircle } from 'lucide-react';
import { getMarketStats } from '../utils/api';

const MarketSentimentView = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await getMarketStats();
        if (res.success) setStats(res.data);
      } catch (e) {
        console.error('Fetch market stats error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const sentimentCards = [
    { 
      title: '短線情緒', 
      value: stats?.shortTerm || '中立', 
      score: stats?.shortScore || 50,
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      color: 'text-yellow-400',
      description: '基於強弱勢股比例與漲跌家數計算'
    },
    { 
      title: '波段趨勢', 
      value: stats?.trend || '多方掌控', 
      score: stats?.trendScore || 75,
      icon: <Waves className="w-5 h-5 text-brand-primary" />,
      color: 'text-brand-primary',
      description: '大盤均線排列與均量指標分析'
    },
    { 
      title: '法人動態', 
      value: stats?.inst || '偏多', 
      score: stats?.instScore || 60,
      icon: <Target className="w-5 h-5 text-brand-success" />,
      color: 'text-brand-success',
      description: '外資與投信近三日資產配置趨勢'
    },
    { 
      title: '風險溢酬', 
      value: stats?.risk || '低風險', 
      score: stats?.riskScore || 20,
      icon: <Shield className="w-5 h-5 text-indigo-400" />,
      color: 'text-indigo-400',
      description: '隱含波動率與市場乖離度檢測'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-3xl font-black text-white tracking-tight">市場情緒儀表板</h2>
        <p className="text-gray-400">大盤多空數據即時監控，融合量價與籌碼指標的多維度分析系統</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sentimentCards.map((card, idx) => (
          <div key={idx} className="bg-brand-light border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-xl shadow-black/20 hover:border-white/10 transition-all hover:-translate-y-1">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">{card.icon}</div>
              <div className={`text-2xl font-black ${card.color}`}>{card.value}</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
                <span>強度指標</span>
                <span className={card.color}>{card.score}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full opacity-80 ${card.score > 70 ? 'bg-brand-success' : card.score > 40 ? 'bg-brand-primary' : 'bg-red-500'} transition-all duration-1000 ease-out`}
                  style={{ width: `${card.score}%` }}
                ></div>
              </div>
              <div className="pt-2">
                <h4 className="text-sm font-bold text-gray-300">{card.title}</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed mt-1">{card.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-brand-primary/10 to-transparent border border-brand-primary/20 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
          <Activity className="w-32 h-32 text-brand-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/20 text-brand-primary text-xs font-bold rounded-full border border-brand-primary/30 uppercase tracking-widest">
              <AlertCircle className="w-3 h-3" />
              策略建議
            </div>
            <h3 className="text-2xl font-bold text-white">當前盤勢建議：維持偏多佈局，鎖定法人共識股</h3>
            <p className="text-gray-400 leading-relaxed">
              市場情緒目前處於中性偏樂觀，短線雖有乖離過大風險，但波段趨勢由多方穩健掌控。建議投資者在回檔支撐時尋求介入，重點關注「三大法人排行」中持續同步買超的個股。
            </p>
          </div>
          <div className="shrink-0">
            <button className="bg-brand-primary hover:bg-red-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-brand-primary/30 transition-all active:scale-95">
              前往篩選器
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketSentimentView;
