'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
    Bar,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Cell,
    Brush,
    Area,
    ReferenceLine,
    CartesianGrid,
} from 'recharts';
import { StockChartData } from '@/lib/providers/stock-provider';

interface StockChartProps {
    data: StockChartData[];
    color?: string;
    height?: number | string;
    interval?: string;
    showBollinger?: boolean;
    showMACD?: boolean;
    showRSI?: boolean;
}

export function StockChart({
    data,
    height = 400,
    interval = 'D',
    showBollinger = false,
    showMACD = false,
    showRSI = false
}: StockChartProps) {
    // State for Zoom/Pan
    const [range, setRange] = useState({ startIndex: 0, endIndex: 0 });
    const [isInitialized, setIsInitialized] = useState(false);

    // State for Crosshair Sequence
    const [focusData, setFocusData] = useState<{ x: number; y: number; price: number; date: string; payload: any } | null>(null);
    // Ref for chart height measurement
    const mainChartRef = useRef<HTMLDivElement>(null);

    // Initialize Range
    useEffect(() => {
        setIsInitialized(false);
    }, [interval]);

    useEffect(() => {
        if (data && data.length > 0) {
            const count = data.length;

            if (!isInitialized) {
                const viewSize = Math.min(count, 120); // Default to 120 candles
                setRange({
                    startIndex: Math.max(0, count - viewSize),
                    endIndex: count - 1
                });
                setIsInitialized(true);
            } else {
                // Data update (polling)
                // Ensure range is valid for new data dimensions
                setRange(prev => {
                    let { startIndex, endIndex } = prev;
                    if (endIndex >= count) endIndex = count - 1;
                    if (startIndex >= count) startIndex = Math.max(0, count - 120);
                    if (startIndex > endIndex) startIndex = Math.max(0, endIndex - 10);

                    // If bounds didn't essentially change (clamped), return prev to avoid re-render
                    if (startIndex === prev.startIndex && endIndex === prev.endIndex) return prev;
                    return { startIndex, endIndex };
                });
            }
        }
    }, [data, isInitialized]);

    // Calculate MA and processed data on FULL data
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Force Sort by Timestamp (Safety net against "scribble" charts)
        const sortedData = [...data].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        const closes = sortedData.map(d => d.close);

        const calcEMA = (values: number[], period: number) => {
            const result = new Array(values.length).fill(null);
            if (values.length < period) return result;
            const k = 2 / (period + 1);
            let sum = 0;
            for (let i = 0; i < period; i++) sum += values[i];
            result[period - 1] = sum / period;
            for (let i = period; i < values.length; i++) {
                result[i] = (values[i] * k) + (result[i - 1] * (1 - k));
            }
            return result;
        };

        const calcRSI = (values: number[], period = 14) => {
            const result = new Array(values.length).fill(null);
            if (values.length <= period) return result;
            let gains = 0, losses = 0;
            for (let i = 1; i <= period; i++) {
                const diff = values[i] - values[i - 1];
                if (diff >= 0) gains += diff; else losses += Math.abs(diff);
            }
            let avgGain = gains / period, avgLoss = losses / period;
            let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            result[period] = 100 - (100 / (1 + rs));
            for (let i = period + 1; i < values.length; i++) {
                const diff = values[i] - values[i - 1];
                const gain = diff >= 0 ? diff : 0;
                const loss = diff < 0 ? Math.abs(diff) : 0;
                avgGain = ((avgGain * (period - 1)) + gain) / period;
                avgLoss = ((avgLoss * (period - 1)) + loss) / period;
                rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                result[i] = 100 - (100 / (1 + rs));
            }
            return result;
        };

        const ema12 = calcEMA(closes, 12);
        const ema26 = calcEMA(closes, 26);
        const macdLine = closes.map((_, i) => (ema12[i] !== null && ema26[i] !== null) ? ema12[i] - ema26[i] : null);

        let firstValid = macdLine.findIndex(v => v !== null);
        let signalLine = new Array(closes.length).fill(null);
        if (firstValid !== -1) {
            const validMacds = macdLine.slice(firstValid) as number[];
            const validSignals = calcEMA(validMacds, 9);
            for (let i = 0; i < validSignals.length; i++) signalLine[firstValid + i] = validSignals[i];
        }

        const rsiArray = calcRSI(closes, 14);

        return sortedData.map((d, index, array) => {
            const getSMA = (n: number) => {
                if (index < n - 1) return null;
                const slice = array.slice(index - n + 1, index + 1);
                const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
                return sum / n;
            };

            const ma20 = getSMA(20);

            // Calculate Bollinger (20, 2)
            let bollUpper = null;
            let bollLower = null;
            let bollRange = null;

            if (ma20 !== null && index >= 19) {
                const slice = array.slice(index - 19, index + 1);
                const sumSq = slice.reduce((acc, curr) => acc + Math.pow(curr.close - ma20, 2), 0);
                const stdDev = Math.sqrt(sumSq / 20);
                bollUpper = ma20 + (stdDev * 2);
                bollLower = ma20 - (stdDev * 2);
                bollRange = [bollLower, bollUpper];
            }

            const prevClose = index > 0 ? array[index - 1].close : d.open;
            const change = d.close - prevClose;
            const changePercent = (change / prevClose) * 100;

            return {
                ...d,
                ma5: getSMA(5),
                ma20,
                ma60: getSMA(60),
                ma120: getSMA(120),
                bollRange,
                bollUpper,
                bollLower,
                candleRange: [d.low, d.high],
                volumeColor: d.close >= d.open ? '#ef4444' : '#3b82f6', // Fixed solid colors for Volume
                candleColor: d.close >= d.open ? '#ef4444' : '#3b82f6',
                change,
                changePercent,
                macd: (macdLine[index] !== null && signalLine[index] !== null) ? { value: macdLine[index], signal: signalLine[index], histogram: macdLine[index] - signalLine[index] } : null,
                rsi: rsiArray[index]
            };
        });
    }, [data]);

    // Slice Data for View
    const visibleData = useMemo(() => {
        if (!processedData || processedData.length === 0) return [];
        const start = Math.max(0, range.startIndex);
        const end = Math.min(processedData.length - 1, range.endIndex);
        const sliced = processedData.slice(start, end + 1);

        if (sliced.length === 0) return [];
        const minValue = Math.min(...sliced.map(d => d.low));
        const maxValue = Math.max(...sliced.map(d => d.high));
        // Strict padding for candles
        const padding = (maxValue - minValue) * 0.05;
        const domainMin = minValue - padding;
        const domainMax = maxValue + padding;

        return sliced.map(d => ({ ...d, domainMin, domainMax }));
    }, [processedData, range]);

    if (!data) return <div className="flex items-center justify-center h-full text-gray-500 text-xs bg-[#1e1e1e]">차트 데이터 대기 중...</div>;
    if (data.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-xs bg-[#1e1e1e]">데이터가 없습니다 (Symbol 확인 필요).</div>;

    const domainMin = visibleData[0]?.domainMin;
    const domainMax = visibleData[0]?.domainMax;

    // Determine Header Data (Focus or Last Item)
    const lastItem = visibleData[visibleData.length - 1];
    const headerData = focusData?.payload || lastItem;

    // Wheel Zoom Handler (Right Anchor)
    const handleWheel = (e: React.WheelEvent) => {
        if (!processedData.length) return;
        const delta = e.deltaY;
        const total = processedData.length;
        const currentLength = range.endIndex - range.startIndex + 1;
        const zoomSpeed = Math.max(1, Math.round(currentLength * 0.1));

        let newLength = currentLength;
        if (delta < 0) { // Zoom In
            newLength = Math.max(10, currentLength - zoomSpeed); // Min 10
        } else { // Zoom Out
            newLength = Math.min(total, currentLength + zoomSpeed);
        }

        // Anchor to Right (End Index)
        let newEnd = range.endIndex;
        let newStart = newEnd - newLength + 1;

        if (newStart < 0) {
            newStart = 0;
            // If zooming out hits left wall, newLength allows showing more if we shift end? 
            // Standard "Right Anchor": Don't shift end unless we have to?
            // Usually, if we hit start, we just stop zooming out or shift end? 
            // User wants "Recent Time" focus. So holding End is correct.
        }

        setRange({ startIndex: newStart, endIndex: newEnd });
    };

    const handleZoomIn = () => {
        const currentLength = range.endIndex - range.startIndex + 1;
        const newLength = Math.max(10, Math.floor(currentLength * 0.8));
        let newStart = range.endIndex - newLength + 1;
        if (newStart < 0) newStart = 0;
        setRange({ startIndex: newStart, endIndex: range.endIndex });
    };

    const handleZoomOut = () => {
        const total = processedData.length;
        const currentLength = range.endIndex - range.startIndex + 1;
        const newLength = Math.min(total, Math.ceil(currentLength * 1.2));
        let newStart = range.endIndex - newLength + 1;
        if (newStart < 0) newStart = 0;
        setRange({ startIndex: newStart, endIndex: range.endIndex });
    };

    const handleBrushChange = (newRange: any) => {
        if (newRange && typeof newRange.startIndex === 'number' && typeof newRange.endIndex === 'number') {
            setRange({ startIndex: newRange.startIndex, endIndex: newRange.endIndex });
        }
    };

    const handleMouseMove = (state: any) => {
        if (state && state.activeCoordinate && state.activePayload && state.activePayload.length > 0) {
            const chartArea = mainChartRef.current;
            let price = 0;
            if (chartArea && domainMax !== undefined && domainMin !== undefined) {
                const height = chartArea.clientHeight;
                const plotHeight = height - 15;
                const ratio = state.chartY / plotHeight;
                const r = domainMax - domainMin;
                price = domainMax - (ratio * r);
            }

            setFocusData({
                x: state.activeCoordinate.x,
                y: state.chartY,
                price: price,
                date: state.activePayload[0].payload.timestamp,
                payload: state.activePayload[0].payload
            });
        }
    };

    const handleMouseLeave = () => {
        setFocusData(null);
    };

    // Formatters
    const isMinute = interval.endsWith('m');
    const isTick = interval === '1s';

    const formatXAxis = (val: string) => {
        if (!val) return '';
        if (isMinute || isTick) {
            const timePart = val.split(/[ T]/)[1] || val; // Extract HH:mm:ss
            if (isTick) return timePart; // Return full HH:mm:ss for Tick
            return timePart.substring(0, 5); // Return HH:mm for Minute
        } else {
            return val.slice(5, 10); // MM-DD for Daily/Weekly/Monthly
        }
    };

    // Formatters
    const fmtNum = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n));
    const fmtPct = (n: number) => n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
    const getColor = (n: number) => n > 0 ? 'text-red-500' : (n < 0 ? 'text-blue-500' : 'text-gray-400');

    return (
        <div
            className="flex flex-col w-full h-full relative select-none bg-[#1e1e1e]" // Darker BG like HTS
            style={{ minHeight: height === '100%' ? 0 : (typeof height === 'number' ? height : 400) }}
            onWheel={handleWheel}
        >
            {/* HTS Style Header Info Bar */}
            {headerData && (
                <div className="flex items-center space-x-4 px-2 py-1 text-xs border-b border-gray-800 bg-[#252526] text-gray-300 font-mono">
                    <span className="text-gray-400">{headerData.timestamp}</span>
                    <div className="flex space-x-1">
                        <span className="text-gray-500">시</span>
                        <span className={getColor(headerData.open - (headerData.close - headerData.change))}>{fmtNum(headerData.open)}</span>
                    </div>
                    <div className="flex space-x-1">
                        <span className="text-gray-500">고</span>
                        <span className={getColor(headerData.high - (headerData.close - headerData.change))}>{fmtNum(headerData.high)}</span>
                    </div>
                    <div className="flex space-x-1">
                        <span className="text-gray-500">저</span>
                        <span className={getColor(headerData.low - (headerData.close - headerData.change))}>{fmtNum(headerData.low)}</span>
                    </div>
                    <div className="flex space-x-1">
                        <span className="text-gray-500">종</span>
                        <span className={`font-bold ${getColor(headerData.change)}`}>{fmtNum(headerData.close)}</span>
                    </div>
                    <div className="flex space-x-1">
                        <span className={getColor(headerData.change)}>{headerData.change > 0 ? '▲' : (headerData.change < 0 ? '▼' : '-')} {Math.abs(headerData.change)} ({fmtPct(headerData.changePercent)})</span>
                    </div>

                    {/* MA Values Header */}
                    <div className="flex space-x-3 ml-4 border-l border-gray-700 pl-4 hidden sm:flex">
                        <span className="text-[#60a5fa]">5: {headerData.ma5 ? fmtNum(headerData.ma5) : '-'}</span>
                        <span className="text-[#2563eb] font-bold">20: {headerData.ma20 ? fmtNum(headerData.ma20) : '-'}</span>
                        <span className="text-[#60a5fa]">60: {headerData.ma60 ? fmtNum(headerData.ma60) : '-'}</span>
                        <span className="text-[#9ca3af]">120: {headerData.ma120 ? fmtNum(headerData.ma120) : '-'}</span>
                    </div>

                    <div className="flex space-x-1 ml-auto">
                        <span className="text-gray-500">거래량</span>
                        <span className="text-white">{fmtNum(headerData.volume)}</span>
                    </div>
                </div>
            )}

            {/* Zoom Buttons Overlay */}
            <div className="absolute top-10 right-14 z-20 flex flex-col gap-1">
                <button
                    onClick={handleZoomIn}
                    className="w-6 h-6 bg-gray-700/80 hover:bg-gray-600 text-white rounded flex items-center justify-center text-lg leading-none border border-gray-600"
                    title="확대 (최근 기준)"
                >
                    +
                </button>
                <button
                    onClick={handleZoomOut}
                    className="w-6 h-6 bg-gray-700/80 hover:bg-gray-600 text-white rounded flex items-center justify-center text-lg leading-none border border-gray-600"
                    title="축소 (최근 기준)"
                >
                    -
                </button>
            </div>

            {/* MAIN CHART */}
            <div className={`flex-1 min-h-0 relative`} ref={mainChartRef}>
                {/* Crosshair Lines */}
                {focusData && (
                    <>
                        <div className="absolute w-full border-t border-gray-500 border-dotted pointer-events-none z-10 opacity-50" style={{ top: focusData.y }} />
                        <div className="absolute h-full border-l border-gray-500 border-dotted pointer-events-none z-10 opacity-50" style={{ left: focusData.x }} />
                    </>
                )}

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={visibleData}
                        margin={{ top: 10, right: 0, bottom: 5, left: 0 }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        syncId="stockChartSync"
                    >
                        {/* HTS Style Grid */}
                        <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={true} horizontal={true} />

                        <YAxis
                            yAxisId="price"
                            width={55}
                            domain={[domainMin, domainMax]}
                            orientation="right"
                            tick={{ fontSize: 11, fill: '#9ca3af' }}
                            tickFormatter={(val) => new Intl.NumberFormat('en-US').format(val)}
                            stroke="#374151"
                            tickCount={8}
                        />
                        <XAxis dataKey="timestamp" hide={true} />

                        {/* Standard Tooltip Hidden, using Header */}
                        <Tooltip content={<></>} cursor={false} />

                        {/* Bollinger Bands */}
                        {/* Bollinger Bands */}
                        {showBollinger && (
                            <>
                                <Area
                                    yAxisId="price"
                                    dataKey="bollRange"
                                    stroke="none"
                                    fill="#c084fc"
                                    fillOpacity={0.08}
                                    isAnimationActive={false}
                                />
                                <Line type="monotone" dataKey="bollUpper" yAxisId="price" stroke="#c084fc" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
                                <Line type="monotone" dataKey="bollLower" yAxisId="price" stroke="#c084fc" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
                            </>
                        )}

                        {/* Candles */}
                        <Bar
                            dataKey="candleRange"
                            yAxisId="price"
                            isAnimationActive={false}
                            minPointSize={2}
                            shape={(props: any) => {
                                const { x, y, width, height, payload } = props;
                                const { open, close, high, low } = payload;
                                const range = high - low;
                                if (range <= 0 || height <= 0) return <g />;

                                const pixelsPerUnit = height / range;
                                const yOpen = y + (high - open) * pixelsPerUnit;
                                const yClose = y + (high - close) * pixelsPerUnit;
                                const isRising = close >= open;
                                const color = isRising ? '#ef4444' : '#3b82f6';

                                const bodyTop = Math.min(yOpen, yClose);
                                const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));
                                const candleWidth = Math.max(3, width * 0.7);
                                const candleX = x + (width - candleWidth) / 2;

                                return (
                                    <g>
                                        <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth={1} />
                                        <rect x={candleX} y={Math.floor(bodyTop)} width={candleWidth} height={Math.max(1, Math.floor(bodyHeight))} fill={color} stroke={color} />
                                    </g>
                                );
                            }}
                        >
                            {visibleData.map((entry, index) => (
                                <Cell key={`candle-${index}`} fill={entry.candleColor} />
                            ))}
                        </Bar>

                        {/* Moving Averages - Custom Colors */}
                        <Line type="monotone" dataKey="ma5" yAxisId="price" stroke="#60a5fa" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />{/* 5: Light Blue */}
                        <Line type="monotone" dataKey="ma20" yAxisId="price" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />{/* 20: Strong Blue */}
                        <Line type="monotone" dataKey="ma60" yAxisId="price" stroke="#60a5fa" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />{/* 60: Light Blue */}
                        <Line type="monotone" dataKey="ma120" yAxisId="price" stroke="#9ca3af" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />{/* 120: Gray */}

                    </ComposedChart>
                </ResponsiveContainer>

                {/* Y-Axis Price Badge */}
                {focusData && (
                    <div className="absolute right-0 bg-gray-700 text-white text-[11px] px-1 py-0.5 rounded-l-sm pointer-events-none transform -translate-y-1/2 z-10 font-mono" style={{ top: focusData.y }}>
                        {new Intl.NumberFormat('en-US').format(Math.round(focusData.price))}
                    </div>
                )}
            </div>

            {/* VOLUME & NAVIGATOR (Always Visible) */}
            <div className="h-[80px] border-t border-gray-700 relative bg-[#1e1e1e]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={visibleData} // Use visibleData for Volume Bars
                        margin={{ top: 5, right: 0, bottom: 5, left: 0 }}
                        syncId="stockChartSync"
                    >
                        <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={true} horizontal={false} />
                        <YAxis yAxisId="volume" width={55} orientation="right" tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#374151" tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(val)} />
                        <XAxis
                            dataKey="timestamp"
                            hide={showMACD || showRSI}
                            stroke="#374151"
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickFormatter={formatXAxis}
                            minTickGap={30}
                        />
                        <Tooltip content={<></>} cursor={false} />

                        <Bar dataKey="volume" yAxisId="volume" barSize={visibleData.length > 100 ? 2 : 4} isAnimationActive={false}>
                            {visibleData.map((entry, index) => (
                                <Cell key={`vol-${index}`} fill={entry.volumeColor} />
                            ))}
                        </Bar>

                    </ComposedChart>
                </ResponsiveContainer>

                {/* Crosshair Date Badge */}
                {!showMACD && !showRSI && focusData && (
                    <div className="absolute bottom-0 bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded-sm pointer-events-none transform -translate-x-1/2 z-10 font-mono" style={{ left: focusData.x }}>
                        {formatXAxis(focusData.date)}
                    </div>
                )}
            </div>

            {/* NAVIGATOR */}
            <div className="h-[30px] border-t border-gray-800 bg-[#121212]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={processedData} margin={{ top: 0, left: 0, bottom: 0, right: 0 }}>
                        <Bar dataKey="close" fill="#333" isAnimationActive={false} />
                        <Brush
                            dataKey="timestamp"
                            height={30}
                            stroke="#555"
                            fill="#222"
                            tickFormatter={() => ""}
                            onChange={handleBrushChange}
                            startIndex={range.startIndex}
                            endIndex={range.endIndex}
                            alwaysShowText={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* MACD SUB-CHART */}
            {showMACD && (
                <div className="h-[100px] border-t border-gray-700 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={visibleData}
                            margin={{ top: 5, right: 0, bottom: 5, left: 0 }}
                            syncId="stockChartSync"
                        >
                            <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                            <YAxis width={55} orientation="right" tick={{ fontSize: 10, fill: '#6b7280' }} stroke="#374151" />
                            <XAxis dataKey="timestamp" hide={showRSI} stroke="#374151" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={formatXAxis} minTickGap={30} />
                            <Tooltip content={<></>} cursor={false} />

                            <Bar dataKey="macd.histogram" fill="#9ca3af" barSize={2}>
                                {visibleData.map((entry, index) => (
                                    <Cell key={`hist-${index}`} fill={entry.macd && entry.macd.histogram > 0 ? '#ef4444' : '#3b82f6'} />
                                ))}
                            </Bar>
                            <Line type="monotone" dataKey="macd.value" stroke="#ef4444" dot={false} strokeWidth={1} isAnimationActive={false} />
                            <Line type="monotone" dataKey="macd.signal" stroke="#fbbf24" dot={false} strokeWidth={1} isAnimationActive={false} />

                        </ComposedChart>
                    </ResponsiveContainer>
                    {!showRSI && focusData && (
                        <div className="absolute bottom-0 bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded-sm pointer-events-none transform -translate-x-1/2 z-10 font-mono" style={{ left: focusData.x }}>
                            {formatXAxis(focusData.date)}
                        </div>
                    )}
                </div>
            )}

            {/* RSI SUB-CHART */}
            {showRSI && (
                <div className="h-[100px] border-t border-gray-700 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={visibleData}
                            margin={{ top: 5, right: 0, bottom: 5, left: 0 }}
                            syncId="stockChartSync"
                        >
                            <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                            <YAxis width={55} orientation="right" tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 100]} ticks={[30, 70]} stroke="#374151" />
                            <XAxis dataKey="timestamp" stroke="#374151" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={formatXAxis} minTickGap={30} />
                            <Tooltip content={<></>} cursor={false} />

                            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
                            <ReferenceLine y={30} stroke="#3b82f6" strokeDasharray="3 3" />

                            <Line type="monotone" dataKey="rsi" stroke="#06b6d4" dot={false} strokeWidth={1.5} isAnimationActive={false} />

                        </ComposedChart>
                    </ResponsiveContainer>
                    {focusData && (
                        <div className="absolute bottom-0 bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded-sm pointer-events-none transform -translate-x-1/2 z-10 font-mono" style={{ left: focusData.x }}>
                            {formatXAxis(focusData.date)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
