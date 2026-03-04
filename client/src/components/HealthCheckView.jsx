import React, { useState, useEffect, useMemo } from 'react';
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell
} from 'recharts';
import { Shield, TrendingUp, Heart, Target, Coins, Users, Award, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../utils/api';

const DIMENSION_ICONS = {
    '獲利能力': TrendingUp,
    '成長能力': Target,
    '安全性': Shield,
    '價值衡量': Award,
    '配息能力': Coins,
    '籌碼面': Users
};

const GRADE_STYLES = {
    green: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', ring: 'ring-emerald-400', glow: 'shadow-emerald-200/50' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', ring: 'ring-blue-400', glow: 'shadow-blue-200/50' },
    yellow: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', ring: 'ring-amber-400', glow: 'shadow-amber-200/50' },
    red: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', ring: 'ring-red-400', glow: 'shadow-red-200/50' },
    neutral: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', ring: 'ring-slate-400', glow: 'shadow-slate-200/50' }
};

function getScoreColor(score) {
    if (score >= 75) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 45) return '#f59e0b';
    return '#ef4444';
}

function getScoreLabel(score) {
    if (score >= 75) return '優';
    if (score >= 60) return '良';
    if (score >= 45) return '平';
    return '劣';
}

export default function HealthCheckView({ symbol }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!symbol) return;
        setLoading(true);
        setError(null);
        fetch(`${API_BASE}/stock/${symbol}/health-check`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(e => { setError(e.message); setLoading(false); });
    }, [symbol]);

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mb-4"></div>
                <p className="font-bold tracking-widest text-sm uppercase">讀取健診數據...</p>
            </div>
        );
    }

    if (error || !data?.success) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
                <p className="font-bold text-slate-600">健診資料載入失敗</p>
                <p className="text-sm text-slate-400 mt-1">{error || '暫無資料'}</p>
            </div>
        );
    }

    const { overall, grade, gradeColor, dimensions, metrics } = data;
    const style = GRADE_STYLES[gradeColor] || GRADE_STYLES.neutral;

    const radarData = dimensions.map(d => ({
        dimension: d.name,
        score: d.score,
        fullMark: 100
    }));

    const barData = dimensions.map(d => ({
        name: d.name,
        score: d.score,
        fill: getScoreColor(d.score)
    }));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-teal-100 p-2.5 rounded-xl border border-teal-200">
                    <Heart className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tighter">個股健診報告</h2>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Stock Health Check</p>
                </div>
            </div>

            {/* Overall Score Card */}
            <div className={`${style.bg} ${style.border} border-2 rounded-2xl p-6 shadow-lg ${style.glow} ring-1 ${style.ring}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">綜合健康評分</div>
                        <div className="flex items-baseline gap-3">
                            <span className={`text-6xl font-black tabular-nums ${style.text}`}>{overall}</span>
                            <span className="text-lg font-bold text-slate-400">/ 100</span>
                        </div>
                    </div>
                    <div className={`${style.text} ${style.bg} border ${style.border} px-6 py-3 rounded-2xl`}>
                        <div className="text-3xl font-black text-center">{grade}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-center mt-1 opacity-70">GRADE</div>
                    </div>
                </div>
            </div>

            {/* Radar Chart + Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-teal-600" /> 六維雷達圖
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis
                                    dataKey="dimension"
                                    tick={{ fontSize: 12, fontWeight: 700, fill: '#475569' }}
                                />
                                <PolarRadiusAxis
                                    angle={30}
                                    domain={[0, 100]}
                                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                                />
                                <Radar
                                    name="分數"
                                    dataKey="score"
                                    stroke="#14b8a6"
                                    fill="#14b8a6"
                                    fillOpacity={0.25}
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    formatter={(v) => [`${v} 分`, '評分']}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-sm">
                        <Award className="w-4 h-4 text-indigo-600" /> 各面向評分
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#475569' }} width={70} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(v) => [`${v} 分`]}
                                />
                                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={24}>
                                    {barData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Dimension Detail Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dimensions.map((dim, index) => {
                    const Icon = DIMENSION_ICONS[dim.name] || Shield;
                    const color = getScoreColor(dim.score);
                    const label = getScoreLabel(dim.score);
                    return (
                        <div key={index} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                                        <Icon className="w-4 h-4" style={{ color }} />
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm">{dim.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black tabular-nums" style={{ color }}>{dim.score}</span>
                                    <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>{label}</span>
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                                <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${dim.score}%`, backgroundColor: color }}></div>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">{dim.detail}</p>
                        </div>
                    );
                })}
            </div>

            {/* Key Metrics Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                    {[
                        { label: 'ROE', value: `${metrics?.latestROE?.toFixed(1)}%` },
                        { label: '毛利率', value: `${metrics?.latestGrossMargin?.toFixed(1)}%` },
                        { label: 'PE', value: metrics?.pe?.toFixed(1) },
                        { label: '殖利率', value: `${metrics?.dy?.toFixed(2)}%` },
                        { label: '法人買超', value: `${metrics?.totalBuy?.toFixed(0)}張` }
                    ].map((m, i) => (
                        <div key={i}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</div>
                            <div className="text-lg font-black text-slate-800 tabular-nums">{m.value || '--'}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 leading-relaxed font-medium">
                註：個股健診評分為系統自動化評分，基於歷史財報、法人進出、市場估值等多維度量化指標綜合計算。評分結果僅供參考，不構成投資建議。
            </div>
        </div>
    );
}
