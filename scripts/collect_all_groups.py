#!/usr/bin/env python3
"""
네이버 증권 그룹사 전체 크롤링
- 그룹별 종목 코드 리스트 수집
- stock_classifications.json에 추가
"""
import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
from typing import Dict, List

def get_all_groups() -> List[Dict]:
    """전체 그룹 리스트 가져오기"""
    url = "https://finance.naver.com/sise/sise_group.naver?type=group"
    headers = {'User-Agent': 'Mozilla/5.0'}

    print("📋 1단계: 그룹 리스트 수집 중...")

    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')

    table = soup.find('table', {'class': 'type_1'})
    if not table:
        print("❌ 그룹 테이블을 찾을 수 없습니다")
        return []

    groups = []
    rows = table.find_all('tr')

    for row in rows:
        cols = row.find_all('td')
        if len(cols) < 2:
            continue

        # 그룹명 + 링크
        name_tag = cols[0].find('a')
        if not name_tag:
            continue

        name = name_tag.text.strip()
        href = name_tag.get('href', '')

        # 그룹 번호 추출
        if 'no=' not in href:
            continue

        group_no = href.split('no=')[1].split('&')[0]

        # 등락률
        try:
            change_pct = float(cols[1].text.strip().replace('%', '').replace('+', ''))
        except:
            change_pct = 0.0

        groups.append({
            'name': name,
            'no': group_no,
            'change_pct': change_pct
        })

    print(f"✅ {len(groups)}개 그룹 발견")
    return groups


def get_group_stocks(group_no: str, group_name: str) -> List[str]:
    """특정 그룹의 종목 코드 리스트 가져오기"""
    url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=group&no={group_no}"
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
    print("=" * 70)
    print("네이버 증권 그룹별 종목 전체 크롤링")
    print("=" * 70)
    print()

    # 1단계: 그룹 리스트 가져오기
    groups = get_all_groups()

    if not groups:
        print("❌ 그룹 리스트를 가져올 수 없습니다")
        return

    print()
    print("=" * 70)
    print(f"📋 2단계: {len(groups)}개 그룹의 종목 수집 중...")
    print("=" * 70)
    print()

    # 기존 데이터 로드 (업종/테마 데이터)
    try:
        with open('data/stock_classifications.json', 'r', encoding='utf-8') as f:
            result = json.load(f)
    except:
        result = {
            'industries': {},
            'themes': {},
            'groups': {},
            'metadata': {}
        }

    # groups 키가 없으면 추가
    if 'groups' not in result:
        result['groups'] = {}

    # 2단계: 각 그룹의 종목 수집
    for i, group in enumerate(groups, 1):
        name = group['name']
        no = group['no']
        change_pct = group['change_pct']

        print(f"[{i:3d}/{len(groups)}] {name:30s} (no={no})", end=" ... ", flush=True)

        # 종목 코드 가져오기
        stock_codes = get_group_stocks(no, name)

        if stock_codes:
            print(f"✅ {len(stock_codes):3d}개 종목")

            result['groups'][name] = {
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
        'total_themes': len(result.get('themes', {})),
        'total_groups': len(result['groups']),
        'crawled_at': datetime.now().isoformat(),
        'source': 'finance.naver.com'
    }

    # 4단계: 결과 저장
    print()
    print("=" * 70)
    print("📁 3단계: 결과 저장 중...")
    print("=" * 70)

    output_file = 'data/stock_classifications.json'

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"✅ 저장 완료: {output_file}")

    # 통계 출력
    total_stocks = sum(data['total'] for data in result['groups'].values())

    print()
    print("=" * 70)
    print("📊 크롤링 완료!")
    print("=" * 70)
    print(f"  총 그룹 수: {len(result['groups'])}개")
    print(f"  총 종목 수: {total_stocks}개")
    print(f"  평균 종목/그룹: {total_stocks // len(result['groups']) if result['groups'] else 0}개")
    print()

    # 상위 10개 그룹 (종목 수 기준)
    print("📈 종목 수 TOP 10:")
    sorted_groups = sorted(
        result['groups'].items(),
        key=lambda x: x[1]['total'],
        reverse=True
    )
    for i, (name, data) in enumerate(sorted_groups[:10], 1):
        print(f"  {i:2d}. {name:30s} {data['total']:3d}개")

    print()
    print("=" * 70)
    print("📊 전체 통계:")
    print("=" * 70)
    print(f"  업종: {len(result.get('industries', {}))}개")
    print(f"  테마: {len(result.get('themes', {}))}개")
    print(f"  그룹: {len(result['groups'])}개")
    print()


if __name__ == "__main__":
    main()
