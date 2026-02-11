from typing import Dict
import asyncio
import pandas as pd
from collectors.kiwoom import KiwoomCollector
from llm_client import LLMClient
from analyzers import WeeklyAnalyzer, DailyAnalyzer, IntradayAnalyzer
from indicators import detect_market_stress, analyze_recent_volatility, get_all_strategy_status
from prompts import build_enhanced_system_prompt, build_llm_context, build_user_query

class ChartAnalyst:
    def __init__(self):
        self.kiwoom = KiwoomCollector()
        self.llm = LLMClient()
        
        # Initialize timeframe-specific analyzers
        self.weekly_analyzer = WeeklyAnalyzer()
        self.daily_analyzer = DailyAnalyzer()
        self.m15_analyzer = IntradayAnalyzer("15m")
        self.m5_analyzer = IntradayAnalyzer("5m")

    def _fetch_us_overnight(self):
        """미국 주요 지수 전일 등락 (S&P500, NASDAQ, DOW) — 개별 티커 방식"""
        try:
            import yfinance as yf
            result = {}
            for sym, key in [('^GSPC', 'sp500'), ('^IXIC', 'nasdaq'), ('^DJI', 'dow')]:
                try:
                    t = yf.Ticker(sym)
                    h = t.history(period='5d')
                    if not h.empty and len(h) >= 2:
                        today_val = float(h['Close'].iloc[-1])
                        prev_val = float(h['Close'].iloc[-2])
                        result[key] = {
                            'value': round(today_val, 2),
                            'change_pct': round((today_val - prev_val) / prev_val * 100, 2)
                        }
                except Exception:
                    pass
            if result:
                print(f"[ChartAnalyst] US overnight: {result}")
            return result if result else None
        except Exception as e:
            print(f"[ChartAnalyst] US overnight error: {e}")
            return None

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

        # --- STEP 2: BONUS TRADING TIP (Level-based) ---
        from analyzers.levels import compute_levels, pick_entry_stop_target

        bonus_tip = ""
        is_scalp_opp = (m5_vol_ratio >= 3.0) and (m5_rsi <= 70)

        if is_scalp_opp:
            # Scalping: use 5m data for levels
            levels_5m = compute_levels(
                df_5m, curr_price,
                ma_values={"12봉선": df_5m['close'].rolling(12).mean().iloc[-1] if len(df_5m) > 12 else 0},
                swing_window=3,
            )
            plan_5m = pick_entry_stop_target(curr_price, levels_5m["supports"], levels_5m["resistances"], m5_atr)
            bonus_tip = f"""
---
### 💡 [Bonus] ⚡ 초고수용 스캘핑 팁 (High Skill Only)
**"야수의 심장"**을 가진 트레이더를 위한 변동성 매매 구간입니다. (일봉 위험 무시)
- 🎰 **포착**: 5분봉 거래량 **{m5_vol_ratio:.1f}배** 폭발! (단기 수급 유입)
- 📥 **진입**: {plan_5m['entry_high']:,.0f}원
- ⛔ **손절**: {plan_5m['stop_loss']:,.0f}원 (칼손절 필수)
- 💰 **목표**: {plan_5m['target_1']:,.0f}원
"""
        elif main_verdict == "SWING":
            # Swing: use daily data for levels
            d_ma20_val = df_daily['ma20'].iloc[-1] if 'ma20' in df_daily else 0
            d_ma60_val = df_daily['ma60'].iloc[-1] if 'ma60' in df_daily else 0
            d_bb_upper_val = df_daily['bb_upper'].iloc[-1] if 'bb_upper' in df_daily else 0
            d_bb_lower_val = df_daily['bb_lower'].iloc[-1] if 'bb_lower' in df_daily else 0

            levels_d = compute_levels(
                df_daily, curr_price,
                ma_values={"20일선": d_ma20_val, "60일선": d_ma60_val},
                bb_upper=d_bb_upper_val, bb_lower=d_bb_lower_val,
                swing_window=5,
            )
            plan_d = pick_entry_stop_target(curr_price, levels_d["supports"], levels_d["resistances"], d_atr)
            bonus_tip = f"""
---
### 🌊 스윙 매매 가이드
- 📥 **진입**: {plan_d['entry_low']:,.0f}~{plan_d['entry_high']:,.0f}원 (분할 매수)
- ⛔ **손절**: {plan_d['stop_loss']:,.0f}원 (지지선 이탈 시)
- 💰 **1차 목표**: {plan_d['target_1']:,.0f}원 → **2차**: {plan_d['target_2']:,.0f}원
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

    async def analyze(self, symbol: str, mode: str = "llm", user_query: str = None, position_info: dict = None) -> Dict:
        """
        Analyzes the chart with multi-timeframe perspective.
        If mode='algo', returns fast multi-timeframe report.
        If mode='llm', queries standard AI analysis or answers user_query.
        """
        try:
            print(f"[ChartAnalyst] Analyzing {symbol} (Mode: {mode})...")

            # 1. Fetch Data in Parallel (4x faster!)
            # Use to_thread to avoid blocking event loop with synchronous requests
            results = await asyncio.gather(
                asyncio.to_thread(self.kiwoom.get_price_history, symbol, "D", 200),
                asyncio.to_thread(self.kiwoom.get_price_history, symbol, "W", 200),
                asyncio.to_thread(self.kiwoom.get_price_history, symbol, "15m", 200),
                asyncio.to_thread(self.kiwoom.get_price_history, symbol, "5m", 200)
            )
            df_daily, df_weekly, df_15m, df_5m = results
            
            if mode == "algo":
                # Calculate market stress and recent volatility
                market_stress = detect_market_stress(df_daily)
                recent_volatility = analyze_recent_volatility(df_daily, days=5)
                strategy_status = get_all_strategy_status(market_stress)
                
                # Multi-timeframe analysis
                analysis = self._generate_multi_timeframe_report(
                    df_weekly, df_daily, df_15m, df_5m, symbol
                )
                
                # Extract price info
                current_price = df_daily['close'].iloc[-1] if not df_daily.empty else None
                
                return {
                    "status": "success",
                    "symbol": symbol,
                    "analysis": analysis,
                    "source": "Multi-Timeframe Algo (V9 Enhanced)",
                    "current_price": float(current_price) if current_price else None,
                    "market_stress": market_stress,
                    "recent_volatility": recent_volatility,
                    "strategy_status": strategy_status
                }

            # LLM Mode: Use enhanced prompt system with market stress context
            # Calculate market stress and recent volatility
            market_stress = detect_market_stress(df_daily)
            recent_volatility = analyze_recent_volatility(df_daily, days=5)
            strategy_status = get_all_strategy_status(market_stress)
            
            # Generate multi-timeframe analysis for context
            analysis_report = self._generate_multi_timeframe_report(
                df_weekly, df_daily, df_15m, df_5m, symbol
            )
            
            # Build algo result for context builder
            current_price = df_daily['close'].iloc[-1] if not df_daily.empty else 0

            # Pre-fetch macro data from DB + US overnight market (async-safe)
            macro_db = None
            us_overnight = None
            try:
                from database import analysis_db
                await analysis_db.connect()
                async with analysis_db.pool.acquire() as conn:
                    macro_db = await conn.fetchrow(
                        "SELECT * FROM macro_daily WHERE date = CURRENT_DATE"
                    )
                if macro_db:
                    macro_db = dict(macro_db)
            except Exception as e:
                print(f"[ChartAnalyst] Macro DB fetch error (non-fatal): {e}")

            # US overnight indices (S&P500, NASDAQ, DOW)
            try:
                us_overnight = await asyncio.to_thread(self._fetch_us_overnight)
            except Exception as e:
                print(f"[ChartAnalyst] US overnight fetch error (non-fatal): {e}")

            algo_result = {
                'symbol': symbol,
                'analysis': analysis_report,
                'market_stress': market_stress,
                'recent_volatility': recent_volatility,
                'strategy_status': strategy_status,
                'current_price': float(current_price),
                'macro_db': macro_db,
                'us_overnight': us_overnight,
            }

            # Build enhanced prompts (run context builder in thread to avoid blocking)
            system_prompt = build_enhanced_system_prompt()
            context = await asyncio.to_thread(build_llm_context, symbol, algo_result, position_info)
            user_prompt = build_user_query(symbol, user_query)

            # Combine context and query
            full_prompt = f"{context}\n\n{user_prompt}"

            print("[ChartAnalyst] Querying LLM with enhanced context...")
            analysis = ""
            try:
                 analysis = await asyncio.wait_for(
                    self.llm.a_analyze_text(system_prompt, full_prompt, model="auto"),
                    timeout=60.0
                )
            except asyncio.TimeoutError:
                print(f"[ChartAnalyst] LLM Timeout (60s). Returning error.")
                return {
                    "status": "error",
                    "analysis": "⏱️ AI 분석 시간 초과 (60초). 잠시 후 다시 시도해주세요.",
                    "source": "Timeout"
                }
            except Exception as e:
                print(f"[ChartAnalyst] LLM Failed: {type(e).__name__}: {str(e)[:200]}")
                return {
                    "status": "error",
                    "analysis": f"🤖 AI 분석 실패: {type(e).__name__}. 잠시 후 다시 시도해주세요.",
                    "source": "System Error"
                }
            
            return {
                "status": "success",
                "symbol": symbol,
                "analysis": f"## 🧠 AI 종합 분석\n\n{analysis}",
                "source": "LLM (Enhanced with Market Stress Context)"
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
    
    def _generate_multi_timeframe_report(self, df_weekly, df_daily, df_15m, df_5m, symbol):
        """
        Generate comprehensive multi-timeframe analysis report.
        Combines Weekly (position), Daily (swing), 15m (day), 5m (scalping) perspectives.
        """
        # Calculate indicators for each timeframe
        df_weekly = self.weekly_analyzer.calculate_indicators(df_weekly)
        df_daily = self.daily_analyzer.calculate_indicators(df_daily)
        df_15m = self.m15_analyzer.calculate_indicators(df_15m)
        df_5m = self.m5_analyzer.calculate_indicators(df_5m)
        
        # Market stress detection
        market_stress = detect_market_stress(df_daily)
        recent_volatility = analyze_recent_volatility(df_daily, days=5)
        strategy_status = get_all_strategy_status(market_stress)
        
        # Generate individual reports
        weekly_report = self.weekly_analyzer.generate_report(df_weekly)
        daily_report = self.daily_analyzer.generate_report(df_daily)
        m15_report = self.m15_analyzer.generate_report(df_15m)
        m5_report = self.m5_analyzer.generate_report(df_5m)
        
        # Extract current price for header
        curr_price = df_daily.iloc[-1]['close'] if not df_daily.empty else 0
        
        # Build stress alert section
        stress_section = ""
        if market_stress['is_stressed']:
            stress_emoji = {'EXTREME': '🔴', 'HIGH': '🟠', 'MEDIUM': '🟡'}.get(market_stress['stress_level'], '🟢')
            stress_section = f"""🚨 **시장 상태: {stress_emoji} {market_stress['stress_level']} 스트레스** (점수 {market_stress['stress_score']}/100)

