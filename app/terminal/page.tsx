"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { UnifiedSidebar } from "@/components/features/sidebar/unified-sidebar";
import { AccountStatus } from "@/components/features/stock/account-status";
import { StockSearchModal } from "@/components/features/stock/stock-search-modal";
import { useWatchlist } from "@/lib/hooks/use-watchlist";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Wallet, Search, FileText, TrendingUp, TrendingDown,
    Plus, BarChart3, Brain, Building2, MessageCircle, Power, ExternalLink, Pencil
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockQuote {
    price: number; change: number; changePercent: number; volume: number; open: number;
}

interface ChartPoint {
    timestamp: string; close: number; volume: number;
}

interface ExitPlan {
    preset?: string; base_price?: number;
    target_price?: number; target_pct?: number;
    p1_price?: number; p1_pct?: number; p1_sell?: number;
    p2_price?: number; p2_pct?: number; p2_sell?: number;
    sl_price?: number; sl_pct?: number; sl_note?: string;
    a1_price?: number; a1_pct?: number; a1_weight?: number;
    a2_price?: number; a2_pct?: number; a2_weight?: number;
}

interface MemoEntry { text: string; created_at: string; }

interface TradeNote {
    id: number; symbol: string; stock_name: string;
    trade_date: string; trade_type: string; status: string;
    price: number | null; quantity: number | null; portfolio_pct: number | null;
    target_price: number | null; stop_loss: number | null;
    buy_reason: string | null; market_context: string | null;
    add_buy_plan: string | null; review: string | null;
    psychology: string | null; result_summary: string | null;
    profit_pct: number | null;
    watch_data: { exit_plan?: ExitPlan; memos?: MemoEntry[] } | null;
}

interface CompanyData {
    stk_nm: string; market_cap: number | null; settle_month: string;
    per: number | null; pbr: number | null; roe: number | null; ev: number | null;
    eps: number | null; bps: number | null; net_income: number | null;
    sales: number | null; operating_profit: number | null; operating_profit_growth: number | null;
    foreign_ratio: number | null; credit_ratio: number | null;
    year_high: number | null; year_low: number | null; dividend_rate: number | null;
    dart_overview?: { induty_name?: string; ceo_nm?: string; hm_url?: string } | null;
}

