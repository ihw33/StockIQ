'use client';

import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';

interface CompanyData {
    symbol: string;
    per: number | null;
    pbr: number | null;
    roe: number | null;
    eps: number | null;
    bps: number | null;
    ev: number | null;
    market_cap: number | null;
    stk_nm: string;
    settle_month: string;
    listed_shares: number | null;
    credit_ratio: number | null;
    year_high: number | null;
    year_low: number | null;
    high_250: number | null;
    low_250: number | null;
    foreign_ratio: number | null;
    sales: number | null;
    operating_profit: number | null;
    operating_profit_growth: number | null;
    fiscal_period: string | null;
    net_income: number | null;
    dividend_rate: number | null;
}

// ─── Rule-based interpretation ───

type Signal = 'very_good' | 'good' | 'neutral' | 'bad' | 'very_bad';

const SIGNAL_STYLES: Record<Signal, { dot: string; text: string; label: string }> = {
    very_good: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: '매우 양호' },
    good:      { dot: 'bg-green-400',   text: 'text-green-600',   label: '양호' },
    neutral:   { dot: 'bg-yellow-400',  text: 'text-yellow-600',  label: '보통' },
    bad:       { dot: 'bg-orange-400',  text: 'text-orange-600',  label: '주의' },
    very_bad:  { dot: 'bg-red-500',     text: 'text-red-600',     label: '위험' },
};

function evalPER(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: 'PER 데이터 없음' };
    if (v < 0) return { signal: 'bad', comment: `PER ${v.toFixed(1)} 적자` };
    if (v < 10) return { signal: 'very_good', comment: `PER ${v.toFixed(1)} 매우 저평가` };
    if (v < 15) return { signal: 'good', comment: `PER ${v.toFixed(1)} 저평가` };
    if (v < 25) return { signal: 'neutral', comment: `PER ${v.toFixed(1)} 적정 수준` };
    if (v < 35) return { signal: 'bad', comment: `PER ${v.toFixed(1)} 고평가 구간` };
    return { signal: 'very_bad', comment: `PER ${v.toFixed(1)} 매우 고평가` };
}

function evalPBR(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: 'PBR 데이터 없음' };
    if (v < 0.7) return { signal: 'very_good', comment: `PBR ${v.toFixed(2)} 자산대비 저평가` };
    if (v < 1.0) return { signal: 'good', comment: `PBR ${v.toFixed(2)} 저평가` };
    if (v < 2.0) return { signal: 'neutral', comment: `PBR ${v.toFixed(2)} 적정` };
    if (v < 3.0) return { signal: 'bad', comment: `PBR ${v.toFixed(2)} 다소 고평가` };
    return { signal: 'very_bad', comment: `PBR ${v.toFixed(2)} 고평가` };
}

function evalROE(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: 'ROE 데이터 없음' };
    if (v > 20) return { signal: 'very_good', comment: `ROE ${v.toFixed(1)}% 매우 우수` };
    if (v > 15) return { signal: 'good', comment: `ROE ${v.toFixed(1)}% 우수` };
    if (v > 8) return { signal: 'neutral', comment: `ROE ${v.toFixed(1)}% 양호` };
    if (v > 3) return { signal: 'bad', comment: `ROE ${v.toFixed(1)}% 보통` };
    return { signal: 'very_bad', comment: `ROE ${v.toFixed(1)}% 부진` };
}

function evalForeign(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: '외인 데이터 없음' };
    if (v > 50) return { signal: 'very_good', comment: `외인 ${v.toFixed(1)}% 강력 선호` };
    if (v > 30) return { signal: 'good', comment: `외인 ${v.toFixed(1)}% 선호` };
    if (v > 15) return { signal: 'neutral', comment: `외인 ${v.toFixed(1)}% 보통` };
    return { signal: 'bad', comment: `외인 ${v.toFixed(1)}% 관심 저조` };
}

function evalCredit(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: '신용 데이터 없음' };
    if (v < 1) return { signal: 'good', comment: `신용 ${v.toFixed(1)}% 안정` };
    if (v < 3) return { signal: 'neutral', comment: `신용 ${v.toFixed(1)}% 보통` };
    return { signal: 'bad', comment: `신용 ${v.toFixed(1)}% 과열 주의` };
}