감지된 이상 신호:
{chr(10).join('- ' + r for r in market_stress['reasons'])}

---

"""
        
        # Build recent volatility table with volume/trade amount
        volatility_section = f"""## 📊 최근 5일 거래 현황

| 날짜 | 종가 | 변동 | 거래량 | 거래대금 | 상태 |
|------|------|------|----------|----------|------|
"""
        for h in recent_volatility['history']:
            if h['change_pct'] > 3:
                emoji = '🟢 급등'
            elif h['change_pct'] > 0:
                emoji = '🟢'
            elif h['change_pct'] == 0:
                emoji = '⚪'
            elif h['change_pct'] > -3:
                emoji = '🔴'
            else:
                emoji = '🔴 급락'

            vol_emoji = '📈' if h['volume_ratio'] > 1.5 else '📊' if h['volume_ratio'] > 0.7 else '📉'
            volume_str = f"{h['volume']/1e8:.1f}억주" if h['volume'] >= 1e8 else f"{h['volume']/1e4:.0f}만주"
            trade_amt_str = f"{h['trade_amount']/1e4:.0f}조원" if h['trade_amount'] >= 1e4 else f"{h['trade_amount']:.0f}억원"

            volatility_section += f"| {h['date']} | {h['close']:,.0f}원 | {h['change_pct']:+.1f}% | {vol_emoji} {volume_str} ({h['volume_ratio']:.1f}배) | 💰 {trade_amt_str} | {emoji} |\n"

        # Volume and trade amount summary
        vol_level_emoji = {'높음': '🔥', '보통': '📊', '낮음': '❄️'}.get(recent_volatility['volume_level'], '📊')
        vol_trend_emoji = {'증가 중': '↗️', '감소 중': '↘️', '보합': '→'}.get(recent_volatility['volume_trend'], '→')
        amt_trend_emoji = {'증가 중': '↗️', '감소 중': '↘️', '보합': '→'}.get(recent_volatility['trade_amount_trend'], '→')

        # Buying pressure assessment
        bp = recent_volatility['buying_pressure']
        if bp >= 65:
            bp_status = '🟢 강한 매수세'
        elif bp >= 55:
            bp_status = '🟢 매수 우위'
        elif bp >= 45:
            bp_status = '⚪ 중립'
        elif bp >= 35:
            bp_status = '🔴 매도 우위'
        else:
            bp_status = '🔴 강한 매도세'

        volatility_warning = ""
        if recent_volatility['volatility_level'] == 'HIGH':
            volatility_warning = "\n⚠️ **변동성 확장 구간** (눌림목이 아닐 수 있음)"

        volatility_section += f"""\n**📈 5일 누적 변동: {recent_volatility['cumulative_change_pct']:+.1f}%** | **평균 일간 변동: {recent_volatility['avg_daily_volatility']:.1f}%** | **변동성: {recent_volatility['volatility_level']}**{volatility_warning}

