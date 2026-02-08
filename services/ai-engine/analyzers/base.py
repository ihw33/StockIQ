"""
Base class for timeframe-specific technical analysis.
"""
from typing import Dict
import pandas as pd
from abc import ABC, abstractmethod


class TimeframeAnalyzer(ABC):
    """
    Abstract base class for timeframe-specific analysis.
    Each subclass implements indicators and report generation for a specific timeframe.
    """
    
    def __init__(self, timeframe: str):
        self.timeframe = timeframe  # "W", "D", "15m", "5m"
    
    @abstractmethod
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate technical indicators optimized for this timeframe.
        
        Args:
            df: OHLCV DataFrame
            
        Returns:
            DataFrame with calculated indicators added as columns
        """
        pass
    
    @abstractmethod
    def generate_report(self, df: pd.DataFrame) -> str:
        """
        Generate a markdown report based on the analyzed data.
        
        Args:
            df: DataFrame with indicators already calculated
            
        Returns:
            Markdown-formatted analysis report
        """
        pass
    
    # Common helper methods
    def _calculate_rsi(self, series: pd.Series, period: int = 14) -> pd.Series:
        """Calculate RSI using Wilder's method"""
        delta = series.diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        avg_gain = gain.ewm(com=period-1, adjust=False, min_periods=period).mean()
        avg_loss = loss.ewm(com=period-1, adjust=False, min_periods=period).mean()
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
    
    def _calculate_stochastic(self, df: pd.DataFrame, period: int = 14) -> tuple:
        """Calculate Stochastic Oscillator (%K, %D)"""
        low_min = df['low'].rolling(period).min()
        high_max = df['high'].rolling(period).max()
        k = 100 * (df['close'] - low_min) / (high_max - low_min)
        d = k.rolling(3).mean()
        return k, d
    
    def _calculate_obv(self, df: pd.DataFrame) -> pd.Series:
        """Calculate On-Balance Volume"""
        obv = (df['volume'] * (~df['close'].diff().le(0) * 2 - 1)).cumsum()
        return obv
    
    def _calculate_macd(self, series: pd.Series, fast=12, slow=26, signal=9) -> tuple:
        """Calculate MACD (line, signal, histogram)"""
        exp1 = series.ewm(span=fast, adjust=False).mean()
        exp2 = series.ewm(span=slow, adjust=False).mean()
        macd_line = exp1 - exp2
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate Average True Range"""
        high_low = df['high'] - df['low']
        high_close = (df['high'] - df['close'].shift()).abs()
        low_close = (df['low'] - df['close'].shift()).abs()
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return tr.rolling(period).mean()
    
    def _calculate_bollinger_bands(self, series: pd.Series, period: int = 20, std: float = 2) -> tuple:
        """Calculate Bollinger Bands (upper, middle, lower)"""
        middle = series.rolling(period).mean()
        std_dev = series.rolling(period).std()
        upper = middle + (std_dev * std)
        lower = middle - (std_dev * std)
        return upper, middle, lower
