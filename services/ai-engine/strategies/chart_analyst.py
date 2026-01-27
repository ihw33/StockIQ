from typing import Dict
import asyncio
import pandas as pd
from collectors.kiwoom import KiwoomCollector
from llm_client import LLMClient

class ChartAnalyst:
    def __init__(self):
        self.kiwoom = KiwoomCollector()
        self.llm = LLMClient()

    def _calculate_indicators(self, df):
        if df.empty: return df
        # 1. MA & Disparity
        df['ma20'] = df['close'].rolling(20).mean()
        df['ma60'] = df['close'].rolling(60).mean()
        # Disparity (Igyeokdo)
        df['disparity'] = (df['close'] / df['ma20']) * 100

        # 2. Bollinger Bands
        std20 = df['close'].rolling(20).std()
        df['bb_upper'] = df['ma20'] + (std20 * 2)
        df['bb_lower'] = df['ma20'] - (std20 * 2)
        
        # 3. RSI (Wilder's)
        delta = df['close'].diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        avg_gain = gain.ewm(com=13, adjust=False, min_periods=14).mean()
        avg_loss = loss.ewm(com=13, adjust=False, min_periods=14).mean()
        rs = avg_gain / avg_loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # 4. ATR (Volatility)
        high_low = df['high'] - df['low']
        high_close = (df['high'] - df['close'].shift()).abs()
        low_close = (df['low'] - df['close'].shift()).abs()
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        df['atr'] = tr.rolling(14).mean()
        
        # 5. Volume Ratio & VWAP
        df['vol_ma20'] = df['volume'].rolling(20).mean()
        df['vol_ratio'] = df['volume'] / df['vol_ma20']
        
        # Cumulative VWAP (approx trend)
        cum_vol = df['volume'].cumsum()
        cum_pv = (df['close'] * df['volume']).cumsum()
        df['vwap'] = cum_pv / cum_vol
        
        return df

    def _generate_heuristic_report(self, df_daily, df_15m, df_5m):
        # Calc Indicators
        df_daily = self._calculate_indicators(df_daily)
        df_15m = self._calculate_indicators(df_15m)
        df_5m = self._calculate_indicators(df_5m)
        
        if df_daily.empty or df_5m.empty: return "## ⚠️ 데이터 부족"

        # --- EXTRACT KEY DATA ---
        curr_price = df_5m['close'].iloc[-1]
        COST_RATE = 0.0023 # Transaction Cost (0.23%)
        
        # Daily: Trend & Regime
        d_rsi = df_daily['rsi'].iloc[-1] if 'rsi' in df_daily else 50
        d_disparity = df_daily['disparity'].iloc[-1] if 'disparity' in df_daily else 100
        d_atr = df_daily['atr'].iloc[-1] if 'atr' in df_daily else 0
        
        # [Moved Up] Trend Indicators for Logic
        d_ma20 = df_daily['ma20'].iloc[-1] if 'ma20' in df_daily else 0
        d_bb_upper = df_daily['bb_upper'].iloc[-1] if 'bb_upper' in df_daily else 9999999
        d_close = df_daily['close'].iloc[-1]
        
        # 5m: Entry Triggers
        m5_rsi = df_5m['rsi'].iloc[-1] if 'rsi' in df_5m else 50
        m5_vol_ratio = df_5m['vol_ratio'].iloc[-1] if 'vol_ratio' in df_5m else 1.0
        m5_atr = df_5m['atr'].iloc[-1] if 'atr' in df_5m else 0
        m5_vwap = df_5m['vwap'].iloc[-1] if 'vwap' in df_5m else curr_price

        # --- STEP 1: REGIME CLASSIFICATION (Scoring System) ---
        strategy_name = "관망 (Wait)"
        risk_level = "중립"
        r_r_ratio = "N/A"
        entry_mode = "NONE"

        # 1. Calculate Overheat Score (Max 100)
        score = 0
        score_details = []

        # (1) RSI Score (Max 40)
        if d_rsi >= 80: 
            score += 40
            score_details.append(f"RSI({d_rsi:.1f}) 초과열")
        elif d_rsi >= 75:
            score += 20
            score_details.append(f"RSI({d_rsi:.1f}) 과열")
        elif d_rsi >= 70:
            score += 10
            score_details.append(f"RSI({d_rsi:.1f}) 강세")

        # (2) Disparity Score (Max 30)
        if d_disparity >= 115:
            score += 30
            score_details.append(f"이격도({d_disparity:.1f}%) 극대")
        elif d_disparity >= 110:
            score += 15
            score_details.append(f"이격도({d_disparity:.1f}%) 확대")

        # (3) Bollinger Band Break (Max 20)
        d_bb_upper = df_daily['bb_upper'].iloc[-1] if 'bb_upper' in df_daily else 9999999
        d_close = df_daily['close'].iloc[-1]
        if d_close > d_bb_upper * 1.01:
            score += 20
            score_details.append("밴드 돌파")

        # (4) Volume Divergence (Max 10)
        if d_rsi >= 70 and m5_vol_ratio < 0.8:
            score += 10
            score_details.append("거래량 다이버전스")

        # 2. Objective Diagnosis (Fact-based / Safety First)
        score_str = ' + '.join(score_details) if score_details else "특이사항 없음"
        
        # Determine Main Stance (Safe/Conservative)
        main_verdict = "WAIT"
        entry_mode = "NONE"

        if score >= 65:
             strategy_name = "⛔ 진입 금지 (Too Hot)"
             reason = f"**과열 구간 (점수 {score}점)**. 통계적 조정 위험이 높습니다.\n- 요인: {score_str}"
             risk_level = "매우 높음 (High Risk)"
             main_verdict = "WAIT"
             entry_mode = "NONE"
        elif score >= 40:
             strategy_name = "🔭 관망/준비 (Watch)"
             reason = f"상승 추세이나 다소 부담스러운 구간 (점수 {score}점)."
             risk_level = "높음 (Medium-High)"
             main_verdict = "WATCH"
             entry_mode = "NONE"
        elif d_rsi >= 40 and d_close >= d_ma20:
             strategy_name = "🌊 정석 스윙 (Standard Swing)"
             reason = "안정적 상승 추세 (20일선 위) & RSI 양호. 눌림목 공략 적합."
             risk_level = "보통 (Medium)"
             main_verdict = "SWING"
             entry_mode = "SWING"
        elif d_rsi >= 40: # Price < MA20 case (Contradiction fix)
             strategy_name = "📉 하락 조정을 위한 관망"
             reason = "RSI는 중립이나, 주가가 20일선 아래로 이탈했습니다. 추세 전환 확인 필요."
             risk_level = "높음 (Downtrend)"
             main_verdict = "WAIT"
             entry_mode = "NONE"
        else:
             strategy_name = "🥶 약세장 (Bear Market)"
             reason = "하락 추세 지속 (투매 구간)."
             main_verdict = "WAIT"
             entry_mode = "NONE"

        # --- STEP 2: BONUS TRADING TIP (Dual Layer) ---
        bonus_tip = ""
        
        # Condition: High Volatility Scalping (High Skill / High Risk)
        # Only show if Volume Spike exists AND 5m RSI is not dead
        is_scalp_opp = (m5_vol_ratio >= 3.0) and (m5_rsi <= 70)
        
        if is_scalp_opp:
            # Scalping Logic
            atr_sl = m5_atr * 1.5 if m5_atr > 0 else curr_price * 0.01
            sl_price = curr_price - atr_sl
            tp_price = curr_price * (1 + 0.01 + COST_RATE)
            
            bonus_tip = f"""
---
### 💡 [Bonus] ⚡ 초고수용 스캘핑 팁 (High Skill Only)
**"야수의 심장"**을 가진 트레이더를 위한 변동성 매매 구간입니다. (일봉 위험 무시)
- 🎰 **포착**: 5분봉 거래량 **{m5_vol_ratio:.1f}배** 폭발! (단기 수급 유입)
- 📥 **진입**: {curr_price:,.0f}원
- ⛔ **손절**: {sl_price:,.0f}원 (칼손절 필수)
- 💰 **목표**: {tp_price:,.0f}원 (세후 +1.0% 짧게)
"""
        elif main_verdict == "SWING":
             # Standard Swing Plan
             atr_sl = d_atr * 2.0 if d_atr > 0 else curr_price * 0.03
             sl_price = curr_price - atr_sl
             tp_price1 = curr_price * (1 + 0.03 + COST_RATE)
             
             bonus_tip = f"""
---
### 🌊 스윙 매매 가이드 (Standard)
- 📥 **진입**: {curr_price:,.0f}원 부근 (분할 매수)
- ⛔ **손절**: {sl_price:,.0f}원 (추세 이탈 시)
- 💰 **목표**: {tp_price1:,.0f}원 (세후 3% 목표)
"""

        # --- STEP 3: DETAILED REASONING (The "Why") ---
        d_ma20 = df_daily['ma20'].iloc[-1] if 'ma20' in df_daily else 0
        d_bb_upper = df_daily['bb_upper'].iloc[-1] if 'bb_upper' in df_daily else 0
        
        trend_str = "상승 추세 (Price > 20일선)" if d_close >= d_ma20 else "하락/조정 추세 (Price < 20일선)"
        rsi_status = '🔥과매수 (조심!)' if d_rsi >= 70 else '💧과매도 (반등기대)' if d_rsi <= 30 else '👌중립 (안정적)'
        
        detail_section = f"""
### 2️⃣ 상세 분석 (Reasoning)
AI가 이 결론을 내린 구체적인 근거입니다.
- **📈 추세 판단**: 현재 **{trend_str}**입니다. 주가가 20일 이동평균선({d_ma20:,.0f}원) {"위에" if d_close >= d_ma20 else "아래에"} 위치하여 힘이 {"강합니다" if d_close >= d_ma20 else "약합니다"}.
- **📊 보조 지표**: RSI가 **{d_rsi:.1f} ({rsi_status})** 상태입니다. 이격도(괴리율)는 **{d_disparity:.1f}%**로, {"평균 회귀(조정) 압력이 큽니다" if d_disparity >= 110 else "적정 수준입니다"}.
- **🛡️ 지지/저항**: 주요 지지 라인은 **{d_ma20:,.0f}원**, 단기 저항 라인은 **{d_bb_upper:,.0f}원**으로 분석됩니다.
"""

        # Final Report Assembly
        return f"""
## 🧠 AI 트레이더 분석 (V7: Deep Logical)

### 1️⃣ 메인 전략: **{strategy_name}**
- **결론**: {reason}
- **위험도**: {risk_level}

{detail_section}
{bonus_tip}
""" 

    async def analyze_strategy(self, symbol: str, mode: str = "llm", user_query: str = None) -> Dict:
        """
        Analyzes the chart.
        If mode='algo', returns fast rule-based report.
        If mode='llm', queries standard AI analysis or answers user_query.
        """
        try:
            print(f"[ChartAnalyst] Analyzing {symbol} (Mode: {mode})...")

            # 1. Fetch Data 
            # Use to_thread to avoid blocking event loop with synchronous requests
            # Increased to 200 for better indicator stability (RSI/MA/Bollinger)
            df_daily = await asyncio.to_thread(self.kiwoom.get_price_history, symbol, "D", 200)
            df_15m = await asyncio.to_thread(self.kiwoom.get_price_history, symbol, "15m", 200)
            df_5m = await asyncio.to_thread(self.kiwoom.get_price_history, symbol, "5m", 200)
            
            if mode == "algo":
                analysis = self._generate_heuristic_report(df_daily, df_15m, df_5m)
                return {
                    "status": "success",
                    "symbol": symbol,
                    "analysis": analysis,
                    "source": "Internal Algo (V2)"
                }

            # LLM Mode: Ensure we have comprehensive data
            df_weekly = await asyncio.to_thread(self.kiwoom.get_price_history, symbol, "W", 200)
            df_15m = await asyncio.to_thread(self.kiwoom.get_price_history, symbol, "15m", 200)
            
            def format_df(df, name):
                if df.empty: return f"[{name}] No Data"
                subset = df[['date', 'open', 'high', 'low', 'close', 'volume']].tail(30)
                return f"[{name} Chart Data (Last 30 candles)]\n{subset.to_markdown(index=False)}"

            data_context = f"""
            Target Symbol: {symbol}
            {format_df(df_daily, "Daily")}
            {format_df(df_weekly, "Weekly")}
            {format_df(df_15m, "15-Minute")}
            {format_df(df_5m, "5-Minute")}
            """

            system_prompt = """
            You are a World-Class Technical Analyst and Day Trader.
            Your goal is to answer the user's questions based on the provided technical chart data.
            If no specific question is asked, provide a standard strategy setup.
            """
            
            if user_query:
                user_prompt = f"User Question: {user_query}\n\nContext (Chart Data):\n{data_context}"
            else:
                user_prompt = f"Analyze this market data and suggest a strategy:\n{data_context}"

            print("[ChartAnalyst] Querying LLM...")
            analysis = ""
            try:
                 analysis = await asyncio.wait_for(
                    self.llm.a_analyze_text(system_prompt, user_prompt),
                    timeout=20.0 
                )
            except Exception as e:
                print(f"[ChartAnalyst] LLM Failed ({e}). Returning simple error.")
                return {
                    "status": "error",
                    "analysis": "🤖 AI is currently busy. Please try 'Analyze Strategy' (Algo) or try again later.",
                    "source": "System Error"
                }
            
            return {
                "status": "success",
                "symbol": symbol,
                "analysis": f"## 🧠 AI Answer\n\n{analysis}",
                "source": "LLM (Gemini Pro)"
            }

        except Exception as e:
            print(f"[ChartAnalyst] Error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "error": str(e),
                "analysis": f"❌ Analysis Failed: {str(e)}" 
            }
