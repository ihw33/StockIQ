#!/usr/bin/env python3
"""
네이버 증권 테마 전체 크롤링
- 테마별 종목 코드 리스트 수집
- stock_classifications.json에 추가
"""
import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
from typing import Dict, List

def get_all_themes() -> List[Dict]:
    """전체 테마 리스트 가져오기 (페이지네이션 처리)"""
    themes = []
    seen_nos = set()  # 중복 체크용
    page = 1
    headers = {'User-Agent': 'Mozilla/5.0'}

    print("📋 1단계: 테마 리스트 수집 중...")

    while True:
        url = f"https://finance.naver.com/sise/theme.naver?&page={page}"

        try:
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')

            table = soup.find('table', {'class': 'type_1'})
            if not table:
                break

            rows = table.find_all('tr')
            found_in_page = 0
            duplicates_in_page = 0

            for row in rows:
                cols = row.find_all('td')
                if len(cols) < 2:
                    continue

                # 테마명 + 링크
                name_tag = cols[0].find('a')
                if not name_tag:
                    continue

                name = name_tag.text.strip()
                href = name_tag.get('href', '')

                # 테마 번호 추출
                if 'no=' not in href:
                    continue

                theme_no = href.split('no=')[1].split('&')[0]

                # 중복 체크
                if theme_no in seen_nos:
                    duplicates_in_page += 1
                    continue

                seen_nos.add(theme_no)

                # 등락률
                try:
                    change_pct = float(cols[1].text.strip().replace('%', '').replace('+', ''))
                except:
                    change_pct = 0.0

                themes.append({
                    'name': name,
                    'no': theme_no,
                    'change_pct': change_pct
                })
                found_in_page += 1

            # 모든 데이터가 중복이면 종료
            if found_in_page == 0 or duplicates_in_page > found_in_page:
                print(f"   Page {page}: 중복 감지 ({duplicates_in_page}개), 크롤링 종료")
                break

            print(f"   Page {page}: {found_in_page}개 테마 발견")
            page += 1
            time.sleep(0.3)  # Rate limit

        except Exception as e:
            print(f"   ❌ Page {page} Error: {e}")
            break

    print(f"✅ 총 {len(themes)}개 테마 발견")
    return themes


def get_theme_stocks(theme_no: str, theme_name: str) -> List[str]:
    """특정 테마의 종목 코드 리스트 가져오기"""
    url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no={theme_no}"
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
    print("네이버 증권 테마별 종목 전체 크롤링")
    print("="*70)
    print()

    # 1단계: 테마 리스트 가져오기
    themes = get_all_themes()

    if not themes:
        print("❌ 테마 리스트를 가져올 수 없습니다")
        return

    print()
    print("="*70)
    print(f"📋 2단계: {len(themes)}개 테마의 종목 수집 중...")
    print("="*70)
    print()

    # 기존 데이터 로드 (업종 데이터)
    try:
        with open('data/stock_classifications.json', 'r', encoding='utf-8') as f:
            result = json.load(f)
    except:
        result = {
            'industries': {},
            'themes': {},
            'metadata': {}
        }

    # themes 키가 없으면 추가
    if 'themes' not in result:
        result['themes'] = {}

    # 2단계: 각 테마의 종목 수집
    for i, theme in enumerate(themes, 1):
        name = theme['name']
        no = theme['no']
        change_pct = theme['change_pct']

        print(f"[{i:3d}/{len(themes)}] {name:30s} (no={no})", end=" ... ", flush=True)

        # 종목 코드 가져오기
        stock_codes = get_theme_stocks(no, name)

        if stock_codes:
            print(f"✅ {len(stock_codes):3d}개 종목")

            result['themes'][name] = {
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

    # 3단계: 메타데이터 업데이트
    result['metadata'] = {
        'total_sectors': len(result.get('industries', {})),
        'total_themes': len(result['themes']),
        'crawled_at': datetime.now().isoformat(),
        'source': 'finance.naver.com'
    }

    # 4단계: 결과 저장
    print()
    print("="*70)
    print("📁 3단계: 결과 저장 중...")
    print("="*70)

    output_file = 'data/stock_classifications.json'

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"✅ 저장 완료: {output_file}")

    # 통계 출력
    total_stocks = sum(data['total'] for data in result['themes'].values())

    print()
    print("="*70)
    print("📊 크롤링 완료!")
    print("="*70)
    print(f"  총 테마 수: {len(result['themes'])}개")
    print(f"  총 종목 수: {total_stocks}개")
    print(f"  평균 종목/테마: {total_stocks // len(result['themes']) if result['themes'] else 0}개")
    print()

    # 상위 10개 테마 (종목 수 기준)
    print("📈 종목 수 TOP 10:")
    sorted_themes = sorted(
        result['themes'].items(),
        key=lambda x: x[1]['total'],
        reverse=True
    )
    for i, (name, data) in enumerate(sorted_themes[:10], 1):
        print(f"  {i:2d}. {name:30s} {data['total']:3d}개")

    print()
    print("="*70)
    print("📊 전체 통계:")
    print("="*70)
    print(f"  업종: {len(result.get('industries', {}))}개")
    print(f"  테마: {len(result['themes'])}개")
    print()


if __name__ == "__main__":
    main()
