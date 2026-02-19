'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Search, X, Bell, Target, TrendingUp, Eye, CheckSquare, Zap } from 'lucide-react'
import { usePortfolioStore } from '@/lib/stores/portfolio-store'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'

type Tab = 'basic' | 'reason' | 'plan' | 'market' | 'review'
type TradeType = 'watch' | 'buy' | 'sell'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: '기본 정보' },
  { id: 'reason', label: '매수 이유' },
  { id: 'plan', label: '매도 계획' },
  { id: 'market', label: '시장 상황' },
  { id: 'review', label: '복기' },
]
const WATCH_TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: '기본 정보' },
  { id: 'reason', label: '관심 메모' },
]

const DEFAULT_STATUS: Record<TradeType, string> = {
  watch: 'watch',
  buy: 'hold',
  sell: 'closed',
}

// ─── 매도계획 (ExitPlan) ─────────────────────────────────────────────────────

interface ExitPlan {
  preset: string        // 선택한 전략 프리셋
  base_price: string    // 현재가 (계산 기준)
  target_price: string  // 목표 주가 (절대)
  target_pct: string    // 목표 수익률 (%)
  p1_price: string      // 1차 익절가
  p1_pct: string
  p1_sell: string       // 1차 매도 비중 (%)
  p2_price: string      // 2차 익절가
  p2_pct: string
  p2_sell: string       // 2차 매도 비중 (%)
  sl_price: string      // 손절가
  sl_pct: string
  sl_note: string       // 손절 조건 메모
  a1_price: string      // 1차 추가매수
  a1_pct: string
  a1_weight: string     // 추가매수 비중 (%)
  a2_price: string      // 2차 추가매수
  a2_pct: string
  a2_weight: string
}

const EMPTY_EXIT_PLAN: ExitPlan = {
  preset: '', base_price: '',
  target_price: '', target_pct: '',
  p1_price: '', p1_pct: '', p1_sell: '',
  p2_price: '', p2_pct: '', p2_sell: '',
  sl_price: '', sl_pct: '', sl_note: '',
  a1_price: '', a1_pct: '', a1_weight: '',
  a2_price: '', a2_pct: '', a2_weight: '',
}

type PresetKey = 'momentum' | 'growth' | 'value' | 'trend' | 'swing'

const PRESET_DEFAULTS: Record<PresetKey, Partial<ExitPlan>> = {
  momentum: { target_pct: '30', p1_pct: '15', p1_sell: '30', p2_pct: '30', p2_sell: '70', sl_pct: '-8',  a1_pct: '-3', a1_weight: '5',  a2_pct: '',    a2_weight: '' },
  growth:   { target_pct: '25', p1_pct: '15', p1_sell: '30', p2_pct: '25', p2_sell: '50', sl_pct: '-12', a1_pct: '-7', a1_weight: '10', a2_pct: '-12', a2_weight: '10' },
  value:    { target_pct: '20', p1_pct: '10', p1_sell: '50', p2_pct: '20', p2_sell: '50', sl_pct: '-18', a1_pct: '-10',a1_weight: '15', a2_pct: '-18', a2_weight: '15' },
  trend:    { target_pct: '20', p1_pct: '10', p1_sell: '50', p2_pct: '20', p2_sell: '50', sl_pct: '-8',  a1_pct: '-5', a1_weight: '10', a2_pct: '',    a2_weight: '' },
  swing:    { target_pct: '10', p1_pct: '6',  p1_sell: '50', p2_pct: '10', p2_sell: '50', sl_pct: '-4',  a1_pct: '-3', a1_weight: '5',  a2_pct: '',    a2_weight: '' },
}

const PRESET_LABELS: Record<PresetKey, { label: string; emoji: string; desc: string; knowledgeId: string }> = {
  momentum: { label: '고성장', emoji: '🚀', desc: '주도주 -8% 손절 원칙', knowledgeId: 'momentum' },
  growth:   { label: '성장주', emoji: '📈', desc: '1~6개월 실적 성장주', knowledgeId: 'growth' },
  value:    { label: '가치주', emoji: '💎', desc: '저평가 장기 보유', knowledgeId: 'value' },
  trend:    { label: '추세',   emoji: '〰️', desc: '이동평균 기반 매매', knowledgeId: 'trend' },
  swing:    { label: '스윙',   emoji: '⚡', desc: '1~4주 단기 스윙', knowledgeId: 'swing' },
}

// 계산 헬퍼
const roundPrice = (n: number) => Math.round(n)
const calcPrice = (base: number, pct: number) =>
  base > 0 && pct !== 0 ? roundPrice(base * (1 + pct / 100)).toString() : ''
const calcPct = (base: number, price: number) =>
  base > 0 && price > 0 ? (Math.round(((price - base) / base) * 1000) / 10).toString() : ''

interface StockResult {
  code: string
  name: string
  market: string
}

// 구조화 데이터 (watch_data JSONB)
interface WatchData {
  // 관심 전용
  watch_reason: string
  catalyst: string
  entry_condition: string
  entry_price_1: string
  entry_price_2: string
  target_price_1: string
  checkpoints: string
  // 매수이유 구조화 (매수 전용)
  buy_tech: string            // 기술적 분석
  buy_fundamental: string     // 재무/펀더멘탈
  buy_theme: string           // 테마/모멘텀
  buy_supply: string          // 수급
  // 공통 (관심 + 매수)
  target_price_2: string
  stop_loss: string
  add_buy_price: string       // 추가매수 가격
  add_buy_condition: string   // 추가매수 비중(%)
  sell_condition: string      // 손절 조건
  alert_price: string
  alert_direction: 'above' | 'below'
  alert_memo: string
}

