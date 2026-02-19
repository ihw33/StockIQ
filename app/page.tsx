'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Minus,
  Monitor, Filter, BarChart3, Activity,
  Globe, FileText, Zap, BookOpen,
  ArrowUpRight, ArrowDownRight,
  RefreshCw
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'

interface MarketIndex {
  close: number
  change: number
  change_pct: number
  date: string
}

interface SectorItem {
  name: string
  change_pct: number
}

interface RecentNote {
  id: number
  stock_name: string
  symbol: string
  trade_type: string
  trade_date: string
  status: string
  profit_pct: number | null
  buy_reason: string
}

const SERVICES = [
  { href: '/terminal', icon: Monitor, label: '종목 분석', desc: 'Kiwoom Pro 터미널', color: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-400/40' },
  { href: '/screener', icon: Filter, label: '스크리너', desc: '종목 필터링', color: 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 hover:border-indigo-400/40' },
  { href: '/sectors/trends', icon: BarChart3, label: '섹터 동향', desc: '업종/테마 로테이션', color: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-400/40' },
  { href: '/stocks/movers', icon: Activity, label: '종목 동향', desc: '상승/하락 종목', color: 'from-rose-500/10 to-rose-600/5 border-rose-500/20 hover:border-rose-400/40' },
  { href: '/macro', icon: Globe, label: '매크로', desc: '거시 경제 지표', color: 'from-amber-500/10 to-amber-600/5 border-amber-500/20 hover:border-amber-400/40' },
  { href: '/reports', icon: FileText, label: '보고서', desc: 'AI 분석 보고서', color: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-400/40' },
  { href: '/alpha-hr', icon: Zap, label: 'Alpha-HR', desc: '기업 투자 분석', color: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 hover:border-cyan-400/40' },
  { href: '/notes', icon: BookOpen, label: '매매 노트', desc: '거래 기록 관리', color: 'from-orange-500/10 to-orange-600/5 border-orange-500/20 hover:border-orange-400/40' },
]

const TYPE_LABELS: Record<string, string> = { buy: '매수', sell: '매도', watch: '관심' }
const STATUS_LABELS: Record<string, string> = { hold: '보유중', closed: '완료', watch: '관심' }

export default function HomePage() {
  const [market, setMarket] = useState<Record<string, MarketIndex | { status: string }>>({})
  const [sectors, setSectors] = useState<{ up: SectorItem[]; down: SectorItem[] }>({ up: [], down: [] })
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.allSettled([
        loadMarket(),
        loadSectors(),
        loadNotes(),
      ])
      setLoading(false)
    }
    loadAll()
  }, [])

  const loadMarket = async () => {
    try {
      const res = await fetch(`${API}/api/market/summary`)
      const data = await res.json()
      setMarket(data)
    } catch { /* silent */ }
  }

  const loadSectors = async () => {
    try {
      const res = await fetch(`${API}/api/sectors/history?days=1`)
      const data = await res.json()
      // 업종 상위 3 / 하위 3
      const dates = Object.keys(data?.data || {})
      const latest = dates.length > 0 ? data.data[dates[0]] : null
      const industries = latest?.industries || {}
      const up = (industries.up || []).slice(0, 3)
      const down = (industries.down || []).slice(0, 3)
      setSectors({ up, down })
    } catch { /* silent */ }
  }

  const loadNotes = async () => {
    try {
      const res = await fetch(`${API}/api/notes?limit=3`)
      const data = await res.json()
      setRecentNotes(data)
    } catch { /* silent */ }
  }

  const renderIndex = (name: string, label: string) => {
    const d = market[name]
    if (!d || 'status' in d) return (
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-slate-600 text-sm">-</p>
      </div>
    )
    const m = d as MarketIndex
    const pos = m.change_pct > 0
    const neg = m.change_pct < 0
    return (
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-base font-bold text-slate-100">{m.close.toLocaleString()}</p>
        <p className={`text-xs flex items-center gap-0.5 mt-0.5 ${pos ? 'text-red-400' : neg ? 'text-blue-400' : 'text-slate-400'}`}>
          {pos ? <ArrowUpRight size={12} /> : neg ? <ArrowDownRight size={12} /> : <Minus size={12} />}
          {m.change_pct > 0 ? '+' : ''}{m.change_pct.toFixed(2)}%
        </p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 시장 현황 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">시장 현황</h2>
            <button
              onClick={() => { loadMarket(); loadSectors(); loadNotes() }}
              className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
              title="새로고침"
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="flex gap-3">
            {renderIndex('KOSPI', '코스피')}
            {renderIndex('KOSDAQ', '코스닥')}
            {renderIndex('NASDAQ', '나스닥')}
          </div>
        </section>

        {/* 포트폴리오 + 섹터 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 섹터 동향 */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">오늘의 섹터</h2>
              <Link href="/sectors/trends" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">전체 →</Link>
            </div>
            {sectors.up.length === 0 && sectors.down.length === 0 ? (
              <p className="text-slate-600 text-sm">데이터 없음 (장 마감 후 또는 휴장일)</p>
            ) : (
              <div className="space-y-1.5">
                {sectors.up.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 truncate">{s.name}</span>
                    <span className="text-xs text-red-400 font-medium shrink-0 ml-2">▲ +{s.change_pct.toFixed(1)}%</span>
                  </div>
                ))}
                {sectors.down.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 truncate">{s.name}</span>
                    <span className="text-xs text-blue-400 font-medium shrink-0 ml-2">▼ {s.change_pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 매매 노트 최근 */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">최근 매매 노트</h2>
              <Link href="/notes" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">전체 →</Link>
            </div>
            {recentNotes.length === 0 ? (
              <div>
                <p className="text-slate-600 text-sm mb-2">기록 없음</p>
                <Link href="/notes/new" className="text-xs text-amber-400 hover:text-amber-300">+ 첫 노트 작성</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentNotes.map(n => (
                  <Link key={n.id} href={`/notes/${n.id}`} className="block group">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-amber-400 transition-colors truncate block">
                          {n.stock_name || n.symbol}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {TYPE_LABELS[n.trade_type] || n.trade_type} · {STATUS_LABELS[n.status] || n.status}
                          {n.trade_date ? ` · ${n.trade_date}` : ''}
                        </span>
                      </div>
                      {n.profit_pct !== null && n.profit_pct !== undefined ? (
                        <span className={`text-xs font-bold shrink-0 ml-2 ${n.profit_pct > 0 ? 'text-red-400' : n.profit_pct < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                          {n.profit_pct > 0 ? '+' : ''}{n.profit_pct.toFixed(1)}%
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 서비스 바로가기 */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">서비스</h2>
          <div className="grid grid-cols-4 gap-3">
            {SERVICES.map(s => (
              <Link
                key={s.href}
                href={s.href}
                className={`bg-gradient-to-br ${s.color} border rounded-lg p-4 transition-all hover:scale-[1.02] group`}
              >
                <s.icon size={20} className="text-slate-400 group-hover:text-slate-200 transition-colors mb-2" />
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
