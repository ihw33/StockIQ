'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown, Minus, BookOpen,
  FileText, Star, BarChart2
} from 'lucide-react'
import { usePortfolioStore } from '@/lib/stores/portfolio-store'
import { useWatchlist, WATCHLIST_GROUPS } from '@/lib/hooks/use-watchlist'

type ActiveTab = 'all' | 'hold' | 'closed' | 'watch'
type TradeType = 'buy' | 'sell' | 'watch'

interface TradeNote {
  id: number
  symbol: string
  stock_name: string
  trade_date: string
  trade_type: TradeType
  price: number
  quantity: number
  portfolio_pct: number
  buy_reason: string
  target_price: number
  stop_loss: number
  status: string
  profit_pct: number | null
  result_summary: string
  created_at: string
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

const TYPE_LABELS: Record<string, string> = { buy: '매수', sell: '매도', watch: '관심' }

const GROUP_COLORS = ['text-blue-400 bg-blue-500/10 border-blue-500/20', 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 'text-purple-400 bg-purple-500/10 border-purple-500/20']

function ProfitBadge({ value }: { value: number }) {
  const pos = value > 0, neg = value < 0
  return (
    <div className={`flex items-center gap-1 font-bold text-sm ${pos ? 'text-red-400' : neg ? 'text-blue-400' : 'text-slate-400'}`}>
      {pos ? <TrendingUp size={13} /> : neg ? <TrendingDown size={13} /> : <Minus size={13} />}
      {pos ? '+' : ''}{value.toFixed(1)}%
    </div>
  )
}

export default function NotesPage() {
  const [allNotes, setAllNotes] = useState<TradeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const positions = usePortfolioStore(s => s.positions)
  const { watchlist } = useWatchlist()

  useEffect(() => {
    fetch(`${API}/api/notes?limit=500`)
      .then(r => r.json())
      .then(d => { setAllNotes(Array.isArray(d) ? d : []) })
      .catch(() => setAllNotes([]))
      .finally(() => setLoading(false))
  }, [])

  const reload = () => {
    setLoading(true)
    fetch(`${API}/api/notes?limit=500`)
      .then(r => r.json())
      .then(d => setAllNotes(Array.isArray(d) ? d : []))
      .catch(() => setAllNotes([]))
      .finally(() => setLoading(false))
  }

  // 노트를 symbol로 빠르게 조회 (최신 노트 우선)
  const notesBySymbol = new Map<string, TradeNote>()
  ;[...allNotes].reverse().forEach(n => { if (!notesBySymbol.has(n.symbol)) notesBySymbol.set(n.symbol, n) })

  // 통계
  const closedWithProfit = allNotes.filter(n => n.status === 'closed' && n.profit_pct !== null)
  const avgProfit = closedWithProfit.length > 0
    ? (closedWithProfit.reduce((s, n) => s + (n.profit_pct || 0), 0) / closedWithProfit.length).toFixed(1)
    : null

  const TABS = [
    { id: 'all' as ActiveTab,    label: '전체',   count: allNotes.length },
    { id: 'hold' as ActiveTab,   label: '보유중', count: positions.length },
    { id: 'watch' as ActiveTab,  label: '관심',   count: watchlist.length },
    { id: 'closed' as ActiveTab, label: '완료',   count: allNotes.filter(n => n.status === 'closed').length },
  ]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-amber-400" />
              <h1 className="text-lg font-bold">매매 노트</h1>
            </div>
          </div>
          <Link
            href="/notes/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors"
          >
            <Plus size={14} />
            새 노트
          </Link>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">전체 기록</p>
            <p className="text-2xl font-bold text-slate-100">{allNotes.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">키움 보유</p>
            <p className="text-2xl font-bold text-emerald-400">{positions.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">평균 수익률 (완료)</p>
            <p className={`text-2xl font-bold ${avgProfit && parseFloat(avgProfit) > 0 ? 'text-red-400' : avgProfit && parseFloat(avgProfit) < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
              {avgProfit ? `${parseFloat(avgProfit) > 0 ? '+' : ''}${avgProfit}%` : '-'}
            </p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-4 border-b border-slate-800">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-600'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">불러오는 중...</div>
        ) : (
          <>
            {/* ── 전체 탭 ── */}
            {activeTab === 'all' && (
              <NoteList notes={allNotes} positions={positions} reload={reload} />
            )}

            {/* ── 보유중 탭: 키움 포지션 primary ── */}
            {activeTab === 'hold' && (
              <div className="space-y-2">
                {positions.length === 0 ? (
                  <Empty icon={<TrendingUp size={36} />} msg="키움 보유 종목이 없습니다" sub="/terminal에서 키움 동기화 후 나타납니다" />
                ) : (
                  positions.map(pos => {
                    const note = notesBySymbol.get(pos.symbol)
                    return (
                      <div key={pos.symbol} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-slate-100">{pos.symbolName || pos.symbol}</span>
                              <span className="text-xs text-slate-600">{pos.symbol}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {pos.quantity.toLocaleString()}주
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 flex gap-3 flex-wrap">
                              <span>평균 ₩{pos.avgPrice.toLocaleString()}</span>
                              <span>현재 ₩{pos.currentPrice.toLocaleString()}</span>
                              <span>평가 ₩{pos.totalValue.toLocaleString()}</span>
                            </div>
                            {note ? (
                              <div className="mt-2 flex items-center gap-2">
                                <FileText size={11} className="text-amber-400 shrink-0" />
                                <Link href={`/notes/${note.id}`} className="text-xs text-amber-400 hover:text-amber-300 truncate">
                                  {note.buy_reason || note.result_summary || '노트 보기'}
                                </Link>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-slate-600">매매 노트 없음</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <ProfitBadge value={pos.profitRate} />
                            <div className="flex gap-1">
                              {note ? (
                                <Link href={`/notes/${note.id}`}
                                  className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors">
                                  노트 보기
                                </Link>
                              ) : (
                                <Link
                                  href={`/notes/new?symbol=${pos.symbol}&name=${encodeURIComponent(pos.symbolName || pos.symbol)}`}
                                  className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                                >
                                  노트 작성
                                </Link>
                              )}
                              <a href={`/terminal?stock=${pos.symbol}`} target="_blank"
                                className="p-1 text-slate-600 hover:text-blue-400 transition-colors" title="터미널 분석">
                                <BarChart2 size={14} />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* ── 관심 탭: 관심 목록 primary, 그룹별 ── */}
            {activeTab === 'watch' && (
              <div className="space-y-4">
                {watchlist.length === 0 ? (
                  <Empty icon={<Star size={36} />} msg="관심 종목이 없습니다" sub="스크리너나 터미널에서 ★ 버튼으로 추가하세요" />
                ) : (
                  WATCHLIST_GROUPS.map(group => {
                    const items = watchlist.filter(w => w.group === group.id)
                    if (items.length === 0) return null
                    return (
                      <div key={group.id}>
                        <div className={`flex items-center gap-2 mb-2`}>
                          <Star size={13} className={GROUP_COLORS[group.id].split(' ')[0]} fill="currentColor" />
                          <span className="text-xs font-semibold text-slate-400">{group.name}</span>
                          <span className="text-xs text-slate-600">{items.length}종목</span>
                        </div>
                        <div className="space-y-2">
                          {items.map(item => {
                            const note = notesBySymbol.get(item.symbol)
                            return (
                              <div key={item.symbol} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-slate-100">{item.name}</span>
                                      <span className="text-xs text-slate-600">{item.symbol}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded border ${GROUP_COLORS[group.id]}`}>
                                        {group.name}
                                      </span>
                                    </div>
                                    {note ? (
                                      <Link href={`/notes/${note.id}`} className="flex items-center gap-1.5 group mt-1">
                                        <FileText size={11} className="text-amber-400 shrink-0" />
                                        <span className="text-xs text-amber-400/70 group-hover:text-amber-400 truncate transition-colors">
                                          {note.buy_reason || note.result_summary || '노트 보기'}
                                        </span>
                                        <span className="text-xs text-slate-600 shrink-0">
                                          {TYPE_LABELS[note.trade_type]} · {note.trade_date}
                                        </span>
                                      </Link>
                                    ) : (
                                      <span className="text-xs text-slate-700">매매 노트 없음</span>
                                    )}
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    {note ? (
                                      <Link href={`/notes/${note.id}`}
                                        className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors">
                                        노트
                                      </Link>
                                    ) : (
                                      <Link
                                        href={`/notes/new?symbol=${item.symbol}&name=${encodeURIComponent(item.name)}`}
                                        className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                                      >
                                        노트 작성
                                      </Link>
                                    )}
                                    <a href={`/terminal?stock=${item.symbol}`} target="_blank"
                                      className="p-1 text-slate-600 hover:text-blue-400 transition-colors" title="터미널 분석">
                                      <BarChart2 size={14} />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* ── 완료 탭 ── */}
            {activeTab === 'closed' && (
              <NoteList notes={allNotes.filter(n => n.status === 'closed')} positions={positions} reload={reload} />
            )}
          </>
        )}
      </div>
    </main>
  )
}

