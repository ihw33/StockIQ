#!/usr/bin/env python3
"""
Direct test of Kiwoom API to diagnose data collection issue
"""
import sys
import os

# Add parent directory to path to import collectors
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from collectors.kiwoom import KiwoomCollector

print("="*60)
print("Kiwoom API Direct Test")
print("="*60)

# Initialize collector
kiwoom = KiwoomCollector()
print(f"\n[Test] KiwoomCollector initialized")
print(f"  - Base URL: {kiwoom.base_url}")
print(f"  - App Key: {kiwoom.app_key[:20] if kiwoom.app_key else 'MISSING'}...")
print(f"  - Secret Key: {'PRESENT' if kiwoom.app_secret else 'MISSING'}")

# Test token
print(f"\n[Test] Getting authentication token...")
token = kiwoom._get_token()
if token:
    print(f"  ✅ Token acquired: {token[:30]}...")
else:
    print(f"  ❌ Token acquisition FAILED!")
    print(f"  → Check API credentials in .env.local")
    sys.exit(1)

# Test data fetch for Samsung (005930)
print(f"\n[Test] Fetching Samsung Electronics (005930) daily data...")
df_daily = kiwoom.get_price_history("005930", "D", 60)
print(f"  Result: {len(df_daily)} rows")
if not df_daily.empty:
    print(f"  Columns: {list(df_daily.columns)}")
    print(f"  Latest close: {df_daily['close'].iloc[-1] if 'close' in df_daily.columns else 'N/A'}")
    print(f"\n  Sample data (last 3 rows):")
    print(df_daily.tail(3))
else:
    print(f"  ❌ Empty DataFrame!")
    print(f"  → Check Kiwoom API status or credentials")

# Test weekly data
print(f"\n[Test] Fetching weekly data...")
df_weekly = kiwoom.get_price_history("005930", "W", 60)
print(f"  Result: {len(df_weekly)} rows")

print("\n" + "="*60)
print("Test Complete")
print("="*60)
