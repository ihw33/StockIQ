#!/usr/bin/env python3
"""
업종/테마 정보를 종목 마스터에 매핑
- stock_master.json + stock_classifications.json → stock_master.json (업데이트)
"""
import json
from datetime import datetime

def merge_classifications():
    """업종/테마를 종목 마스터에 매핑"""
    print("=" * 70)
    print("업종/테마 매핑 작업")
    print("=" * 70)
    print()

    # 1. 종목 마스터 로드
    print("📂 stock_master.json 로드 중...")
    with open('data/stock_master.json', 'r', encoding='utf-8') as f:
        master = json.load(f)

    stocks = master['stocks']

    # groups 필드가 없는 종목에 추가
    for stock in stocks.values():
        if 'groups' not in stock:
            stock['groups'] = []

    print(f"✅ {len(stocks)}개 종목 로드 완료")

    # 2. 분류 데이터 로드
    print("📂 stock_classifications.json 로드 중...")
    with open('data/stock_classifications.json', 'r', encoding='utf-8') as f:
        classifications = json.load(f)

    industries = classifications.get('industries', {})
    themes = classifications.get('themes', {})
    groups = classifications.get('groups', {})
    print(f"✅ {len(industries)}개 업종, {len(themes)}개 테마, {len(groups)}개 그룹 로드 완료")
    print()

    # 3. 업종 매핑
    print("🔗 업종 매핑 중...")
    industry_mapped = 0
    for industry_name, industry_data in industries.items():
        codes = industry_data.get('codes', [])
        for code in codes:
            if code in stocks:
                stocks[code]['industries'].append(industry_name)
                industry_mapped += 1

    print(f"✅ {industry_mapped}건 매핑 완료")

    # 4. 테마 매핑
    print("🔗 테마 매핑 중...")
    theme_mapped = 0
    for theme_name, theme_data in themes.items():
        codes = theme_data.get('codes', [])
        for code in codes:
            if code in stocks:
                stocks[code]['themes'].append(theme_name)
                theme_mapped += 1

    print(f"✅ {theme_mapped}건 매핑 완료")

    # 5. 그룹 매핑
    print("🔗 그룹 매핑 중...")
    group_mapped = 0
    for group_name, group_data in groups.items():
        codes = group_data.get('codes', [])
        for code in codes:
            if code in stocks:
                stocks[code]['groups'].append(group_name)
                group_mapped += 1

    print(f"✅ {group_mapped}건 매핑 완료")
    print()

    # 6. 통계
    print("=" * 70)
    print("📊 매핑 통계")
    print("=" * 70)

    # 업종/테마/그룹이 있는 종목 수
    stocks_with_industry = sum(1 for s in stocks.values() if s['industries'])
    stocks_with_theme = sum(1 for s in stocks.values() if s['themes'])
    stocks_with_group = sum(1 for s in stocks.values() if s['groups'])
    stocks_with_all = sum(1 for s in stocks.values() if s['industries'] and s['themes'] and s['groups'])
    stocks_with_none = sum(1 for s in stocks.values() if not s['industries'] and not s['themes'] and not s['groups'])

    print(f"  총 종목: {len(stocks)}개")
    print(f"  업종 매핑: {stocks_with_industry}개")
    print(f"  테마 매핑: {stocks_with_theme}개")
    print(f"  그룹 매핑: {stocks_with_group}개")
    print(f"  업종+테마+그룹 모두: {stocks_with_all}개")
    print(f"  매핑 없음: {stocks_with_none}개")
    print()

    # 가장 많은 테마를 가진 종목 TOP 5
    print("📈 테마가 가장 많은 종목 TOP 5:")
    sorted_stocks = sorted(
        stocks.items(),
        key=lambda x: len(x[1]['themes']),
        reverse=True
    )
    for i, (code, data) in enumerate(sorted_stocks[:5], 1):
        print(f"  {i}. {data['name']:20s} ({code}) - {len(data['themes'])}개 테마")
    print()

    # 7. 메타데이터 업데이트
    master['metadata'].update({
        'total_industries': len(industries),
        'total_themes': len(themes),
        'total_groups': len(groups),
        'industry_mappings': industry_mapped,
        'theme_mappings': theme_mapped,
        'group_mappings': group_mapped,
        'stocks_with_industry': stocks_with_industry,
        'stocks_with_theme': stocks_with_theme,
        'stocks_with_group': stocks_with_group,
        'merged_at': datetime.now().isoformat()
    })

    # 7. 저장
    output_file = 'data/stock_master.json'
    print("=" * 70)
    print("💾 저장 중...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(master, f, indent=2, ensure_ascii=False)

    print(f"✅ 저장 완료: {output_file}")
    print("=" * 70)


if __name__ == "__main__":
    merge_classifications()
