'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Brain, Building2, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { RecentAlert } from './right-panel';
import { cn } from '@/lib/utils';
// Plain div used instead of Radix ScrollArea to avoid display:table width issues

interface InvestorHistoryItem {
    date: string;
    close: number;
    change: number;
    volume: number;
    foreign: number;
    institution: number;
    individual: number;
}

interface InvestorCumulative {
    foreign: number;
    institution: number;
    individual: number;
}

// ─── Company data types & evaluation (from company-info-card) ───

interface DartOverview {
    corp_name: string;
    stock_name: string;
    ceo_nm: string;
    induty_code: string;
    induty_name: string;
    est_dt: string;
    hm_url: string;
    acc_mt: string;
    adres: string;
}

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
    net_income: number | null;
    dividend_rate: number | null;
    dart_overview?: DartOverview;
}

type Signal = 'very_good' | 'good' | 'neutral' | 'bad' | 'very_bad';

const SIGNAL_STYLES: Record<Signal, { dot: string; text: string; label: string }> = {
    very_good: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: '매우 양호' },
    good:      { dot: 'bg-green-400',   text: 'text-green-400',   label: '양호' },
    neutral:   { dot: 'bg-yellow-400',  text: 'text-yellow-400',  label: '보통' },
    bad:       { dot: 'bg-orange-400',  text: 'text-orange-400',  label: '주의' },
    very_bad:  { dot: 'bg-red-500',     text: 'text-red-400',     label: '위험' },
};

function evalPER(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: 'PER 데이터 없음' };
    if (v < 0) return { signal: 'bad', comment: `${v.toFixed(1)} 적자` };
    if (v < 10) return { signal: 'very_good', comment: `${v.toFixed(1)} 매우 저평가` };
    if (v < 15) return { signal: 'good', comment: `${v.toFixed(1)} 저평가` };
    if (v < 25) return { signal: 'neutral', comment: `${v.toFixed(1)} 적정` };
    if (v < 35) return { signal: 'bad', comment: `${v.toFixed(1)} 고평가` };
    return { signal: 'very_bad', comment: `${v.toFixed(1)} 매우 고평가` };
}

function evalPBR(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: 'PBR 데이터 없음' };
    if (v < 0.7) return { signal: 'very_good', comment: `${v.toFixed(2)} 저평가` };
    if (v < 1.0) return { signal: 'good', comment: `${v.toFixed(2)} 저평가` };
    if (v < 2.0) return { signal: 'neutral', comment: `${v.toFixed(2)} 적정` };
    if (v < 3.0) return { signal: 'bad', comment: `${v.toFixed(2)} 고평가` };
    return { signal: 'very_bad', comment: `${v.toFixed(2)} 고평가` };
}

function evalROE(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: 'ROE 데이터 없음' };
    if (v > 20) return { signal: 'very_good', comment: `${v.toFixed(1)}% 매우 우수` };
    if (v > 15) return { signal: 'good', comment: `${v.toFixed(1)}% 우수` };
    if (v > 8) return { signal: 'neutral', comment: `${v.toFixed(1)}% 양호` };
    if (v > 3) return { signal: 'bad', comment: `${v.toFixed(1)}% 보통` };
    return { signal: 'very_bad', comment: `${v.toFixed(1)}% 부진` };
}

function evalForeign(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: '외인 데이터 없음' };
    if (v > 50) return { signal: 'very_good', comment: `${v.toFixed(1)}% 강력 선호` };
    if (v > 30) return { signal: 'good', comment: `${v.toFixed(1)}% 선호` };
    if (v > 15) return { signal: 'neutral', comment: `${v.toFixed(1)}% 보통` };
    return { signal: 'bad', comment: `${v.toFixed(1)}% 저조` };
}

