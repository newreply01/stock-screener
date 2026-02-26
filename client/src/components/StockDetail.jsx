import React, { useState, useEffect } from 'react'
import {
    X,
    TrendingUp,
    BarChart3,
    PieChart,
    Calendar,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Users
} from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend
} from 'recharts'
import { getStockFinancials, getInstitutionalData } from '../utils/api'
import RevenueView from './RevenueView'
import ValuationView from './ValuationView'
import MACDView from './MACDView'
import KDView from './KDView'
import AIReportView from './AIReportView'
import ChipAnalysisChart from './ChipAnalysisChart'
import NewsBoard from './NewsBoard'
import RSIView from './RSIView'
import DMIView from './DMIView'
import StockChart from './StockChart'
import RealtimeView from './RealtimeView'
import TrendView from './TrendView'
import TradingSignalsView from './TradingSignalsView'
import WaveView from './WaveView'
import AlertsView from './AlertsView'
import MainForceView from './MainForceView'
import FinancialStatementsView from './FinancialStatementsView'

const SIDEBAR_MENU = [
    { id: 'overview', label: '總覽' },
    { id: 'realtime', label: '即時行情' },
    { id: 'trend', label: '趨勢強弱' },
    { id: 'price_vol', label: '股價量圖' },
    { type: 'header', label: '技術分析' },
    { id: 'kd', label: 'KD線圖' },
    { id: 'macd', label: 'MACD圖表' },
    { id: 'rsi', label: 'RSI分析' },
    { id: 'dmi', label: 'DMI/ADX' },
    { type: 'header', label: '深潛分析' },
    {
        id: 'main_force',
        label: '主力進出',
        children: [
            { id: 'institutional', label: '三大法人' },
            { id: 'force_detail', label: '主力明細' },
            { id: 'margin_trade', label: '融資融券' },
            { id: 'broker_trace', label: '分點進跡' }
        ]
    },
    {
        id: 'financials',
        label: '財報股利',
        children: [
            {
                id: 'profitability',
                label: '獲利能力',
                children: [
                    { id: 'margin_trend', label: '毛利趨勢' },
                    { id: 'eps_trend', label: 'EPS走勢' },
                    { id: 'roe_roa', label: 'ROE/ROA' }
                ]
            },
            { id: 'revenue_growth', label: '營收成長' },
            {
                id: 'reports',
                label: '財務報表',
                children: [
                    { id: 'balance_sheet', label: '資產負債' },
                    { id: 'income_statement', label: '損益表' },
                    { id: 'cash_flow', label: '現金流量' }
                ]
            },
            { id: 'dividend', label: '股利政策' }
        ]
    },
    { id: 'news', label: '新聞公告' },
    { id: 'ai_report', label: 'AI分析報告' }
];