const EMPTY_WATCH_DATA: WatchData = {
  watch_reason: '',
  catalyst: '',
  entry_condition: '',
  entry_price_1: '',
  entry_price_2: '',
  target_price_1: '',
  checkpoints: '',
  buy_tech: '',
  buy_fundamental: '',
  buy_theme: '',
  buy_supply: '',
  target_price_2: '',
  stop_loss: '',
  add_buy_price: '',
  add_buy_condition: '',
  sell_condition: '',
  alert_price: '',
  alert_direction: 'above',
  alert_memo: '',
}

export default function NewNotePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-slate-400">로딩 중...</div></div>}>
      <NewNoteContent />
    </Suspense>
  )
}

function NewNoteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)

  const initType = (searchParams.get('type') || 'buy') as TradeType
  const [form, setForm] = useState({
    symbol: searchParams.get('symbol') || '',
    stock_name: searchParams.get('name') || '',
    trade_date: new Date().toISOString().split('T')[0],
    trade_type: initType,
    price: '',
    quantity: '',
    portfolio_pct: '',
    buy_reason: '',
    target_price: '',
    stop_loss: '',
    add_buy_plan: '',
    market_context: '',
    review: '',
    psychology: '',
    result_summary: '',
    status: DEFAULT_STATUS[initType],
  })

  // 관심 종목 구조화 데이터
  const [watchData, setWatchData] = useState<WatchData>(EMPTY_WATCH_DATA)
  const updateWatch = (k: keyof WatchData, v: string) =>
    setWatchData(prev => ({ ...prev, [k]: v }))

  // 매도계획
  const [exitPlan, setExitPlan] = useState<ExitPlan>(EMPTY_EXIT_PLAN)

  const applyPreset = (name: PresetKey) => {
    const defaults = PRESET_DEFAULTS[name]
    const base = parseFloat(exitPlan.base_price) || 0
    const withPrices: Partial<ExitPlan> = {}
    for (const [k, v] of Object.entries(defaults)) {
      if (k.endsWith('_pct') && v) {
        const field = k.replace('_pct', '') as string
        const priceKey = `${field}_price` as keyof ExitPlan
        if (base > 0) withPrices[priceKey] = calcPrice(base, parseFloat(v))
      }
    }
    setExitPlan(prev => ({ ...prev, ...defaults, ...withPrices, preset: name }))
  }

  const updateBasePrice = (val: string) => {
    const base = parseFloat(val) || 0
    setExitPlan(prev => ({
      ...prev,
      base_price: val,
      target_price: prev.target_pct ? calcPrice(base, parseFloat(prev.target_pct)) : prev.target_price,
      p1_price: prev.p1_pct ? calcPrice(base, parseFloat(prev.p1_pct)) : prev.p1_price,
      p2_price: prev.p2_pct ? calcPrice(base, parseFloat(prev.p2_pct)) : prev.p2_price,
      sl_price: prev.sl_pct ? calcPrice(base, parseFloat(prev.sl_pct)) : prev.sl_price,
      a1_price: prev.a1_pct ? calcPrice(base, parseFloat(prev.a1_pct)) : prev.a1_price,
      a2_price: prev.a2_pct ? calcPrice(base, parseFloat(prev.a2_pct)) : prev.a2_price,
    }))
  }

  const updateExitPrice = (field: string, val: string) => {
    const base = parseFloat(exitPlan.base_price) || 0
    const pct = calcPct(base, parseFloat(val))
    setExitPlan(prev => ({ ...prev, [`${field}_price`]: val, [`${field}_pct`]: pct }))
  }

  // 목표 수익률 기준으로 익절(p1, p2) 비율 일괄 재계산
  // p1은 기존 p1/p2 비율 유지, p2는 새 target으로 맞춤, 손절/추매는 유지
  const applyTargetScale = () => {
    const newTarget = parseFloat(exitPlan.target_pct)
    if (!newTarget) return
    const base = parseFloat(exitPlan.base_price) || 0
    const oldP2 = parseFloat(exitPlan.p2_pct) || newTarget
    const p1Ratio = exitPlan.p1_pct ? parseFloat(exitPlan.p1_pct) / oldP2 : 0.5
    const newP1Pct = Math.round(newTarget * p1Ratio * 10) / 10
    const newP2Pct = newTarget
    setExitPlan(prev => ({
      ...prev,
      p1_pct: newP1Pct.toString(),
      p2_pct: newP2Pct.toString(),
      p1_price: base ? calcPrice(base, newP1Pct) : '',
      p2_price: base ? calcPrice(base, newP2Pct) : '',
    }))
  }

  const updateExitPct = (field: string, val: string) => {
    const base = parseFloat(exitPlan.base_price) || 0
    const price = calcPrice(base, parseFloat(val))
    setExitPlan(prev => ({ ...prev, [`${field}_pct`]: val, [`${field}_price`]: price }))
  }

  // 포트폴리오 자동 가져오기
  const getPosition = usePortfolioStore(s => s.getPosition)
  const [autoFilled, setAutoFilled] = useState(false)
  const handleAutoFill = () => {
    if (!form.symbol) return
    const pos = getPosition(form.symbol)
    if (!pos) { alert('보유 종목에 없는 종목입니다.'); return }
    const priceStr = pos.avgPrice.toString()
    setForm(prev => ({ ...prev, price: priceStr, quantity: pos.quantity.toString() }))
    setAutoFilled(true)
    // 매도계획 기준가도 동기화
    if (!exitPlan.base_price) updateBasePrice(priceStr)
  }

  // 종목 검색
  const [searchQuery, setSearchQuery] = useState(searchParams.get('name') || '')
  const [searchResults, setSearchResults] = useState<StockResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWatch = form.trade_type === 'watch'
  const TABS = isWatch ? WATCH_TABS : ALL_TABS

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleTypeChange = (type: TradeType) => {
    setForm(prev => ({ ...prev, trade_type: type, status: DEFAULT_STATUS[type] }))
    setActiveTab('basic')
  }

  // 종목명 검색 (디바운스 300ms)
  const handleStockSearch = (q: string) => {
    setSearchQuery(q)
    update('stock_name', q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/stocks/search/query?q=${encodeURIComponent(q)}&limit=8`)
        const data = await res.json()
        setSearchResults(data.results || [])
        setSearchOpen(true)
      } catch { setSearchResults([]) }
    }, 300)
  }

  const handleSelectStock = (stock: StockResult) => {
    setSearchQuery(stock.name)
    setForm(prev => ({ ...prev, stock_name: stock.name, symbol: stock.code }))
    setSearchOpen(false)
    setSearchResults([])
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // exit plan에서 자동 알람 목록 생성
  const buildAutoAlerts = () => {
    const alerts: { price: number; direction: 'above' | 'below'; label: string; pct: number | null }[] = []
    const add = (priceStr: string, pctStr: string, direction: 'above' | 'below', label: string) => {
      const p = parseFloat(priceStr)
      if (p > 0) alerts.push({ price: p, direction, label, pct: pctStr ? parseFloat(pctStr) : null })
    }
    add(exitPlan.target_price, exitPlan.target_pct, 'above', '목표 주가')
    add(exitPlan.p1_price, exitPlan.p1_pct, 'above', `1차 익절 (+${exitPlan.p1_pct}%)`)
    add(exitPlan.p2_price, exitPlan.p2_pct, 'above', `2차 익절 (+${exitPlan.p2_pct}%)`)
    add(exitPlan.sl_price, exitPlan.sl_pct, 'below', `손절 (${exitPlan.sl_pct}%)`)
    add(exitPlan.a1_price, exitPlan.a1_pct, 'below', `1차 추가매수 (${exitPlan.a1_pct}%)`)
    add(exitPlan.a2_price, exitPlan.a2_pct, 'below', `2차 추가매수 (${exitPlan.a2_pct}%)`)
    return alerts.sort((a, b) => b.price - a.price)
  }

  const handleSave = async () => {
    if (!form.stock_name && !form.symbol) {
      alert('종목명을 입력해주세요.'); return
    }

    setSaving(true)
    try {
      // exitPlan → form 필드 동기화 (1차 익절 → target_price, 손절 → stop_loss)
      const syncedTargetPrice = exitPlan.p1_price || form.target_price
      const syncedStopLoss = exitPlan.sl_price || form.stop_loss

      // watch_data: 관심/매수 모두 저장 (알림·목표가 자동화 연동용)
      const hasWatchData = Object.entries(watchData).some(
        ([k, v]) => k !== 'alert_direction' && v !== ''
      )
      const hasExitPlan = !isWatch && Object.entries(exitPlan).some(
        ([k, v]) => k !== 'preset' && v !== ''
      )
      const autoAlerts = hasExitPlan ? buildAutoAlerts() : []
      const wd = (hasWatchData || hasExitPlan) ? {
        // 관심 전용
        watch_reason: watchData.watch_reason || null,
        catalyst: watchData.catalyst || null,
        entry_condition: watchData.entry_condition || null,
        entry_price_1: watchData.entry_price_1 ? parseFloat(watchData.entry_price_1) : null,
        entry_price_2: watchData.entry_price_2 ? parseFloat(watchData.entry_price_2) : null,
        target_price_1: watchData.target_price_1 ? parseFloat(watchData.target_price_1) : null,
        checkpoints: watchData.checkpoints || null,
        // 매수 이유 구조화
        buy_tech: watchData.buy_tech || null,
        buy_fundamental: watchData.buy_fundamental || null,
        buy_theme: watchData.buy_theme || null,
        buy_supply: watchData.buy_supply || null,
        // 공통 (관심 + 매수)
        target_price_2: watchData.target_price_2 ? parseFloat(watchData.target_price_2) : null,
        stop_loss: watchData.stop_loss ? parseFloat(watchData.stop_loss) : null,
        add_buy_price: watchData.add_buy_price ? parseFloat(watchData.add_buy_price) : null,
        add_buy_condition: watchData.add_buy_condition || null,
        sell_condition: watchData.sell_condition || null,
        alert_price: watchData.alert_price ? parseFloat(watchData.alert_price) : null,
        alert_direction: watchData.alert_direction,
        alert_memo: watchData.alert_memo || null,
        // 매도계획 (매수 모드)
        exit_plan: hasExitPlan ? {
          preset: exitPlan.preset || null,
          base_price: exitPlan.base_price ? parseFloat(exitPlan.base_price) : null,
          target_price: exitPlan.target_price ? parseFloat(exitPlan.target_price) : null,
          target_pct: exitPlan.target_pct ? parseFloat(exitPlan.target_pct) : null,
          p1_price: exitPlan.p1_price ? parseFloat(exitPlan.p1_price) : null,
          p1_pct: exitPlan.p1_pct ? parseFloat(exitPlan.p1_pct) : null,
          p1_sell: exitPlan.p1_sell ? parseFloat(exitPlan.p1_sell) : null,
          p2_price: exitPlan.p2_price ? parseFloat(exitPlan.p2_price) : null,
          p2_pct: exitPlan.p2_pct ? parseFloat(exitPlan.p2_pct) : null,
          p2_sell: exitPlan.p2_sell ? parseFloat(exitPlan.p2_sell) : null,
          sl_price: exitPlan.sl_price ? parseFloat(exitPlan.sl_price) : null,
          sl_pct: exitPlan.sl_pct ? parseFloat(exitPlan.sl_pct) : null,
          sl_note: exitPlan.sl_note || null,
          a1_price: exitPlan.a1_price ? parseFloat(exitPlan.a1_price) : null,
          a1_pct: exitPlan.a1_pct ? parseFloat(exitPlan.a1_pct) : null,
          a1_weight: exitPlan.a1_weight ? parseFloat(exitPlan.a1_weight) : null,
          a2_price: exitPlan.a2_price ? parseFloat(exitPlan.a2_price) : null,
          a2_pct: exitPlan.a2_pct ? parseFloat(exitPlan.a2_pct) : null,
          a2_weight: exitPlan.a2_weight ? parseFloat(exitPlan.a2_weight) : null,
          // 자동 알람 목록 (자동화 루틴에서 사용)
          alerts: autoAlerts.length > 0 ? autoAlerts : null,
        } : null,
      } : null

      const payload: Record<string, unknown> = {
        ...form,
        price: form.price ? parseFloat(form.price) : null,
        quantity: form.quantity ? parseInt(form.quantity) : null,
        portfolio_pct: form.portfolio_pct ? parseFloat(form.portfolio_pct) : null,
        target_price: syncedTargetPrice ? parseFloat(syncedTargetPrice) : null,
        stop_loss: syncedStopLoss ? parseFloat(syncedStopLoss) : null,
        buy_reason: form.buy_reason || null,
        watch_data: wd,
      }

      const res = await fetch(`${API}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('저장 실패')
      const data = await res.json()
      router.push(`/notes/${data.id}`)
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/notes" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold">새 매매 노트</h1>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors">
            <Save size={14} />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        {/* 유형 선택 */}
        <div className="flex gap-2 mb-5">
          {([
            { v: 'watch', label: '👁 관심', desc: '매수 전 모니터링' },
            { v: 'buy', label: '📈 매수', desc: '매수 기록' },
            { v: 'sell', label: '📉 매도', desc: '매도 기록' },
          ] as { v: TradeType; label: string; desc: string }[]).map(opt => (
            <button key={opt.v} onClick={() => handleTypeChange(opt.v)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                form.trade_type === opt.v
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}>
              <div>{opt.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-800 mb-6">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">

          {/* ── 기본 정보 ── */}
          {activeTab === 'basic' && (
            <>
              {/* 종목명 검색 */}
              <Field label="종목명 *">
                <div className="relative" ref={searchRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" value={searchQuery}
                      onChange={e => handleStockSearch(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                      placeholder="종목명 또는 코드 검색..."
                      className="input-base pl-8 pr-8" />
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); update('stock_name', ''); update('symbol', ''); setSearchResults([]); setSearchOpen(false) }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {searchOpen && searchResults.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                      {searchResults.map(s => (
                        <button key={s.code} onClick={() => handleSelectStock(s)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700 transition-colors text-left">
                          <div>
                            <span className="text-sm text-slate-100">{s.name}</span>
                            <span className="text-xs text-slate-500 ml-2">{s.code}</span>
                          </div>
                          <span className="text-xs text-slate-500 shrink-0">{s.market}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              <Field label="종목 코드">
                <input type="text" value={form.symbol} onChange={e => update('symbol', e.target.value)}
                  placeholder="005930 (검색 시 자동 입력)" className="input-base" />
              </Field>

              <Field label={isWatch ? '등록일' : '매매 날짜'}>
                <input type="date" value={form.trade_date} onChange={e => update('trade_date', e.target.value)} className="input-base" />
              </Field>

              {isWatch ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 space-y-3">
                  <p className="text-xs text-slate-500">예정 매수가 (선택 — 진입 계획이 있을 경우)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="1차 예정 매수가 (원)">
                      <input type="number" value={watchData.entry_price_1}
                        onChange={e => updateWatch('entry_price_1', e.target.value)}
                        placeholder="75000" className="input-base" />
                    </Field>
                    <Field label="2차 예정 매수가 (원)">
                      <input type="number" value={watchData.entry_price_2}
                        onChange={e => updateWatch('entry_price_2', e.target.value)}
                        placeholder="70000" className="input-base" />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 자동 가져오기 */}
                  {form.symbol && (
                    <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2">
                      <span className="text-xs text-slate-500">보유 종목에서 평균가/수량 자동 입력</span>
                      <button onClick={handleAutoFill}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                          autoFilled
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30'
                        }`}>
                        <Zap size={11} />
                        {autoFilled ? '적용됨' : '자동 가져오기'}
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <Field label={form.trade_type === 'sell' ? '매도가 (원)' : '평균 매수가 (원)'}>
                      <input type="number" value={form.price} onChange={e => { update('price', e.target.value); setAutoFilled(false) }}
                        placeholder="75000" className="input-base" />
                    </Field>
                    <Field label="수량">
                      <input type="number" value={form.quantity} onChange={e => { update('quantity', e.target.value); setAutoFilled(false) }}
                        placeholder="100" className="input-base" />
                    </Field>
                    <Field label="포트폴리오 비중 (%)">
                      <input type="number" value={form.portfolio_pct} onChange={e => update('portfolio_pct', e.target.value)}
                        placeholder="10" className="input-base" />
                    </Field>
                  </div>
                </div>
              )}

              <Field label="상태">
                <div className="flex gap-2">
                  {[{ v: 'watch', label: '관심' }, { v: 'hold', label: '보유중' }, { v: 'closed', label: '완료' }].map(opt => (
                    <button key={opt.v} onClick={() => update('status', opt.v)}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        form.status === opt.v ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {isWatch && <p className="text-xs text-slate-600 mt-1.5">관심 → 매수 후 "보유중"으로 수정하세요.</p>}
              </Field>
            </>
          )}

          {/* ── 관심 메모 (구조화) ── */}
          {activeTab === 'reason' && isWatch && (
            <div className="space-y-5">

              {/* 📌 관심 이유 & 근거 */}
              <Section icon={<Eye size={14} />} title="관심 이유 & 근거" color="blue">
                <Field label="관심 이유">
                  <textarea value={watchData.watch_reason}
                    onChange={e => updateWatch('watch_reason', e.target.value)}
                    rows={3} placeholder="이 종목을 모니터링하는 이유를 적어주세요. (재무, 차트, 뉴스 등)"
                    className="input-base resize-none" />
                </Field>
                <Field label="기대 카탈리스트 / 모멘텀">
                  <textarea value={watchData.catalyst}
                    onChange={e => updateWatch('catalyst', e.target.value)}
                    rows={2} placeholder="주가 상승을 이끌 이벤트나 재료 (실적 발표, 신제품, 규제 변화 등)"
                    className="input-base resize-none" />
                </Field>
              </Section>

              {/* 🎯 진입 전략 */}
              <Section icon={<Target size={14} />} title="진입 전략" color="amber">
                <Field label="진입 조건">
                  <textarea value={watchData.entry_condition}
                    onChange={e => updateWatch('entry_condition', e.target.value)}
                    rows={2} placeholder="어떤 조건이 충족될 때 매수할 것인가? (예: 지지선 반등 + 거래량 증가, 20일선 돌파 등)"
                    className="input-base resize-none" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="1차 진입가 (원)">
                    <input type="number" value={watchData.entry_price_1}
                      onChange={e => updateWatch('entry_price_1', e.target.value)}
                      placeholder="75000" className="input-base" />
                  </Field>
                  <Field label="2차 진입가 — 분할매수 (원)">
                    <input type="number" value={watchData.entry_price_2}
                      onChange={e => updateWatch('entry_price_2', e.target.value)}
                      placeholder="70000" className="input-base" />
                  </Field>
                </div>
              </Section>

              {/* 💰 매도 계획 */}
              <Section icon={<TrendingUp size={14} />} title="매도 계획" color="emerald">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="1차 익절 목표가 (원)">
                    <input type="number" value={watchData.target_price_1}
                      onChange={e => updateWatch('target_price_1', e.target.value)}
                      placeholder="90000" className="input-base" />
                  </Field>
                  <Field label="2차 익절 목표가 (원)">
                    <input type="number" value={watchData.target_price_2}
                      onChange={e => updateWatch('target_price_2', e.target.value)}
                      placeholder="100000" className="input-base" />
                  </Field>
                  <Field label="손절가 (원)">
                    <input type="number" value={watchData.stop_loss}
                      onChange={e => updateWatch('stop_loss', e.target.value)}
                      placeholder="68000" className="input-base" />
                  </Field>
                </div>
              </Section>

              {/* 🔔 알림 설정 */}
              <Section icon={<Bell size={14} />} title="알림 설정" color="purple">
                <p className="text-xs text-slate-500 mb-3">설정한 가격에 도달하면 알림을 받습니다. (자동화 루틴 연동 예정)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="알림 기준 가격 (원)">
                    <input type="number" value={watchData.alert_price}
                      onChange={e => updateWatch('alert_price', e.target.value)}
                      placeholder="76000" className="input-base" />
                  </Field>
                  <Field label="조건">
                    <select value={watchData.alert_direction}
                      onChange={e => updateWatch('alert_direction', e.target.value as 'above' | 'below')}
                      className="input-base">
                      <option value="above">이상 (↑ 돌파 시)</option>
                      <option value="below">이하 (↓ 하락 시)</option>
                    </select>
                  </Field>
                </div>
                <Field label="알림 메모">
                  <input type="text" value={watchData.alert_memo}
                    onChange={e => updateWatch('alert_memo', e.target.value)}
                    placeholder="예: 1차 진입 구간 진입, 손절 구간 도달 확인 필요"
                    className="input-base" />
                </Field>
              </Section>

              {/* ✅ 체크포인트 */}
              <Section icon={<CheckSquare size={14} />} title="진입 전 체크포인트" color="slate">
                <Field label="매수 전 확인할 사항">
                  <textarea value={watchData.checkpoints}
                    onChange={e => updateWatch('checkpoints', e.target.value)}
                    rows={3} placeholder="예:&#10;- 다음 실적 발표일 확인&#10;- 외국인/기관 수급 방향 확인&#10;- 코스피 전체 분위기 점검"
                    className="input-base resize-none" />
                </Field>
              </Section>
            </div>
          )}

          {/* ── 매수/매도 이유 ── */}
          {activeTab === 'reason' && !isWatch && (
            <div className="space-y-4">
              {/* 📊 기술적 분석 */}
              <Section icon={<TrendingUp size={14} />} title="기술적 분석" color="blue">
                <Field label="차트 패턴 / 지지·저항 / 이동평균">
                  <textarea value={watchData.buy_tech}
                    onChange={e => updateWatch('buy_tech', e.target.value)}
                    rows={3} placeholder="예: 20일선 골든크로스, 박스권 상단 돌파, 지지선 반등 확인"
                    className="input-base resize-none" />
                </Field>
              </Section>

              {/* 💹 재무/펀더멘탈 */}
              <Section icon={<Target size={14} />} title="재무 / 펀더멘탈" color="emerald">
                <Field label="실적·재무 지표 (PER, PBR, ROE, 매출 성장 등)">
                  <textarea value={watchData.buy_fundamental}
                    onChange={e => updateWatch('buy_fundamental', e.target.value)}
                    rows={3} placeholder="예: PER 12배 (업종 평균 대비 저평가), 영업이익 3년 연속 성장, ROE 15%↑"
                    className="input-base resize-none" />
                </Field>
              </Section>

              {/* 🚀 테마/모멘텀 */}
              <Section icon={<Zap size={14} />} title="테마 / 모멘텀" color="amber">
                <Field label="관련 뉴스·재료·이벤트">
                  <textarea value={watchData.buy_theme}
                    onChange={e => updateWatch('buy_theme', e.target.value)}
                    rows={3} placeholder="예: AI 서버 수요 급증 수혜, 정부 R&D 지원 확대, 다음 분기 실적 발표 기대감"
                    className="input-base resize-none" />
                </Field>
              </Section>

              {/* 💰 수급 */}
              <Section icon={<Eye size={14} />} title="수급" color="purple">
                <Field label="외국인 / 기관 매매 방향">
                  <textarea value={watchData.buy_supply}
                    onChange={e => updateWatch('buy_supply', e.target.value)}
                    rows={2} placeholder="예: 외국인 3일 연속 순매수, 기관 프로그램 매수 유입, 거래량 평균 대비 2배↑"
                    className="input-base resize-none" />
                </Field>
              </Section>

              {/* 한 줄 총평 */}
              <Field label="매수 핵심 근거 (한 줄 요약) *">
                <input type="text" value={form.buy_reason} onChange={e => update('buy_reason', e.target.value)}
                  placeholder="위 내용을 한 문장으로 정리 (필수)" className="input-base" />
              </Field>
            </div>
          )}

          {activeTab === 'plan' && (
            <div className="space-y-5">

              {/* 전략 프리셋 선택 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium">전략 프리셋 선택</span>
                  <a href="/knowledge" target="_blank"
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    📚 전략 가이드
                  </a>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(PRESET_LABELS) as PresetKey[]).map(key => {
                    const p = PRESET_LABELS[key]
                    return (
                      <button key={key} onClick={() => applyPreset(key)}
                        className={`flex flex-col items-center py-2 px-1 rounded-lg border text-center transition-colors ${
                          exitPlan.preset === key
                            ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                        }`}>
                        <span className="text-base mb-0.5">{p.emoji}</span>
                        <span className="text-[11px] font-medium">{p.label}</span>
                        <span className="text-[9px] text-slate-600 mt-0.5 leading-tight">{p.desc}</span>
                      </button>
                    )
                  })}
                </div>
                {exitPlan.preset && (
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    프리셋 적용됨 — 아래 값을 종목에 맞게 수정하세요.
                    <a href={`/knowledge#${PRESET_LABELS[exitPlan.preset as PresetKey]?.knowledgeId}`}
                      target="_blank" className="ml-1 text-amber-600 hover:text-amber-400">
                      상세 설명 →
                    </a>
                  </p>
                )}
              </div>

              {/* 기준 주가 설정 */}
              <Section icon={<Target size={14} />} title="기준 주가 설정" color="slate">
                <p className="text-xs text-slate-500 mb-3">
                  모든 익절·손절·추가매수 %는 이 가격 기준으로 계산됩니다.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="현재 주가 (계산 기준)">
                    <div className="relative">
                      <input type="number" value={exitPlan.base_price}
                        onChange={e => updateBasePrice(e.target.value)}
                        placeholder={form.price || '10000'}
                        className="w-full px-3 py-2 pr-8 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">원</span>
                    </div>
                  </Field>
                  {form.price && (
                    <div className="flex items-end">
                      <button onClick={() => updateBasePrice(form.price)}
                        className="w-full py-2 text-xs text-amber-400 border border-amber-500/30 rounded bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                        ↑ 평균매수가 가져오기<br />
                        <span className="text-slate-500">{parseFloat(form.price).toLocaleString()}원</span>
                      </button>
                    </div>
                  )}
                </div>
                <PricePctRow
                  leftLabel="목표 주가"
                  rightLabel="목표 수익률"
                  priceVal={exitPlan.target_price}
                  pctVal={exitPlan.target_pct}
                  onPriceChange={v => updateExitPrice('target', v)}
                  onPctChange={v => updateExitPct('target', v)}
                  pricePlaceholder="15000"
                  pctColor="text-emerald-400"
                  pctSign="+"
                />
                {/* 일괄 적용 버튼 */}
                {exitPlan.target_pct && (exitPlan.p1_pct || exitPlan.p2_pct) && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                    <p className="text-[11px] text-slate-600">
                      익절 비율을 목표 수익률 <span className="text-emerald-400 font-mono">+{exitPlan.target_pct}%</span> 기준으로 재계산
                    </p>
                    <button onClick={applyTargetScale}
                      className="text-xs px-3 py-1 rounded bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 transition-colors font-medium shrink-0 ml-3">
                      익절 비율 적용
                    </button>
                  </div>
                )}
              </Section>

              {/* 익절 계획 */}
              <Section icon={<TrendingUp size={14} />} title="익절 계획" color="emerald">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-600 mb-1.5">1차 익절</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <PricePctRow
                          priceVal={exitPlan.p1_price} pctVal={exitPlan.p1_pct}
                          onPriceChange={v => updateExitPrice('p1', v)}
                          onPctChange={v => updateExitPct('p1', v)}
                          pricePlaceholder="11500" pctColor="text-emerald-400" pctSign="+"
                        />
                      </div>
                      <Field label="매도 비중 (%)">
                        <div className="relative">
                          <input type="number" value={exitPlan.p1_sell}
                            onChange={e => setExitPlan(p => ({ ...p, p1_sell: e.target.value }))}
                            placeholder="30" className="w-full px-3 py-2 pr-6 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                        </div>
                      </Field>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-600 mb-1.5">2차 익절</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <PricePctRow
                          priceVal={exitPlan.p2_price} pctVal={exitPlan.p2_pct}
                          onPriceChange={v => updateExitPrice('p2', v)}
                          onPctChange={v => updateExitPct('p2', v)}
                          pricePlaceholder="13000" pctColor="text-emerald-400" pctSign="+"
                        />
                      </div>
                      <Field label="매도 비중 (%)">
                        <div className="relative">
                          <input type="number" value={exitPlan.p2_sell}
                            onChange={e => setExitPlan(p => ({ ...p, p2_sell: e.target.value }))}
                            placeholder="70" className="w-full px-3 py-2 pr-6 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                        </div>
                      </Field>
                    </div>
                  </div>
                </div>
              </Section>

              {/* 손절 계획 */}
              <Section icon={<Target size={14} />} title="손절 계획" color="blue">
                <PricePctRow
                  priceVal={exitPlan.sl_price} pctVal={exitPlan.sl_pct}
                  onPriceChange={v => updateExitPrice('sl', v)}
                  onPctChange={v => updateExitPct('sl', v)}
                  pricePlaceholder="9200" pctColor="text-red-400" pctSign=""
                />
                <Field label="손절 조건">
                  <textarea value={exitPlan.sl_note}
                    onChange={e => setExitPlan(p => ({ ...p, sl_note: e.target.value }))}
                    rows={2} placeholder="예: 지지선 붕괴 + 종가 기준 확인 후 다음날 장초에 매도"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600 resize-none mt-2" />
                </Field>
              </Section>

              {/* 추가 매수 계획 */}
              <Section icon={<Zap size={14} />} title="추가 매수 계획" color="amber">
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-600 mb-1.5">1차 추가매수</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <PricePctRow
                          priceVal={exitPlan.a1_price} pctVal={exitPlan.a1_pct}
                          onPriceChange={v => updateExitPrice('a1', v)}
                          onPctChange={v => updateExitPct('a1', v)}
                          pricePlaceholder="9700" pctColor="text-red-400" pctSign=""
                        />
                      </div>
                      <Field label="비중 (%)">
                        <div className="relative">
                          <input type="number" value={exitPlan.a1_weight}
                            onChange={e => setExitPlan(p => ({ ...p, a1_weight: e.target.value }))}
                            placeholder="5" className="w-full px-3 py-2 pr-6 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                        </div>
                      </Field>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-600 mb-1.5">2차 추가매수</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <PricePctRow
                          priceVal={exitPlan.a2_price} pctVal={exitPlan.a2_pct}
                          onPriceChange={v => updateExitPrice('a2', v)}
                          onPctChange={v => updateExitPct('a2', v)}
                          pricePlaceholder="" pctColor="text-red-400" pctSign=""
                        />
                      </div>
                      <Field label="비중 (%)">
                        <div className="relative">
                          <input type="number" value={exitPlan.a2_weight}
                            onChange={e => setExitPlan(p => ({ ...p, a2_weight: e.target.value }))}
                            placeholder="5" className="w-full px-3 py-2 pr-6 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                        </div>
                      </Field>
                    </div>
                  </div>
                </div>
              </Section>

              {/* 알림 설정 — 자동 생성 미리보기 */}
              <Section icon={<Bell size={14} />} title="자동 알람 설정" color="purple">
                {(() => {
                  const alerts = buildAutoAlerts()
                  return alerts.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 mb-2">
                        매도 계획에 입력한 가격이 자동으로 알람으로 등록됩니다.
                        <span className="text-purple-400 ml-1">(자동화 루틴 연동 예정)</span>
                      </p>
                      {alerts.map((a, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                          a.direction === 'above'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-red-500/5 border-red-500/20'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{a.direction === 'above' ? '↑' : '↓'}</span>
                            <span className="text-xs text-slate-300">{a.label}</span>
                          </div>
                          <span className={`text-xs font-mono font-medium ${
                            a.direction === 'above' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {a.price.toLocaleString()}원
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">
                      위 매도 계획에 가격을 입력하면 알람이 자동으로 생성됩니다.
                    </p>
                  )
                })()}
                {/* 추가 커스텀 알람 */}
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                  <p className="text-xs text-slate-500">추가 알람 (선택)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input type="number" value={watchData.alert_price}
                        onChange={e => updateWatch('alert_price', e.target.value)}
                        placeholder="직접 입력" className="input-base pr-8" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">원</span>
                    </div>
                    <select value={watchData.alert_direction}
                      onChange={e => updateWatch('alert_direction', e.target.value as 'above' | 'below')}
                      className="input-base">
                      <option value="above">이상 (↑)</option>
                      <option value="below">이하 (↓)</option>
                    </select>
                  </div>
                  <input type="text" value={watchData.alert_memo}
                    onChange={e => updateWatch('alert_memo', e.target.value)}
                    placeholder="메모 (선택)" className="input-base" />
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'market' && (
            <Field label="매수 당시 시장 상황">
              <textarea value={form.market_context} onChange={e => update('market_context', e.target.value)}
                rows={8} placeholder="지수 흐름, 금리/환율, 주도 섹터 등 거시적 상황을 기록해주세요."
                className="input-base resize-none" />
            </Field>
          )}

          {activeTab === 'review' && (
            <>
              <Field label="복기 (잘한 점 / 아쉬운 점)">
                <textarea value={form.review} onChange={e => update('review', e.target.value)}
                  rows={4} placeholder="계획대로 실행했는가? 다시 돌아간다면 어떤 결정을 내릴 것인가?"
                  className="input-base resize-none" />
              </Field>
              <Field label="심리 상태">
                <textarea value={form.psychology} onChange={e => update('psychology', e.target.value)}
                  rows={3} placeholder="뇌동매매 여부, 공포/탐욕 상태, 인내심 등을 기록해주세요."
                  className="input-base resize-none" />
              </Field>
              <Field label="한 줄 요약">
                <input type="text" value={form.result_summary} onChange={e => update('result_summary', e.target.value)}
                  placeholder="수익/손실의 핵심 이유를 한 문장으로" className="input-base" />
              </Field>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button onClick={() => {
            const idx = TABS.findIndex(t => t.id === activeTab)
            if (idx > 0) setActiveTab(TABS[idx - 1].id)
          }} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            ← 이전
          </button>
          {activeTab !== TABS[TABS.length - 1].id ? (
            <button onClick={() => {
              const idx = TABS.findIndex(t => t.id === activeTab)
              setActiveTab(TABS[idx + 1].id)
            }} className="px-4 py-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
              다음 →
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors">
              {saving ? '저장 중...' : '저장하기'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .input-base {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 0.375rem;
          color: #f1f5f9;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-base:focus { border-color: #d97706; }
        .input-base::placeholder { color: #475569; }
      `}</style>
    </main>
  )
}

const INPUT_TW = "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-100 outline-none focus:border-amber-500 transition-colors placeholder:text-slate-600"

// 가격 ↔ % 양방향 입력 행
function PricePctRow({
  leftLabel, rightLabel,
  priceVal, pctVal,
  onPriceChange, onPctChange,
  pricePlaceholder, pctColor, pctSign,
}: {
  leftLabel?: string; rightLabel?: string
  priceVal: string; pctVal: string
  onPriceChange: (v: string) => void; onPctChange: (v: string) => void
  pricePlaceholder?: string; pctColor?: string; pctSign?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        {leftLabel && <label className="block text-xs text-slate-400 mb-1">{leftLabel}</label>}
        <div className="relative">
          <input type="number" value={priceVal} onChange={e => onPriceChange(e.target.value)}
            placeholder={pricePlaceholder}
            className={`${INPUT_TW} pr-8`} />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">원</span>
        </div>
      </div>
      <div>
        {rightLabel && <label className="block text-xs text-slate-400 mb-1">{rightLabel}</label>}
        <div className="relative">
          <input type="number" value={pctVal} onChange={e => onPctChange(e.target.value)}
            placeholder={pctSign === '+' ? '15' : '-8'}
            className={`${INPUT_TW} pr-6 font-mono ${pctColor || ''}`} />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
        </div>
      </div>
    </div>
  )
}

// 섹션 컨테이너
function Section({ icon, title, color, children }: {
  icon: React.ReactNode
  title: string
  color: 'blue' | 'amber' | 'emerald' | 'purple' | 'slate'
  children: React.ReactNode
}) {
  const colors = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    slate: 'border-slate-700 bg-slate-900/50',
  }
  const iconColors = {
    blue: 'text-blue-400', amber: 'text-amber-400', emerald: 'text-emerald-400',
    purple: 'text-purple-400', slate: 'text-slate-400',
  }
  return (
    <div className={`border rounded-lg p-4 space-y-3 ${colors[color]}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${iconColors[color]}`}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
