import React, { useState, useEffect } from 'react'
import { BarChart3, ClipboardList, Building2, Calendar, Search, RotateCcw, LayoutGrid, CheckSquare, ArrowLeft, Save, Trash2, Star } from 'lucide-react';
import { getSavedFilters, saveFilter, deleteFilter } from '../utils/api';
import TechnicalFilters from './TechnicalFilters'
import FundamentalFilters from './FundamentalFilters'
import InstitutionalFilters from './InstitutionalFilters'

const TABS = [
    { id: 'patterns', label: 'K線型態', icon: CheckSquare },
    { id: 'technical', label: '技術指標', icon: BarChart3 },
    { id: 'fundamental', label: '基本財報', icon: ClipboardList },
    { id: 'institutional', label: '法人籌碼', icon: Building2 },
];

const CLASSIC_PATTERNS = [
    { id: 'red_three_soldiers', name: '紅三兵', type: 'bullish' },
    { id: 'three_black_crows', name: '三隻烏鴉', type: 'bearish' },
    { id: 'morning_star', name: '晨星', type: 'bullish' },
    { id: 'evening_star', name: '夜星', type: 'bearish' },
    { id: 'bullish_engulfing', name: '吞噬型態', type: 'bullish' },
    { id: 'bearish_engulfing', name: '空頭吞噬', type: 'bearish' },
    { id: 'piercing_line', name: '貫穿/烏雲', type: 'neutral' },
    { id: 'hammer', name: '鎚子線', type: 'bullish' },
    { id: 'inverted_hammer', name: '倒鎚子', type: 'bullish' },
    { id: 'hanging_man', name: '上吊線', type: 'bearish' },
    { id: 'shooting_star', name: '射擊之星', type: 'bearish' },
    { id: 'three_inside_up', name: '三內升', type: 'bullish' },
    { id: 'three_inside_down', name: '三內降', type: 'bearish' },
    { id: 'elliott_wave_3', name: '波浪-主升段', type: 'bullish' },
    { id: 'elliott_wave_c', name: '波浪-C波殺多', type: 'bearish' },
];

