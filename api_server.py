"""
Financial Sentinel - AG-UI API Server (Enhanced for Hackathon Excellence)
=========================================================================
FastAPI server exposing the ADK agent via AG-UI protocol for CopilotKit frontend.

REAL-TIME RESPONSIVENESS FEATURES:
- Server-Sent Events (SSE) for live analysis updates
- WebSocket support for bidirectional communication
- Streaming endpoints for progressive results
- Health monitoring with circuit breaker status
"""

import os
import json
import asyncio
from typing import List, Optional, AsyncGenerator
from datetime import datetime, timezone
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint

from tools import (
    fetch_market_sentiment,
    send_alert,
    XAPIClient,
    GrokClient,
    GrokAnalysisClient,
    StreamMonitor,
    create_stream_monitor,
    stream_institution_updates,
    _grok_live_search_analysis,
    continue_analysis,
    get_institution_context
)

load_dotenv()


# =============================================================================
# Request/Response Models
# =============================================================================

class AnalysisRequest(BaseModel):
    """Request model for analysis endpoints."""
    institution: str
    include_trend_data: bool = True


class BatchAnalysisRequest(BaseModel):
    """Request model for batch analysis."""
    institutions: List[str]


class StreamEvent(BaseModel):
    """SSE event model."""
    event: str
    data: dict
    timestamp: str


# =============================================================================
# Financial Sentinel Agent Configuration (Enhanced)
# =============================================================================

SYSTEM_PROMPT = """You are the Financial Sentinel, an elite AI assistant that monitors financial institutions for risk indicators in real-time using sophisticated X API integration.

## Your Capabilities
You analyze ANY financial institution with COMPREHENSIVE data gathering:
- Traditional banks (Chase, Wells Fargo, Bank of America)
- Crypto exchanges (Coinbase, Binance, Kraken)
- Crypto wallets (MetaMask, Phantom, Ledger)
- Stock trading apps (Robinhood, Webull, E*TRADE, Fidelity)
- Robo-advisors (Wealthfront, Betterment)
- Payment apps (Venmo, Cash App, PayPal)
- Neobanks (Chime, SoFi)

## Data Sources & Integration
Your analysis leverages SOPHISTICATED X API integration:
1. **Multiple Endpoints**: /tweets/search/recent + /tweets/counts/recent
2. **Trend Detection**: Volume velocity analysis over time
3. **Viral Scoring**: Engagement-weighted risk signals
4. **Verification Weighting**: Verified accounts carry more weight
5. **Full Traceability**: Every finding includes tweet URLs

## Available Tools

1. **fetch_market_sentiment(institution_name)**: Fetches real-time tweets from X API and analyzes them with Grok. Returns:
   - risk_level: HIGH, MEDIUM, or LOW
   - tweet_count: Number of tweets analyzed
   - key_findings: Specific concerns found with source URLs
   - viral_score: Engagement-weighted risk indicator (0-100)
   - trend_velocity: Volume change percentage
   - evidence_tweets: Top 3 tweets with URLs

2. **send_alert(bank_name, risk_level, summary)**: Sends a Slack alert for HIGH or MEDIUM risk situations.

## How to Respond

When a user asks to analyze institutions:
1. Use fetch_market_sentiment for each institution
2. Parse the returned JSON to get the risk_level from the analysis
3. **ALWAYS call send_alert for HIGH or MEDIUM risk** - this is mandatory!
4. Present results with:
   - Risk level badge
   - Key findings with source tweet URLs
   - Viral score and trend data
   - Evidence tweets from X
5. Suggest related institutions they might want to monitor

## CRITICAL: Alert Rules
- If risk_level is "HIGH": IMMEDIATELY call send_alert(bank_name, "HIGH", summary)
- If risk_level is "MEDIUM": IMMEDIATELY call send_alert(bank_name, "MEDIUM", summary)
- If risk_level is "LOW": No alert needed, just report the findings

## Response Format

Structure your response clearly:
```
📊 **[Institution Name]** | Risk: [HIGH/MEDIUM/LOW]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 **Analysis Metrics**
- Tweets analyzed: [count]
- Viral score: [score]/100
- Trend: [velocity]% [↑/↓]

🔍 **Key Findings**
- [Finding 1] (source: [tweet URL])
- [Finding 2] (source: [tweet URL])

📱 **Evidence Tweets**
1. @username: "tweet text..." [View](URL)
2. @username: "tweet text..." [View](URL)

✅ **Action**: [Alert sent / All clear]
```

## Example Workflow

User: "Check Chase"
1. Call fetch_market_sentiment("Chase")
2. Parse result: risk_level = "MEDIUM", summary = "Fraud concerns..."
3. Call send_alert("Chase", "MEDIUM", "Fraud concerns...") <- MANDATORY
4. Present findings with tweet URLs to user

User: "Monitor my portfolio: Chase, Fidelity, Coinbase"
→ Analyze all three, send alerts for any HIGH/MEDIUM, provide comprehensive summary with sources
"""


