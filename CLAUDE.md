# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Financial Sentinel** is a real-time financial risk monitoring system built for the Grok × X API hackathon. It monitors 30+ financial institutions (banks, crypto exchanges, wallets, trading apps, payment services) for idiosyncratic risks using:

- **X API (api.x.com)** - Fetches real tweets about financial institutions
- **Grok 4.1 Fast (api.x.ai)** - Analyzes sentiment and identifies risks
- **Google ADK v1.20+** - Orchestrates the AI agent
- **CopilotKit + AG-UI** - Powers the interactive chat frontend
- **Slack API** - Sends alerts for HIGH/MEDIUM risk findings

## Architecture

The system has two main components:

### Backend: Python Agent (Google ADK + Grok)
```
agent.py            → ADK Agent definition with Grok 4.1 Fast via LiteLLM
tools.py            → X API client, Grok analyzer, Slack alerter
api_server.py       → FastAPI server exposing agent via AG-UI protocol
main.py             → Standalone monitoring loop (continuous mode)
```

**Key Integration**: `agent.py` uses `LiteLlm(model="xai/grok-4-1-fast")` to route to Grok via LiteLLM's OpenAI-compatible wrapper, which connects to `https://api.x.ai/v1`.

### Frontend: Next.js + CopilotKit
```
frontend/
  src/app/
    page.tsx                      → Main chat UI with risk cards
    api/copilotkit/route.ts       → CopilotRuntime → HttpAgent → AG-UI
  globals.css                     → Risk card styling (HIGH/MEDIUM/LOW colors)
```

**Data Flow**:
1. User asks in CopilotKit chat: "Analyze Chase"
2. Frontend `/api/copilotkit` sends request via AG-UI protocol to `http://localhost:8000`
3. Backend agent calls `fetch_market_sentiment("Chase")` tool
4. Tool fetches real X API tweets → analyzes with Grok → returns risk assessment
5. If HIGH/MEDIUM risk: agent calls `send_alert()` tool → posts to Slack
6. Agent returns structured response to frontend
7. Frontend renders risk card with color-coded severity

## Common Commands

### Backend Development
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start AG-UI server (required for frontend)
python api_server.py

# Run standalone monitoring loop (continuous mode)
python main.py

# Run single analysis cycle
python main.py --once

# Test specific banks
python main.py --once --banks "Chase,Coinbase"

# Test agent directly
python agent.py
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

## Environment Variables

All secrets are stored in `.env` at project root. Required variables:

```bash
# xAI / Grok API
XAI_API_KEY=your_xai_api_key_here

# X API (Twitter) - for authenticated tweet fetching
X_BEARER_TOKEN=your_x_bearer_token_here

# Slack (optional - for alerts)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=C0123456789
```

See `.env.example` for detailed setup instructions.

## Critical Implementation Details

### X API Integration (`tools.py`)
- Uses **authenticated X API v2** (`api.x.com/2`) with bearer token
- Implements rate limiting: 1500 requests per 15 minutes (Pro tier)
- Search endpoint: `/tweets/search/recent` with filters for `-is:retweet lang:en`
- Returns structured tweet data with author info and metrics

### Grok Analysis (`tools.py`)
- Uses OpenAI SDK pointing to `https://api.x.ai/v1`
- Model: `grok-4-1-fast` (optimized for low latency)
- Analyzes tweet text to classify risk as HIGH/MEDIUM/LOW
- Returns JSON with: `risk_level`, `tweet_count`, `key_findings`, `summary`, `confidence`

### Agent Behavior (`agent.py`, `api_server.py`)
The agent is instructed to **always**:
1. Call `fetch_market_sentiment(institution_name)` first when asked to analyze
2. Parse the JSON response to extract `risk_level`
3. Call `send_alert(bank_name, risk_level, summary)` for HIGH or MEDIUM risks
4. Present findings in structured format with risk cards

### AG-UI Protocol (`api_server.py`)
- Backend exposes agent via `add_adk_fastapi_endpoint(app, adk_agent, path="/")`
- Frontend connects using `HttpAgent("http://localhost:8000")`
- Session management handled by `ag-ui-adk` wrapper with in-memory session service

### Frontend Rendering (`frontend/src/app/page.tsx`)
- Uses CopilotKit's `useCopilotReadable()` to expose institution data to agent
- Risk cards show color-coded badges: 🔴 HIGH, 🟡 MEDIUM, 🟢 LOW
- CSS classes: `.risk-HIGH`, `.risk-MEDIUM`, `.risk-LOW` (see `globals.css`)

## Supported Financial Institutions

The system monitors 7 categories:
1. **Traditional Banks**: Chase, Bank of America, Wells Fargo, Citibank, Capital One
2. **Crypto Exchanges**: Coinbase, Binance, Kraken, Gemini, Crypto.com
3. **Crypto Wallets**: MetaMask, Phantom, Ledger, Trust Wallet
4. **Stock Trading**: Robinhood, Webull, E*TRADE, Fidelity, Charles Schwab, TD Ameritrade
5. **Robo-Advisors**: Wealthfront, Betterment, Acorns
6. **Payment Apps**: Venmo, Cash App, PayPal, Zelle
7. **Neobanks**: Chime, SoFi, Revolut, Current

Full list available via API: `GET http://localhost:8000/institutions`

## Testing Workflow

1. **Start backend**: `python api_server.py` (runs on port 8000)
2. **Start frontend**: `cd frontend && npm run dev` (runs on port 3000)
3. **Test in browser**: Navigate to `http://localhost:3000`
4. **Example queries**:
   - "Analyze Coinbase and Robinhood for risks"
   - "Check if there are any issues with Chase right now"
   - "Monitor my portfolio: Fidelity, MetaMask, Venmo"

## Important Notes

- Backend must be running on `localhost:8000` before starting frontend
- The system uses **real X API data**, not mock data
- Rate limits apply: be mindful when testing multiple institutions
- Slack alerts require valid `SLACK_BOT_TOKEN` with `chat:write` scope
- Frontend expects specific JSON format from tools (see `tools.py` for schema)
- All API keys must be set in `.env` at project root (not in `frontend/.env.local`)
