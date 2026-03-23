import React, { useState, useEffect } from 'react';
import { 
    Activity, 
    ArrowUp, 
    ArrowDown, 
    Search,
    Filter,
    Clock,
    LayoutDashboard,
    List,
    AlertCircle,
    CheckCircle2,
    MinusCircle,
    ChevronUp,
    ChevronDown,
    Zap
} from 'lucide-react';
import { getMarketIndex, getRealtimeBatch, getRealtimeData, getRealtimeTicks, addStockToWatchlist } from '../utils/api';
import MarketIndexCard from './MarketIndexCard';
import StockChart from './StockChart';
import StockSearchAutocomplete from './StockSearchAutocomplete';

const getPriceColor = (price, prev) => {
    if (!price || !prev) return 'text-gray-400';
    const p = parseFloat(price);
    const v = parseFloat(prev);
    if (isNaN(p) || isNaN(v)) return 'text-gray-400';
    if (p > v) return 'text-red-500';
    if (p < v) return 'text-green-500';
    return 'text-gray-400';
};

const TradingPanel = ({ symbol, tickInfo, isConnected }) => {
    const [fiveLevels, setFiveLevels] = useState([]);
    const [recentTicks, setRecentTicks] = useState([]);
    const [stats, setStats] = useState({});

    useEffect(() => {
        if (!symbol) return;
        
        const fetchTradingData = async () => {
            try {
                // Fetch real-time data for 5 levels
                const rtRes = await getRealtimeData(symbol);
                if (rtRes?.success && rtRes.data) {
                    setFiveLevels(Array.isArray(rtRes.data.five_levels) ? rtRes.data.five_levels : []);
                    setStats(rtRes.data || {});
                }

                // Fetch recent ticks
                const ticksRes = await getRealtimeTicks(symbol);
                if (ticksRes?.success && Array.isArray(ticksRes.data)) {
                    // Sort descending by trade_time to ensure newest is first, then take top 20
                    const sortedTicks = [...ticksRes.data].sort((a, b) => new Date(b.trade_time) - new Date(a.trade_time));
                    setRecentTicks(sortedTicks.slice(0, 20));
                }
            } catch (err) {
                console.warn('TradingPanel: Failed to fetch data:', err);
            }
        };

        fetchTradingData();
        const interval = setInterval(fetchTradingData, 3000); // Poll every 3 seconds for focus stock
        return () => clearInterval(interval);
    }, [symbol]);

    return (
        <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
             {/* Header Toolbar - Compact Stats included */}
             <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/40 shadow-lg">
                <div className="flex items-center gap-6">
                    <div className="flex items-baseline gap-3">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-lg font-black font-mono shadow-lg shadow-blue-900/30">{symbol}</span>
                        <h2 className="text-2xl font-black text-white tracking-tighter">{stats?.name || ''}</h2>
                    </div>
                    <div className="h-8 w-px bg-gray-800"></div>
                    <div className="flex items-baseline gap-4">
                        <div className={`text-3xl font-black tabular-nums tracking-tighter ${getPriceColor(stats?.price, stats?.previous_close)}`}>
                            {stats?.price || '--'}
                        </div>
                        <div className={`flex items-center gap-1.5 font-bold ${getPriceColor(stats?.price, stats?.previous_close)}`}>
                            <span className="text-sm">{stats?.change > 0 ? '▲' : (stats?.change < 0 ? '▼' : '')}</span>
                            <span className="text-xl">{Math.abs(stats?.change || 0).toFixed(2)}</span>
                            <span className="text-sm">({(stats?.change_percent || 0).toFixed(2)}%)</span>
                        </div>
                    </div>
                    
                    {/* Relocated Stats */}
                    <div className="h-8 w-px bg-gray-800"></div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 font-black uppercase">開</span>
                            <span className="text-xs font-bold font-mono">{stats?.open || '--'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-black uppercase">昨收</span>
                            <span className="text-xs font-bold font-mono text-gray-400">{stats?.previous_close || '--'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-red-900 font-black uppercase">高</span>
                            <span className="text-xs font-bold font-mono text-red-500">{stats?.high || '--'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-green-900 font-black uppercase">低</span>
                            <span className="text-xs font-bold font-mono text-green-500">{stats?.low || '--'}</span>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-gray-800"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">成交總量</span>
                        <span className="text-lg font-black text-blue-400 font-mono italic">{parseFloat(stats?.volume || 0).toLocaleString()} <span className="text-xs not-italic text-gray-500 font-sans ml-1">張</span></span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl">
                         <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isConnected ? 'LIVE FEEDING' : 'DISCONNECTED'}</span>
                    </div>
                </div>
            </div>

            {/* Main Trading Area Content */}
            <div className="flex-1 flex overflow-hidden border-t border-gray-800/50">
                {/* Left: Five Levels */}
                <div className="w-1/2 border-r border-gray-800 bg-gray-900/20 flex flex-col">
                    <div className="p-4 border-b border-gray-800 bg-gray-800/30 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-yellow-400 font-black tracking-widest text-[11px] uppercase italic">
                            <Zap className="w-4 h-4 fill-yellow-400" />
                            市場買賣五檔 (Bid/Ask)
                        </div>
                    </div>
                    <div className="flex-1 p-4 bg-gray-950/20">
                        <div className="grid grid-cols-4 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4 px-2 border-b border-gray-800 pb-2">
                            <span>買量</span>
                            <span>買價</span>
                            <span className="text-right">賣價</span>
                            <span className="text-right">賣量</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            {(fiveLevels && fiveLevels.length > 0 ? fiveLevels : Array(5).fill({})).map((level, i) => (
                                <div key={i} className="grid grid-cols-4 text-sm font-mono py-2 hover:bg-white/5 rounded-xl px-2 group transition-all duration-200 border border-transparent hover:border-white/5">
                                    <span className="text-gray-400 font-black">{level?.bVol || '--'}</span>
                                    <span className={`font-black text-base italic ${getPriceColor(level?.bid, stats?.previous_close)}`}>{level?.bid?.toFixed(2) || '--'}</span>
                                    <span className={`text-right font-black text-base italic ${getPriceColor(level?.ask, stats?.previous_close)}`}>{level?.ask?.toFixed(2) || '--'}</span>
                                    <span className="text-right text-gray-400 font-black">{level?.aVol || '--'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Ticks List */}
                <div className="w-1/2 flex flex-col bg-gray-950/40">
                    <div className="p-4 border-b border-gray-800 bg-gray-800/30 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-blue-400 font-black tracking-widest text-[11px] uppercase italic">
                            <Activity className="w-4 h-4" />
                            近期分時成交明細 (最新 20 筆)
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar-thin">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-gray-900 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-3">時間</th>
                                    <th className="px-6 py-3 text-right">成交價</th>
                                    <th className="px-6 py-3 text-right">成交單量</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {recentTicks.length > 0 ? (
                                    recentTicks.map((tick, i) => (
                                        <tr key={tick.id || i} className="hover:bg-blue-600/5 transition-colors group">
                                            <td className="px-6 py-3 text-xs font-mono text-gray-500 group-hover:text-gray-300">
                                                {new Date(tick.trade_time).toLocaleTimeString('zh-TW', { hour12: false })}
                                            </td>
                                            <td className={`px-6 py-3 text-sm font-black italic tabular-nums text-right ${getPriceColor(tick.price, stats?.previous_close)}`}>
                                                {parseFloat(tick.price).toFixed(2)}
                                            </td>
                                            <td className={`px-6 py-3 text-xs font-black font-mono text-right tabular-nums ${tick.volume > 50 ? 'text-amber-400' : 'text-blue-500'}`}>
                                                {tick.volume}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                         <td colSpan="3" className="p-20 text-center text-gray-700 italic font-black uppercase tracking-widest text-[11px]">等待連線中... No live data</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TradingDashboard = ({ watchlists = [], watchedSymbols = new Set() }) => {
    // State management
    const [marketIndex, setMarketIndex] = useState(null);
    const [indexLoading, setIndexLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [tickData, setTickData] = useState({});
    const [selectedSymbol, setSelectedSymbol] = useState('2330');
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    const [watchSymbols, setWatchSymbols] = useState([]);

    // Extract symbols from watchlists
    useEffect(() => {
        const symbols = [];
        watchlists.forEach(wl => {
            wl.items?.forEach(item => {
                if (!symbols.includes(item.symbol)) {
                    symbols.push(item.symbol);
                }
            });
        });
        if (symbols.length > 0) {
            setWatchSymbols(symbols);
            if (!symbols.includes(selectedSymbol)) {
                setSelectedSymbol(symbols[0]);
            }
        } else {
            // Fallback to defaults if no watchlist
            setWatchSymbols(['2330', '2317', '2454', '2303', '2308', '2881', '2882']);
        }
    }, [watchlists]);

    // Fetch market index data
    const fetchIndex = async () => {
        try {
            const res = await getMarketIndex();
            if (res.success) {
                setMarketIndex(res.data);
            }
        } catch (err) {
            console.warn('Dashboard: Failed to fetch market index:', err.message);
        } finally {
            setIndexLoading(false);
        }
    };

    // Polling setup for Market Index
    useEffect(() => {
        fetchIndex();
        const indexInterval = setInterval(fetchIndex, 10000);
        return () => clearInterval(indexInterval);
    }, []);

    // Real-time batch data polling
    const fetchRealtimeData = async () => {
        if (watchSymbols.length === 0) return;
        try {
            const res = await getRealtimeBatch(watchSymbols);
            if (res.success) {
                setTickData(res.data || {});
                setIsConnected(true);
                setLastUpdateTime(new Date());
            }
        } catch (err) {
            console.error('Dashboard: Realtime polling failed:', err);
            setIsConnected(false);
        }
    };

    useEffect(() => {
        fetchRealtimeData();
        const tickInterval = setInterval(fetchRealtimeData, 5000); // Poll every 5 seconds
        return () => clearInterval(tickInterval);
    }, [watchSymbols]);

    const getChangeColor = (change) => {
        const num = parseFloat(change);
        if (num > 0) return 'text-red-500';
        if (num < 0) return 'text-green-500';
        return 'text-gray-400';
    };

    const getBgColor = (change) => {
        const num = parseFloat(change);
        if (num > 0) return 'bg-red-500/10';
        if (num < 0) return 'bg-green-500/10';
        return 'bg-gray-800/30';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-gray-100 font-sans">
            {/* Top Bar - Market Index */}
            <div className="px-4 py-2 border-b border-gray-800 bg-gray-900">
                <MarketIndexCard data={marketIndex} loading={indexLoading} dark={true} layout="horizontal" />
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Watchlist */}
                <div className="w-80 border-r border-gray-700 bg-gray-800 flex flex-col shadow-2xl z-10">
                    <div className="p-4 border-b border-gray-700 font-bold flex justify-between items-center bg-gray-900/50">
                        <span className="text-gray-300 text-sm font-black italic tracking-tighter">個股即時資訊</span>
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} shadow-[0_0_8px_currentColor]`}></span>
                            <span className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                        </div>
                    </div>

                    {/* Add Stock Search */}
                    <div className="p-3 border-b border-gray-700 bg-gray-900/20">
                        <StockSearchAutocomplete 
                            onSelectStock={async (stock) => {
                                try {
                                    // Use first watchlist as default
                                    if (watchlists.length > 0) {
                                        await addStockToWatchlist(watchlists[0].id, stock.symbol);
                                        // The App component usually manages watchlists state, 
                                        // but since we get watchlists as props here, 
                                        // we might need a way to refresh them.
                                        // For now, we manually add to watchSymbols if not present.
                                        if (!watchSymbols.includes(stock.symbol)) {
                                            setWatchSymbols(prev => [...prev, stock.symbol]);
                                        }
                                        setSelectedSymbol(stock.symbol);
                                    } else {
                                        alert('請先建立自選清單');
                                    }
                                } catch (e) {
                                    console.error('Add stock failed:', e);
                                }
                            }}
                            placeholder="輸入代碼新增至自選..."
                        />
                    </div>

                    <div className="p-3 bg-gray-900/30 border-b border-gray-700 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex justify-between items-center">
                        <span>即時自選股</span>
                        <span>{watchSymbols.length} 標的</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar-thin">
                        {watchSymbols.length === 0 ? (
                            <div className="p-10 text-center text-gray-600">
                                <List className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="text-xs font-bold">目前無自選標的</p>
                            </div>
                        ) : (
                            watchSymbols.map(sym => {
                                const tick = tickData[sym];
                                const isSelected = selectedSymbol === sym;
                                const change = tick?.change_percent || 0;
                                const price = tick?.price || tick?.previous_close || '--';
                                const name = tick?.name || '';
                                
                                return (
                                    <div 
                                        key={sym}
                                        onClick={() => setSelectedSymbol(sym)}
                                        className={`px-4 py-3 border-b border-gray-700/50 cursor-pointer transition-all hover:bg-gray-700 flex justify-between items-center ${isSelected ? 'bg-blue-900/40 border-l-4 border-l-blue-500 shadow-inner' : ''}`}
                                    >
                                        <div className="flex flex-col">
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-black text-gray-100 text-sm tracking-tighter">{sym}</span>
                                                <span className="text-[10px] font-bold text-gray-500 truncate max-w-[80px]">{name}</span>
                                            </div>
                                            <div className="text-[9px] text-gray-600 font-mono mt-0.5">{tick?.time_str || '--:--:--'}</div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className={`text-sm font-black tabular-nums ${getPriceColor(price, tick?.previous_close || 0)}`}>
                                                    {price}
                                                </div>
                                                <div className={`text-[10px] font-bold tabular-nums flex items-center justify-end gap-1 ${getChangeColor(change)}`}>
                                                    <span>{parseFloat(tick?.change || 0) > 0 ? '+' : ''}{tick?.change || '0.00'}</span>
                                                    <span>({parseFloat(change) > 0 ? '▲' : (parseFloat(change) < 0 ? '▼' : '')}{Math.abs(parseFloat(change)).toFixed(2)}%)</span>
                                                </div>
                                            </div>
                                            
                                            <div className={`w-1 h-8 rounded-full ${getBgColor(change)}`}>
                                                <div 
                                                    className={`w-full rounded-full transition-all duration-700 ${parseFloat(change) >= 0 ? 'bg-red-500' : 'bg-green-500'}`} 
                                                    style={{ height: `${Math.min(Math.abs(parseFloat(change)) * 10, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-3 bg-gray-900 border-t border-gray-700">
                        <div className="flex items-center justify-between text-[9px] text-gray-600 font-mono uppercase tracking-widest">
                            <span>POLL: 5S</span>
                            <span>{lastUpdateTime?.toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>

                {/* Main Content Area (Previously Chart + Right Panel) */}
                <TradingPanel 
                    symbol={selectedSymbol} 
                    tickInfo={tickData[selectedSymbol]} 
                    isConnected={isConnected} 
                />
            </div>
        </div>
    );
};

export default TradingDashboard;
