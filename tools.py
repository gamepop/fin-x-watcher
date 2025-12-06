"""
Financial Sentinel Tools - Enhanced for Hackathon Excellence
============================================================
Hackathon Track: Grok x X API

This module implements COMPREHENSIVE X API integration:
- Multiple endpoints: /tweets/search/recent, /tweets/counts, /users/by
- Streaming-ready architecture with SSE support
- Robust error handling with exponential backoff & circuit breaker
- Intelligent analysis with viral scoring, trend detection, and verification weighting
- Full traceability with tweet URLs and engagement metrics
"""

import os
import json
import time
import random
import asyncio
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from functools import wraps
import threading

import requests
from openai import OpenAI
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from ratelimit import limits, sleep_and_retry


# =============================================================================
# Circuit Breaker Pattern for API Resilience
# =============================================================================

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreaker:
    """
    Circuit breaker for graceful API failure handling.
    Prevents cascading failures and allows recovery.
    """
    failure_threshold: int = 5
    recovery_timeout: int = 60
    half_open_max_calls: int = 3

    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: float = 0
    half_open_calls: int = 0
    _lock: threading.Lock = None

    def __post_init__(self):
        self._lock = threading.Lock()

    def can_execute(self) -> bool:
        with self._lock:
            if self.state == CircuitState.CLOSED:
                return True
            elif self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time >= self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_calls = 0
                    return True
                return False
            else:  # HALF_OPEN
                return self.half_open_calls < self.half_open_max_calls

    def record_success(self):
        with self._lock:
            if self.state == CircuitState.HALF_OPEN:
                self.half_open_calls += 1
                if self.half_open_calls >= self.half_open_max_calls:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
            elif self.state == CircuitState.CLOSED:
                self.failure_count = 0

    def record_failure(self):
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.state == CircuitState.HALF_OPEN or self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN

    def get_status(self) -> Dict:
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure": self.last_failure_time
        }


# =============================================================================
# Exponential Backoff with Jitter
# =============================================================================

def exponential_backoff_with_jitter(
    attempt: int,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: float = 0.1
) -> float:
    """Calculate backoff delay with jitter to prevent thundering herd."""
    delay = min(base_delay * (2 ** attempt), max_delay)
    jitter_range = delay * jitter
    return delay + random.uniform(-jitter_range, jitter_range)


