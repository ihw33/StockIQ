'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Stock } from '@/lib/types/stocks'
import { useFavoritesStore } from '@/lib/stores/favorites-store'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { Star } from 'lucide-react'

interface StockListTableProps {
  stocks: Stock[]
}

export function StockListTable({ stocks }: StockListTableProps) {
  const router = useRouter()
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist()

  // 즐겨찾기 필터링
  const filteredStocks = useMemo(() => {
    if (!showFavoritesOnly) return stocks

    return stocks.filter((stock) => isFavorite(stock.code))
  }, [stocks, showFavoritesOnly, isFavorite])

  // 즐겨찾기 종목 수
  const favoritesCount = useMemo(() => {
    return stocks.filter((stock) => isFavorite(stock.code)).length
  }, [stocks, isFavorite])

  const handleStockClick = (code: string) => {
    router.push(`/?stock=${code}`)
  }

  const handleFavoriteClick = (e: React.MouseEvent, stock: Stock) => {
    e.stopPropagation()
    const wasFavorite = isFavorite(stock.code)

    // 즐겨찾기 토글
    toggleFavorite(stock.code)

    // 관심종목(watchlist)에도 동기화 - 기본 그룹 0
    if (wasFavorite) {
      removeFromWatchlist(stock.code)
    } else {
      addToWatchlist(stock.code, stock.name, 0)
    }
  }

  return (
    <div>
      {/* 필터 토글 */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setShowFavoritesOnly(false)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            !showFavoritesOnly
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          전체 보기 ({stocks.length})
        </button>
        <button
          onClick={() => setShowFavoritesOnly(true)}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            showFavoritesOnly
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Star className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
          <span>즐겨찾기만 ({favoritesCount})</span>
        </button>
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
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">태그</th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {showFavoritesOnly ? '즐겨찾기한 종목이 없습니다.' : '종목이 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredStocks.map((stock) => {
                const isFav = isFavorite(stock.code)

                return (
                  <tr
                    key={stock.code}
                    className={`border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                      isFav ? 'bg-yellow-50' : ''
                    }`}
                    onClick={() => handleStockClick(stock.code)}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => handleFavoriteClick(e, stock)}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                      >
                        <Star
                          className="w-5 h-5"
                          fill={isFav ? '#eab308' : 'none'}
                          stroke={isFav ? '#eab308' : 'currentColor'}
                        />
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
                      <div className="flex flex-wrap gap-1">
                        {/* 업종 태그 */}
                        {stock.industries.slice(0, 2).map((ind, idx) => (
                          <span
                            key={`ind-${idx}`}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded"
                          >
                            {ind}
                          </span>
                        ))}
                        {/* 그룹 태그 */}
                        {stock.groups.slice(0, 1).map((grp, idx) => (
                          <span
                            key={`grp-${idx}`}
                            className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded"
                          >
                            {grp}
                          </span>
                        ))}
                        {/* 테마 태그 (상위 2개) */}
                        {stock.themes.slice(0, 2).map((theme, idx) => (
                          <span
                            key={`theme-${idx}`}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                          >
                            {theme}
                          </span>
                        ))}
                        {/* 더보기 표시 */}
                        {stock.themes.length > 2 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            +{stock.themes.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
