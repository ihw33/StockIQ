'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, Download, BarChart3 } from 'lucide-react'

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

interface StockData {
  code: string
  name: string
  current_price: number
  change_amount: number
  change_pct: number
  volume: number
  rank: number
}

interface DayData {
  rising: StockData[]
  falling: StockData[]
}

export default function StockMoversPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily')
  const [historyData, setHistoryData] = useState<Record<string, DayData>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<any>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const timeRangeOptions = [
    { value: 'daily' as TimeRange, label: '일간', days: 30 },
    { value: 'weekly' as TimeRange, label: '주간', days: 90 },
    { value: 'monthly' as TimeRange, label: '월간', days: 180 },
    { value: 'quarterly' as TimeRange, label: '분기', days: 270 },
    { value: 'yearly' as TimeRange, label: '연간', days: 365 },
  ]

  const currentRange = timeRangeOptions.find(r => r.value === timeRange)

  useEffect(() => {
    fetchHistory()
  }, [timeRange])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const days = currentRange?.days || 30
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/stocks/movers/history?days=${days}`
      )
      const data = await res.json()
      setHistoryData(data.data || {})
    } catch (error) {
      console.error('History fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchStocks = async () => {
    setFetching(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/stocks/movers/fetch`, {
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
      alert(`✅ 크롤링 완료!\n\n가져온 시간: ${data.data.fetched_at}\n상승: ${data.data.rising.count}개\n하락: ${data.data.falling.count}개`)

      // 히스토리 새로고침
      fetchHistory()
    } catch (error) {
      console.error('Fetch error:', error)
      alert('크롤링 실패:\n' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setFetching(false)
    }
  }

  const dates = Object.keys(historyData).sort().reverse()

  const toggleExpand = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(date)) {
        newSet.delete(date)
      } else {
        newSet.add(date)
      }
      return newSet
    })
  }

  // 가장 자주 나타나는 종목 (빈도 분석)
  const getTopFrequentStocks = (direction: 'rising' | 'falling') => {
    const frequency: Record<string, { name: string, code: string, count: number }> = {}

    dates.forEach(date => {
      const stocks = historyData[date]?.[direction] || []
      stocks.forEach(stock => {
        if (!frequency[stock.code]) {
          frequency[stock.code] = { name: stock.name, code: stock.code, count: 0 }
        }
        frequency[stock.code].count += 1
      })
    })

    return Object.values(frequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  const formatPrice = (price: number) => {
    return price?.toLocaleString() || '-'
  }

  const formatVolume = (volume: number) => {
    if (!volume) return '-'
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`
    if (volume >= 1000) return `${(volume / 1000).toFixed(0)}K`
    return volume.toString()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-7 h-7 text-blue-600" />
              종목 동향
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = '/sectors/trends'}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                섹터 동향
              </button>
              <button
                onClick={() => window.location.href = '/stocks/browse'}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                종목 탐색
              </button>
              <button
                onClick={handleFetchStocks}
                disabled={fetching}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className={`w-4 h-4 ${fetching ? 'animate-bounce' : ''}`} />
                <span>{fetching ? '크롤링 중...' : '종목 데이터 가져오기'}</span>
              </button>
            </div>
          </div>

          {/* 필터 */}
          <div className="flex gap-2">
            {timeRangeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-500">데이터 로딩 중...</div>
          </div>
        ) : dates.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <div className="text-xl font-medium text-gray-600 mb-2">
              데이터가 없습니다
            </div>
            <div className="text-sm text-gray-500">
              "종목 데이터 가져오기" 버튼을 눌러주세요
            </div>
          </div>
        ) : (
          <>
            {/* 빈도 분석 */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-red-600" />
                  상승 빈도 Top 10
                  <span className="text-sm text-gray-500 font-normal">
                    (최근 {dates.length}일)
                  </span>
                </h3>
                <div className="space-y-2">
                  {getTopFrequentStocks('rising').map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {idx + 1}. {item.name} <span className="text-gray-400">({item.code})</span>
                      </span>
                      <span className="font-semibold text-red-600">{item.count}회</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-blue-600" />
                  하락 빈도 Top 10
                  <span className="text-sm text-gray-500 font-normal">
                    (최근 {dates.length}일)
                  </span>
                </h3>
                <div className="space-y-2">
                  {getTopFrequentStocks('falling').map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {idx + 1}. {item.name} <span className="text-gray-400">({item.code})</span>
                      </span>
                      <span className="font-semibold text-blue-600">{item.count}회</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 일별 히스토리 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="font-bold text-gray-800">
                  📅 일별 동향 ({dates.length}일)
                </h3>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {dates.map(date => {
                  const dayData = historyData[date]
                  const isExpanded = expandedDates.has(date)
                  const displayLimit = isExpanded ? 50 : 20

                  return (
                    <div key={date} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-gray-900">{date}</div>
                        {(dayData.rising.length > 20 || dayData.falling.length > 20) && (
                          <button
                            onClick={() => toggleExpand(date)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            {isExpanded ? '접기' : `더보기 (${Math.max(dayData.rising.length, dayData.falling.length) - 20}개 더)`}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 상승 종목 */}
                        <div>
                          <h4 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            상승 Top {displayLimit}
                          </h4>
                          <div className="space-y-1.5">
                            {dayData.rising.slice(0, displayLimit).map((stock, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex-1">
                                  <span className="text-gray-700 font-medium">{stock.name}</span>
                                  <span className="text-gray-400 ml-1">({stock.code})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-600">{formatPrice(stock.current_price)}원</span>
                                  <span className="text-red-600 font-semibold">+{stock.change_pct.toFixed(2)}%</span>
                                  <span className="text-gray-500">{formatVolume(stock.volume)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 하락 종목 */}
                        <div>
                          <h4 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            하락 Top {displayLimit}
                          </h4>
                          <div className="space-y-1.5">
                            {dayData.falling.slice(0, displayLimit).map((stock, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex-1">
                                  <span className="text-gray-700 font-medium">{stock.name}</span>
                                  <span className="text-gray-400 ml-1">({stock.code})</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-600">{formatPrice(stock.current_price)}원</span>
                                  <span className="text-blue-600 font-semibold">{stock.change_pct.toFixed(2)}%</span>
                                  <span className="text-gray-500">{formatVolume(stock.volume)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
