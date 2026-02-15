'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClassificationType, Classification } from '@/lib/types/stocks'
import { Search, TrendingUp, TrendingDown } from 'lucide-react'

interface ClassificationGridProps {
  type: ClassificationType
}

export function ClassificationGrid({ type }: ClassificationGridProps) {
  const router = useRouter()
  const [data, setData] = useState<Classification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [type])

  const fetchData = async () => {
    setLoading(true)
    try {
      const endpoint = type === 'industry'
        ? '/api/stocks/industries/list'
        : type === 'theme'
        ? '/api/stocks/themes/list'
        : '/api/stocks/groups/list'

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
      console.log('Fetching from:', `${apiUrl}${endpoint}`)

      const res = await fetch(`${apiUrl}${endpoint}`)

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const json = await res.json()
      console.log('Response:', json)

      const items = type === 'industry'
        ? json.industries
        : type === 'theme'
        ? json.themes
        : json.groups

      setData(items || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
      alert(`데이터 로딩 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCardClick = (name: string) => {
    router.push(`/stocks/browse/${type}/${encodeURIComponent(name)}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  return (
    <div>
      {/* 검색 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600">
          총 {filteredData.length}개
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredData.map((item) => (
          <button
            key={item.name}
            onClick={() => handleCardClick(item.name)}
            className="p-4 border rounded-lg hover:shadow-lg transition-shadow text-left bg-white"
          >
            <div className="font-medium mb-2 truncate" title={item.name}>
              {item.name}
            </div>
            <div className="text-sm text-gray-600 mb-2">
              {item.total_stocks}개 종목
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${
              item.change_pct > 0 ? 'text-red-600' : item.change_pct < 0 ? 'text-blue-600' : 'text-gray-600'
            }`}>
              {item.change_pct > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : item.change_pct < 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              <span>{item.change_pct > 0 ? '+' : ''}{item.change_pct.toFixed(2)}%</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
