# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Financial Sentinel** is a real-time financial risk monitoring system built for the Grok x X API hackathon. It monitors 30+ financial institutions (banks, crypto exchanges, wallets, trading apps, payment services) for idiosyncratic risks using:

- **X API (api.x.com)** - Multi-endpoint integration for comprehensive data gathering
- **Grok 4.1 Fast (api.x.ai)** - Analyzes sentiment and identifies risks with grounded traceability
- **Google ADK v1.20+** - Orchestrates the AI agent
- **CopilotKit + AG-UI** - Powers the interactive chat frontend
- **Slack API** - Sends alerts for HIGH/MEDIUM risk findings

## Hackathon Evaluation Criteria - Excellence Implementation

This project is designed to EXCEL in all five judging dimensions:

### 1. Depth & Centrality of X API Usage
**Goal:** Indispensable and sophisticated integration with multiple endpoints, streams, webhooks, and SDKs.

**Implementation:**
- **Location:** `tools.py:139-558` (XAPIClient class)
- **Multiple Endpoints Used:**
  - `/tweets/search/recent` - Primary tweet fetching with comprehensive fields
  - `/tweets/counts/recent` - Volume trend detection for spike identification
  - `/users/by` - User verification and credibility scoring
- **Sophisticated Query Features:**
  - Advanced query operators: `-is:retweet lang:en`
  - Sort order control: `relevancy` vs `recency`
  - Comprehensive tweet.fields: `created_at,public_metrics,author_id,text,context_annotations,conversation_id,entities,referenced_tweets`
  - Full expansions: `author_id,referenced_tweets.id`
  - Rich user.fields: `username,verified,verified_type,public_metrics,description,created_at`
- **Rate-Limit Strategy:**
  - `@sleep_and_retry` + `@limits(calls=1500, period=900)` for Pro tier
  - Bearer token authentication with URL-decode support
- **Direct Tweet URLs:** Every tweet includes `https://x.com/{username}/status/{tweet_id}` for traceability

### 2. Real-time Responsiveness & Liveness
**Goal:** Instantly and visibly react to events on X.

**Implementation:**
- **Location:** `api_server.py:264-385` (SSE streaming), `frontend/src/app/page.tsx:79-131` (SSE client)
- **Server-Sent Events (SSE) Streaming:**
  - `/stream/analyze/{institution}` - Real-time analysis with stage updates
  - `/stream/batch` - Batch analysis with progress events
  - Event types: `status`, `progress`, `result`, `done`, `error`
- **Progressive Updates:**
  1. "Starting analysis of {institution}..."
  2. "Fetching tweets from X API (api.x.com)..."
  3. "Searching /tweets/search/recent endpoint..."
  4. "Fetched {count} tweets"
  5. "Volume trend: {velocity}%"
  6. "Running Grok sentiment analysis (api.x.ai)..."
  7. "Analysis complete: {risk_level}"
- **Frontend Live Updates:**
  - Real-time streaming status display
  - Progressive result rendering
  - Live institution badges showing risk status
- **Monitoring Intervals:** Configurable from 1 minute (SSE) to 60 minutes

### 3. Robustness under Real API Constraints
**Goal:** Graceful auth, rate-limit strategy, error recovery, streaming resilience.

**Implementation:**
- **Location:** `tools.py:37-132` (CircuitBreaker, exponential backoff)
- **Circuit Breaker Pattern:**
  - States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing recovery)
  - Failure threshold: 5 consecutive failures
  - Recovery timeout: 60 seconds
  - Half-open max calls: 3
- **Exponential Backoff with Jitter:**
  - Base delay: 1.0s
  - Max delay: 60.0s
  - Jitter: 10% to prevent thundering herd
  - `@with_retry(max_attempts=3)` decorator
- **Error Handling:**
  - Specific handling for 429 (rate limit), 401 (auth), 503 (unavailable)
  - Request timeout: 30 seconds
  - Connection error recovery
  - Per-institution error isolation (continues on single failure)
- **Graceful Fallback:**
  - Grok Live Search when X API is rate limited
  - Uses `grok-3-latest` with `search_parameters: {"mode": "auto"}`
- **Health Monitoring:**
  - `/health` endpoint with circuit breaker status
  - `/status` endpoint with full API metrics
  - Request count, success count, error count tracking

### 4. Intelligence & Value Created from X Data
**Goal:** Creatively transform raw X objects into signals, predictions, alerts, or actions the official client can't provide.

**Implementation:**
- **Location:** `tools.py:274-326` (tweet enrichment), `tools.py:587-742` (GrokClient analysis)
- **Viral Risk Scoring (0-100):**
  - Engagement score = (RTs * 3) + (quotes * 2) + (replies * 1.5) + likes
  - Verification weight: business/gov = 2.0x, verified = 1.5x, regular = 1.0x
  - Influence score based on follower count (capped at 10)
  - Combined credibility score per tweet
- **Trend Detection:**
  - Volume velocity: `(recent_volume - older_volume) / older_volume * 100`
  - Spike detection: >50% increase triggers `is_spiking` flag
  - Time series data for charting
- **Account Analysis:**
  - Verification type weighting (business > standard)
  - Account age calculation
  - Follower/following ratio analysis
- **Risk Classification:**
  - Institution-specific signals (banks vs crypto vs trading apps)
  - Category-aware keywords for each institution type
  - Confidence scores for all assessments
- **Automated Actions:**
  - Slack alerts for HIGH/MEDIUM risks
  - Rich Block Kit formatting
  - Source tweet links in alerts

### 5. Grok Grounding & Task Specificity
**Goal:** Tightly and traceably apply Grok to retrieved X content to produce concise, high-signal outputs.

