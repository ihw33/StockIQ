'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClassificationType, Classification } from '@/lib/types/stocks'
import { Search } from 'lucide-react'

interface ClassificationGridProps {
  type: ClassificationType
  onSectorClick?: (name: string, type: 'industry' | 'theme' | 'group') => void
}

export function ClassificationGrid({ type, onSectorClick }: ClassificationGridProps) {
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

  const filteredData = data
    .filter((item) => item.name !== '기타')  // ETF/ETN 제외 (Kiwoom API 미지원)
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleCardClick = (name: string) => {
    if (onSectorClick) {
      onSectorClick(name, type as 'industry' | 'theme' | 'group')
    } else {
      router.push(`/stocks/browse/${type}/${encodeURIComponent(name)}`)
    }
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
      <div className="mb-6 flex items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="ml-4 text-sm text-gray-600 font-medium">
          총 {filteredData.length}개
        </div>
      </div>

      {/* 테이블 뷰 */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">이름</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">종목 수</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 w-32">상세보기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map((item) => (
              <tr
                key={item.name}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleCardClick(item.name)}
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{item.name}</div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {item.total_stocks}개
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCardClick(item.name)
                    }}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
