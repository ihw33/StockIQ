"""
네이버 증권 상승/하락 종목 크롤러
"""
import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import time
import re


def scrape_rising_stocks(limit: int = 50) -> List[Dict]:
    """
    상승 종목 크롤링
    https://finance.naver.com/sise/sise_rise.naver
    """
    url = "https://finance.naver.com/sise/sise_rise.naver"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    response = requests.get(url, headers=headers)
    response.encoding = 'euc-kr'
    soup = BeautifulSoup(response.text, 'html.parser')

    stocks = []
    table = soup.select_one('table.type_2')

    if not table:
        return stocks

    rows = table.select('tr')

    for row in rows:
        cols = row.select('td')
        if len(cols) < 10:
            continue

        # 종목명 링크가 있는지 확인 (실제 종목 데이터)
        name_elem = cols[1].select_one('a') if len(cols) > 1 else None
        if not name_elem or 'code=' not in str(name_elem.get('href', '')):
            continue

        try:
            # 순위
            # 순위
            rank_text = cols[0].text.strip()
            rank = int(rank_text) if rank_text.isdigit() else len(stocks) + 1

            # 종목명, 종목코드 (이미 위에서 확인했음)
            stock_name = name_elem.text.strip()
            stock_code = name_elem['href'].split('code=')[1][:6]

            # 현재가
            price_text = cols[2].text.strip().replace(',', '')
            current_price = int(price_text) if price_text else 0

            # 전일대비
            change_elem = cols[3]
            change_text = change_elem.text.strip().replace(',', '').replace('\n', '').replace('\t', '')
            # 부호 확인 (상승/하락 이미지로 판단)
            change_img = change_elem.select_one('img')
            change_sign = 1
            if change_img and 'down' in change_img.get('src', ''):
                change_sign = -1
            # 숫자만 추출
            numbers = re.findall(r'\d+', change_text)
            change_amount = int(numbers[0]) if numbers else 0
            change_amount *= change_sign

            # 등락률
            change_pct_text = cols[4].text.strip().replace('%', '').replace(',', '')
            change_pct = float(change_pct_text) if change_pct_text else 0.0
            if change_sign == -1:
                change_pct = -change_pct

            # 거래량
            volume_text = cols[6].text.strip().replace(',', '')
            volume = int(volume_text) if volume_text else 0

            stocks.append({
                'rank': rank,
                'stock_code': stock_code,
                'stock_name': stock_name,
                'current_price': current_price,
                'change_amount': change_amount,
                'change_pct': change_pct,
                'volume': volume
            })

            if len(stocks) >= limit:
                break

        except Exception as e:
            print(f"행 파싱 오류: {e}")
            continue

    return stocks


def scrape_falling_stocks(limit: int = 50) -> List[Dict]:
    """
    하락 종목 크롤링
    https://finance.naver.com/sise/sise_fall.naver
    """
    url = "https://finance.naver.com/sise/sise_fall.naver"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    response = requests.get(url, headers=headers)
    response.encoding = 'euc-kr'
    soup = BeautifulSoup(response.text, 'html.parser')

    stocks = []
    table = soup.select_one('table.type_2')

    if not table:
        return stocks

    rows = table.select('tr')

    for row in rows:
        cols = row.select('td')
        if len(cols) < 10:
            continue

        # 종목명 링크가 있는지 확인 (실제 종목 데이터)
        name_elem = cols[1].select_one('a') if len(cols) > 1 else None
        if not name_elem or 'code=' not in str(name_elem.get('href', '')):
            continue

        try:
            # 순위
            rank_text = cols[0].text.strip()
            rank = int(rank_text) if rank_text.isdigit() else len(stocks) + 1

            # 종목명, 종목코드 (이미 위에서 확인했음)
            stock_name = name_elem.text.strip()
            stock_code = name_elem['href'].split('code=')[1][:6]

            price_text = cols[2].text.strip().replace(',', '')
            current_price = int(price_text) if price_text else 0

            change_elem = cols[3]
            change_text = change_elem.text.strip().replace(',', '').replace('\n', '').replace('\t', '')
            change_img = change_elem.select_one('img')
            change_sign = -1  # 하락이 기본
            if change_img and 'up' in change_img.get('src', ''):
                change_sign = 1
            # 숫자만 추출
            numbers = re.findall(r'\d+', change_text)
            change_amount = int(numbers[0]) if numbers else 0
            change_amount *= change_sign

            change_pct_text = cols[4].text.strip().replace('%', '').replace(',', '')
            change_pct = float(change_pct_text) if change_pct_text else 0.0
            if change_sign == -1:
                change_pct = -change_pct

            volume_text = cols[6].text.strip().replace(',', '')
            volume = int(volume_text) if volume_text else 0

            stocks.append({
                'rank': rank,
                'stock_code': stock_code,
                'stock_name': stock_name,
                'current_price': current_price,
                'change_amount': change_amount,
                'change_pct': change_pct,
                'volume': volume
            })

            if len(stocks) >= limit:
                break

        except Exception as e:
            print(f"행 파싱 오류: {e}")
            continue

    return stocks


def get_stocks_extremes(limit: int = 50) -> Dict:
    """
    상승/하락 종목 Top N 가져오기
    """
    rising = scrape_rising_stocks(limit)
    time.sleep(1)  # 크롤링 간격
    falling = scrape_falling_stocks(limit)

    return {
        'market_date': time.strftime('%Y-%m-%d'),
        'fetched_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'rising': {
            'count': len(rising),
            'stocks': rising
        },
        'falling': {
            'count': len(falling),
            'stocks': falling
        },
        'total_stocks': len(rising) + len(falling)
    }


if __name__ == '__main__':
    # 테스트
    result = get_stocks_extremes(limit=10)
    print(f"📊 가져온 시간: {result['fetched_at']}")
    print(f"📈 상승: {result['rising']['count']}개")
    print(f"📉 하락: {result['falling']['count']}개")

    print("\n🔴 상승 Top 10:")
    for stock in result['rising']['stocks'][:10]:
        print(f"  {stock['rank']}. {stock['stock_name']} ({stock['stock_code']}) "
              f"+{stock['change_pct']:.2f}% / {stock['current_price']:,}원")

    print("\n🔵 하락 Top 10:")
    for stock in result['falling']['stocks'][:10]:
        print(f"  {stock['rank']}. {stock['stock_name']} ({stock['stock_code']}) "
              f"{stock['change_pct']:.2f}% / {stock['current_price']:,}원")
