"""
Financial Sentinel - AG-UI API Server
=====================================
FastAPI server exposing the ADK agent via AG-UI protocol for CopilotKit frontend.
"""

import os
from typing import List, Optional
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint

from tools import fetch_market_sentiment, send_alert

load_dotenv()

# =============================================================================
# Financial Sentinel Agent Configuration
# =============================================================================

SYSTEM_PROMPT = """You are the Financial Sentinel, an AI assistant that monitors financial institutions for risk indicators in real-time.

## Your Capabilities
You can monitor ANY financial institution including:
- Traditional banks (Chase, Wells Fargo, Bank of America)
- Crypto exchanges (Coinbase, Binance, Kraken)
- Crypto wallets (MetaMask, Phantom, Ledger)
- Stock trading apps (Robinhood, Webull, E*TRADE, Fidelity)
- Robo-advisors (Wealthfront, Betterment)
- Payment apps (Venmo, Cash App, PayPal)
- Neobanks (Chime, SoFi)

## Available Tools

1. **fetch_market_sentiment(institution_name)**: Fetches real-time tweets from X API and analyzes them with Grok to assess risk level. Returns:
   - risk_level: HIGH, MEDIUM, or LOW
   - tweet_count: Number of tweets analyzed
   - key_findings: Specific concerns found
   - summary: Overall assessment

2. **send_alert(bank_name, risk_level, summary)**: Sends a Slack alert for HIGH or MEDIUM risk situations.

## How to Respond

When a user asks to analyze institutions:
1. Use fetch_market_sentiment for each institution
2. Parse the returned JSON to get the risk_level from the analysis
3. **ALWAYS call send_alert for HIGH or MEDIUM risk** - this is mandatory!
4. Present results clearly with risk levels
5. Suggest related institutions they might want to monitor

## CRITICAL: Alert Rules
- If risk_level is "HIGH": IMMEDIATELY call send_alert(bank_name, "HIGH", summary)
- If risk_level is "MEDIUM": IMMEDIATELY call send_alert(bank_name, "MEDIUM", summary)
- If risk_level is "LOW": No alert needed, just report the findings

When presenting results, be concise but informative. Highlight any concerning findings prominently.

## Example Workflow

User: "Check Chase"
1. Call fetch_market_sentiment("Chase")
2. Parse result: risk_level = "MEDIUM", summary = "Fraud concerns..."
3. Call send_alert("Chase", "MEDIUM", "Fraud concerns...") <- MANDATORY for MEDIUM/HIGH
4. Present findings to user

User: "Monitor my portfolio: Chase, Fidelity, Coinbase"
→ Analyze all three, send alerts for any HIGH/MEDIUM, provide summary
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
        description="Monitors financial institutions for risk using X API + Grok",
        tools=[fetch_market_sentiment, send_alert],
    )

    return agent


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Financial Sentinel API",
    description="AG-UI endpoint for Financial Sentinel ADK agent",
    version="1.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "agent": "FinancialSentinel"}

# List of available institutions for frontend
@app.get("/institutions")
async def get_institutions():
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
        ]
    }


if __name__ == "__main__":
    import uvicorn
    print("Starting Financial Sentinel AG-UI Server...")
    print("Endpoint: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
