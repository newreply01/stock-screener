import React from 'react';
import { Users, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import ChipAnalysisChart from './ChipAnalysisChart';

export default function MainForceView({ symbol, subTab, institutionalData, loadingChips }) {
    if (subTab === 'institutional') {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <div className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> 外資買賣
                        </div>
                        <div className={`text-xl font-black ${institutionalData[0]?.foreign_net >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {institutionalData[0]?.foreign_net || 0} <span className="text-[10px] font-bold text-slate-400">張</span>
                        </div>
                    </div>
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        <div className="text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> 投信買賣
                        </div>
                        <div className={`text-xl font-black ${institutionalData[0]?.trust_net >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {institutionalData[0]?.trust_net || 0} <span className="text-[10px] font-bold text-slate-400">張</span>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" /> 自營商
                        </div>
                        <div className={`text-xl font-black ${institutionalData[0]?.dealer_net >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {institutionalData[0]?.dealer_net || 0} <span className="text-[10px] font-bold text-slate-400">張</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[400px]">
                    <h4 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-brand-primary" /> 三大法人持股比重與買賣趨勢
                    </h4>
                    <div className="h-[350px]">
                        {loadingChips ? (
                            <div className="h-full flex items-center justify-center text-slate-400 animate-pulse">數據載入中...</div>
                        ) : (
                            <ChipAnalysisChart data={institutionalData} />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Default placeholder for other subtabs
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px] animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
                <Users className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-600 mb-2 tracking-tighter">功能模組開發中</h3>
            <p className="text-xs font-bold tracking-widest uppercase text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                {subTab === 'force_detail' ? '主力進出明細' : subTab === 'margin_trade' ? '融資融券變化' : '分點進跡查詢'}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="h-2 bg-slate-100 rounded-full w-full"></div>
                <div className="h-2 bg-slate-50 rounded-full w-full"></div>
                <div className="h-2 bg-slate-50 rounded-full w-third"></div>
                <div className="h-2 bg-slate-100 rounded-full w-full"></div>
            </div>
        </div>
    );
}
