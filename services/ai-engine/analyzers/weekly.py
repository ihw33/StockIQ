"""
Weekly (장기 포지션) analyzer for position trading.
"""
import pandas as pd
from .base import TimeframeAnalyzer
from .levels import compute_levels, pick_entry_stop_target


class WeeklyAnalyzer(TimeframeAnalyzer):
    """
    Weekly chart analysis for long-term position trading.
    Focus: 13/26/52 week MAs, MACD, ADX, OBV
    """

    def __init__(self):
        super().__init__("W")

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate weekly-specific indicators"""
        if df.empty:
            return df

        # 1. Moving Averages (13/26/52 weeks)
        df['ma13'] = df['close'].rolling(13).mean()  # 분기
        df['ma26'] = df['close'].rolling(26).mean()  # 반기
        df['ma52'] = df['close'].rolling(52).mean()  # 연간

        # 2. RSI (14)
        df['rsi'] = self._calculate_rsi(df['close'], 14)

        # 3. MACD (12-26-9)
        macd, signal, hist = self._calculate_macd(df['close'])
        df['macd'] = macd
        df['macd_signal'] = signal
        df['macd_hist'] = hist

        # 4. ADX (Trend Strength)
        df['atr'] = self._calculate_atr(df, 14)
        # Simplified ADX calculation
        df['adx'] = df['atr'].rolling(14).mean() / df['close'] * 100

        # 5. OBV (Volume Trend)
        df['obv'] = self._calculate_obv(df)

        # 6. Bollinger Bands
        bb_upper, bb_middle, bb_lower = self._calculate_bollinger_bands(df['close'], 20)
        df['bb_upper'] = bb_upper
        df['bb_middle'] = bb_middle
        df['bb_lower'] = bb_lower

        return df

    def generate_report(self, df: pd.DataFrame) -> str:
        """Generate weekly analysis report"""
        if df.empty or len(df) < 52:
            return "## 📊 주봉 분석\n⚠️ 데이터 부족 (52주 이상 필요)"

        # Extract latest values
        latest = df.iloc[-1]
        curr_price = latest['close']

        ma13 = latest.get('ma13', 0)
        ma26 = latest.get('ma26', 0)
        ma52 = latest.get('ma52', 0)
        rsi = latest.get('rsi', 50)
        macd = latest.get('macd', 0)
        macd_signal = latest.get('macd_signal', 0)
        obv = latest.get('obv', 0)
        obv_prev = df.iloc[-10]['obv'] if len(df) > 10 else obv
        bb_upper = latest.get('bb_upper', 0)
        bb_lower = latest.get('bb_lower', 0)
        atr = latest.get('atr', 0)

        # Determine trend
        above_ma13 = curr_price > ma13
        above_ma26 = curr_price > ma26
        above_ma52 = curr_price > ma52

        if above_ma13 and above_ma26 and above_ma52:
            trend = "강한 상승 추세"
            trend_icon = "🟢"
        elif above_ma26 and above_ma52:
            trend = "상승 추세"
            trend_icon = "🟢"
        elif above_ma52:
            trend = "약한 상승 추세"
            trend_icon = "🟡"
        else:
            trend = "하락 추세"
            trend_icon = "🔴"

        # MACD signal
        macd_status = "골든" if macd > macd_signal else "데드"
        macd_icon = "🟢" if macd > macd_signal else "🔴"

        # OBV divergence
        obv_trend = "↗" if obv > obv_prev else "↘"

        # Investment opinion
        if above_ma26 and macd > macd_signal and rsi < 70:
            opinion = "매수 후 홀딩"
            opinion_icon = "🟢"
        elif above_ma52:
            opinion = "보유 (관망)"
            opinion_icon = "🟡"
        else:
            opinion = "비중 축소"
            opinion_icon = "🔴"

        # --- Level-based entry/exit (주봉: wider swing window) ---
        levels = compute_levels(
            df, curr_price,
            ma_values={"13주선": ma13, "26주선": ma26, "52주선": ma52},
            bb_upper=bb_upper, bb_lower=bb_lower,
            swing_window=3,  # weekly data → fewer bars, smaller window
        )
        plan = pick_entry_stop_target(curr_price, levels["supports"], levels["resistances"], atr)

        sup_str = ", ".join(f"{s['price']:,}({s['type']})" for s in levels["supports"][:3]) or "-"
        res_str = ", ".join(f"{r['price']:,}({r['type']})" for r in levels["resistances"][:3]) or "-"

        report = f"""## 📊 주봉 - 장기 포지션 전략

**{trend_icon} {trend}** | 포지션 트레이딩 (6개월~1년)

| 지표 | 값 | 상태 |
|------|-----|------|
| 13주선 | {ma13:,.0f}원 | {"✅ 지지" if above_ma13 else "❌ 약세"} |
| 26주선 | {ma26:,.0f}원 | {"✅ 지지" if above_ma26 else "❌ 약세"} |
| 52주선 | {ma52:,.0f}원 | {"✅ 지지" if above_ma52 else "❌ 약세"} |
| RSI | {rsi:.1f} | {"🔥 과열" if rsi > 70 else "💧 침체" if rsi < 30 else "✅ 중립"} |
| MACD | {macd_icon} {macd_status} 크로스 | {obv_trend} 거래량 |

**지지선:** {sup_str}
**저항선:** {res_str}

**투자 의견:** {opinion_icon} **{opinion}**
- ⛔ 손절 {plan['stop_loss']:,}원
- 🎯 목표 {plan['target_1']:,}원 → {plan['target_2']:,}원 → {plan['target_3']:,}원

---
"""
        return report