interface InvestorRow {
    date: string; close: number; change: number; volume: number;
    individual: number; foreign: number; institution: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = { hold: '보유중', closed: '완료', watch: '관심' };
const TYPE_LABELS: Record<string, string> = { buy: '매수', sell: '매도', watch: '관심' };
const PRESET_LABELS: Record<string, string> = {
    momentum: '🚀 고성장 주도주', value: '💎 가치주', growth: '📈 성장주',
    bluechip: '🏢 대형 우량주', swing: '🔄 스윙', custom: '⚙️ 커스텀',
};
const STATUS_COLORS: Record<string, string> = {
    hold: 'bg-blue-50 text-blue-700 border-blue-200',
    closed: 'bg-gray-50 text-gray-500 border-gray-200',
    watch: 'bg-amber-50 text-amber-700 border-amber-200',
};

function fmtNum(n: number) { return new Intl.NumberFormat('ko-KR').format(Math.round(n)); }
function fmtBn(n: number | null) {
    if (n == null) return '-';
    const abs = Math.abs(n);
    if (abs >= 10000) return `${(n / 10000).toFixed(1)}조`;
    return `${Math.round(n)}억`;
}
function pctStr(n: number) { return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`; }

// ─── SimpleChart ──────────────────────────────────────────────────────────────

function SimpleChart({ symbol, name }: { symbol: string; name: string }) {
    const [quote, setQuote] = useState<StockQuote | null>(null);
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [avgPrice, setAvgPrice] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        Promise.all([
            fetch(`/api/stock/quote?symbol=${symbol}`).then(r => r.ok ? r.json() : null),
            fetch(`/api/stock/chart?symbol=${symbol}&interval=D`).then(r => r.ok ? r.json() : []),
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/notes?symbol=${symbol}&status=hold`).then(r => r.ok ? r.json() : []),
        ]).then(([q, c, notes]) => {
            if (ignore) return;
            if (q) setQuote(q);
            setChartData(Array.isArray(c) ? c.slice(-120) : []);
            const holdNote = Array.isArray(notes) && notes.length > 0 ? notes[0] : null;
            setAvgPrice(holdNote?.price ?? null);
        }).catch(() => { }).finally(() => { if (!ignore) setLoading(false); });
        return () => { ignore = true; };
    }, [symbol]);

    const isUp = (quote?.change ?? 0) >= 0;
    const color = isUp ? '#ef4444' : '#3b82f6';
    const prices = chartData.map(d => d.close);
    if (avgPrice) prices.push(avgPrice);
    const minVal = prices.length > 0 ? Math.min(...prices) * 0.998 : 0;
    const maxVal = prices.length > 0 ? Math.max(...prices) * 1.002 : 0;

    return (
        <div className="flex flex-col h-full">
            {/* 주가 헤더 */}
            <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-lg text-gray-900">{name}</span>
                    <span className="text-xs text-gray-400">{symbol}</span>
                </div>
                {loading && !quote ? (
                    <div className="h-7 w-48 bg-gray-100 rounded animate-pulse mt-1" />
                ) : quote ? (
                    <div className="flex items-baseline gap-3 mt-0.5 flex-wrap">
                        <span className={`text-2xl font-bold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                            ₩{fmtNum(quote.price)}
                        </span>
                        <span className={`text-sm font-medium ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                            {isUp ? '▲' : '▼'} {fmtNum(Math.abs(quote.change))} ({isUp ? '+' : ''}{quote.changePercent?.toFixed(2)}%)
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">거래량 {fmtNum(quote.volume)}</span>
                    </div>
                ) : null}
            </div>

            {/* 심플 면적 차트 */}
            <div className="flex-1 min-h-0 px-1 py-2">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="timestamp"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v: string) => {
                                    if (!v || v.length < 8) return v;
                                    return `${v.slice(4, 6)}/${v.slice(6, 8)}`;
                                }}
                                interval={Math.floor(chartData.length / 6)}
                            />
                            <YAxis
                                domain={[minVal, maxVal]}
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickLine={false}
                                axisLine={false}
                                width={62}
                                tickFormatter={(v: number) => fmtNum(v)}
                                orientation="right"
                            />
                            <Tooltip
                                contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px' }}
                                formatter={(v: number) => [`₩${fmtNum(v)}`, '종가']}
                                labelFormatter={(l: string) => l}
                            />
                            <Area
                                type="monotone"
                                dataKey="close"
                                stroke={color}
                                strokeWidth={2}
                                fill={`url(#grad-${symbol})`}
                                dot={false}
                                isAnimationActive={false}
                            />
                            {avgPrice && (
                                <ReferenceLine
                                    y={avgPrice}
                                    stroke="#f59e0b"
                                    strokeDasharray="4 3"
                                    strokeWidth={1.5}
                                    label={{ value: `평단 ₩${fmtNum(avgPrice)}`, position: 'left', fontSize: 10, fill: '#f59e0b', fontWeight: 600 }}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-sm text-gray-400">
                        {loading ? '로딩 중...' : '데이터 없음'}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── NoteDetailPanel ─────────────────────────────────────────────────────────

function NoteDetailPanel({ notes, symbol, name }: { notes: TradeNote[]; symbol: string; name: string }) {
    const router = useRouter();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // 가장 관련성 높은 노트 자동 선택: 보유중 > 최신 순
    const activeNote = selectedId
        ? notes.find(n => n.id === selectedId) ?? notes[0]
        : notes.find(n => n.status === 'hold') ?? notes[0];

    if (notes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                <FileText size={28} className="text-gray-300 mb-3" />
                <p className="text-sm text-gray-400 mb-4">이 종목의 매매노트가 없습니다</p>
                <button
                    onClick={() => router.push(`/notes/new?symbol=${symbol}&name=${encodeURIComponent(name)}`)}
                    className="flex items-center gap-1 text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Plus size={12} /> 매매노트 작성하기
                </button>
            </div>
        );
    }

    // watch_data가 string으로 올 경우 파싱
    const watchData = (() => {
        const wd = activeNote?.watch_data;
        if (!wd) return null;
        if (typeof wd === 'string') { try { return JSON.parse(wd); } catch { return null; } }
        return wd;
    })();
    const ep = watchData?.exit_plan as ExitPlan | undefined;
    const memos: MemoEntry[] = watchData?.memos ?? [];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* 노트 탭 선택 */}
            {notes.length > 0 && (
                <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto border-b border-gray-100 shrink-0">
                    {notes.map(n => (
                        <button
                            key={n.id}
                            onClick={() => setSelectedId(n.id)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${
                                (activeNote?.id === n.id)
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'text-gray-400 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {n.trade_date.slice(5)} {STATUS_LABELS[n.status] ?? n.status}
                        </button>
                    ))}
                    <button
                        onClick={() => router.push(`/notes/new?symbol=${symbol}&name=${encodeURIComponent(name)}`)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-300 whitespace-nowrap"
                    >
                        + 새 노트
                    </button>
                </div>
            )}

            {/* 노트 내용 스크롤 */}
            {activeNote && (
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

                    {/* 기본 정보 */}
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">기본 정보</span>
                            <button
                                onClick={() => router.push(`/notes/${activeNote.id}`)}
                                className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700"
                            >
                                <Pencil size={10} /> 편집
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div>
                                <p className="text-[10px] text-gray-400">유형</p>
                                <p className="text-sm font-semibold text-gray-800">{TYPE_LABELS[activeNote.trade_type] ?? activeNote.trade_type}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400">상태</p>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[activeNote.status] ?? STATUS_COLORS.closed}`}>
                                    {STATUS_LABELS[activeNote.status] ?? activeNote.status}
                                </span>
                            </div>
                            {activeNote.price != null && (
                                <div>
                                    <p className="text-[10px] text-gray-400">평균 매수가</p>
                                    <p className="text-sm font-bold text-gray-900">₩{fmtNum(activeNote.price)}</p>
                                </div>
                            )}
                            {activeNote.quantity != null && (
                                <div>
                                    <p className="text-[10px] text-gray-400">수량</p>
                                    <p className="text-sm font-semibold text-gray-800">{activeNote.quantity}주</p>
                                </div>
                            )}
                            {activeNote.portfolio_pct != null && (
                                <div>
                                    <p className="text-[10px] text-gray-400">비중</p>
                                    <p className="text-sm font-semibold text-gray-800">{activeNote.portfolio_pct}%</p>
                                </div>
                            )}
                            <div>
                                <p className="text-[10px] text-gray-400">날짜</p>
                                <p className="text-sm text-gray-700">{activeNote.trade_date}</p>
                            </div>
                        </div>
                    </div>

                    {/* 매도 계획 */}
                    {(ep || activeNote.target_price || activeNote.stop_loss) && (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                            {/* 헤더: 프리셋 이름 */}
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                매도 계획{ep?.preset && (
                                    <span className="normal-case ml-1.5 text-blue-500 font-medium">
                                        — {PRESET_LABELS[ep.preset] ?? ep.preset}
                                    </span>
                                )}
                            </p>

                            {/* 기준가 / 목표가 */}
                            {(ep?.base_price || ep?.target_price) && (
                                <div className="grid grid-cols-2 gap-2">
                                    {ep.base_price && (
                                        <div className="bg-white rounded-md px-3 py-2 border border-gray-100">
                                            <p className="text-[10px] text-gray-400 mb-0.5">기준 주가</p>
                                            <p className="text-sm font-bold text-gray-800">₩{fmtNum(ep.base_price)}</p>
                                        </div>
                                    )}
                                    {ep.target_price && (
                                        <div className="bg-white rounded-md px-3 py-2 border border-gray-100">
                                            <p className="text-[10px] text-gray-400 mb-0.5">목표 주가</p>
                                            <div className="flex items-baseline gap-1.5">
                                                <p className="text-sm font-bold text-emerald-600">₩{fmtNum(ep.target_price)}</p>
                                                {ep.target_pct && <span className="text-xs text-emerald-500">{pctStr(ep.target_pct)}</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 익절 계획 */}
                            {(ep?.p1_price || ep?.p2_price || (!ep && activeNote.target_price)) && (
                                <div>
                                    <p className="text-[10px] font-semibold text-red-500 mb-1.5">📈 익절 계획</p>
                                    <div className="space-y-1">
                                        {ep?.p1_price && (
                                            <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-600">1차 익절</span>
                                                    {ep.p1_sell && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">매도 {ep.p1_sell}%</span>}
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-sm font-bold text-red-600">₩{fmtNum(ep.p1_price)}</span>
                                                    {ep.p1_pct && <span className="text-xs text-red-400">{pctStr(ep.p1_pct)}</span>}
                                                </div>
                                            </div>
                                        )}
                                        {ep?.p2_price && (
                                            <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-600">2차 익절</span>
                                                    {ep.p2_sell && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">매도 {ep.p2_sell}%</span>}
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-sm font-bold text-red-500">₩{fmtNum(ep.p2_price)}</span>
                                                    {ep.p2_pct && <span className="text-xs text-red-400">{pctStr(ep.p2_pct)}</span>}
                                                </div>
                                            </div>
                                        )}
                                        {!ep?.p1_price && activeNote.target_price && (
                                            <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-gray-100">
                                                <span className="text-xs text-gray-600">목표가</span>
                                                <span className="text-sm font-bold text-red-600">₩{fmtNum(activeNote.target_price)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 손절 계획 */}
                            {(ep?.sl_price || activeNote.stop_loss) && (
                                <div>
                                    <p className="text-[10px] font-semibold text-blue-500 mb-1.5">🔴 손절 계획</p>
                                    <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-red-100">
                                        <span className="text-xs text-gray-600">손절가</span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-sm font-bold text-blue-600">₩{fmtNum((ep?.sl_price ?? activeNote.stop_loss)!)}</span>
                                            {ep?.sl_pct && <span className="text-xs text-blue-400">{pctStr(ep.sl_pct)}</span>}
                                        </div>
                                    </div>
                                    {ep?.sl_note && <p className="text-[10px] text-gray-400 mt-1 px-1">{ep.sl_note}</p>}
                                </div>
                            )}

                            {/* 추가 매수 계획 */}
                            {(ep?.a1_price || ep?.a2_price || activeNote.add_buy_plan) && (
                                <div>
                                    <p className="text-[10px] font-semibold text-amber-500 mb-1.5">🔄 추가 매수 계획</p>
                                    <div className="space-y-1">
                                        {ep?.a1_price && (
                                            <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-600">1차 추가매수</span>
                                                    {ep.a1_weight && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비중 {ep.a1_weight}%</span>}
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-sm font-bold text-amber-600">₩{fmtNum(ep.a1_price)}</span>
                                                    {ep.a1_pct && <span className="text-xs text-amber-400">{pctStr(ep.a1_pct)}</span>}
                                                </div>
                                            </div>
                                        )}
                                        {ep?.a2_price && (
                                            <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-600">2차 추가매수</span>
                                                    {ep.a2_weight && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">비중 {ep.a2_weight}%</span>}
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-sm font-bold text-amber-600">₩{fmtNum(ep.a2_price)}</span>
                                                    {ep.a2_pct && <span className="text-xs text-amber-400">{pctStr(ep.a2_pct)}</span>}
                                                </div>
                                            </div>
                                        )}
                                        {activeNote.add_buy_plan && (
                                            <div className="bg-white rounded-md px-3 py-2 border border-amber-100">
                                                <p className="text-xs text-gray-600">{activeNote.add_buy_plan}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 매수 이유 */}
                    {activeNote.buy_reason && (
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">매수 이유</p>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{activeNote.buy_reason}</p>
                        </div>
                    )}

                    {/* 시장 컨텍스트 */}
                    {activeNote.market_context && (
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">시장 컨텍스트</p>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{activeNote.market_context}</p>
                        </div>
                    )}

                    {/* 매매 심리 */}
                    {activeNote.psychology && (
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">매매 심리</p>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{activeNote.psychology}</p>
                        </div>
                    )}

                    {/* 복기 / 결과 */}
                    {(activeNote.review || activeNote.result_summary) && (
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                복기{activeNote.profit_pct != null && <span className={`ml-2 font-normal ${activeNote.profit_pct >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{pctStr(activeNote.profit_pct)}</span>}
                            </p>
                            {activeNote.result_summary && <p className="text-xs text-gray-600 mb-1 font-medium">{activeNote.result_summary}</p>}
                            {activeNote.review && <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{activeNote.review}</p>}
                        </div>
                    )}

                    {/* 메모 */}
                    {memos.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">메모</p>
                            <div className="space-y-2">
                                {memos.map((m, i) => (
                                    <div key={i} className="bg-white rounded-md px-3 py-2 border border-gray-100">
                                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{m.text}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{new Date(m.created_at).toLocaleDateString('ko-KR')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── CompanyPanel ─────────────────────────────────────────────────────────────

function MetricItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400">{label}</span>
            <div>
                <span className="text-xs font-semibold text-gray-800">{value}</span>
                {sub && <span className="text-[10px] text-gray-400 ml-1">{sub}</span>}
            </div>
        </div>
    );
}

function CompanyPanel({ symbol, name }: { symbol: string; name: string }) {
    const [data, setData] = useState<CompanyData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let ignore = false;
        setData(null); setLoading(true);
        fetch(`/api/company/${symbol}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (!ignore && d?.data) setData(d.data); })
            .catch(() => { })
            .finally(() => { if (!ignore) setLoading(false); });
        return () => { ignore = true; };
    }, [symbol]);

    if (loading) return <div className="p-4 text-xs text-gray-400 animate-pulse">로딩 중...</div>;
    if (!data) return <div className="p-4 text-xs text-gray-400">데이터 없음</div>;

    return (
        <div className="p-4 space-y-4 overflow-y-auto h-full">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="font-bold text-gray-800 text-sm">{data.stk_nm || name}</span>
                {data.market_cap && <span className="text-sm font-semibold text-blue-600">시총 {fmtBn(data.market_cap)}</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <div>
                    <p className="text-[10px] font-bold text-blue-500 uppercase mb-1.5">가치평가</p>
                    <MetricItem label="PER" value={data.per != null ? `${data.per.toFixed(1)}x` : '-'} />
                    <MetricItem label="PBR" value={data.pbr != null ? `${data.pbr.toFixed(2)}x` : '-'} />
                    <MetricItem label="EV" value={data.ev != null ? `${data.ev.toFixed(1)}` : '-'} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1.5">수익성</p>
                    <MetricItem label="ROE" value={data.roe != null ? `${data.roe.toFixed(1)}%` : '-'} />
                    <MetricItem label="매출" value={fmtBn(data.sales)} />
                    <MetricItem label="영업이익" value={fmtBn(data.operating_profit)}
                        sub={data.operating_profit_growth != null ? `${data.operating_profit_growth > 0 ? '+' : ''}${data.operating_profit_growth.toFixed(0)}%` : undefined} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-purple-500 uppercase mb-1.5">투자매력</p>
                    <MetricItem label="외인" value={data.foreign_ratio != null ? `${data.foreign_ratio.toFixed(1)}%` : '-'} />
                    <MetricItem label="신용" value={data.credit_ratio != null ? `${data.credit_ratio.toFixed(1)}%` : '-'} />
                    <MetricItem label="배당률" value={data.dividend_rate != null && data.dividend_rate > 0 ? `${data.dividend_rate.toFixed(2)}%` : '-'} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-amber-500 uppercase mb-1.5">기업정보</p>
                    {data.dart_overview?.induty_name && <MetricItem label="업종" value={data.dart_overview.induty_name} />}
                    {data.dart_overview?.ceo_nm && <MetricItem label="대표자" value={data.dart_overview.ceo_nm} />}
                    <MetricItem label="연중범위" value={data.year_low != null && data.year_high != null ? `${fmtNum(data.year_low)}~${fmtNum(data.year_high)}` : '-'} />
                </div>
            </div>
            <div className="pt-2 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">종합 의견</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        {[
                            // 밸류에이션
                            data.per != null && data.per > 0 && data.per < 10
                                ? `PER ${data.per.toFixed(1)}배 — 매우 저평가 구간.`
                                : data.per != null && data.per > 0 && data.per < 20
                                ? `PER ${data.per.toFixed(1)}배 — 저평가 구간.`
                                : data.per != null && data.per >= 20 && data.per < 30
                                ? `PER ${data.per.toFixed(1)}배 — 적정 수준.`
                                : data.per != null && data.per >= 30
                                ? `PER ${data.per.toFixed(1)}배 — 고평가 주의.`
                                : null,
                            data.pbr != null && data.pbr > 0 && data.pbr < 1
                                ? `PBR ${data.pbr.toFixed(2)}배 — 순자산 이하 거래.`
                                : data.pbr != null && data.pbr > 0
                                ? `PBR ${data.pbr.toFixed(2)}배.`
                                : null,
                            // 수익성
                            data.roe != null && data.roe > 15
                                ? `ROE ${data.roe.toFixed(1)}% — 자본효율 우수.`
                                : data.roe != null && data.roe > 10
                                ? `ROE ${data.roe.toFixed(1)}% — 자본효율 양호.`
                                : data.roe != null && data.roe > 0
                                ? `ROE ${data.roe.toFixed(1)}%.`
                                : null,
                            data.operating_profit != null && data.sales != null && data.sales > 0
                                ? `영업이익률 ${((data.operating_profit / data.sales) * 100).toFixed(1)}%.`
                                : null,
                            data.operating_profit_growth != null
                                ? data.operating_profit_growth > 20
                                    ? `영업이익 전년比 +${data.operating_profit_growth.toFixed(0)}% 고성장.`
                                    : data.operating_profit_growth < -10
                                    ? `영업이익 전년比 ${data.operating_profit_growth.toFixed(0)}% 역성장 주의.`
                                    : `영업이익 전년比 ${data.operating_profit_growth > 0 ? '+' : ''}${data.operating_profit_growth.toFixed(0)}%.`
                                : null,
                            // 외인/배당
                            data.foreign_ratio != null && data.foreign_ratio > 40
                                ? `외인 비중 ${data.foreign_ratio.toFixed(1)}% — 수급 우호적.`
                                : data.foreign_ratio != null && data.foreign_ratio > 0
                                ? `외인 비중 ${data.foreign_ratio.toFixed(1)}%.`
                                : null,
                            data.dividend_rate != null && data.dividend_rate > 3
                                ? `배당수익률 ${data.dividend_rate.toFixed(2)}% — 고배당.`
                                : data.dividend_rate != null && data.dividend_rate > 0
                                ? `배당수익률 ${data.dividend_rate.toFixed(2)}%.`
                                : null,
                            // 연중범위
                            data.year_high != null && data.year_low != null
                                ? `52주 범위 ${fmtNum(data.year_low)}~${fmtNum(data.year_high)}원.`
                                : null,
                        ].filter(Boolean).join(' ') || '데이터 불충분'}
                    </p>
                </div>
        </div>
    );
}

// ─── InvestorTable ────────────────────────────────────────────────────────────

function InvestorTable({ rows }: { rows: InvestorRow[] }) {
    if (rows.length === 0) return <p className="text-xs text-gray-400 py-3 text-center">데이터 없음</p>;
    const fmtAmt = (v: number) => { const s = v > 0 ? '+' : v < 0 ? '-' : ''; const a = Math.abs(v); return `${s}${a >= 1000 ? `${(a / 1000).toFixed(0)}B` : a}`; };
    const clr = (v: number) => v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-500' : 'text-gray-300';
    return (
        <div className="overflow-auto max-h-52">
            <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left py-1 pr-2 font-medium">일자</th>
                        <th className="text-right py-1 pr-2 font-medium">종가</th>
                        <th className="text-right py-1 pr-2 font-medium">개인</th>
                        <th className="text-right py-1 pr-2 font-medium">외인</th>
                        <th className="text-right py-1 font-medium">기관</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 20).map(row => {
                        const dt = row.date ? `${row.date.slice(4, 6)}/${row.date.slice(6, 8)}` : '';
                        return (
                            <tr key={row.date} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-0.5 pr-2 text-gray-500">{dt}</td>
                                <td className="py-0.5 pr-2 text-right font-mono text-gray-700">{row.close?.toLocaleString()}</td>
                                <td className={`py-0.5 pr-2 text-right font-mono ${clr(row.individual)}`}>{fmtAmt(row.individual)}</td>
                                <td className={`py-0.5 pr-2 text-right font-mono ${clr(row.foreign)}`}>{fmtAmt(row.foreign)}</td>
                                <td className={`py-0.5 text-right font-mono ${clr(row.institution)}`}>{fmtAmt(row.institution)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TerminalPage() {
    const router = useRouter();
    const [activeSymbol, setActiveSymbol] = useState("005930");
    const [activeName, setActiveName] = useState("삼성전자");
    const [botRunning, setBotRunning] = useState(false);
    const [botLoading, setBotLoading] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [symbolNotes, setSymbolNotes] = useState<TradeNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [investorHistory, setInvestorHistory] = useState<InvestorRow[]>([]);
    const [loadingAlgo, setLoadingAlgo] = useState(false);
    const [loadingDeep, setLoadingDeep] = useState(false);
    const [loadingCompany, setLoadingCompany] = useState(false);

    const { watchlist, activeGroup, setActiveGroup, isLoaded, addToWatchlist, removeFromWatchlist, isInWatchlist, changeGroup } = useWatchlist();

    useEffect(() => {
        const checkURL = () => {
            const params = new URLSearchParams(window.location.search);
            const stock = params.get('stock');
            if (stock && stock !== activeSymbol) { setActiveSymbol(stock); fetchStockName(stock); }
        };
        checkURL();
        const iv = setInterval(checkURL, 500);
        window.addEventListener('popstate', checkURL);
        return () => { clearInterval(iv); window.removeEventListener('popstate', checkURL); };
    }, [activeSymbol]);

    useEffect(() => {
        if (!activeSymbol) return;
        setSymbolNotes([]); setNotesLoading(true);
        fetch(`/api/notes?symbol=${activeSymbol}&limit=10`)
            .then(r => r.ok ? r.json() : [])
            .then(d => setSymbolNotes(Array.isArray(d) ? d : []))
            .catch(() => setSymbolNotes([]))
            .finally(() => setNotesLoading(false));
    }, [activeSymbol]);

    useEffect(() => {
        if (!activeSymbol) return;
        setInvestorHistory([]);
        fetch(`/api/stock/investor-history?symbol=${activeSymbol}&days=30`)
            .then(r => r.ok ? r.json() : { data: [] })
            .then(d => setInvestorHistory(Array.isArray(d.data) ? d.data : []))
            .catch(() => setInvestorHistory([]));
    }, [activeSymbol]);

    const fetchStockName = async (code: string) => {
        try {
            const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/stocks/${code}`);
            const d = await r.json(); if (d.name) setActiveName(d.name);
        } catch { }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsSearchOpen(p => !p); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        const check = async () => { try { setBotRunning((await (await fetch('/api/bot')).json()).running); } catch { setBotRunning(false); } };
        check(); const t = setInterval(check, 5000); return () => clearInterval(t);
    }, []);

    const toggleBot = async () => {
        setBotLoading(true);
        try { const d = await (await fetch('/api/bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: botRunning ? 'stop' : 'start' }) })).json(); if (d.success) setBotRunning(!botRunning); }
        catch { } finally { setBotLoading(false); }
    };

    const triggerAnalysis = async (type: 'algo' | 'deep' | 'company') => {
        const sl = type === 'algo' ? setLoadingAlgo : type === 'deep' ? setLoadingDeep : setLoadingCompany;
        const ep: Record<string, string> = { algo: '/api/ai/algo-analysis-start', deep: '/api/ai/deep-analysis-start', company: '/api/ai/company-analysis-start' };
        const lb: Record<string, string> = { algo: '알고리즘', deep: '종합', company: '기업' };
        sl(true);
        try { const r = await fetch(ep[type], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: activeSymbol }) }); if (!r.ok) throw new Error(); toast.success(`${lb[type]} 분석 시작`, { description: activeName }); }
        catch { toast.error('분석 시작 실패'); } finally { sl(false); }
    };

    const handleSelectStock = (symbol: string, name: string) => { setActiveSymbol(symbol); setActiveName(name); };
    const anyLoading = loadingAlgo || loadingDeep || loadingCompany;

    return (
        <main className="min-h-screen bg-white text-gray-900">
            <div className="h-screen flex flex-col">

                {/* ── 헤더 ── */}
                <header className="shrink-0 flex justify-between items-center px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <a href="/" className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-500">StockIQ</a>
                        <span className="text-gray-400 text-xs border-l border-gray-200 pl-3">종목 분석</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                        <button onClick={() => setIsSearchOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg">
                            <Search size={12} /> 종목 검색 <kbd className="px-1 text-[10px] bg-white border border-gray-200 rounded">⌘K</kbd>
                        </button>
                        <button onClick={() => router.push('/reports')} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">보고서</button>
                        <button onClick={() => router.push('/macro')} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">매크로</button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                                    <Wallet size={11} className="text-emerald-600" /> 계좌
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px]">
                                <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet size={16} className="text-emerald-500" /> 계좌현황 (0198)</DialogTitle></DialogHeader>
                                <div className="h-[400px]"><AccountStatus /></div>
                            </DialogContent>
                        </Dialog>
                        <button onClick={toggleBot} disabled={botLoading}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ${botRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'} ${botLoading ? 'opacity-50' : ''}`}>
                            <Power size={11} className={botLoading ? 'animate-pulse' : ''} />
                            {botLoading ? '...' : botRunning ? '봇 종료' : '봇 시작'}
                        </button>
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${botRunning ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{botRunning ? 'ON' : 'OFF'}</span>
                        <button onClick={() => window.open('https://t.me/stocktome_bot', '_blank')} className="flex items-center gap-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs rounded-lg">
                            <MessageCircle size={11} /> 텔레그램
                        </button>
                        <button onClick={() => router.push('/alpha-hr')} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg">Alpha-HR</button>
                    </div>
                </header>

                {/* ── 바디 ── */}
                <div className="flex flex-1 min-h-0">
                    {isLoaded && (
                        <UnifiedSidebar
                            currentSymbol={activeSymbol}
                            onSelectSymbol={handleSelectStock}
                            watchlist={watchlist}
                            activeGroup={activeGroup}
                            onChangeGroup={setActiveGroup}
                            onRemoveFromWatchlist={removeFromWatchlist}
                            onOpenSearch={() => setIsSearchOpen(true)}
                            onMoveToGroup={changeGroup}
                        />
                    )}

                    {/* ── 메인 콘텐츠 ── */}
                    <div className="flex-1 min-w-0 overflow-y-auto bg-gray-50">
                        <div className="p-4 space-y-4">

                            {/* ── 1행: 차트 | 매매노트 | 기업정보 (3컬럼) ── */}
                            <div className="grid gap-4 h-[520px]" style={{ gridTemplateColumns: '38% 32% 1fr' }}>

                                {/* 차트 (2/3 폭으로 축소, 심플 AreaChart) */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <SimpleChart symbol={activeSymbol} name={activeName} />
                                </div>

                                {/* 매매노트 전체 내용 */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                            <FileText size={13} className="text-gray-400" /> 매매노트
                                        </span>
                                        <button onClick={() => router.push('/notes')} className="text-[11px] text-gray-400 hover:text-blue-600">전체 →</button>
                                    </div>
                                    {notesLoading ? (
                                        <div className="flex items-center justify-center h-32 text-sm text-gray-400">로딩 중...</div>
                                    ) : (
                                        <NoteDetailPanel notes={symbolNotes} symbol={activeSymbol} name={activeName} />
                                    )}
                                </div>

                                {/* 기업정보 */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="px-3 py-2.5 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-700">기업 정보</span>
                                    </div>
                                    <CompanyPanel symbol={activeSymbol} name={activeName} />
                                </div>
                            </div>

                            {/* ── 2행: AI 분석 | 투자자 매매동향 ── */}
                            <div className="grid gap-4" style={{ gridTemplateColumns: '38% 1fr' }}>

                                {/* AI 분석 */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <Brain size={14} className="text-purple-500" /> AI 분석
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        <button onClick={() => triggerAnalysis('algo')} disabled={anyLoading}
                                            className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-700 disabled:opacity-50 transition-colors">
                                            <BarChart3 size={18} className={loadingAlgo ? 'animate-pulse text-blue-500' : 'text-blue-400'} />
                                            <span className="text-xs font-medium">알고리즘</span>
                                        </button>
                                        <button onClick={() => triggerAnalysis('deep')} disabled={anyLoading}
                                            className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600 hover:text-purple-700 disabled:opacity-50 transition-colors">
                                            <Brain size={18} className={loadingDeep ? 'animate-pulse text-purple-500' : 'text-purple-400'} />
                                            <span className="text-xs font-medium">종합</span>
                                        </button>
                                        <button onClick={() => triggerAnalysis('company')} disabled={anyLoading}
                                            className="flex flex-col items-center gap-1.5 py-3 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-600 hover:text-amber-700 disabled:opacity-50 transition-colors">
                                            <Building2 size={18} className={loadingCompany ? 'animate-pulse text-amber-500' : 'text-amber-400'} />
                                            <span className="text-xs font-medium">기업</span>
                                        </button>
                                    </div>
                                    <button onClick={() => router.push('/reports')}
                                        className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-blue-600 py-1.5 hover:bg-blue-50 rounded-lg border border-gray-100 transition-colors">
                                        <ExternalLink size={10} /> 분석 보고서 보기
                                    </button>
                                </div>

                                {/* 투자자 매매동향 */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                                        투자자별 매매동향
                                        <span className="text-[10px] text-gray-400 font-normal">단위: 백만원</span>
                                    </h3>
                                    <InvestorTable rows={investorHistory} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            <StockSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelectStock={handleSelectStock}
                onAddToWatchlist={addToWatchlist}
                isInWatchlist={isInWatchlist}
            />
        </main>
    );
}
