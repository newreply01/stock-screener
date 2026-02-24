import React from 'react';
import { Activity, ArrowUp, ArrowDown, BarChart2, Clock } from 'lucide-react';

export default function RealtimeView({ stock }) {
    // Mock data for a better "Under Development" experience that looks premium
    const bidAskData = [
        { bid: 582, bVol: 12, ask: 583, aVol: 45 },
        { bid: 581, bVol: 34, ask: 584, aVol: 23 },
        { bid: 580, bVol: 89, ask: 585, aVol: 12 },
        { bid: 579, bVol: 156, ask: 586, aVol: 67 },
        { bid: 578, bVol: 45, ask: 587, aVol: 89 },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Five Levels (Bid/Ask) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-brand-primary" />
                            最佳五檔報價
                        </h3>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">LIVE MOCK</span>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-50">
                            <div>買量</div>
                            <div>買價</div>
                            <div className="text-right">賣價</div>
                            <div className="text-right">賣量</div>
                        </div>

                        {bidAskData.map((row, i) => (
                            <div key={i} className="grid grid-cols-4 py-2 hover:bg-slate-50 transition-colors rounded-lg px-1">
                                <div className="text-sm font-bold text-slate-500">{row.bVol}</div>
                                <div className="text-sm font-black text-red-500">{row.bid.toFixed(1)}</div>
                                <div className="text-sm font-black text-green-600 text-right">{row.ask.toFixed(1)}</div>
                                <div className="text-sm font-bold text-slate-500 text-right">{row.aVol}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Real-time Stats */}
                <div className="space-y-4">
                    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Summary</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-3xl font-black">{parseFloat(stock.close_price).toFixed(2)}</p>
                                <p className="text-xs font-bold text-slate-400 mt-1">成交價 (Last Sale)</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-xl font-black ${parseFloat(stock.change_percent) >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {parseFloat(stock.change_percent) >= 0 ? '+' : ''}{parseFloat(stock.change_percent).toFixed(2)}%
                                </p>
                                <p className="text-[10px] font-bold text-slate-500">本日漲跌幅</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-blue-500" />
                            本日量能分配
                        </h4>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-black text-slate-500">
                                    <span>內盤 (Sell Intensity)</span>
                                    <span>42%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-green-500 h-full w-[42%]"></div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-black text-slate-500">
                                    <span>外盤 (Buy Intensity)</span>
                                    <span>58%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-red-500 h-full w-[58%]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                <Activity className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-black text-amber-900">實時數據串接通知</p>
                    <p className="text-xs text-amber-700 font-medium leading-relaxed mt-1">
                        當前版本報價資訊為 5 秒延遲模擬 API。我們正在申請券商 Level 2 即時報價串接許可，正式版將提供毫秒級逐筆成交細節。
                    </p>
                </div>
            </div>
        </div>
    );
}
