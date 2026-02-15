'use client'

import { useState } from 'react'
import { ClassificationTabs } from '@/components/features/stocks/classification-tabs'
import { ClassificationGrid } from '@/components/features/stocks/classification-grid'
import { FavoritesView } from '@/components/features/stocks/favorites-view'
import { ClassificationType } from '@/lib/types/stocks'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'

export default function StocksBrowsePage() {
  const [activeTab, setActiveTab] = useState<ClassificationType>('industry')
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<any>(null)

  const handleFetchSectors = async () => {
    setFetching(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/sectors/fetch`, {
        method: 'POST'
      })
      const data = await res.json()
      setFetchResult(data.data)
      alert(`✅ 크롤링 완료!\n\n가져온 시간: ${data.data.fetched_at}\n업종: ${data.data.industries.count}개\n테마: ${data.data.themes.count}개`)
    } catch (error) {
      console.error('Fetch error:', error)
      alert('크롤링 실패: ' + error)
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
        {fetchResult && (
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">📊 섹터 동향</h3>
              <div className="text-sm text-gray-600">
                <span className="font-medium">시장 데이터:</span> {fetchResult.market_date}
                <span className="mx-2">|</span>
                <span className="font-medium">가져온 시간:</span> {fetchResult.fetched_at}
              </div>
            </div>

            {/* 업종 */}
            <div className="mb-6">
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
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {sector.name}</span>
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
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {sector.name}</span>
                        <span className="font-semibold text-blue-600">{sector.change_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 테마 */}
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
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {sector.name}</span>
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
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{idx + 1}. {sector.name}</span>
                        <span className="font-semibold text-blue-600">{sector.change_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'favorites' ? (
          <FavoritesView />
        ) : (
          <ClassificationGrid type={activeTab} />
        )}
      </div>
    </div>
  )
}
