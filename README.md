# Financial Sentinel

**Real-time financial institution risk monitoring powered by X API and Grok AI**

Built for the **Grok x X API Hackathon** - December 2025

---

## Overview

Financial Sentinel monitors banks, crypto exchanges, trading platforms, and payment apps in real-time by analyzing social media signals from X (Twitter). It uses the official X Python SDK (xdk) for data collection and Grok AI for intelligent risk analysis.

### Key Features

- **Multi-Institution Monitoring**: Banks, crypto exchanges, wallets, trading platforms, payment apps, neobanks
- **Real-time Analysis**: SSE streaming for live updates as analysis progresses
- **Institution-Type-Specific Prompts**: Tailored risk analysis for each institution category
- **Viral Risk Scoring**: Engagement-weighted signals with verification credibility
- **Full Traceability**: Every finding includes direct tweet URLs
- **Circuit Breaker Pattern**: Resilient API handling with automatic fallback to Grok Live Search
- **Slack Alerting**: Automated alerts for HIGH/MEDIUM risk detections

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FINANCIAL SENTINEL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │    Frontend      │     │   API Server     │     │   External APIs  │    │
│  │   (Next.js)      │────▶│   (FastAPI)      │────▶│                  │    │
│  │                  │     │                  │     │  ┌────────────┐  │    │
│  │  - CopilotKit    │ SSE │  - AG-UI Proto   │     │  │  X API v2  │  │    │
│  │  - React 19      │◀────│  - SSE Stream    │────▶│  │  (xdk)     │  │    │
│  │  - Tailwind v4   │     │  - REST APIs     │     │  └────────────┘  │    │
│  │                  │     │                  │     │                  │    │
│  └──────────────────┘     │  ┌────────────┐  │     │  ┌────────────┐  │    │
│         :3000             │  │ ADK Agent  │  │────▶│  │  Grok AI   │  │    │
│                           │  │ (Sentinel) │  │     │  │  (x.ai)    │  │    │
│                           │  └────────────┘  │     │  └────────────┘  │    │
│                           │                  │     │                  │    │
│                           │  ┌────────────┐  │     │  ┌────────────┐  │    │
│                           │  │  Tools     │  │────▶│  │   Slack    │  │    │
│                           │  │  Module    │  │     │  │  (Alerts)  │  │    │
│                           │  └────────────┘  │     │  └────────────┘  │    │
│                           └──────────────────┘     └──────────────────┘    │
│                                  :8000                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Query ──▶ CopilotKit ──▶ AG-UI Protocol ──▶ ADK Agent
                                                      │
                                                      ▼
                                              ┌───────────────┐
                                              │ XAPIClient    │
                                              │ (xdk SDK)     │
                                              │               │
                                              │ - Search      │
                                              │ - Counts      │
                                              │ - Streaming   │
                                              └───────┬───────┘
                                                      │
                                    Rate Limited? ────┼──── Success
                                          │           │         │
                                          ▼           │         ▼
                                   ┌─────────────┐    │  ┌─────────────┐
                                   │ Grok Live   │    │  │ GrokClient  │
                                   │ Search      │    │  │ Analysis    │
                                   │ (Fallback)  │    │  │             │
                                   └──────┬──────┘    │  └──────┬──────┘
                                          │           │         │
                                          └───────────┴─────────┘
                                                      │
                                                      ▼
                                              ┌───────────────┐
                                              │ Risk Analysis │
                                              │ - HIGH        │
                                              │ - MEDIUM      │──▶ Slack Alert
                                              │ - LOW         │
                                              └───────────────┘
```

---

## Tech Stack

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Framework | **FastAPI** | REST & SSE streaming endpoints |
| Agent Framework | **Google ADK** | AI agent orchestration |
| Protocol | **AG-UI** | CopilotKit ↔ ADK communication |
| X API | **xdk** (Official SDK) | Tweet search, counts, streaming |
| AI Analysis | **Grok 4.1 Fast** | Sentiment & risk analysis |
| Model Routing | **LiteLLM** | Unified LLM interface |

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | **Next.js 16** | React SSR framework |
| React | **React 19** | UI components |
| AI Chat | **CopilotKit** | Chat interface & AG-UI client |
| Styling | **Tailwind CSS v4** | Utility-first CSS |
| Type Safety | **TypeScript 5** | Static typing |
| Validation | **Zod** | Runtime schema validation |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Python | **3.13+** | Backend runtime |
| Node.js | **20+** | Frontend runtime |
| Alerting | **Slack SDK** | Risk notifications |

---

## Project Structure

```
fin-x-watcher/
├── api_server.py          # FastAPI server with AG-UI endpoint
├── tools.py               # X API client, Grok client, analysis tools
├── agent.py               # Standalone ADK agent (alternative entry)
├── main.py                # CLI interface
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (not in git)
├── .env.example           # Environment template
│
└── frontend/
    ├── src/
    │   └── app/
    │       ├── page.tsx           # Main chat interface
    │       └── api/
    │           └── copilotkit/
    │               └── route.ts   # AG-UI proxy route
    ├── package.json       # Node dependencies
    └── tailwind.config.ts # Tailwind configuration