**{vol_level_emoji} 거래량 수준: {recent_volatility['volume_level']}** (20일 평균 대비) | **{vol_trend_emoji} 추이: {recent_volatility['volume_trend']}**
**💰 평균 거래대금: {recent_volatility['avg_trade_amount']:.0f}억원** | **{amt_trend_emoji} 추이: {recent_volatility['trade_amount_trend']}**
**⚖️ 체결강도 추정: {bp:.0f}점** ({bp_status}) _※ 상승일/하락일 거래량 기준 추정치_

---

"""
        
        # Strategy warnings
        strategy_warnings = ""
        disabled_strategies = [tf for tf, status in strategy_status.items() if not status['enabled']]
        if disabled_strategies:
            strategy_warnings = "⚠️ **전략 제한:**\n"
            for tf in disabled_strategies:
                tf_name = {'15m': '15분봉', '5m': '5분봉'}.get(tf, tf)
                strategy_warnings += f"- ❌ {tf_name}: {strategy_status[tf]['reason']}\n"
            strategy_warnings += "\n"
        
        # Smart recommendation logic
        smart_summary = self._generate_smart_summary(df_weekly, df_daily, df_15m, df_5m, curr_price)
        
        # Combine into comprehensive report
        report = f"""# 🧠 {symbol} 멀티 타임프레임 종합 분석

