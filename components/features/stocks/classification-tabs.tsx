'use client'

import { ClassificationType } from '@/lib/types/stocks'
import { useFavoritesStore } from '@/lib/stores/favorites-store'
import { Star } from 'lucide-react'

interface ClassificationTabsProps {
  activeTab: ClassificationType
  onTabChange: (tab: ClassificationType) => void
}

export function ClassificationTabs({ activeTab, onTabChange }: ClassificationTabsProps) {
  const favorites = useFavoritesStore((state) => state.getFavorites())

  const tabs = [
    { id: 'industry' as ClassificationType, label: '업종', count: 79 },
    { id: 'theme' as ClassificationType, label: '테마', count: 260 },
    { id: 'group' as ClassificationType, label: '그룹', count: 62 },
    { id: 'favorites' as ClassificationType, label: '관심종목', count: favorites.length, icon: Star },
  ]

  return (
    <div className="flex gap-2 border-b">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              px-4 py-2 font-medium transition-colors relative
              ${isActive
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              <span className={`
                text-xs px-2 py-0.5 rounded-full
                ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
              `}>
                {tab.count}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