```

---

## Institution Types

Financial Sentinel classifies institutions into 6 categories, each with tailored risk analysis:

| Type | Examples | Key Risk Signals |
|------|----------|------------------|
| **Traditional Bank** | Chase, Wells Fargo, Citi | FDIC, bank run, insolvency, stress test |
| **Neobank** | Chime, SoFi, Revolut | Partner bank issues, account closures |
| **Crypto Exchange** | Coinbase, Binance, Kraken | Rug pull, paused withdrawals, proof of reserves |
| **Crypto Wallet** | MetaMask, Phantom, Ledger | Exploit, drainer, phishing, firmware |
| **Trading Platform** | Robinhood, Fidelity, E*Trade | Order stuck, margin call, trading halted |
| **Payment App** | Venmo, Cash App, PayPal | Frozen account, failed transfer, fraud |

---

## API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | AG-UI protocol endpoint for CopilotKit |
| `GET` | `/health` | Health check with X API status |
| `GET` | `/status` | Detailed service status |

### Analysis Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stream/analyze/{institution}` | SSE streaming analysis |
| `POST` | `/stream/batch` | Batch SSE analysis |
| `POST` | `/analyze` | Single institution (non-streaming) |
| `POST` | `/analyze/batch` | Multiple institutions (non-streaming) |

### Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/trends/{institution}` | Tweet volume trends |
| `GET` | `/institutions` | Available institutions list |

---

## Setup

### Prerequisites

- Python 3.13+
- Node.js 20+
- X Developer Account (API v2 access)
- Grok API Key (x.ai)
- Slack Bot Token (optional, for alerts)

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/gamepop/fin-x-watcher.git
cd fin-x-watcher

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# X API (Required)
X_BEARER_TOKEN=your_x_bearer_token

# Grok AI (Required)
XAI_API_KEY=your_grok_api_key

# Slack (Optional)
SLACK_BOT_TOKEN=xoxb-your-slack-token
SLACK_CHANNEL_ID=C0123456789
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_COPILOTKIT_REMOTE_ENDPOINT=http://localhost:8000
```

### 3. Run Services

**Terminal 1 - Backend:**
```bash
python -m uvicorn api_server:app --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
```

### 4. Access

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## Usage Examples

### Chat Interface

```
User: Analyze Coinbase for risk

Sentinel: 📊 **Coinbase** | Risk: MEDIUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 **Analysis Metrics**
- Tweets analyzed: 100
- Viral score: 45.2/100
- Trend: +12.5% ↑

🔍 **Key Findings**
- Cloudflare outage affecting platform access
- Official acknowledgment from @CoinbaseSupport
- All funds confirmed safe

📱 **Evidence Tweets**
1. @CoinbaseSupport: "We're aware..." [View](https://x.com/...)
2. @Pirat_Nation: "Cloudflare down..." [View](https://x.com/...)

✅ **Action**: Alert sent to Slack
```

### SSE Streaming (JavaScript)

```javascript
const eventSource = new EventSource('/stream/analyze/Chase');

eventSource.addEventListener('status', (e) => {
  console.log('Status:', JSON.parse(e.data).message);
});

eventSource.addEventListener('result', (e) => {
  const result = JSON.parse(e.data);
  console.log('Risk Level:', result.risk_level);
  console.log('Analysis:', result.analysis);
});

eventSource.addEventListener('done', () => {
  eventSource.close();
});
```

### Python SDK

```python
from tools import fetch_market_sentiment
import json

result = json.loads(fetch_market_sentiment("Chase"))
print(f"Risk: {result['analysis']['risk_level']}")
print(f"Type: {result['institution_type']}")
```

---

## X API Integration

Financial Sentinel uses the **official X Python SDK (xdk)** with multiple endpoints:

### Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `client.posts.search_recent()` | Search tweets with risk keywords |
| `client.stream.posts()` | Real-time filtered stream (planned) |
| `client.stream.update_rules()` | Stream rule management (planned) |

### Features

- **Automatic Pagination**: xdk handles pagination transparently
- **Circuit Breaker**: Prevents cascade failures (5 failures → 60s cooldown)
- **Exponential Backoff**: Retry with jitter on transient errors
- **Grok Fallback**: When rate limited, falls back to Grok Live Search

---

## Resilience Patterns

### Circuit Breaker

```
CLOSED ──(5 failures)──▶ OPEN ──(60s timeout)──▶ HALF_OPEN
   ▲                                                  │
   └──────────────(3 successes)───────────────────────┘
```

### Fallback Chain

```
X API Search ──(rate limited)──▶ Grok Live Search ──(error)──▶ Error Response
     │                                  │
     ▼                                  ▼
 Full tweets                    AI-searched posts
 with metrics                   with summaries
```

---

## Risk Assessment

### Risk Levels

| Level | Criteria | Action |
|-------|----------|--------|
| **HIGH** | Platform outages, withdrawal freezes, hacks, regulatory action | Immediate Slack alert |
| **MEDIUM** | Localized issues, elevated complaints, unconfirmed rumors | Slack alert |
| **LOW** | Normal operations, routine complaints | No alert |

### Credibility Weighting

| Source | Weight |
|--------|--------|
| Verified Business/Government | 2.0x |
| Verified User | 1.5x |
| High Follower (>100K) | +influence score |
| High Engagement | +engagement score |

---

## Development

### Run Tests

```bash
# Test institution classification
python -c "from tools import classify_institution; print(classify_institution('Coinbase'))"

# Test sentiment analysis
python -c "from tools import fetch_market_sentiment; print(fetch_market_sentiment('Chase'))"
```

### Code Style

```bash
# Format Python
black *.py

# Lint frontend
cd frontend && npm run lint
```

---

## License

MIT License - Built for the Grok x X API Hackathon 2025

---

## Acknowledgments

- **X Developer Platform** - X API v2 and xdk SDK
- **x.ai** - Grok AI models
- **Google ADK** - Agent Development Kit
- **CopilotKit** - AI chat interface
- **AG-UI Protocol** - Agent-UI communication standard
