from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ChartAnalysisRequest(BaseModel):
    symbol: str
    mode: Optional[str] = "llm"
    query: Optional[str] = None
    position_info: Optional[dict] = None


class DeepAnalysisRequest(BaseModel):
    symbol: str
    position_info: Optional[dict] = None


class AlgoAnalysisRequest(BaseModel):
    symbol: str


class CompanyAnalysisStartRequest(BaseModel):
    symbol: str


class AlphaHRRequest(BaseModel):
    company_name: str


class ScreenerRequest(BaseModel):
    profile_id: Optional[str] = "momentum_surge"
    params: Optional[Dict[str, Any]] = None
    min_score: Optional[int] = 10
    max_stocks: Optional[int] = 500


class SaveAnalysisRequest(BaseModel):
    symbol: str
    timeframe: str
    analysis_type: str
    content: Dict[str, Any]
    current_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None


class CompanyAnalysisRequest(BaseModel):
    symbol: str
    data_prompt: str  # Pre-built data string from frontend


class MacroCollectRequest(BaseModel):
    portfolio: Optional[list] = None  # [{"symbol":"005930","name":"삼성전자","type":"holding"}, ...]
    watchlist: Optional[list] = None  # [{"symbol":"000660","name":"SK하이닉스","type":"watchlist"}, ...]
    mode: Optional[str] = "am"  # "am" | "manual" | "pm"
