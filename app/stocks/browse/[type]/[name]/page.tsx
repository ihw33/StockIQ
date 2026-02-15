'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StockListTable } from '@/components/features/stocks/stock-list-table'
import { Stock } from '@/lib/types/stocks'
import { ChevronLeft } from 'lucide-react'

export default function StockListPage() {
  const params = useParams()
  const router = useRouter()
  const type = params.type as string
  const name = decodeURIComponent(params.name as string)

  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStocks()
  }, [type, name])

  const fetchStocks = async () => {
    setLoading(true)
    try {
      const endpoint = type === 'industry'
        ? `/api/stocks/industries/${encodeURIComponent(name)}/stocks`
        : type === 'theme'
        ? `/api/stocks/themes/${encodeURIComponent(name)}/stocks`
        : `/api/stocks/groups/${encodeURIComponent(name)}/stocks`

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}${endpoint}`)
      const json = await res.json()
      setStocks(json.stocks || [])
    } catch (error) {
      console.error('Failed to fetch stocks:', error)
    } finally {
      setLoading(false)
    }
  }

  const typeLabel = type === 'industry' ? '업종' : type === 'theme' ? '테마' : '그룹'

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/stocks/browse')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>뒤로</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{name}</h1>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {typeLabel}
            </span>
          </div>

          {!loading && (
            <div className="mt-2 text-sm text-gray-600">
              총 {stocks.length}개 종목
            </div>
          )}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-500">로딩 중...</div>
          </div>
        ) : (
          <StockListTable stocks={stocks} />
        )}
      </div>
    </div>
  )
}
