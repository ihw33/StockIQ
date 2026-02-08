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
    Analyze recent N-day price volatility and changes.
    
    Args:
        df: OHLCV DataFrame
        days: Number of recent days to analyze
        
    Returns:
        {
            'history': List[Dict],  # Daily close, change%, volume ratio
            'cumulative_change_pct': float,
            'avg_daily_volatility': float,
            'volatility_level': 'NORMAL|MEDIUM|HIGH'
        }
    """
    try:
        if len(df) < days:
            days = len(df)
        
        recent = df.tail(days).copy()
        history = []
        
        for i in range(len(recent)):
            row = recent.iloc[i]
            
            if i == 0:
                pct_change = 0.0
            else:
                prev_close = recent.iloc[i-1]['close']
                pct_change = ((row['close'] - prev_close) / prev_close * 100) if prev_close > 0 else 0.0
            
            # Volume ratio
            if 'volume' in recent.columns:
                vol_avg = recent['volume'].mean()
                vol_ratio = (row['volume'] / vol_avg) if vol_avg > 0 else 1.0
            else:
                vol_ratio = 1.0
            
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
                'volume_ratio': float(vol_ratio)
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
        
        return {
            'history': history,
            'cumulative_change_pct': float(cumulative_change),
            'avg_daily_volatility': float(avg_abs_change),
            'volatility_level': volatility
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
