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
      alert(`✅ 크롤링 완료!\n\n업종: ${data.data.industries_count}개\n테마: ${data.data.themes_count}개\n총: ${data.data.total_sectors}개`)
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

            <button
              onClick={handleFetchSectors}
              disabled={fetching}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className={`w-4 h-4 ${fetching ? 'animate-bounce' : ''}`} />
              <span>{fetching ? '크롤링 중...' : '섹터 데이터 가져오기'}</span>
            </button>
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
            <h3 className="text-lg font-bold mb-4 text-gray-800">📊 오늘의 섹터 동향 ({fetchResult.date})</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 상승 Top 10 */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  상승 Top 10
                </h4>
                <div className="space-y-2">
                  {fetchResult.top_up.map((sector: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {idx + 1}. {sector.name}
                        <span className="ml-2 text-xs text-gray-500">({sector.type === 'industry' ? '업종' : '테마'})</span>
                      </span>
                      <span className="font-semibold text-red-600">+{sector.change_pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 하락 Top 10 */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-blue-600 mb-3 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  하락 Top 10
                </h4>
                <div className="space-y-2">
                  {fetchResult.top_down.map((sector: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {idx + 1}. {sector.name}
                        <span className="ml-2 text-xs text-gray-500">({sector.type === 'industry' ? '업종' : '테마'})</span>
                      </span>
                      <span className="font-semibold text-blue-600">{sector.change_pct}%</span>
                    </div>
                  ))}
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
