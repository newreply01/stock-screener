import React, { useState, useEffect } from 'react';
import { getMarketMargin } from '../utils/api';
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Activity, AlertCircle } from 'lucide-react';

export default function MarketMarginChart() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await getMarketMargin();
                if (res.success && res.data) {
                    // Process data: convert margin to hundred-millions (億)
                    const processed = res.data.map((d, i) => {
                        // Mock an index price since we lack historical TAIEX data currently.
                        // Create a slight wave around 23000 to 24000 depending on index
                        const mockPrice = 23000 + (Math.sin(i * 0.3) * 500) + (i * 10);

                        return {
                            ...d,
                            margin100M: d.marginBalance ? parseFloat((d.marginBalance / 100000000).toFixed(2)) : 0,
                            mockIndex: mockPrice
                        };
                    });
                    setData(processed);
                }
            } catch (err) {
                console.error('Fetch market margin failed', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-80 bg-white/50 rounded-2xl border border-gray-100 animate-pulse mb-6">
                <Activity className="w-8 h-8 text-brand-primary mb-2 opacity-50" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">載入融資餘額...</span>
            </div>
        );
    }

    if (!data || data.length === 0) return null;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-xl">
                    <p className="text-sm font-bold text-gray-800 mb-2">{label}</p>
                    {payload.map((entry, idx) => (
                        <p key={idx} className="text-xs font-semibold" style={{ color: entry.color }}>
                            {entry.name}: {entry.name === '融資餘額(億)' ? `${entry.value}億` : Math.round(entry.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-500" />
                    大盤融資融券餘額
                    <AlertCircle className="w-4 h-4 text-gray-400 cursor-help" />
                </h3>
            </div>

            <div className="h-80 w-full relative group">
                {/* 加上一個說明浮水印因為是大盤模擬價格 */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-300 pointer-events-none font-bold select-none z-10">
                    * 註: 大盤指數曲線目前為展圖目的之模擬數值
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            tickMargin={10}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={30}
                        />
                        {/* 左 Y 軸：大盤指數 */}
                        <YAxis
                            yAxisId="left"
                            domain={['auto', 'auto']}
                            tick={{ fill: '#ef4444', fontSize: 10, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                            width={50}
                            dx={-5}
                            tickFormatter={(v) => Math.round(v)}
                        />
                        {/* 右 Y 軸：融資餘額 */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={['auto', 'auto']}
                            tick={{ fill: '#1e40af', fontSize: 10, fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                            width={50}
                            dx={5}
                            tickFormatter={(v) => `${Math.round(v)}`}
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }} />

                        <Bar
                            yAxisId="right"
                            dataKey="margin100M"
                            name="融資餘額(億)"
                            fill="#3b82f6"
                            barSize={12}
                            radius={[2, 2, 0, 0]}
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="mockIndex"
                            name="大盤指數"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
