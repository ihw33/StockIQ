import asyncio
import logging
import os
import signal
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env.local'))

from telegram import Update
from telegram.ext import Application, ContextTypes, CommandHandler, MessageHandler, filters
from collectors.kiwoom_condition import KiwoomConditionCollector
from strategies.auto_trader import AutoTrader
from utils import send_telegram_message
from utils.menu_handlers import (
    get_state, reset_state,
    render_main_menu, render_holdings_menu, render_stock_detail,
    render_value_select, render_new_buy_settings, render_global_settings,
    render_order_type_select, parse_value_input
)
from config.trading_config import config

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("AutoMain")

# Global Instances
collector = None
trader = None
application = None
telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")

# 캐시: 보유 종목 리스트 (메뉴 탐색용)
cached_holdings = []

# --- Command Handlers ---

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/start: Start Auto Trading"""
    global trader, collector
    if trader and not trader.running:
        trader.running = True
        asyncio.create_task(trader.run_sell_loop())
        asyncio.create_task(collector.run())
        await update.message.reply_text("🚀 자동매매 시스템을 시작합니다.\n(조건검색 + 자동손익절 감시 중)")
    else:
        await update.message.reply_text("✅ 이미 작동 중입니다.")

async def stop_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/stop: Stop Auto Trading"""
    global trader
    if trader and trader.running:
        trader.stop()
        await update.message.reply_text("🛑 자동매매 시스템을 중지합니다.\n(매수/매도 로직 정지)")
    else:
        await update.message.reply_text("이미 정지 상태입니다.")

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/status: Check Account Status"""
    global trader
    try:
        balance = trader.kiwoom.get_balance(trader.account_no)
        holdings = trader.kiwoom.get_holdings(trader.account_no)
        
        msg = f"📊 *계좌 현황*\n예수금: {balance:,}원\n\n*보유 종목*:\n"
        if not holdings:
            msg += "없음"
        else:
            for h in holdings:
                name = h.get('stk_nm', 'N/A')
                qty = int(h.get('rmnd_qty', 0))
                ret = float(h.get('pl_rt', 0))
                msg += f"• {name}: {qty}주 ({ret}%)\n"
        
        await update.message.reply_text(msg, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Status command error: {e}")
        await update.message.reply_text(f"❌ 조회 실패: {e}")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/help: Show Commands"""
    msg = (
        "🤖 *StockIQ Bot 명령어*\n\n"
        "/start - 자동매매 시작\n"
        "/stop - 자동매매 중지\n"
        "/status - 계좌 현황 조회\n"
        "/m - 설정 메뉴\n"
        "/help - 도움말"
    )
    await update.message.reply_text(msg, parse_mode='Markdown')


# --- Menu Command (/m) ---

