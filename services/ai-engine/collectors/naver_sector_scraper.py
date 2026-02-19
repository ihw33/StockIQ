"""
네이버 증권 업종/테마 크롤링
"""
import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import time
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from utils.market_calendar import get_last_trading_day

def scrape_industries() -> List[Dict]:
    """업종별 시세 크롤링"""
    url = "https://finance.naver.com/sise/sise_group.naver?type=upjong"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers)
        response.encoding = 'euc-kr'
        soup = BeautifulSoup(response.text, 'html.parser')

        industries = []
        table = soup.select_one('table.type_1')

        if not table:
            return []

        rows = table.select('tr')[2:]  # 헤더 제외

        for row in rows:
            cols = row.select('td')
            if len(cols) < 4:
                continue

            # 업종명
            name_tag = cols[0].select_one('a')
            if not name_tag:
                continue

            name = name_tag.text.strip()

            if name == '기타':
                continue

            # 등락률 (col[1])
            change_text = cols[1].text.strip()
            try:
                change_pct = float(change_text.replace('%', '').replace(',', '').replace('+', ''))
            except:
                continue

            # 거래대금
            volume_text = cols[3].text.strip() if len(cols) > 3 else ''

            industries.append({
                'name': name,
                'change_pct': change_pct,
                'volume': volume_text,
                'type': 'industry'
            })

        return industries

    except Exception as e:
        print(f"Industry scraping error: {e}")
        return []


def scrape_themes() -> List[Dict]:
    """테마별 시세 크롤링"""
    url = "https://finance.naver.com/sise/theme.naver"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers)
        response.encoding = 'euc-kr'
        soup = BeautifulSoup(response.text, 'html.parser')

        themes = []
        table = soup.select_one('table.type_1')

        if not table:
            return []

        rows = table.select('tr')[2:]  # 헤더 제외

        for row in rows:
            cols = row.select('td')
            if len(cols) < 4:
                continue

            # 테마명
            name_tag = cols[0].select_one('a')
            if not name_tag:
                continue

            name = name_tag.text.strip()

            # 등락률 (col[1])
            change_text = cols[1].text.strip()
            try:
                change_pct = float(change_text.replace('%', '').replace(',', '').replace('+', ''))
            except:
                continue

            # 거래대금
            volume_text = cols[3].text.strip() if len(cols) > 3 else ''

            themes.append({
                'name': name,
                'change_pct': change_pct,
                'volume': volume_text,
                'type': 'theme'
            })

        return themes

    except Exception as e:
        print(f"Theme scraping error: {e}")
        return []


def get_sector_extremes() -> Dict:
    """상승/하락 Top 10 추출 (업종/테마 분리)"""
    print("🔍 네이버 증권 크롤링 시작...")

    # 1. 업종 크롤링
    industries = scrape_industries()
    time.sleep(1)  # 서버 부하 방지

    # 2. 테마 크롤링
    themes = scrape_themes()

    # 3. 업종별 정렬
    industries_sorted = sorted(industries, key=lambda x: x['change_pct'], reverse=True)
    industry_top_up = industries_sorted[:10]
    industry_top_down = industries_sorted[-10:]

    # 4. 테마별 정렬
    themes_sorted = sorted(themes, key=lambda x: x['change_pct'], reverse=True)
    theme_top_up = themes_sorted[:10]
    theme_top_down = themes_sorted[-10:]

    print(f"✅ 크롤링 완료: 업종 {len(industries)}개, 테마 {len(themes)}개")

    return {
        'market_date': get_last_trading_day().strftime('%Y-%m-%d'),  # 마지막 거래일
        'fetched_at': time.strftime('%Y-%m-%d %H:%M:%S'),  # 실제 가져온 시간
        'total_sectors': len(industries) + len(themes),
        'industries': {
            'count': len(industries),
            'top_up': industry_top_up,
            'top_down': industry_top_down
        },
        'themes': {
            'count': len(themes),
            'top_up': theme_top_up,
            'top_down': theme_top_down
        }
    }


if __name__ == "__main__":
    result = get_sector_extremes()
    print("\n📈 상승 Top 10:")
    for i, sector in enumerate(result['top_up'], 1):
        print(f"{i}. {sector['name']}: +{sector['change_pct']}%")

    print("\n📉 하락 Top 10:")
    for i, sector in enumerate(result['top_down'], 1):
        print(f"{i}. {sector['name']}: {sector['change_pct']}%")
