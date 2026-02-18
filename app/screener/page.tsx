'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, SlidersHorizontal, X, Star, NotebookPen, BarChart2,
  TrendingUp, ChevronUp, ChevronDown, RefreshCw, Search, Telescope
} from 'lucide-react'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { usePortfolioStore } from '@/lib/stores/portfolio-store'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

interface DiscoverResult {
  symbol: string
  name: string
  market: string
  market_cap: number | null
  per: number | null
  pbr: number | null
  roe: number | null
  eps: number | null
  revenue: number | null
  operating_profit_growth: number | null
  industry: string | null
  themes: string[]
  updated_at: string | null
}

type SortField = keyof DiscoverResult
type SortOrder = 'asc' | 'desc'

const PRESETS = [
  { id: 'value',    label: '저평가 가치주', desc: 'PBR < 1.5 · ROE > 10% · PER < 20', color: 'blue' },
  { id: 'growth',   label: '성장주',        desc: '영업이익증가율 > 20% · ROE > 10%', color: 'emerald' },
  { id: 'bluechip', label: '대형 우량주',   desc: '시총 > 1조 · ROE > 10%',           color: 'purple' },
  { id: 'low_per',  label: '저PER',         desc: 'PER 0 ~ 10배',                      color: 'amber' },
] as const

type PresetId = typeof PRESETS[number]['id']

const PRESET_COLORS: Record<string, string> = {
  blue:    'border-blue-500 text-blue-400 bg-blue-500/10',
  emerald: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
  purple:  'border-purple-500 text-purple-400 bg-purple-500/10',
  amber:   'border-amber-500 text-amber-400 bg-amber-500/10',
}
const PRESET_INACTIVE = 'border-slate-700 text-slate-400 bg-transparent hover:border-slate-500'

function fmt(v: number | null, unit = ''): string {
  if (v === null || v === undefined) return '-'
  return `${v.toFixed(1)}${unit}`
}

function fmtCap(v: number | null): string {
  if (!v) return '-'
  if (v >= 100000) return `${Math.round(v / 10000).toLocaleString()}조`
  if (v >= 10000)  return `${(v / 10000).toFixed(1)}조`
  return `${v.toLocaleString()}억`
}

// ±% 범위 계산 헬퍼
function pctRange(v: number | null, pct: number): [number, number] | null {
  if (!v || v <= 0) return null
  return [Math.round(v * (1 - pct / 100) * 10) / 10, Math.round(v * (1 + pct / 100) * 10) / 10]
}