async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/m: Interactive Menu"""
    user_id = update.effective_user.id
    reset_state(user_id)
    await update.message.reply_text(render_main_menu())


async def handle_menu_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """일반 메시지로 들어오는 메뉴 입력 처리"""
    global trader, cached_holdings
    
    user_id = update.effective_user.id
    state = get_state(user_id)
    text = update.message.text.strip()
    
    # 메뉴 상태에 따른 분기
    menu = state.get("menu", "main")
    
    # ===== 메인 메뉴 =====
    if menu == "main":
        if text == "0":
            reset_state(user_id)
            await update.message.reply_text("👋 메뉴를 종료합니다.")
            return
        elif text == "1":
            # 보유 종목 관리
            try:
                cached_holdings = trader.kiwoom.get_holdings(trader.account_no)
            except:
                cached_holdings = []
            state["menu"] = "holdings"
            await update.message.reply_text(render_holdings_menu(cached_holdings))
        elif text == "2":
            # 신규 매수 설정
            state["menu"] = "new_buy"
            await update.message.reply_text(render_new_buy_settings())
        elif text == "3":
            # 전체 설정
            state["menu"] = "global"
            await update.message.reply_text(render_global_settings())
        elif text == "4":
            # 현재 상태 조회
            state["menu"] = "status"
            await update.message.reply_text(config.to_summary())
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.\n\n" + render_main_menu())
    
    # ===== 보유 종목 목록 =====
    elif menu == "holdings":
        if text == "0":
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
            return
        
        try:
            idx = int(text) - 1
            if 0 <= idx < len(cached_holdings):
                stock = cached_holdings[idx]
                symbol = stock['stk_cd'].replace('A', '')
                state["menu"] = "stock_detail"
                state["selected_stock"] = symbol
                state["selected_stock_info"] = stock
                await update.message.reply_text(render_stock_detail(stock, symbol))
            else:
                await update.message.reply_text("❌ 잘못된 번호입니다.")
        except ValueError:
            await update.message.reply_text("❌ 숫자를 입력해주세요.")
    
    # ===== 종목 상세 =====
    elif menu == "stock_detail":
        symbol = state.get("selected_stock")
        stock_info = state.get("selected_stock_info", {})
        
        if text == "0":
            state["menu"] = "holdings"
            await update.message.reply_text(render_holdings_menu(cached_holdings))
            return
        elif text == "1":
            # 익절 기준 변경
            state["menu"] = "stock_tpr"
            stock_cfg = config.get_stock_config(symbol)
            await update.message.reply_text(
                render_value_select("익절 기준", stock_cfg['take_profit_rate'])
            )
        elif text == "2":
            # 손절 기준 변경
            state["menu"] = "stock_slr"
            stock_cfg = config.get_stock_config(symbol)
            await update.message.reply_text(
                render_value_select("손절 기준", abs(stock_cfg['stop_loss_rate']), "stop_loss")
            )
        elif text == "3":
            # 즉시 매도 (시장가)
            state["menu"] = "confirm_sell"
            name = stock_info.get('stk_nm', symbol)
            qty = int(stock_info.get('rmnd_qty', 0))
            await update.message.reply_text(
                f"🔴 {name} {qty}주 시장가 매도\n\n"
                f"1. 확인 (매도 실행)\n"
                f"0. 취소\n\n"
                f"👉 번호:"
            )
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 즉시 매도 확인 =====
    elif menu == "confirm_sell":
        symbol = state.get("selected_stock")
        stock_info = state.get("selected_stock_info", {})
        
        if text == "1":
            # 매도 실행
            qty = int(stock_info.get('rmnd_qty', 0))
            name = stock_info.get('stk_nm', symbol)
            try:
                success = trader.kiwoom.place_order(trader.account_no, symbol, qty, 0, 'sell')
                if success:
                    await update.message.reply_text(f"✅ {name} {qty}주 시장가 매도 주문 완료")
                    send_telegram_message(f"🔴 [수동매도] {name} {qty}주 시장가 매도")
                else:
                    await update.message.reply_text(f"❌ 매도 주문 실패")
            except Exception as e:
                await update.message.reply_text(f"❌ 오류: {e}")
            
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        else:
            # 취소
            state["menu"] = "stock_detail"
            await update.message.reply_text(render_stock_detail(stock_info, symbol))
    
    # ===== 종목별 익절 설정 =====
    elif menu == "stock_tpr":
        symbol = state.get("selected_stock")
        stock_info = state.get("selected_stock_info", {})
        
        if text == "6":
            await update.message.reply_text("익절 기준을 직접 입력해주세요 (예: 8):")
            return
        
        val = parse_value_input(text)
        if val is not None:
            config.set_stock_override(symbol, "take_profit_rate", val)
            name = stock_info.get('stk_nm', symbol)
            await update.message.reply_text(f"✅ {name} 익절 기준이 {val}%로 변경되었습니다.")
            state["menu"] = "stock_detail"
            await update.message.reply_text(render_stock_detail(stock_info, symbol))
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다. 1~5번 또는 숫자를 입력해주세요.")
    
    # ===== 종목별 손절 설정 =====
    elif menu == "stock_slr":
        symbol = state.get("selected_stock")
        stock_info = state.get("selected_stock_info", {})
        
        if text == "6":
            await update.message.reply_text("손절 기준을 직접 입력해주세요 (예: 3):")
            return
        
        val = parse_value_input(text, "stop_loss")
        if val is not None:
            config.set_stock_override(symbol, "stop_loss_rate", -val)  # 음수로 저장
            name = stock_info.get('stk_nm', symbol)
            await update.message.reply_text(f"✅ {name} 손절 기준이 -{val}%로 변경되었습니다.")
            state["menu"] = "stock_detail"
            await update.message.reply_text(render_stock_detail(stock_info, symbol))
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 신규 매수 설정 =====
    elif menu == "new_buy":
        if text == "0":
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        elif text == "1":
            state["menu"] = "set_buy_ratio"
            await update.message.reply_text(render_value_select("매수 비율", config.buy_ratio))
        elif text == "2":
            state["menu"] = "set_global_tpr"
            await update.message.reply_text(render_value_select("익절 기준", config.take_profit_rate))
        elif text == "3":
            state["menu"] = "set_global_slr"
            await update.message.reply_text(render_value_select("손절 기준", abs(config.stop_loss_rate), "stop_loss"))
        elif text == "4":
            state["menu"] = "set_order_type"
            await update.message.reply_text(render_order_type_select())
        elif text == "5":
            state["menu"] = "set_condition"
            await update.message.reply_text(f"현재 조건식: {config.condition_seq}번\n\n조건식 번호를 입력하세요:")
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 현재 상태 =====
    elif menu == "status":
        if text == "0":
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다. 0을 입력해주세요.")
    
    # ===== 전체 설정 =====
    elif menu == "global":
        if text == "0":
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        elif text == "1":
            state["menu"] = "set_buy_ratio"
            await update.message.reply_text(render_value_select("매수 비율", config.buy_ratio))
        elif text == "2":
            state["menu"] = "set_global_tpr"
            await update.message.reply_text(render_value_select("익절 기준", config.take_profit_rate))
        elif text == "3":
            state["menu"] = "set_global_slr"
            await update.message.reply_text(render_value_select("손절 기준", abs(config.stop_loss_rate), "stop_loss"))
        elif text == "4":
            state["menu"] = "set_order_type"
            await update.message.reply_text(render_order_type_select())
        elif text == "5":
            state["menu"] = "set_max_pos"
            await update.message.reply_text(f"현재 최대 종목수: {config.max_position_count}개\n\n숫자를 입력하세요:")
        elif text == "6":
            state["menu"] = "set_min_amt"
            amt = int(config.min_buy_amount / 10000)
            await update.message.reply_text(f"현재 최소 금액: {amt}만원\n\n만원 단위로 입력하세요 (예: 10):")
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 매수 비율 설정 =====
    elif menu == "set_buy_ratio":
        if text == "6":
            await update.message.reply_text("매수 비율을 직접 입력해주세요 (예: 8):")
            return
        val = parse_value_input(text)
        if val is not None:
            config.buy_ratio = val
            await update.message.reply_text(f"✅ 매수 비율이 {val}%로 변경되었습니다.")
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 전역 익절 설정 =====
    elif menu == "set_global_tpr":
        if text == "6":
            await update.message.reply_text("익절 기준을 직접 입력해주세요 (예: 8):")
            return
        val = parse_value_input(text)
        if val is not None:
            config.take_profit_rate = val
            await update.message.reply_text(f"✅ 익절 기준이 +{val}%로 변경되었습니다.")
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 전역 손절 설정 =====
    elif menu == "set_global_slr":
        if text == "6":
            await update.message.reply_text("손절 기준을 직접 입력해주세요 (예: 3):")
            return
        val = parse_value_input(text, "stop_loss")
        if val is not None:
            config.stop_loss_rate = -val
            await update.message.reply_text(f"✅ 손절 기준이 -{val}%로 변경되었습니다.")
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        else:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 주문 타입 설정 =====
    elif menu == "set_order_type":
        if text == "1":
            config.buy_order_type = "limit"
            await update.message.reply_text("✅ 주문 타입이 지정가로 변경되었습니다.")
        elif text == "2":
            config.buy_order_type = "market"
            await update.message.reply_text("✅ 주문 타입이 시장가로 변경되었습니다.")
        else:
            await update.message.reply_text("❌ 1 또는 2를 입력해주세요.")
            return
        state["menu"] = "main"
        await update.message.reply_text(render_main_menu())
    
    # ===== 조건식 번호 설정 =====
    elif menu == "set_condition":
        try:
            seq = text.strip()
            config.condition_seq = seq
            if collector:
                collector.condition_seq = seq
            await update.message.reply_text(f"✅ 조건식이 {seq}번으로 변경되었습니다.")
            state["menu"] = "main"
            await update.message.reply_text(render_main_menu())
        except:
            await update.message.reply_text("❌ 잘못된 입력입니다.")
    
    # ===== 최대 종목수 설정 =====
    elif menu == "set_max_pos":
        try:
            val = int(text)
            if 1 <= val <= 50:
                config.max_position_count = val
                await update.message.reply_text(f"✅ 최대 종목수가 {val}개로 변경되었습니다.")
                state["menu"] = "main"
                await update.message.reply_text(render_main_menu())
            else:
                await update.message.reply_text("❌ 1~50 사이 숫자를 입력해주세요.")
        except:
            await update.message.reply_text("❌ 숫자를 입력해주세요.")
    
    # ===== 최소 금액 설정 =====
    elif menu == "set_min_amt":
        try:
            val = int(text)
            if 1 <= val <= 1000:
                config.min_buy_amount = val * 10000
                await update.message.reply_text(f"✅ 최소 금액이 {val}만원으로 변경되었습니다.")
                state["menu"] = "main"
                await update.message.reply_text(render_main_menu())
            else:
                await update.message.reply_text("❌ 1~1000 사이 숫자를 입력해주세요.")
        except:
            await update.message.reply_text("❌ 숫자를 입력해주세요.")


async def main():
    global collector, trader, application
    
    if not telegram_token:
        logger.error("TELEGRAM_BOT_TOKEN not set!")
        return

    # Initialize components
    collector = KiwoomConditionCollector()
    trader = AutoTrader()
    
    # Build Telegram Application
    application = Application.builder().token(telegram_token).build()

    # Add handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("stop", stop_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("m", menu_command))
    application.add_handler(CommandHandler("help", help_command))
    
    # 일반 텍스트 메시지 핸들러 (메뉴 입력용)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_menu_input))

    # Initialize the application
    await application.initialize()
    await application.start()
    
    # Start polling in background
    await application.updater.start_polling(drop_pending_updates=True)
    
    logger.info("🤖 Bot Started via Polling...")
    send_telegram_message("🤖 봇 서버가 시작되었습니다. /help 를 입력해보세요!")

    # Start Auto Trading Components
    trader.running = True
    sell_task = asyncio.create_task(trader.run_sell_loop())
    ws_task = asyncio.create_task(collector.run())
    
    # Keep running until interrupted
    try:
        await asyncio.gather(sell_task, ws_task)
    except asyncio.CancelledError:
        pass
    finally:
        # Cleanup
        await application.updater.stop()
        await application.stop()
        await application.shutdown()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        send_telegram_message("🛑 봇 서버가 종료되었습니다.")