/* ── 서브 컴포넌트 ── */

function NoteList({ notes, positions, reload }: { notes: TradeNote[]; positions: ReturnType<typeof usePortfolioStore.getState>['positions']; reload: () => void }) {
  if (notes.length === 0) return (
    <Empty icon={<BookOpen size={36} />} msg="매매 노트가 없습니다" sub="새 노트를 작성해보세요" link="/notes/new" linkLabel="첫 노트 작성하기 →" />
  )

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    if (!confirm('이 노트를 삭제할까요?')) return
    await fetch(`${API}/api/notes/${id}`, { method: 'DELETE' })
    reload()
  }

  const STATUS_COLORS: Record<string, string> = {
    hold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    watch: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  const STATUS_LABELS: Record<string, string> = { hold: '보유중', closed: '완료', watch: '관심' }

  return (
    <div className="space-y-2">
      {notes.map(note => {
        const pos = positions.find(p => p.symbol === note.symbol)
        return (
          <Link
            key={note.id}
            href={`/notes/${note.id}`}
            className="block bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-lg p-4 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                    {note.stock_name || note.symbol}
                  </span>
                  {note.symbol && <span className="text-xs text-slate-500">{note.symbol}</span>}
                  <span className="text-xs px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">
                    {TYPE_LABELS[note.trade_type] || note.trade_type}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLORS[note.status] || ''}`}>
                    {STATUS_LABELS[note.status] || note.status}
                  </span>
                  {pos && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      키움 보유 {pos.quantity.toLocaleString()}주
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                  {note.trade_date && <span>{note.trade_date}</span>}
                  {note.price > 0 && <span>₩{note.price.toLocaleString()}</span>}
                  {pos && <span className="text-slate-400">현재 ₩{pos.currentPrice.toLocaleString()}</span>}
                  {note.stop_loss > 0 && <span className="text-blue-400">손절 ₩{note.stop_loss.toLocaleString()}</span>}
                  {note.target_price > 0 && <span className="text-red-400">목표 ₩{note.target_price.toLocaleString()}</span>}
                </div>
                {note.buy_reason && <p className="text-xs text-slate-400 mt-1 truncate">{note.buy_reason}</p>}
              </div>
              <div className="ml-4 shrink-0">
                {pos ? (
                  <ProfitBadge value={pos.profitRate} />
                ) : note.profit_pct !== null && note.profit_pct !== undefined ? (
                  <ProfitBadge value={note.profit_pct} />
                ) : (
                  <span className="text-slate-600 text-xs">-</span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function Empty({ icon, msg, sub, link, linkLabel }: { icon: React.ReactNode; msg: string; sub?: string; link?: string; linkLabel?: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-slate-700 flex justify-center mb-3">{icon}</div>
      <p className="text-slate-500">{msg}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
      {link && linkLabel && (
        <Link href={link} className="mt-3 inline-block text-amber-400 hover:text-amber-300 text-sm">{linkLabel}</Link>
      )}
    </div>
  )
}
