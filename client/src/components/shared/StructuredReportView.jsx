import React, { useMemo, useState } from 'react';
import {
    FileText, BarChart3, Users, Building2, Newspaper, Target,
    ArrowUp, Shield, ChevronDown, TrendingUp, TrendingDown,
    Activity, Zap, Brain, CheckCircle2, AlertTriangle, Info,
    DollarSign, PieChart, Eye
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

// ─── Section config ──────────────────────────────────────────────────
const SECTION_META = {
    1: {
        icon: FileText, label: '個股摘要',
        gradient: 'from-slate-600 to-slate-700',
        accent: '#64748b', bg: 'bg-slate-50', border: 'border-slate-200',
        lightBg: 'bg-slate-50', tag: 'SUMMARY'
    },
    2: {
        icon: BarChart3, label: '技術面分析',
        gradient: 'from-indigo-500 to-indigo-600',
        accent: '#6366f1', bg: 'bg-indigo-50', border: 'border-indigo-200',
        lightBg: 'bg-indigo-50/50', tag: 'TECHNICAL'
    },
    3: {
        icon: Users, label: '籌碼面判讀',
        gradient: 'from-violet-500 to-violet-600',
        accent: '#8b5cf6', bg: 'bg-violet-50', border: 'border-violet-200',
        lightBg: 'bg-violet-50/50', tag: 'INSTITUTIONAL'
    },
    4: {
        icon: Building2, label: '基本面分析',
        gradient: 'from-amber-500 to-amber-600',
        accent: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200',
        lightBg: 'bg-amber-50/50', tag: 'FUNDAMENTAL'
    },
    5: {
        icon: Newspaper, label: '新聞面判讀',
        gradient: 'from-emerald-500 to-emerald-600',
        accent: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200',
        lightBg: 'bg-emerald-50/50', tag: 'NEWS'
    },
    6: {
        icon: Target, label: '綜合結論',
        gradient: 'from-rose-500 to-rose-600',
        accent: '#ef4444', bg: 'bg-rose-50', border: 'border-rose-200',
        lightBg: 'bg-rose-50/50', tag: 'CONCLUSION'
    },
};

// ─── Report parser ───────────────────────────────────────────────────
export function parseReport(markdown) {
    if (!markdown) return null;

    // 清理 LaTeX 風格的符號
    markdown = markdown
        .replace(/\$\\sim\$/g, '～')
        .replace(/\$\\rightarrow\$/g, ' → ')
        .replace(/\$\\uparrow\$/g, '↑')
        .replace(/\$\\downarrow\$/g, '↓')
        .replace(/\$\\plus\$/g, '+')
        .replace(/\$\\minus\$/g, '-')
        .replace(/\$\\times\$/g, '×')
        .replace(/\$\\div\$/g, '÷');

    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const sectionRegex = /^#{2,4}\s+(\d+)\.\s+(.+)/gm;
    const sectionStarts = [];
    let match;
    while ((match = sectionRegex.exec(markdown)) !== null) {
        sectionStarts.push({ index: match.index, number: parseInt(match[1]), title: match[2].trim(), len: match[0].length });
    }

    const sections = sectionStarts.map((s, i) => {
        const start = s.index + s.len;
        const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : markdown.length;
        return { number: s.number, title: s.title, content: markdown.substring(start, end).trim() };
    });

    let mainScore = null, subScores = [], tradingAdvice = {};
    const scoreSection = sections.find(s => /結論|Score|Summary/.test(s.title)) || sections[sections.length - 1];

    if (scoreSection) {
        const scoreMatch = scoreSection.content.match(/多空評分[：:]\s*\*\*(\d+)\s*\/\s*100\*\*/) ||
            scoreSection.content.match(/綜合評分[：:]\s*\*\*(\d+)\s*\/\s*100\*\*/) ||
            scoreSection.content.match(/\*\*(\d+)\s*\/\s*100\*\*/);
        if (scoreMatch) mainScore = parseInt(scoreMatch[1]);

        const techMatch = scoreSection.content.match(/技術面\s*[\(（](\d+)\s*\/\s*(\d+)[\)）]/);
        const chipMatch = scoreSection.content.match(/籌碼面\s*[\(（](\d+)\s*\/\s*(\d+)[\)）]/);
        const fundMatch = scoreSection.content.match(/基本面\s*[\(（](\d+)\s*\/\s*(\d+)[\)）]/);
        const newsMatch = scoreSection.content.match(/新聞面\s*[\(（](\d+)\s*\/\s*(\d+)[\)）]/);

        subScores = [
            { name: '技術面', score: techMatch ? parseInt(techMatch[1]) : 0, max: techMatch ? parseInt(techMatch[2]) : 25 },
            { name: '籌碼面', score: chipMatch ? parseInt(chipMatch[1]) : 0, max: chipMatch ? parseInt(chipMatch[2]) : 25 },
            { name: '基本面', score: fundMatch ? parseInt(fundMatch[1]) : 0, max: fundMatch ? parseInt(fundMatch[2]) : 25 },
            { name: '新聞面', score: newsMatch ? parseInt(newsMatch[1]) : 0, max: newsMatch ? parseInt(newsMatch[2]) : 25 },
        ];

        const entryMatch = scoreSection.content.match(/進場位階[：:]\s*(.+)/);
        const targetMatch = scoreSection.content.match(/目標位階[：:]\s*(.+)/);
        const stopMatch = scoreSection.content.match(/風險防衛[：:]\s*(.+)/);
        tradingAdvice = {
            entry: entryMatch ? entryMatch[1].replace(/\*\*/g, '').trim() : null,
            target: targetMatch ? targetMatch[1].replace(/\*\*/g, '').trim() : null,
            stop: stopMatch ? stopMatch[1].replace(/\*\*/g, '').trim() : null,
        };
    }

    return { title: titleMatch ? titleMatch[1] : '', sections, mainScore, subScores, tradingAdvice, scoreSectionNum: scoreSection?.number };
}

// ─── Score gauge (circular) ──────────────────────────────────────────
function ScoreGauge({ score }) {
    const size = 160, stroke = 12;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;

    const getInfo = (s) => {
        if (s >= 70) return { main: '#ef4444', trail: '#fecaca', label: '偏多看漲', Icon: TrendingUp };
        if (s >= 55) return { main: '#f97316', trail: '#fed7aa', label: '微偏多', Icon: TrendingUp };
        if (s >= 45) return { main: '#94a3b8', trail: '#e2e8f0', label: '中性震盪', Icon: Activity };
        if (s >= 30) return { main: '#22c55e', trail: '#bbf7d0', label: '微偏空', Icon: TrendingDown };
        return { main: '#16a34a', trail: '#86efac', label: '偏空看跌', Icon: TrendingDown };
    };
    const { main, trail, label, Icon } = getInfo(score);

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trail} strokeWidth={stroke} />
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={main} strokeWidth={stroke}
                        strokeLinecap="round" strokeDasharray={circumference}
                        strokeDashoffset={circumference - progress}
                        className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black tabular-nums" style={{ color: main }}>{score}</span>
                    <span className="text-[11px] font-bold text-slate-400 tracking-widest">/ 100</span>
                </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black shadow-sm"
                style={{ backgroundColor: trail, color: main }}>
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
        </div>
    );
}