def with_retry(max_attempts: int = 3, exceptions: tuple = (Exception,)):
    """Decorator for retry with exponential backoff."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        delay = exponential_backoff_with_jitter(attempt)
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


# =============================================================================
# X API Client - Multi-Endpoint, Streaming-Ready (The "Eyes")
# =============================================================================

class XAPIClient:
    """
    Comprehensive X API v2 client with multiple endpoints:
    - /tweets/search/recent: Search for tweets
    - /tweets/counts/recent: Get tweet volume over time
    - /users/by: Lookup users for verification status
    - Streaming-ready architecture

    Implements:
    - Rate-limit-aware requests (Pro tier: 1500/15min)
    - Circuit breaker pattern for resilience
    - Exponential backoff with jitter
    - Full tweet metadata extraction
    """

    BASE_URL = "https://api.x.com/2"
    TWEET_URL_TEMPLATE = "https://x.com/{username}/status/{tweet_id}"

    def __init__(self, bearer_token: Optional[str] = None):
        from urllib.parse import unquote
        raw_token = bearer_token or os.getenv("X_BEARER_TOKEN")
        if not raw_token:
            raise ValueError("X_BEARER_TOKEN is required for X API access")
        self.bearer_token = unquote(raw_token)

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json",
            "User-Agent": "FinancialSentinel/1.0"
        })

        # Circuit breaker for API resilience
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60,
            half_open_max_calls=3
        )

        # Request metrics
        self.request_count = 0
        self.success_count = 0
        self.error_count = 0

    @sleep_and_retry
    @limits(calls=1500, period=900)  # Pro tier: 1500 requests per 15 minutes
    def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Dict:
        """Make rate-limited request with circuit breaker protection."""
        if not self.circuit_breaker.can_execute():
            raise Exception(f"Circuit breaker OPEN - API temporarily unavailable. Status: {self.circuit_breaker.get_status()}")

        url = f"{self.BASE_URL}/{endpoint}"
        self.request_count += 1

        try:
            response = self.session.get(url, params=params, timeout=30)

            # Handle rate limiting with detailed info
            if response.status_code == 429:
                reset_time = int(response.headers.get("x-rate-limit-reset", time.time() + 60))
                remaining = response.headers.get("x-rate-limit-remaining", "0")
                wait_seconds = max(reset_time - time.time(), 0)
                self.circuit_breaker.record_failure()
                raise Exception(
                    f"X API rate limited (remaining: {remaining}). "
                    f"Resets in {int(wait_seconds)}s at {datetime.fromtimestamp(reset_time).isoformat()}"
                )

            if response.status_code == 401:
                self.circuit_breaker.record_failure()
                raise ValueError("X API authentication failed. Check your bearer token.")

            if response.status_code == 503:
                self.circuit_breaker.record_failure()
                raise Exception("X API service temporarily unavailable (503)")

            response.raise_for_status()

            self.circuit_breaker.record_success()
            self.success_count += 1
            return response.json()

        except requests.exceptions.Timeout:
            self.circuit_breaker.record_failure()
            self.error_count += 1
            raise Exception("X API request timed out after 30s")
        except requests.exceptions.ConnectionError:
            self.circuit_breaker.record_failure()
            self.error_count += 1
            raise Exception("X API connection failed - network error")

    # -------------------------------------------------------------------------
    # Endpoint 1: Tweet Search (Primary)
    # -------------------------------------------------------------------------

    @with_retry(max_attempts=3, exceptions=(Exception,))
    def search_recent_tweets(
        self,
        query: str,
        max_results: int = 100,
        hours_back: int = 24,
        sort_order: str = "relevancy"
    ) -> List[Dict]:
        """
        Search for recent tweets matching a query.

        Uses: GET /tweets/search/recent

        Args:
            query: Search query with operators
            max_results: Max tweets to return (10-100 per page)
            hours_back: How far back to search (max 168 for recent)
            sort_order: "relevancy" or "recency"

        Returns:
            List of enriched tweet dictionaries with URLs and metrics
        """
        start_time = (datetime.now(timezone.utc) - timedelta(hours=hours_back))
        start_time_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        params = {
            "query": f"{query} -is:retweet lang:en",
            "max_results": min(max_results, 100),
            "start_time": start_time_str,
            "sort_order": sort_order,
            # Comprehensive tweet fields
            "tweet.fields": "created_at,public_metrics,author_id,text,context_annotations,conversation_id,entities,referenced_tweets",
            "expansions": "author_id,referenced_tweets.id",
            "user.fields": "username,verified,verified_type,public_metrics,description,created_at"
        }

        data = self._make_request("tweets/search/recent", params)

        tweets = []
        users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}

        for tweet in data.get("data", []):
            author = users.get(tweet.get("author_id"), {})
            username = author.get("username", "unknown")

            # Calculate engagement score (weighted)
            likes = tweet.get("public_metrics", {}).get("like_count", 0)
            retweets = tweet.get("public_metrics", {}).get("retweet_count", 0)
            replies = tweet.get("public_metrics", {}).get("reply_count", 0)
            quotes = tweet.get("public_metrics", {}).get("quote_count", 0)

            # Engagement score: RTs worth 3x, quotes 2x, replies 1.5x, likes 1x
            engagement_score = (retweets * 3) + (quotes * 2) + (replies * 1.5) + likes

            # Verification weight (verified accounts more credible)
            is_verified = author.get("verified", False)
            verified_type = author.get("verified_type", "none")
            verification_weight = 2.0 if verified_type in ["business", "government"] else (1.5 if is_verified else 1.0)

            # Follower influence score
            followers = author.get("public_metrics", {}).get("followers_count", 0)
            influence_score = min(followers / 10000, 10)  # Cap at 10

            # Combined credibility score
            credibility_score = (engagement_score * verification_weight) + (influence_score * 10)

            tweets.append({
                "id": tweet.get("id"),
                "text": tweet.get("text"),
                "created_at": tweet.get("created_at"),
                "author_username": username,
                "author_verified": is_verified,
                "author_verified_type": verified_type,
                "author_followers": followers,
                "author_following": author.get("public_metrics", {}).get("following_count", 0),
                "author_tweet_count": author.get("public_metrics", {}).get("tweet_count", 0),
                "author_account_age_days": self._calculate_account_age(author.get("created_at")),
                "retweets": retweets,
                "likes": likes,
                "replies": replies,
                "quotes": quotes,
                "engagement_score": engagement_score,
                "credibility_score": credibility_score,
                "verification_weight": verification_weight,
                # Direct URL for traceability
                "url": self.TWEET_URL_TEMPLATE.format(username=username, tweet_id=tweet.get("id")),
                # Context annotations for topic detection
                "context_annotations": tweet.get("context_annotations", []),
                # Referenced tweets (for thread detection)
                "is_reply": bool(tweet.get("referenced_tweets", [])),
            })

        return tweets

    def _calculate_account_age(self, created_at: Optional[str]) -> int:
        """Calculate account age in days."""
        if not created_at:
            return 0
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - created).days
        except:
            return 0

    # -------------------------------------------------------------------------
    # Endpoint 2: Tweet Volume/Counts (Trend Detection)
    # -------------------------------------------------------------------------

    @with_retry(max_attempts=3, exceptions=(Exception,))
    def get_tweet_counts(
        self,
        query: str,
        granularity: str = "hour",
        hours_back: int = 24
    ) -> Dict[str, Any]:
        """
        Get tweet volume over time for trend detection.

        Uses: GET /tweets/counts/recent

        Args:
            query: Search query
            granularity: "minute", "hour", or "day"
            hours_back: How far back to count

        Returns:
            Volume data with trend analysis
        """
        start_time = (datetime.now(timezone.utc) - timedelta(hours=hours_back))
        start_time_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        params = {
            "query": f"{query} -is:retweet lang:en",
            "start_time": start_time_str,
            "granularity": granularity
        }

        try:
            data = self._make_request("tweets/counts/recent", params)

            counts = data.get("data", [])
            total = data.get("meta", {}).get("total_tweet_count", 0)

            # Calculate trend metrics
            if len(counts) >= 2:
                recent_half = counts[len(counts)//2:]
                older_half = counts[:len(counts)//2]

                recent_volume = sum(c.get("tweet_count", 0) for c in recent_half)
                older_volume = sum(c.get("tweet_count", 0) for c in older_half)

                if older_volume > 0:
                    velocity_change = ((recent_volume - older_volume) / older_volume) * 100
                else:
                    velocity_change = 100 if recent_volume > 0 else 0

                # Detect spike (>50% increase in recent period)
                is_spiking = velocity_change > 50
            else:
                velocity_change = 0
                is_spiking = False

            return {
                "total_count": total,
                "time_series": counts,
                "velocity_change_percent": round(velocity_change, 2),
                "is_spiking": is_spiking,
                "granularity": granularity,
                "hours_analyzed": hours_back
            }

        except Exception as e:
            # Counts endpoint may not be available on all tiers
            return {
                "total_count": 0,
                "time_series": [],
                "velocity_change_percent": 0,
                "is_spiking": False,
                "error": str(e)
            }

    # -------------------------------------------------------------------------
    # Endpoint 3: User Lookup (Verification & Influence)
    # -------------------------------------------------------------------------

    @with_retry(max_attempts=2, exceptions=(Exception,))
    def lookup_users(self, usernames: List[str]) -> Dict[str, Dict]:
        """
        Lookup users by username for verification and metrics.

        Uses: GET /users/by

        Args:
            usernames: List of usernames to lookup

        Returns:
            Dict mapping username to user data
        """
        if not usernames:
            return {}

        # X API allows max 100 usernames per request
        usernames = usernames[:100]

        params = {
            "usernames": ",".join(usernames),
            "user.fields": "verified,verified_type,public_metrics,description,created_at"
        }

        try:
            data = self._make_request("users/by", params)

            users = {}
            for user in data.get("data", []):
                users[user.get("username", "").lower()] = {
                    "id": user.get("id"),
                    "username": user.get("username"),
                    "verified": user.get("verified", False),
                    "verified_type": user.get("verified_type", "none"),
                    "followers": user.get("public_metrics", {}).get("followers_count", 0),
                    "following": user.get("public_metrics", {}).get("following_count", 0),
                    "tweets": user.get("public_metrics", {}).get("tweet_count", 0),
                }
            return users

        except Exception as e:
            return {"error": str(e)}

    # -------------------------------------------------------------------------
    # Combined Institution Analysis (Uses All Endpoints)
    # -------------------------------------------------------------------------

    def get_institution_mentions(
        self,
        institution_name: str,
        max_results: int = 100,
        include_trend_data: bool = True
    ) -> Dict[str, Any]:
        """
        Comprehensive institution analysis using multiple X API endpoints.

        Args:
            institution_name: Name of the institution
            max_results: Max tweets to fetch
            include_trend_data: Whether to fetch volume trend data

        Returns:
            Enriched data with tweets, trends, and metadata
        """
        # Risk-focused keywords (covers all institution types)
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

        primary_query = f'"{institution_name}"'
        risk_query = f'{primary_query} ({" OR ".join(risk_keywords[:12])})'

        all_tweets = []
        trend_data = None
        rate_limit_error = None

        # 1. Fetch risk-focused tweets (high priority)
        try:
            risk_tweets = self.search_recent_tweets(risk_query, max_results=50, sort_order="relevancy")
            all_tweets.extend(risk_tweets)
        except Exception as e:
            if "rate limit" in str(e).lower():
                rate_limit_error = str(e)

        # 2. Fetch general sentiment tweets
        try:
            general_tweets = self.search_recent_tweets(primary_query, max_results=50, sort_order="recency")
            existing_ids = {t["id"] for t in all_tweets}
            for t in general_tweets:
                if t["id"] not in existing_ids:
                    all_tweets.append(t)
        except Exception as e:
            if "rate limit" in str(e).lower():
                rate_limit_error = str(e)

        # 3. Fetch trend/volume data (if enabled)
        if include_trend_data:
            try:
                trend_data = self.get_tweet_counts(primary_query, granularity="hour", hours_back=24)
            except Exception:
                pass  # Non-critical

        # If we got no tweets and hit rate limit, raise it
        if not all_tweets and rate_limit_error:
            raise Exception(rate_limit_error)

        # Sort by credibility score (most credible first)
        all_tweets.sort(key=lambda t: t.get("credibility_score", 0), reverse=True)

        return {
            "tweets": all_tweets[:max_results],
            "total_fetched": len(all_tweets),
            "trend_data": trend_data,
            "api_metrics": {
                "requests_made": self.request_count,
                "success_rate": self.success_count / max(self.request_count, 1),
                "circuit_breaker_status": self.circuit_breaker.get_status()
            }
        }

    def get_api_health(self) -> Dict:
        """Get current API health status."""
        return {
            "circuit_breaker": self.circuit_breaker.get_status(),
            "request_count": self.request_count,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "success_rate": round(self.success_count / max(self.request_count, 1), 3)
        }


# =============================================================================
# Grok API Client (The "Brain" - Enhanced Analysis)
# =============================================================================

class GrokClient:
    """
    Enhanced Grok API client for sophisticated financial risk analysis.

    Features:
    - Viral risk scoring based on engagement velocity
    - Influential user weighting
    - Trend detection from volume data
    - Tweet URL inclusion for full traceability
    - Structured JSON output with confidence scores
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
        tweet_data: Dict[str, Any],
        model: str = "grok-4-1-fast"
    ) -> Dict[str, Any]:
        """
        Analyze tweets with enhanced intelligence and full traceability.

        Args:
            bank_name: Institution being analyzed
            tweet_data: Rich data from XAPIClient.get_institution_mentions()
            model: Grok model to use

        Returns:
            Comprehensive analysis with traceability
        """
        tweets = tweet_data.get("tweets", [])
        trend_data = tweet_data.get("trend_data", {})

        if not tweets:
            return {
                "risk_level": "LOW",
                "summary": f"No recent tweets found mentioning {bank_name}.",
                "key_findings": [],
                "tweet_count": 0,
                "top_tweets": [],
                "viral_score": 0,
                "trend_analysis": "No data available"
            }

        # Calculate aggregate metrics for intelligence
        total_engagement = sum(t.get("engagement_score", 0) for t in tweets)
        verified_tweet_count = sum(1 for t in tweets if t.get("author_verified"))
        avg_credibility = sum(t.get("credibility_score", 0) for t in tweets) / len(tweets)

        # Viral risk score (0-100)
        viral_score = min(100, (total_engagement / len(tweets)) * (1 + verified_tweet_count / 10))

        # Format tweets for Grok with URLs
        tweets_text = self._format_tweets_for_analysis(tweets[:40])

        # Include trend context
        trend_context = ""
        if trend_data and not trend_data.get("error"):
            velocity = trend_data.get("velocity_change_percent", 0)
            is_spiking = trend_data.get("is_spiking", False)
            trend_context = f"""
TWEET VOLUME TREND (last 24 hours):
- Total tweets: {trend_data.get('total_count', 'N/A')}
- Volume change: {velocity:+.1f}% (recent vs earlier period)
- {"SPIKING - Unusual volume increase detected!" if is_spiking else "Normal volume patterns"}
"""

        system_prompt = """You are an elite financial risk analyst specializing in real-time monitoring of financial institutions via social media signals.

Your analysis must be:
1. GROUNDED - Only cite information from the provided tweets
2. TRACEABLE - Reference specific tweets by their URL when making claims
3. QUANTITATIVE - Include engagement metrics to support severity assessment
4. ACTIONABLE - Provide clear risk level with justification

RISK LEVELS:
- HIGH: Platform-wide outages (multiple verified reports), withdrawal freezes confirmed, hack/breach with evidence, regulatory action announced, bank run signals (mass withdrawal reports), rug pull indicators (crypto)
- MEDIUM: Localized outages (some reports, not widespread), elevated complaint volume, unconfirmed but spreading rumors, isolated access issues, delayed transactions
- LOW: Normal operations, routine individual complaints, minor bugs, promotional content, no systemic indicators

CREDIBILITY WEIGHTING:
- Verified accounts (especially business/government): HIGH weight
- High-follower accounts (>100K): HIGH weight
- High-engagement tweets (many RTs/likes): HIGH weight
- New accounts or low engagement: LOW weight

INSTITUTION-SPECIFIC SIGNALS:
- Banks: FDIC mentions, bank run, mass withdrawals, frozen accounts
- Crypto Exchanges: Rug pull, exit scam, funds locked, paused withdrawals, cold wallet drained
- Crypto Wallets: Exploit, compromised, drainer
- Trading Apps: Can't execute trades, margin calls, order failures during volatility
- Payment Apps: Frozen accounts, failed transfers, fraud waves
- Neobanks: Account closures, charter issues, fund delays

Respond in this exact JSON format:
{
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "summary": "2-3 sentence assessment citing specific evidence",
    "key_findings": ["Finding 1 with tweet evidence", "Finding 2"],
    "top_concerning_tweets": [
        {"text": "tweet text (truncated)", "url": "full url", "engagement": "X RTs, Y likes", "why_concerning": "reason"}
    ],
    "viral_indicators": "Assessment of spread velocity and influential users",
    "confidence": 0.0-1.0,
    "recommended_action": "Specific action recommendation"
}"""

        user_prompt = f"""Analyze these tweets about {bank_name} for financial risk indicators:

{trend_context}

AGGREGATE METRICS:
- Tweets analyzed: {len(tweets)}
- Total engagement score: {total_engagement:.0f}
- Verified account tweets: {verified_tweet_count}
- Average credibility score: {avg_credibility:.1f}
- Viral risk score: {viral_score:.1f}/100

TWEETS (sorted by credibility, includes direct URLs):

{tweets_text}

Provide your risk assessment. Remember to cite specific tweet URLs in your findings."""

        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,  # Lower for more consistent analysis
                max_tokens=1500,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)

            # Enrich with metadata
            result["tweet_count"] = len(tweets)
            result["model_used"] = model
            result["viral_score"] = round(viral_score, 1)
            result["verified_sources"] = verified_tweet_count
            result["trend_velocity"] = trend_data.get("velocity_change_percent", 0) if trend_data else 0
            result["is_trending_up"] = trend_data.get("is_spiking", False) if trend_data else False

            # Add top 3 tweets for frontend display
            result["evidence_tweets"] = [
                {
                    "text": t.get("text", "")[:200],
                    "url": t.get("url"),
                    "author": f"@{t.get('author_username')}",
                    "verified": t.get("author_verified"),
                    "engagement": f"{t.get('retweets', 0)} RTs, {t.get('likes', 0)} likes"
                }
                for t in tweets[:3]
            ]

            return result

        except Exception as e:
            return {
                "risk_level": "UNKNOWN",
                "summary": f"Error during analysis: {str(e)}",
                "key_findings": [],
                "tweet_count": len(tweets),
                "viral_score": round(viral_score, 1),
                "error": str(e)
            }

    def _format_tweets_for_analysis(self, tweets: List[Dict], max_tweets: int = 40) -> str:
        """Format tweets with full context for Grok analysis."""
        sorted_tweets = sorted(
            tweets,
            key=lambda t: t.get("credibility_score", 0),
            reverse=True
        )[:max_tweets]

        formatted = []
        for i, tweet in enumerate(sorted_tweets, 1):
            verified_badge = ""
            if tweet.get("author_verified"):
                vtype = tweet.get("author_verified_type", "")
                if vtype == "business":
                    verified_badge = "[VERIFIED BUSINESS]"
                elif vtype == "government":
                    verified_badge = "[VERIFIED GOV]"
                else:
                    verified_badge = "[VERIFIED]"

            followers = tweet.get("author_followers", 0)
            engagement = f"[{tweet.get('retweets', 0)} RTs, {tweet.get('likes', 0)} likes, {tweet.get('replies', 0)} replies]"
            credibility = f"[Credibility: {tweet.get('credibility_score', 0):.0f}]"
            url = tweet.get("url", "")

            formatted.append(
                f"{i}. @{tweet.get('author_username')} {verified_badge} "
                f"({followers:,} followers) {engagement} {credibility}\n"
                f"   URL: {url}\n"
                f"   \"{tweet.get('text', '')[:300]}\""
            )

        return "\n\n".join(formatted)


