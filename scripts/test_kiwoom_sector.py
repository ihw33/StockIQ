#!/usr/bin/env python3
"""
키움 API 섹터/그룹/업종 관련 엔드포인트 탐색 스크립트

목적: 인포스탁 섹터/그룹 조회 API를 찾기 위해 다양한 API ID 테스트
"""
import os
import sys
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

# Load environment - 프로젝트 루트 기준
import pathlib
project_root = pathlib.Path(__file__).parent.parent
load_dotenv(project_root / '.env.local')

BASE_URL = os.getenv("KIWOOM_BASE_URL", "https://openapi.kiwoom.com")
APP_KEY = os.getenv("KIWOOM_APP_KEY")
APP_SECRET = os.getenv("KIWOOM_SECRET_KEY")

def get_token():
    """OAuth 토큰 획득"""
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
    try:
        res = requests.post(url, headers=headers, json=data, timeout=5)
        res.raise_for_status()
        token = res.json().get('token')
        print(f"✅ Token acquired: {token[:20]}...")
        return token
    except Exception as e:
        print(f"❌ Token failed: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"   Response: {e.response.text}")
        return None

def test_api(api_id, endpoint, body, token):
    """특정 API ID 테스트"""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "content-type": "application/json;charset=UTF-8",
        "api-id": api_id,
        "Authorization": f"Bearer {token}"
    }

    print(f"\n🔍 Testing API: {api_id}")
    print(f"   Endpoint: {endpoint}")
    print(f"   Body: {json.dumps(body, ensure_ascii=False)}")

    try:
        res = requests.post(url, headers=headers, json=body, timeout=5)
        print(f"   Status: {res.status_code}")

        if res.status_code == 200:
            data = res.json()
            print(f"   ✅ SUCCESS!")
            print(f"   Response keys: {list(data.keys())}")

            # 첫 번째 리스트 키 출력 (보통 데이터가 여기 있음)
            for key, value in data.items():
                if isinstance(value, list) and len(value) > 0:
                    print(f"   📋 {key}: {len(value)} items")
                    print(f"      Sample: {value[0]}")
                    break
            return data
        else:
            print(f"   ❌ Failed: {res.text}")
            return None

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def main():
    print("="*60)
    print("키움 API 섹터/그룹 탐색 스크립트")
    print("="*60)

    token = get_token()
    if not token:
        print("\n❌ 토큰 획득 실패. 종료합니다.")
        return

    print("\n" + "="*60)
    print("예상 섹터/그룹 관련 API 테스트")
    print("="*60)

    # 테스트할 API 리스트
    test_cases = [
        # ka10200대: 시장/업종 관련으로 추정
        {
            "api_id": "ka10201",
            "endpoint": "/api/dostk/stkinfo",
            "body": {"stex_tp": "K"},  # K=KOSPI, Q=KOSDAQ
            "desc": "업종별 종목 조회 (추정)"
        },
        {
            "api_id": "ka10202",
            "endpoint": "/api/dostk/stkinfo",
            "body": {"stex_tp": "K"},
            "desc": "섹터 목록 조회 (추정)"
        },
        {
            "api_id": "ka10203",
            "endpoint": "/api/dostk/mrkcond",
            "body": {"stex_tp": "K"},
            "desc": "그룹별 종목 (추정)"
        },
        {
            "api_id": "ka10204",
            "endpoint": "/api/dostk/stkinfo",
            "body": {"stex_tp": "K"},
            "desc": "테마 그룹 (추정)"
        },
        # ka10100대: 시장 정보 관련으로 추정
        {
            "api_id": "ka10101",
            "endpoint": "/api/dostk/mrkcond",
            "body": {},
            "desc": "시장 전체 정보 (추정)"
        },
        {
            "api_id": "ka10102",
            "endpoint": "/api/dostk/stkinfo",
            "body": {"stex_tp": "K"},
            "desc": "업종 지수 (추정)"
        },
        # 알려진 API로 업종 정보 확인
        {
            "api_id": "ka10001",
            "endpoint": "/api/dostk/stkinfo",
            "body": {"stk_cd": "005930"},  # 삼성전자
            "desc": "종목 정보 (섹터 필드 확인)"
        },
    ]

    results = []
    for test in test_cases:
        print(f"\n{'─'*60}")
        print(f"[{test['api_id']}] {test['desc']}")
        result = test_api(
            api_id=test['api_id'],
            endpoint=test['endpoint'],
            body=test['body'],
            token=token
        )
        results.append({
            "api_id": test['api_id'],
            "success": result is not None,
            "data": result
        })

    # 결과 요약
    print("\n" + "="*60)
    print("테스트 결과 요약")
    print("="*60)

    success_count = sum(1 for r in results if r['success'])
    print(f"\n✅ 성공: {success_count}/{len(results)}")

    for r in results:
        status = "✅" if r['success'] else "❌"
        print(f"{status} {r['api_id']}")

    # 성공한 API의 상세 정보 저장
    if success_count > 0:
        output_file = f"kiwoom_sector_test_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n📁 결과 저장: {output_file}")

if __name__ == "__main__":
    if not APP_KEY or not APP_SECRET:
        print("❌ KIWOOM_APP_KEY 또는 KIWOOM_SECRET_KEY가 설정되지 않았습니다.")
        print("   .env.local 파일을 확인하세요.")
        sys.exit(1)

    main()
