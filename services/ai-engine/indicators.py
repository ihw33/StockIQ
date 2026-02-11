"""
Market stress detection and volatility analysis functions.
"""
import pandas as pd
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


def detect_market_stress(df: pd.DataFrame) -> Dict:
    """
    Detect abnormal market conditions based on volatility and price action.
    
    Args:
        df: OHLCV DataFrame with indicators (ATR, RSI, volume)
        
    Returns:
        {
            'is_stressed': bool,
            'stress_level': 'LOW|MEDIUM|HIGH|EXTREME',
            'stress_score': int (0-100),
            'reasons': List[str]
        }
    """
    reasons = []
    stress_score = 0
    
    try:
        # 1. ATR-based volatility spike detection
        if 'atr' in df.columns:
            atr_current = df['atr'].iloc[-1]
            atr_avg = df['atr'].rolling(60).mean().iloc[-1]
            
            if pd.notna(atr_current) and pd.notna(atr_avg) and atr_avg > 0:
                atr_ratio = atr_current / atr_avg
                if atr_ratio > 2.0:
                    stress_score += 40
                    reasons.append(f'일중 변동성 극심 (ATR {atr_ratio:.1f}배)')
                elif atr_ratio > 1.5:
                    stress_score += 30
                    reasons.append(f'일중 변동성 급등 (ATR {atr_ratio:.1f}배)')
        
        # 2. Recent 5-day volatility
        if len(df) >= 5:
            recent_5d = df['close'].iloc[-5:]
            pct_changes = recent_5d.pct_change().abs()
            large_moves = (pct_changes > 0.03).sum()  # >3% moves
            
            if large_moves >= 4:
                stress_score += 35
                reasons.append(f'최근 5일간 극심한 급변동 ({large_moves}일 3% 초과)')
            elif large_moves >= 3:
                stress_score += 25
                reasons.append(f'최근 5일간 급변동 ({large_moves}일 3% 초과)')
        
        # 3. VI (Volatility Interruption) estimation
        # Detect sudden volume spike + price spike (proxy for VI)
        if len(df) >= 20 and 'volume' in df.columns:
            vol_avg = df['volume'].rolling(20).mean().iloc[-1]
            vol_current = df['volume'].iloc[-1]
            
            if pd.notna(vol_avg) and vol_avg > 0:
                vol_ratio = vol_current / vol_avg
                price_change = abs(df['close'].pct_change().iloc[-1])
                
                if vol_ratio > 3 and price_change > 0.02:
                    stress_score += 25
                    reasons.append('VI 발동 의심 (거래량 3배 + 급변동 2%)')
        
        # 4. RSI extreme levels
        if 'rsi' in df.columns:
            rsi = df['rsi'].iloc[-1]
            if pd.notna(rsi):
                if rsi > 85 or rsi < 15:
                    stress_score += 20
                    reasons.append(f'RSI 극단치 ({rsi:.1f})')
                elif rsi > 80 or rsi < 20:
                    stress_score += 10
                    reasons.append(f'RSI 과열/침체 ({rsi:.1f})')
        
        # Determine stress level
        if stress_score >= 70:
            level = 'EXTREME'
        elif stress_score >= 50:
            level = 'HIGH'
        elif stress_score >= 30:
            level = 'MEDIUM'
        else:
            level = 'LOW'
        
        return {
            'is_stressed': stress_score >= 30,
            'stress_level': level,
            'stress_score': stress_score,
            'reasons': reasons
        }
        
    except Exception as e:
        logger.error(f"Error in detect_market_stress: {e}")
        return {
            'is_stressed': False,
            'stress_level': 'LOW',
            'stress_score': 0,
            'reasons': []
        }