> **현재가**: {curr_price:,.0f}원

{stress_section}{volatility_section}{smart_summary}{strategy_warnings}

{weekly_report}

{daily_report}

{m15_report}

{m5_report}

## 📋 포지션별 배분 참고

| 투자 스타일 | 비중 | 타임프레임 | 보유 기간 |
|------------|------|----------|----------|
| 🏦 장기 보유 | 50% | 주봉 | 6개월~1년 |
| 📈 스윙 | 30% | 일봉 | 3~10일 |
| ⚡ 데이 | 15% | 15분봉 | 1~3시간 |
| 💨 스캘핑 | 5% | 5분봉 | 5~15분 |

⚠️ **리스크 관리**: 각 타임프레임의 손절가를 반드시 준수하세요.
"""
        return report
    
    def _generate_smart_summary(self, df_w, df_d, df_15m, df_5m, curr_price):
        """
        Analyze all timeframes and recommend the best strategy for NOW.
        """
        # Extract key metrics
        weekly_rsi = df_w.iloc[-1].get('rsi', 50) if not df_w.empty else 50
        weekly_ma52 = df_w.iloc[-1].get('ma52', 0) if not df_w.empty else 0
        weekly_bullish = curr_price > weekly_ma52
        weekly_overheated = weekly_rsi > 70
        
        daily_ma20 = df_d.iloc[-1].get('ma20', 0) if not df_d.empty else 0
        daily_rsi = df_d.iloc[-1].get('rsi', 50) if not df_d.empty else 50
        daily_stoch = df_d.iloc[-1].get('stoch_k', 50) if not df_d.empty else 50
        daily_bullish = curr_price > daily_ma20
        daily_healthy = daily_rsi < 70 and daily_stoch < 80
        
        m15_ma20 = df_15m.iloc[-1].get('ma20', 0) if not df_15m.empty else 0
        m15_vwap = df_15m.iloc[-1].get('vwap', curr_price) if not df_15m.empty else curr_price
        m15_bullish = curr_price > m15_ma20 and curr_price > m15_vwap
        
        vol_5m = df_5m.iloc[-1].get('vol_ratio', 1.0) if not df_5m.empty else 1.0
        m5_spike = vol_5m >= 3.0
        
        # Decision logic
        strategies = []
        
        # 5m scalping check
        if m5_spike and daily_bullish:
            strategies.append({
                'name': '스캘핑',
                'icon': '💨',
                'priority': 4,
                'reason': f'거래량 {vol_5m:.1f}배 폭발',
                'timeframe': '5분봉',
                'risk': '매우 높음'
            })
        
        # 15m day trading check
        if m15_bullish and daily_bullish:
            strategies.append({
                'name': '데이 트레이딩',
                'icon': '⚡',
                'priority': 3,
                'reason': 'VWAP 위 + 단기 상승',
                'timeframe': '15분봉',
                'risk': '높음'
            })
        
        # Daily swing trading check (most common recommendation)
        if daily_bullish and daily_healthy:
            strategies.append({
                'name': '스윙 매매',
                'icon': '📈',
                'priority': 1,
                'reason': '눌림목 구간 + 지표 적정',
                'timeframe': '일봉',
                'risk': '보통'
            })
        elif daily_bullish:
            strategies.append({
                'name': '스윙 매매',
                'icon': '📈',
                'priority': 2,
                'reason': '상승 추세 지속',
                'timeframe': '일봉',
                'risk': '보통',
                'warning': '다이버전스'
            })
        
        # Weekly long-term check
        if weekly_bullish and not weekly_overheated:
            strategies.append({
                'name': '장기 포지션',
                'icon': '🏦',
                'priority': 1,
                'reason': '강한 상승 추세',
                'timeframe': '주봉',
                'risk': '낮음'
            })
        elif weekly_bullish and weekly_overheated:
            strategies.append({
                'name': '장기 포지션',
                'icon': '🏦',
                'priority': 3,
                'reason': f'상승 중 / RSI {weekly_rsi:.0f} 과열',
                'timeframe': '주봉',
                'risk': '보통',
                'note': '보유 OK, 신규 진입은 신중히'
            })
        
        # Sort by priority (lower = better)
        strategies.sort(key=lambda x: x['priority'])
        
        # Generate summary
        if not strategies:
            return """## 💭 현재 시장 상황

