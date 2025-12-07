# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Financial Sentinel** is a real-time financial risk monitoring system built for the Grok x X API hackathon. It monitors 80+ financial institutions (banks, crypto exchanges, wallets, trading apps, payment services) for idiosyncratic risks using:

- **X API (api.x.com)** - Official X SDK (`xdk`) with multi-endpoint integration
- **Grok 4.1 Fast (api.x.ai)** - Analyzes sentiment and identifies risks with grounded traceability
- **Google ADK v1.20+** - Orchestrates the AI agent
- **CopilotKit + AG-UI** - Powers the interactive chat frontend
- **Slack API** - Sends alerts for HIGH/MEDIUM risk findings

## Hackathon Evaluation Criteria - Excellence Implementation

This project is designed to EXCEL in all five judging dimensions:

### 1. Depth & Centrality of X API Usage
**Goal:** Indispensable and sophisticated integration with multiple endpoints, streams, webhooks, and SDKs.

**Implementation:**
- **Location:** `tools.py:142-742` (XAPIClient class using official `xdk` library)
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
- **Location:** `tools.py:47-100` (CircuitBreaker), `tools.py:101-140` (exponential backoff)
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
  - Uses `grok-4-1-fast` with `search_parameters: {"mode": "auto"}`
- **Health Monitoring:**
  - `/health` endpoint with circuit breaker status
  - `/status` endpoint with full API metrics
  - Request count, success count, error count tracking

### 4. Intelligence & Value Created from X Data
**Goal:** Creatively transform raw X objects into signals, predictions, alerts, or actions the official client can't provide.

**Implementation:**
- **Location:** `tools.py:1094-1396` (GrokClient), `tools.py:1732-1841` (Grok Live Search)
- **Viral Risk Scoring (0-100):** Formula: `min(100, (total_engagement / tweet_count) * (1 + verified_count / 10))`
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
- **Location:** `tools.py:1094-1396` (GrokClient), `tools.py:1397-1731` (GrokAnalysisClient), `agent.py:27-93` & `api_server.py:75-158` (prompts)
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
tools.py            → Multi-endpoint X API client, Grok analyzer, Slack alerter (2,774 lines)
                      - XAPIClient: Official xdk SDK wrapper (lines 142-742)
                      - CircuitBreaker: Resilience pattern (lines 47-100)
                      - GrokClient: OpenAI-compatible analyzer (lines 1094-1396)
                      - GrokAnalysisClient: xai_sdk wrapper for stateful analysis (lines 1397-1731)
                      - StreamMonitor: Filtered stream with spike detection (lines 2256-2743)
                      - InstitutionRegistry: 80+ classified institutions (lines 755-875)
api_server.py       → FastAPI server with 21 endpoints (1,026 lines)
                      - SSE streaming: /stream/analyze, /stream/batch
                      - Monitoring: /monitor/start, /monitor/stream, /monitor/rules
                      - Session: /analyze/continue, /analyze/mode
                      - Health: /health, /status, /trends, /institutions
agent.py            → ADK Agent definition with Grok 4.1 Fast via LiteLLM (234 lines)
main.py             → Standalone monitoring loop (continuous mode) (410 lines)

financial_sentinel/ → Experimental modular agent structure
                      - agent_factory.py: Alternate agent configuration
                      - agent.py: Minimal wrapper
```

### Frontend: Next.js + CopilotKit
```
frontend/
  src/app/
    page.tsx                      → Main chat UI (1,562 lines)
                                    - SSE streaming integration (lines 427-492)
                                    - Live filtered stream monitoring (lines 494-684)
                                    - Continuous monitoring with intervals (lines 393-424)
                                    - Risk card component (lines 118-270)
                                    - Institution selection sidebar (lines 785-1150)
                                    - Live events panel (lines 1208-1429)
    layout.tsx                    → CopilotKit wrapper, metadata (39 lines)
    api/copilotkit/route.ts       → CopilotRuntime → HttpAgent → AG-UI (26 lines)
  globals.css                     → Risk card styling (HIGH/MEDIUM/LOW)

mobile-app/                       → React Native/Expo mobile implementation (WIP)
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

## API Endpoints (21 total)

### AG-UI Protocol (CopilotKit)
- `POST /` - AG-UI endpoint for agent communication

### SSE Streaming
- `GET /stream/analyze/{institution}` - Real-time analysis with progressive updates
- `POST /stream/batch` - Batch analysis for multiple institutions

