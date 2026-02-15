#!/usr/bin/env python3
"""
코스피/코스닥 전체 종목 리스트 가져오기
- FinanceDataReader 사용
- stock_master.json 생성 (종목 기본 정보)
"""
import FinanceDataReader as fdr
import json
from datetime import datetime

def fetch_all_stocks():
    """코스피 + 코스닥 전체 종목 가져오기"""
    print("=" * 70)
    print("코스피/코스닥 전체 종목 리스트 수집")
    print("=" * 70)
    print()

    # 코스피
    print("📋 코스피 종목 수집 중...")
    kospi = fdr.StockListing('KOSPI')
    print(f"✅ 코스피: {len(kospi)}개 종목")

    # 코스닥
    print("📋 코스닥 종목 수집 중...")
    kosdaq = fdr.StockListing('KOSDAQ')
    print(f"✅ 코스닥: {len(kosdaq)}개 종목")

    print()
    print(f"총 {len(kospi) + len(kosdaq)}개 종목")
    print()

    # 종목 딕셔너리 생성
    stocks = {}

    # 코스피 추가
    for idx, row in kospi.iterrows():
        code = row['Code']
        stocks[code] = {
            'name': row['Name'],
            'market': 'KOSPI',
            'sector': row.get('Sector', ''),
            'industry': row.get('Industry', ''),
            'listing_date': row.get('ListingDate', '').strftime('%Y-%m-%d') if pd.notna(row.get('ListingDate')) else '',
            'industries': [],  # 네이버 업종 (추후 매핑)
            'themes': [],      # 네이버 테마 (추후 매핑)
            'groups': []       # 네이버 그룹 (추후 매핑)
        }

    # 코스닥 추가
    for idx, row in kosdaq.iterrows():
        code = row['Code']
        stocks[code] = {
            'name': row['Name'],
            'market': 'KOSDAQ',
            'sector': row.get('Sector', ''),
            'industry': row.get('Industry', ''),
            'listing_date': row.get('ListingDate', '').strftime('%Y-%m-%d') if pd.notna(row.get('ListingDate')) else '',
            'industries': [],
            'themes': [],
            'groups': []
        }

    # 결과 저장
    result = {
        'stocks': stocks,
        'metadata': {
            'total_stocks': len(stocks),
            'kospi_count': len(kospi),
            'kosdaq_count': len(kosdaq),
            'updated_at': datetime.now().isoformat(),
            'source': 'FinanceDataReader'
        }
    }

    output_file = 'data/stock_master.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print("=" * 70)
    print(f"✅ 저장 완료: {output_file}")
    print("=" * 70)
    print(f"  총 종목: {len(stocks)}개")
    print(f"  코스피: {len(kospi)}개")
    print(f"  코스닥: {len(kosdaq)}개")
    print()

    return stocks


if __name__ == "__main__":
    import pandas as pd
    fetch_all_stocks()
