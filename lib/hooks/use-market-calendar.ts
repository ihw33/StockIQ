import { useState, useEffect } from 'react'

interface CalendarEntry {
  date: string
  day_of_week: string
  is_trading_day: boolean
  reason: string | null
}

export function useMarketCalendar(days = 60) {
  const [calendar, setCalendar] = useState<Record<string, CalendarEntry>>({})

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/market/calendar?days=${days}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, CalendarEntry> = {}
        for (const entry of data.calendar || []) {
          map[entry.date] = entry
        }
        setCalendar(map)
      })
      .catch(() => {})
  }, [days])

  const getDateLabel = (dateStr: string): { label: string; isHoliday: boolean; reason: string | null } => {
    const entry = calendar[dateStr]
    if (!entry) {
      // fallback: 날짜만 표시
      const d = new Date(dateStr)
      const days = ['일', '월', '화', '수', '목', '금', '토']
      return { label: days[d.getDay()] + '요일', isHoliday: false, reason: null }
    }
    return {
      label: entry.day_of_week,
      isHoliday: !entry.is_trading_day,
      reason: entry.reason,
    }
  }

  return { calendar, getDateLabel }
}
