"""
Financial Sentinel Tools
========================
Hackathon Track: Grok × X API

This module implements:
- X API integration for fetching real tweets (authenticated, rate-limit-aware)
- Grok API integration for sentiment analysis (OpenAI-compatible)
- Slack alerting with Block Kit formatting
"""

import os
import json
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

import requests
from openai import OpenAI
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from ratelimit import limits, sleep_and_retry


# =============================================================================
# X API Client (The "Eyes" - Data Collection)
# =============================================================================

class XAPIClient:
    """
    Authenticated X API v2 client for fetching real tweets.
    Implements rate-limit-aware requests as required by hackathon.
    """

    BASE_URL = "https://api.x.com/2"

    def __init__(self, bearer_token: Optional[str] = None):
        from urllib.parse import unquote
        raw_token = bearer_token or os.getenv("X_BEARER_TOKEN")
        if not raw_token:
            raise ValueError("X_BEARER_TOKEN is required for X API access")
        # Decode URL-encoded tokens (e.g., %3D -> =)
        self.bearer_token = unquote(raw_token)

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json"
        })

    @sleep_and_retry
    @limits(calls=1500, period=900)  # Pro tier: 1500 requests per 15 minutes
    def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Dict:
        """Make rate-limited request to X API."""
        url = f"{self.BASE_URL}/{endpoint}"

        response = self.session.get(url, params=params)

        # Handle rate limiting - don't wait forever, just report it
        if response.status_code == 429:
            reset_time = int(response.headers.get("x-rate-limit-reset", time.time() + 60))
            wait_seconds = max(reset_time - time.time(), 0)
            raise Exception(f"X API rate limited. Resets in {int(wait_seconds)} seconds.")

        response.raise_for_status()
        return response.json()

    def search_recent_tweets(
        self,
        query: str,
        max_results: int = 100,
        hours_back: int = 24
    ) -> List[Dict]:
        """
        Search for recent tweets matching a query.

        Args:
            query: Search query (e.g., "Chase bank" OR "Chase outage")
            max_results: Maximum number of tweets to return (10-100)
            hours_back: How many hours back to search (max 168 for recent)

        Returns:
            List of tweet dictionaries with text, metrics, and author info
        """
        # Calculate start time
        start_time = (datetime.now(timezone.utc) - timedelta(hours=hours_back))
        start_time_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        params = {
            "query": f"{query} -is:retweet lang:en",
            "max_results": min(max_results, 100),
            "start_time": start_time_str,
            "tweet.fields": "created_at,public_metrics,author_id,text,context_annotations",
            "expansions": "author_id",
            "user.fields": "username,verified,public_metrics"
        }

        try:
            data = self._make_request("tweets/search/recent", params)

            tweets = []
            users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}

            for tweet in data.get("data", []):
                author = users.get(tweet.get("author_id"), {})
                tweets.append({
                    "id": tweet.get("id"),
                    "text": tweet.get("text"),
                    "created_at": tweet.get("created_at"),
                    "author_username": author.get("username", "unknown"),
                    "author_verified": author.get("verified", False),
                    "author_followers": author.get("public_metrics", {}).get("followers_count", 0),
                    "retweets": tweet.get("public_metrics", {}).get("retweet_count", 0),
                    "likes": tweet.get("public_metrics", {}).get("like_count", 0),
                    "replies": tweet.get("public_metrics", {}).get("reply_count", 0),
                })

            return tweets

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                raise ValueError("X API authentication failed. Check your bearer token.")
            raise

    def get_institution_mentions(self, institution_name: str, max_results: int = 100) -> List[Dict]:
        """
        Get recent tweets mentioning a financial institution with risk keywords.

        Args:
            institution_name: Name of the institution (bank, exchange, app, etc.)

        Returns:
            List of relevant tweets
        """
        # Build query for financial risk indicators (covers banks, crypto, trading apps)
        risk_keywords = [
            # General
            "outage", "down", "not working", "can't access", "can't login",
            "fraud", "scam", "hack", "breach", "warning",
            # Banking
            "bank run", "withdraw", "frozen", "closed", "fdic", "bankrupt",
            # Crypto specific
            "rug pull", "rugpull", "exit scam", "funds locked", "can't withdraw",
            "insolvency", "paused withdrawals", "halted",
            # Trading apps
            "can't sell", "can't buy", "order stuck", "margin call",
            # Regulatory
            "sec", "lawsuit", "investigation", "subpoena"
        ]

        # Primary query for the institution
        primary_query = f'"{institution_name}"'

        # Risk-focused query
        risk_query = f'{primary_query} ({" OR ".join(risk_keywords[:10])})'  # Top 10 keywords

        tweets = []
        rate_limit_error = None

        # First, get risk-focused tweets
        try:
            risk_tweets = self.search_recent_tweets(risk_query, max_results=50)
            tweets.extend(risk_tweets)
        except Exception as e:
            if "rate limit" in str(e).lower():
                rate_limit_error = e
            # Continue with general query if risk query fails

        # Then get general sentiment tweets
        try:
            general_tweets = self.search_recent_tweets(primary_query, max_results=50)
            # Deduplicate
            existing_ids = {t["id"] for t in tweets}
            for t in general_tweets:
                if t["id"] not in existing_ids:
                    tweets.append(t)
        except Exception as e:
            if "rate limit" in str(e).lower():
                rate_limit_error = e

        # If we got no tweets and hit rate limit, raise it
        if not tweets and rate_limit_error:
            raise rate_limit_error

        return tweets[:max_results]