def create_sentinel_agent() -> Agent:
    """Create the Financial Sentinel ADK agent."""

    xai_api_key = os.getenv("XAI_API_KEY")
    if not xai_api_key:
        raise ValueError("XAI_API_KEY must be set")

    os.environ["XAI_API_KEY"] = xai_api_key

    model = LiteLlm(model="xai/grok-4-1-fast")

    agent = Agent(
        name="FinancialSentinel",
        model=model,
        instruction=SYSTEM_PROMPT,
        description="Monitors financial institutions for risk using multi-endpoint X API + Grok analysis with full traceability",
        tools=[fetch_market_sentiment, send_alert],
    )

    return agent


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Financial Sentinel API",
    description="AG-UI endpoint for Financial Sentinel ADK agent with real-time SSE support",
    version="2.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create ADK agent wrapped with AG-UI
sentinel_agent = create_sentinel_agent()
adk_agent = ADKAgent(
    adk_agent=sentinel_agent,
    app_name="financial_sentinel",
    user_id="web_user",
    session_timeout_seconds=3600,
    use_in_memory_services=True
)

# Add AG-UI endpoint
add_adk_fastapi_endpoint(app, adk_agent, path="/")


# =============================================================================
# Health & Status Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Comprehensive health check with API status."""
    try:
        x_client = XAPIClient()
        api_health = x_client.get_api_health()
    except Exception as e:
        api_health = {"error": str(e)}

    return {
        "status": "healthy",
        "agent": "FinancialSentinel",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "features": {
            "multi_endpoint_x_api": True,
            "circuit_breaker": True,
            "viral_scoring": True,
            "trend_detection": True,
            "sse_streaming": True
        },
        "x_api_health": api_health
    }


@app.get("/status")
async def api_status():
    """Detailed API status including X API circuit breaker state."""
    try:
        x_client = XAPIClient()
        return {
            "service": "Financial Sentinel",
            "uptime": "active",
            "x_api": x_client.get_api_health(),
            "endpoints": {
                "/tweets/search/recent": "enabled",
                "/tweets/counts/recent": "enabled",
                "/users/by": "enabled"
            },
            "resilience": {
                "circuit_breaker": "active",
                "exponential_backoff": "enabled",
                "grok_fallback": "available"
            }
        }
    except Exception as e:
        return {"error": str(e)}


# =============================================================================
# Real-time SSE Streaming Endpoints
# =============================================================================