function getOverallSignal(signals: Signal[]): Signal {
    const scores: Record<Signal, number> = { very_good: 2, good: 1, neutral: 0, bad: -1, very_bad: -2 };
    const avg = signals.reduce((s, sig) => s + scores[sig], 0) / signals.length;
    if (avg > 1.2) return 'very_good';
    if (avg > 0.4) return 'good';
    if (avg > -0.4) return 'neutral';
    if (avg > -1.2) return 'bad';
    return 'very_bad';
}

function generateSummary(data: CompanyData): string {
    const parts: string[] = [];
    const name = data.stk_nm || data.symbol;

    // Valuation
    const perEval = evalPER(data.per);
    const pbrEval = evalPBR(data.pbr);
    const valSignal = getOverallSignal([perEval.signal, pbrEval.signal]);
    if (valSignal === 'very_good' || valSignal === 'good') {
        parts.push(`${name}은(는) 가치 대비 저평가 구간`);
    } else if (valSignal === 'bad' || valSignal === 'very_bad') {
        parts.push(`${name}은(는) 가치 대비 고평가 구간`);
    } else {
        parts.push(`${name}은(는) 밸류에이션 적정 수준`);
    }

    // Profitability
    const roeEval = evalROE(data.roe);
    if (data.operating_profit != null && data.sales != null && data.sales > 0) {
        const margin = (data.operating_profit / data.sales) * 100;
        if (margin > 15) parts.push(`영업이익률 ${margin.toFixed(1)}%로 수익성 우수`);
        else if (margin > 8) parts.push(`영업이익률 ${margin.toFixed(1)}%로 수익성 양호`);
        else parts.push(`영업이익률 ${margin.toFixed(1)}%로 수익성 보통`);
    }

    // Appeal
    if (data.foreign_ratio != null && data.foreign_ratio > 40) {
        parts.push(`외인 보유 ${data.foreign_ratio.toFixed(1)}%로 기관 선호도 높음`);
    }

    if (data.credit_ratio != null && data.credit_ratio > 3) {
        parts.push(`신용비율 ${data.credit_ratio}% 과열 주의`);
    }

    // Year range context
    if (data.year_high != null && data.year_low != null) {
        const high = Math.abs(data.year_high);
        const low = Math.abs(data.year_low);
        if (high > 0 && low > 0) {
            parts.push(`연중 ${fmtCompact(low)}~${fmtCompact(high)} 범위`);
        }
    }

    return parts.join('. ') + '.';
}

// ─── Formatting ───

function fmt(v: number | null | undefined): string {
    if (v == null) return '-';
    return new Intl.NumberFormat('ko-KR').format(Math.abs(v));
}

function fmtCompact(v: number): string {
    if (v >= 10000) return `${(v / 10000).toFixed(0)}만`;
    return new Intl.NumberFormat('ko-KR').format(v);
}

function fmtBillion(v: number | null | undefined): string {
    if (v == null) return '-';
    const abs = Math.abs(v);
    if (abs >= 10000) return `${(abs / 10000).toFixed(1)}조`;
    return `${fmt(abs)}억`;
}

// ─── Tooltip descriptions ───

const METRIC_TOOLTIPS: Record<string, string> = {
    'PER': '주가수익비율 (Price Earnings Ratio). 주가 ÷ 주당순이익. 낮을수록 저평가, KOSPI 평균 약 12배',
    'PBR': '주가순자산비율 (Price Book-value Ratio). 주가 ÷ 주당순자산. 1 미만이면 자산가치 대비 저평가',
    'ROE': '자기자본이익률 (Return On Equity). 순이익 ÷ 자기자본. 높을수록 수익성 우수, 15% 이상이면 우수',
    'EV': '기업가치 (Enterprise Value). 시가총액 + 순차입금. 기업 인수 시 필요한 총 비용',
    'EPS': '주당순이익 (Earnings Per Share). 순이익 ÷ 발행주식수. 주당 벌어들이는 이익',
    'BPS': '주당순자산 (Book-value Per Share). 순자산 ÷ 발행주식수. 청산 시 주당 가치',
    '외인': '외국인 보유비율. 30% 이상이면 글로벌 기관투자자 선호 종목',
    '신용': '신용거래 비율. 빌린 돈으로 매수한 비율. 3% 이상이면 과열 주의',
    '매출': '매출액 (억원). 기업이 벌어들인 총 수익',
    '영업이익': '영업이익 (억원). 매출에서 영업비용을 뺀 본업 수익',
    '영업이익률': '영업이익 ÷ 매출 × 100. 본업의 수익성을 나타내는 지표',
    '배당률': '액면배당률. 주당배당금 ÷ 액면가 × 100. 배당수익률과 다름',
};

