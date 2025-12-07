# Financial Sentinel

**Real-time financial institution risk monitoring powered by X API and Grok AI**

![Financial Sentinel](docs/images/image.png)

---

## Overview

Financial Sentinel monitors banks, crypto exchanges, trading platforms, and payment apps in real-time by analyzing social media signals from X (Twitter). It uses the official X Python SDK (xdk) for comprehensive data collection and Grok AI for intelligent risk analysis.

### Key Features

- **Multi-Endpoint X API Integration**: Deep integration with search, counts, streaming, and user lookup endpoints
- **Real-time Filtered Stream**: Live monitoring with automatic fallback to polling when stream is unavailable
- **SSE Streaming**: Progressive updates as analysis happens - see every stage in real-time
- **Institution-Type-Specific Analysis**: Tailored risk prompts for banks, crypto, trading, payments
- **Viral Risk Scoring**: Engagement-weighted signals with verification credibility scoring
- **Full Traceability**: Every finding includes direct tweet URLs and evidence
- **Circuit Breaker Pattern**: Resilient API handling with automatic recovery
- **Trend Detection**: Volume spike detection with velocity tracking
- **Slack Alerting**: Automated alerts for HIGH/MEDIUM risk detections

---

## Why Financial Sentinel?

### Deep X API Integration

Financial Sentinel goes beyond basic tweet fetching with sophisticated multi-endpoint usage:

| Endpoint | Usage | Purpose |
|----------|-------|---------|
| `/tweets/search/recent` | Primary data source | Rich tweet data with engagement metrics, author info, entities |
| `/tweets/counts/recent` | Volume analysis | Trend detection, spike identification with granular time windows |
| `/tweets/search/stream` | Real-time monitoring | Live filtered stream with automatic fallback |
| `/users/by` | Author verification | Credibility scoring, influence weighting |

**Advanced Query Features:**
- Comprehensive `tweet.fields`: `created_at`, `public_metrics`, `context_annotations`, `entities`, `referenced_tweets`
- Full `expansions`: `author_id`, `referenced_tweets.id`
- Rich `user.fields`: `username`, `verified`, `verified_type`, `public_metrics`, `description`
- Smart operators: `-is:retweet`, `lang:en`, relevancy vs recency sorting


### Real-time Responsiveness

The system instantly reacts to events on X with progressive SSE streaming:

```
1. "Starting analysis of Coinbase..."
2. "Fetching tweets from X API (api.x.com)..."
3. "Searching /tweets/search/recent endpoint..."
4. "Fetched 87 tweets"
5. "Volume trend: +45.2%"
6. "Running Grok sentiment analysis (api.x.ai)..."
7. "Analysis complete: MEDIUM risk"
```

**Live Stream Monitoring:**
- Attempts X filtered stream first (30-second timeout)
- Automatic fallback to search API polling (every 15 seconds)
- Transparent status updates in UI showing stream method in use

### Robust API Handling

Built to handle real-world API constraints gracefully:

- **Circuit Breaker**: Prevents cascade failures (5 failures → OPEN → 60s recovery → HALF_OPEN)
- **Exponential Backoff**: Retry with jitter on transient errors (1s base, 60s max, 10% jitter)
- **Request Timeout**: 30-second timeout on all API calls
- **Graceful Fallback**: Grok Live Search when X API is rate limited
- **Per-Institution Isolation**: Single institution failure doesn't affect others

### Intelligent Signal Processing

Transforms raw X data into actionable financial intelligence:

**Viral Risk Scoring (0-100):**
```
engagement_score = (retweets × 3) + (quotes × 2) + (replies × 1.5) + likes
verification_weight = business/gov: 2.0x, verified: 1.5x, regular: 1.0x
influence_score = log10(followers) capped at 10
credibility = engagement × verification × influence
```

**Trend Detection:**
- Volume velocity: `(recent_count - older_count) / older_count × 100`
- Spike detection: >50% increase triggers `is_spiking` flag
- Time-series data for charting

### Grounded AI Analysis

Grok analysis is tightly grounded in retrieved X content:

- Exact tweet text passed to Grok (not summaries)
- Tweet URLs included for every claim
- Aggregate metrics provided: engagement score, verified count, credibility
- Structured output with evidence:

```json
{
  "risk_level": "HIGH|MEDIUM|LOW",
  "summary": "2-3 sentence assessment citing specific evidence",
  "key_findings": ["Finding with tweet evidence"],
  "top_concerning_tweets": [
    {"text": "...", "url": "https://x.com/...", "engagement": "X RTs", "why_concerning": "..."}
  ],
  "viral_indicators": "...",
  "confidence": 0.85,
  "recommended_action": "..."
}
```

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
                                              │ - Users       │
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

### Live Stream Flow

```
Start Monitoring ──▶ Try Filtered Stream (30s timeout)
                            │
              ┌─────────────┴─────────────┐
              │                           │
         Success                     Timeout/Error
              │                           │
              ▼                           ▼
    Continue with               Fallback to Polling
    Filtered Stream             (search_recent every 15s)
              │                           │
              └───────────────────────────┘
                            │
                            ▼
                   Process Tweets ──▶ Frontend SSE
```

### Main Interface

![Financial Sentinel Dashboard](docs/images/screenshot-main.png)
*Main dashboard featuring real-time monitoring, risk analysis cards, viral scoring, trend charts, and live stream feed*

---

