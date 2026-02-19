#!/usr/bin/env python3
"""
네이버 증권 79개 업종 전체 크롤링
- 업종별 종목 코드 리스트 수집
- stock_classifications.json 생성
"""
import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
from typing import Dict, List

def get_all_sectors() -> List[Dict]:
    """79개 업종 리스트 + 업종 번호 가져오기"""
    url = "https://finance.naver.com/sise/sise_group.naver?type=upjong"
    headers = {'User-Agent': 'Mozilla/5.0'}

    print("📋 1단계: 업종 리스트 수집 중...")

    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')

    table = soup.find('table', {'class': 'type_1'})
    if not table:
        print("❌ 업종 테이블을 찾을 수 없습니다")
        return []

    sectors = []
    rows = table.find_all('tr')

    for row in rows:
        cols = row.find_all('td')
        if len(cols) < 2:
            continue

        # 업종명 + 링크
        name_tag = cols[0].find('a')
        if not name_tag:
            continue

        name = name_tag.text.strip()
        href = name_tag.get('href', '')

        # 업종 번호 추출
        if 'no=' not in href:
            continue

        sector_no = href.split('no=')[1].split('&')[0]

        # 등락률
        try:
            change_pct = float(cols[1].text.strip().replace('%', '').replace('+', ''))
        except:
            change_pct = 0.0

        sectors.append({
            'name': name,
            'no': sector_no,
            'change_pct': change_pct
        })

    print(f"✅ {len(sectors)}개 업종 발견")
    return sectors


def get_sector_stocks(sector_no: str, sector_name: str) -> List[str]:
    """특정 업종의 종목 코드 리스트 가져오기"""
    url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=upjong&no={sector_no}"
    headers = {'User-Agent': 'Mozilla/5.0'}

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'euc-kr'

        soup = BeautifulSoup(response.text, 'html.parser')

        # 종목 테이블 찾기
        table = soup.find('table', {'class': 'type_5'})
        if not table:
            return []

        stock_codes = []
        rows = table.find_all('tr')

        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 2:
                continue

            # 종목명 링크에서 코드 추출
            name_tag = cols[0].find('a')
            if not name_tag:
                continue

            href = name_tag.get('href', '')
            if 'code=' not in href:
                continue

            code = href.split('code=')[1].split('&')[0]
            stock_codes.append(code)

        return stock_codes

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return []


def main():
    print("="*70)
    print("네이버 증권 업종별 종목 전체 크롤링")
    print("="*70)
    print()

    # 1단계: 업종 리스트 가져오기
    sectors = get_all_sectors()

    if not sectors:
        print("❌ 업종 리스트를 가져올 수 없습니다")
        return

    print()
    print("="*70)
    print(f"📋 2단계: {len(sectors)}개 업종의 종목 수집 중...")
    print("="*70)
    print()

    # 결과 저장용
    result = {
        'industries': {},
        'metadata': {
            'total_sectors': len(sectors),
            'crawled_at': datetime.now().isoformat(),
            'source': 'finance.naver.com'
        }
    }

    # 2단계: 각 업종의 종목 수집
    for i, sector in enumerate(sectors, 1):
        name = sector['name']
        no = sector['no']
        change_pct = sector['change_pct']

        print(f"[{i:2d}/{len(sectors)}] {name:30s} (no={no})", end=" ... ", flush=True)

        # 종목 코드 가져오기
        stock_codes = get_sector_stocks(no, name)

        if stock_codes:
            print(f"✅ {len(stock_codes):3d}개 종목")

            result['industries'][name] = {
                'no': no,
                'change_pct': change_pct,
                'total': len(stock_codes),
                'codes': stock_codes,
                'updated': datetime.now().strftime('%Y-%m-%d')
            }
        else:
            print("❌ 실패")

        # Rate limit 방지 (0.5초 대기)
        time.sleep(0.5)

    # 3단계: 결과 저장
    print()
    print("="*70)
    print("📁 3단계: 결과 저장 중...")
    print("="*70)

    output_file = 'data/stock_classifications.json'

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"✅ 저장 완료: {output_file}")

    # 통계 출력
    total_stocks = sum(data['total'] for data in result['industries'].values())

    print()
    print("="*70)
    print("📊 크롤링 완료!")
    print("="*70)
    print(f"  총 업종 수: {len(result['industries'])}개")
    print(f"  총 종목 수: {total_stocks}개")
    print(f"  평균 종목/업종: {total_stocks // len(result['industries'])}개")
    print()

    # 상위 10개 업종 (종목 수 기준)
    print("📈 종목 수 TOP 10:")
    sorted_sectors = sorted(
        result['industries'].items(),
        key=lambda x: x[1]['total'],
        reverse=True
    )
    for i, (name, data) in enumerate(sorted_sectors[:10], 1):
        print(f"  {i:2d}. {name:30s} {data['total']:3d}개")

    print()
    print("="*70)


if __name__ == "__main__":
    main()
