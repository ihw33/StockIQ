import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StockIQ - AI 기반 주식 투자 도우미',
  description: '실시간 주식 정보와 AI 뉴스 요약으로 스마트한 투자 결정을 내리세요',
  keywords: '주식, 투자, AI, 뉴스요약, 한국주식, 코스피, 코스닥',
  authors: [{ name: 'StockIQ Team' }],
  openGraph: {
    title: 'StockIQ - AI 기반 주식 투자 도우미',
    description: '실시간 주식 정보와 AI 뉴스 요약으로 스마트한 투자 결정을 내리세요',
    type: 'website',
    locale: 'ko_KR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}