import React, { useState, useEffect } from 'react';
import { Activity, Database, Server, Clock, RefreshCw, AlertCircle, Calendar } from 'lucide-react';

export default function MonitorPage() {
    const [statusData, setStatusData] = useState(null);
    const [statsData, setStatsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastFetchTime, setLastFetchTime] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch status
            const statusRes = await fetch('/api/monitor/status');
            const statusJson = await statusRes.json();

            // Fetch stats
            const statsRes = await fetch('/api/monitor/ingestion-stats?days=14');
            const statsJson = await statsRes.json();

            if (statusJson.success) setStatusData(statusJson);
            else throw new Error(statusJson.error || 'Failed to fetch status');

            if (statsJson.success) setStatsData(statsJson.data);
            else throw new Error(statsJson.error || 'Failed to fetch stats');

            setLastFetchTime(new Date());
        } catch (err) {
            console.error('Error fetching monitor data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Optional: Auto-refresh every 5 minutes
        const interval = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Helper components
    const StatusBadge = ({ status }) => {
        const isUp = status === 'UP';
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {isUp ? '正常運作' : '服務異常'}
            </span>
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return '無資料';
        const d = new Date(dateString);
        return d.toLocaleString('zh-TW', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    // ─── Static definitions (no backend needed) ────────────────────────────────
    // Maps FinMind dataset name → script name + badge colour
    const DATASET_SCRIPT_MAP = {
        'TaiwanStockPrice': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanStockDayTrading': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanStockMarginPurchaseShortSale': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanStockInstitutionalInvestorsBuySell': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanStockTotalInstitutionalInvestors': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanStockTotalMarginPurchaseShortSale': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanFuturesDaily': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanOptionDaily': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanFutOptDailyInfo': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanSecuritiesTraderInfo': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanFuturesInstitutionalInvestors': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanOptionInstitutionalInvestors': { script: 'fetcher.js', color: 'bg-green-100 text-green-800' },
        'TaiwanStockNews': { script: 'news_fetcher.js', color: 'bg-orange-100 text-orange-800' },
        'TaiwanStockFinancialStatements': { script: 'finmind_fetcher.js', color: 'bg-indigo-100 text-indigo-800' },
        'TaiwanStockBalanceSheet': { script: 'finmind_fetcher.js', color: 'bg-indigo-100 text-indigo-800' },
        'TaiwanStockCashFlowsStatement': { script: 'finmind_fetcher.js', color: 'bg-indigo-100 text-indigo-800' },
        'TaiwanStockMonthRevenue': { script: 'finmind_fetcher.js', color: 'bg-indigo-100 text-indigo-800' },
        'TaiwanStockDividend': { script: 'finmind_fetcher.js', color: 'bg-indigo-100 text-indigo-800' },
        'TaiwanStockInfo': { script: 'finmind_fetcher.js', color: 'bg-indigo-100 text-indigo-800' },
        'TaiwanStockDelisting': { script: 'finmind_fetcher.js', color: 'bg-indigo-100 text-indigo-800' },
    };

    // Known background scripts — names/descriptions always shown; status from API
    const KNOWN_SCRIPTS = [
        { script: 'fetcher.js', desc: '每日盤後資料 (收盤價、當沖、法人、融資券)', schedule: '每交易日 15:30' },
        { script: 'news_fetcher.js', desc: '財經新聞同步', schedule: '每小時' },
        { script: 'finmind_fetcher.js', desc: '財報基本面資料 (損益表、資產負債表、月營收…)', schedule: '每週六 04:00' },
        { script: 'calc_health_scores.js', desc: '全股健診排行計算', schedule: '每交易日 16:00' },
    ];
    // ──────────────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fade-in-20">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-brand-primary" />
                        系統監控中心
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        監控資料庫、後端服務狀態，以及資料擷取排程的執行進度。
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-gray-500">頁面最後更新時間</div>
                        <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {lastFetchTime ? formatDate(lastFetchTime) : '載入中...'}
                        </div>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>立即更新</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-red-800">資料載入失敗</h3>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                </div>
            )}

            {statusData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Database Status */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col pt-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Database className="w-5 h-5" />
                            </div>
                            <StatusBadge status={statusData.status.database} />
                        </div>
                        <h3 className="text-gray-500 text-sm font-medium">資料庫狀態</h3>
                        <p className="text-xl font-bold text-gray-900 mt-1">PostgreSQL</p>
                    </div>

                    {/* Backend API Status */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col pt-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Server className="w-5 h-5" />
                            </div>
                            <StatusBadge status={statusData.status.backend} />
                        </div>
                        <h3 className="text-gray-500 text-sm font-medium">後端 API 服務</h3>
                        <p className="text-xl font-bold text-gray-900 mt-1">Node.js Express</p>
                    </div>

                    {/* Scheduler Status */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col pt-6 lg:col-span-2">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <Activity className="w-5 h-5" />
                            </div>
                            <StatusBadge status={statusData.status.scheduler} />
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-gray-500 text-sm font-medium">背景排程系統 (Scheduler)</h3>
                                <p className="text-base font-bold text-gray-900 mt-1 truncate">負責執行所有的自動化資料同步任務</p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-400">上次檢查</div>
                                <div className="text-sm font-medium text-gray-600">{formatDate(statusData.status.scheduler_last_check)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ingestion Stats Chart (Bar Chart visualization) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <Calendar className="w-5 h-5 text-brand-primary" />
                    <h2 className="text-lg font-bold text-gray-900">近 14 天資料擷取筆數 (寫入趨勢)</h2>
                </div>

                {statsData.length > 0 ? (
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Simple Bar Chart Implementation using divs */}
                            <div className="flex items-end gap-1 h-64 mt-4 relative border-b border-gray-200 pb-2">
                                {/* Find max value for scaling */}
                                {(() => {
                                    const maxVal = Math.max(1, ...statsData.map(d => d.price_count + d.inst_count + d.margin_count));

                                    return statsData.map((day, idx) => {
                                        const hPrice = (day.price_count / maxVal) * 100;
                                        const hInst = (day.inst_count / maxVal) * 100;
                                        const hMargin = (day.margin_count / maxVal) * 100;

                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded-lg p-2 whitespace-nowrap z-10 pointer-events-none">
                                                    <div className="font-bold border-b border-white/20 pb-1 mb-1">{day.date}</div>
                                                    <div className="flex justify-between gap-4"><span>收盤價:</span><span>{day.price_count.toLocaleString()}</span></div>
                                                    <div className="flex justify-between gap-4"><span>三大法人:</span><span>{day.inst_count.toLocaleString()}</span></div>
                                                    <div className="flex justify-between gap-4 text-gray-300"><span>融資券:</span><span>{day.margin_count.toLocaleString()}</span></div>
                                                </div>

                                                {/* Stacked Bars */}
                                                <div className="w-full max-w-[40px] flex flex-col justify-end h-full">
                                                    <div style={{ height: `${hMargin}%` }} className="bg-purple-300 w-full rounded-t-sm transition-all duration-500"></div>
                                                    <div style={{ height: `${hInst}%` }} className="bg-blue-400 w-full transition-all duration-500"></div>
                                                    <div style={{ height: `${hPrice}%` }} className="bg-brand-primary w-full rounded-b-sm transition-all duration-500"></div>
                                                </div>

                                                {/* Date Label */}
                                                <div className="text-[10px] text-gray-500 mt-2 rotate-45 origin-left w-full h-8">{day.date.substring(5)}</div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Legend */}
                            <div className="flex justify-center gap-6 mt-8 pt-4">
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-brand-primary"></span><span className="text-xs text-gray-600">收盤價/行情</span></div>
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400"></span><span className="text-xs text-gray-600">三大法人</span></div>
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-300"></span><span className="text-xs text-gray-600">融資融券</span></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        {loading ? '載入中...' : '無可用資料'}
                    </div>
                )}
            </div>

            {/* Synchronization Details Table */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    各項資料來源同步進度
                </h2>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                            <tr>
                                <th className="px-5 py-3 font-semibold">資料集 (Dataset)</th>
                                <th className="px-5 py-3 font-semibold">擷取程式</th>
                                <th className="px-5 py-3 font-semibold">排程說明</th>
                                <th className="px-5 py-3 font-semibold">資料庫最後更新時間</th>
                                <th className="px-5 py-3 font-semibold text-right">狀態</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {statusData?.sync_progress?.map((item, idx) => {
                                const isStale = new Date() - new Date(item.last_updated) > 3 * 24 * 60 * 60 * 1000;
                                const scriptInfo = DATASET_SCRIPT_MAP[item.dataset] || { script: '未知', color: 'bg-gray-100 text-gray-600' };

                                return (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3.5 font-medium text-gray-900">{item.dataset}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${scriptInfo.color}`}>
                                                {scriptInfo.script}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-blue-600 font-medium">{item.description}</td>
                                        <td className="px-5 py-3.5">{formatDate(item.last_updated)}</td>
                                        <td className="px-5 py-3.5 text-right">
                                            {isStale ? (
                                                <span className="inline-flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                                    <AlertCircle className="w-3.5 h-3.5" /> 較久未更新
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-green-600 bg-green-50 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                                    更新正常
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!statusData?.sync_progress?.length && !loading && (
                                <tr>
                                    <td colSpan="5" className="px-5 py-8 text-center text-gray-500">尚無同步紀錄</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* JS Script Monitoring Table */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-500" />
                    各項背景擷取程式 (Script) 執行狀態
                </h2>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                            <tr>
                                <th className="px-5 py-3 font-semibold">程式名稱 (.js)</th>
                                <th className="px-5 py-3 font-semibold">用途說明</th>
                                <th className="px-5 py-3 font-semibold">狀態與執行訊息</th>
                                <th className="px-5 py-3 font-semibold text-right">最後執行時間</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {KNOWN_SCRIPTS.map((def, idx) => {
                                // Look up dynamic status from API
                                const apiItem = statusData?.script_status?.find(s => s.script === def.script);
                                const status = apiItem?.status || 'UNKNOWN';
                                const message = apiItem?.message || '尚無執行紀錄';
                                const lastRun = apiItem?.last_run || null;

                                let statusColor = 'bg-gray-100 text-gray-800';
                                if (status === 'SUCCESS') statusColor = 'bg-green-100 text-green-800';
                                if (status === 'RUNNING') statusColor = 'bg-blue-100 text-blue-800';
                                if (status === 'FAILED') statusColor = 'bg-red-100 text-red-800';

                                return (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3.5 font-bold text-gray-900">{def.script}</td>
                                        <td className="px-5 py-3.5 text-indigo-600 font-medium">{def.desc}</td>
                                        <td className="px-5 py-3.5 text-gray-500 text-xs">{def.schedule}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${statusColor}`}>
                                                    {status}
                                                </span>
                                                <span className="text-xs text-gray-500 line-clamp-1 max-w-xs" title={message}>{message}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono text-xs">{formatDate(lastRun)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
