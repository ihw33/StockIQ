"""
Support/Resistance level detection from price data.
Finds swing highs/lows, clusters them, adds MAs, Bollinger Bands,
Fibonacci retracements, and psychological price levels.
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Optional


def find_swing_points(df: pd.DataFrame, window: int = 5) -> Dict[str, List[float]]:
    """
    Detect swing highs and lows from OHLCV data.
    A swing high: high[i] is the max within ±window bars.
    A swing low: low[i] is the min within ±window bars.
    """
    highs = []
    lows = []
    n = len(df)
    if n < window * 2 + 1:
        return {"highs": highs, "lows": lows}

    high_vals = df['high'].values
    low_vals = df['low'].values

    for i in range(window, n - window):
        # Swing high
        if high_vals[i] == max(high_vals[i - window:i + window + 1]):
            highs.append(float(high_vals[i]))
        # Swing low
        if low_vals[i] == min(low_vals[i - window:i + window + 1]):
            lows.append(float(low_vals[i]))

    return {"highs": highs, "lows": lows}


def cluster_levels(prices: List[float], tolerance_pct: float = 1.5) -> List[Dict]:
    """
    Cluster nearby price levels and count touches.
    Returns sorted list of {price, touches} where price is the cluster center.
    """
    if not prices:
        return []

    sorted_prices = sorted(prices)
    clusters = []
    current_cluster = [sorted_prices[0]]

    for p in sorted_prices[1:]:
        center = np.mean(current_cluster)
        if abs(p - center) / center * 100 <= tolerance_pct:
            current_cluster.append(p)
        else:
            clusters.append({
                "price": round(float(np.mean(current_cluster))),
                "touches": len(current_cluster),
            })
            current_cluster = [p]

    # Last cluster
    if current_cluster:
        clusters.append({
            "price": round(float(np.mean(current_cluster))),
            "touches": len(current_cluster),
        })

    return clusters


def get_psychological_levels(current_price: float) -> List[float]:
    """
    Generate psychological price levels (round numbers) near current price.
    e.g., 6,380원 → [5000, 6000, 7000, 8000, 10000]
    """
    levels = []
    if current_price <= 0:
        return levels

    # Determine step size based on price magnitude
    if current_price < 1000:
        steps = [100, 500]
    elif current_price < 5000:
        steps = [500, 1000]
    elif current_price < 20000:
        steps = [1000, 5000]
    elif current_price < 100000:
        steps = [5000, 10000, 50000]
    elif current_price < 500000:
        steps = [10000, 50000, 100000]
    else:
        steps = [50000, 100000, 500000]

    for step in steps:
        base = int(current_price / step) * step
        for mult in range(-3, 5):
            level = base + mult * step
            if level > 0 and abs(level - current_price) / current_price < 0.30:
                levels.append(float(level))

    return sorted(set(levels))


def get_fibonacci_levels(high: float, low: float) -> List[Dict]:
    """
    Fibonacci retracement levels between a swing high and low.
    """
    if high <= low or high <= 0:
        return []

    diff = high - low
    ratios = [
        (0.0, "고점"),
        (0.236, "23.6%"),
        (0.382, "38.2%"),
        (0.500, "50%"),
        (0.618, "61.8%"),
        (0.786, "78.6%"),
        (1.0, "저점"),
    ]

    return [
        {"price": round(high - diff * ratio), "label": label}
        for ratio, label in ratios
    ]


def compute_levels(
    df: pd.DataFrame,
    current_price: float,
    ma_values: Optional[Dict[str, float]] = None,
    bb_upper: Optional[float] = None,
    bb_lower: Optional[float] = None,
    swing_window: int = 5,
) -> Dict:
    """
    Main function: compute all support/resistance levels for a stock.

    Returns:
        {
            "supports": [{"price", "type", "strength"}],  # below current, sorted desc
            "resistances": [{"price", "type", "strength"}],  # above current, sorted asc
            "fibonacci": [{"price", "label"}],
        }
    """
    all_levels = []  # List of {"price", "type", "strength"}

    # 1. Swing highs/lows → cluster
    swings = find_swing_points(df, window=swing_window)
    high_clusters = cluster_levels(swings["highs"])
    low_clusters = cluster_levels(swings["lows"])

    for c in high_clusters:
        strength = min(c["touches"], 5)  # cap at 5
        all_levels.append({"price": c["price"], "type": f"전고점({c['touches']}회)", "strength": strength})
    for c in low_clusters:
        strength = min(c["touches"], 5)
        all_levels.append({"price": c["price"], "type": f"전저점({c['touches']}회)", "strength": strength})

    # 2. Moving averages
    if ma_values:
        for name, val in ma_values.items():
            if val and val > 0:
                all_levels.append({"price": round(val), "type": f"{name}", "strength": 3})

    # 3. Bollinger Bands
    if bb_upper and bb_upper > 0:
        all_levels.append({"price": round(bb_upper), "type": "BB상단", "strength": 2})
    if bb_lower and bb_lower > 0:
        all_levels.append({"price": round(bb_lower), "type": "BB하단", "strength": 2})

    # 4. Psychological levels
    for p in get_psychological_levels(current_price):
        all_levels.append({"price": round(p), "type": "심리적", "strength": 1})

    # 5. Fibonacci (from recent highest high to lowest low in data)
    fib_levels = []
    if not df.empty and len(df) >= 20:
        recent = df.tail(min(len(df), 60))
        period_high = float(recent['high'].max())
        period_low = float(recent['low'].min())
        fib_levels = get_fibonacci_levels(period_high, period_low)
        for fl in fib_levels:
            all_levels.append({"price": fl["price"], "type": f"피보나치 {fl['label']}", "strength": 2})

    # Deduplicate: merge levels within 0.5% of each other, keep highest strength
    all_levels.sort(key=lambda x: x["price"])
    merged = []
    for lvl in all_levels:
        if merged and abs(lvl["price"] - merged[-1]["price"]) / max(merged[-1]["price"], 1) < 0.005:
            # Merge: keep higher strength, combine type
            if lvl["strength"] > merged[-1]["strength"]:
                merged[-1]["strength"] = lvl["strength"]
            if lvl["type"] not in merged[-1]["type"]:
                merged[-1]["type"] += f"+{lvl['type']}"
        else:
            merged.append(dict(lvl))

    # Split into supports (below current) and resistances (above current)
    supports = [l for l in merged if l["price"] < current_price * 0.995]
    resistances = [l for l in merged if l["price"] > current_price * 1.005]

    # Sort: supports descending (nearest first), resistances ascending (nearest first)
    supports.sort(key=lambda x: x["price"], reverse=True)
    resistances.sort(key=lambda x: x["price"])

    return {
        "supports": supports[:8],  # top 8 nearest
        "resistances": resistances[:8],
        "fibonacci": fib_levels,
    }


def pick_entry_stop_target(
    current_price: float,
    supports: List[Dict],
    resistances: List[Dict],
    atr: float = 0,
) -> Dict:
    """
    Pick practical entry, stop-loss, and multi-target prices from levels.

    Returns:
        {
            "entry_low": float,    # 분할매수 하단
            "entry_high": float,   # 분할매수 상단
            "stop_loss": float,    # 손절
            "target_1": float,     # 1차 목표 (가장 가까운 저항)
            "target_2": float,     # 2차 목표
            "target_3": float,     # 3차 목표
        }
    """
    # Default fallbacks (ATR-based, only if no levels found)
    fallback_sl = current_price - atr * 2 if atr > 0 else current_price * 0.95
    fallback_tp = current_price * 1.05

    # --- Stop Loss ---
    # Nearest strong support below, with small buffer
    if supports:
        # Pick the strongest among top 3 nearest
        top_supports = sorted(supports[:3], key=lambda x: x["strength"], reverse=True)
        sl_level = top_supports[0]["price"]
        # Buffer: 1% below the support or 0.5 ATR
        buffer = atr * 0.5 if atr > 0 else sl_level * 0.01
        stop_loss = round(sl_level - buffer)
    else:
        stop_loss = round(fallback_sl)

    # --- Entry ---
    # Entry range: between nearest support and current price
    if supports:
        nearest_support = supports[0]["price"]
        entry_low = round(nearest_support + (current_price - nearest_support) * 0.3)
        entry_high = round(current_price)
    else:
        entry_low = round(current_price * 0.98)
        entry_high = round(current_price)

    # --- Targets (multi-stage) ---
    targets = []
    for r in resistances:
        if r["price"] > current_price * 1.005:  # at least 0.5% above
            targets.append(r["price"])
        if len(targets) >= 3:
            break

    # Fill missing targets
    while len(targets) < 3:
        last = targets[-1] if targets else current_price
        targets.append(round(last * 1.05))

    return {
        "entry_low": entry_low,
        "entry_high": entry_high,
        "stop_loss": stop_loss,
        "target_1": round(targets[0]),
        "target_2": round(targets[1]),
        "target_3": round(targets[2]),
    }
