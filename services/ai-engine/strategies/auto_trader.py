
import logging
import time
import math
import os
import asyncio
from collectors.kiwoom import KiwoomCollector
from utils import send_telegram_message
from config.trading_config import config

logger = logging.getLogger(__name__)

class AutoTrader:
    def __init__(self):
        self.kiwoom = KiwoomCollector()
        self.account_no = os.getenv("KIWOOM_ACCOUNT", "")
        self.running = False
        
        if not self.account_no:
            logger.warning("KIWOOM_ACCOUNT not set in env. Auto trading might fail.")

    def check_and_buy(self, symbol: str):
        """
        Executes Buy Logic:
        1. Check if already held (kt00004) -> User Logic: "이미 보유 중입니다." return
        2. Check Balance (kt00001)
        3. Check Ask Price (ka10004)
        4. Calculate Qty (설정된 비율로 매수)
        5. Place Order (kt10000)
        """
        symbol_code = symbol.replace('A', '') # Clean symbol just in case

        # 최대 보유 종목수 체크
        try:
            holdings = self.kiwoom.get_holdings(self.account_no)
            if len(holdings) >= config.max_position_count:
                logger.info(f"Skipping Buy: Max positions reached ({len(holdings)}/{config.max_position_count})")
                return
                
            for stock in holdings:
                if stock['stk_cd'].replace('A', '') == symbol_code:
                    logger.info(f"Skipping Buy: Already holding {symbol_code} ({stock['stk_nm']})")
                    return
        except Exception as e:
            logger.error(f"Error checking holdings: {e}")
            return

        time.sleep(1) # Rate limit safety

        # 2. Check Balance
        try:
            balance = self.kiwoom.get_balance(self.account_no)
        except Exception as e:
            logger.error(f"Error checking balance: {e}")
            return

        # 설정된 비율로 매수 금액 계산
        expense = balance * (config.buy_ratio / 100.0)
        
        # 최소 매수 금액 체크
        if expense < config.min_buy_amount:
            logger.warning(f"Expense {expense} below min amount {config.min_buy_amount}")
            return

        time.sleep(1)

        # 3. Check Ask Price (Hoga)
        try:
            ask_price = self.kiwoom.get_hoga(symbol_code)
        except Exception as e:
            logger.error(f"Error checking hoga: {e}")
            return

        if ask_price <= 0:
            logger.warning(f"Invalid Ask Price for {symbol_code}: {ask_price}")
            return

        # 4. Calculate Qty
        qty = int(expense // ask_price)
        if qty == 0:
            logger.warning(f"Insufficient funds for {symbol_code} (Price: {ask_price}, Alloc: {expense})")
            return
        
        logger.info(f"Buying {symbol_code}: {qty}ea @ {ask_price} (ratio: {config.buy_ratio}%)")

        time.sleep(1)

        # 5. Place Order
        # 주문 타입에 따라 다르게 처리
        if config.buy_order_type == "market":
            # 시장가 주문
            success = self.kiwoom.place_order(self.account_no, symbol_code, qty, 0, 'buy')
        else:
            # 지정가 주문 (기본)
            success = self.kiwoom.place_order(self.account_no, symbol_code, qty, int(ask_price), 'buy')
        
        if success:
            time.sleep(1)
            name = self.kiwoom.get_master_name(symbol_code)
            order_type_kr = "시장가" if config.buy_order_type == "market" else "지정가"
            msg = f"🚀 [자동매수] {name}({symbol_code}) {qty}주 {order_type_kr} 매수 완료"
            logger.info(msg)
            send_telegram_message(msg)
        else:
            logger.error(f"Buy Order Failed for {symbol_code}")

    async def run_sell_loop(self):
        """
        Polls portfolio every 1s and sells if Target/Stop reached.
        """
        logger.info("Starting Sell Loop Monitor...")
        self.running = True
        while self.running:
            try:
                holdings = self.kiwoom.get_holdings(self.account_no)
                if not holdings:
                    await asyncio.sleep(1)
                    continue

                for stock in holdings:
                    try:
                        pl_rt = float(stock['pl_rt'])
                        symbol = stock['stk_cd'].replace('A', '')
                        qty = int(stock['rmnd_qty'])
                        name = stock['stk_nm']
                        
                        if qty <= 0: continue

                        # 종목별 설정 가져오기 (개별 설정 우선, 없으면 전역)
                        stock_config = config.get_stock_config(symbol)
                        target_profit = stock_config['take_profit_rate']
                        stop_loss = stock_config['stop_loss_rate']
                        
                        action = None
                        if pl_rt > target_profit:
                            action = f"익절 (>{target_profit}%)"
                        elif pl_rt < stop_loss:
                            action = f"손절 (<{stop_loss}%)"
                        
                        if action:
                            logger.info(f"Triggering {action} for {name} ({pl_rt}%)")
                            # Sell Market Price (03) -> Price 0
                            success = self.kiwoom.place_order(self.account_no, symbol, qty, 0, 'sell')
                            
                            if success:
                                msg = f"💰 [자동매도] {name} {action} 완료\n수익률: {pl_rt}%"
                                send_telegram_message(msg)
                                
                                # 종목별 개별 설정 초기화
                                config.clear_stock_override(symbol)
                            else:
                                send_telegram_message(f"⚠️ [매도실패] {name} {action} 주문 오류")
                                
                    except ValueError:
                        continue # Parsing error

            except Exception as e:
                logger.error(f"Sell Loop Error: {e}")
            
            await asyncio.sleep(1)

    def stop(self):
        self.running = False
        logger.info("AutoTrader Stopped.")