**Implementation:**
- **Location:** `tools.py:587-776` (GrokClient), `agent.py:27-93` & `api_server.py:66-149` (prompts)
- **Tight Grounding:**
  - Exact tweet text passed to Grok (not summaries)
  - Tweet URLs included for every claim
  - Aggregate metrics provided: engagement score, verified count, avg credibility
- **Structured Output Schema:**
  ```json
  {
    "risk_level": "HIGH|MEDIUM|LOW",
    "summary": "2-3 sentence assessment citing specific evidence",
    "key_findings": ["Finding 1 with tweet evidence"],
    "top_concerning_tweets": [
      {"text": "...", "url": "https://x.com/...", "engagement": "X RTs, Y likes", "why_concerning": "..."}
    ],
    "viral_indicators": "...",
    "confidence": 0.0-1.0,
    "recommended_action": "..."
  }
  ```
- **Traceability Features:**
  - `evidence_tweets` with URLs in every response
  - `verified_sources` count
  - `trend_velocity` percentage
  - `is_trending_up` boolean
- **Task-Specific Prompts:**
  - Institution-specific risk indicators
  - Category-aware analysis (banks, crypto, trading, payments)
  - Credibility weighting instructions
  - GROUNDED, TRACEABLE, QUANTITATIVE, ACTIONABLE requirements

## Architecture

### Backend: Python Agent (Google ADK + Grok)
```
tools.py            → Multi-endpoint X API client, Grok analyzer, Slack alerter
                      - XAPIClient: /tweets/search/recent, /tweets/counts/recent, /users/by
                      - CircuitBreaker: resilience pattern
                      - GrokClient: enhanced analysis with viral scoring
api_server.py       → FastAPI server with SSE streaming endpoints
                      - /stream/analyze/{institution}
                      - /stream/batch
                      - /health, /status, /trends
agent.py            → ADK Agent definition with Grok 4.1 Fast via LiteLLM
main.py             → Standalone monitoring loop (continuous mode)
```

### Frontend: Next.js + CopilotKit
```
frontend/
  src/app/
    page.tsx                      → Main chat UI with SSE streaming support
                                    - Real-time status display
                                    - Enhanced risk cards with viral scores
                                    - Evidence tweets with URLs
    api/copilotkit/route.ts       → CopilotRuntime → HttpAgent → AG-UI
  globals.css                     → Risk card styling (HIGH/MEDIUM/LOW)
```

### Data Flow with SSE
```
1. User clicks "Stream Analysis" or types in chat
2. Frontend opens EventSource to /stream/analyze/{institution}
3. Backend streams SSE events:
   - status: "Fetching tweets from X API..."
   - progress: "Fetched 87 tweets"
   - result: {risk_level: "LOW", viral_score: 23, ...}
   - done: "Analysis complete"
4. Frontend renders progressive updates in real-time
5. If HIGH/MEDIUM risk: agent calls send_alert() → Slack
```

## Common Commands

### Backend Development
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start AG-UI server with SSE support (required for frontend)
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

## API Endpoints

### AG-UI Protocol (CopilotKit)
- `POST /` - AG-UI endpoint for agent communication

### SSE Streaming
- `GET /stream/analyze/{institution}` - Real-time analysis with progressive updates
- `POST /stream/batch` - Batch analysis for multiple institutions

### Direct Analysis
- `POST /analyze` - Single institution analysis (non-streaming)
- `POST /analyze/batch` - Multiple institutions (non-streaming)

### Monitoring
- `GET /health` - Health check with feature flags and X API status
- `GET /status` - Detailed API status with circuit breaker state
- `GET /trends/{institution}` - Tweet volume trends (uses /tweets/counts)

### Directory
- `GET /institutions` - List of supported institutions with categories

## Key Implementation Details

### Multi-Endpoint X API Integration (`tools.py`)
```python
class XAPIClient:
    # Endpoint 1: Tweet Search
    def search_recent_tweets(query, max_results, hours_back, sort_order)

    # Endpoint 2: Tweet Volume/Counts
    def get_tweet_counts(query, granularity, hours_back)

    # Endpoint 3: User Lookup
    def lookup_users(usernames)

    # Combined Analysis
    def get_institution_mentions(institution_name, max_results, include_trend_data)
```

### Circuit Breaker Pattern (`tools.py`)
```python
class CircuitBreaker:
    CLOSED -> OPEN -> HALF_OPEN -> CLOSED
    - failure_threshold: 5
    - recovery_timeout: 60s
    - half_open_max_calls: 3
```

### SSE Event Types (`api_server.py`)
```
event: status   → {"stage": "fetching", "message": "..."}
event: progress → {"stage": "tweets_fetched", "tweet_count": 87}
event: result   → {"risk_level": "LOW", "analysis": {...}}
event: done     → {"message": "Analysis complete"}
event: error    → {"message": "Rate limited"}
```

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
4. **Test SSE**: Click "Stream Analysis" in sidebar
5. **Example queries**:
   - "Analyze Coinbase and Robinhood for risks"
   - "Check if there are any issues with Chase right now"
   - "Monitor my portfolio: Fidelity, MetaMask, Venmo"

## Important Notes

- Backend must be running on `localhost:8000` before starting frontend
- The system uses **real X API data**, not mock data
- Rate limits apply: circuit breaker protects against cascading failures
- Slack alerts require valid `SLACK_BOT_TOKEN` with `chat:write` scope
- Frontend expects specific JSON format from tools (see `tools.py` for schema)
- All API keys must be set in `.env` at project root (not in `frontend/.env.local`)
- SSE endpoints require proper CORS configuration for cross-origin requests