export default function ScreenerConfigPage({ onFilter, onClear, filters, onBack }) {
    const [activeTab, setActiveTab] = useState('patterns')
    const [localFilters, setLocalFilters] = useState({
        market: 'all',
        patterns: [],
        price_min: '', price_max: '',
        change_min: '', change_max: '',
        volume_min: '', volume_max: '',
        pe_min: '', pe_max: '',
        yield_min: '', yield_max: '',
        pb_min: '', pb_max: '',
        foreign_net_min: '', foreign_net_max: '',
        trust_net_min: '', trust_net_max: '',
        dealer_net_min: '', dealer_net_max: '',
        total_net_min: '', total_net_max: '',
        rsi_min: '', rsi_max: '',
        macd_hist_min: '', macd_hist_max: '',
        ma20_min: '', ma20_max: '',
        adx_min: '', adx_max: '',
        bb_width_min: '', bb_width_max: '',
        wpr_min: '', wpr_max: '',
        ...filters
    })

    const [savedFilters, setSavedFilters] = useState([])
    const [isSaving, setIsSaving] = useState(false)
    const [newFilterName, setNewFilterName] = useState('')

    useEffect(() => {
        fetchSavedFilters()
    }, [])

    const fetchSavedFilters = async () => {
        try {
            const res = await getSavedFilters()
            if (res.success) setSavedFilters(res.data)
        } catch (err) {
            console.error('Fetch filters failed', err)
        }
    }

    const handleSaveStrategy = async () => {
        if (!newFilterName.trim()) {
            alert('請輸入策略名稱')
            return
        }
        try {
            const res = await saveFilter(newFilterName, localFilters)
            if (res.success) {
                setNewFilterName('')
                setIsSaving(false)
                fetchSavedFilters()
            }
        } catch (err) {
            console.error('Save failed', err)
            alert('儲存失敗')
        }
    }

    const handleDeleteFilter = async (e, id) => {
        e.stopPropagation()
        if (!confirm('確定要刪除此策略嗎？')) return
        try {
            const res = await deleteFilter(id)
            if (res.success) fetchSavedFilters()
        } catch (err) {
            console.error('Delete failed', err)
        }
    }

    const handleLoadFilter = (filter) => {
        setLocalFilters({
            ...localFilters,
            ...filter.filters
        })
    }

    const updateFilter = (key, value) => {
        setLocalFilters(prev => ({ ...prev, [key]: value }))
    }

    const togglePattern = (patternId) => {
        setLocalFilters(prev => {
            const current = prev.patterns || [];
            if (current.includes(patternId)) {
                return { ...prev, patterns: current.filter(id => id !== patternId) };
            } else {
                return { ...prev, patterns: [...current, patternId] };
            }
        });
    }

    const handleSubmit = () => {
        const cleaned = {}
        Object.entries(localFilters).forEach(([k, v]) => {
            if (v !== '' && v !== null && v !== undefined && v !== 'all') {
                if (Array.isArray(v) && v.length === 0) return; // skip empty arrays
                cleaned[k] = v
            }
        })
        onFilter(cleaned)
    }

    const handleClear = () => {
        const empty = { patterns: [] }
        Object.keys(localFilters).forEach(k => {
            if (k !== 'patterns') empty[k] = k === 'market' ? 'all' : ''
        })
        setLocalFilters(empty)
        onClear()
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[800px] flex flex-col max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors shadow-sm"
                        title="返回儀表板"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center border border-brand-primary/20">
                            <LayoutGrid className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 tracking-tight">智能篩選邏輯設定</h1>
                            <p className="text-sm font-medium text-gray-500 mt-0.5">組合多項條件找出潛力飆股</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        重置條件
                    </button>
                    <button
                        onClick={() => setIsSaving(!isSaving)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-bold transition-all
                            ${isSaving ? 'bg-amber-50 border-amber-500 text-amber-600' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}
                        `}
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? '取消儲存' : '儲存策略'}
                    </button>
                    <button
                        className="bg-brand-primary hover:bg-red-600 text-white px-8 py-2 rounded-lg flex items-center justify-center gap-2 transition-all font-black text-sm uppercase tracking-widest shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        onClick={handleSubmit}
                    >
                        <Search className="w-4 h-4" />
                        套用篩選
                    </button>
                </div>
            </div>

            {/* Save Form overlay */}
            {isSaving && (
                <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center justify-between animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-4 flex-1 max-w-2xl">
                        <div className="flex-shrink-0 w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                            <Save className="w-4 h-4 text-white" />
                        </div>
                        <input
                            type="text"
                            placeholder="請輸入此篩選策略的名稱 (例如: 低PE高殖利率起漲股)"
                            className="flex-1 bg-white border border-amber-200 rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            value={newFilterName}
                            onChange={(e) => setNewFilterName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <button
                        onClick={handleSaveStrategy}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg font-black text-sm transition-all shadow-sm"
                    >
                        確認儲存
                    </button>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                {/* Vertical Tabs Sidebar */}
                <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 flex sm:flex-col overflow-x-auto sm:overflow-visible">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                className={`flex items-center gap-3 py-4 px-6 transition-all text-left whitespace-nowrap
                                    ${isActive
                                        ? 'bg-white text-brand-primary border-t-2 md:border-t-0 md:border-l-4 border-brand-primary shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] sm:shadow-none'
                                        : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-900 border-t-2 md:border-t-0 md:border-l-4 border-transparent'}
                                `}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-primary' : 'text-gray-400'}`} />
                                <span className="font-bold tracking-wide">{tab.label}</span>
                            </button>
                        )
                    })}

                    <div className="mt-auto border-t border-gray-200 p-4 hidden md:block">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                            <Star className="w-3 h-3" />
                            我的儲存策略
                            <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[9px]">{savedFilters.length}</span>
                        </h3>
                        <div className="space-y-1">
                            {savedFilters.length === 0 ? (
                                <p className="text-[10px] text-gray-400 px-2 italic">尚未儲存任何策略</p>
                            ) : (
                                savedFilters.map(sf => (
                                    <div
                                        key={sf.id}
                                        className="group flex items-center justify-between p-2 rounded-lg hover:bg-brand-primary/5 cursor-pointer text-gray-600 hover:text-brand-primary transition-all"
                                        onClick={() => handleLoadFilter(sf)}
                                    >
                                        <span className="text-xs font-bold truncate flex-1">{sf.name}</span>
                                        <button
                                            onClick={(e) => handleDeleteFilter(e, sf.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 overflow-y-auto bg-white space-y-8">
                    {/* Global Context (Market, Date) always visible at top of content area */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-gray-100">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-brand-primary rounded-full"></span>
                                市場分類
                            </label>
                            <div className="flex gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                                {['all', 'twse', 'tpex'].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => updateFilter('market', m)}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all
                                            ${localFilters.market === m
                                                ? 'bg-white border border-gray-200 text-brand-primary shadow-sm'
                                                : 'text-gray-500 hover:bg-gray-100 border border-transparent'}
                                        `}
                                    >
                                        {m === 'all' ? '全部上市櫃' : (m === 'twse' ? '上市' : '上櫃')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                資料基準日期
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary shadow-sm transition-all hover:border-gray-400"
                                    value={localFilters.date || ''}
                                    onChange={e => updateFilter('date', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tab Panels */}
                    <div className="min-h-[400px]">
                        {activeTab === 'patterns' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 mb-1">特定K線型態偵測</h3>
                                    <p className="text-gray-500 text-sm mb-6">勾選您想篩選的經典多日型態，系統將自動尋找符合條件的標的。</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {CLASSIC_PATTERNS.map(pat => {
                                            const isSelected = (localFilters.patterns || []).includes(pat.id);
                                            return (
                                                <button
                                                    key={pat.id}
                                                    onClick={() => togglePattern(pat.id)}
                                                    className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group
                                                        ${isSelected ? 'bg-red-50/50 border-brand-primary shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}
                                                    `}
                                                >
                                                    <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border ${isSelected ? 'bg-brand-primary border-brand-primary text-white flex items-center justify-center' : 'bg-white border-gray-300 group-hover:border-brand-primary/50'}`}>
                                                        {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-bold text-[15px] ${isSelected ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'}`}>{pat.name}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded
                                                                ${pat.type === 'bullish' ? 'bg-red-100 text-red-700' :
                                                                    pat.type === 'bearish' ? 'bg-green-100 text-green-700' :
                                                                        'bg-gray-100 text-gray-700'}
                                                            `}>
                                                                {pat.type === 'bullish' ? '看漲' : pat.type === 'bearish' ? '看跌' : '中性'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'technical' && <div className="max-w-3xl animate-in fade-in duration-300"><TechnicalFilters filters={localFilters} onChange={updateFilter} /></div>}
                        {activeTab === 'fundamental' && <div className="max-w-3xl animate-in fade-in duration-300"><FundamentalFilters filters={localFilters} onChange={updateFilter} /></div>}
                        {activeTab === 'institutional' && <div className="max-w-3xl animate-in fade-in duration-300"><InstitutionalFilters filters={localFilters} onChange={updateFilter} /></div>}
                    </div>
                </div>
            </div>
        </div>
    )
}
