import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';

const TradingDashboard = () => {
    const defaultSymbols = ['2330', '2317', '2454']; // Taiwan Semi, Hon Hai, MediaTek
    const [watchSymbols, setWatchSymbols] = useState(defaultSymbols);
    const [tickData, setTickData] = useState({});
    const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbols[0]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Build query string
        const symbolsStr = watchSymbols.join(',');

        console.log(`[SSE] Connecting to stream for: ${symbolsStr}`);
        const eventSource = new EventSource(`${API_BASE}/stream/realtime?symbols=${symbolsStr}`);

        eventSource.onopen = () => {
            setIsConnected(true);
        };

        eventSource.onmessage = (e) => {
            try {
                const updates = JSON.parse(e.data);
                if (Array.isArray(updates)) {
                    setTickData(prev => {
                        const newData = { ...prev };
                        updates.forEach(row => {
                            newData[row.symbol] = row;
                        });
                        return newData;
                    });
                }
            } catch (err) {
                console.error("SSE parse error", err);
            }
        };

        eventSource.onerror = (e) => {
            console.error("SSE Connection Error", e);
            setIsConnected(false);
            eventSource.close();

            // Basic reconnection logic can be implemented here or EventSource handles it naturally
        };

        return () => {
            console.log("[SSE] Disconnecting stream.");
            eventSource.close();
            setIsConnected(false);
        };
    }, [watchSymbols]);

    const handleSymbolAdd = (e) => {
        e.preventDefault();
        const newSym = e.target.elements.newSym.value.trim();
        if (newSym && !watchSymbols.includes(newSym)) {
            setWatchSymbols(prev => [...prev, newSym]);
        }
        e.target.reset();
    };

    const currentTick = tickData[selectedSymbol] || null;

    const getColor = (price, prevClose) => {
        if (!price || !prevClose) return 'text-white';
        if (price > prevClose) return 'text-red-500';
        if (price < prevClose) return 'text-green-500';
        return 'text-yellow-400';
    };

    const formatPrice = (p) => p ? parseFloat(p).toFixed(2) : '-.--';

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-900 text-gray-100 font-mono">

            {/* Left Sidebar - Watchlist */}
            <div className="w-64 border-r border-gray-700 bg-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-700 font-bold flex justify-between items-center">
                    <span>即時自選股</span>
                    <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} shadow-[0_0_8px_currentColor]`}></span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {watchSymbols.map(sym => {
                        const tick = tickData[sym];
                        const priceStr = tick ? formatPrice(tick.price) : '---';
                        const colorClass = tick ? getColor(tick.price, tick.previous_close) : '';

                        return (
                            <div
                                key={sym}
                                onClick={() => setSelectedSymbol(sym)}
                                className={`p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 flex flex-col gap-1 ${selectedSymbol === sym ? 'bg-gray-700 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-lg">{sym}</span>
                                    <span className={`${colorClass} font-bold text-xl animate-pulse`}>{priceStr}</span>
                                </div>
                                {tick && (
                                    <div className="flex justify-between items-start text-xs text-gray-400 mt-1">
                                        <div className="flex flex-col gap-1">
                                            <span className="truncate max-w-[100px] text-gray-300">{tick.name || '---'}</span>
                                            <span className="bg-gray-900 px-1.5 py-0.5 rounded text-[10px] border border-gray-700 w-fit">
                                                {tick.industry || '一般'}
                                            </span>
                                        </div>
                                        {tick.price && tick.previous_close && (
                                            <div className={`text-right font-bold ${colorClass}`}>
                                                <div>
                                                    {tick.price > tick.previous_close ? '▲' : (tick.price < tick.previous_close ? '▼' : '')}
                                                    {Math.abs(tick.price - tick.previous_close).toFixed(2)}
                                                </div>
                                                <div>
                                                    {((tick.price - tick.previous_close) / tick.previous_close * 100).toFixed(2)}%
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="p-4 border-t border-gray-700">
                    <form onSubmit={handleSymbolAdd} className="flex gap-2">
                        <input name="newSym" placeholder="代號..." className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm outline-none focus:border-blue-500" />
                        <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-3 rounded">+</button>
                    </form>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-gray-900">
                {currentTick ? (
                    <>
                        {/* Top Header - Super Large Price */}
                        <div className="p-8 border-b border-gray-800 flex items-end justify-between">
                            <div>
                                <div className="flex items-center gap-4 mb-2">
                                    <h1 className="text-4xl font-bold text-gray-400">{selectedSymbol}</h1>
                                    <span className="text-3xl font-bold text-white">{currentTick.name}</span>
                                    <span className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full text-sm border border-blue-700/50">
                                        {currentTick.industry}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-6">
                                    <span className={`text-[6rem] font-black leading-none ${getColor(currentTick.price, currentTick.previous_close)} drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]`}>
                                        {formatPrice(currentTick.price)}
                                    </span>
                                    {currentTick.price && currentTick.previous_close && (
                                        <div className="flex flex-col">
                                            <span className={`text-3xl font-bold ${getColor(currentTick.price, currentTick.previous_close)}`}>
                                                {currentTick.price > currentTick.previous_close ? '▲' : (currentTick.price < currentTick.previous_close ? '▼' : '')}
                                                {Math.abs(currentTick.price - currentTick.previous_close).toFixed(2)}
                                            </span>
                                            <span className={`text-xl ${getColor(currentTick.price, currentTick.previous_close)}`}>
                                                {((currentTick.price - currentTick.previous_close) / currentTick.previous_close * 100).toFixed(2)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="text-right text-gray-400 space-y-2 text-lg">
                                <div><span className="text-gray-500">開盤</span> <span className="font-bold text-white">{formatPrice(currentTick.open_price)}</span></div>
                                <div><span className="text-gray-500">最高</span> <span className="font-bold text-red-400">{formatPrice(currentTick.high_price)}</span></div>
                                <div><span className="text-gray-500">最低</span> <span className="font-bold text-green-400">{formatPrice(currentTick.low_price)}</span></div>
                                <div><span className="text-gray-500">昨收</span> <span className="font-bold text-purple-400">{formatPrice(currentTick.previous_close)}</span></div>
                                <div><span className="text-gray-500">總量</span> <span className="font-bold text-yellow-500">{currentTick.volume}</span></div>
                                <div className="text-sm mt-4 text-gray-600">更新時間 {new Date(currentTick.trade_time).toLocaleTimeString()}</div>
                            </div>
                        </div>

                        {/* Mid Section - Buy/Sell Power & Order Book */}
                        <div className="flex-1 p-8 grid grid-cols-2 gap-8">

                            {/* Five level Order Book */}
                            <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex flex-col">
                                <div className="p-3 bg-gray-900 border-b border-gray-700 text-center font-bold text-gray-300">
                                    最佳五檔
                                </div>
                                <div className="flex-1 grid grid-cols-2">
                                    {/* Bids (Left) */}
                                    <div className="border-r border-gray-700 border-dashed">
                                        <div className="grid grid-cols-2 text-center text-sm text-gray-500 p-2 border-b border-gray-700 bg-gray-900/50">
                                            <span>買進量</span>
                                            <span>買價</span>
                                        </div>
                                        {currentTick.five_levels?.slice().reverse().map((level, i) => (
                                            <div key={`bid-${i}`} className="grid grid-cols-2 text-center py-3 hover:bg-gray-700/50">
                                                <span className="text-yellow-500">{level.bVol || '-'}</span>
                                                <span className="text-red-500 font-bold">{formatPrice(level.bid)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Asks (Right) */}
                                    <div>
                                        <div className="grid grid-cols-2 text-center text-sm text-gray-500 p-2 border-b border-gray-700 bg-gray-900/50">
                                            <span>賣價</span>
                                            <span>賣出量</span>
                                        </div>
                                        {currentTick.five_levels?.map((level, i) => (
                                            <div key={`ask-${i}`} className="grid grid-cols-2 text-center py-3 hover:bg-gray-700/50">
                                                <span className="text-green-500 font-bold">{formatPrice(level.ask)}</span>
                                                <span className="text-yellow-500">{level.aVol || '-'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Power Meter & Info */}
                            <div className="space-y-8">
                                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                                    <h3 className="text-gray-400 font-bold mb-4">內外盤力道表現</h3>
                                    <div className="flex justify-between mb-2 text-sm font-bold">
                                        <span className="text-green-500">內盤 (Sell) {currentTick.sell_intensity}%</span>
                                        <span className="text-red-500">外盤 (Buy) {currentTick.buy_intensity}%</span>
                                    </div>
                                    <div className="w-full h-8 bg-gray-900 rounded-full overflow-hidden flex shadow-inner">
                                        <div
                                            className="bg-green-600 h-full transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                            style={{ width: `${currentTick.sell_intensity}%` }}
                                        ></div>
                                        <div
                                            className="bg-red-600 h-full transition-all duration-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                            style={{ width: `${currentTick.buy_intensity}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-2xl font-bold animate-pulse">
                        等待即時資料刷新中... (Wait for SSE Push)
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradingDashboard;
