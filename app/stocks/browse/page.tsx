'use client'

import { useState, useEffect } from 'react'
import { ClassificationTabs } from '@/components/features/stocks/classification-tabs'
import { ClassificationGrid } from '@/components/features/stocks/classification-grid'
import { FavoritesView } from '@/components/features/stocks/favorites-view'
import { ClassificationType } from '@/lib/types/stocks'
import { Download, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SortField = 'symbol' | 'name' | 'market_cap' | 'per' | 'pbr' | 'roe' | 'eps' | 'cur_price' | 'volume' | 'change' | 'change_pct'
type SortOrder = 'asc' | 'desc'

// 장 시간 체크 (09:00 ~ 15:30 KST, 월~금)
const isMarketOpen = (): boolean => {
  const now = new Date()
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const hour = kst.getHours()
  const minute = kst.getMinutes()
  const day = kst.getDay() // 0=일요일, 6=토요일

  // 주말 체크
  if (day === 0 || day === 6) return false

  // 장 시간: 09:00 ~ 15:30
  if (hour < 9 || hour > 15) return false
  if (hour === 15 && minute > 30) return false

  return true
}

export default function StocksBrowsePage() {
  const [activeTab, setActiveTab] = useState<ClassificationType>('industry')
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<any>(null)
  const [selectedSector, setSelectedSector] = useState<{ name: string, type: 'industry' | 'theme' } | null>(null)
  const [sectorStocks, setSectorStocks] = useState<any[]>([])
  const [loadingStocks, setLoadingStocks] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [realtimeUpdating, setRealtimeUpdating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [sortField, setSortField] = useState<SortField>('market_cap')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSectorClick = async (sectorName: string, sectorType: 'industry' | 'theme') => {
    setSelectedSector({ name: sectorName, type: sectorType })
    setLoadingStocks(true)

    try {
      // screener 캐시에서 조회 (빠름)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/screener/v2/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: sectorType,
          name: sectorName
        })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setSectorStocks(data.results || [])
      if (data.last_updated) {
        setLastUpdate(new Date(data.last_updated))
      }
    } catch (error) {
      console.error('Failed to fetch sector stocks:', error)
      alert('종목 로딩 실패: ' + (error instanceof Error ? error.message : String(error)))
      setSectorStocks([])
    } finally {
      setLoadingStocks(false)
    }
  }

  const handleFullUpdate = async () => {
    if (!selectedSector) return

    setUpdating(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/screener/v2/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedSector.type,
          name: selectedSector.name
        })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setSectorStocks(data.results || [])
      setLastUpdate(new Date())
      alert('✅ 전체 업데이트 완료!')
    } catch (error) {
      console.error('Full update error:', error)
      alert('전체 업데이트 실패: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setUpdating(false)
    }
  }

  const handleRealtimeUpdate = async () => {
    if (!selectedSector) return

    if (!isMarketOpen()) {
      alert('⏰ 장이 열린 시간이 아닙니다\n\n장 시간: 월~금 09:00~15:30')
      return
    }

    setRealtimeUpdating(true)
    try {
      const allSymbols = sortedStocks.map(s => s.symbol)
      const batchSize = 30
      const batches = []

      for (let i = 0; i < allSymbols.length; i += batchSize) {
        batches.push(allSymbols.slice(i, i + batchSize))
      }

      console.log(`[Realtime] Fetching data in ${batches.length} batches...`)

      const batchResults = await Promise.all(
        batches.map(async (batch) => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/screener/v2/realtime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: batch })
          })

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          }

          return res.json()
        })
      )

      const allResults = batchResults.flatMap(data => data.results || [])

      setSectorStocks(prevStocks => {
        const updated = [...prevStocks]
        allResults.forEach((rt: any) => {
          const idx = updated.findIndex(s => s.symbol === rt.symbol)
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              cur_price: rt.cur_price,
              change: rt.change,
              change_pct: rt.change_pct,
              volume: rt.volume,
              trade_amount: rt.trade_amount
            }
          }
        })
        return updated
      })

      alert('✅ 실시간 업데이트 완료!')
    } catch (error) {
      console.error('Realtime update error:', error)
      alert('실시간 업데이트 실패: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setRealtimeUpdating(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const sortedStocks = [...sectorStocks].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]

    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    }

    const aStr = String(aVal)
    const bStr = String(bVal)
    const comparison = aStr.localeCompare(bStr, 'ko')
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const formatNumber = (num: number | null | undefined): string => {
    if (num == null) return '-'
    return num.toLocaleString()
  }

  const formatPercent = (num: number | null | undefined): string => {
    if (num == null) return '-'
    return num.toFixed(2)
  }

  const handleBackToList = () => {
    setSelectedSector(null)
    setSectorStocks([])
  }

  // 탭 변경 시 선택된 섹터 초기화
  useEffect(() => {
    setSelectedSector(null)
    setSectorStocks([])
  }, [activeTab])

  const handleFetchSectors = async () => {
    setFetching(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/sectors/fetch`, {
        method: 'POST'
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }

      const data = await res.json()
      console.log('Response data:', data)

      if (!data.success || !data.data) {
        throw new Error(data.message || '데이터 형식 오류')
      }

      setFetchResult(data.data)
      alert(`✅ 크롤링 완료!\n\n가져온 시간: ${data.data.fetched_at}\n업종: ${data.data.industries.count}개\n테마: ${data.data.themes.count}개`)
    } catch (error) {
      console.error('Fetch error:', error)
      alert('크롤링 실패:\n' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">종목 탐색</h1>

            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = '/sectors/trends'}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-md transition-all"
              >
                <TrendingUp className="w-4 h-4" />
                <span>섹터 동향</span>
              </button>

              <button
                onClick={() => window.location.href = '/stocks/movers'}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-md transition-all"
              >
                <TrendingUp className="w-4 h-4" />
                <span>종목 동향</span>
              </button>

              <button
                onClick={handleFetchSectors}
                disabled={fetching}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className={`w-4 h-4 ${fetching ? 'animate-bounce' : ''}`} />
                <span>{fetching ? '크롤링 중...' : '섹터 데이터 가져오기'}</span>
              </button>
            </div>
          </div>

          {/* 탭 */}
          <ClassificationTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 크롤링 결과 */}
        {fetchResult && (activeTab === 'industry' || activeTab === 'theme') && (
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                📊 {activeTab === 'industry' ? '업종' : '테마'} 동향
              </h3>
              <div className="text-sm text-gray-600">
                <span className="font-medium">시장 데이터:</span> {fetchResult.market_date}
                <span className="mx-2">|</span>
                <span className="font-medium">가져온 시간:</span> {fetchResult.fetched_at}
              </div>
            </div>

            {/* 업종 - industry 탭에서만 */}
            {activeTab === 'industry' && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">📈 업종 ({fetchResult.industries.count}개)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 업종 상승 */}
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h5 className="font-semibold text-red-600 mb-3 flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      상승 Top 10
                    </h5>
                    <div className="space-y-1.5">
                      {fetchResult.industries.top_up.map((sector: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm hover:bg-gray-50 px-2 py-1 rounded cursor-pointer transition-colors"
                          onClick={() => handleSectorClick(sector.name, 'industry')}
                        >
                          <span className="text-gray-700 hover:text-blue-600">{idx + 1}. {sector.name}</span>
                          <span className="font-semibold text-red-600">+{sector.change_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 업종 하락 */}
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h5 className="font-semibold text-blue-600 mb-3 flex items-center gap-2 text-sm">
                      <TrendingDown className="w-4 h-4" />
                      하락 Top 10
                    </h5>
                    <div className="space-y-1.5">
                      {fetchResult.industries.top_down.map((sector: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm hover:bg-gray-50 px-2 py-1 rounded cursor-pointer transition-colors"
                          onClick={() => handleSectorClick(sector.name, 'industry')}
                        >
                          <span className="text-gray-700 hover:text-blue-600">{idx + 1}. {sector.name}</span>
                          <span className="font-semibold text-blue-600">{sector.change_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 테마 - theme 탭에서만 */}
            {activeTab === 'theme' && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">🎯 테마 ({fetchResult.themes.count}개)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 테마 상승 */}
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h5 className="font-semibold text-red-600 mb-3 flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      상승 Top 10
                    </h5>
                    <div className="space-y-1.5">
                      {fetchResult.themes.top_up.map((sector: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm hover:bg-gray-50 px-2 py-1 rounded cursor-pointer transition-colors"
                          onClick={() => handleSectorClick(sector.name, 'theme')}
                        >
                          <span className="text-gray-700 hover:text-blue-600">{idx + 1}. {sector.name}</span>
                          <span className="font-semibold text-red-600">+{sector.change_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 테마 하락 */}
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <h5 className="font-semibold text-blue-600 mb-3 flex items-center gap-2 text-sm">
                      <TrendingDown className="w-4 h-4" />
                      하락 Top 10
                    </h5>
                    <div className="space-y-1.5">
                      {fetchResult.themes.top_down.map((sector: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm hover:bg-gray-50 px-2 py-1 rounded cursor-pointer transition-colors"
                          onClick={() => handleSectorClick(sector.name, 'theme')}
                        >
                          <span className="text-gray-700 hover:text-blue-600">{idx + 1}. {sector.name}</span>
                          <span className="font-semibold text-blue-600">{sector.change_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 선택된 섹터의 종목 리스트 */}
        {selectedSector ? (
          <div>
            {/* 헤더 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={handleBackToList}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  ← 전체 {selectedSector.type === 'industry' ? '업종' : '테마'} 목록으로
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {selectedSector.name}
                  </h1>
                  <p className="text-sm text-gray-600">
                    총 <span className="text-indigo-600 font-semibold">{sortedStocks.length}</span>개 종목
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {lastUpdate && (
                    <span className="text-sm text-gray-500">
                      {lastUpdate.toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                  <Button
                    onClick={handleRealtimeUpdate}
                    disabled={realtimeUpdating}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${realtimeUpdating ? 'animate-spin' : ''}`} />
                    {realtimeUpdating ? '업데이트 중...' : '실시간 정보 업데이트'}
                  </Button>
                  <Button
                    onClick={handleFullUpdate}
                    disabled={updating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
                    {updating ? '업데이트 중...' : '전체 업데이트'}
                  </Button>
                </div>
              </div>
            </div>

            {/* 종목 테이블 */}
            {loadingStocks ? (
              <div className="flex items-center justify-center py-20 bg-white rounded-lg">
                <div className="text-gray-500">로딩 중...</div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-300 bg-gray-100">
                        <th onClick={() => handleSort('symbol')} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center gap-1">
                            종목코드
                            {sortField === 'symbol' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th onClick={() => handleSort('name')} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center gap-1">
                            종목명
                            {sortField === 'name' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">시장</th>
                        <th onClick={() => handleSort('cur_price')} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            현재가
                            {sortField === 'cur_price' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th onClick={() => handleSort('change_pct')} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            전일대비
                            {sortField === 'change_pct' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th onClick={() => handleSort('volume')} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            거래량
                            {sortField === 'volume' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th onClick={() => handleSort('market_cap')} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            시가총액
                            {sortField === 'market_cap' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th onClick={() => handleSort('per')} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            PER
                            {sortField === 'per' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                        <th onClick={() => handleSort('roe')} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">
                          <div className="flex items-center justify-end gap-1">
                            ROE
                            {sortField === 'roe' && <span className="text-gray-900">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedStocks.map((stock) => (
                        <tr key={stock.symbol} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">{stock.symbol}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{stock.name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                              stock.market === 'KOSPI' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {stock.market}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">{formatNumber(stock.cur_price)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {stock.change_pct != null && (
                              <span className={stock.change_pct >= 0 ? 'text-red-600 font-semibold' : 'text-blue-600 font-semibold'}>
                                {stock.change_pct >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(stock.change_pct))}%
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatNumber(stock.volume)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{formatNumber(stock.market_cap)} 억</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatPercent(stock.per)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatPercent(stock.roe)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'favorites' ? (
          <FavoritesView />
        ) : (
          <ClassificationGrid type={activeTab} />
        )}
      </div>
    </div>
  )
}