# =============================================================================
# Grok API Client (The "Brain" - Analysis)
# =============================================================================

class GrokClient:
    """
    Grok API client using OpenAI-compatible endpoint.
    Endpoint: https://api.x.ai/v1
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("XAI_API_KEY")
        if not self.api_key:
            raise ValueError("XAI_API_KEY is required for Grok API access")

        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.x.ai/v1"
        )

    def analyze_sentiment(
        self,
        bank_name: str,
        tweets: List[Dict],
        model: str = "grok-4-1-fast"
    ) -> Dict[str, Any]:
        """
        Analyze sentiment of tweets using Grok.

        Args:
            bank_name: Name of the bank being analyzed
            tweets: List of tweet dictionaries from X API
            model: Grok model to use

        Returns:
            Structured analysis with risk level and findings
        """
        if not tweets:
            return {
                "risk_level": "LOW",
                "summary": f"No recent tweets found mentioning {bank_name}.",
                "key_findings": [],
                "tweet_count": 0,
                "high_engagement_tweets": []
            }

        # Format tweets for analysis
        tweets_text = self._format_tweets_for_analysis(tweets)

        system_prompt = """You are a financial risk analyst specializing in monitoring financial institutions including banks, crypto exchanges, trading apps, robo-advisors, and payment platforms.

Analyze the provided tweets and assess the risk level.

RISK LEVELS:
- HIGH: Platform-wide outages, withdrawal freezes, hack/breach confirmed, regulatory action announced, bank run signals, rug pull indicators, insolvency concerns
- MEDIUM: Localized outages, elevated complaints, unconfirmed rumors spreading, isolated access issues, delayed transactions
- LOW: Normal operations, routine complaints, minor bugs, no systemic indicators

INSTITUTION-SPECIFIC SIGNALS:
- Banks: FDIC mentions, bank run, mass withdrawals
- Crypto: Rug pull, exit scam, funds locked, paused withdrawals, cold wallet drained
- Trading Apps: Can't execute trades, margin calls, order failures during volatility
- Payment Apps: Frozen accounts, failed transfers, fraud waves

IMPORTANT:
- Differentiate between routine complaints (LOW) and systemic issues (HIGH)
- Look for VOLUME and VELOCITY of complaints
- High-engagement tweets from verified accounts carry more weight
- Ignore promotional content and unrelated mentions

Respond in JSON format:
{
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "summary": "Brief overall assessment",
    "key_findings": ["Finding 1", "Finding 2"],
    "concerning_tweets": ["Tweet text 1", "Tweet text 2"],
    "confidence": 0.0-1.0
}"""

        user_prompt = f"""Analyze these tweets about {bank_name} for financial risk indicators:

{tweets_text}

