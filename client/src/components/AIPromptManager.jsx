import React, { useState, useEffect } from 'react';
import { Save, History, Check, AlertCircle, RefreshCcw, FileText, ChevronRight } from 'lucide-react';
import { getPromptTemplate, updatePromptTemplate, getPromptHistory, getPromptVersion } from '../utils/api';

export default function AIPromptManager() {
    const [templateName, setTemplateName] = useState('stock_analysis_report');
    const [content, setContent] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [activeVersion, setActiveVersion] = useState(null);
    const [viewingVersion, setViewingVersion] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [templateRes, historyRes] = await Promise.all([
                getPromptTemplate(templateName),
                getPromptHistory(templateName)
            ]);

            if (templateRes.success) {
                setContent(templateRes.data.content);
                setActiveVersion(templateRes.data.version);
                setViewingVersion(templateRes.data.version);
            }
            if (historyRes.success) {
                setHistory(historyRes.data);
            }
        } catch (err) {
            console.error('Failed to fetch prompt data:', err);
            setMessage({ type: 'error', text: '獲取資料失敗' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [templateName]);

    const handleSave = async () => {
        if (!content.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await updatePromptTemplate(templateName, content);
            if (res.success) {
                setMessage({ type: 'success', text: `成功儲存新版本 (v${res.data.version})` });
                fetchData();
            }
        } catch (err) {
            setMessage({ type: 'error', text: '儲存失敗' });
        } finally {
            setSaving(false);
        }
    };

    const handleViewVersion = async (versionId) => {
        setLoading(true);
        try {
            const res = await getPromptVersion(versionId);
            if (res.success) {
                setContent(res.data.content);
                setViewingVersion(res.data.version);
                setMessage({ type: 'info', text: `正在預覽版本 v${res.data.version} (未儲存)` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: '獲取版本內容失敗' });
        } finally {
            setLoading(false);
        }
    };

    if (loading && !content) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {/* Main Editor */}
            <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <FileText className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 tracking-tight">AI 提示詞編輯器</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Template: {templateName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {viewingVersion !== activeVersion && (
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded border border-amber-200 uppercase tracking-wider">
                                    預覽版本 v{viewingVersion}
                                </span>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                            >
                                {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                儲存為新版本
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 p-0 relative">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-full p-6 text-slate-700 font-mono text-sm leading-relaxed focus:outline-none resize-none bg-slate-50/30"
                            placeholder="在這裡輸入 AI 提示詞模板..."
                        />
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${
                        message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
                        message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
                        'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
                        {message.type === 'success' ? <Check className="w-5 h-5" /> : 
                         message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
                         <RefreshCcw className="w-5 h-5" />}
                        <span className="text-sm font-bold">{message.text}</span>
                    </div>
                )}
            </div>

            {/* Version History Sidebar */}
            <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-400" />
                        <h4 className="text-sm font-black text-slate-700">版本歷史</h4>
                    </div>
                    <div className="flex-1 overflow-y-auto w-full custom-scrollbar p-3 space-y-2">
                        {history.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleViewVersion(item.id)}
                                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                                    viewingVersion === item.version 
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200' 
                                        : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-black ${viewingVersion === item.version ? 'text-indigo-600' : 'text-slate-700'}`}>
                                            版本 v{item.version}
                                        </span>
                                        {item.is_active && (
                                            <span className="bg-green-100 text-green-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-tighter">
                                                使用中
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold">
                                        {new Date(item.created_at).toLocaleString('zh-TW', { 
                                            month: 'short', 
                                            day: 'numeric', 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${viewingVersion === item.version ? 'text-indigo-500' : 'text-slate-300'}`} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
