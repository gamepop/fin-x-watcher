"""
Financial Sentinel Agent
========================

ADK Agent configuration using:
- Grok 4.1 Fast via LiteLLM (OpenAI-compatible endpoint at api.x.ai)
- X API for real tweet data
- Google ADK for orchestration
"""

import os
from typing import Optional

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types

from tools import fetch_market_sentiment, send_alert


# =============================================================================
# System Prompt
# =============================================================================

FINANCIAL_SENTINEL_PROMPT = """You are a Financial Risk Sentinel. Your job is to analyze real-time data from X (Twitter) for Idiosyncratic Risk (specific threats to financial institutions).

## Your Mission
Monitor and analyze real-time tweet data to identify critical financial risks for ANY financial institution including:
- Traditional banks (Chase, Wells Fargo, etc.)
- Crypto exchanges (Coinbase, Binance, Kraken)
- Crypto wallets (MetaMask, Phantom, Ledger)
- Stock trading apps (Robinhood, Webull, E*TRADE)
- Robo-advisors (Wealthfront, Betterment)
- Payment apps (Venmo, Cash App, PayPal)
- Neobanks (Chime, SoFi)

## Risk Indicators to Monitor
- Platform outages or system failures
- Withdrawal freezes or delays
- Security breaches or hacks
- Fraud allegations
- Regulatory actions (SEC, CFTC, FDIC)
- Bank runs or mass withdrawals
- Rug pulls (crypto)
- Insolvency concerns
- Customer fund accessibility issues

## Your Workflow

1. **GATHER DATA**: When asked to analyze a financial institution, ALWAYS call the `fetch_market_sentiment` tool first. This tool:
   - Fetches real tweets from X API (api.x.com)
   - Analyzes them with Grok (api.x.ai)
   - Returns structured risk analysis

2. **INTERPRET RESULTS**: Review the analysis from the tool:
   - Check the `risk_level` field (HIGH, MEDIUM, LOW)
   - Review `key_findings` for specific concerns
   - Note `tweet_count` to assess data volume
   - Check `confidence` score

3. **TAKE ACTION**:
   - If risk is **HIGH**: IMMEDIATELY call `send_alert` with the summary
   - If risk is **MEDIUM**: Call `send_alert` for awareness
   - If risk is **LOW**: Report "All Clear for [Bank Name]"

## Response Format

Always structure your final response as:

```
Bank: [Name]
Data Source: X API (real tweets)
Tweets Analyzed: [count]
Risk Assessment: [HIGH/MEDIUM/LOW]
Confidence: [score]

Key Findings:
- [Finding 1]
- [Finding 2]

Action Taken: [Alert sent / All Clear]
```

## Important Guidelines

- This uses REAL data from the X API - no mock data
- Be precise about risk levels to avoid false alarms
- HIGH risk = genuine systemic threats only
- Always cite specific tweet-based evidence
- Time is critical for HIGH risk - act immediately
"""


# =============================================================================
# Agent Factory
# =============================================================================

def create_financial_sentinel_agent(
    model_id: str = "xai/grok-4-1-fast",
    api_key: Optional[str] = None
) -> Agent:
    """
    Create the Financial Sentinel agent with Grok via LiteLLM.

    The agent uses:
    - LiteLLM to route to xAI's Grok model (api.x.ai/v1)
    - Google ADK for orchestration
    - Custom tools that use X API + Grok for analysis

    Args:
        model_id: LiteLLM model identifier (default: xai/grok-4-1-fast)
        api_key: Optional API key (defaults to XAI_API_KEY env var)

    Returns:
        Configured Agent instance
    """
    xai_api_key = api_key or os.getenv("XAI_API_KEY")
    if not xai_api_key:
        raise ValueError("XAI_API_KEY must be set")

    # Set for LiteLLM
    os.environ["XAI_API_KEY"] = xai_api_key

    # Configure LiteLLM wrapper for Grok
    # LiteLLM routes to https://api.x.ai/v1 for xai/ models
    model = LiteLlm(model=model_id)

    # Create agent with tools
    agent = Agent(
        name="Financial_Sentinel",
        model=model,
        instruction=FINANCIAL_SENTINEL_PROMPT,
        description="Monitors banks for risk using X API + Grok analysis",
        tools=[fetch_market_sentiment, send_alert],
    )

    return agent


# =============================================================================
# Runner Utilities
# =============================================================================

async def create_runner_and_session(
    agent: Agent,
    app_name: str = "financial_sentinel",
    user_id: str = "sentinel_system"
) -> tuple[Runner, str]:
    """Create a Runner and session for the agent."""
    session_service = InMemorySessionService()

    session = await session_service.create_session(
        app_name=app_name,
        user_id=user_id
    )

    runner = Runner(
        agent=agent,
        app_name=app_name,
        session_service=session_service
    )

    return runner, session.id


async def run_agent_query(
    runner: Runner,
    user_id: str,
    session_id: str,
    query: str
) -> str:
    """Execute a query and collect the response."""
    content = types.Content(
        role='user',
        parts=[types.Part(text=query)]
    )

    response_text = ""

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content
    ):
        if hasattr(event, 'is_final_response') and event.is_final_response():
            if event.content and event.content.parts:
                response_text = event.content.parts[0].text
            break
        elif hasattr(event, 'text') and event.text:
            response_text += event.text
        elif hasattr(event, 'content') and event.content:
            if isinstance(event.content, str):
                response_text += event.content

    return response_text


async def analyze_bank(bank_name: str) -> str:
    """Convenience function to analyze a single bank."""
    agent = create_financial_sentinel_agent()
    runner, session_id = await create_runner_and_session(agent)

    query = f"Analyze {bank_name} for financial risks using real X API data."

    return await run_agent_query(
        runner=runner,
        user_id="sentinel_system",
        session_id=session_id,
        query=query
    )


# =============================================================================
# Standalone Test
# =============================================================================

if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv

    load_dotenv()

    async def test():
        print("Testing Financial Sentinel Agent...")
        print("=" * 60)
        print("Using: X API (api.x.com) + Grok (api.x.ai)")
        print("=" * 60)

        result = await analyze_bank("Chase")
        print(result)

    asyncio.run(test())
