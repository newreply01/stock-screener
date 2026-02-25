import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import {
    SMA, RSI, MACD,
    bullishengulfingpattern,
    bearishengulfingpattern,
    bullishhammerstick,
    hangingman,
    morningstar,
    eveningstar,
    threewhitesoldiers,
    threeblackcrows,
    piercingline,
} from 'technicalindicators';
import { getHistory } from '../utils/api';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function StockChart({ stock, period = '日K', onPatternsDetected, onIndicatorStatus }) {
    const mainChartRef = useRef();
    const rsiChartRef = useRef();
    const macdChartRef = useRef();
    const [loading, setLoading] = useState(true);
    const [detectedPatterns, setDetectedPatterns] = useState([]);
    const mainChartInstance = useRef(null);
    const rsiChartInstance = useRef(null);
    const macdChartInstance = useRef(null);

    useEffect(() => {
        if (onPatternsDetected) {
            onPatternsDetected(detectedPatterns);
        }
    }, [detectedPatterns, onPatternsDetected]);

    useEffect(() => {
        if (!stock || !stock.symbol) return;

        let isMounted = true;

        const renderCharts = async () => {
            setLoading(true);
            try {
                let rawData = await getHistory(stock.symbol, 1000); // 獲取更多數據以支持週期轉換
                if (!isMounted || !rawData.length) {
                    setLoading(false);
                    return;
                }

                // --- Data Aggregation ---
                const aggregateData = (data, p) => {
                    if (p === '日K') return data;
                    const result = [];
                    let current = null;

                    data.forEach((d, idx) => {
                        const date = new Date(d.time);
                        let key;
                        if (p === '週K') {
                            // 使用本地時間計算週一
                            const day = date.getDay();
                            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                            const monday = new Date(date);
                            monday.setDate(diff);
                            key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
                        } else {
                            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
                        }

                        if (!current || current.time !== key) {
                            if (current) result.push(current);
                            current = {
                                time: key,
                                open: d.open,
                                high: d.high,
                                low: d.low,
                                close: d.close,
                                volume: Number(d.volume)
                            };
                        } else {
                            current.high = Math.max(current.high, d.high);
                            current.low = Math.min(current.low, d.low);
                            current.close = d.close;
                            current.volume += Number(d.volume);
                        }
                    });
                    if (current) result.push(current);
                    return result;
                };

                const processedData = aggregateData(rawData, period);

                const candleData = processedData.map(d => ({
                    time: d.time,
                    open: parseFloat(d.open),
                    high: parseFloat(d.high),
                    low: parseFloat(d.low),
                    close: parseFloat(d.close),
                }));

                const volumeData = processedData.map(d => ({
                    time: d.time,
                    value: Number(d.volume),
                    color: parseFloat(d.open) > parseFloat(d.close) ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'
                }));

                const closes = candleData.map(d => d.close);
                const opens = candleData.map(d => d.open);
                const highs = candleData.map(d => d.high);
                const lows = candleData.map(d => d.low);

                // --- Pattern Detection (Historical Markers & Latest) ---
                const markers = [];
                const latestPatterns = [];

                if (candleData.length >= 3) {
                    for (let i = 2; i < candleData.length; i++) {
                        const input = {
                            open: opens.slice(i - 2, i + 1),
                            high: highs.slice(i - 2, i + 1),
                            low: lows.slice(i - 2, i + 1),
                            close: closes.slice(i - 2, i + 1)
                        };
                        const time = candleData[i].time;
                        const isLatest = i === candleData.length - 1;

                        const patternsFound = [];
                        if (bullishengulfingpattern(input)) patternsFound.push({ name: '吞噬型態', type: 'bullish' });
                        if (bearishengulfingpattern(input)) patternsFound.push({ name: '空頭吞噬', type: 'bearish' });
                        if (bullishhammerstick(input)) patternsFound.push({ name: '鎚子線', type: 'bullish' });
                        if (hangingman(input)) patternsFound.push({ name: '上吊線', type: 'bearish' });
                        if (morningstar(input)) patternsFound.push({ name: '晨星', type: 'bullish' });
                        if (eveningstar(input)) patternsFound.push({ name: '夜星', type: 'bearish' });
                        if (threewhitesoldiers(input)) patternsFound.push({ name: '紅三兵', type: 'bullish' });
                        if (threeblackcrows(input)) patternsFound.push({ name: '三隻烏鴉', type: 'bearish' });
                        if (piercingline(input)) patternsFound.push({ name: '貫穿/烏雲', type: 'neutral' });

                        patternsFound.forEach(p => {
                            if (p.type === 'bullish') {
                                markers.push({ time, position: 'belowBar', color: '#ef4444', shape: 'arrowUp', text: p.name });
                            } else {
                                markers.push({ time, position: 'aboveBar', color: '#22c55e', shape: 'arrowDown', text: p.name });
                            }
                            if (isLatest) {
                                latestPatterns.push(p);
                            }
                        });
                    }
                }
                setDetectedPatterns(latestPatterns);
                if (onPatternsDetected) {
                    onPatternsDetected(latestPatterns);
                }

                // --- Indicators Calculation ---
                const ma20Data = [];
                if (closes.length >= 20) {
                    const ma20Result = SMA.calculate({ period: 20, values: closes });
                    const maOffset = closes.length - ma20Result.length;
                    for (let i = 0; i < ma20Result.length; i++) {
                        ma20Data.push({ time: candleData[i + maOffset].time, value: ma20Result[i] });
                    }
                }

                const rsiData = [];
                if (closes.length >= 14) {
                    const rsiResult = RSI.calculate({ period: 14, values: closes });
                    const rsiOffset = closes.length - rsiResult.length;
                    for (let i = 0; i < rsiResult.length; i++) {
                        rsiData.push({ time: candleData[i + rsiOffset].time, value: rsiResult[i] });
                    }
                }

                const macdData = { macd: [], signal: [], histogram: [] };
                if (closes.length >= 26) {
                    const macdResult = MACD.calculate({
                        values: closes,
                        fastPeriod: 12,
                        slowPeriod: 26,
                        signalPeriod: 9,
                        SimpleMAOscillator: false,
                        SimpleMASignal: false
                    });
                    const macdOffset = closes.length - macdResult.length;
                    for (let i = 0; i < macdResult.length; i++) {
                        const time = candleData[i + macdOffset].time;
                        macdData.macd.push({ time, value: macdResult[i].MACD });
                        macdData.signal.push({ time, value: macdResult[i].signal });
                        macdData.histogram.push({
                            time,
                            value: macdResult[i].histogram,
                            color: macdResult[i].histogram >= 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'
                        });
                    }
                }

                const lastIdx = candleData.length - 1;
                if (onIndicatorStatus && lastIdx >= 0) {
                    onIndicatorStatus({
                        rsi: rsiData.length ? rsiData[rsiData.length - 1].value : null,
                        macd: macdData.macd.length ? macdData.macd[macdData.macd.length - 1].value : null,
                        ma20: ma20Data.length ? ma20Data[ma20Data.length - 1].value : null,
                        close: candleData[lastIdx].close
                    });
                }

                // Cleanup existing
                if (mainChartInstance.current) mainChartInstance.current.remove();
                if (rsiChartInstance.current) rsiChartInstance.current.remove();
                if (macdChartInstance.current) macdChartInstance.current.remove();

                const commonOptions = {
                    layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#64748b', fontSize: 10 },
                    grid: { vertLines: { color: '#f8fafc' }, horzLines: { color: '#f8fafc' } },
                    rightPriceScale: { borderColor: '#f1f5f9', width: 60, borderVisible: false },
                    timeScale: { borderColor: '#f1f5f9', borderVisible: false },
                    handleScroll: true,
                    handleScale: true,
                    crosshair: { mode: 1 },
                };

                // Create Main Chart
                const mainChart = createChart(mainChartRef.current, { ...commonOptions, height: 260 });
                const candleSeries = mainChart.addSeries(CandlestickSeries, {
                    upColor: '#ef4444', downColor: '#22c55e', borderDownColor: '#22c55e',
                    borderUpColor: '#ef4444', wickDownColor: '#22c55e', wickUpColor: '#ef4444',
                });
                candleSeries.setData(candleData);
                if (markers.length > 0) {
                    candleSeries.setMarkers(markers);
                }

                const maSeries = mainChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'MA20' });
                maSeries.setData(ma20Data);

                const volumeSeries = mainChart.addSeries(HistogramSeries, {
                    priceFormat: { type: 'volume' }, priceScaleId: '',
                    scaleMargins: { top: 0.8, bottom: 0 }
                });
                volumeSeries.setData(volumeData);

                // Create RSI Chart
                const rsiChart = createChart(rsiChartRef.current, {
                    ...commonOptions,
                    height: 100,
                    timeScale: { ...commonOptions.timeScale, visible: false },
                });
                const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, title: 'RSI(14)' });
                rsiSeries.setData(rsiData);
                rsiSeries.createPriceLine({ price: 70, color: '#fca5a5', lineWidth: 1, lineStyle: 2, title: '70' });
                rsiSeries.createPriceLine({ price: 30, color: '#86efac', lineWidth: 1, lineStyle: 2, title: '30' });

                // Create MACD Chart
                const macdChart = createChart(macdChartRef.current, {
                    ...commonOptions,
                    height: 120,
                    timeScale: { ...commonOptions.timeScale, visible: false },
                });
                const macdLineSeries = macdChart.addSeries(LineSeries, { color: '#2563eb', lineWidth: 1, title: 'MACD' });
                macdLineSeries.setData(macdData.macd);
                const signalLineSeries = macdChart.addSeries(LineSeries, { color: '#f97316', lineWidth: 1, title: 'Signal' });
                signalLineSeries.setData(macdData.signal);
                const histSeries = macdChart.addSeries(HistogramSeries, { title: 'Hist' });
                histSeries.setData(macdData.histogram);

                // Sync Scrolling & Scaling
                const charts = [mainChart, rsiChart, macdChart];
                charts.forEach(c => {
                    c.timeScale().subscribeVisibleLogicalRangeChange(range => {
                        charts.filter(other => other !== c).forEach(other => {
                            other.timeScale().setVisibleLogicalRange(range);
                        });
                    });
                });

                mainChartInstance.current = mainChart;
                rsiChartInstance.current = rsiChart;
                macdChartInstance.current = macdChart;

                const handleResize = () => {
                    const width = mainChartRef.current?.clientWidth;
                    if (width) {
                        mainChart.applyOptions({ width });
                        rsiChart.applyOptions({ width });
                        macdChart.applyOptions({ width });
                    }
                };
                window.addEventListener('resize', handleResize);

            } catch (err) {
                console.error('Render charts error:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        renderCharts();

        return () => {
            isMounted = false;
            if (mainChartInstance.current) mainChartInstance.current.remove();
            if (rsiChartInstance.current) rsiChartInstance.current.remove();
            if (macdChartInstance.current) macdChartInstance.current.remove();
        };
    }, [stock, period]);

    if (!stock) return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 min-h-[500px]">
            <p className="font-bold text-lg text-slate-500 italic">Advanced Analytics Dashboard</p>
            <p className="text-sm mt-1">Select a stock to perform deep technical analysis</p>
        </div>
    );

    return (
        <div className="w-full flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-4">
                    <div className="bg-brand-primary w-2 h-8 rounded-full shadow-sm shadow-brand-primary/20"></div>
                    <div>
                        <h3 className="font-black text-slate-800 text-xl tracking-tight leading-none">
                            {stock.name} <span className="text-slate-400 font-bold ml-1 text-base">({stock.symbol})</span>
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">MA20</span>
                            <span className="text-[9px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">RSI</span>
                            <span className="text-[9px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">MACD</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-2xl font-black text-slate-800 tracking-tighter">
                        {parseFloat(stock.close_price).toFixed(2)}
                    </div>
                    <div className={`text-sm font-black flex items-center justify-end gap-1 ${parseFloat(stock.change_percent) >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {parseFloat(stock.change_percent) >= 0 ? '▲' : '▼'}{Math.abs(parseFloat(stock.change_percent)).toFixed(2)}%
                    </div>
                </div>
            </div>

            <div className="relative w-full p-4 space-y-4 bg-white/50">
                {loading && (
                    <div className="absolute inset-0 z-20 bg-white/95 flex flex-col items-center justify-center backdrop-blur-sm">
                        <div className="relative">
                            <Loader2 className="w-12 h-12 animate-spin text-brand-primary" />
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-brand-primary">API</div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 mt-4 tracking-[0.3em] uppercase animate-pulse">Computing Indicators...</span>
                    </div>
                )}

                {/* Patterns Detected Banner */}
                {detectedPatterns.length > 0 && (
                    <div className="flex items-center gap-3 bg-brand-primary/5 border border-brand-primary/10 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                        <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-bold text-slate-600 tracking-tight">K線型態偵測(最新):</span>
                            {detectedPatterns.map((p, idx) => (
                                <span key={idx} className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${p.type === 'bullish' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                    {p.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <div className="relative">
                        <div ref={mainChartRef} className="w-full" />
                        <div className="absolute top-2 left-2 pointer-events-none">
                            <span className="text-[10px] font-bold text-slate-400 bg-white/80 px-2 py-0.5 rounded border border-slate-100 uppercase">Daily Candlestick</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative border border-slate-100 rounded-xl overflow-hidden bg-slate-50/20">
                            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 uppercase tracking-tighter">Relative Strength (RSI)</span>
                            </div>
                            <div ref={rsiChartRef} className="w-full" />
                        </div>

                        <div className="relative border border-slate-100 rounded-xl overflow-hidden bg-slate-50/20">
                            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-tighter">Convergence Divergence (MACD)</span>
                            </div>
                            <div ref={macdChartRef} className="w-full" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></div>
                        <span className="font-extrabold text-slate-600 uppercase tracking-tighter">EMA Fast/Slow (12, 26)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm"></div>
                        <span className="font-extrabold text-slate-600 uppercase tracking-tighter">momentum Oscillator (14)</span>
                    </div>
                </div>
                <div className="font-bold text-slate-400 italic tracking-tight text-right">
                    Inter-chart synchronization active. Pan or zoom any chart to adjust all perspectives.
                </div>
            </div>
        </div>
    );
}
