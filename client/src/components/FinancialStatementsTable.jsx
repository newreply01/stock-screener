import React from 'react';

export default function FinancialStatementsTable({ data, title, type }) {
    if (!data || data.length === 0) {
        return (
            <div className="p-12 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                暫無 {title} 數據
            </div>
        );
    }

    // Sort by date descending
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group unique items (accounts)
    const accounts = Array.from(new Set(sortedData.map(d => d.item)));
    const dates = Array.from(new Set(sortedData.map(d => d.date))).sort((a, b) => new Date(b) - new Date(a));

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-50/30 border-b border-slate-100">
                            <th className="px-6 py-4 font-bold text-slate-600 sticky left-0 bg-slate-50/30 z-10 backdrop-blur-sm">項目 \ 日期</th>
                            {dates.map(date => (
                                <th key={date} className="px-6 py-4 font-bold text-slate-600">
                                    {new Date(date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit' })}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {accounts.map(account => (
                            <tr key={account} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-3.5 font-bold text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                    {account}
                                </td>
                                {dates.map(date => {
                                    const entry = sortedData.find(d => d.date === date && d.item === account);
                                    const value = entry ? parseFloat(entry.value) : null;
                                    return (
                                        <td key={`${date}-${account}`} className="px-6 py-3.5 font-medium text-slate-600">
                                            {value !== null ? (value / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '--'}
                                            {value !== null && <span className="text-[10px] text-slate-400 ml-1">M</span>}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="px-6 py-3 bg-slate-50/50 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-right">
                單位：百萬元 (Millions TWD)
            </div>
        </div>
    );
}
