"""
Intraday (분봉) analyzer for day trading and scalping.
"""
import pandas as pd
from .base import TimeframeAnalyzer
from .levels import compute_levels, pick_entry_stop_target


class IntradayAnalyzer(TimeframeAnalyzer):
    """
    Intraday chart analysis for day trading and scalping.
    Supports 15m (day trading) and 5m (scalping) timeframes.
    """

    def __init__(self, interval: str):
        """
        Args:
            interval: "15m" or "5m"
        """
        super().__init__(interval)
        self.interval = interval

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate intraday-specific indicators"""
        if df.empty:
            return df

        if self.interval == "15m":
            # 15분봉: 20봉(5시간), 60봉(15시간)
            df['ma20'] = df['close'].rolling(20).mean()
            df['ma60'] = df['close'].rolling(60).mean()
            rsi_period = 14
            stoch_period = 14
        else:  # 5m
            # 5분봉: 12봉(1시간), 24봉(2시간)
            df['ma12'] = df['close'].rolling(12).mean()
            df['ma24'] = df['close'].rolling(24).mean()
            rsi_period = 9  # 더 민감하게
            stoch_period = 5

        # RSI
        df['rsi'] = self._calculate_rsi(df['close'], rsi_period)

        # Stochastic
        k, d = self._calculate_stochastic(df, stoch_period)
        df['stoch_k'] = k
        df['stoch_d'] = d

        # ATR
        df['atr'] = self._calculate_atr(df, 14)

        # Volume Ratio
        df['vol_ma20'] = df['volume'].rolling(20).mean()
        df['vol_ratio'] = df['volume'] / df['vol_ma20']

        # VWAP (intraday only)
        if 'time' in df.columns or 'date' in df.columns:
            cum_vol = df['volume'].cumsum()
            cum_pv = (df['close'] * df['volume']).cumsum()
            df['vwap'] = cum_pv / cum_vol

        return df

    def generate_report(self, df: pd.DataFrame) -> str:
        """Generate intraday trading report"""
        if df.empty:
            return f"## {'⚡' if self.interval == '15m' else '💨'} {self.interval} 분석\n⚠️ 데이터 부족"

        latest = df.iloc[-1]
        curr_price = latest['close']

        if self.interval == "15m":
            return self._generate_15m_report(df, latest, curr_price)
        else:  # 5m
            return self._generate_5m_report(df, latest, curr_price)

    def _generate_15m_report(self, df, latest, curr_price):
        """15분봉 데이 트레이딩 리포트"""
        ma20 = latest.get('ma20', 0)
        ma60 = latest.get('ma60', 0)
        rsi = latest.get('rsi', 50)
        stoch_k = latest.get('stoch_k', 50)
        vwap = latest.get('vwap', curr_price)
        vol_ratio = latest.get('vol_ratio', 1.0)
        atr = latest.get('atr', 0)

        # Trend
        above_ma20 = curr_price > ma20
        above_vwap = curr_price > vwap

        if above_ma20 and above_vwap:
            trend = "상승"
            trend_icon = "🟢"
        elif above_ma20 or above_vwap:
            trend = "중립"
            trend_icon = "🟡"
        else:
            trend = "약세"
            trend_icon = "🔴"

        # Strategy
        if above_vwap and rsi < 70 and stoch_k < 80:
            strategy = "진입 가능"
            strategy_icon = "🟢"
        elif above_ma20:
            strategy = "관망"
            strategy_icon = "🟡"
        else:
            strategy = "대기"
            strategy_icon = "⚪"

        # --- Level-based entry/exit ---
        levels = compute_levels(
            df, curr_price,
            ma_values={"20봉선": ma20, "60봉선": ma60, "VWAP": vwap},
            swing_window=3,
        )
        plan = pick_entry_stop_target(curr_price, levels["supports"], levels["resistances"], atr)

        sup_str = ", ".join(f"{s['price']:,}" for s in levels["supports"][:2]) or "-"
        res_str = ", ".join(f"{r['price']:,}" for r in levels["resistances"][:2]) or "-"

        report = f"""## ⚡ 15분봉 - 데이 트레이딩

**{trend_icon} {trend}** | 당일 매매 (1~3시간)

| MA20 | VWAP | RSI | 거래량 |
|------|------|-----|--------|
| {ma20:,.0f} {"✅" if above_ma20 else "❌"} | {vwap:,.0f} {"✅" if above_vwap else "❌"} | {rsi:.0f} | {vol_ratio:.1f}x {"⚡" if vol_ratio > 2.0 else ""} |

**지지:** {sup_str} | **저항:** {res_str}

**전략:** {strategy_icon} **{strategy}**
- 📥 진입 {plan['entry_low']:,}~{plan['entry_high']:,}원
- ⛔ 손절 {plan['stop_loss']:,}원
- 🎯 목표 {plan['target_1']:,}원 → {plan['target_2']:,}원

---
"""
        return report

    def _generate_5m_report(self, df, latest, curr_price):
        """5분봉 스캘핑 리포트"""
        ma12 = latest.get('ma12', 0)
        ma24 = latest.get('ma24', 0)
        rsi = latest.get('rsi', 50)
        stoch_k = latest.get('stoch_k', 50)
        vol_ratio = latest.get('vol_ratio', 1.0)
        atr = latest.get('atr', 0)

        # Volume spike detection
        is_volume_spike = vol_ratio >= 3.0

        # Strategy
        if is_volume_spike and rsi < 70:
            strategy = "스캘핑 기회"
            strategy_icon = "🔥"
        elif curr_price > ma12:
            strategy = "단기 상승"
            strategy_icon = "🟢"
        else:
            strategy = "대기"
            strategy_icon = "⚪"

        # --- Level-based entry/exit ---
        levels = compute_levels(
            df, curr_price,
            ma_values={"12봉선": ma12, "24봉선": ma24},
            swing_window=3,
        )
        plan = pick_entry_stop_target(curr_price, levels["supports"], levels["resistances"], atr)

        report = f"""## 💨 5분봉 - 스캘핑

**{strategy_icon} {strategy}** | 초단기 (5~15분)

| MA12 | RSI | 거래량 | 신호 |
|------|-----|--------|------|
| {ma12:,.0f} | {rsi:.0f} {"🔥" if rsi > 70 else ""} | **{vol_ratio:.1f}x** | {"⚡⚡⚡ 폭발!" if is_volume_spike else "보통"} |
"""

        if is_volume_spike:
            report += f"""
**스캘핑:** 진입 {plan['entry_high']:,}원 | 손절 {plan['stop_loss']:,}원 | 목표 {plan['target_1']:,}원 (⚠️ 초고수 전용)
"""
        else:
            report += f"""
**대기:** 거래량 3배 이상 폭발 시 진입 | 손절 {plan['stop_loss']:,}원 | 목표 {plan['target_1']:,}원
"""

        report += "\n---\n"
        return report
