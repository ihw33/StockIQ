'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useFavoritesStore } from '@/lib/stores/favorites-store'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { usePortfolioStore } from '@/lib/stores/portfolio-store'
import { Stock } from '@/lib/types/stocks'
import { Star, Download, FolderInput, Briefcase } from 'lucide-react'

export function FavoritesView() {
  const router = useRouter()
  const { getFavorites, isFavorite, toggleFavorite } = useFavoritesStore()
  const { addToWatchlist, removeFromWatchlist, getItemGroup, changeGroup, groups } = useWatchlist()
  const { addPosition } = usePortfolioStore()
  const favoriteCodes = getFavorites()

  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState<string>('전체')

  useEffect(() => {
    fetchFavoriteStocks()
  }, [favoriteCodes.length])

  const fetchFavoriteStocks = async () => {
    if (favoriteCodes.length === 0) {
      setStocks([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 각 종목 상세 정보 가져오기
      const promises = favoriteCodes.map((code) =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/stocks/${code}`).then((res) => res.json())
      )
      const results = await Promise.all(promises)
      setStocks(results)
    } catch (error) {
      console.error('Failed to fetch favorite stocks:', error)
    } finally {
      setLoading(false)
    }
  }

  // 모든 태그 추출
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    stocks.forEach((stock) => {
      stock.industries.forEach((ind) => tagSet.add(ind))
      stock.themes.forEach((theme) => tagSet.add(theme))
      stock.groups.forEach((grp) => tagSet.add(grp))
    })
    return ['전체', ...Array.from(tagSet)]
  }, [stocks])

  // 태그별 필터링
  const filteredStocks = useMemo(() => {
    if (selectedTag === '전체') return stocks

    return stocks.filter((stock) =>
      stock.industries.includes(selectedTag) ||
      stock.themes.includes(selectedTag) ||
      stock.groups.includes(selectedTag)
    )
  }, [stocks, selectedTag])

  const handleStockClick = (code: string) => {
    router.push(`/?stock=${code}`)
  }

  const handleFavoriteClick = (e: React.MouseEvent, stock: Stock) => {
    e.stopPropagation()
    const wasFavorite = isFavorite(stock.code)

    // 즐겨찾기 토글
    toggleFavorite(stock.code)

    // 관심종목(watchlist)에도 동기화
    if (wasFavorite) {
      removeFromWatchlist(stock.code)
    } else {
      addToWatchlist(stock.code, stock.name, 0)
    }
  }

  const handleGroupChange = (e: React.MouseEvent, stock: Stock, newGroup: number) => {
    e.stopPropagation()
    // 관심종목 그룹 변경
    changeGroup(stock.code, newGroup)
  }

  const handleAddToPortfolio = (e: React.MouseEvent, stock: Stock) => {
    e.stopPropagation()

    const avgPriceInput = prompt(`${stock.name} 평균 매수가를 입력하세요:`)
    if (!avgPriceInput) return

    const avgPrice = parseFloat(avgPriceInput)
    if (isNaN(avgPrice) || avgPrice <= 0) {
      alert('올바른 가격을 입력해주세요.')
      return
    }

    const quantityInput = prompt('보유 수량을 입력하세요:')
    if (!quantityInput) return

    const quantity = parseInt(quantityInput)
    if (isNaN(quantity) || quantity <= 0) {
      alert('올바른 수량을 입력해주세요.')
      return
    }

    addPosition({
      symbol: stock.code,
      symbolName: stock.name,
      avgPrice,
      quantity
    })

    alert(`${stock.name}을(를) 포트폴리오에 추가했습니다!`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  if (favoriteCodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Star className="w-16 h-16 text-gray-300 mb-4" />
        <div className="text-xl font-medium text-gray-600 mb-2">
          관심 종목이 없습니다
        </div>
        <div className="text-sm text-gray-500">
          종목 리스트에서 ★ 버튼을 눌러 추가해보세요
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold mb-2">⭐ 관심 종목</h2>
          <div className="text-sm text-gray-600">
            총 {filteredStocks.length}개
            {selectedTag !== '전체' && ` (${selectedTag})`}
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <Download className="w-4 h-4" />
          <span className="text-sm">엑셀 저장</span>
        </button>
      </div>

      {/* 태그 필터 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {allTags.slice(0, 20).map((tag) => {
          const isSelected = tag === selectedTag
          const count = tag === '전체'
            ? stocks.length
            : stocks.filter((s) =>
                s.industries.includes(tag) ||
                s.themes.includes(tag) ||
                s.groups.includes(tag)
              ).length

          return (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag} ({count})
            </button>
          )
        })}
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-12">★</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">종목코드</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">종목명</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">시장</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">그룹</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">포트폴리오</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">태그</th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.map((stock) => {
              const currentGroup = getItemGroup(stock.code)

              return (
              <tr
                key={stock.code}
                className="border-b last:border-b-0 bg-yellow-50 hover:bg-yellow-100 cursor-pointer transition-colors"
                onClick={() => handleStockClick(stock.code)}
              >
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => handleFavoriteClick(e, stock)}
                    className="text-yellow-500 hover:text-yellow-600 transition-colors"
                  >
                    <Star className="w-5 h-5" fill="#eab308" stroke="#eab308" />
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{stock.code}</td>
                <td className="px-4 py-3 font-medium">{stock.name}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    stock.market === 'KOSPI'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {stock.market}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {groups.map((group) => {
                      const isActive = currentGroup === group.id
                      return (
                        <button
                          key={group.id}
                          onClick={(e) => handleGroupChange(e, stock, group.id)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            isActive
                              ? group.id === 0
                                ? 'bg-blue-500 text-white'
                                : group.id === 1
                                ? 'bg-green-500 text-white'
                                : 'bg-purple-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={group.name}
                        >
                          {group.name}
                        </button>
                      )
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => handleAddToPortfolio(e, stock)}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded transition-colors"
                    title="포트폴리오에 추가"
                  >
                    <Briefcase className="w-3 h-3" />
                    <span>추가</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {/* 업종 태그 */}
                    {stock.industries.map((ind, idx) => (
                      <span
                        key={`ind-${idx}`}
                        className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded"
                      >
                        {ind}
                      </span>
                    ))}
                    {/* 그룹 태그 */}
                    {stock.groups.map((grp, idx) => (
                      <span
                        key={`grp-${idx}`}
                        className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded"
                      >
                        {grp}
                      </span>
                    ))}
                    {/* 테마 태그 (상위 3개) */}
                    {stock.themes.slice(0, 3).map((theme, idx) => (
                      <span
                        key={`theme-${idx}`}
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                      >
                        {theme}
                      </span>
                    ))}
                    {/* 더보기 표시 */}
                    {stock.themes.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        +{stock.themes.length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