export default function ScreenerPage() {
  const router = useRouter()
  const { addToWatchlist, isInWatchlist } = useWatchlist()
  const positions = usePortfolioStore(s => s.positions)
  const searchRef = useRef<HTMLDivElement>(null)

  // 기존 상태
  const [preset, setPreset] = useState<PresetId>('value')
  const [showFilter, setShowFilter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<DiscoverResult[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('roe')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({})

  const [filters, setFilters] = useState({
    per_min: '', per_max: '',
    pbr_max: '',
    roe_min: '',
    market_cap_min: '',
    op_growth_min: '',
  })

  // 업종/테마 분류 상태
  const industryRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)
  const [industries, setIndustries] = useState<{ name: string; count: number }[]>([])
  const [themes, setThemes] = useState<{ name: string; count: number }[]>([])
  const [industryOpen, setIndustryOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [activeClassification, setActiveClassification] = useState<{ type: 'industry' | 'theme'; name: string } | null>(null)

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DiscoverResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedStock, setSelectedStock] = useState<DiscoverResult | null>(null)
  const [similarChecks, setSimilarChecks] = useState({
    per: true,
    market_cap: true,
    roe: false,
    op_growth: false,
  })

  // 검색 디바운스
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchOpen(false); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/screener/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
        const data = await res.json()
        setSearchResults(data.results || [])
        setSearchOpen(true)
      } catch { setSearchResults([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  const [recentIndustries, setRecentIndustries] = useState<string[]>([])
  const [recentThemes, setRecentThemes] = useState<string[]>([])

  // 분류 목록 로드 + 최근 선택 복원
  useEffect(() => {
    fetch(`${API}/api/screener/classifications`)
      .then(r => r.json())
      .then(d => { setIndustries(d.industries || []); setThemes(d.themes || []) })
      .catch(() => {})
    try {
      setRecentIndustries(JSON.parse(localStorage.getItem('screener-recent-industries') || '[]'))
      setRecentThemes(JSON.parse(localStorage.getItem('screener-recent-themes') || '[]'))
    } catch {}
  }, [])

  const pushRecent = (type: 'industry' | 'theme', name: string) => {
    const key = type === 'industry' ? 'screener-recent-industries' : 'screener-recent-themes'
    const setter = type === 'industry' ? setRecentIndustries : setRecentThemes
    setter(prev => {
      const next = [name, ...prev.filter(n => n !== name)].slice(0, 5)
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // 분류 선택 시 조회
  const handleClassification = async (type: 'industry' | 'theme', name: string) => {
    setActiveClassification({ type, name })
    pushRecent(type, name)
    setIndustryOpen(false)
    setThemeOpen(false)
    setLoading(true)
    try {
      const params = new URLSearchParams({ cls_type: type, cls_name: name, limit: '60' })
      const res = await fetch(`${API}/api/screener/discover?${params}`)
      const data = await res.json()
      setResults(data.results || [])
      setLastUpdated(data.last_updated)
      setSortField('market_cap')
      setSortOrder('desc')
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false)
      if (industryRef.current && !industryRef.current.contains(e.target as Node))
        setIndustryOpen(false)
      if (themeRef.current && !themeRef.current.contains(e.target as Node))
        setThemeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelectStock = (stock: DiscoverResult) => {
    setSelectedStock(stock)
    setSearchQuery(stock.name)
    setSearchOpen(false)
  }

  const clearSelectedStock = () => {
    setSelectedStock(null)
    setSearchQuery('')
    setSearchResults([])
  }

  // 유사 종목 검색
  const searchSimilar = async () => {
    if (!selectedStock) return
    setLoading(true)
    setShowFilter(false)
    const params = new URLSearchParams()
    params.set('limit', '60')

    if (similarChecks.per && selectedStock.per) {
      const r = pctRange(selectedStock.per, 30)
      if (r) { params.set('per_min', String(r[0])); params.set('per_max', String(r[1])) }
    }
    if (similarChecks.market_cap && selectedStock.market_cap) {
      params.set('market_cap_min', String(Math.round(selectedStock.market_cap * 0.3)))
    }
    if (similarChecks.roe && selectedStock.roe) {
      params.set('roe_min', String(Math.max(0, selectedStock.roe - 5)))
    }
    if (similarChecks.op_growth && selectedStock.operating_profit_growth) {
      params.set('op_growth_min', '0')
    }

    try {
      const res = await fetch(`${API}/api/screener/discover?${params}`)
      const data = await res.json()
      // 본인 종목 제외
      setResults((data.results || []).filter((r: DiscoverResult) => r.symbol !== selectedStock.symbol))
      setLastUpdated(data.last_updated)
      setSortField('market_cap')
      setSortOrder('desc')
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const loadPreset = useCallback(async (p: PresetId) => {
    setLoading(true)
    setShowFilter(false)
    try {
      const res = await fetch(`${API}/api/screener/discover?preset=${p}&limit=60`)
      const data = await res.json()
      setResults(data.results || [])
      setLastUpdated(data.last_updated)
      const sortMap: Record<PresetId, SortField> = {
        value: 'roe', growth: 'operating_profit_growth', bluechip: 'market_cap', low_per: 'per'
      }
      setSortField(sortMap[p])
      setSortOrder(p === 'low_per' ? 'asc' : 'desc')
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPreset(preset) }, [preset, loadPreset])

  const handleFilterSearch = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.per_min)        params.set('per_min', filters.per_min)
      if (filters.per_max)        params.set('per_max', filters.per_max)
      if (filters.pbr_max)        params.set('pbr_max', filters.pbr_max)
      if (filters.roe_min)        params.set('roe_min', filters.roe_min)
      if (filters.market_cap_min) params.set('market_cap_min', filters.market_cap_min)
      if (filters.op_growth_min)  params.set('op_growth_min', filters.op_growth_min)
      params.set('limit', '60')
      const res = await fetch(`${API}/api/screener/discover?${params}`)
      const data = await res.json()
      setResults(data.results || [])
      setLastUpdated(data.last_updated)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () =>
    setFilters({ per_min: '', per_max: '', pbr_max: '', roe_min: '', market_cap_min: '', op_growth_min: '' })

  const sorted = [...results].sort((a, b) => {
    const av = a[sortField] as number | null
    const bv = b[sortField] as number | null
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return sortOrder === 'asc' ? av - bv : bv - av
  })

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('desc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-700 text-xs">↕</span>
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="text-amber-400" />
      : <ChevronDown size={12} className="text-amber-400" />
  }

  const handleAddWatchlist = (symbol: string, name: string) => {
    addToWatchlist(symbol, name)
    setAddedMap(m => ({ ...m, [symbol]: true }))
    setTimeout(() => setAddedMap(m => ({ ...m, [symbol]: false })), 1500)
  }

  const TH = ({ label, field, align = 'right' }: { label: string; field: SortField; align?: 'left' | 'right' }) => (
    <th
      className={`px-3 py-2 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-300 whitespace-nowrap select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(field)}
    >
      <span className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label} <SortIcon field={field} />
      </span>
    </th>
  )

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Search size={16} className="text-amber-400" />
                종목 탐색
              </h1>
              {lastUpdated && (
                <p className="text-xs text-slate-600 mt-0.5">
                  재무 데이터 기준: {lastUpdated.split('T')[0]}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors ${
                showFilter
                  ? 'bg-amber-600 border-amber-600 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal size={14} />
              조건 설정
            </button>
            <button
              onClick={() => loadPreset(preset)}
              className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
              title="새로고침"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* 🔍 종목 검색창 */}
        <div ref={searchRef} className="relative mb-4">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus-within:border-amber-600 transition-colors">
            <Telescope size={15} className="text-slate-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) clearSelectedStock() }}
              placeholder="종목명 또는 코드로 검색하여 유사 종목 찾기..."
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
            />
            {searchQuery && (
              <button onClick={clearSelectedStock} className="text-slate-600 hover:text-slate-400">
                <X size={14} />
              </button>
            )}
          </div>

          {/* 검색 드롭다운 */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
              {searchResults.map(stock => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-200">{stock.name}</span>
                    <span className="text-xs text-slate-600 ml-2">{stock.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className={`px-1.5 py-0.5 rounded ${stock.market === 'KOSPI' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {stock.market}
                    </span>
                    <span>PER {fmt(stock.per, 'x')}</span>
                    <span>ROE {fmt(stock.roe, '%')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 선택 종목 패널 */}
        {selectedStock && (
          <div className="bg-slate-900 border border-amber-600/40 rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {selectedStock.name}
                  <span className="text-xs font-normal text-slate-500 ml-2">{selectedStock.symbol}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedStock.market} · {fmtCap(selectedStock.market_cap)} ·
                  PER {fmt(selectedStock.per, 'x')} · PBR {fmt(selectedStock.pbr)} ·
                  ROE {fmt(selectedStock.roe, '%')} · 영익증가율 {fmt(selectedStock.operating_profit_growth, '%')}
                </p>
              </div>
              <button onClick={clearSelectedStock} className="text-slate-600 hover:text-slate-400">
                <X size={15} />
              </button>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <p className="text-xs text-slate-500 mb-2">유사 조건 선택 (±30% 범위)</p>
              <div className="flex gap-3 flex-wrap mb-3">
                {([
                  { key: 'per',        label: `PER (${fmt(selectedStock.per, 'x')})` },
                  { key: 'market_cap', label: `시총 (${fmtCap(selectedStock.market_cap)} 이상)` },
                  { key: 'roe',        label: `ROE (${fmt(selectedStock.roe, '%')})` },
                  { key: 'op_growth',  label: `영익증가율 (양수)` },
                ] as { key: keyof typeof similarChecks; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={similarChecks[key]}
                      onChange={e => setSimilarChecks(c => ({ ...c, [key]: e.target.checked }))}
                      className="accent-amber-500"
                    />
                    <span className="text-xs text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={searchSimilar}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors"
              >
                <Search size={13} />
                이 조건으로 유사 종목 검색
              </button>
            </div>
          </div>
        )}

        {/* ① 프리셋 탭 + 업종/테마 드롭다운 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPreset(p.id); setActiveClassification(null) }}
              className={`flex flex-col items-start px-4 py-2.5 rounded-lg border text-sm transition-all ${
                !activeClassification && preset === p.id ? PRESET_COLORS[p.color] : PRESET_INACTIVE
              }`}
            >
              <span className="font-semibold">{p.label}</span>
              <span className="text-xs opacity-60 mt-0.5">{p.desc}</span>
            </button>
          ))}

          {/* 업종 드롭다운 */}
          <div ref={industryRef} className="relative">
            <button
              onClick={() => { setIndustryOpen(v => !v); setThemeOpen(false) }}
              className={`flex flex-col items-start px-4 py-2.5 rounded-lg border text-sm transition-all min-w-[120px] ${
                activeClassification?.type === 'industry'
                  ? 'border-sky-500 text-sky-400 bg-sky-500/10'
                  : 'border-slate-700 text-slate-400 bg-transparent hover:border-slate-500'
              }`}
            >
              <span className="font-semibold">
                {activeClassification?.type === 'industry' ? activeClassification.name : '업종 선택'}
              </span>
              <span className="text-xs opacity-60 mt-0.5">
                {activeClassification?.type === 'industry' ? '업종 필터 적용 중' : '업종별 종목 보기'}
              </span>
            </button>
            {industryOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-30 overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  {recentIndustries.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] text-slate-600 uppercase tracking-wider bg-slate-800/60">최근 선택</div>
                      {recentIndustries.map(name => {
                        const item = industries.find(i => i.name === name)
                        return (
                          <button
                            key={`recent-${name}`}
                            onClick={() => handleClassification('industry', name)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800 transition-colors ${
                              activeClassification?.name === name ? 'text-sky-400' : 'text-slate-200'
                            }`}
                          >
                            <span className="text-sm truncate">{name}</span>
                            <span className="text-xs text-slate-600 shrink-0 ml-2">{item?.count ?? ''}</span>
                          </button>
                        )
                      })}
                      <div className="border-t border-slate-800 my-1" />
                    </>
                  )}
                  {industries.filter(i => !recentIndustries.includes(i.name)).map(item => (
                    <button
                      key={item.name}
                      onClick={() => handleClassification('industry', item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800 transition-colors ${
                        activeClassification?.name === item.name ? 'text-sky-400' : 'text-slate-300'
                      }`}
                    >
                      <span className="text-sm truncate">{item.name}</span>
                      <span className="text-xs text-slate-600 shrink-0 ml-2">{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 테마 드롭다운 */}
          <div ref={themeRef} className="relative">
            <button
              onClick={() => { setThemeOpen(v => !v); setIndustryOpen(false) }}
              className={`flex flex-col items-start px-4 py-2.5 rounded-lg border text-sm transition-all min-w-[120px] ${
                activeClassification?.type === 'theme'
                  ? 'border-violet-500 text-violet-400 bg-violet-500/10'
                  : 'border-slate-700 text-slate-400 bg-transparent hover:border-slate-500'
              }`}
            >
              <span className="font-semibold">
                {activeClassification?.type === 'theme' ? activeClassification.name : '테마 선택'}
              </span>
              <span className="text-xs opacity-60 mt-0.5">
                {activeClassification?.type === 'theme' ? '테마 필터 적용 중' : '테마별 종목 보기'}
              </span>
            </button>
            {themeOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-30 overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  {recentThemes.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] text-slate-600 uppercase tracking-wider bg-slate-800/60">최근 선택</div>
                      {recentThemes.map(name => {
                        const item = themes.find(t => t.name === name)
                        return (
                          <button
                            key={`recent-${name}`}
                            onClick={() => handleClassification('theme', name)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800 transition-colors ${
                              activeClassification?.name === name ? 'text-violet-400' : 'text-slate-200'
                            }`}
                          >
                            <span className="text-sm truncate">{name}</span>
                            <span className="text-xs text-slate-600 shrink-0 ml-2">{item?.count ?? ''}</span>
                          </button>
                        )
                      })}
                      <div className="border-t border-slate-800 my-1" />
                    </>
                  )}
                  {themes.filter(t => !recentThemes.includes(t.name)).map(item => (
                    <button
                      key={item.name}
                      onClick={() => handleClassification('theme', item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800 transition-colors ${
                        activeClassification?.name === item.name ? 'text-violet-400' : 'text-slate-300'
                      }`}
                    >
                      <span className="text-sm truncate">{item.name}</span>
                      <span className="text-xs text-slate-600 shrink-0 ml-2">{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ② 수동 필터 패널 */}
        {showFilter && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">직접 조건 설정</h3>
              <button onClick={() => setShowFilter(false)} className="text-slate-600 hover:text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <FilterRange
                label="PER" minKey="per_min" maxKey="per_max"
                filters={filters} onChange={(k, v) => setFilters(f => ({...f, [k]: v}))}
              />
              <FilterInput label="PBR (최대)" k="pbr_max" filters={filters}
                onChange={(k, v) => setFilters(f => ({...f, [k]: v}))} placeholder="1.5" />
              <FilterInput label="ROE (최소 %)" k="roe_min" filters={filters}
                onChange={(k, v) => setFilters(f => ({...f, [k]: v}))} placeholder="10" />
              <FilterInput label="시총 최소 (억원)" k="market_cap_min" filters={filters}
                onChange={(k, v) => setFilters(f => ({...f, [k]: v}))} placeholder="1000" />
              <FilterInput label="영업이익증가율 최소 (%)" k="op_growth_min" filters={filters}
                onChange={(k, v) => setFilters(f => ({...f, [k]: v}))} placeholder="20" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded transition-colors"
              >
                초기화
              </button>
              <button
                onClick={handleFilterSearch}
                className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
              >
                검색
              </button>
            </div>
          </div>
        )}

        {/* ③ 결과 테이블 */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
            종목 조회 중...
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <TrendingUp size={40} className="mx-auto mb-3 text-slate-700" />
            <p>조건에 맞는 종목이 없습니다.</p>
            <p className="text-xs mt-1 text-slate-600">
              screener_cache에 데이터가 없습니다. 백엔드에서 전체 업데이트를 먼저 실행해주세요.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">{sorted.length}개 종목</span>
              <span className="text-xs text-slate-600">재무 데이터 기준 (전일 종가)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                    <TH label="종목명" field="name" align="left" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">시장</th>
                    <TH label="시총" field="market_cap" />
                    <TH label="PER" field="per" />
                    <TH label="PBR" field="pbr" />
                    <TH label="ROE" field="roe" />
                    <TH label="영익증가율" field="operating_profit_growth" />
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sorted.map((stock, idx) => {
                    const inWatchlist = isInWatchlist(stock.symbol)
                    const justAdded = addedMap[stock.symbol]
                    const holding = positions.find(p => p.symbol === stock.symbol)
                    return (
                      <tr key={stock.symbol} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2.5 text-slate-600 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-100">{stock.name}</span>
                            <span className="text-xs text-slate-600">{stock.symbol}</span>
                            {holding && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
                                보유 {holding.quantity.toLocaleString()}주
                              </span>
                            )}
                          </div>
                          {(stock.industry || stock.themes?.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {stock.industry && (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-700/60 text-slate-400 whitespace-nowrap">
                                  {stock.industry}
                                </span>
                              )}
                              {stock.themes?.slice(0, 2).map(t => (
                                <span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-500/80 whitespace-nowrap">
                                  {t}
                                </span>
                              ))}
                              {stock.themes?.length > 2 && (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-600 whitespace-nowrap">
                                  +{stock.themes.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            stock.market === 'KOSPI'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {stock.market}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 text-right font-mono text-xs">
                          {fmtCap(stock.market_cap)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          <span className={stock.per && stock.per < 10 ? 'text-amber-400 font-medium' : 'text-slate-300'}>
                            {fmt(stock.per, 'x')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          <span className={stock.pbr && stock.pbr < 1 ? 'text-blue-400 font-medium' : 'text-slate-300'}>
                            {fmt(stock.pbr)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          <span className={stock.roe && stock.roe > 15 ? 'text-emerald-400 font-medium' : 'text-slate-300'}>
                            {fmt(stock.roe, '%')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          {stock.operating_profit_growth !== null ? (
                            <span className={
                              stock.operating_profit_growth > 20 ? 'text-red-400 font-medium'
                              : stock.operating_profit_growth < 0 ? 'text-blue-400'
                              : 'text-slate-300'
                            }>
                              {stock.operating_profit_growth > 0 ? '+' : ''}{fmt(stock.operating_profit_growth, '%')}
                            </span>
                          ) : <span className="text-slate-600">-</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              onClick={() => handleAddWatchlist(stock.symbol, stock.name)}
                              title="관심 종목 추가"
                              className={`p-1 rounded transition-colors ${
                                justAdded ? 'text-amber-400'
                                : inWatchlist ? 'text-amber-500 hover:text-amber-300'
                                : 'text-slate-600 hover:text-amber-400'
                              }`}
                            >
                              <Star size={14} fill={inWatchlist || justAdded ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              onClick={() => router.push(`/notes/new?symbol=${stock.symbol}&name=${encodeURIComponent(stock.name)}`)}
                              title="매매 노트 작성"
                              className="p-1 rounded text-slate-600 hover:text-amber-400 transition-colors"
                            >
                              <NotebookPen size={14} />
                            </button>
                            <button
                              onClick={() => window.open(`/terminal?stock=${stock.symbol}`, '_blank')}
                              title="터미널에서 분석"
                              className="p-1 rounded text-slate-600 hover:text-blue-400 transition-colors"
                            >
                              <BarChart2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function FilterInput({ label, k, filters, onChange, placeholder }: {
  label: string; k: string; filters: Record<string, string>;
  onChange: (k: string, v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        value={filters[k]}
        onChange={e => onChange(k, e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-amber-600 placeholder-slate-600"
      />
    </div>
  )
}

function FilterRange({ label, minKey, maxKey, filters, onChange }: {
  label: string; minKey: string; maxKey: string; filters: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className="flex gap-1 items-center">
        <input
          type="number"
          value={filters[minKey]}
          onChange={e => onChange(minKey, e.target.value)}
          placeholder="최소"
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-amber-600 placeholder-slate-600"
        />
        <span className="text-slate-600 text-xs shrink-0">~</span>
        <input
          type="number"
          value={filters[maxKey]}
          onChange={e => onChange(maxKey, e.target.value)}
          placeholder="최대"
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 outline-none focus:border-amber-600 placeholder-slate-600"
        />
      </div>
    </div>
  )
}
