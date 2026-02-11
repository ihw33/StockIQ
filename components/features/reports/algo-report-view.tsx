"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseAlgoReport, ParsedAlgoReport, ParsedTimeframe, ParsedIndicator } from '@/lib/utils/parse-algo-report';

function TimeframeCard({ tf, currentPrice }: { tf: ParsedTimeframe; currentPrice?: string }) {
    return (
        <div className="bg-white border-b border-gray-300 pb-6 mb-6">
            {/* Header - Simple and Clean */}
            <div className="mb-4">
                <h4 className="text-base font-bold text-gray-900 mb-1">
                    {tf.name} <span className="text-sm font-normal text-gray-500">({tf.subtitle})</span>
                </h4>
                <div className="bg-gray-50 border border-gray-300 px-3 py-2 rounded">
                    <div className="text-sm">
                        <span className="font-semibold text-gray-700">추세:</span> <span className="font-bold text-gray-900">{tf.trend}</span>
                        <span className="mx-2 text-gray-400">|</span>
                        <span className="font-semibold text-gray-700">전략:</span> <span className="font-bold text-gray-900">{tf.strategy}</span>
                    </div>
                </div>
            </div>

            {/* Trading Table */}
            <table className="w-full text-sm mb-4 border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-400">
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">구분</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-700">가격</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {currentPrice && (
                        <tr className="bg-blue-50">
                            <td className="py-2 px-3 font-semibold text-gray-700">현재가</td>
                            <td className="py-2 px-3 text-right font-bold text-lg text-blue-900">{currentPrice}</td>
                        </tr>
                    )}
                    {tf.entry && (
                        <tr>
                            <td className="py-2 px-3 text-gray-600">진입</td>
                            <td className="py-2 px-3 text-right font-bold text-blue-700">{tf.entry}</td>
                        </tr>
                    )}
                    {tf.stopLoss && (
                        <tr>
                            <td className="py-2 px-3 text-gray-600">손절</td>
                            <td className="py-2 px-3 text-right font-bold text-red-600">{tf.stopLoss}</td>
                        </tr>
                    )}
                    {(tf.targets && tf.targets.length > 0) ? (
                        <tr>
                            <td className="py-2 px-3 text-gray-600">목표 (1차 → 2차 → 3차)</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{tf.targets.join(' → ')}</td>
                        </tr>
                    ) : tf.target ? (
                        <tr>
                            <td className="py-2 px-3 text-gray-600">목표</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{tf.target}</td>
                        </tr>
                    ) : null}
                </tbody>
            </table>

            {/* Support/Resistance */}
            {(tf.supports || tf.resistances) && (
                <div className="space-y-2 text-sm">
                    {tf.supports && (
                        <div className="flex">
                            <span className="w-20 text-gray-600 flex-shrink-0">지지선:</span>
                            <span className="text-gray-800">{tf.supports}</span>
                        </div>
                    )}
                    {tf.resistances && (
                        <div className="flex">
                            <span className="w-20 text-gray-600 flex-shrink-0">저항선:</span>
                            <span className="text-gray-800">{tf.resistances}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Indicators - Simple List */}
            {tf.indicators.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">기술적 지표</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                        {tf.indicators.map((ind, i) => (
                            <span key={i}>{ind.name}: <strong>{ind.value}</strong></span>
                        ))}
                    </div>
                </div>
            )}
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="bg-white">
            {/* Header - Document Style */}
            <div className="border-b-2 border-gray-900 pb-3 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                    기술적 분석 보고서
                </h2>
                {parsed.currentPrice && (
                    <div className="text-sm text-gray-600">
                        현재가: <span className="font-bold text-gray-900">{parsed.currentPrice}</span>
                    </div>
                )}
            </div>

            {/* Stress Alert - Simple Table */}
            {parsed.stressAlert && (
                <div className="mb-6">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                        시장 상태: {parsed.stressAlert.level} (스트레스 지수 {parsed.stressAlert.score}/100)
                    </div>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {parsed.stressAlert.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                        ))}
                    </ul>
                    <hr className="mt-4 border-gray-300" />
                </div>
            )}

            {/* 5-Day Volatility Table */}
            {parsed.volatility.rawMarkdown ? (
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-400 pb-2">
                        최근 5일 거래 현황
                    </h3>

                    {/* Daily Table */}
                    <div className="overflow-x-auto mb-4">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h2: ({node, ...props}) => <div />,
                                table: ({node, ...props}) => (
                                    <table className="w-full border-collapse text-sm" {...props} />
                                ),
                                thead: ({node, ...props}) => <thead {...props} />,
                                tbody: ({node, ...props}) => (
                                    <tbody className="divide-y divide-gray-200" {...props} />
                                ),
                                th: ({node, ...props}) => (
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b-2 border-gray-400" {...props} />
                                ),
                                td: ({node, ...props}) => (
                                    <td className="px-3 py-2 text-gray-800" {...props} />
                                ),
                                p: ({node, ...props}) => <div />, // Skip p tags
                                strong: ({node, ...props}) => <div />, // Skip summary lines
                            }}
                        >
                            {parsed.volatility.rawMarkdown.split('\n').filter(line =>
                                line.includes('|') || line.includes('---')
                            ).join('\n')}
                        </ReactMarkdown>
                    </div>

                    {/* Summary Table */}
                    <table className="w-full text-sm border-collapse mb-3">
                        <tbody className="divide-y divide-gray-200">
                            <tr>
                                <td className="py-2 px-3 text-gray-600 w-1/3">5일 누적 변동</td>
                                <td className="py-2 px-3 font-bold text-gray-900">{parsed.volatility.cumulativeChange}</td>
                                <td className="py-2 px-3 text-gray-600 w-1/3">평균 일간 변동</td>
                                <td className="py-2 px-3 font-bold text-gray-900">{parsed.volatility.avgDaily}</td>
                            </tr>
                            {(parsed.volatility.volumeLevel || parsed.volatility.volumeTrend) && (
                                <tr>
                                    <td className="py-2 px-3 text-gray-600">거래량 수준</td>
                                    <td className="py-2 px-3 font-bold text-gray-900">{parsed.volatility.volumeLevel}</td>
                                    <td className="py-2 px-3 text-gray-600">거래량 추이</td>
                                    <td className="py-2 px-3 font-bold text-gray-900">{parsed.volatility.volumeTrend}</td>
                                </tr>
                            )}
                            {(parsed.volatility.avgTradeAmount || parsed.volatility.tradeAmountTrend) && (
                                <tr>
                                    <td className="py-2 px-3 text-gray-600">평균 거래대금</td>
                                    <td className="py-2 px-3 font-bold text-gray-900">{parsed.volatility.avgTradeAmount}</td>
                                    <td className="py-2 px-3 text-gray-600">거래대금 추이</td>
                                    <td className="py-2 px-3 font-bold text-gray-900">{parsed.volatility.tradeAmountTrend}</td>
                                </tr>
                            )}
                            {parsed.volatility.buyingPressure && (
                                <tr>
                                    <td className="py-2 px-3 text-gray-600">체결강도 추정</td>
                                    <td className="py-2 px-3 font-bold text-gray-900" colSpan={3}>
                                        {parsed.volatility.buyingPressure} {parsed.volatility.buyingPressureStatus}
                                        <span className="text-xs text-gray-500 ml-2">※ 상승일/하락일 거래량 기준 추정치</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <hr className="border-gray-300" />
                </div>
            ) : null}

            {/* Smart Summary - Clean */}
            {parsed.smartSummary.recommendation && (
                <div className="mb-6">
                    <div className="text-base font-bold text-gray-900 mb-2">
                        종합 의견: {parsed.smartSummary.recommendation}
                    </div>
                    {parsed.smartSummary.reason && (
                        <p className="text-sm text-gray-700 mb-2">{parsed.smartSummary.reason}</p>
                    )}
                    {parsed.smartSummary.cautions.length > 0 && (
                        <div className="text-sm text-gray-600">
                            주의사항: {parsed.smartSummary.cautions.join(', ')}
                        </div>
                    )}
                    <hr className="mt-4 border-gray-300" />
                </div>
            )}

            {/* Timeframe Analysis - Document Style */}
            <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-400 pb-2">
                    타임프레임별 전략
                </h3>
                {parsed.timeframes.map((tf, i) => (
                    <TimeframeCard key={i} tf={tf} currentPrice={parsed.currentPrice} />
                ))}
            </div>

            {/* Allocation - Simple Table */}
            {parsed.allocation.length > 0 && (
                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-400 pb-2">
                        포지션별 배분 가이드
                    </h3>
                    <table className="w-full text-sm border-collapse mb-3">
                        <thead>
                            <tr className="border-b-2 border-gray-400">
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">투자 스타일</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700">비중</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700">타임프레임</th>
                                <th className="text-right py-2 px-3 font-semibold text-gray-700">보유 기간</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {parsed.allocation.map((a, i) => (
                                <tr key={i}>
                                    <td className="py-2 px-3 text-gray-800">{a.style}</td>
                                    <td className="py-2 px-3 text-center font-bold text-gray-900">{a.weight}</td>
                                    <td className="py-2 px-3 text-center text-gray-700">{a.timeframe}</td>
                                    <td className="py-2 px-3 text-right text-gray-600">{a.period}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-sm text-gray-600 italic">
                        * 리스크 관리: 각 타임프레임의 손절가를 반드시 준수하세요.
                    </div>
                </div>
            )}
        </div>
    );
}
