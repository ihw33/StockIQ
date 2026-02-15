"""
종목 관련 API 엔드포인트
- 전체 종목 리스트, 검색, 분류별 조회
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import json
from pathlib import Path

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

# 전역 캐시 (서버 시작 시 로드)
STOCK_DATA: Dict[str, Any] = {}
CLASSIFICATIONS: Dict[str, Any] = {}


def load_stock_data():
    """서버 시작 시 종목 데이터 로드"""
    global STOCK_DATA, CLASSIFICATIONS

    # stock_master.json 로드
    master_path = Path(__file__).parent.parent.parent.parent / "data" / "stock_master.json"
    with open(master_path, 'r', encoding='utf-8') as f:
        STOCK_DATA = json.load(f)

    # stock_classifications.json 로드
    class_path = Path(__file__).parent.parent.parent.parent / "data" / "stock_classifications.json"
    with open(class_path, 'r', encoding='utf-8') as f:
        CLASSIFICATIONS = json.load(f)

    print(f"✅ 종목 데이터 로드 완료: {len(STOCK_DATA.get('stocks', {}))}개")


@router.get("/list")
async def get_stocks_list(
    market: Optional[str] = Query(None, description="시장 필터 (KOSPI, KOSDAQ)"),
    industry: Optional[str] = Query(None, description="업종 필터"),
    theme: Optional[str] = Query(None, description="테마 필터"),
    group: Optional[str] = Query(None, description="그룹 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(50, ge=1, le=500, description="페이지당 항목 수")
):
    """전체 종목 리스트 조회 (필터링, 페이지네이션)"""
    stocks = STOCK_DATA.get('stocks', {})

    # 필터링
    filtered = []
    for code, stock in stocks.items():
        # 시장 필터
        if market and stock.get('market') != market:
            continue

        # 업종 필터
        if industry and industry not in stock.get('industries', []):
            continue

        # 테마 필터
        if theme and theme not in stock.get('themes', []):
            continue

        # 그룹 필터
        if group and group not in stock.get('groups', []):
            continue

        filtered.append({
            'code': code,
            **stock
        })

    # 페이지네이션
    total = len(filtered)
    start = (page - 1) * limit
    end = start + limit

    return {
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': (total + limit - 1) // limit,
        'stocks': filtered[start:end]
    }


@router.get("/{code}")
async def get_stock_detail(code: str):
    """종목 상세 정보 조회"""
    stocks = STOCK_DATA.get('stocks', {})

    if code not in stocks:
        raise HTTPException(status_code=404, detail=f"종목을 찾을 수 없습니다: {code}")

    stock = stocks[code]
    return {
        'code': code,
        **stock
    }


@router.get("/search/query")
async def search_stocks(
    q: str = Query(..., min_length=1, description="검색어 (종목명 또는 코드)"),
    limit: int = Query(20, ge=1, le=100, description="최대 결과 수")
):
    """종목 검색 (종목명 또는 코드)"""
    stocks = STOCK_DATA.get('stocks', {})
    query = q.lower()

    results = []
    for code, stock in stocks.items():
        # 코드로 검색
        if query in code.lower():
            results.append({
                'code': code,
                **stock,
                'match_type': 'code'
            })
            continue

        # 종목명으로 검색
        name = stock.get('name', '').lower()
        if query in name:
            results.append({
                'code': code,
                **stock,
                'match_type': 'name'
            })

    return {
        'query': q,
        'total': len(results),
        'results': results[:limit]
    }


@router.get("/industries/list")
async def get_industries():
    """업종 리스트 조회"""
    industries = CLASSIFICATIONS.get('industries', {})

    result = []
    for name, data in industries.items():
        result.append({
            'name': name,
            'no': data.get('no'),
            'total_stocks': data.get('total', 0),
            'change_pct': data.get('change_pct', 0)
        })

    # 종목 수 기준 내림차순
    result.sort(key=lambda x: x['total_stocks'], reverse=True)

    return {
        'total': len(result),
        'industries': result
    }


@router.get("/industries/{name}/stocks")
async def get_industry_stocks(name: str):
    """특정 업종의 종목 리스트"""
    industries = CLASSIFICATIONS.get('industries', {})

    if name not in industries:
        raise HTTPException(status_code=404, detail=f"업종을 찾을 수 없습니다: {name}")

    industry_data = industries[name]
    codes = industry_data.get('codes', [])
    stocks = STOCK_DATA.get('stocks', {})

    result = []
    for code in codes:
        if code in stocks:
            result.append({
                'code': code,
                **stocks[code]
            })

    return {
        'industry': name,
        'total': len(result),
        'stocks': result
    }


@router.get("/themes/list")
async def get_themes():
    """테마 리스트 조회"""
    themes = CLASSIFICATIONS.get('themes', {})

    result = []
    for name, data in themes.items():
        result.append({
            'name': name,
            'no': data.get('no'),
            'total_stocks': data.get('total', 0),
            'change_pct': data.get('change_pct', 0)
        })

    # 종목 수 기준 내림차순
    result.sort(key=lambda x: x['total_stocks'], reverse=True)

    return {
        'total': len(result),
        'themes': result
    }


@router.get("/themes/{name}/stocks")
async def get_theme_stocks(name: str):
    """특정 테마의 종목 리스트"""
    themes = CLASSIFICATIONS.get('themes', {})

    if name not in themes:
        raise HTTPException(status_code=404, detail=f"테마를 찾을 수 없습니다: {name}")

    theme_data = themes[name]
    codes = theme_data.get('codes', [])
    stocks = STOCK_DATA.get('stocks', {})

    result = []
    for code in codes:
        if code in stocks:
            result.append({
                'code': code,
                **stocks[code]
            })

    return {
        'theme': name,
        'total': len(result),
        'stocks': result
    }


@router.get("/groups/list")
async def get_groups():
    """그룹 리스트 조회"""
    groups = CLASSIFICATIONS.get('groups', {})

    result = []
    for name, data in groups.items():
        result.append({
            'name': name,
            'no': data.get('no'),
            'total_stocks': data.get('total', 0),
            'change_pct': data.get('change_pct', 0)
        })

    # 종목 수 기준 내림차순
    result.sort(key=lambda x: x['total_stocks'], reverse=True)

    return {
        'total': len(result),
        'groups': result
    }


@router.get("/groups/{name}/stocks")
async def get_group_stocks(name: str):
    """특정 그룹의 종목 리스트"""
    groups = CLASSIFICATIONS.get('groups', {})

    if name not in groups:
        raise HTTPException(status_code=404, detail=f"그룹을 찾을 수 없습니다: {name}")

    group_data = groups[name]
    codes = group_data.get('codes', [])
    stocks = STOCK_DATA.get('stocks', {})

    result = []
    for code in codes:
        if code in stocks:
            result.append({
                'code': code,
                **stocks[code]
            })

    return {
        'group': name,
        'total': len(result),
        'stocks': result
    }