Total tweets analyzed: {len(tweets)}
Time range: Last 24 hours"""

        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            result["tweet_count"] = len(tweets)
            result["model_used"] = model
            return result

        except Exception as e:
            return {
                "risk_level": "UNKNOWN",
                "summary": f"Error during analysis: {str(e)}",
                "key_findings": [],
                "tweet_count": len(tweets),
                "error": str(e)
            }

    def _format_tweets_for_analysis(self, tweets: List[Dict], max_tweets: int = 50) -> str:
        """Format tweets for Grok analysis."""
        # Sort by engagement (likes + retweets)
        sorted_tweets = sorted(
            tweets,
            key=lambda t: t.get("likes", 0) + t.get("retweets", 0) * 2,
            reverse=True
        )[:max_tweets]

        formatted = []
        for i, tweet in enumerate(sorted_tweets, 1):
            verified = "[VERIFIED]" if tweet.get("author_verified") else ""
            followers = tweet.get("author_followers", 0)
            engagement = f"[{tweet.get('likes', 0)} likes, {tweet.get('retweets', 0)} RTs]"

            formatted.append(
                f"{i}. @{tweet.get('author_username')} {verified} "
                f"({followers:,} followers) {engagement}:\n"
                f"   \"{tweet.get('text', '')[:280]}\""
            )

        return "\n\n".join(formatted)


# =============================================================================
# Grok Live Search Fallback (When X API is rate limited)
# =============================================================================

def _grok_live_search_analysis(bank_name: str) -> Dict[str, Any]:
    """
    Use Grok's live search capability to analyze sentiment when X API is rate limited.
    Grok can search X/Twitter in real-time as part of its response.
    """
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY is required for Grok fallback")

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.x.ai/v1"
    )

    system_prompt = """You are a financial risk analyst with real-time access to X (Twitter) data.

IMPORTANT: You have live search enabled. Search X/Twitter for recent posts about the institution.

Analyze real-time social media sentiment for financial risk indicators.

RISK LEVELS:
- HIGH: Platform-wide outages, withdrawal freezes, hack/breach confirmed, regulatory action, bank run signals
- MEDIUM: Localized outages, elevated complaints, unconfirmed rumors, isolated access issues
- LOW: Normal operations, routine complaints, minor bugs, no systemic issues

Return your analysis as JSON:
{
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "summary": "Brief overall assessment based on what you found",
    "key_findings": ["Finding 1", "Finding 2"],
    "sample_posts": ["Relevant post 1", "Relevant post 2"],
    "post_count_estimate": "approximate number of relevant posts found",
    "confidence": 0.0-1.0
}"""

    user_prompt = f"""Search X/Twitter for recent posts about "{bank_name}" and analyze for financial risk indicators.

Look for:
- Outage reports, service issues
- Fraud or security concerns
- Withdrawal or access problems
- Regulatory news
- Customer complaints at unusual volume

Provide your risk assessment based on what you find in real-time."""

    try:
        response = client.chat.completions.create(
            model="grok-3-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1500,
            extra_body={"search_parameters": {"mode": "auto"}}
        )

        content = response.choices[0].message.content

        # Try to parse as JSON
        try:
            # Find JSON in the response
            import re
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                result = json.loads(json_match.group())
                return result
        except json.JSONDecodeError:
            pass

        # Fallback: return as summary
        return {
            "risk_level": "UNKNOWN",
            "summary": content[:500],
            "key_findings": [],
            "confidence": 0.5
        }

    except Exception as e:
        return {
            "risk_level": "UNKNOWN",
            "summary": f"Grok search error: {str(e)}",
            "key_findings": [],
            "error": str(e)
        }


# =============================================================================
# Combined Sentiment Tool (ADK Tool Function)
# =============================================================================

def fetch_market_sentiment(bank_name: str) -> str:
    """
    Fetch real-time market sentiment for a specific bank.

    This tool:
    1. Uses X API to fetch real tweets about the bank
    2. Uses Grok to analyze sentiment and assess risk level
    3. Falls back to Grok live search if X API is rate limited

    Args:
        bank_name: The name of the bank to analyze (e.g., "Chase", "Wells Fargo")

    Returns:
        JSON string containing structured sentiment analysis
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    use_fallback = False
    rate_limit_error = None

    try:
        # Initialize clients
        x_client = XAPIClient()
        grok_client = GrokClient()

        # Fetch tweets from X API
        tweets = x_client.get_institution_mentions(bank_name, max_results=100)

        # Analyze with Grok
        analysis = grok_client.analyze_sentiment(bank_name, tweets)

        return json.dumps({
            "bank_name": bank_name,
            "status": "success",
            "timestamp": timestamp,
            "data_source": "X API (api.x.com)",
            "analysis_model": "Grok (api.x.ai)",
            "tweet_count": len(tweets),
            "analysis": analysis
        }, indent=2)

    except Exception as e:
        error_str = str(e).lower()
        if "rate limit" in error_str:
            use_fallback = True
            rate_limit_error = str(e)
        else:
            return json.dumps({
                "bank_name": bank_name,
                "status": "error",
                "error": f"Error: {str(e)}",
                "timestamp": timestamp
            }, indent=2)

    # Fallback to Grok live search when X API is rate limited
    if use_fallback:
        try:
            analysis = _grok_live_search_analysis(bank_name)

            return json.dumps({
                "bank_name": bank_name,
                "status": "success",
                "timestamp": timestamp,
                "data_source": "Grok Live Search (X API rate limited)",
                "analysis_model": "Grok with live X search",
                "fallback_reason": rate_limit_error,
                "analysis": analysis
            }, indent=2)

        except Exception as fallback_error:
            return json.dumps({
                "bank_name": bank_name,
                "status": "error",
                "error": f"Both X API and Grok fallback failed. X API: {rate_limit_error}. Grok: {str(fallback_error)}",
                "timestamp": timestamp
            }, indent=2)


