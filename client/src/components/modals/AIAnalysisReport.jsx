import React from 'react';
import { Bot, Sparkles, AlertCircle } from 'lucide-react';
import StructuredReportView from '../shared/StructuredReportView';

export default function AIAnalysisReport({ report, loading }) {
    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8">
                <div className="relative">
                    <Bot className="w-12 h-12 animate-pulse" />
                    <Sparkles className="w-6 h-6 absolute -top-1 -right-1 text-brand-primary animate-bounce" />
                </div>
                <div className="text-center">
                    <p className="font-bold text-slate-600">AI 正在深度分析中...</p>
                    <p className="text-xs mt-1">彙整 技術面、籌碼面 與 盤勢新聞</p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400 font-medium bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                請點擊右上角按鈕生成 AI 報告
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-brand-primary" />
                    <span className="text-white font-black tracking-tight">muchStock AI 分析報告</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sentiment Score:</span>
                    <div className={`px-2 py-0.5 rounded text-[11px] font-black ${(report.sentiment_score || 0.5) >= 0.5 ? 'bg-brand-success text-white' : 'bg-brand-danger text-white'}`}>
                        {((report.sentiment_score || 0.5) * 10).toFixed(1)} / 10
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-slate-50/30">
                <div className="max-w-3xl mx-auto">
                    <StructuredReportView reportText={report.report} />

                    {report.is_fallback && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs font-bold leading-relaxed mt-5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>系統提示：目前環境尚未配置 Gemini AI 金鑰，報告係由本地量化規則引擎自動產出。</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-100 flex justify-end">
                <p className="text-[10px] font-bold text-slate-400">AI 生成內容僅供參考，不構成投資建議。</p>
            </div>
        </div>
    );
}