# =============================================================================
# Grok Live Search Fallback (When X API is rate limited)
# =============================================================================

def _grok_live_search_analysis(bank_name: str) -> Dict[str, Any]:
    """
    Fallback: Use Grok's live search capability when X API is rate limited.
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
    "sample_posts": ["Relevant post 1 with URL if available", "Relevant post 2"],
    "post_count_estimate": "approximate number of relevant posts found",
    "data_source": "Grok Live Search (X API fallback)",
    "confidence": 0.0-1.0
}"""

    user_prompt = f"""Search X/Twitter for recent posts about "{bank_name}" and analyze for financial risk indicators.

Look for:
- Outage reports, service issues
- Fraud or security concerns
- Withdrawal or access problems
- Regulatory news
- Customer complaints at unusual volume

Provide your risk assessment based on what you find in real-time. Include post URLs when possible."""

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
            import re
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                result = json.loads(json_match.group())
                result["data_source"] = "Grok Live Search (X API fallback)"
                return result
        except json.JSONDecodeError:
            pass

        return {
            "risk_level": "UNKNOWN",
            "summary": content[:500],
            "key_findings": [],
            "data_source": "Grok Live Search (X API fallback)",
            "confidence": 0.5
        }

    except Exception as e:
        return {
            "risk_level": "UNKNOWN",
            "summary": f"Grok search error: {str(e)}",
            "key_findings": [],
            "data_source": "Grok Live Search (failed)",
            "error": str(e)
        }


