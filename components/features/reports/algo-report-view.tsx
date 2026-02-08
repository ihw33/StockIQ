"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { parseAlgoReport, ParsedAlgoReport, ParsedTimeframe, ParsedIndicator } from '@/lib/utils/parse-algo-report';

const TIMEFRAME_COLORS: Record<string, { border: string; bg: string; text: string }> = {
    '주봉': { border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
    '일봉': { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    '15분봉': { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
    '5분봉': { border: 'border-l-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
};

function StatusBadge({ status, children }: { status: 'bullish' | 'bearish' | 'neutral'; children: React.ReactNode }) {
    const colors = {
        bullish: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        bearish: 'bg-red-100 text-red-800 border-red-200',
        neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
            {children}
        </span>
    );
}

function PriceBox({ label, value, variant }: { label: string; value: string; variant: 'entry' | 'stop' | 'target' }) {
    const styles = {
        entry: 'bg-blue-50 border-blue-200 text-blue-900',
        stop: 'bg-red-50 border-red-200 text-red-900',
        target: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    };
    const icons = { entry: '📥', stop: '⛔', target: '🎯' };
    return (
        <div className={`flex flex-col items-center p-3 rounded-lg border ${styles[variant]}`}>
            <span className="text-xs text-gray-500 mb-1">{icons[variant]} {label}</span>
            <span className="font-bold text-sm">{value}</span>
        </div>
    );
}

function IndicatorChip({ indicator }: { indicator: ParsedIndicator }) {
    const colors = {
        bullish: 'bg-emerald-50 text-emerald-700',
        bearish: 'bg-red-50 text-red-700',
        neutral: 'bg-gray-50 text-gray-600',
    };
    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${colors[indicator.status]}`}>
            <span className="font-medium text-gray-500">{indicator.name}</span>
            <span className="font-bold">{indicator.value}</span>
            {indicator.icon && <span>{indicator.icon}</span>}
        </div>
    );
}

function VolatilityStrip({ days }: { days: ParsedAlgoReport['volatility']['days'] }) {
    const statusColors = {
        surge: 'bg-emerald-500 text-white',
        up: 'bg-emerald-100 text-emerald-800',
        flat: 'bg-gray-100 text-gray-600',
        down: 'bg-red-100 text-red-800',
        crash: 'bg-red-500 text-white',
    };
    return (
        <div className="flex gap-2">
            {days.map((day, i) => (
                <div key={i} className={`flex-1 p-2.5 rounded-lg text-center ${statusColors[day.status]}`}>
                    <div className="text-[10px] opacity-70">{day.date.slice(5)}</div>
                    <div className="text-sm font-bold">{day.changePct > 0 ? '+' : ''}{day.changePct.toFixed(1)}%</div>
                    <div className="text-[10px] opacity-70">{day.volumeRatio}</div>
                </div>
            ))}
        </div>
    );
}

function TimeframeCard({ tf }: { tf: ParsedTimeframe }) {
    const colors = TIMEFRAME_COLORS[tf.name] || TIMEFRAME_COLORS['일봉'];

    return (
        <div className={`border-l-4 ${colors.border} bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden`}>
            {/* Header */}
            <div className={`px-4 py-3 ${colors.bg} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    <span className="text-lg">{tf.icon}</span>
                    <div>
                        <h4 className={`font-bold text-sm ${colors.text}`}>{tf.name}</h4>
                        <p className="text-xs text-gray-500">{tf.subtitle}</p>
                    </div>
                </div>
                <StatusBadge status={tf.trendStatus}>{tf.trend}</StatusBadge>
            </div>

            {/* Indicators */}
            <div className="px-4 py-3">
                {tf.indicators.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {tf.indicators.map((ind, i) => (
                            <IndicatorChip key={i} indicator={ind} />
                        ))}
                    </div>
                ) : null}

                {/* Strategy */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</span>
                    <StatusBadge status={tf.strategyStatus}>{tf.strategy}</StatusBadge>
                </div>

                {/* Prices */}
                {(tf.entry || tf.stopLoss || tf.target) && (
                    <div className="grid grid-cols-3 gap-2">
                        {tf.entry && <PriceBox label="진입" value={tf.entry} variant="entry" />}
                        {tf.stopLoss && <PriceBox label="손절" value={tf.stopLoss} variant="stop" />}
                        {tf.target && <PriceBox label="목표" value={tf.target} variant="target" />}
                    </div>
                )}

                {tf.extra && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        {tf.extra}
                    </div>
                )}
            </div>
        </div>
    );
}

interface AlgoReportViewProps {
    analysis: string;
}

export function AlgoReportView({ analysis }: AlgoReportViewProps) {
    const parsed = parseAlgoReport(analysis);

    // If parsing produced no useful data, fallback to raw markdown
    if (!parsed.timeframes.length && !parsed.volatility.days.length) {
        return (
            <div className="prose prose-gray max-w-none">
                <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                    ⚡ 기술적 분석
                </h2>
                {parsed.currentPrice && (
                    <span className="text-lg font-bold text-gray-900">
                        현재가 {parsed.currentPrice}
                    </span>
                )}
            </div>

            {/* Stress Alert */}
            {parsed.stressAlert && (
                <div className={`p-4 rounded-lg border ${
                    parsed.stressAlert.level === 'EXTREME' ? 'bg-red-50 border-red-300' :
                    parsed.stressAlert.level === 'HIGH' ? 'bg-orange-50 border-orange-300' :
                    'bg-yellow-50 border-yellow-300'
                }`}>
                    <div className="flex items-center gap-2 font-bold text-sm mb-2">
                        {parsed.stressAlert.icon} 시장 스트레스: {parsed.stressAlert.level} ({parsed.stressAlert.score}/100)
                    </div>
                    {parsed.stressAlert.reasons.map((r, i) => (
                        <div key={i} className="text-sm text-gray-700">- {r}</div>
                    ))}
                </div>
            )}

            {/* 5-Day Volatility */}
            {parsed.volatility.days.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        최근 5일 변동
                    </h3>
                    <VolatilityStrip days={parsed.volatility.days} />
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {parsed.volatility.cumulativeChange && (
                            <span>누적: <b className="text-gray-700">{parsed.volatility.cumulativeChange}</b></span>
                        )}
                        {parsed.volatility.avgDaily && (
                            <span>평균: <b className="text-gray-700">{parsed.volatility.avgDaily}</b></span>
                        )}
                        {parsed.volatility.level && (
                            <StatusBadge status={
                                parsed.volatility.level === 'HIGH' ? 'bearish' :
                                parsed.volatility.level === 'LOW' ? 'bullish' : 'neutral'
                            }>
                                {parsed.volatility.level}
                            </StatusBadge>
                        )}
                    </div>
                </div>
            )}

            {/* Smart Summary */}
            {parsed.smartSummary.recommendation && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{parsed.smartSummary.icon}</span>
                        <span className="text-lg font-bold text-gray-900">{parsed.smartSummary.recommendation}</span>
                    </div>
                    {parsed.smartSummary.reason && (
                        <p className="text-sm text-gray-600 mb-2">{parsed.smartSummary.reason}</p>
                    )}
                    {parsed.smartSummary.others.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {parsed.smartSummary.others.map((o, i) => (
                                <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-600">{o}</span>
                            ))}
                        </div>
                    )}
                    {parsed.smartSummary.cautions.length > 0 && (
                        <div className="mt-2 text-xs text-amber-700">
                            ⚠️ {parsed.smartSummary.cautions.join(' / ')}
                        </div>
                    )}
                </div>
            )}

            {/* Timeframe Cards */}
            <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    멀티 타임프레임 분석
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {parsed.timeframes.map((tf, i) => (
                        <TimeframeCard key={i} tf={tf} />
                    ))}
                </div>
            </div>

            {/* Allocation */}
            {parsed.allocation.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        포지션 배분 가이드
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {parsed.allocation.map((a, i) => (
                            <div key={i} className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="text-sm font-medium text-gray-900">{a.style}</div>
                                <div className="text-lg font-bold text-gray-900 my-1">{a.weight}</div>
                                <div className="text-xs text-gray-500">{a.timeframe}</div>
                                <div className="text-xs text-gray-400">{a.period}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