// ─── Sub-score bar ────────────────────────────────────────────────────
function SubScoreBar({ name, score, max }) {
    const pct = Math.round((score / max) * 100);
    const getBarStyle = (p) => {
        if (p >= 70) return { bar: 'from-red-400 to-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', num: 'text-rose-700' };
        if (p >= 50) return { bar: 'from-amber-400 to-orange-500', text: 'text-amber-600', bg: 'bg-amber-50', num: 'text-amber-700' };
        return { bar: 'from-slate-300 to-slate-400', text: 'text-slate-500', bg: 'bg-slate-50', num: 'text-slate-600' };
    };
    const style = getBarStyle(pct);
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className={`text-[11px] font-black uppercase tracking-wider ${style.text}`}>{name}</span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${style.bg}`}>
                    <span className={style.num}>{score}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-400">{max}</span>
                </div>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${style.bar} transition-all duration-700 ease-out`}
                    style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── Bullet list renderer (parse markdown bullets cleanly) ────────────
function BulletContent({ content }) {
    // Split into bullet blocks and sub-bullets
    const lines = content.split('\n');
    const items = [];
    let current = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Top-level bullet
        const topBulletMatch = trimmed.match(/^[-*]\s+(.+)/);
        if (topBulletMatch) {
            // Check for bold keyword pattern like "**關鍵字**："
            const boldKeyMatch = topBulletMatch[1].match(/^\*\*(.+?)\*\*[：:]\s*(.+)?/);
            if (boldKeyMatch) {
                current = { keyword: boldKeyMatch[1], text: boldKeyMatch[2] || '', subs: [] };
            } else {
                current = { keyword: null, text: topBulletMatch[1], subs: [] };
            }
            items.push(current);
            continue;
        }

        // Sub-bullet (indented)
        const subBulletMatch = trimmed.match(/^[-*]\s+(.+)/);
        if (subBulletMatch && current) {
            current.subs.push(subBulletMatch[1]);
            continue;
        }

        // Plain paragraph continuation
        if (current && trimmed && !trimmed.startsWith('#')) {
            // Check if it's a bold keyword line
            const boldKeyMatch = trimmed.match(/^\*\*(.+?)\*\*[：:]\s*(.+)?/);
            if (boldKeyMatch) {
                current = { keyword: boldKeyMatch[1], text: boldKeyMatch[2] || '', subs: [] };
                items.push(current);
            } else {
                // Append to last item text
                if (current) current.text += ' ' + trimmed;
            }
        }
    }

    if (items.length === 0) {
        // Fallback: render raw markdown
        return (
            <div className="prose prose-slate prose-sm max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {items.map((item, idx) => (
                <div key={idx} className="flex gap-3">
                    <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current mt-2 opacity-40" />
                    <div className="flex-1 min-w-0">
                        {item.keyword ? (
                            <p className="text-base text-slate-700 leading-relaxed">
                                <span className="font-black text-slate-900">{item.keyword}：</span>
                                {item.text.replace(/\*\*/g, '')}
                            </p>
                        ) : (
                            <p className="text-base text-slate-700 leading-relaxed">
                                {item.text.replace(/\*\*/g, '')}
                            </p>
                        )}
                        {item.subs.length > 0 && (
                            <ul className="mt-2 space-y-2 pl-3 border-l-2 border-slate-200">
                                {item.subs.map((sub, si) => (
                                    <li key={si} className="text-sm text-slate-600 leading-relaxed">
                                        {sub.replace(/\*\*/g, '')}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Collapsible section card ─────────────────────────────────────────
function SectionCard({ number, title, content, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    const meta = SECTION_META[number];
    if (!meta) return null;
    const Icon = meta.icon;
    const cleanContent = content.replace(/>\s*\[!(TIP|IMPORTANT|NOTE|WARNING)\]\s*/g, '').replace(/^>\s*/gm, '');

    return (
        <div className={`rounded-2xl border ${meta.border} overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group`}>
            {/* Header */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-3 px-5 py-4 ${meta.lightBg} hover:brightness-95 transition-all`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${meta.gradient} shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                        <div className="text-[9px] font-black tracking-[0.2em] opacity-50 uppercase mb-0.5"
                            style={{ color: meta.accent }}>{meta.tag}</div>
                        <h3 className="font-black text-sm text-slate-800 tracking-tight">{title}</h3>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Body */}
            {open && (
                <div className="bg-white px-5 py-5 border-t border-slate-50" style={{ borderColor: `${meta.accent}20` }}>
                    <div style={{ color: meta.accent }}>
                        <BulletContent content={cleanContent} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Trading advice card ──────────────────────────────────────────────
function TradingAdviceCard({ advice }) {
    if (!advice.entry && !advice.target && !advice.stop) return null;

    const items = [
        {
            key: 'target', label: '目標位階', shortLabel: 'TARGET',
            icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50',
            border: 'border-rose-200', numColor: 'text-rose-700',
            barColor: 'bg-rose-500', value: advice.target
        },
        {
            key: 'entry', label: '進場位階', shortLabel: 'ENTRY',
            icon: Target, color: 'text-blue-600', bg: 'bg-blue-50',
            border: 'border-blue-200', numColor: 'text-blue-700',
            barColor: 'bg-blue-500', value: advice.entry
        },
        {
            key: 'stop', label: '風險防衛 (停損)', shortLabel: 'STOP LOSS',
            icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50',
            border: 'border-emerald-200', numColor: 'text-emerald-700',
            barColor: 'bg-emerald-500', value: advice.stop
        },
    ];

    return (
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-md bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
                <div className="p-2 rounded-xl bg-white/10">
                    <Zap className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                    <div className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase">AI Strategy</div>
                    <h3 className="font-black text-sm text-white">具體操盤建議</h3>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
                {items.map(item => item.value && (
                    <div key={item.key} className="bg-slate-900/50 p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${item.bg} border ${item.border}`}>
                                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                            </div>
                            <div>
                                <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase">{item.shortLabel}</div>
                                <div className="text-[11px] font-bold text-slate-300">{item.label}</div>
                            </div>
                        </div>
                        <p className={`text-sm font-bold ${item.color} leading-relaxed`}>{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main structured report renderer ─────────────────────────────────
export default function StructuredReportView({ reportText, compact = false }) {
    const parsed = useMemo(() => parseReport(reportText), [reportText]);

    const radarData = useMemo(() => {
        if (!parsed?.subScores?.length) return [];
        return parsed.subScores.map(s => ({
            subject: s.name,
            score: Math.round((s.score / s.max) * 100),
            fullMark: 100,
        }));
    }, [parsed]);

    const hasParsed = parsed && parsed.sections.length >= 2;

    if (!hasParsed) {
        return (
            <div className="prose prose-slate prose-sm max-w-none px-2 ai-section-content">
                <ReactMarkdown>{reportText}</ReactMarkdown>
            </div>
        );
    }

    const hasScores = parsed.mainScore !== null;

    return (
        <div className="flex flex-col gap-4">

            {/* ── Score overview card ── */}
            {hasScores && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-white">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-sm">
                            <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="text-[9px] font-black tracking-[0.2em] text-rose-400 uppercase">AI Score</div>
                            <h3 className="font-black text-sm text-slate-800">多空評分總覽</h3>
                        </div>
                    </div>
                    <div className={`p-6 flex ${compact ? 'flex-col items-center gap-6' : 'flex-col md:flex-row items-center gap-8'}`}>
                        {/* Circular gauge */}
                        <div className="flex-shrink-0">
                            <ScoreGauge score={parsed.mainScore} />
                        </div>

                        {/* Radar chart */}
                        {radarData.length > 0 && !compact && (
                            <div className="w-full md:w-[200px] h-[180px] flex-shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="subject"
                                            tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                                        <Radar dataKey="score" stroke="#6366f1" fill="#6366f1"
                                            fillOpacity={0.15} strokeWidth={2}
                                            dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Sub-score bars */}
                        <div className="flex-1 w-full space-y-4">
                            {parsed.subScores.map(s => <SubScoreBar key={s.name} {...s} />)}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Section cards ── */}
            {parsed.sections
                .filter(s => s.number !== parsed.scoreSectionNum && SECTION_META[s.number])
                .map((s, idx) => (
                    <SectionCard
                        key={s.number}
                        number={s.number}
                        title={s.title}
                        content={s.content}
                        defaultOpen={true}
                    />
                ))
            }

            {/* ── Trading advice ── */}
            <TradingAdviceCard advice={parsed.tradingAdvice} />
        </div>
    );
}
