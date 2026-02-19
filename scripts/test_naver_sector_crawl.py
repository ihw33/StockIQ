#!/usr/bin/env python3
"""
네이버 증권 업종별 시세 크롤링 테스트
URL: https://finance.naver.com/sise/sise_group.naver?type=upjong
"""
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

def crawl_naver_sectors():
    """네이버 증권 업종 리스트 크롤링"""
    url = "https://finance.naver.com/sise/sise_group.naver?type=upjong"

    print(f"🔍 Crawling: {url}")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        print(f"✅ Response: {response.status_code}")
        print(f"   Content-Length: {len(response.text)} bytes")

        # HTML 파싱
        soup = BeautifulSoup(response.text, 'html.parser')

        # 업종 테이블 찾기
        table = soup.find('table', {'class': 'type_1'})

        if not table:
            print("❌ Table not found!")
            print("\n=== Available tables ===")
            for t in soup.find_all('table'):
                print(f"  - {t.get('class', 'no-class')}")
            return []

        print(f"✅ Table found!")

        # HTML 구조 확인
        print(f"   Table structure: {table.name}")
        tbody = table.find('tbody')
        print(f"   Has tbody: {tbody is not None}")

        sectors = []
        # tbody가 없으면 직접 tr 찾기
        if tbody:
            rows = tbody.find_all('tr')
        else:
            rows = table.find_all('tr')

        print(f"📋 Found {len(rows)} rows")

        for idx, row in enumerate(rows, 1):
            cols = row.find_all('td')

            if len(cols) < 4:
                continue

            # 업종명 (링크에서 추출)
            name_tag = cols[0].find('a')
            if not name_tag:
                continue

            name = name_tag.text.strip()

            # 등락률 (cols[1]에 있음)
            change_tag = cols[1]
            change_text = change_tag.text.strip()

            # 숫자만 추출 ('+7.88%' -> 7.88)
            try:
                change_pct = float(change_text.replace('%', '').replace('+', '').replace(',', ''))
            except:
                change_pct = 0.0

            # 상승/보합/하락 종목 수 (cols[2] 이후)
            count_text = ' '.join([c.text.strip() for c in cols[2:5]]) if len(cols) >= 5 else ''

            sector_data = {
                'rank': idx,
                'name': name,
                'change_pct': change_pct,
                'stocks_count': count_text,
                'crawled_at': datetime.now().isoformat()
            }

            sectors.append(sector_data)

            # 상위 10개만 출력
            if idx <= 10:
                print(f"   {idx:2d}. {name:25s} {change_pct:+6.2f}% ({count_text})")

        print(f"\n✅ Total {len(sectors)} sectors crawled")

        return sectors

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return []


if __name__ == "__main__":
    print("="*60)
    print("네이버 증권 업종 크롤링 테스트")
    print("="*60)

    sectors = crawl_naver_sectors()

    if sectors:
        # 결과 저장
        output_file = f"naver_sectors_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sectors, f, indent=2, ensure_ascii=False)

        print(f"\n📁 Saved to: {output_file}")

        # 상위/하위 5개 요약
        print("\n" + "="*60)
        print("상승률 TOP 5")
        print("="*60)
        for s in sectors[:5]:
            print(f"  {s['rank']:2d}. {s['name']:25s} {s['change_pct']:+6.2f}%")

        print("\n" + "="*60)
        print("하락률 TOP 5")
        print("="*60)
        for s in sorted(sectors, key=lambda x: x['change_pct'])[:5]:
            print(f"  {s['rank']:2d}. {s['name']:25s} {s['change_pct']:+6.2f}%")
    else:
        print("\n❌ Crawling failed!")
