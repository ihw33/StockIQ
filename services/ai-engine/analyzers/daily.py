"""
Daily (스윙 매매) analyzer for swing trading.
"""
import pandas as pd
from .base import TimeframeAnalyzer
from .levels import compute_levels, pick_entry_stop_target


class DailyAnalyzer(TimeframeAnalyzer):
    """
    Daily chart analysis for swing trading.
    Focus: 5/20/60/120 day MAs, Stochastic, MACD, OBV, MFI
    """

    def __init__(self):
        super().__init__("D")

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate daily-specific indicators"""
        if df.empty:
            return df

        # 1. Moving Averages (5/20/60/120 days)
        df['ma5'] = df['close'].rolling(5).mean()
        df['ma20'] = df['close'].rolling(20).mean()
        df['ma60'] = df['close'].rolling(60).mean()
        df['ma120'] = df['close'].rolling(120).mean()

        # 2. RSI (14)
        df['rsi'] = self._calculate_rsi(df['close'], 14)

        # 3. Stochastic (14)
        k, d = self._calculate_stochastic(df, 14)
        df['stoch_k'] = k
        df['stoch_d'] = d

        # 4. Bollinger Bands
        bb_upper, bb_middle, bb_lower = self._calculate_bollinger_bands(df['close'], 20)
        df['bb_upper'] = bb_upper
        df['bb_middle'] = bb_middle
        df['bb_lower'] = bb_lower

        # 5. Disparity (이격도)
        df['disparity'] = (df['close'] / df['ma20']) * 100

        # 6. OBV
        df['obv'] = self._calculate_obv(df)

        # 7. MACD
        macd, signal, hist = self._calculate_macd(df['close'])
        df['macd'] = macd
        df['macd_signal'] = signal
        df['macd_hist'] = hist

        # 8. Volume Ratio
        df['vol_ma20'] = df['volume'].rolling(20).mean()
        df['vol_ratio'] = df['volume'] / df['vol_ma20']

        # 9. ATR
        df['atr'] = self._calculate_atr(df, 14)

        return df

    def generate_report(self, df: pd.DataFrame) -> str:
        """Generate daily swing trading report"""
        if df.empty or len(df) < 120:
            return "## 📈 일봉 분석\n⚠️ 데이터 부족"

        # Extract latest values
        latest = df.iloc[-1]
        curr_price = latest['close']

        ma5 = latest.get('ma5', 0)
        ma20 = latest.get('ma20', 0)
        ma60 = latest.get('ma60', 0)
        ma120 = latest.get('ma120', 0)
        rsi = latest.get('rsi', 50)
        stoch_k = latest.get('stoch_k', 50)
        stoch_d = latest.get('stoch_d', 50)
        bb_upper = latest.get('bb_upper', 0)
        bb_lower = latest.get('bb_lower', 0)
        disparity = latest.get('disparity', 100)
        obv = latest.get('obv', 0)
        obv_prev = df.iloc[-10]['obv'] if len(df) > 10 else obv
        macd = latest.get('macd', 0)
        macd_signal = latest.get('macd_signal', 0)
        atr = latest.get('atr', 0)

        # Determine trend
        above_ma20 = curr_price > ma20
        above_ma60 = curr_price > ma60

        if above_ma20 and above_ma60:
            trend = "상승 추세"
            trend_icon = "🟢"
        elif above_ma20:
            trend = "중립 (단기 상승)"
            trend_icon = "🟡"
        else:
            trend = "하락 추세"
            trend_icon = "🔴"

        # RSI status
        if rsi > 70:
            rsi_status = "과열"
            rsi_icon = "🔥"
        elif rsi < 30:
            rsi_status = "침체"
            rsi_icon = "💧"
        else:
            rsi_status = "중립"
            rsi_icon = "✅"

        # Divergence
        obv_dir = "↗" if obv > obv_prev else "↘"
        price_dir = "↗" if curr_price > df.iloc[-10]['close'] else "↘"

        if obv_dir == "↗" and price_dir == "↗":
            divergence = "건강"
            div_icon = "✅"
        elif obv_dir == "↘" and price_dir == "↗":
            divergence = "베어리시 다이버전스"
            div_icon = "⚠️"
        else:
            divergence = "중립"
            div_icon = "➖"

        # Strategy
        if above_ma20 and rsi < 70 and stoch_k < 80:
            strategy = "눌림목 매수"
            strategy_icon = "🟢"
        elif above_ma60:
            strategy = "보유 관망"
            strategy_icon = "🟡"
        else:
            strategy = "매도/관망"
            strategy_icon = "🔴"

        # --- Level-based entry/exit ---
        levels = compute_levels(
            df, curr_price,
            ma_values={"5일선": ma5, "20일선": ma20, "60일선": ma60, "120일선": ma120},
            bb_upper=bb_upper, bb_lower=bb_lower,
            swing_window=5,
        )
        plan = pick_entry_stop_target(curr_price, levels["supports"], levels["resistances"], atr)

        # Format support/resistance summary
        sup_str = ", ".join(f"{s['price']:,}({s['type']})" for s in levels["supports"][:3]) or "-"
        res_str = ", ".join(f"{r['price']:,}({r['type']})" for r in levels["resistances"][:3]) or "-"

        report = f"""## 📈 일봉 - 스윙 매매 전략

**{trend_icon} {trend}** | 스윙 트레이딩 (3~10일)

| 이동평균 | 가격 | RSI | Stochastic | 이격도 |
|---------|------|-----|------------|--------|
| 20일 {ma20:,.0f} {"✅" if above_ma20 else "❌"} | {curr_price:,.0f}원 | {rsi:.1f} {rsi_icon} | %K {stoch_k:.0f} | {disparity:.1f}% |

**다이버전스:** {div_icon} {divergence} | **MACD:** {"🟢 골든" if macd > macd_signal else "🔴 데드"}

**지지선:** {sup_str}
**저항선:** {res_str}

**전략:** {strategy_icon} **{strategy}**
- 📥 진입 {plan['entry_low']:,}~{plan['entry_high']:,}원
- ⛔ 손절 {plan['stop_loss']:,}원
- 🎯 목표 {plan['target_1']:,}원 → {plan['target_2']:,}원 → {plan['target_3']:,}원

---
"""
        return report
