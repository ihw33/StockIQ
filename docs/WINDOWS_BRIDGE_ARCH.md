# 🌉 StockIQ# 🌉 Windows Bridge Architecture (Legacy/Deprecated)

> **Note**: This architecture is for the legacy OCX-based integration. The current project uses **Kiwoom REST API** directly and does not require this bridge.

## 1. Overview
To combine the stability of Windows-based Execution (Kiwoom HTS) with the intelligence of the Mac-based AI Engine, we establish a **WebSocket Bridge**.

### The "Brain & Hand" Model
*   **Brain (Mac)**: Strategy, UI, AI Analysis. (Client)
*   **Hand (Windows)**: Order Execution, Account Data, Real-time Feeds. (Server)

---

## 2. Technical Stack

### A. Windows Side (The Server)
*   **OS**: Windows 10/11
*   **Environment**: Python 3.10+ (**32-bit** is MUST for Kiwoom OCX)
*   **Framework**: `FastAPI` (for WebSocket support + Async)
*   **Library**: `PyQt6` (for event loop integration with Kiwoom)
*   **Network**: Listens on `0.0.0.0:8000` (Local Network)

### B. Mac Side (The Client)
*   **Framework**: Next.js (Node.js) or Python AI Engine.
*   **Protocol**: Standard `ws://`

---

## 3. Communication Protocol (JSON)

### 3.1 Connect & Auth
*   **Endpoint**: `ws://<WINDOWS_IP>:8000/ws/trade`
*   **Handshake**:
    ```json
    { "type": "CONNECT", "client": "StockIQ_Mac" }
    ```

### 3.2 Sending Orders (Mac -> Windows)
```json
{
  "type": "ORDER",
  "id": "req_12345",
  "payload": {
    "scode": "005930",
    "order_type": "BUY",  // BUY or SELL
    "price": 72000,
    "quantity": 10,
    "hoga": "00"          // 00: Limit, 03: Market
  }
}
```

### 3.3 Execution Real-time (Windows -> Mac)
```json
{
  "type": "EXECUTION",
  "payload": {
    "scode": "005930",
    "order_id": "900123",
    "price": 72000,
    "quantity_filled": 10,
    "time": "10:30:01"
  }
}
```

---

## 4. Implementation Steps

### Step 1: Windows Environment Setup
1.  Install Python 3.10 (**32-bit**).
2.  Install `fastapi`, `uvicorn`, `websockets`, `pyqt6`.
3.  Install **Kiwoom API (Open API+W)**.

### Step 2: Bridge Server Code (`server.py`)
*   Create a FastAPI app that starts a separate Thread/Process for the PyQt/Kiwoom Event Loop.
*   Use a `Queue` to pass messages between FastAPI (Async) and Kiwoom (PyQt MainThread).

### Step 3: Mac Client Integration
*   Switch `KiwoomProvider` in Next.js from "Mock" to "WebSocket".
*   Implement automatic reconnection logic.

## 5. Security Note
*   This uses **Unencrypted WebSocket (ws://)** for low latency on Local LAN.
*   **Firewall**: Windows Firewall must allow Inbound connections on Port 8000.
