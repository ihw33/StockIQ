'use client'

import { useState } from 'react'
import { ClassificationTabs } from '@/components/features/stocks/classification-tabs'
import { ClassificationGrid } from '@/components/features/stocks/classification-grid'
import { FavoritesView } from '@/components/features/stocks/favorites-view'
import { ClassificationType } from '@/lib/types/stocks'

export default function StocksBrowsePage() {
  const [activeTab, setActiveTab] = useState<ClassificationType>('industry')

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold mb-4">종목 탐색</h1>

          {/* 탭 */}
          <ClassificationTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'favorites' ? (
          <FavoritesView />
        ) : (
          <ClassificationGrid type={activeTab} />
        )}
      </div>
    </div>
  )
}
