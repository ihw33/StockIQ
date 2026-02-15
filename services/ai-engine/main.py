from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import asyncio
import logging
import pytz
from datetime import datetime as dt_datetime
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from project root .env.local
# services/ai-engine/main.py -> ../../.env.local
env_path = os.path.join(os.path.dirname(__file__), '../../.env.local')
load_dotenv(env_path)

# Import routers
from routers import strategy, reports, market, macro, screener, portfolio, alpha_hr, stocks, sectors, stocks_movers

# Import for scheduler
from models.requests import MacroCollectRequest
from routers.macro import collect_macro_data

app = FastAPI(title="StockIQ AI Engine", description="Python-based AI Trading Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for dev convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoints
@app.get("/")
def read_root():
    return {"status": "active", "service": "StockIQ AI Engine"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Include routers
app.include_router(strategy.router, tags=["strategy"])
app.include_router(reports.router, tags=["reports"])
app.include_router(market.router, tags=["market"])
app.include_router(macro.router, tags=["macro"])
app.include_router(screener.router, tags=["screener"])
app.include_router(portfolio.router, tags=["portfolio"])
app.include_router(alpha_hr.router, tags=["alpha-hr"])
app.include_router(stocks.router, tags=["stocks"])
app.include_router(sectors.router, tags=["sectors"])
app.include_router(stocks_movers.router, tags=["stocks-movers"])

# ==================== Macro Scheduler ====================

_macro_scheduler_running = False

async def _run_macro_collection(mode: str = "am"):
    """매크로 데이터 수집 (collect_macro_data 로직 재사용)"""
    try:
        print(f"[Macro Scheduler] {mode.upper()} 수집 시작: {dt_datetime.now(pytz.timezone('Asia/Seoul')).strftime('%H:%M:%S')}")
        await collect_macro_data(MacroCollectRequest(mode=mode))
        print(f"[Macro Scheduler] {mode.upper()} 수집 완료")
    except Exception as e:
        print(f"[Macro Scheduler] {mode.upper()} 수집 실패: {e}")

SCHEDULE = [
    {"hour": 7, "minute": 0, "mode": "am"},
    {"hour": 18, "minute": 0, "mode": "pm"},
]

async def _macro_scheduler():
    """
    매크로 자동 스케줄러: 평일(월~금) 07:00 AM + 18:00 PM KST 수집
    AM: 글로벌 지표 + 뉴스 + 예측 브리핑
    PM: 확정 수급 + 뉴스 + 결산 브리핑
    주말 건너뜀
    """
    global _macro_scheduler_running
    _macro_scheduler_running = True
    kst = pytz.timezone('Asia/Seoul')
    from datetime import timedelta
    print(f"[Macro Scheduler] 시작 — 평일 07:00(AM) + 18:00(PM) KST 자동 수집 (주말 제외)")

    while _macro_scheduler_running:
        try:
            now = dt_datetime.now(kst)

            # 다음 스케줄 슬롯 계산
            next_run = None
            next_mode = "am"
            for slot in SCHEDULE:
                target = now.replace(hour=slot["hour"], minute=slot["minute"], second=0, microsecond=0)
                if now < target:
                    # 아직 안 지남 → 오늘 이 슬롯
                    candidate = target
                else:
                    continue
                if next_run is None or candidate < next_run:
                    next_run = candidate
                    next_mode = slot["mode"]

            # 오늘 남은 슬롯이 없으면 내일 첫 슬롯
            if next_run is None:
                tomorrow = (now + timedelta(days=1)).replace(
                    hour=SCHEDULE[0]["hour"], minute=SCHEDULE[0]["minute"], second=0, microsecond=0
                )
                next_run = tomorrow
                next_mode = SCHEDULE[0]["mode"]

            # 주말이면 월요일로 이동 (토=5, 일=6)
            while next_run.weekday() >= 5:
                next_run += timedelta(days=1)

            wait_seconds = (next_run - now).total_seconds()
            next_day_name = ['월','화','수','목','금','토','일'][next_run.weekday()]
            print(f"[Macro Scheduler] 다음 수집: {next_run.strftime('%Y-%m-%d')}({next_day_name}) {next_run.strftime('%H:%M')} KST [{next_mode.upper()}] ({wait_seconds/3600:.1f}시간 후)")

            # 대기 (30초 간격으로 체크하며 대기 — 종료 신호 감지용)
            while wait_seconds > 0 and _macro_scheduler_running:
                sleep_chunk = min(wait_seconds, 30)
                await asyncio.sleep(sleep_chunk)
                wait_seconds -= sleep_chunk

            if not _macro_scheduler_running:
                break

            # 수집 실행
            print(f"[Macro Scheduler] === {dt_datetime.now(kst).strftime('%Y-%m-%d %H:%M')} {next_mode.upper()} 수집 시작 ===")
            await _run_macro_collection(next_mode)
            print(f"[Macro Scheduler] === {next_mode.upper()} 수집 완료 ===")

            # 수집 후 1분 대기 (중복 실행 방지)
            await asyncio.sleep(60)

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Macro Scheduler] 에러: {e}")
            await asyncio.sleep(60)

    print("[Macro Scheduler] 스케줄러 종료")

@app.on_event("startup")
async def startup_event():
    # 종목 데이터 로드
    stocks.load_stock_data()
    # 매크로 스케줄러 시작
    asyncio.create_task(_macro_scheduler())

@app.on_event("shutdown")
async def stop_macro_scheduler():
    global _macro_scheduler_running
    _macro_scheduler_running = False


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
