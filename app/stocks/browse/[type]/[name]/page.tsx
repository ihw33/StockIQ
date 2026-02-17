'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react'

interface ScreenerStock {
  symbol: string
  name: string
  market: string
  market_cap: number | null
  per: number | null
  roe: number | null
  eps: number | null
  revenue: number | null
  operating_profit: number | null
}

type SortKey = 'symbol' | 'name' | 'market' | 'market_cap' | 'per' | 'roe' | 'eps' | 'revenue'
type SortDir = 'asc' | 'desc'

function formatAmount(num: number | null | undefined): string {
  if (num == null || num === 0) return '-'
  if (num >= 10000) return `${(num / 10000).toFixed(1)}조`
  return `${num.toLocaleString()}억`
}

function formatNumber(num: number | null | undefined, suffix = ''): string {
  if (num == null) return '-'
  return `${num.toLocaleString()}${suffix}`
}

export default function StockListPage() {
  const params = useParams()
  const router = useRouter()
  const type = params.type as string
  const name = decodeURIComponent(params.name as string)

  const [stocks, setStocks] = useState<ScreenerStock[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('market_cap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    fetchStocks()
  }, [type, name])

  const fetchStocks = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/screener/v2/list`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, name }),
        }
      )
      const json = await res.json()
      setStocks(json.results || [])
    } catch (error) {
      console.error('Failed to fetch stocks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [stocks, sortKey, sortDir])

  const typeLabel = type === 'industry' ? '업종' : type === 'theme' ? '테마' : '그룹'

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>
    return sortDir === 'asc'
      ? <ChevronUp className="inline w-3 h-3 ml-1 text-blue-600" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-blue-600" />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-800 mb-3 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            뒤로
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{name}</h1>
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              {typeLabel}
            </span>
            {!loading && (
              <span className="text-sm text-gray-500">총 {stocks.length}개 종목</span>
            )}
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            로딩 중...
          </div>
        ) : stocks.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p>종목 데이터가 없습니다.</p>
            <p className="text-sm mt-1">스크리너 업데이트가 필요할 수 있습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('symbol')}>
                    코드 <SortIcon col="symbol" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                    종목명 <SortIcon col="name" />
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('market')}>
                    시장 <SortIcon col="market" />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('market_cap')}>
                    시가총액 <SortIcon col="market_cap" />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('per')}>
                    PER <SortIcon col="per" />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('roe')}>
                    ROE <SortIcon col="roe" />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('eps')}>
                    EPS <SortIcon col="eps" />
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('revenue')}>
                    매출액 <SortIcon col="revenue" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((stock) => (
                  <tr
                    key={stock.symbol}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/?stock=${stock.symbol}`)}
                  >
                    <td className="px-4 py-3 text-gray-500 font-mono">{stock.symbol}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{stock.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        stock.market === 'KOSPI'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {stock.market}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800">{formatAmount(stock.market_cap)}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{formatNumber(stock.per, '배')}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{formatNumber(stock.roe, '%')}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{formatNumber(stock.eps, '원')}</td>
                    <td className="px-4 py-3 text-right text-gray-800">{formatAmount(stock.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
