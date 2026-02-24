import React, { useEffect, useState } from 'react';
import { Bot, Sparkles, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { getAIReport } from '../utils/api';

export default function AIReportView({ symbol, name }) {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getAIReport(symbol);
                setReportData(data);
            } catch (err) {
                console.error("AI 報告獲取失敗:", err);
                setError("無法獲取 AI 分析報告，請稍後再試。");
            } finally {
                setLoading(false);
            }
        };

        if (symbol) {
            fetchReport();
        }
    }, [symbol]);

    // 渲染情緒儀表板
    const renderSentimentMeter = (score) => {
        // score is 0.0 to 1.0 (0 = extreme bearish, 1 = extreme bullish)
        const percentage = Math.max(0, Math.min(100, score * 100));

        let sentimentText = '中性觀望';
        let sentimentColor = 'text-slate-500';
        let gradientClass = 'from-slate-400 to-slate-500';
        let Icon = Minus;

        if (score >= 0.7) {
            sentimentText = '強烈看多';
            sentimentColor = 'text-red-600';
            gradientClass = 'from-red-400 to-red-600';
            Icon = TrendingUp;
        } else if (score >= 0.55) {
            sentimentText = '偏向看多';
            sentimentColor = 'text-red-500';
            gradientClass = 'from-red-300 to-red-500';
            Icon = TrendingUp;
        } else if (score <= 0.3) {
            sentimentText = '強烈看空';
            sentimentColor = 'text-green-600';
            gradientClass = 'from-green-400 to-green-600';
            Icon = TrendingDown;
        } else if (score <= 0.45) {
            sentimentText = '偏向看空';
            sentimentColor = 'text-green-500';
            gradientClass = 'from-green-300 to-green-500';
            Icon = TrendingDown;
        }

        return (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden h-full">
                <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-10 bg-gradient-to-br ${gradientClass}`}></div>
                <div className="text-slate-500 text-xs font-bold mb-4 uppercase tracking-widest">AI 綜合多空情緒</div>

                <div className="relative w-full max-w-[200px] h-4 bg-slate-100 rounded-full mb-6 overflow-hidden border border-slate-200/50 shadow-inner">
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-300 z-10"></div>
                    <div
                        className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-1000 ease-out`}
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>

                <div className={`text-2xl font-black ${sentimentColor} flex items-center gap-2 tracking-tight`}>
                    <Icon className="w-6 h-6" />
                    {sentimentText}
                </div>
                <div className="text-3xl font-black text-slate-800 tabular-nums mt-1">
                    {(score * 100).toFixed(0)} <span className="text-sm text-slate-400 font-bold">/ 100</span>
                </div>
            </div>
        );
    };

    // A simple minus icon for neutral state
    const Minus = ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2.5 rounded-xl border border-indigo-200 shadow-inner">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tighter">AI 智能分析報告</h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Generative AI Insights</p>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center min-h-[400px]">
                    <div className="w-16 h-16 relative mb-6">
                        <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                        <div className="relative z-10 w-16 h-16 bg-white border-2 border-indigo-100 rounded-full flex items-center justify-center shadow-lg">
                            <Bot className="w-8 h-8 text-indigo-500 animate-pulse" />
                        </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-700 tracking-tight mb-2">正在分析海量市場數據...</h3>
                    <p className="text-sm font-medium text-slate-400 max-w-sm text-center">
                        AI 助手正在解讀 {name} ({symbol}) 的最新價量、籌碼流向與新聞資訊，請稍候。
                    </p>
                </div>
            ) : error ? (
                <div className="flex-1 bg-white p-8 rounded-2xl border border-red-100 shadow-sm flex flex-col justify-center items-center text-red-500 min-h-[400px]">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-bold">{error}</p>
                </div>
            ) : reportData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">

                    {/* Sentiment Dashboard */}
                    <div className="md:col-span-1 flex flex-col gap-6">
                        <div className="flex-1">
                            {renderSentimentMeter(reportData.sentiment_score ?? 0.5)}
                        </div>

                        {reportData.is_fallback && (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-700 text-xs font-bold leading-relaxed flex gap-3 shadow-inner">
                                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    目前系統未設定 Gemini API 金鑰，此報告為基於既有規則引擎所自動產生的標準化特徵摘要，非生成式 AI 結果。
                                </div>
                            </div>
                        )}
                        {!reportData.is_fallback && (
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-indigo-700/80 text-xs font-medium leading-relaxed shadow-inner">
                                此報告由 Google Gemini 模型即時生成，綜合考量了歷史價量、三大法人動向及最新新聞。AI 生成內容謹供參考，不構成投資建議。
                            </div>
                        )}
                    </div>

                    {/* Report Content */}
                    <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <Bot className="w-5 h-5 text-indigo-500" />
                                綜合評析報告
                            </h3>
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                                {new Date().toLocaleDateString('zh-TW')}
                            </span>
                        </div>

                        <div className="p-6 md:p-8 flex-1 overflow-y-auto w-full custom-scrollbar">
                            <div className="prose prose-slate prose-sm md:prose-base max-w-none w-full">
                                {reportData.report.split('\n').map((paragraph, idx) => {
                                    if (!paragraph.trim()) return <br key={idx} />;

                                    // Make some common patterns bold for better reading
                                    const formattedText = paragraph
                                        .replace(/\*/g, '') // Remove Markdown bold/italic chars if any
                                        .replace(/(技術面強弱總結|籌碼面法人動向分析|綜合投資建議|結論)：?/g, '<br/><strong class="text-indigo-900 text-lg border-l-4 border-indigo-500 pl-3 block mt-6 mb-3">$1</strong>')
                                        // Highlight numbers and percentages
                                        .replace(/([+-]?\d+(?:\.\d+)?%?)/g, '<span class="font-black text-slate-800">$1</span>');

                                    return (
                                        <p
                                            key={idx}
                                            className="text-slate-600 leading-loose text-[15px] mb-4 text-justify"
                                            dangerouslySetInnerHTML={{ __html: formattedText }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
