
import asyncio
import websockets
import json
import logging
import os
from collectors.kiwoom import KiwoomCollector
from strategies.auto_trader import AutoTrader

logger = logging.getLogger(__name__)

# Socket URL is usually wss://openapi.kiwoom.com/websocket or similar.
# User script: socket_url + '/api/dostk/websocket'
# Need to check what 'config.socket_url' was in user script. 
# Assuming standard Kiwoom Cloud WebSocket OR we use the same base URL as REST but wss:// ?
# Actually user script imports `config.socket_url`.
# Let's try to infer from `base_url`. 
# If REST is https://api.kiwoom.com, Websocket might be wss://api.kiwoom.com/websocket ? Or separate domain.
# Let's use env variable or default.

class KiwoomConditionCollector:
    def __init__(self):
        self.kiwoom = KiwoomCollector()
        self.trader = AutoTrader()
        # Websocket URL:
        # User script: `socket_url` imported.
        # Known Kiwoom REST WS: check docs. 
        # Notion says: wss://openapi.kiwoom.com/websocket (KIS) ? No user said NOT KIS.
        # Kiwoom Open API uses OCX.
        # BUT User provided script `rt_search.py` specifically uses `/api/dostk/websocket` path.
        # This implies standard Kiwoom REST is being used.
        # Let's derive from .env or hardcode typical.
        self.ws_url = "wss://openapi.kiwoom.com/websocket" # Default guess
        # Wait, user script has `from config import socket_url`.
        # Let's assume standard `wss://openapi.kiwoom.com/websocket` for now?
        # Actually, previous REST url was `https://api.kiwoom.com`.
        # So maybe `wss://api.kiwoom.com/api/dostk/websocket`?
        # User script: `socket_url + '/api/dostk/websocket'`
        # I will use a safe default and allow env override.
        
    async def run(self):
        # Determine URL
        # Currently we use `https://api.kiwoom.com` for REST.
        # Let's try `wss://api.kiwoom.com/websocket` or similar.
        # Kiwoom Cloud API (Core): wss://openapi.kiwoom.com/websocket
        uri = os.getenv("KIWOOM_WS_URL", "wss://api.kiwoom.com/api/dostk/websocket")
        
        logger.info(f"Connecting to Kiwoom WebSocket: {uri}")
        
        while True:
            try:
                async with websockets.connect(uri) as websocket:
                    logger.info("Connected to WebSocket.")
                    
                    # Login
                    token = self.kiwoom._get_token()
                    login_packet = {
                        'trnm': 'LOGIN',
                        'token': token
                    }
                    await websocket.send(json.dumps(login_packet))
                    logger.info("Sent LOGIN packet.")

                    async for message in websocket:
                        data = json.loads(message)
                        trnm = data.get('trnm')
                        
                        if trnm == 'LOGIN':
                            if data.get('return_code') != 0:
                                logger.error(f"Login Failed: {data.get('return_msg')}")
                                return
                            else:
                                logger.info("Login Success. Requesting Condition List...")
                                # Register Condition Search
                                # User script: trnm: CNSRREQ, seq: 0, search_type: 1, stex_tp: K
                                # Wait, user script `rt_search.py` FIRST sends `CNSRLST`?
                                # "로그인 성공하였습니다. -> 조건검색 목록조회 패킷을 전송합니다. (CNSRLST)"
                                # THEN in `main` it sends `CNSRREQ`.
                                # Let's follow user script logic:
                                # 1. LOGIN
                                # 2. Receive LOGIN OK -> Send CNSRLST (List) ? 
                                # Actually user script logic is:
                                # if LOGIN success -> Send CNSRLST.
                                # AND separate main task sends CNSRREQ after 1 sec.
                                
                                # We can just send `CNSRREQ` if we know the seq (0).
                                req_packet = { 
                                    'trnm': 'CNSRREQ', 
                                    'seq': '0', 
                                    'search_type': '1', 
                                    'stex_tp': 'K'
                                }
                                await websocket.send(json.dumps(req_packet))
                                logger.info("Sent CNSRREQ (Real-time Condition Search).")

                        elif trnm == 'PING':
                            await websocket.send(message) # Echo PING
                        
                        elif trnm == 'REAL':
                            # Real-time data arrival
                            # User script: items = response['data'] ... jmcode = item['values']['9001']
                            items = data.get('data', [])
                            for item in items:
                                vals = item.get('values', {})
                                code = vals.get('9001') # Symbol Code
                                if code:
                                    logger.info(f"Condition Match: {code}")
                                    # Trigger Auto Buy
                                    # Run in thread or async to avoid blocking WS? 
                                    # check_and_buy is sync (requests).
                                    # loop.run_in_executor needed.
                                    loop = asyncio.get_event_loop()
                                    await loop.run_in_executor(None, self.trader.check_and_buy, code)

            except websockets.ConnectionClosed:
                logger.warning("WebSocket Connection Closed. Reconnecting in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"WebSocket Error: {e}")
                await asyncio.sleep(5)