## Tech Stack

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Framework | **FastAPI** | REST & SSE streaming endpoints |
| Agent Framework | **Google ADK** | AI agent orchestration |
| Protocol | **AG-UI** | CopilotKit ↔ ADK communication |
| X API | **xdk** (Official SDK) | Tweet search, counts, streaming, users |
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
├── api_server.py          # FastAPI server with AG-UI & SSE endpoints
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
    │       ├── page.tsx           # Main chat interface with live stream
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
| `GET` | `/health` | Health check with X API status & circuit breaker state |
| `GET` | `/status` | Detailed service status with metrics |

### Analysis Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stream/analyze/{institution}` | SSE streaming analysis with progressive updates |
| `POST` | `/stream/batch` | Batch SSE analysis for multiple institutions |
| `POST` | `/analyze` | Single institution (non-streaming) |
| `POST` | `/analyze/batch` | Multiple institutions (non-streaming) |

### Live Monitoring Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/monitor/start` | Start monitoring with filtered stream rules |
| `GET` | `/monitor/stream` | SSE stream of live tweets |
| `POST` | `/monitor/stop` | Stop monitoring and clean up rules |
| `GET` | `/monitor/stats` | Current monitoring statistics |
| `POST` | `/monitor/sync` | Sync monitoring with portfolio |

### Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/trends/{institution}` | Tweet volume trends with spike detection |
| `GET` | `/institutions` | Available institutions list with categories |

---

## Setup

### Prerequisites

- Python 3.13+
- Node.js 20+
- X Developer Account (API v2 access with filtered stream)
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
python api_server.py
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

![Risk Analysis Dashboard](docs/images/screenshot-analysis.png)
*Real-time risk analysis with viral scoring, trend velocity, and grounded evidence*

### Live Stream Monitoring

The UI shows real-time status updates:

```
[12:34:01] Trying filtered stream (timeout: 30s)...
[12:34:31] No data from filtered stream after 30s, falling back to polling
[12:34:31] Using search API polling for live updates (every 15s)
[12:34:46] Found 5 new tweets
[12:35:01] Found 3 new tweets
```

![Live Monitoring Feed](docs/images/screenshot-stream.png)
*Server-sent events streaming with progressive analysis updates and real-time status*

### SSE Streaming (JavaScript)

```javascript
const eventSource = new EventSource('/stream/analyze/Chase');

eventSource.addEventListener('status', (e) => {
  console.log('Status:', JSON.parse(e.data).message);
});

eventSource.addEventListener('progress', (e) => {
  console.log('Progress:', JSON.parse(e.data));
});

eventSource.addEventListener('result', (e) => {
  const result = JSON.parse(e.data);
  console.log('Risk Level:', result.risk_level);
  console.log('Viral Score:', result.viral_score);
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
print(f"Viral Score: {result['analysis']['viral_score']}")
print(f"Trend: {result['trend_velocity']}%")
```

---

## X API Integration

Financial Sentinel uses the **official X Python SDK (xdk)** with multiple endpoints:

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tweets/search/recent` | `client.posts.search_recent()` | Search tweets with risk keywords |
| `/tweets/counts/recent` | `client.posts.counts()` | Volume trend analysis |
| `/tweets/search/stream` | `client.stream.posts()` | Real-time filtered stream |
| `/tweets/search/stream/rules` | `client.stream.update_rules()` | Stream rule management |
| `/users/by` | `client.users.by_usernames()` | Author verification |

### Query Construction

```python
# Risk-focused query
query = f'"{institution}" ({" OR ".join(risk_keywords)}) lang:en -is:retweet'

# Comprehensive fields
tweet_fields = [
    "created_at", "public_metrics", "author_id", "text",
    "context_annotations", "conversation_id", "entities", "referenced_tweets"
]
expansions = ["author_id", "referenced_tweets.id"]
user_fields = ["username", "verified", "verified_type", "public_metrics", "description"]
```

### Features

- **Automatic Pagination**: xdk handles pagination transparently
- **Stream with Fallback**: Filtered stream → polling fallback with 30s timeout
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

**States:**
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Failing, all requests rejected immediately
- **HALF_OPEN**: Testing recovery, limited requests allowed

### Stream Fallback

```
Filtered Stream ──(timeout/error)──▶ Search API Polling
       │                                      │
       │ 30s timeout                          │ 15s interval
       │ TooManyConnections                   │
       │ Auth errors                          │
       ▼                                      ▼
  Real-time tweets                    Recent tweets
  (when available)                    (always available)
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

### Viral Score Components

```
engagement_score = (RTs × 3) + (quotes × 2) + (replies × 1.5) + likes
verification_weight = {business: 2.0, verified: 1.5, regular: 1.0}
influence_score = min(log10(followers), 10)
viral_score = weighted_average(engagement, verification, influence) × 100
```

---

## Development

### Run Tests

```bash
# Test institution classification
python -c "from tools import classify_institution; print(classify_institution('Coinbase'))"

# Test sentiment analysis
python -c "from tools import fetch_market_sentiment; print(fetch_market_sentiment('Chase'))"

# Test X API connection
python -c "from tools import XAPIClient; c = XAPIClient(); print(c.client)"
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

MIT License

---

## Acknowledgments

- **X Developer Platform** - X API v2 and xdk SDK
- **x.ai** - Grok AI models
- **Google ADK** - Agent Development Kit
- **CopilotKit** - AI chat interface
- **AG-UI Protocol** - Agent-UI communication standard