### Direct Analysis
- `POST /analyze` - Single institution analysis (non-streaming)
- `POST /analyze/batch` - Multiple institutions (non-streaming)

### Stream Monitoring (Filtered Stream)
- `POST /monitor/start` - Start filtered stream monitoring
- `GET /monitor/stream` - SSE stream of live tweets
- `POST /monitor/stop` - Stop monitoring
- `GET /monitor/status` - Current monitor status
- `POST /monitor/add` - Add institution to monitor
- `POST /monitor/analyze-buffer` - Analyze buffered tweets
- `POST /monitor/sync` - Sync stream rules with X API
- `DELETE /monitor/rules` - Clear all stream rules
- `GET /monitor/rules` - List active rules
- `GET /monitor/stats` - Monitoring statistics

### Session Continuation (Responses API)
- `POST /analyze/continue` - Continue analysis with follow-up
- `GET /analyze/trend/{institution}` - Get trend analysis
- `GET /analyze/mode/{institution}` - Get analysis mode settings

### Health & Status
- `GET /health` - Health check with feature flags and X API status
- `GET /status` - Detailed API status with circuit breaker state
- `GET /trends/{institution}` - Tweet volume trends (uses /tweets/counts)
- `GET /institution/{name}/context` - Get institution context data

### Directory
- `GET /institutions` - List of 28 supported institutions with categories

## Key Implementation Details

### Multi-Endpoint X API Integration (`tools.py`)
```python
class XAPIClient:  # Uses official xdk library (lines 142-742)
    # Endpoint 1: Tweet Search
    def search_recent_tweets(query, max_results, hours_back, sort_order)

    # Endpoint 2: Tweet Volume/Counts
    def get_tweet_counts(query, granularity, hours_back)

    # Endpoint 3: User Lookup
    def lookup_users(usernames)

    # Endpoint 4: Filtered Stream (Real-time)
    def stream_posts()  # via StreamMonitor class

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

The system monitors 80+ institutions across 7 categories (defined in `tools.py:755-875`):

| Category | Count | Examples |
|----------|-------|----------|
| Traditional Banks | 20 | Chase, Wells Fargo, JP Morgan, SVB, HSBC, Citi |
| Neobanks | 14 | Chime, SoFi, Revolut, N26, Monzo, Current |
| Crypto Exchanges | 16 | Coinbase, Binance, Kraken, Gemini, FTX, KuCoin |
| Crypto Wallets | 17 | MetaMask, Phantom, Ledger, Trezor, Trust Wallet |
| Trading Platforms | 19 | Robinhood, Fidelity, E*TRADE, Schwab, TD Ameritrade |
| Payment Apps | 15 | Venmo, PayPal, Cash App, Zelle, Wise |

**Note:** Frontend `/institutions` endpoint returns a curated subset of 28 institutions.

Full list available via API: `GET http://localhost:8000/institutions`

## Testing Workflow

1. **Start backend**: `python api_server.py` (runs on port 8000)
2. **Start frontend**: `cd frontend && npm run dev` (runs on port 3000)
3. **Test in browser**: Navigate to `http://localhost:3000`
4. **Test SSE**: Click "Stream Analysis" in sidebar
5. **Test Live Stream**: Click "Live Stream" button to start filtered stream monitoring
6. **Test Continuous Monitoring**: Set interval and click "Start Monitoring"
7. **Example queries**:
   - "Analyze Coinbase and Robinhood for risks"
   - "Check if there are any issues with Chase right now"
   - "Monitor my portfolio: Fidelity, MetaMask, Venmo"

## Important Notes

- Backend must be running on `localhost:8000` before starting frontend
- The system uses **real X API data** via official `xdk` SDK, not mock data
- Rate limits apply: circuit breaker protects against cascading failures
- Slack alerts require valid `SLACK_BOT_TOKEN` with `chat:write` scope
- Frontend expects specific JSON format from tools (see `tools.py` for schema)
- All API keys must be set in `.env` at project root (not in `frontend/.env.local`)
- SSE endpoints require proper CORS configuration for cross-origin requests
- **Filtered Stream** requires X API Pro tier for real-time tweet streaming
- **Dual SDK Architecture**: Uses both `xai_sdk` (stateful analysis) and `xdk` (X API)
- **Session Continuation**: Supports follow-up analysis via Responses API