// ─── Sub-components ───

function SignalDot({ signal }: { signal: Signal }) {
    return <span className={`w-2.5 h-2.5 rounded-full ${SIGNAL_STYLES[signal].dot} inline-block`} />;
}

function MetricRow({ label, value, signal, comment }: { label: string; value: string; signal: Signal; comment: string }) {
    const style = SIGNAL_STYLES[signal];
    const tooltip = METRIC_TOOLTIPS[label];
    return (
        <div className="flex items-center justify-between text-xs py-0.5 group">
            <span className="text-gray-500 cursor-help relative" title={tooltip}>
                {label}
                {tooltip && <span className="border-b border-dotted border-gray-400" />}
            </span>
            <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-700">{value}</span>
                <SignalDot signal={signal} />
                <span className={`${style.text} text-[11px]`}>{comment.split(' ').slice(-1)[0]}</span>
            </div>
        </div>
    );
}

// ─── Main Component ───

interface CompanyInfoCardProps {
    symbol: string;
    name: string;
    onRequestAIAnalysis?: (symbol: string, name: string, data: CompanyData) => void;
}

export function CompanyInfoCard({ symbol, name, onRequestAIAnalysis }: CompanyInfoCardProps) {
    const [data, setData] = useState<CompanyData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let ignore = false;
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/company/${symbol}`);
                if (res.ok) {
                    const json = await res.json();
                    if (!ignore && json.data) setData(json.data);
                }
            } catch { /* silently fail */ }
            finally { if (!ignore) setLoading(false); }
        };
        load();
        return () => { ignore = true; };
    }, [symbol]);

    if (loading && !data) {
        return (
            <div className="h-24 bg-white border-t animate-pulse flex items-center px-4">
                <div className="h-3 w-64 bg-gray-200 rounded" />
            </div>
        );
    }

    if (!data) return null;

    const perEval = evalPER(data.per);
    const pbrEval = evalPBR(data.pbr);
    const roeEval = evalROE(data.roe);
    const foreignEval = evalForeign(data.foreign_ratio);
    const creditEval = evalCredit(data.credit_ratio);

    const valSignal = getOverallSignal([perEval.signal, pbrEval.signal]);
    const profitSignal = roeEval.signal;
    const appealSignal = getOverallSignal([foreignEval.signal, creditEval.signal]);

    const summary = generateSummary(data);

    return (
        <div className="border-t bg-white shrink-0">
            {/* Header row */}
            <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold text-gray-800">{data.stk_nm || name}</span>
                    <span className="text-gray-400 text-xs">{symbol}</span>
                    {data.market_cap && <span className="text-blue-600 font-medium">시총 {fmtBillion(data.market_cap)}</span>}
                    {data.settle_month && <span className="text-gray-400 text-xs">결산 {data.settle_month}월</span>}
                </div>
                {onRequestAIAnalysis && (
                    <button
                        onClick={() => onRequestAIAnalysis(symbol, data.stk_nm || name, data)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors border border-indigo-200"
                    >
                        <Brain className="w-4 h-4" />
                        AI 기업분석
                    </button>
                )}
            </div>

            {/* 3-column diagnosis */}
            <div className="px-4 py-2.5 grid grid-cols-[1fr_1fr_1fr_2fr] gap-4 text-sm">
                {/* Col 1: Valuation */}
                <div className="border-r border-gray-100 pr-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <SignalDot signal={valSignal} />
                        <span className={`font-bold text-xs ${SIGNAL_STYLES[valSignal].text}`}>가치평가</span>
                    </div>
                    <MetricRow label="PER" value={data.per?.toFixed(1) ?? '-'} signal={perEval.signal} comment={perEval.comment} />
                    <MetricRow label="PBR" value={data.pbr?.toFixed(2) ?? '-'} signal={pbrEval.signal} comment={pbrEval.comment} />
                    {data.ev != null && (
                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 cursor-help" title={METRIC_TOOLTIPS['EV']}>EV</span>
                            <span className="font-medium text-gray-700">{data.ev.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                {/* Col 2: Profitability */}
                <div className="border-r border-gray-100 pr-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <SignalDot signal={profitSignal} />
                        <span className={`font-bold text-xs ${SIGNAL_STYLES[profitSignal].text}`}>수익성</span>
                    </div>
                    <MetricRow label="ROE" value={data.roe ? `${data.roe.toFixed(1)}%` : '-'} signal={roeEval.signal} comment={roeEval.comment} />
                    <div className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-gray-500 cursor-help" title={METRIC_TOOLTIPS['매출']}>매출</span>
                        <span className="font-medium text-gray-700">{fmtBillion(data.sales)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-gray-500 cursor-help" title={METRIC_TOOLTIPS['영업이익']}>영업이익</span>
                        <span className="font-medium text-gray-700">{fmtBillion(data.operating_profit)}</span>
                    </div>
                    {data.operating_profit != null && data.sales != null && data.sales > 0 && (
                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 cursor-help" title={METRIC_TOOLTIPS['영업이익률']}>영업이익률</span>
                            <span className="font-medium text-gray-700">{((data.operating_profit / data.sales) * 100).toFixed(1)}%</span>
                        </div>
                    )}
                    {data.operating_profit_growth != null && (
                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500">영업이익증가율</span>
                            <span className={`font-medium ${data.operating_profit_growth > 0 ? 'text-green-600' : data.operating_profit_growth < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                {data.operating_profit_growth > 0 ? '+' : ''}{data.operating_profit_growth.toFixed(1)}%
                            </span>
                        </div>
                    )}
                    {data.fiscal_period && (
                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500">재무기간</span>
                            <span className="font-medium text-gray-700">{data.fiscal_period}</span>
                        </div>
                    )}
                </div>

                {/* Col 3: Appeal */}
                <div className="border-r border-gray-100 pr-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <SignalDot signal={appealSignal} />
                        <span className={`font-bold text-xs ${SIGNAL_STYLES[appealSignal].text}`}>투자매력</span>
                    </div>
                    <MetricRow label="외인" value={data.foreign_ratio != null ? `${data.foreign_ratio.toFixed(1)}%` : '-'} signal={foreignEval.signal} comment={foreignEval.comment} />
                    <MetricRow label="신용" value={data.credit_ratio != null ? `${data.credit_ratio.toFixed(1)}%` : '-'} signal={creditEval.signal} comment={creditEval.comment} />
                    {data.year_high != null && (
                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500">연중 범위</span>
                            <span className="font-medium text-gray-700">{fmtCompact(Math.abs(data.year_low ?? 0))}~{fmtCompact(Math.abs(data.year_high))}</span>
                        </div>
                    )}
                    {data.dividend_rate != null && data.dividend_rate > 0 && (
                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 cursor-help" title={METRIC_TOOLTIPS['배당률']}>배당률</span>
                            <span className="font-medium text-gray-700">{data.dividend_rate.toFixed(2)}%</span>
                        </div>
                    )}
                </div>

                {/* Col 4: Summary */}
                <div className="pl-1">
                    <div className="flex items-center gap-1.5 mb-2">
                        <span className="font-bold text-xs text-gray-700">종합 의견</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        {summary}
                    </p>
                    <div className="mt-2 flex gap-3">
                        <span className="text-[11px] text-gray-400 cursor-help" title={METRIC_TOOLTIPS['EPS']}>EPS {fmt(data.eps)}</span>
                        <span className="text-[11px] text-gray-400 cursor-help" title={METRIC_TOOLTIPS['BPS']}>BPS {fmt(data.bps)}</span>
                        <span className="text-[11px] text-gray-400">순이익 {fmtBillion(data.net_income)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export type { CompanyData };
