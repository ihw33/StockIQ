'use client'

import { useState, useEffect } from 'react'
import { Calendar, TrendingUp, TrendingDown, Activity } from 'lucide-react'

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
type SectorType = 'all' | 'industry' | 'theme'

interface SectorData {
  name: string
  change_pct: number
  rank: number
}

interface DayData {
  industries: {
    up: SectorData[]
    down: SectorData[]
  }
  themes: {
    up: SectorData[]
    down: SectorData[]
  }
}

export default function SectorTrendsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily')
  const [sectorType, setSectorType] = useState<SectorType>('all')
  const [historyData, setHistoryData] = useState<Record<string, DayData>>({})
  const [loading, setLoading] = useState(false)

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
  }, [timeRange, sectorType])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const days = currentRange?.days || 30
      const typeParam = sectorType === 'all' ? '' : `&sector_type=${sectorType}`
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/sectors/history?days=${days}${typeParam}`
      )
      const data = await res.json()
      setHistoryData(data.data || {})
    } catch (error) {
      console.error('History fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const dates = Object.keys(historyData).sort().reverse()

  // 가장 자주 나타나는 섹터 (빈도 분석)
  const getTopFrequentSectors = (direction: 'up' | 'down', type: 'industries' | 'themes') => {
    const frequency: Record<string, number> = {}

    dates.forEach(date => {
      const sectors = historyData[date]?.[type]?.[direction] || []
      sectors.forEach(sector => {
        frequency[sector.name] = (frequency[sector.name] || 0) + 1
      })
    })

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-7 h-7 text-blue-600" />
              섹터 로테이션 동향
            </h1>
            <button
              onClick={() => window.location.href = '/stocks/browse'}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              종목 탐색으로
            </button>
          </div>

          {/* 필터 */}
          <div className="flex gap-4">
            {/* 기간 선택 */}
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

            {/* 섹터 타입 선택 */}
            <div className="flex gap-2 ml-4">
              {[
                { value: 'all' as SectorType, label: '전체' },
                { value: 'industry' as SectorType, label: '업종만' },
                { value: 'theme' as SectorType, label: '테마만' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setSectorType(option.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sectorType === option.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 border hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <div className="text-xl font-medium text-gray-600 mb-2">
              데이터가 없습니다
            </div>
            <div className="text-sm text-gray-500">
              종목 탐색 페이지에서 "섹터 데이터 가져오기" 버튼을 눌러주세요
            </div>
          </div>
        ) : (
          <>
            {/* 빈도 분석 */}
            {sectorType !== 'theme' && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    업종 상승 빈도 Top 10
                    <span className="text-sm text-gray-500 font-normal">
                      (최근 {dates.length}일)
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {getTopFrequentSectors('up', 'industries').map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {item.name}</span>
                        <span className="font-semibold text-red-600">{item.count}회</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-blue-600" />
                    업종 하락 빈도 Top 10
                    <span className="text-sm text-gray-500 font-normal">
                      (최근 {dates.length}일)
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {getTopFrequentSectors('down', 'industries').map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {item.name}</span>
                        <span className="font-semibold text-blue-600">{item.count}회</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {sectorType !== 'industry' && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    테마 상승 빈도 Top 10
                    <span className="text-sm text-gray-500 font-normal">
                      (최근 {dates.length}일)
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {getTopFrequentSectors('up', 'themes').map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {item.name}</span>
                        <span className="font-semibold text-red-600">{item.count}회</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-blue-600" />
                    테마 하락 빈도 Top 10
                    <span className="text-sm text-gray-500 font-normal">
                      (최근 {dates.length}일)
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {getTopFrequentSectors('down', 'themes').map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {item.name}</span>
                        <span className="font-semibold text-blue-600">{item.count}회</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                  return (
                    <div key={date} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="font-semibold text-gray-900 mb-4">{date}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 업종 상승 */}
                        {sectorType !== 'theme' && (
                          <>
                            <div>
                              <h4 className="text-xs font-semibold text-red-600 mb-2">업종 상승</h4>
                              <div className="space-y-1">
                                {dayData.industries.up.slice(0, 5).map((s, i) => (
                                  <div key={i} className="text-xs flex justify-between">
                                    <span className="text-gray-600">{s.name}</span>
                                    <span className="text-red-600 font-medium">+{s.change_pct}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-blue-600 mb-2">업종 하락</h4>
                              <div className="space-y-1">
                                {dayData.industries.down.slice(0, 5).map((s, i) => (
                                  <div key={i} className="text-xs flex justify-between">
                                    <span className="text-gray-600">{s.name}</span>
                                    <span className="text-blue-600 font-medium">{s.change_pct}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                        {/* 테마 상승/하락 */}
                        {sectorType !== 'industry' && (
                          <>
                            <div>
                              <h4 className="text-xs font-semibold text-red-600 mb-2">테마 상승</h4>
                              <div className="space-y-1">
                                {dayData.themes.up.slice(0, 5).map((s, i) => (
                                  <div key={i} className="text-xs flex justify-between">
                                    <span className="text-gray-600">{s.name}</span>
                                    <span className="text-red-600 font-medium">+{s.change_pct}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-blue-600 mb-2">테마 하락</h4>
                              <div className="space-y-1">
                                {dayData.themes.down.slice(0, 5).map((s, i) => (
                                  <div key={i} className="text-xs flex justify-between">
                                    <span className="text-gray-600">{s.name}</span>
                                    <span className="text-blue-600 font-medium">{s.change_pct}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
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
