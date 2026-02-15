"""
네이버 증권 업종/테마 크롤링
"""
import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import time

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

            # 등락률
            change_text = cols[2].text.strip()
            try:
                change_pct = float(change_text.replace('%', '').replace(',', ''))
            except:
                continue

            # 거래대금
            volume_text = cols[3].text.strip()

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

            # 등락률
            change_text = cols[2].text.strip()
            try:
                change_pct = float(change_text.replace('%', '').replace(',', ''))
            except:
                continue

            # 거래대금
            volume_text = cols[3].text.strip()

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
    """상승/하락 Top 10 추출"""
    print("🔍 네이버 증권 크롤링 시작...")

    # 1. 업종 크롤링
    industries = scrape_industries()
    time.sleep(1)  # 서버 부하 방지

    # 2. 테마 크롤링
    themes = scrape_themes()

    # 3. 전체 섹터 합치기
    all_sectors = industries + themes

    # 4. 정렬
    all_sectors_sorted = sorted(all_sectors, key=lambda x: x['change_pct'], reverse=True)

    # 5. Top 10 상승/하락
    top_up = all_sectors_sorted[:10]
    top_down = all_sectors_sorted[-10:]

    print(f"✅ 크롤링 완료: 업종 {len(industries)}개, 테마 {len(themes)}개")

    return {
        'date': time.strftime('%Y-%m-%d'),
        'total_sectors': len(all_sectors),
        'top_up': top_up,
        'top_down': top_down,
        'industries_count': len(industries),
        'themes_count': len(themes)
    }


if __name__ == "__main__":
    result = get_sector_extremes()
    print("\n📈 상승 Top 10:")
    for i, sector in enumerate(result['top_up'], 1):
        print(f"{i}. {sector['name']}: +{sector['change_pct']}%")

    print("\n📉 하락 Top 10:")
    for i, sector in enumerate(result['top_down'], 1):
        print(f"{i}. {sector['name']}: {sector['change_pct']}%")
