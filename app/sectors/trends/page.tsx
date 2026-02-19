'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, TrendingUp, TrendingDown, Activity, Download } from 'lucide-react'
import { useMarketCalendar } from '@/lib/hooks/use-market-calendar'

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
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const { getDateLabel } = useMarketCalendar()

  const handleFetchSectors = async () => {
    setFetching(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'}/api/sectors/fetch`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (data.success) {
        alert(`✅ ${data.message}`)
        fetchHistory()
      } else {
        alert(`⚠️ ${data.message}`)
      }
    } catch (e) {
      alert('데이터 수집 실패')
    } finally {
      setFetching(false)
    }
  }

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
      // 주간 탭: 특별한 API 호출
      if (timeRange === 'weekly') {
        const typeParam = sectorType === 'all' ? '' : `?sector_type=${sectorType}`
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'}/api/sectors/weekly-summary${typeParam}`
        )
        const data = await res.json()
        setWeeklyData(data.data || null)
        setHistoryData({})
        setMonthlyData(null)
      } else if (timeRange === 'monthly') {
        // 월간 탭: 패턴 분석 API
        const typeParam = sectorType === 'all' ? '' : `?sector_type=${sectorType}`
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'}/api/sectors/monthly-analysis${typeParam}`
        )
        const data = await res.json()
        setMonthlyData(data.data ? { ...data.data, _meta: { period: data.period } } : { _error: data.message, _trading_days: data.trading_days ?? 0 })
        setHistoryData({})
        setWeeklyData(null)
      } else {
        // 일간/분기/연간: 기존 history API
        const days = currentRange?.days || 30
        const typeParam = sectorType === 'all' ? '' : `&sector_type=${sectorType}`
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'}/api/sectors/history?days=${days}${typeParam}`
        )
        const data = await res.json()
        setHistoryData(data.data || {})
        setWeeklyData(null)
        setMonthlyData(null)
      }
    } catch (error) {
      console.error('History fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const dates = Object.keys(historyData).sort().reverse()


  // 날짜 표시 함수 (요일/주차/월 정보 추가)
  const formatDateWithContext = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const dayOfWeek = days[date.getDay()]

    // 주차 계산 (해당 월의 몇 번째 주)
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    const weekNum = Math.ceil((date.getDate() + firstDay.getDay()) / 7)

    const month = date.getMonth() + 1
    const monthStr = `${month}월`

    return {
      date: dateStr,
      dayOfWeek: `${dayOfWeek}요일`,
      week: `${weekNum}주차`,
      month: monthStr,
      fullStr: `${monthStr} ${weekNum}주차 (${dayOfWeek})`
    }
  }

  // 최신 날짜의 당일 순위 (일간용)
  const getLatestDayRanking = (direction: 'up' | 'down', type: 'industries' | 'themes') => {
    if (dates.length === 0) return []
    const latest = dates[0] // 가장 최근 날짜
    const sectors = historyData[latest]?.[type]?.[direction] || []
    return sectors
      .filter(s => s.name !== '기타')
      .sort((a, b) => direction === 'up' ? b.change_pct - a.change_pct : a.change_pct - b.change_pct)
      .slice(0, 10)
  }

  // 가장 자주 나타나는 섹터 (빈도 분석 - 분기/연간용)
  const getTopFrequentSectors = (direction: 'up' | 'down', type: 'industries' | 'themes') => {
    const frequency: Record<string, number> = {}

    dates.forEach(date => {
      const sectors = historyData[date]?.[type]?.[direction] || []
      sectors.forEach(sector => {
        if (sector.name !== '기타') {
          frequency[sector.name] = (frequency[sector.name] || 0) + 1
        }
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
            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = '/stocks/movers'}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                종목 동향
              </button>
              <button
                onClick={() => window.location.href = '/stocks/browse'}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                종목 탐색
              </button>
              <button
                onClick={handleFetchSectors}
                disabled={fetching}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className={`w-4 h-4 ${fetching ? 'animate-bounce' : ''}`} />
                {fetching ? '수집 중...' : '섹터 데이터 가져오기'}
              </button>
            </div>
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
        ) : (timeRange !== 'weekly' && timeRange !== 'monthly' && dates.length === 0) ? (
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
            {/* 주간 요약 */}
            {timeRange === 'weekly' && weeklyData ? (
              <div className="space-y-6">
                {/* 5일 누적 수익률 Top 10 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-red-600" />
                      5일 누적 상승 Top 10
                    </h3>
                    <div className="space-y-2">
                      {weeklyData?.cumulative?.top_up?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <Link href={`/stocks/browse/${item.type === 'theme' ? 'theme' : 'industry'}/${encodeURIComponent(item.name)}`} className="font-medium hover:text-blue-600 hover:underline">
                            {idx + 1}. {item.name}
                          </Link>
                          <span className="text-red-600 font-bold">+{item.cumulative}%</span>
                        </div>
                      )) || <p className="text-gray-500">데이터 없음</p>}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-blue-600" />
                      5일 누적 하락 Top 10
                    </h3>
                    <div className="space-y-2">
                      {weeklyData?.cumulative?.top_down?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <Link href={`/stocks/browse/${item.type === 'theme' ? 'theme' : 'industry'}/${encodeURIComponent(item.name)}`} className="font-medium hover:text-blue-600 hover:underline">
                            {idx + 1}. {item.name}
                          </Link>
                          <span className="text-blue-600 font-bold">{item.cumulative}%</span>
                        </div>
                      )) || <p className="text-gray-500">데이터 없음</p>}
                    </div>
                  </div>
                </div>

                {/* 강세/약세 지속 섹터 */}
                {(weeklyData?.sustained?.up?.length > 0 || weeklyData?.sustained?.down?.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-red-50 to-white rounded-lg p-6 shadow-sm border border-red-200">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        🔥 강세 지속 (3일 이상 상승)
                      </h3>
                      <div className="space-y-2">
                        {weeklyData?.sustained?.up?.slice(0, 5).map((item: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700">{item.name}</span>
                              <span className="font-bold text-red-600">누적 +{item.cumulative}%</span>
                            </div>
                            <div className="flex gap-1 mt-1 text-xs">
                              {item.daily.slice(-3).map((d: number, i: number) => (
                                <span key={i} className="text-red-600">+{d}%</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-6 shadow-sm border border-blue-200">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        ❄️ 약세 지속 (3일 이상 하락)
                      </h3>
                      <div className="space-y-2">
                        {weeklyData?.sustained?.down?.slice(0, 5).map((item: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-700">{item.name}</span>
                              <span className="font-bold text-blue-600">누적 {item.cumulative}%</span>
                            </div>
                            <div className="flex gap-1 mt-1 text-xs">
                              {item.daily.slice(-3).map((d: number, i: number) => (
                                <span key={i} className="text-blue-600">{d}%</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 추세 반전 섹터 */}
                {weeklyData?.reversal?.length > 0 && (
                  <div className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      ⚡ 추세 반전 섹터
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {weeklyData?.reversal?.slice(0, 10).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm border-b pb-2">
                          <div>
                            <span className="font-medium text-gray-700">{item.name}</span>
                            <div className="text-xs text-gray-500 mt-1">
                              이전 평균: {item.prev}% → 최근: {item.recent}%
                            </div>
                          </div>
                          <span className={`font-bold ${item.direction === 'up' ? 'text-red-600' : 'text-blue-600'}`}>
                            {item.direction === 'up' ? '↗️ 상승 전환' : '↘️ 하락 전환'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : timeRange === 'weekly' ? (
              /* 주간 탭인데 데이터 없음 */
              <div className="bg-white rounded-lg p-12 text-center">
                <p className="text-gray-600 mb-2">주간 데이터가 없습니다.</p>
                <p className="text-sm text-gray-500">최소 4거래일 이상의 데이터가 필요합니다.</p>
                {loading && <p className="text-sm text-blue-600 mt-4">로딩 중...</p>}
              </div>
            ) : timeRange === 'monthly' && monthlyData && !monthlyData._error ? (
              /* 월간 패턴 분석 */
              <div className="space-y-6">
                {/* 1. 주요 발견 사항 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {monthlyData.patterns?.slice(0, 3).map((pattern: any, idx: number) => (
                    <div
                      key={idx}
                      className={`rounded-lg p-4 border-2 ${
                        pattern.type === 'positive'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">
                          {pattern.type === 'positive' ? '🔗' : '⚡'}
                        </span>
                        <span className="font-bold text-gray-800">
                          {pattern.type === 'positive' ? '강한 동조화' : '뚜렷한 역상관'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{pattern.description}</p>
                      <p className={`text-lg font-bold ${
                        pattern.type === 'positive' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        상관계수: {pattern.correlation}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 2. 상관계수 히트맵 */}
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="font-bold text-gray-800 mb-4 text-lg">
                    📊 섹터 간 상관관계 (30일)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="p-2 text-left font-semibold text-gray-700">섹터</th>
                          {monthlyData.sectors?.map((sector: string) => (
                            <th key={sector} className="p-2 text-center font-semibold text-gray-700 text-xs">
                              {sector}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.sectors?.map((sector1: string) => (
                          <tr key={sector1} className="border-t">
                            <td className="p-2 font-medium text-gray-700">{sector1}</td>
                            {monthlyData.sectors?.map((sector2: string) => {
                              const corr = monthlyData.correlation_matrix?.[sector1]?.[sector2] || 0
                              let bgColor = 'bg-gray-50'
                              let textColor = 'text-gray-600'

                              if (corr >= 0.5) {
                                bgColor = 'bg-red-100'
                                textColor = 'text-red-700 font-bold'
                              } else if (corr <= -0.4) {
                                bgColor = 'bg-blue-100'
                                textColor = 'text-blue-700 font-bold'
                              } else if (corr === 1.0) {
                                bgColor = 'bg-gray-200'
                                textColor = 'text-gray-500'
                              }

                              return (
                                <td key={sector2} className={`p-2 text-center ${bgColor} ${textColor} text-xs`}>
                                  {corr.toFixed(2)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center gap-6 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                      <span>강한 양의 상관 (≥0.5)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                      <span>강한 음의 상관 (≤-0.4)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                      <span>중립</span>
                    </div>
                  </div>
                </div>

                {/* 3. 섹터 클러스터 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 공격주 */}
                  <div className="bg-gradient-to-br from-red-50 to-white rounded-lg p-6 shadow-sm border border-red-200">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      🚀 {monthlyData.clusters?.aggressive?.label}
                    </h3>
                    <div className="space-y-2">
                      {monthlyData.clusters?.aggressive?.sectors?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{item.name}</span>
                          <span className="font-bold text-red-600">+{item.return}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 중립 */}
                  <div className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      📊 {monthlyData.clusters?.neutral?.label}
                    </h3>
                    <div className="space-y-2">
                      {monthlyData.clusters?.neutral?.sectors?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{item.name}</span>
                          <span className={`font-bold ${
                            item.return > 0 ? 'text-red-600' : item.return < 0 ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {item.return > 0 ? '+' : ''}{item.return}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 방어주 */}
                  <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-6 shadow-sm border border-blue-200">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      🛡️ {monthlyData.clusters?.defensive?.label}
                    </h3>
                    <div className="space-y-2">
                      {monthlyData.clusters?.defensive?.sectors?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{item.name}</span>
                          <span className={`font-bold ${
                            item.return > 0 ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {item.return > 0 ? '+' : ''}{item.return}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. 로테이션 패턴 */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 shadow-sm border border-purple-200">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    🔄 발견된 로테이션 패턴
                  </h3>
                  <div className="bg-white rounded-lg p-4 border">
                    <p className="text-gray-800 font-medium mb-2">
                      {monthlyData.rotation_pattern?.description}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">조건:</span>
                        <p className="font-semibold text-gray-800">{monthlyData.rotation_pattern?.condition}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">결과:</span>
                        <p className="font-semibold text-purple-700">{monthlyData.rotation_pattern?.result}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">표본 크기:</span>
                        <p className="font-semibold text-gray-800">{monthlyData.rotation_pattern?.sample_size}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : timeRange === 'monthly' ? (
              /* 월간 탭 - 데이터 부족 */
              <div className="bg-white rounded-lg p-12 text-center">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-gray-700 font-medium mb-2">
                  {monthlyData?._error || '월간 패턴 분석 데이터가 부족합니다.'}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-600">
                  <span>현재</span>
                  <span className="font-bold text-gray-800">{monthlyData?._trading_days ?? 0}거래일</span>
                  <span>/ 최소 10거래일 필요</span>
                </div>
                <p className="text-xs text-gray-400 mt-4">장 운영일마다 자동으로 데이터가 쌓입니다</p>
              </div>
            ) : (
              <>
                {/* 일간: 당일 순위 / 분기·연간: 빈도 분석 */}
                {timeRange === 'daily' ? (
                  <>
                    {sectorType !== 'theme' && (
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg p-6 shadow-sm border">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-red-600" />
                            업종 상승 Top 10
                            <span className="text-sm text-gray-500 font-normal">({dates[0]})</span>
                          </h3>
                          <div className="space-y-2">
                            {getLatestDayRanking('up', 'industries').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/industry/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
                                <span className="font-semibold text-red-600">+{item.change_pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-6 shadow-sm border">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-blue-600" />
                            업종 하락 Top 10
                            <span className="text-sm text-gray-500 font-normal">({dates[0]})</span>
                          </h3>
                          <div className="space-y-2">
                            {getLatestDayRanking('down', 'industries').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/industry/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
                                <span className="font-semibold text-blue-600">{item.change_pct}%</span>
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
                            테마 상승 Top 10
                            <span className="text-sm text-gray-500 font-normal">({dates[0]})</span>
                          </h3>
                          <div className="space-y-2">
                            {getLatestDayRanking('up', 'themes').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/theme/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
                                <span className="font-semibold text-red-600">+{item.change_pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-6 shadow-sm border">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-blue-600" />
                            테마 하락 Top 10
                            <span className="text-sm text-gray-500 font-normal">({dates[0]})</span>
                          </h3>
                          <div className="space-y-2">
                            {getLatestDayRanking('down', 'themes').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/theme/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
                                <span className="font-semibold text-blue-600">{item.change_pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {sectorType !== 'theme' && (
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg p-6 shadow-sm border">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-red-600" />
                            업종 상승 빈도 Top 10
                            <span className="text-sm text-gray-500 font-normal">(최근 {dates.length}일)</span>
                          </h3>
                          <div className="space-y-2">
                            {getTopFrequentSectors('up', 'industries').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/industry/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
                                <span className="font-semibold text-red-600">{item.count}회</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-6 shadow-sm border">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-blue-600" />
                            업종 하락 빈도 Top 10
                            <span className="text-sm text-gray-500 font-normal">(최근 {dates.length}일)</span>
                          </h3>
                          <div className="space-y-2">
                            {getTopFrequentSectors('down', 'industries').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/industry/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
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
                            <span className="text-sm text-gray-500 font-normal">(최근 {dates.length}일)</span>
                          </h3>
                          <div className="space-y-2">
                            {getTopFrequentSectors('up', 'themes').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/theme/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
                                <span className="font-semibold text-red-600">{item.count}회</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-6 shadow-sm border">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-blue-600" />
                            테마 하락 빈도 Top 10
                            <span className="text-sm text-gray-500 font-normal">(최근 {dates.length}일)</span>
                          </h3>
                          <div className="space-y-2">
                            {getTopFrequentSectors('down', 'themes').map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <Link href={`/stocks/browse/theme/${encodeURIComponent(item.name)}`} className="text-gray-700 hover:text-blue-600 hover:underline">
                                  {idx + 1}. {item.name}
                                </Link>
                                <span className="font-semibold text-blue-600">{item.count}회</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* 일별 히스토리 (주간 탭 제외) */}
            {timeRange !== 'weekly' && dates.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h3 className="font-bold text-gray-800">
                    📅 일별 동향 ({dates.length}일)
                  </h3>
                </div>
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {dates.map(date => {
                    const dayData = historyData[date]
                    const { label: dayLabel, isHoliday, reason } = getDateLabel(date)
                    return (
                      <div key={date} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          {date}
                          <span className="text-sm font-normal text-gray-500">{dayLabel}</span>
                          {isHoliday && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              {reason || '휴장'}
                            </span>
                          )}
                        </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 업종 상승 */}
                        {sectorType !== 'theme' && (
                          <>
                            <div>
                              <h4 className="text-xs font-semibold text-red-600 mb-2">업종 상승</h4>
                              <div className="space-y-1">
                                {dayData.industries.up.slice(0, 5).map((s, i) => (
                                  <div key={i} className="text-xs flex justify-between">
                                    <Link href={`/stocks/browse/industry/${encodeURIComponent(s.name)}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                                      {s.name}
                                    </Link>
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
                                    <Link href={`/stocks/browse/industry/${encodeURIComponent(s.name)}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                                      {s.name}
                                    </Link>
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
                                    <Link href={`/stocks/browse/theme/${encodeURIComponent(s.name)}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                                      {s.name}
                                    </Link>
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
                                    <Link href={`/stocks/browse/theme/${encodeURIComponent(s.name)}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                                      {s.name}
                                    </Link>
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
