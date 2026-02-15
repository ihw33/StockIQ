#!/usr/bin/env python3
"""
ka10102 API 상세 조사: 업종/섹터 목록 확인
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

def test_ka10102(market="K"):
    """ka10102: 업종 목록 조회"""
    token = get_token()
    url = f"{BASE_URL}/api/dostk/stkinfo"
    headers = {
        "content-type": "application/json;charset=UTF-8",
        "api-id": "ka10102",
        "Authorization": f"Bearer {token}"
    }
    body = {"stex_tp": market}  # K=KOSPI, Q=KOSDAQ

    print(f"🔍 ka10102 테스트: 시장={market}")
    print(f"   Body: {body}")

    res = requests.post(url, headers=headers, json=body, timeout=5)
    data = res.json()

    print(f"   Response keys: {list(data.keys())}")

    if 'list' in data:
        sectors = data['list']
        print(f"\n   📋 총 {len(sectors)}개 업종 발견")
        print(f"\n   상위 10개:")
        for i, sector in enumerate(sectors[:10], 1):
            print(f"      {i}. {sector}")

        print(f"\n   전체 저장: ka10102_sectors_{market}.json")
        with open(f"ka10102_sectors_{market}.json", 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return sectors
    else:
        print(f"   ❌ 'list' 키 없음: {data}")
        return []

def test_sector_stocks(sector_code, token):
    """특정 업종의 종목 목록 조회 시도"""
    test_apis = [
        ("ka10201", "/api/dostk/stkinfo", {"stex_tp": "K", "sector_cd": sector_code}),
        ("ka10201", "/api/dostk/stkinfo", {"stex_tp": "K", "sec_cd": sector_code}),
        ("ka10201", "/api/dostk/stkinfo", {"stex_tp": "K", "ind_cd": sector_code}),
        ("ka10203", "/api/dostk/mrkcond", {"stex_tp": "K", "sector_cd": sector_code}),
    ]

    for api_id, endpoint, body in test_apis:
        url = f"{BASE_URL}{endpoint}"
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "api-id": api_id,
            "Authorization": f"Bearer {token}"
        }

        print(f"\n   🧪 {api_id} 테스트: {body}")
        res = requests.post(url, headers=headers, json=body, timeout=5)

        if res.status_code == 200:
            data = res.json()
            if 'list' in data and len(data['list']) > 0:
                print(f"      ✅ 성공! {len(data['list'])}개 종목 반환")
                print(f"      샘플: {data['list'][:3]}")
                return api_id, data
            else:
                print(f"      ⚠️ 빈 결과: {list(data.keys())}")
        else:
            print(f"      ❌ 실패: {res.status_code}")

    return None, None

if __name__ == "__main__":
    print("="*60)
    print("ka10102 업종/섹터 상세 조사")
    print("="*60)

    # KOSPI 업종 목록
    kospi_sectors = test_ka10102("K")

    # KOSDAQ 업종 목록
    print("\n" + "="*60)
    kosdaq_sectors = test_ka10102("Q")

    # 특정 업종의 종목 조회 시도
    if kospi_sectors:
        print("\n" + "="*60)
        print("업종별 종목 조회 테스트")
        print("="*60)

        token = get_token()
        test_sector = kospi_sectors[0]['code']  # 첫 번째 업종으로 테스트
        print(f"\n테스트 업종: {kospi_sectors[0]}")

        api_id, result = test_sector_stocks(test_sector, token)

        if api_id:
            print(f"\n✅ 발견! API ID: {api_id}")
            with open(f"ka_sector_stocks_example.json", 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        else:
            print(f"\n⚠️ 업종별 종목 조회 API를 찾지 못했습니다.")
            print("   다른 파라미터나 API ID 시도 필요")
