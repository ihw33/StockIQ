/**
 * 종목 관련 타입 정의
 */

export interface Stock {
  code: string
  name: string
  market: 'KOSPI' | 'KOSDAQ'
  sector?: string
  industry?: string
  listing_date?: string
  industries: string[]
  themes: string[]
  groups: string[]
}

export interface Classification {
  name: string
  no: string
  total_stocks: number
  change_pct: number
}

export interface IndustryResponse {
  total: number
  industries: Classification[]
}

export interface ThemeResponse {
  total: number
  themes: Classification[]
}

export interface GroupResponse {
  total: number
  groups: Classification[]
}

export interface StockListResponse {
  industry?: string
  theme?: string
  group?: string
  total: number
  stocks: Stock[]
}

export type ClassificationType = 'industry' | 'theme' | 'group' | 'favorites'
