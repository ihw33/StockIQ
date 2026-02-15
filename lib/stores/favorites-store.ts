/**
 * 즐겨찾기 관리 Store
 * localStorage에 저장
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoritesState {
  favorites: Set<string> // 종목 코드 Set
  addFavorite: (code: string) => void
  removeFavorite: (code: string) => void
  toggleFavorite: (code: string) => void
  isFavorite: (code: string) => boolean
  getFavorites: () => string[]
  clearAll: () => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: new Set<string>(),

      addFavorite: (code: string) => {
        set((state) => {
          const newFavorites = new Set(state.favorites)
          newFavorites.add(code)
          return { favorites: newFavorites }
        })
      },

      removeFavorite: (code: string) => {
        set((state) => {
          const newFavorites = new Set(state.favorites)
          newFavorites.delete(code)
          return { favorites: newFavorites }
        })
      },

      toggleFavorite: (code: string) => {
        const { isFavorite, addFavorite, removeFavorite } = get()
        if (isFavorite(code)) {
          removeFavorite(code)
        } else {
          addFavorite(code)
        }
      },

      isFavorite: (code: string) => {
        return get().favorites.has(code)
      },

      getFavorites: () => {
        return Array.from(get().favorites)
      },

      clearAll: () => {
        set({ favorites: new Set<string>() })
      },
    }),
    {
      name: 'stockiq-favorites',
      // Set을 배열로 변환해서 저장
      partialize: (state) => ({
        favorites: Array.from(state.favorites),
      }),
      // 불러올 때 다시 Set으로 변환
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.favorites)) {
          state.favorites = new Set(state.favorites)
        }
      },
    }
  )
)
