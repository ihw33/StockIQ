#!/usr/bin/env python3
"""
네이버 증권 업종별 종목 리스트 크롤링 테스트
예: https://finance.naver.com/sise/sise_group_detail.naver?type=upjong&no=38 (증권)
"""
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
import time

def get_sector_number(sector_name):
    """업종명으로 업종 번호 찾기"""
    # 실제 네이버 증권 업종 번호
    sector_map = {
        '증권': '321',
        '반도체와반도체장비': '278',
        '자동차': '52',
    }
    return sector_map.get(sector_name)


def crawl_sector_stocks(sector_no, sector_name='테스트'):
    """특정 업종의 종목 리스트 크롤링"""
    url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=upjong&no={sector_no}"

    print(f"🔍 Crawling: {url}")
    print(f"   업종: {sector_name} (no={sector_no})")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        response.encoding = 'euc-kr'  # 네이버는 EUC-KR 사용

        print(f"✅ Response: {response.status_code}")

        soup = BeautifulSoup(response.text, 'html.parser')

        # 종목 테이블 찾기
        table = soup.find('table', {'class': 'type_5'})

        if not table:
            print("❌ Table not found!")
            # 다른 class 시도
            table = soup.find('table', {'class': 'type_1'})
            if table:
                print("✅ Found table with class 'type_1'")

        if not table:
            print("❌ No table found at all")
            return []

        stocks = []
        rows = table.find_all('tr')

        print(f"📋 Found {len(rows)} rows")

        for idx, row in enumerate(rows):
            cols = row.find_all('td')

            if len(cols) < 4:
                continue

            # 종목명 (링크에서 추출)
            name_tag = cols[0].find('a')
            if not name_tag:
                continue

            name = name_tag.text.strip()

            # 종목 코드 (링크에서 추출)
            href = name_tag.get('href', '')
            code = ''
            if 'code=' in href:
                code = href.split('code=')[1].split('&')[0]

            # 현재가 (cols[1])
            try:
                price_text = cols[1].text.strip().replace(',', '')
                price = int(price_text) if price_text else 0
            except:
                price = 0

            # 등락률 (cols[3], 마지막 컬럼)
            try:
                # cols[3]에 '+29.96%' 형태로 있음
                change_text = cols[3].text.strip() if len(cols) > 3 else ''
                # '%' 제거하고 숫자만 추출
                change_text = change_text.replace('%', '').replace('+', '').strip()
                change_pct = float(change_text) if change_text else 0.0
            except:
                change_pct = 0.0

            stock_data = {
                'code': code,
                'name': name,
                'price': price,
                'change_pct': change_pct,
            }

            stocks.append(stock_data)

        print(f"✅ Total {len(stocks)} stocks found")

        # 상위 10개 출력
        print("\n📋 Sample (first 10):")
        for i, s in enumerate(stocks[:10], 1):
            print(f"   {i:2d}. [{s['code']}] {s['name']:20s} {s['price']:8,}원 {s['change_pct']:+6.2f}%")

        return stocks

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return []


if __name__ == "__main__":
    print("="*60)
    print("네이버 증권 업종별 종목 크롤링 테스트")
    print("="*60)

    # 증권 업종 테스트 (no=38)
    test_sector = '증권'
    sector_no = get_sector_number(test_sector)

    if not sector_no:
        print(f"❌ Unknown sector: {test_sector}")
        exit(1)

    stocks = crawl_sector_stocks(sector_no, test_sector)

    if stocks:
        # 결과 저장
        output_file = f"naver_sector_{test_sector}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'sector_name': test_sector,
                'sector_no': sector_no,
                'total_stocks': len(stocks),
                'stocks': stocks,
                'crawled_at': datetime.now().isoformat()
            }, f, indent=2, ensure_ascii=False)

        print(f"\n📁 Saved to: {output_file}")
        print(f"\n✅ Successfully crawled {len(stocks)} stocks from '{test_sector}' sector")
    else:
        print("\n❌ Crawling failed!")
