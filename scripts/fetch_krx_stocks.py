#!/usr/bin/env python3
"""
FinanceDataReader를 사용하여 KOSPI/KOSDAQ 전체 종목 리스트를 JSON으로 저장합니다.
Market Cap 정보를 포함하고 대형/중형/소형주로 분류합니다.
"""

import json
from datetime import datetime

def classify_size(market, rank):
    """
    시장별 시가총액 순위에 따른 규모 분류
    KOSPI: 1~100위 대형주, 101~300위 중형주, 나머지 소형주
    KOSDAQ: 1~100위 대형주, 101~400위 중형주, 나머지 소형주
    """
    if market == "KOSPI":
        if rank <= 100: return "Large"
        if rank <= 300: return "Mid"
        return "Small"
    elif market == "KOSDAQ":
        if rank <= 100: return "Large"
        if rank <= 400: return "Mid"
        return "Small"
    return "Small"

def main():
    import FinanceDataReader as fdr
    
    print("=" * 50)
    print("전체 종목 리스트 가져오기 (FinanceDataReader)")
    print("=" * 50)
    
    stocks = []
    
    # 1. KOSPI
    print("\nFetching KOSPI...")
    kospi = fdr.StockListing('KOSPI')
    # 시가총액 순위 정렬 (Marcap 내림차순)
    kospi = kospi.sort_values(by='Marcap', ascending=False).reset_index(drop=True)
    
    for idx, row in kospi.iterrows():
        # 순위: idx + 1
        size = classify_size("KOSPI", idx + 1)
        stocks.append({
            "symbol": row['Code'],
            "name": row['Name'],
            "market": "KOSPI",
            "marcap": int(row['Marcap']) if 'Marcap' in row and str(row['Marcap']).isdigit() else 0,
            "size": size
        })
    print(f"  KOSPI: {len(kospi)} stocks (Processed with ranking)")
    
    # 2. KOSDAQ
    print("Fetching KOSDAQ...")
    kosdaq = fdr.StockListing('KOSDAQ')
    kosdaq = kosdaq.sort_values(by='Marcap', ascending=False).reset_index(drop=True)
    
    for idx, row in kosdaq.iterrows():
        size = classify_size("KOSDAQ", idx + 1)
        stocks.append({
            "symbol": row['Code'],
            "name": row['Name'],
            "market": "KOSDAQ",
            "marcap": int(row['Marcap']) if 'Marcap' in row and str(row['Marcap']).isdigit() else 0,
            "size": size
        })
    print(f"  KOSDAQ: {len(kosdaq)} stocks (Processed with ranking)")
    
    # 3. ETF (선택) - ETF는 사이즈 분류 제외 (None)
    print("Fetching ETF...")
    try:
        etf = fdr.StockListing('ETF/KR')
        for _, row in etf.iterrows():
            stocks.append({
                "symbol": row['Symbol'] if 'Symbol' in row else row.get('Code', ''),
                "name": row['Name'],
                "market": "ETF",
                "marcap": 0,
                "size": "Small" # ETF는 일단 Small로 처리하거나 별도 처리
            })
        print(f"  ETF: {len(etf)} items")
    except Exception as e:
        print(f"  ETF fetch failed: {e}")
    
    # JSON 저장
    output_file = "data/krx_stock_list.json"
    
    import os
    os.makedirs("data", exist_ok=True)
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": datetime.now().isoformat(),
            "total_count": len(stocks),
            "stocks": stocks
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 총 {len(stocks)} 종목 저장 완료: {output_file}")


if __name__ == "__main__":
    main()
