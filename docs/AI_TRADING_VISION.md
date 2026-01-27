# 👁️ StockIQ: AI Trading Vision

> **"From Information to Insight, From Action to Memory."**

## 1. Core Philosophy: The Trading Memory System
StockIQ is not just a dashboard; it is a **Cognitive Extension** for the trader.
Most platforms show *what is happening now*. StockIQ remembers *what happened before* and *how we reacted*.

### The Cycle of Intelligence
1.  **Ingest (Sensing)**: AI captures raw signals (News, Price, Macro).
2.  **Process (Thinking)**: AI structures this into "Themes" and "Issues".
3.  **Act (Trading)**: User makes decisions in the **War Room**.
4.  **Memory (Learning)**: The system records the Data + Decision + Outcome.
5.  **Recall (Wisdom)**: When a similar pattern emerges, AI retrieves the *past memory* to guide the *present action*.

---

## 2. Strategic Architecture: Hybrid Intelligence

We do not rely on a single data source. We fuse **Hard Facts** with **Soft Context**.

### 🏛️ The "Left Brain" (Structured DB)
*   **Role**: Precision, Math, Fact-Checking.
*   **Storage**: PostgreSQL / Supabase.
*   **Content**:
    *   **Financials**: Revenue, Profit, PBR/PER.
    *   **Macro**: Interest Rates, Oil, Exchange Rates (Time-series).
    *   **Market Data**: OHLCV, Order Book.
    *   **Official Disclosures**: Capital Increase, Earnings Reports.
*   **Query**: "Show stocks with Operating Profit > 10%."

### 🎨 The "Right Brain" (Vector RAG)
*   **Role**: Context, Nuance, Similarity.
*   **Storage**: Vector Database (pgvector / Pinecone).
*   **Content**:
    *   **News Articles**: Text bodies, sentiment.
    *   **Theme Narratives**: "Why is HBM hot?"
    *   **Broker Reports**: PDF summaries.
    *   **User Notes**: "I sold because I feared the rate hike."
*   **Query**: "What happened last time Oil prices spiked like this?"

---

## 3. Product Structure: Forest and Trees

### 🌲 The Issue Dashboard (The Forest)
*   **Purpose**: Strategic Awareness.
*   **Timeframe**: Weekly / Monthly / Daily.
*   **Key Features**:
    *   **Theme Map**: Visualizing dominant themes (e.g., "AI Semiconductor", "Superconductor").
    *   **Macro Overlay**: Correlating market moves with macro events (CPI release, FOMC).
    *   **Issue Archive**: A timeline of major market shocks and catalysts.

### ⚔️ The War Room (The Trees)
*   **Purpose**: Tactical Execution.
*   **Timeframe**: Real-time / Intraday.
*   **Key Features**:
    *   **Focus Interaction**: Chat-based analysis of a *specific stock*.
    *   **Instant Context**: AI pulls "Left Brain" facts (Financials) and "Right Brain" memories (Past Notes) into the chat.
    *   **Actionable Briefing**: "Morning Briefing" and "Closing Review".

---

## 4. Implementation Priorities

1.  **Data Independence**:
    *   Establish a robust **Node.js Collector** for News & Disclosures.
    *   Stop relying on fragile client-side fetches; move to Server-Side Ingestion.

2.  **Memory Pipeline**:
    *   Implement the **Review Loop**: After market close, prompt user to review "Today's Key Actions".
    *   Store these reviews in the Vector DB for future retrieval.

3.  **Visual Intelligence**:
    *   Move beyond simple charts. Visualize *Impact* (e.g., Event markers on charts).

---

*This document serves as the North Star for StockIQ development. All features should align with the goal of building a "Thinking & Remembering" trading system.*