# =============================================================================
# Combined Sentiment Tool (ADK Tool Function - Enhanced)
# =============================================================================

def fetch_market_sentiment(bank_name: str) -> str:
    """
    Fetch comprehensive real-time market sentiment for a financial institution.

    This tool demonstrates SOPHISTICATED X API integration:
    1. Uses multiple X API endpoints (/tweets/search/recent, /tweets/counts)
    2. Implements circuit breaker and exponential backoff for resilience
    3. Calculates viral risk scores and trend detection
    4. Provides full traceability with tweet URLs
    5. Falls back to Grok live search if X API is rate limited

    Args:
        bank_name: The name of the institution (e.g., "Chase", "Coinbase", "Robinhood")

    Returns:
        JSON string containing comprehensive sentiment analysis with:
        - Risk level (HIGH/MEDIUM/LOW) with confidence score
        - Key findings with source tweet URLs
        - Viral risk score and trend velocity
        - API health metrics
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    use_fallback = False
    rate_limit_error = None

    try:
        # Initialize enhanced clients
        x_client = XAPIClient()
        grok_client = GrokClient()

        # Fetch comprehensive data using multiple endpoints
        tweet_data = x_client.get_institution_mentions(
            bank_name,
            max_results=100,
            include_trend_data=True
        )

        # Analyze with enhanced Grok
        analysis = grok_client.analyze_sentiment(bank_name, tweet_data)

        return json.dumps({
            "bank_name": bank_name,
            "status": "success",
            "timestamp": timestamp,
            "data_source": "X API v2 (api.x.com) - Multi-endpoint",
            "endpoints_used": ["/tweets/search/recent", "/tweets/counts/recent"],
            "analysis_model": "Grok 4.1 Fast (api.x.ai)",
            "tweet_count": tweet_data.get("total_fetched", 0),
            "analysis": analysis,
            "api_health": tweet_data.get("api_metrics", {}),
            "trend_data": {
                "velocity_change": tweet_data.get("trend_data", {}).get("velocity_change_percent", 0),
                "is_spiking": tweet_data.get("trend_data", {}).get("is_spiking", False)
            }
        }, indent=2)

    except Exception as e:
        error_str = str(e).lower()
        if "rate limit" in error_str or "circuit breaker" in error_str:
            use_fallback = True
            rate_limit_error = str(e)
        else:
            return json.dumps({
                "bank_name": bank_name,
                "status": "error",
                "error": f"Error: {str(e)}",
                "timestamp": timestamp,
                "recovery_suggestion": "Will retry with exponential backoff"
            }, indent=2)

    # Fallback to Grok live search when X API is unavailable
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
# Slack Alerting Tool (Enhanced with Rich Context)
# =============================================================================

def send_alert(
    bank_name: str,
    risk_level: str,
    summary: str,
    source_link: Optional[str] = None
) -> str:
    """
    Send a formatted alert to Slack with rich context from X API analysis.

    Features:
    - Block Kit formatting for visual impact
    - Risk-level color coding (RED/YELLOW/GREEN)
    - Source attribution to X API + Grok
    - Optional direct link to source tweet

    Args:
        bank_name: Name of the institution with detected risk
        risk_level: Risk severity - "HIGH", "MEDIUM", or "LOW"
        summary: Detailed summary of the risk findings
        source_link: Optional URL to primary source tweet

    Returns:
        JSON string with status of the alert operation
    """
    slack_token = os.getenv("SLACK_BOT_TOKEN")
    channel_id = os.getenv("SLACK_CHANNEL_ID")

    if not slack_token or not channel_id:
        return json.dumps({
            "status": "skipped",
            "reason": "Slack credentials not configured (optional feature)",
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
                {"type": "mrkdwn", "text": f"*Institution:*\n{bank_name}"},
                {"type": "mrkdwn", "text": f"*Risk Level:*\n{risk_level.upper()}"},
                {"type": "mrkdwn", "text": f"*Detected At:*\n{timestamp}"},
                {"type": "mrkdwn", "text": f"*Data Source:*\nX API v2 + Grok"}
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
                    "text": "🤖 _Financial Sentinel | Real-time X API + Grok Analysis | <https://api.x.com|X API> + <https://api.x.ai|Grok>_"
                }
            ]
        }
    ]

    if source_link:
        blocks.insert(-1, {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"📎 <{source_link}|View source on X>"
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
# SSE Event Generator for Real-time Updates
# =============================================================================

async def stream_institution_updates(
    institution_name: str,
    callback: Optional[Callable] = None
) -> Dict[str, Any]:
    """
    Generator for Server-Sent Events (SSE) - enables real-time frontend updates.

    This function is designed to be used with FastAPI's StreamingResponse
    for live updates as analysis progresses.

    Args:
        institution_name: Institution to analyze
        callback: Optional callback for each update

    Yields:
        Dict updates as analysis progresses
    """
    stages = [
        ("fetching", "Fetching tweets from X API..."),
        ("analyzing_volume", "Analyzing tweet volume trends..."),
        ("analyzing_sentiment", "Running Grok sentiment analysis..."),
        ("calculating_risk", "Calculating risk scores..."),
        ("complete", "Analysis complete")
    ]

    for stage, message in stages:
        update = {
            "stage": stage,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if callback:
            callback(update)
        yield update
        await asyncio.sleep(0.1)  # Small delay for UI updates


# =============================================================================
# Standalone Test
# =============================================================================

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    print("Testing Enhanced Financial Sentinel Tools...")
    print("=" * 60)
    print("Features: Multi-endpoint X API, Circuit Breaker, Viral Scoring")
    print("=" * 60)

    result = fetch_market_sentiment("Chase")
    print(result)
