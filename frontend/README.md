# Financial Sentinel - Frontend

CopilotKit-powered chat interface for the Financial Sentinel risk monitoring agent.

## Architecture

```
Frontend (Next.js + CopilotKit)
    |
    v
/api/copilotkit (CopilotRuntime)
    |
    v
HttpAgent --> http://localhost:8000 (AG-UI)
    |
    v
FastAPI Server (api_server.py)
    |
    v
ADKAgent wrapper (ag-ui-adk)
    |
    v
Google ADK Agent + Grok 4.1 Fast
    |
    v
Tools: fetch_market_sentiment (X API) + send_alert (Slack)
```

## Prerequisites

1. Backend server running at `http://localhost:8000`
2. Required environment variables in root `.env`:
   - `XAI_API_KEY` - xAI API key for Grok
   - `X_BEARER_TOKEN` - X API bearer token
   - `SLACK_BOT_TOKEN` - Slack bot token (optional)
   - `SLACK_CHANNEL_ID` - Slack channel ID (optional)

## Getting Started

### 1. Start the Backend (AG-UI Server)

From the project root:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the AG-UI server
python api_server.py
```

The backend will start at `http://localhost:8000`.

### 2. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the Financial Sentinel.

## Features

- Chat interface for natural language queries
- Risk cards with color-coded severity (HIGH/MEDIUM/LOW)
- Real-time analysis using X API tweets + Grok AI
- Automatic Slack alerts for HIGH risk findings
- Support for 30+ financial institutions:
  - Traditional banks (Chase, Wells Fargo, etc.)
  - Crypto exchanges (Coinbase, Binance, Kraken)
  - Crypto wallets (MetaMask, Phantom, Ledger)
  - Stock trading apps (Robinhood, Fidelity, E*TRADE)
  - Robo-advisors (Wealthfront, Betterment)
  - Payment apps (Venmo, Cash App, PayPal)
  - Neobanks (Chime, SoFi, Revolut)

## Example Queries

- "Analyze Coinbase and Robinhood for risks"
- "Check if there are any issues with Chase right now"
- "Monitor my portfolio: Fidelity, MetaMask, Venmo"
- "Is there anything wrong with Binance?"

## Tech Stack

- **Framework**: Next.js 16
- **AI Integration**: CopilotKit + AG-UI Protocol
- **Styling**: Tailwind CSS
- **Backend**: FastAPI + Google ADK + xAI Grok 4.1 Fast
- **Data Sources**: X API (api.x.com) + Grok (api.x.ai)
