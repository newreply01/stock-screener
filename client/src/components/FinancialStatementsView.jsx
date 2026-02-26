import React from 'react';
import { BarChart3, TrendingUp, DollarSign, Activity } from 'lucide-react';
import RevenueView from './RevenueView';
import ValuationView from './ValuationView';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from 'recharts';

export default function FinancialStatementsView({
    stock,
    subTab,
    subSubTab,
    financials,
    loading,
    epsData
}) {
    // 獲利能力 -> EPS 走勢 (Sample SubSubTab implementation)
    if (subTab === 'profitability' && subSubTab === 'eps_trend') {
        return (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[450px] animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-slate-800 font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="text-blue-600 w-5 h-5" />
                    每股盈餘 (EPS) 走勢分析
                </h3>
                <div className="flex-1 w-full">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm animate-pulse">數據載入中...</div>
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
        );
    }

    if (subTab === 'profitability') {
        return (
            <div className="animate-in fade-in duration-300">
                <ValuationView
                    financials={financials}
                    loading={loading}
                    currentPe={stock.pe_ratio}
                    currentPb={stock.pb_ratio}
                />
            </div>
        );
    }

    if (subTab === 'revenue_growth') {
        return (
            <div className="animate-in fade-in duration-300">
                <RevenueView financials={financials} loading={loading} />
            </div>
        );
    }

    // Default Placeholder for under construction regions
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[450px] animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
                <BarChart3 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-600 mb-2 tracking-tighter">財務子模組開發中</h3>
            <p className="text-xs font-bold tracking-widest uppercase text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                {subTab === 'reports' ? '財務報表系列' : subTab === 'dividend' ? '股利政策分析' : '數據準備中'}
                {subSubTab && ` - ${subSubTab}`}
            </p>
            <div className="mt-8 flex gap-2">
                <div className="w-24 h-2 bg-slate-100 rounded-full"></div>
                <div className="w-12 h-2 bg-slate-200 rounded-full"></div>
                <div className="w-32 h-2 bg-slate-100 rounded-full"></div>
            </div>
        </div>
    );
}
