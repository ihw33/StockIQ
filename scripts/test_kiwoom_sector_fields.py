#!/usr/bin/env python3
"""
ka10001 종목 정보에서 업종/섹터 필드 확인
"""
import os
import requests
import json
from dotenv import load_dotenv
import pathlib

project_root = pathlib.Path(__file__).parent.parent
load_dotenv(project_root / '.env.local')

BASE_URL = os.getenv("KIWOOM_BASE_URL", "https://openapi.kiwoom.com")
APP_KEY = os.getenv("KIWOOM_APP_KEY")
APP_SECRET = os.getenv("KIWOOM_SECRET_KEY")

def get_token():
    url = f"{BASE_URL}/oauth2/token"
    headers = {
        "content-type": "application/json;charset=UTF-8",
        "api-id": "au10001"
    }
    data = {
        "grant_type": "client_credentials",
        "appkey": APP_KEY,
        "secretkey": APP_SECRET
    }
    res = requests.post(url, headers=headers, json=data, timeout=5)
    res.raise_for_status()
    return res.json().get('token')

def get_stock_info(symbol, token):
    """ka10001: 종목 정보 조회"""
    url = f"{BASE_URL}/api/dostk/stkinfo"
    headers = {
        "content-type": "application/json;charset=UTF-8",
        "api-id": "ka10001",
        "Authorization": f"Bearer {token}"
    }
    body = {"stk_cd": symbol}

    res = requests.post(url, headers=headers, json=body, timeout=5)
    return res.json()

if __name__ == "__main__":
    print("="*60)
    print("ka10001 업종/섹터 필드 확인")
    print("="*60)

    token = get_token()

    # 다양한 업종의 대표 종목 테스트
    test_stocks = [
        ("005930", "삼성전자 (반도체)"),
        ("035720", "카카오 (IT서비스)"),
        ("005380", "현대차 (자동차)"),
        ("035420", "NAVER (인터넷)"),
        ("051910", "LG화학 (화학)"),
        ("000660", "SK하이닉스 (반도체)"),
        ("028260", "삼성물산 (건설)"),
        ("055550", "신한지주 (금융)"),
    ]

    results = []

    for symbol, name in test_stocks:
        print(f"\n{'─'*60}")
        print(f"[{symbol}] {name}")

        data = get_stock_info(symbol, token)

        # 업종 관련 가능성 있는 필드 출력
        sector_fields = {}
        for key, value in data.items():
            # 코드나 이름처럼 보이는 필드
            if any(keyword in key.lower() for keyword in ['sec', 'ind', 'mac', 'cat', 'group', 'type']):
                sector_fields[key] = value
                print(f"   {key}: {value}")

        if not sector_fields:
            # 모든 필드 중 관심 있을 만한 것들
            print("   주요 필드:")
            for key in ['stk_nm', 'mac', 'mac_wght', 'setl_mm']:
                if key in data:
                    print(f"   {key}: {data[key]}")

        results.append({
            "symbol": symbol,
            "name": name,
            "sector_fields": sector_fields,
            "full_data": data
        })

    # 결과 저장
    with open("ka10001_sector_fields_analysis.json", 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print("✅ 분석 완료. 결과 저장: ka10001_sector_fields_analysis.json")
    print(f"{'='*60}")

    # 공통 필드 분석
    print("\n공통 필드 분석:")
    all_keys = set()
    for r in results:
        all_keys.update(r['full_data'].keys())

    sector_related = [k for k in all_keys if any(
        keyword in k.lower() for keyword in ['sec', 'ind', 'mac', 'cat', 'group', 'type', 'kind']
    )]

    if sector_related:
        print(f"   섹터 관련 가능성 있는 키: {sector_related}")
    else:
        print("   ⚠️ 명확한 섹터 필드를 찾지 못함")

    # mac 필드 값 비교
    print("\n'mac' 필드 값 비교:")
    for r in results:
        mac_value = r['full_data'].get('mac', 'N/A')
        print(f"   {r['symbol']:6s} {r['name']:20s} mac={mac_value}")