export default function StockDetail({ stock, onClose }) {
    const [financials, setFinancials] = useState(null)
    const [institutionalData, setInstitutionalData] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadingChips, setLoadingChips] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')
    const [activeSubTab, setActiveSubTab] = useState(null)
    const [activeSubSubTab, setActiveSubSubTab] = useState(null)

    useEffect(() => {
        const fetchFinancials = async () => {
            try {
                setLoading(true)
                const data = await getStockFinancials(stock.symbol)
                setFinancials(data)
            } catch (err) {
                console.error('Error fetching financials:', err)
            } finally {
                setLoading(false)
            }
        }

        const fetchChips = async () => {
            setLoadingChips(true);
            try {
                const data = await getInstitutionalData(stock.symbol);
                setInstitutionalData(data);
            } catch (err) {
                console.error('Error fetching chips:', err);
            } finally {
                setLoadingChips(false);
            }
        };

        if (stock?.symbol) {
            fetchFinancials()
            fetchChips()
        }
    }, [stock])

    if (!stock) return null

    // 格式化營收數據供圖表使用
    const revenueData = financials?.revenue?.map(item => ({
        name: `${item.revenue_year}/${item.revenue_month}`,
        revenue: Math.round(parseFloat(item.revenue) / 100) / 100 // 單位：億
    })).reverse() || []

    // 格式化 EPS 數據
    const epsData = financials?.eps?.map(item => {
        const dateStr = item.date ? new Date(item.date).toLocaleDateString('zh-TW', { year: '2-digit', month: '2-digit' }) : 'N/A';
        return {
            name: dateStr,
            eps: parseFloat(item.eps)
        };
    }).reverse() || []

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                            <TrendingUp className="text-brand-primary w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                {stock.name}
                                <span className="text-slate-400 text-lg font-normal">{stock.symbol}</span>
                            </h2>
                            <div className="flex items-center gap-2 mt-1.5">
                                {stock.industry && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-widest bg-indigo-50 text-indigo-500 border border-indigo-100/50">
                                        {stock.industry}
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-widest
                                    ${stock.market === 'twse' ? 'bg-blue-50 text-blue-500 border border-blue-100/50' : 'bg-orange-50 text-orange-500 border border-orange-100/50'}`}>
                                    {stock.market === 'twse' ? 'TWSE 上市' : 'TPEX 上櫃'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Horizontal Tabs - Level 0 */}
                    <div className="flex flex-row flex-nowrap overflow-x-auto border-b border-slate-100 bg-slate-50/50 flex-shrink-0 px-4 py-2 custom-scrollbar">
                        {SIDEBAR_MENU.map((item, idx) => {
                            if (item.type === 'header') {
                                return (
                                    <div key={idx} className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap opacity-70 shrink-0">
                                        | {item.label} |
                                    </div>
                                )
                            }
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTab(item.id);
                                        // Reset subtabs when switching main tab
                                        if (item.children) {
                                            setActiveSubTab(item.children[0].id);
                                            if (item.children[0].children) {
                                                setActiveSubSubTab(item.children[0].children[0].id);
                                            } else {
                                                setActiveSubSubTab(null);
                                            }
                                        } else {
                                            setActiveSubTab(null);
                                            setActiveSubSubTab(null);
                                        }
                                    }}
                                    className={`shrink-0 whitespace-nowrap flex items-center justify-center px-4 py-2 text-sm transition-all rounded-full mx-1 ${isActive
                                        ? 'bg-brand-primary text-white font-black shadow-md'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold'
                                        }`}
                                >
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Level 1 Tabs (SubTabs) */}
                    {SIDEBAR_MENU.find(m => m.id === activeTab)?.children && (
                        <div className="flex flex-row flex-nowrap overflow-x-auto border-b border-slate-100 bg-white flex-shrink-0 px-6 py-2.5 gap-2 custom-scrollbar">
                            {SIDEBAR_MENU.find(m => m.id === activeTab).children.map(subItem => {
                                const isSubActive = activeSubTab === subItem.id;
                                return (
                                    <button
                                        key={subItem.id}
                                        onClick={() => {
                                            setActiveSubTab(subItem.id);
                                            if (subItem.children) {
                                                setActiveSubSubTab(subItem.children[0].id);
                                            } else {
                                                setActiveSubSubTab(null);
                                            }
                                        }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isSubActive
                                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 ring-2 ring-indigo-500/10'
                                            : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                                            }`}
                                    >
                                        {subItem.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Level 2 Tabs (SubSubTabs) */}
                    {(() => {
                        const activeMain = SIDEBAR_MENU.find(m => m.id === activeTab);
                        const activeSub = activeMain?.children?.find(s => s.id === activeSubTab);
                        if (activeSub?.children) {
                            return (
                                <div className="flex flex-row flex-nowrap overflow-x-auto border-b border-slate-100 bg-slate-50/20 flex-shrink-0 px-8 py-2 gap-4 custom-scrollbar">
                                    {activeSub.children.map(subSubItem => {
                                        const isSubSubActive = activeSubSubTab === subSubItem.id;
                                        return (
                                            <button
                                                key={subSubItem.id}
                                                onClick={() => setActiveSubSubTab(subSubItem.id)}
                                                className={`text-[11px] font-bold tracking-tight transition-colors ${isSubSubActive
                                                    ? 'text-brand-primary underline underline-offset-4 decoration-2'
                                                    : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                {subSubItem.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Main Scrollable Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-white relative">
                        {activeTab === 'overview' ? (
                            <div className="space-y-8">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 pb-5 shadow-sm">
                                        <div className="text-slate-500 text-xs mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                                            <DollarSign className="w-3 h-3 text-brand-primary" /> 當前股價
                                        </div>
                                        <div className="text-2xl font-black text-slate-800">
                                            {parseFloat(stock.close_price).toFixed(2)}
                                        </div>
                                        <div className={`text-xs mt-1 font-bold flex items-center gap-1 ${parseFloat(stock.change_percent) >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            {parseFloat(stock.change_percent) >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                            {Math.abs(parseFloat(stock.change_percent)).toFixed(2)}%
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 pb-5 shadow-sm">
                                        <div className="text-slate-500 text-xs mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                                            <BarChart3 className="w-3 h-3 text-brand-primary" /> 本益比 (PE)
                                        </div>
                                        <div className="text-2xl font-black text-slate-800">
                                            {parseFloat(stock.pe_ratio).toFixed(2)}
                                        </div>
                                        <div className="text-slate-400 text-[10px] mt-1 italic font-medium">
                                            行業平均: --
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 pb-5 shadow-sm">
                                        <div className="text-slate-500 text-xs mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                                            <PieChart className="w-3 h-3 text-brand-primary" /> 殖利率
                                        </div>
                                        <div className="text-2xl font-black text-red-500">
                                            {(parseFloat(stock.dividend_yield) * 100).toFixed(2)}%
                                        </div>
                                        <div className="text-slate-400 text-[10px] mt-1 italic font-medium">
                                            高於市場平均
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 pb-5 shadow-sm">
                                        <div className="text-slate-500 text-xs mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                                            <Calendar className="w-3 h-3 text-brand-primary" /> 淨值比 (PB)
                                        </div>
                                        <div className="text-2xl font-black text-slate-800">
                                            {parseFloat(stock.pb_ratio).toFixed(2)}
                                        </div>
                                        <div className="text-slate-400 text-[10px] mt-1 italic font-medium">
                                            資產效率良好
                                        </div>
                                    </div>
                                </div>

                                {/* Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                    {/* Revenue Chart */}
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
                                        <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2">
                                            <BarChart3 className="text-red-500 w-5 h-5" />
                                            近一年每月營收 (億元)
                                        </h3>
                                        <div className="flex-1 w-full">
                                            {loading ? (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm animate-pulse">加載中...</div>
                                            ) : revenueData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={revenueData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                            itemStyle={{ color: '#ef4444' }}
                                                        />
                                                        <Bar dataKey="revenue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic bg-slate-50 rounded-xl border border-dashed border-slate-200">暫無營收歷史數據</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* EPS Chart */}
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
                                        <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2">
                                            <TrendingUp className="text-blue-600 w-5 h-5" />
                                            近三季 EPS
                                        </h3>
                                        <div className="flex-1 w-full">
                                            {loading ? (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm animate-pulse">加載中...</div>
                                            ) : epsData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={epsData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                            itemStyle={{ color: '#2563eb' }}
                                                        />
                                                        <Legend verticalAlign="top" align="right" height={36} />
                                                        <Line name="每股盈餘 (EPS)" type="monotone" dataKey="eps" stroke="#2563eb" strokeWidth={3} dot={{ fill: '#2563eb', r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic bg-slate-50 rounded-xl border border-dashed border-slate-200">暫無 EPS 歷史數據</div>
                                            )}
                                        </div>
                                    </div>

                                </div>

                                {/* Footer Info */}
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-500 leading-relaxed font-medium">
                                    數據來源: MuchStock 財經數據中心 (對接 FinMind API)。歷史財報每季更新一次，月營收每月 10 號前更新。
                                    所有資訊僅供參考，不構成投資建議。
                                </div>
                            </div>
                        ) : activeTab === 'main_force' ? (
                            <MainForceView
                                symbol={stock.symbol}
                                subTab={activeSubTab}
                                institutionalData={institutionalData}
                                loadingChips={loadingChips}
                            />
                        ) : activeTab === 'financials' ? (
                            <FinancialStatementsView 
                                stock={stock}
                                subTab={activeSubTab}
                                subSubTab={activeSubSubTab}
                                financials={financials}
                                loading={loading}
                                epsData={epsData}
                            />
                        ) : activeTab === 'macd' ? (
                            <MACDView symbol={stock.symbol} />
                        ) : activeTab === 'kd' ? (
                            <KDView symbol={stock.symbol} />
                        ) : activeTab === 'rsi' ? (
                            <RSIView symbol={stock.symbol} />
                        ) : activeTab === 'dmi' ? (
                            <DMIView symbol={stock.symbol} />
                        ) : activeTab === 'news' ? (
                            <div className="h-full min-h-[600px] flex flex-col">
                                <NewsBoard />
                            </div>
                        ) : activeTab === 'ai_report' ? (
                            <AIReportView symbol={stock.symbol} name={stock.name} />
                        ) : activeTab === 'realtime' ? (
                            <RealtimeView stock={stock} />
                        ) : activeTab === 'trend' ? (
                            <TrendView stock={stock} />
                        ) : activeTab === 'signals' ? (
                            <TradingSignalsView stock={stock} />
                        ) : activeTab === 'wave' ? (
                            <WaveView stock={stock} />
                        ) : activeTab === 'alerts' ? (
                            <AlertsView stock={stock} />
                        ) : activeTab === 'pattern' || activeTab === 'price_vol' || activeTab === 'adv_pattern' ? (
                            <div className="h-full w-full min-h-[600px] flex flex-col">
                                <StockChart stock={stock} />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                                    <BarChart3 className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-black text-slate-600 mb-2 tracking-tighter">{SIDEBAR_MENU.find(m => m.id === activeTab)?.label}</h3>
                                <p className="text-xs font-bold tracking-widest uppercase text-slate-400">此功能模組建置中 / Under Construction</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