function evalCredit(v: number | null): { signal: Signal; comment: string } {
    if (v == null) return { signal: 'neutral', comment: '신용 데이터 없음' };
    if (v < 1) return { signal: 'good', comment: `${v.toFixed(1)}% 안정` };
    if (v < 3) return { signal: 'neutral', comment: `${v.toFixed(1)}% 보통` };
    return { signal: 'bad', comment: `${v.toFixed(1)}% 과열` };
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

function fmt(v: number | null | undefined): string {
    if (v == null) return '-';
    return new Intl.NumberFormat('ko-KR').format(Math.abs(v));
}

function fmtBillion(v: number | null | undefined): string {
    if (v == null) return '-';
    const abs = Math.abs(v);
    if (abs >= 10000) return `${(abs / 10000).toFixed(1)}조`;
    return `${fmt(abs)}억`;
}

function fmtCompact(v: number): string {
    if (v >= 10000) return `${(v / 10000).toFixed(0)}만`;
    return new Intl.NumberFormat('ko-KR').format(v);
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

    // ROE
    if (data.roe != null) {
        if (data.roe > 15) parts.push(`ROE ${data.roe.toFixed(1)}%로 자본효율 우수`);
        else if (data.roe > 8) parts.push(`ROE ${data.roe.toFixed(1)}%로 자본효율 양호`);
        else if (data.roe > 0) parts.push(`ROE ${data.roe.toFixed(1)}%로 자본효율 보통`);
        else parts.push(`ROE ${data.roe.toFixed(1)}%로 수익성 부진`);
    }

    // Operating margin
    if (data.operating_profit != null && data.sales != null && data.sales > 0) {
        const margin = (data.operating_profit / data.sales) * 100;
        if (margin > 15) parts.push(`영업이익률 ${margin.toFixed(1)}%로 수익성 우수`);
        else if (margin > 8) parts.push(`영업이익률 ${margin.toFixed(1)}%로 수익성 양호`);
        else parts.push(`영업이익률 ${margin.toFixed(1)}%로 수익성 보통`);
    }

    // Net income
    if (data.net_income != null) {
        if (data.net_income > 0) parts.push(`순이익 ${fmtBillion(data.net_income)} 흑자`);
        else parts.push(`순이익 ${fmtBillion(data.net_income)} 적자`);
    }

    // Foreign
    if (data.foreign_ratio != null) {
        if (data.foreign_ratio > 40) parts.push(`외인 보유 ${data.foreign_ratio.toFixed(1)}%로 기관 선호도 높음`);
        else if (data.foreign_ratio > 20) parts.push(`외인 보유 ${data.foreign_ratio.toFixed(1)}%`);
    }

    // Credit
    if (data.credit_ratio != null && data.credit_ratio > 3) {
        parts.push(`신용비율 ${data.credit_ratio.toFixed(1)}% 과열 주의`);
    }

    // Dividend
    if (data.dividend_rate != null && data.dividend_rate > 0) {
        parts.push(`배당률 ${data.dividend_rate.toFixed(2)}%`);
    }

    // Year range
    if (data.year_high != null && data.year_low != null) {
        const high = Math.abs(data.year_high);
        const low = Math.abs(data.year_low);
        if (high > 0 && low > 0) {
            parts.push(`연중 ${fmtCompact(low)}~${fmtCompact(high)} 범위`);
        }
    }

    return parts.join('.\n') + '.';
}

function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return '방금';
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    return `${Math.floor(hr / 24)}일 전`;
}

// ─── Sub-components ───

function SignalDot({ signal }: { signal: Signal }) {
    return <span className={`w-2 h-2 rounded-full ${SIGNAL_STYLES[signal].dot} inline-block`} />;
}

function MetricItem({ label, value, signal, comment }: { label: string; value: string; signal: Signal; comment: string }) {
    const style = SIGNAL_STYLES[signal];
    return (
        <div className="flex items-center justify-between text-xs py-0.5">
            <span className="text-slate-500">{label}</span>
            <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-300">{value}</span>
                <SignalDot signal={signal} />
                <span className={`${style.text} text-[10px]`}>{comment.split(' ').slice(-1)[0]}</span>
            </div>
        </div>
    );
}

// ─── Main Component ───

interface AIControlPanelProps {
    currentSymbol: string;
    currentName: string;
    recentAlerts?: RecentAlert[];
    onGoToReports?: (mode?: 'algo' | 'llm' | 'company') => void;
}