# =============================================================================
# Slack Alerting Tool (The "Hands")
# =============================================================================

def send_alert(
    bank_name: str,
    risk_level: str,
    summary: str,
    source_link: Optional[str] = None
) -> str:
    """
    Send a formatted alert to Slack using Block Kit.

    Args:
        bank_name: Name of the bank with detected risk
        risk_level: Risk severity - "HIGH", "MEDIUM", or "LOW"
        summary: Detailed summary of the risk findings
        source_link: Optional URL to primary source

    Returns:
        JSON string with status of the alert operation
    """
    slack_token = os.getenv("SLACK_BOT_TOKEN")
    channel_id = os.getenv("SLACK_CHANNEL_ID")

    if not slack_token or not channel_id:
        return json.dumps({
            "status": "error",
            "error": "Slack credentials not configured",
            "bank_name": bank_name
        })

    client = WebClient(token=slack_token)

    risk_config = {
        "HIGH": {"emoji": "🚨", "color": "#FF0000", "header": "CRITICAL ALERT"},
        "MEDIUM": {"emoji": "⚠️", "color": "#FFA500", "header": "WARNING"},
        "LOW": {"emoji": "ℹ️", "color": "#36A64F", "header": "NOTICE"}
    }

    config = risk_config.get(risk_level.upper(), risk_config["MEDIUM"])
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{config['emoji']} {config['header']}: {bank_name}",
                "emoji": True
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Bank:*\n{bank_name}"},
                {"type": "mrkdwn", "text": f"*Risk Level:*\n{risk_level.upper()}"},
                {"type": "mrkdwn", "text": f"*Detected At:*\n{timestamp}"},
                {"type": "mrkdwn", "text": f"*Data Source:*\nX API + Grok"}
            ]
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Summary:*\n{summary[:2900]}"
            }
        },
        {"type": "divider"},
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": "🤖 _Financial Sentinel | X API + Grok Analysis_"
                }
            ]
        }
    ]

    if source_link:
        blocks.insert(-1, {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"<{source_link}|View on X>"
            }
        })

    fallback_text = f"{config['emoji']} {risk_level.upper()} Risk Alert for {bank_name}"

    try:
        response = client.chat_postMessage(
            channel=channel_id,
            text=fallback_text,
            blocks=blocks,
            unfurl_links=False,
            unfurl_media=False
        )

        return json.dumps({
            "status": "success",
            "bank_name": bank_name,
            "risk_level": risk_level,
            "channel": channel_id,
            "message_ts": response["ts"],
            "timestamp": timestamp
        }, indent=2)

    except SlackApiError as e:
        return json.dumps({
            "status": "error",
            "error": str(e.response["error"]),
            "bank_name": bank_name,
            "timestamp": timestamp
        }, indent=2)
    except Exception as e:
        return json.dumps({
            "status": "error",
            "error": str(e),
            "bank_name": bank_name,
            "timestamp": timestamp
        }, indent=2)


# =============================================================================
# Standalone Test
# =============================================================================

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    print("Testing Financial Sentinel Tools...")
    print("=" * 60)

    # Test sentiment fetch
    result = fetch_market_sentiment("Chase")
    print(result)