async def generate_analysis_stream(institution: str) -> AsyncGenerator[str, None]:
    """
    Generate SSE events for real-time analysis updates.

    This enables the frontend to show progressive updates as analysis runs:
    1. Fetching tweets from X API...
    2. Analyzing tweet volume trends...
    3. Running Grok sentiment analysis...
    4. Calculating risk scores...
    5. Analysis complete with results

    Falls back to Grok Live Search when X API is rate limited.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    use_fallback = False
    rate_limit_error = None

    # Stage 1: Starting
    yield f"event: status\ndata: {json.dumps({'stage': 'starting', 'message': f'Starting analysis of {institution}...', 'timestamp': timestamp})}\n\n"
    await asyncio.sleep(0.1)

    # Stage 2: Fetching from X API
    yield f"event: status\ndata: {json.dumps({'stage': 'fetching', 'message': 'Fetching tweets from X API (api.x.com)...', 'timestamp': timestamp})}\n\n"

    try:
        x_client = XAPIClient()
        grok_client = GrokClient()

        # Stage 3: Search tweets
        yield f"event: status\ndata: {json.dumps({'stage': 'searching', 'message': 'Searching /tweets/search/recent endpoint...', 'timestamp': timestamp})}\n\n"

        tweet_data = x_client.get_institution_mentions(
            institution,
            max_results=100,
            include_trend_data=True
        )

        tweet_count = tweet_data.get("total_fetched", 0)
        yield f"event: progress\ndata: {json.dumps({'stage': 'tweets_fetched', 'message': f'Fetched {tweet_count} tweets', 'tweet_count': tweet_count, 'timestamp': timestamp})}\n\n"
        await asyncio.sleep(0.1)

        # Stage 4: Trend analysis
        trend_data = tweet_data.get("trend_data", {})
        if trend_data and not trend_data.get("error"):
            velocity = trend_data.get("velocity_change_percent", 0)
            is_spiking = trend_data.get("is_spiking", False)
            yield f"event: progress\ndata: {json.dumps({'stage': 'trend_analyzed', 'message': f'Volume trend: {velocity:+.1f}%', 'velocity': velocity, 'is_spiking': is_spiking, 'timestamp': timestamp})}\n\n"
        await asyncio.sleep(0.1)

        # Stage 5: Grok analysis
        yield f"event: status\ndata: {json.dumps({'stage': 'analyzing', 'message': 'Running Grok sentiment analysis (api.x.ai)...', 'timestamp': timestamp})}\n\n"

        analysis = grok_client.analyze_sentiment(institution, tweet_data)
        await asyncio.sleep(0.1)

        # Stage 6: Results
        risk_level = analysis.get("risk_level", "UNKNOWN")
        yield f"event: result\ndata: {json.dumps({'stage': 'complete', 'institution': institution, 'risk_level': risk_level, 'analysis': analysis, 'tweet_count': tweet_count, 'data_source': 'X API v2 + Grok', 'timestamp': timestamp})}\n\n"

    except Exception as e:
        error_str = str(e).lower()
        if "rate limit" in error_str or "circuit breaker" in error_str:
            use_fallback = True
            rate_limit_error = str(e)
        else:
            yield f"event: error\ndata: {json.dumps({'stage': 'error', 'message': str(e), 'timestamp': timestamp})}\n\n"

    # Fallback to Grok Live Search when X API is rate limited
    if use_fallback:
        yield f"event: status\ndata: {json.dumps({'stage': 'fallback', 'message': 'X API rate limited, switching to Grok Live Search...', 'timestamp': timestamp})}\n\n"
        await asyncio.sleep(0.1)

        try:
            yield f"event: status\ndata: {json.dumps({'stage': 'grok_search', 'message': 'Grok searching X in real-time...', 'timestamp': timestamp})}\n\n"

            # Run Grok live search in thread pool to not block
            loop = asyncio.get_event_loop()
            analysis = await loop.run_in_executor(None, _grok_live_search_analysis, institution)

            risk_level = analysis.get("risk_level", "UNKNOWN")
            yield f"event: result\ndata: {json.dumps({'stage': 'complete', 'institution': institution, 'risk_level': risk_level, 'analysis': analysis, 'data_source': 'Grok Live Search (X API fallback)', 'fallback_reason': rate_limit_error, 'timestamp': timestamp})}\n\n"

        except Exception as fallback_error:
            yield f"event: error\ndata: {json.dumps({'stage': 'error', 'message': f'Both X API and Grok fallback failed: {str(fallback_error)}', 'timestamp': timestamp})}\n\n"

    # Final event
    yield f"event: done\ndata: {json.dumps({'stage': 'done', 'message': 'Analysis complete', 'timestamp': timestamp})}\n\n"


@app.get("/stream/analyze/{institution}")
async def stream_analysis(institution: str):
    """
    Stream analysis results via Server-Sent Events (SSE).

    This endpoint enables real-time responsiveness by streaming updates
    as the analysis progresses through each stage.

    Usage:
    ```javascript
    const eventSource = new EventSource('/stream/analyze/Chase');
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data.stage, data.message);
    };
    eventSource.addEventListener('result', (event) => {
        const result = JSON.parse(event.data);
        console.log('Risk Level:', result.risk_level);
    });
    ```
    """
    return StreamingResponse(
        generate_analysis_stream(institution),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@app.post("/stream/batch")
async def stream_batch_analysis(request: BatchAnalysisRequest):
    """
    Stream batch analysis for multiple institutions.

    Returns SSE stream with updates for each institution being analyzed.
    """
    async def generate_batch_stream():
        for idx, institution in enumerate(request.institutions):
            yield f"event: batch_progress\ndata: {json.dumps({'current': idx + 1, 'total': len(request.institutions), 'institution': institution})}\n\n"

            async for event in generate_analysis_stream(institution):
                yield event

            # Small delay between institutions to respect rate limits
            if idx < len(request.institutions) - 1:
                await asyncio.sleep(1)

        yield f"event: batch_complete\ndata: {json.dumps({'total_analyzed': len(request.institutions)})}\n\n"

    return StreamingResponse(
        generate_batch_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


# =============================================================================
# Direct Analysis Endpoints (Non-streaming)
# =============================================================================

@app.post("/analyze")
async def analyze_institution(request: AnalysisRequest):
    """
    Analyze a single institution (non-streaming).

    Returns complete analysis results in a single response.
    For real-time updates, use /stream/analyze/{institution} instead.
    """
    try:
        result = fetch_market_sentiment(request.institution)
        return JSONResponse(content=json.loads(result))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/batch")
async def analyze_batch(request: BatchAnalysisRequest):
    """
    Analyze multiple institutions (non-streaming).

    Returns array of analysis results.
    For real-time updates, use /stream/batch instead.
    """
    results = []
    for institution in request.institutions:
        try:
            result = fetch_market_sentiment(institution)
            results.append(json.loads(result))
        except Exception as e:
            results.append({
                "bank_name": institution,
                "status": "error",
                "error": str(e)
            })
        # Small delay between requests
        await asyncio.sleep(0.5)

    return {"results": results, "total": len(results)}


# =============================================================================
# Trend & Volume Endpoints
# =============================================================================

@app.get("/trends/{institution}")
async def get_institution_trends(institution: str, hours_back: int = 24):
    """
    Get tweet volume trends for an institution.

    Uses X API /tweets/counts/recent endpoint to detect:
    - Volume spikes indicating emerging issues
    - Velocity changes compared to earlier periods
    - Time series data for charting
    """
    try:
        x_client = XAPIClient()
        trend_data = x_client.get_tweet_counts(
            f'"{institution}"',
            granularity="hour",
            hours_back=hours_back
        )
        return {
            "institution": institution,
            "hours_analyzed": hours_back,
            "trend_data": trend_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Institution Directory
# =============================================================================

@app.get("/institutions")
async def get_institutions():
    """List of available institutions for frontend."""
    return {
        "institutions": [
            # Traditional Banks
            {"name": "Chase", "category": "bank", "icon": "🏦"},
            {"name": "Bank of America", "category": "bank", "icon": "🏦"},
            {"name": "Wells Fargo", "category": "bank", "icon": "🏦"},
            {"name": "Citibank", "category": "bank", "icon": "🏦"},
            {"name": "Capital One", "category": "bank", "icon": "🏦"},
            # Crypto Exchanges
            {"name": "Coinbase", "category": "crypto", "icon": "₿"},
            {"name": "Binance", "category": "crypto", "icon": "₿"},
            {"name": "Kraken", "category": "crypto", "icon": "₿"},
            {"name": "Gemini", "category": "crypto", "icon": "₿"},
            {"name": "Crypto.com", "category": "crypto", "icon": "₿"},
            # Crypto Wallets
            {"name": "MetaMask", "category": "wallet", "icon": "👛"},
            {"name": "Phantom", "category": "wallet", "icon": "👛"},
            {"name": "Ledger", "category": "wallet", "icon": "👛"},
            {"name": "Trust Wallet", "category": "wallet", "icon": "👛"},
            # Stock Trading
            {"name": "Robinhood", "category": "trading", "icon": "📈"},
            {"name": "Webull", "category": "trading", "icon": "📈"},
            {"name": "E*TRADE", "category": "trading", "icon": "📈"},
            {"name": "Fidelity", "category": "trading", "icon": "📈"},
            {"name": "Charles Schwab", "category": "trading", "icon": "📈"},
            {"name": "TD Ameritrade", "category": "trading", "icon": "📈"},
            # Robo-Advisors
            {"name": "Wealthfront", "category": "robo", "icon": "🤖"},
            {"name": "Betterment", "category": "robo", "icon": "🤖"},
            {"name": "Acorns", "category": "robo", "icon": "🤖"},
            # Payment Apps
            {"name": "Venmo", "category": "payment", "icon": "💸"},
            {"name": "Cash App", "category": "payment", "icon": "💸"},
            {"name": "PayPal", "category": "payment", "icon": "💸"},
            {"name": "Zelle", "category": "payment", "icon": "💸"},
            # Neobanks
            {"name": "Chime", "category": "neobank", "icon": "📱"},
            {"name": "SoFi", "category": "neobank", "icon": "📱"},
            {"name": "Revolut", "category": "neobank", "icon": "📱"},
            {"name": "Current", "category": "neobank", "icon": "📱"},
        ],
        "categories": [
            {"id": "bank", "name": "Traditional Banks", "icon": "🏦"},
            {"id": "crypto", "name": "Crypto Exchanges", "icon": "₿"},
            {"id": "wallet", "name": "Crypto Wallets", "icon": "👛"},
            {"id": "trading", "name": "Stock Trading", "icon": "📈"},
            {"id": "robo", "name": "Robo-Advisors", "icon": "🤖"},
            {"id": "payment", "name": "Payment Apps", "icon": "💸"},
            {"id": "neobank", "name": "Neobanks", "icon": "📱"},
        ],
        "features": {
            "x_api_endpoints": [
                "/tweets/search/recent",
                "/tweets/counts/recent",
                "/users/by"
            ],
            "analysis_features": [
                "Viral risk scoring",
                "Trend detection",
                "Verification weighting",
                "Full tweet URL traceability"
            ]
        }
    }


# =============================================================================
# Real-time Stream Monitor Endpoints (xdk Filtered Stream)
# =============================================================================

# Global stream monitor instance
_stream_monitor: Optional[StreamMonitor] = None


class MonitorRequest(BaseModel):
    """Request model for monitor endpoints."""
    institutions: List[str]


class ContinueAnalysisRequest(BaseModel):
    """Request for continuing analysis session."""
    institution: str
    follow_up: str


@app.post("/monitor/start")
async def start_monitor(request: MonitorRequest):
    """
    Start real-time monitoring for multiple institutions.

    Sets up filtered stream rules and begins monitoring.

    Args:
        institutions: List of institution names to monitor

    Returns:
        Status of monitor setup
    """
    global _stream_monitor

    try:
        _stream_monitor = create_stream_monitor(request.institutions)
        setup_result = await _stream_monitor.setup_stream()

        return {
            "status": "started",
            "institutions": request.institutions,
            "rules_setup": setup_result,
            "stream_endpoint": "/monitor/stream",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


@app.get("/monitor/stream")
async def stream_monitor_events():
    """
    Stream real-time events from the monitor via SSE.

    Returns Server-Sent Events for real-time monitoring:
    - tweet: New matching tweet detected
    - alert: High urgency event requiring attention
    - error: Stream error

    Usage:
    ```javascript
    const eventSource = new EventSource('/monitor/stream');

    eventSource.addEventListener('tweet', (e) => {
        const data = JSON.parse(e.data);
        console.log(`New tweet for ${data.institution}: ${data.text}`);
    });

    eventSource.addEventListener('alert', (e) => {
        const alert = JSON.parse(e.data);
        console.log(`ALERT: ${alert.message}`);
    });
    ```
    """
    global _stream_monitor

    if not _stream_monitor:
        async def error_stream():
            yield f"event: error\ndata: {json.dumps({'error': 'Monitor not started. Call POST /monitor/start first.'})}\n\n"

        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream"
        )

    async def generate_stream():
        async for event in _stream_monitor.stream():
            event_type = event.get("type", "message")
            yield f"event: {event_type}\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/monitor/stop")
async def stop_monitor():
    """Stop the real-time monitor."""
    global _stream_monitor

    if _stream_monitor:
        _stream_monitor.stop()
        institutions = list(_stream_monitor.monitored_institutions.keys())
        _stream_monitor = None
        return {
            "status": "stopped",
            "institutions_stopped": institutions,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    return {
        "status": "not_running",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/monitor/status")
async def get_monitor_status():
    """Get current monitor status."""
    global _stream_monitor

    if not _stream_monitor:
        return {
            "status": "not_running",
            "institutions": [],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    return {
        "status": "running",
        "institutions": _stream_monitor.get_monitored_institutions(),
        "active_rules": _stream_monitor.active_rules,
        "buffered_events": len(_stream_monitor.event_buffer),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/monitor/add")
async def add_institution_to_monitor(request: AnalysisRequest):
    """Add an institution to the active monitor."""
    global _stream_monitor

    if not _stream_monitor:
        return {
            "status": "error",
            "error": "Monitor not started. Call POST /monitor/start first."
        }

    result = _stream_monitor.add_institution(request.institution)
    return result


@app.post("/monitor/analyze-buffer")
async def analyze_buffered_events():
    """Analyze buffered events from the stream."""
    global _stream_monitor

    if not _stream_monitor:
        return {
            "status": "error",
            "error": "Monitor not started"
        }

    result = await _stream_monitor.analyze_buffered_events()
    return result


# =============================================================================
# Session Continuation Endpoints (Responses API)
# =============================================================================

@app.post("/analyze/continue")
async def continue_institution_analysis(request: ContinueAnalysisRequest):
    """
    Continue a previous analysis session with a follow-up question.

    Uses xai_sdk Responses API for stateful conversation.

    Args:
        institution: Institution being analyzed
        follow_up: Follow-up question or context

    Returns:
        Continued analysis with session context
    """
    try:
        result = continue_analysis(request.institution, request.follow_up)
        return JSONResponse(content=json.loads(result))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analyze/trend/{institution}")
async def get_risk_trend(institution: str):
    """
    Get risk trend for an institution based on analysis history.

    Returns trend data showing if risk is escalating, improving, or stable.
    """
    try:
        grok_client = GrokAnalysisClient()
        if grok_client.is_available():
            trend = grok_client.get_risk_trend(institution)
            return trend
        return {"error": "xai_sdk not available for trend tracking"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/institution/{name}/context")
async def get_institution_type_context(name: str):
    """
    Get institution type and risk context.

    Returns the classification, risk keywords, and analysis prompt section.
    """
    try:
        context = get_institution_context(name)
        return {
            "institution": name,
            "type": context["institution_type"],
            "risk_keywords": context["risk_keywords"],
            "prompt_section_preview": context["prompt_section"][:200] + "..."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("Financial Sentinel AG-UI Server v2.0")
    print("=" * 60)
    print("Features:")
    print("  - Multi-endpoint X API integration")
    print("  - SSE streaming for real-time updates")
    print("  - Circuit breaker for resilience")
    print("  - Viral scoring & trend detection")
    print("=" * 60)
    print("Endpoint: http://localhost:8000")
    print("SSE Stream: http://localhost:8000/stream/analyze/{institution}")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