export function AIControlPanel({ currentSymbol, currentName, recentAlerts = [], onGoToReports }: AIControlPanelProps) {
    const [loadingAlgo, setLoadingAlgo] = useState(false);
    const [loadingDeep, setLoadingDeep] = useState(false);
    const [loadingCompany, setLoadingCompany] = useState(false);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const [companyLoading, setCompanyLoading] = useState(false);
    const [investorHistory, setInvestorHistory] = useState<InvestorHistoryItem[]>([]);
    const [investorCumulative, setInvestorCumulative] = useState<InvestorCumulative | null>(null);

    // Fetch company info when symbol changes
    useEffect(() => {
        if (!currentSymbol) return;

        let ignore = false;
        const load = async () => {
            setCompanyLoading(true);
            try {
                const res = await fetch(`/api/company/${currentSymbol}`);
                if (res.ok) {
                    const json = await res.json();
                    if (!ignore && json.data) setCompanyData(json.data);
                }
            } catch { /* silent */ }
            finally { if (!ignore) setCompanyLoading(false); }
        };
        load();
        return () => { ignore = true; };
    }, [currentSymbol]);

    // Fetch investor history when symbol changes
    useEffect(() => {
        if (!currentSymbol) return;
        setInvestorHistory([]);
        setInvestorCumulative(null);
        let ignore = false;
        const load = async () => {
            try {
                const res = await fetch(`/api/stock/investor-history?symbol=${currentSymbol}&days=60`);
                if (res.ok) {
                    const json = await res.json();
                    if (!ignore) {
                        setInvestorHistory(json.data || []);
                        setInvestorCumulative(json.cumulative || null);
                    }
                }
            } catch { /* silent */ }
        };
        load();
        return () => { ignore = true; };
    }, [currentSymbol]);

    const triggerAnalysis = async (type: 'algo' | 'deep' | 'company') => {
        if (!currentSymbol) return;

        const endpoints: Record<string, string> = {
            algo: '/api/ai/algo-analysis-start',
            deep: '/api/ai/deep-analysis-start',
            company: '/api/ai/company-analysis-start',
        };
        const labels: Record<string, string> = {
            algo: '알고리즘 분석',
            deep: '심층 분석',
            company: '기업 분석',
        };
        const setLoading = type === 'algo' ? setLoadingAlgo : type === 'deep' ? setLoadingDeep : setLoadingCompany;

        setLoading(true);
        try {
            const res = await fetch(endpoints[type], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: currentSymbol }),
            });
            if (!res.ok) throw new Error(`Failed: ${res.status}`);
            toast.success(`${labels[type]} 시작`, {
                description: `${currentName || currentSymbol} — 완료 시 보고서 탭에서 확인`,
            });
        } catch {
            toast.error(`${labels[type]} 시작 실패`, {
                description: 'AI 엔진 연결을 확인하세요',
            });
        } finally {
            setLoading(false);
        }
    };

    const anyLoading = loadingAlgo || loadingDeep || loadingCompany;

    // Company data evaluation
    const perEval = companyData ? evalPER(companyData.per) : null;
    const pbrEval = companyData ? evalPBR(companyData.pbr) : null;
    const roeEval = companyData ? evalROE(companyData.roe) : null;
    const foreignEval = companyData ? evalForeign(companyData.foreign_ratio) : null;
    const creditEval = companyData ? evalCredit(companyData.credit_ratio) : null;

    const valSignal = perEval && pbrEval ? getOverallSignal([perEval.signal, pbrEval.signal]) : 'neutral';
    const profitSignal = roeEval?.signal ?? 'neutral';
    const appealSignal = foreignEval && creditEval ? getOverallSignal([foreignEval.signal, creditEval.signal]) : 'neutral';

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Analysis Trigger Buttons */}
            <div className="p-3 space-y-2 shrink-0 border-b border-slate-800">
                <div className="flex gap-2">
                    <button
                        onClick={() => triggerAnalysis('algo')}
                        disabled={anyLoading}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all',
                            loadingAlgo
                                ? 'bg-blue-600/20 text-blue-400 cursor-wait'
                                : 'bg-slate-800 text-slate-300 hover:bg-blue-600/20 hover:text-blue-400 disabled:opacity-50'
                        )}
                    >
                        {loadingAlgo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                        알고리즘
                    </button>
                    <button
                        onClick={() => triggerAnalysis('deep')}
                        disabled={anyLoading}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all',
                            loadingDeep
                                ? 'bg-purple-600/20 text-purple-400 cursor-wait'
                                : 'bg-slate-800 text-slate-300 hover:bg-purple-600/20 hover:text-purple-400 disabled:opacity-50'
                        )}
                    >
                        {loadingDeep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        심층
                    </button>
                    <button
                        onClick={() => triggerAnalysis('company')}
                        disabled={anyLoading}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all',
                            loadingCompany
                                ? 'bg-amber-600/20 text-amber-400 cursor-wait'
                                : 'bg-slate-800 text-slate-300 hover:bg-amber-600/20 hover:text-amber-400 disabled:opacity-50'
                        )}
                    >
                        {loadingCompany ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
                        기업
                    </button>
                </div>

                {anyLoading && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 px-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {currentName || currentSymbol} 분석 진행 중... 완료 시 보고서 탭에 표시됩니다
                    </div>
                )}
            </div>

            {/* Recent Alerts */}
            {recentAlerts.length > 0 && (
                <div className="px-3 py-2 border-b border-slate-800 shrink-0 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium">최근 완료</span>
                        {onGoToReports && (
                            <button
                                onClick={() => onGoToReports?.()}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                            >
                                보고서 보기 <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                    {recentAlerts.slice(0, 5).map((alert) => (
                        <div
                            key={`${alert.id}-${alert.analyzedAt}`}
                            className="flex items-center gap-2 text-[11px] py-0.5 cursor-pointer hover:bg-slate-800/50 rounded px-1 -mx-1"
                            onClick={() => onGoToReports?.(alert.mode)}
                        >
                            <CheckCircle2 className={cn('w-3 h-3 shrink-0',
                                alert.mode === 'algo' ? 'text-blue-400' :
                                alert.mode === 'company' ? 'text-amber-400' : 'text-purple-400'
                            )} />
                            <span className="text-slate-300 truncate">{alert.stockName}</span>
                            <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium',
                                alert.mode === 'algo' ? 'bg-blue-500/10 text-blue-400' :
                                alert.mode === 'company' ? 'bg-amber-500/10 text-amber-400' : 'bg-purple-500/10 text-purple-400'
                            )}>
                                {alert.mode === 'algo' ? '알고리즘' : alert.mode === 'company' ? '기업' : '심층'}
                            </span>
                            <span className="text-slate-600 text-[10px] ml-auto shrink-0">
                                {formatTimeAgo(alert.analyzedAt)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Company Info (dark theme) */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-3">
                    {companyLoading && !companyData ? (
                        <div className="animate-pulse space-y-3">
                            <div className="h-4 w-40 bg-slate-800 rounded" />
                            <div className="h-3 w-full bg-slate-800 rounded" />
                            <div className="h-3 w-3/4 bg-slate-800 rounded" />
                        </div>
                    ) : companyData ? (
                        <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-200">{companyData.stk_nm || currentName}</span>
                                    <span className="text-slate-500 text-xs">{currentSymbol}</span>
                                </div>
                                {companyData.market_cap && (
                                    <span className="text-blue-400 text-xs font-medium">시총 {fmtBillion(companyData.market_cap)}</span>
                                )}
                            </div>

                            {/* 3 diagnosis sections in 2-column grid */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Valuation */}
                                <div className="bg-slate-800/50 rounded-lg p-2.5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <SignalDot signal={valSignal} />
                                        <span className={`font-bold text-[11px] ${SIGNAL_STYLES[valSignal].text}`}>가치평가</span>
                                    </div>
                                    {perEval && <MetricItem label="PER" value={companyData.per?.toFixed(1) ?? '-'} signal={perEval.signal} comment={perEval.comment} />}
                                    {pbrEval && <MetricItem label="PBR" value={companyData.pbr?.toFixed(2) ?? '-'} signal={pbrEval.signal} comment={pbrEval.comment} />}
                                    {companyData.ev != null && (
                                        <div className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-slate-500">EV</span>
                                            <span className="font-medium text-slate-300">{companyData.ev.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Profitability */}
                                <div className="bg-slate-800/50 rounded-lg p-2.5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <SignalDot signal={profitSignal} />
                                        <span className={`font-bold text-[11px] ${SIGNAL_STYLES[profitSignal].text}`}>수익성</span>
                                    </div>
                                    {roeEval && <MetricItem label="ROE" value={companyData.roe ? `${companyData.roe.toFixed(1)}%` : '-'} signal={roeEval.signal} comment={roeEval.comment} />}
                                    <div className="flex items-center justify-between text-xs py-0.5">
                                        <span className="text-slate-500">매출</span>
                                        <span className="font-medium text-slate-300">{fmtBillion(companyData.sales)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs py-0.5">
                                        <span className="text-slate-500">영업이익</span>
                                        <span className="font-medium text-slate-300">{fmtBillion(companyData.operating_profit)}</span>
                                    </div>
                                    {companyData.operating_profit != null && companyData.sales != null && companyData.sales > 0 && (
                                        <div className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-slate-500">영업이익률</span>
                                            <span className="font-medium text-slate-300">{((companyData.operating_profit / companyData.sales) * 100).toFixed(1)}%</span>
                                        </div>
                                    )}
                                </div>

                                {/* Appeal */}
                                <div className="bg-slate-800/50 rounded-lg p-2.5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <SignalDot signal={appealSignal} />
                                        <span className={`font-bold text-[11px] ${SIGNAL_STYLES[appealSignal].text}`}>투자매력</span>
                                    </div>
                                    {foreignEval && <MetricItem label="외인" value={companyData.foreign_ratio != null ? `${companyData.foreign_ratio.toFixed(1)}%` : '-'} signal={foreignEval.signal} comment={foreignEval.comment} />}
                                    {creditEval && <MetricItem label="신용" value={companyData.credit_ratio != null ? `${companyData.credit_ratio.toFixed(1)}%` : '-'} signal={creditEval.signal} comment={creditEval.comment} />}
                                    {companyData.year_high != null && (
                                        <div className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-slate-500">연중 범위</span>
                                            <span className="font-medium text-slate-300">{fmtCompact(Math.abs(companyData.year_low ?? 0))}~{fmtCompact(Math.abs(companyData.year_high))}</span>
                                        </div>
                                    )}
                                    {companyData.dividend_rate != null && companyData.dividend_rate > 0 && (
                                        <div className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-slate-500">배당률</span>
                                            <span className="font-medium text-slate-300">{companyData.dividend_rate.toFixed(2)}%</span>
                                        </div>
                                    )}
                                </div>

                                {/* Summary */}
                                <div className="bg-slate-800/50 rounded-lg p-2.5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="font-bold text-[11px] text-slate-300">종합</span>
                                    </div>
                                    <div className="space-y-1 text-[11px] text-slate-400">
                                        <div>EPS {fmt(companyData.eps)}</div>
                                        <div>BPS {fmt(companyData.bps)}</div>
                                        <div>순이익 {fmtBillion(companyData.net_income)}</div>
                                        {companyData.settle_month && <div>결산 {companyData.settle_month}월</div>}
                                    </div>
                                </div>

                                {/* DART 기업개황 */}
                                {companyData.dart_overview && (
                                    <div className="bg-slate-800/50 rounded-lg p-2.5">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className="font-bold text-[11px] text-slate-300">기업 추가정보</span>
                                            <span className="text-[9px] text-slate-500">DART</span>
                                        </div>
                                        <div className="space-y-1 text-[11px] text-slate-400">
                                            <div className="flex justify-between"><span>업종</span><span className="text-slate-300">{companyData.dart_overview.induty_name}</span></div>
                                            <div className="flex justify-between"><span>종목명</span><span className="text-slate-300">{companyData.dart_overview.stock_name}</span></div>
                                            <div className="flex justify-between"><span>대표자</span><span className="text-slate-300">{companyData.dart_overview.ceo_nm}</span></div>
                                            {companyData.dart_overview.est_dt && (
                                                <div className="flex justify-between"><span>설립일</span><span className="text-slate-300">{companyData.dart_overview.est_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}</span></div>
                                            )}
                                            {companyData.dart_overview.hm_url && (
                                                <div className="flex justify-between"><span>홈페이지</span><a href={companyData.dart_overview.hm_url.startsWith('http') ? companyData.dart_overview.hm_url : `https://${companyData.dart_overview.hm_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[120px]">{companyData.dart_overview.hm_url.replace(/^https?:\/\//, '')}</a></div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Summary Opinion */}
                            <div className="bg-slate-800/50 rounded-lg p-3 mt-3">
                                <span className="font-bold text-xs text-slate-300">종합 의견</span>
                                <p className="text-sm text-slate-400 leading-relaxed mt-1.5 whitespace-pre-wrap">
                                    {generateSummary(companyData)}
                                </p>
                            </div>

                            {/* Investor Daily Table (0796 style) */}
                            {investorHistory.length > 0 && (() => {
                                const fmtAmt = (v: number) => {
                                    const s = v > 0 ? '+' : v < 0 ? '-' : '';
                                    const abs = Math.abs(v);
                                    return `${s}${abs.toLocaleString()}`;
                                };
                                const clr = (v: number) => v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-slate-600';
                                return (
                                <div className="bg-slate-800/50 rounded-lg p-2 mt-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-slate-300">투자자별 매매동향 <span className="text-slate-500 font-normal">(정규장)</span></span>
                                        <span className="text-[10px] text-slate-500">단위: 백만원</span>
                                    </div>

                                    {/* Cumulative */}
                                    {investorCumulative && (
                                        <div className="flex items-center gap-1.5 mt-1.5 mb-2 text-[11px] bg-slate-900/50 rounded px-2 py-1">
                                            <span className="text-slate-500">누적</span>
                                            <span className={clr(investorCumulative.individual)}>
                                                개인 {fmtAmt(investorCumulative.individual)}
                                            </span>
                                            <span className={clr(investorCumulative.foreign)}>
                                                외인 {fmtAmt(investorCumulative.foreign)}
                                            </span>
                                            <span className={clr(investorCumulative.institution)}>
                                                기관 {fmtAmt(investorCumulative.institution)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Scrollable list — grid layout */}
                                    <div className="max-h-[280px] overflow-y-auto overflow-x-hidden text-[10px]">
                                        {/* Header */}
                                        <div className="grid text-slate-500 border-b border-slate-700 pb-0.5 mb-0.5 sticky top-0 bg-slate-800/95 z-10" style={{gridTemplateColumns:'32px 48px 50px 48px 1fr 1fr 1fr'}}>
                                            <span>일자</span>
                                            <span className="text-right">종가</span>
                                            <span className="text-right">대비</span>
                                            <span className="text-right">거래량</span>
                                            <span className="text-right">개인</span>
                                            <span className="text-right">외국인</span>
                                            <span className="text-right">기관</span>
                                        </div>
                                        {/* Rows */}
                                        {investorHistory.map(row => {
                                            const sign = (v: number) => v > 0 ? `+${v}` : `${v}`;
                                            const dt = row.date ? `${row.date.slice(4, 6)}/${row.date.slice(6, 8)}` : '';
                                            const vol = row.volume >= 1_000_000 ? `${(row.volume / 1_000_000).toFixed(1)}M` : row.volume >= 1000 ? `${Math.round(row.volume / 1000)}K` : `${row.volume}`;
                                            return (
                                                <div key={row.date} className="grid border-b border-slate-800/20 hover:bg-slate-700/30 py-0.5" style={{gridTemplateColumns:'32px 48px 50px 48px 1fr 1fr 1fr'}}>
                                                    <span className="text-slate-400">{dt}</span>
                                                    <span className="text-right text-slate-300 font-mono">{row.close?.toLocaleString() || '-'}</span>
                                                    <span className={`text-right font-mono ${clr(row.change)}`}>{row.change ? sign(row.change) : '-'}</span>
                                                    <span className="text-right text-slate-500 font-mono">{vol}</span>
                                                    <span className={`text-right font-mono ${clr(row.individual)}`}>{fmtAmt(row.individual)}</span>
                                                    <span className={`text-right font-mono ${clr(row.foreign)}`}>{fmtAmt(row.foreign)}</span>
                                                    <span className={`text-right font-mono ${clr(row.institution)}`}>{fmtAmt(row.institution)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="text-center text-slate-600 text-xs py-8">
                            종목을 선택하면 기업 정보가 표시됩니다
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