def analyze_recent_volatility(df: pd.DataFrame, days: int = 5) -> Dict:
    """
    Analyze recent N-day price volatility, volume, and trading patterns.

    Args:
        df: OHLCV DataFrame (full history for baseline calculation)
        days: Number of recent days to analyze

    Returns:
        {
            'history': List[Dict],  # Daily data with volume, trade amount
            'cumulative_change_pct': float,
            'avg_daily_volatility': float,
            'volatility_level': 'NORMAL|MEDIUM|HIGH',
            'volume_level': str,  # Volume level assessment
            'volume_trend': str,  # Volume trend
            'avg_trade_amount': float,  # Average trade amount (5 days)
            'trade_amount_trend': str,  # Trade amount trend
            'buying_pressure': float  # Estimated buying pressure (0-100, 추정치)
        }
    """
    try:
        if len(df) < days:
            days = len(df)

        recent = df.tail(days).copy()

        # Calculate 20-day volume average for baseline (from full df)
        if len(df) >= 20 and 'volume' in df.columns:
            vol_20d_avg = df.tail(20)['volume'].mean()
        else:
            vol_20d_avg = recent['volume'].mean() if 'volume' in recent.columns else 1

        # Calculate recent 5-day volume average
        vol_5d_avg = recent['volume'].mean() if 'volume' in recent.columns else 1

        history = []
        up_volume = 0  # Volume on up days
        down_volume = 0  # Volume on down days
        trade_amounts = []

        for i in range(len(recent)):
            row = recent.iloc[i]

            if i == 0:
                pct_change = 0.0
            else:
                prev_close = recent.iloc[i-1]['close']
                pct_change = ((row['close'] - prev_close) / prev_close * 100) if prev_close > 0 else 0.0

            # Volume metrics
            if 'volume' in recent.columns:
                volume = row['volume']
                vol_ratio_20d = (volume / vol_20d_avg) if vol_20d_avg > 0 else 1.0
                trade_amount = row['close'] * volume / 1e8  # 억원 단위
                trade_amounts.append(trade_amount)

                # Accumulate volume by direction for buying pressure
                if pct_change > 0:
                    up_volume += volume
                elif pct_change < 0:
                    down_volume += volume
            else:
                volume = 0
                vol_ratio_20d = 1.0
                trade_amount = 0

            # Date formatting
            try:
                if hasattr(row.name, 'strftime'):
                    date_str = row.name.strftime('%m-%d')
                else:
                    date_str = f'D-{days-i-1}'
            except:
                date_str = f'D-{days-i-1}'

            history.append({
                'date': date_str,
                'close': float(row['close']),
                'change_pct': float(pct_change),
                'volume': int(volume),
                'volume_ratio': float(vol_ratio_20d),
                'trade_amount': float(trade_amount)
            })

        # Cumulative change
        cumulative_change = ((recent['close'].iloc[-1] - recent['close'].iloc[0]) / recent['close'].iloc[0] * 100) if recent['close'].iloc[0] > 0 else 0.0

        # Average absolute daily change
        changes = [abs(h['change_pct']) for h in history[1:]]  # Skip first day
        avg_abs_change = sum(changes) / len(changes) if changes else 0.0

        # Volatility level
        if avg_abs_change > 2.5:
            volatility = 'HIGH'
        elif avg_abs_change > 1.5:
            volatility = 'MEDIUM'
        else:
            volatility = 'NORMAL'

        # Volume level assessment (5-day avg vs 20-day avg)
        vol_ratio = (vol_5d_avg / vol_20d_avg) if vol_20d_avg > 0 else 1.0
        if vol_ratio > 1.5:
            volume_level = '높음'
        elif vol_ratio > 0.8:
            volume_level = '보통'
        else:
            volume_level = '낮음'

        # Volume trend (first 3 days vs last 3 days)
        if len(history) >= 3:
            early_vol = sum(h['volume'] for h in history[:3]) / 3
            late_vol = sum(h['volume'] for h in history[-3:]) / 3
            vol_change = ((late_vol - early_vol) / early_vol * 100) if early_vol > 0 else 0
            if vol_change > 20:
                volume_trend = '증가 중'
            elif vol_change < -20:
                volume_trend = '감소 중'
            else:
                volume_trend = '보합'
        else:
            volume_trend = '보합'

        # Average trade amount
        avg_trade_amount = sum(trade_amounts) / len(trade_amounts) if trade_amounts else 0

        # Trade amount trend
        if len(trade_amounts) >= 3:
            early_amt = sum(trade_amounts[:3]) / 3
            late_amt = sum(trade_amounts[-3:]) / 3
            amt_change = ((late_amt - early_amt) / early_amt * 100) if early_amt > 0 else 0
            if amt_change > 20:
                trade_amount_trend = '증가 중'
            elif amt_change < -20:
                trade_amount_trend = '감소 중'
            else:
                trade_amount_trend = '보합'
        else:
            trade_amount_trend = '보합'

        # Buying pressure (체결강도 추정)
        # 상승일 거래량 / (상승일 + 하락일 거래량) * 100
        total_directional_volume = up_volume + down_volume
        if total_directional_volume > 0:
            buying_pressure = (up_volume / total_directional_volume) * 100
        else:
            buying_pressure = 50.0  # Neutral

        return {
            'history': history,
            'cumulative_change_pct': float(cumulative_change),
            'avg_daily_volatility': float(avg_abs_change),
            'volatility_level': volatility,
            'volume_level': volume_level,
            'volume_trend': volume_trend,
            'avg_trade_amount': float(avg_trade_amount),
            'trade_amount_trend': trade_amount_trend,
            'buying_pressure': float(buying_pressure)
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_recent_volatility: {e}")
        return {
            'history': [],
            'cumulative_change_pct': 0.0,
            'avg_daily_volatility': 0.0,
            'volatility_level': 'NORMAL'
        }


def should_disable_strategy(timeframe: str, market_stress: Dict) -> Dict:
    """
    Determine if a strategy should be disabled based on market stress.
    
    Args:
        timeframe: 'W', 'D', '15m', '5m'
        market_stress: Output from detect_market_stress()
        
    Returns:
        {
            'enabled': bool,
            'reason': str
        }
    """
    stress_level = market_stress['stress_level']
    
    # Weekly: Always enabled (long-term unaffected by short-term stress)
    if timeframe == 'W':
        return {
            'enabled': True,
            'reason': ''
        }
    
    # Daily: Always enabled but with warnings
    if timeframe == 'D':
        if stress_level == 'EXTREME':
            return {
                'enabled': True,
                'reason': '⚠️ 극심한 변동성 - 분할 진입 필수'
            }
        elif stress_level == 'HIGH':
            return {
                'enabled': True,
                'reason': '⚠️ 높은 변동성 - 확인 진입 권장'
            }
        return {
            'enabled': True,
            'reason': ''
        }
    
    # 15-minute: Disable on EXTREME
    if timeframe == '15m':
        if stress_level == 'EXTREME':
            return {
                'enabled': False,
                'reason': '⚠️ 시장 극심한 스트레스 - 데이트레이딩 부적합'
            }
        elif stress_level == 'HIGH':
            return {
                'enabled': True,
                'reason': '⚠️ 높은 변동성 - 손절 타이트하게 설정'
            }
        return {
            'enabled': True,
            'reason': ''
        }
    
    # 5-minute: Disable on HIGH or EXTREME
    if timeframe == '5m':
        if stress_level in ['EXTREME', 'HIGH']:
            return {
                'enabled': False,
                'reason': f'⚠️ {stress_level} 변동성 - 스캘핑 부적합'
            }
        elif stress_level == 'MEDIUM':
            return {
                'enabled': True,
                'reason': '⚠️ 변동성 주의 - 거래량 확인 필수'
            }
        return {
            'enabled': True,
            'reason': ''
        }
    
    # Default: enabled
    return {
        'enabled': True,
        'reason': ''
    }


def get_all_strategy_status(market_stress: Dict) -> Dict[str, Dict]:
    """
    Get strategy status for all timeframes.
    
    Args:
        market_stress: Output from detect_market_stress()
        
    Returns:
        Dict mapping timeframe to status dict
    """
    timeframes = ['W', 'D', '15m', '5m']
    return {
        tf: should_disable_strategy(tf, market_stress)
        for tf in timeframes
    }