**⚪ 관망 구간**

모든 타임프레임에서 명확한 진입 신호가 없습니다. 조정을 기다리는 것도 하나의 전략입니다.

---
"""
        
        best_strategy = strategies[0]
        cautions = []
        
        # Check what needs caution
        if not m15_bullish:
            cautions.append('15분봉 약세 (단타 주의)')
        if not m5_spike:
            cautions.append('5분봉 거래량 부족 (스캘핑 부적합)')
        if 'warning' in best_strategy:
            cautions.append(f"{best_strategy['warning']} 주의")
        
        warning_text = f" ⚠️ {best_strategy.get('warning', '')}" if 'warning' in best_strategy else ""
        
        summary = f"""## 💭 현재 시장 상황

**{best_strategy['icon']} {best_strategy['name']} 유리**{warning_text}

{best_strategy['reason']} ({best_strategy['timeframe']} 기준)  
위험도: {best_strategy['risk']}
"""
        
        if 'note' in best_strategy:
            summary += f"\n💡 {best_strategy['note']}\n"
        
        summary += "\n"
        
        # Add other viable options
        if len(strategies) > 1:
            others = []
            for s in strategies[1:3]:  # Show up to 2 more
                note = f" ({s['note']})" if 'note' in s else ""
                others.append(f"- {s['icon']} {s['name']}: {s['reason']}{note}")
            if others:
                summary += "**다른 관점:**\n" + "\n".join(others) + "\n\n"
        
        # Add cautions if any
        if cautions:
            summary += "**참고 사항:** " + " / ".join(cautions) + "\n\n"
        
        summary += "---\n"
        return summary
