import React from 'react';
import { Bot, Sparkles, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

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

    const sentiment = report.sentiment_score || 0.5;
    const isPositive = sentiment >= 0.5;

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
                    <div className={`px-2 py-0.5 rounded text-[11px] font-black ${isPositive ? 'bg-brand-success text-white' : 'bg-brand-danger text-white'}`}>
                        {(sentiment * 10).toFixed(1)} / 10
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-8 flex-1 overflow-y-auto bg-slate-50/30">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex gap-4">
                        <div className={`mt-1 p-2 rounded-xl shrink-0 h-fit ${isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {isPositive ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                                {isPositive ? '當前盤勢分析：偏多格局' : '當前盤勢分析：趨於審慎'}
                            </h3>
                            <div className="text-slate-600 leading-relaxed font-medium text-base whitespace-pre-wrap">
                                {report.report}
                            </div>
                        </div>
                    </div>

                    {report.is_fallback && (
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs font-bold leading-relaxed">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>系統提示：目前環境尚未配置 Gemini AI 金鑰，報告係由本地量化規則引擎自動產出。欲解鎖更精準的 LLM 分析，請於伺服器環境設定 GEMINI_API_KEY。</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-100 flex justify-end">
                <p className="text-[10px] font-bold text-slate-400">數據更新時間：{new Date().toLocaleTimeString()} (由 Google Gemini 驅動)</p>
            </div>
        </div>
    );
}
