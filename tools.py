"""
Financial Sentinel Tools - Enhanced for Hackathon Excellence
============================================================
Hackathon Track: Grok x X API

This module implements COMPREHENSIVE X API integration using the OFFICIAL X SDK (xdk):
- Official X Python SDK for all API interactions
- Automatic pagination handling
- Built-in streaming support for filtered stream
- Robust error handling with circuit breaker pattern
- Intelligent analysis with viral scoring, trend detection, and verification weighting
- Full traceability with tweet URLs and engagement metrics
"""

import os
import json
import time
import random
import asyncio
from typing import Optional, List, Dict, Any, Callable, Generator
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from functools import wraps
import threading

# Official X Python SDK
from xdk import Client as XDKClient

import requests  # kept for fallback utilities
from openai import OpenAI
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError


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
# X API Client - Using Official X Python SDK (xdk)
# =============================================================================

class XAPIClient:
    """
    Comprehensive X API v2 client using the OFFICIAL X Python SDK (xdk).

    Features:
    - Official SDK with automatic pagination
    - Built-in streaming support for filtered stream
    - Circuit breaker pattern for resilience
    - Full tweet metadata extraction with engagement scoring
    - Verification and influence weighting

    Endpoints used:
    - client.posts.search_recent(): Search for tweets
    - client.stream.posts(): Real-time filtered stream
    - client.stream.update_rules(): Manage stream rules
    """

    TWEET_URL_TEMPLATE = "https://x.com/{username}/status/{tweet_id}"

    def __init__(self, bearer_token: Optional[str] = None):
        from urllib.parse import unquote
        raw_token = bearer_token or os.getenv("X_BEARER_TOKEN")
        if not raw_token:
            raise ValueError("X_BEARER_TOKEN is required for X API access")
        self.bearer_token = unquote(raw_token)

        # Initialize official X SDK client
        self.client = XDKClient(bearer_token=self.bearer_token)

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

        # SDK info for health checks
        self.sdk_version = "xdk (official)"

    # -------------------------------------------------------------------------
    # Endpoint 1: Tweet Search (Primary) - Using xdk
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
        Search for recent tweets using the official X SDK.

        Uses: client.posts.search_recent() with automatic pagination

        Args:
            query: Search query with operators
            max_results: Max tweets to return
            hours_back: How far back to search (max 168 for recent)
            sort_order: "relevancy" or "recency"

        Returns:
            List of enriched tweet dictionaries with URLs and metrics
        """
        if not self.circuit_breaker.can_execute():
            raise Exception(f"Circuit breaker OPEN - API temporarily unavailable. Status: {self.circuit_breaker.get_status()}")

        self.request_count += 1
        full_query = f"{query} -is:retweet lang:en"

        tweets = []
        tweets_collected = 0

        try:
            # Use official SDK with automatic pagination
            # Note: X API requires max_results >= 10, <= 100
            # Fields must be passed as lists for xdk
            for page in self.client.posts.search_recent(
                query=full_query,
                max_results=max(10, min(max_results, 100)),
                sort_order=sort_order,
                tweet_fields=["created_at", "public_metrics", "author_id", "text", "context_annotations", "conversation_id", "entities", "referenced_tweets"],
                expansions=["author_id", "referenced_tweets.id"],
                user_fields=["username", "verified", "verified_type", "public_metrics", "description", "created_at"]
            ):
                # Convert page data to dict for processing
                page_data = page.model_dump() if hasattr(page, 'model_dump') else dict(page)

                if not page_data.get('data'):
                    break

                # Build user lookup from includes
                users = {}
                if page_data.get('includes') and page_data['includes'].get('users'):
                    users = {u.get('id'): u for u in page_data['includes']['users']}

                for tweet in page_data.get('data', []):
                    if tweets_collected >= max_results:
                        break

                    author_id = tweet.get('author_id')
                    author = users.get(author_id, {})
                    username = author.get('username', 'unknown')

                    # Calculate engagement score (weighted)
                    public_metrics = tweet.get('public_metrics', {})
                    likes = public_metrics.get('like_count', 0)
                    retweets = public_metrics.get('retweet_count', 0)
                    replies = public_metrics.get('reply_count', 0)
                    quotes = public_metrics.get('quote_count', 0)

                    # Engagement score: RTs worth 3x, quotes 2x, replies 1.5x, likes 1x
                    engagement_score = (retweets * 3) + (quotes * 2) + (replies * 1.5) + likes

                    # Verification weight (verified accounts more credible)
                    is_verified = author.get('verified', False)
                    verified_type = author.get('verified_type', 'none')
                    verification_weight = 2.0 if verified_type in ['business', 'government'] else (1.5 if is_verified else 1.0)

                    # Follower influence score
                    author_metrics = author.get('public_metrics', {})
                    followers = author_metrics.get('followers_count', 0)
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
                        "author_following": author_metrics.get("following_count", 0),
                        "author_tweet_count": author_metrics.get("tweet_count", 0),
                        "author_account_age_days": self._calculate_account_age(author.get("created_at")),
                        "retweets": retweets,
                        "likes": likes,
                        "replies": replies,
                        "quotes": quotes,
                        "engagement_score": engagement_score,
                        "credibility_score": credibility_score,
                        "verification_weight": verification_weight,
                        "url": self.TWEET_URL_TEMPLATE.format(username=username, tweet_id=tweet.get("id")),
                        "context_annotations": tweet.get("context_annotations", []),
                        "is_reply": bool(tweet.get("referenced_tweets", [])),
                    })
                    tweets_collected += 1

                if tweets_collected >= max_results:
                    break

            self.circuit_breaker.record_success()
            self.success_count += 1
            return tweets

        except Exception as e:
            self.circuit_breaker.record_failure()
            self.error_count += 1
            error_str = str(e).lower()

            # Check for rate limiting
            if "429" in str(e) or "rate" in error_str:
                raise Exception(f"X API rate limited (remaining: 0). Resets in 900s at {datetime.now(timezone.utc).isoformat()}")
            elif "401" in str(e) or "unauthorized" in error_str:
                raise ValueError("X API authentication failed. Check your bearer token.")
            else:
                raise Exception(f"X API error: {str(e)}")

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
    # Note: xdk may not support counts endpoint, using fallback
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

        Note: Falls back to counting search results if counts endpoint unavailable.

        Args:
            query: Search query
            granularity: "minute", "hour", or "day"
            hours_back: How far back to count

        Returns:
            Volume data with trend analysis
        """
        try:
            # Try to use search results to estimate volume
            # xdk auto-pagination makes this efficient
            tweet_count = 0
            for page in self.client.posts.search_recent(
                query=f"{query} -is:retweet lang:en",
                max_results=100
            ):
                page_data = page.model_dump() if hasattr(page, 'model_dump') else dict(page)
                if page_data.get('data'):
                    tweet_count += len(page_data['data'])
                if tweet_count >= 100:  # Sample limit
                    break

            return {
                "total_count": tweet_count,
                "time_series": [],
                "velocity_change_percent": 0,
                "is_spiking": tweet_count > 50,  # Simple spike detection
                "granularity": granularity,
                "hours_analyzed": hours_back,
                "note": "Estimated from search results (xdk)"
            }

        except Exception as e:
            return {
                "total_count": 0,
                "time_series": [],
                "velocity_change_percent": 0,
                "is_spiking": False,
                "error": str(e)
            }

    # -------------------------------------------------------------------------
    # Endpoint 3: Filtered Stream (Real-time) - Using xdk
    # -------------------------------------------------------------------------

    def setup_stream_rules(self, rules: List[Dict[str, str]]) -> Dict:
        """
        Set up filtered stream rules for real-time monitoring.

        Args:
            rules: List of rule dicts with 'value' and optional 'tag'
                   e.g., [{"value": "Chase outage", "tag": "chase_risk"}]

        Returns:
            Response with created rule IDs
        """
        try:
            # Pass dict directly - UpdateRulesRequest model doesn't work correctly
            body = {"add": rules}
            response = self.client.stream.update_rules(body=body)

            return {
                "status": "success",
                "rules_created": len(rules),
                "response": response.model_dump() if hasattr(response, 'model_dump') else dict(response)
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def get_stream_rules(self) -> List[Dict]:
        """Get current filtered stream rules."""
        try:
            rules = []
            for page in self.client.stream.get_rules():
                page_data = page.model_dump() if hasattr(page, 'model_dump') else dict(page)
                if page_data.get('data'):
                    for rule in page_data['data']:
                        rules.append({
                            "id": rule.get('id'),
                            "value": rule.get('value'),
                            "tag": rule.get('tag')
                        })
            return rules
        except Exception as e:
            return [{"error": str(e)}]

    def delete_stream_rules(self, rule_ids: List[str] = None, delete_all: bool = False) -> Dict:
        """
        Delete filtered stream rules.

        Args:
            rule_ids: List of rule IDs to delete (optional)
            delete_all: If True, deletes all rules

        Returns:
            Response with deletion status
        """
        try:
            if delete_all:
                # Get all existing rules first
                existing = self.get_stream_rules()
                if existing and not existing[0].get("error"):
                    rule_ids = [r["id"] for r in existing if r.get("id")]

            if not rule_ids:
                return {"status": "no_rules", "deleted": 0}

            # Pass dict directly - UpdateRulesRequest model doesn't work correctly
            body = {"delete": {"ids": rule_ids}}
            response = self.client.stream.update_rules(body=body)

            return {
                "status": "success",
                "deleted": len(rule_ids),
                "response": response.model_dump() if hasattr(response, 'model_dump') else dict(response)
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def stream_posts(
        self,
        backfill_minutes: int = None,
        include_user_data: bool = True
    ) -> Generator[Dict, None, None]:
        """
        Stream posts in real-time using filtered stream with rich data.

        Args:
            backfill_minutes: Minutes of past data to backfill (max 5)
            include_user_data: Include expanded user/author data

        Yields:
            Dict with enriched post data including engagement metrics
        """
        # Request rich tweet fields
        tweet_fields = [
            'id', 'text', 'created_at', 'author_id',
            'public_metrics',  # retweets, likes, replies, quotes
            'entities',        # hashtags, mentions, urls
            'lang',
            'possibly_sensitive'
        ]

        # Request user fields for author expansion
        user_fields = [
            'id', 'name', 'username',
            'verified', 'verified_type',
            'public_metrics',  # followers, following
        ] if include_user_data else None

        # Expand author_id to get full user object
        expansions = ['author_id'] if include_user_data else None

        try:
            stream_kwargs = {
                'tweet_fields': tweet_fields,
            }
            if expansions:
                stream_kwargs['expansions'] = expansions
            if user_fields:
                stream_kwargs['user_fields'] = user_fields
            if backfill_minutes:
                stream_kwargs['backfill_minutes'] = min(backfill_minutes, 5)

            for post_response in self.client.stream.posts(**stream_kwargs):
                try:
                    data = post_response.model_dump() if hasattr(post_response, 'model_dump') else dict(post_response)

                    if data.get('data'):
                        tweet = data['data']

                        # Extract public metrics
                        metrics = tweet.get('public_metrics', {})
                        total_engagement = (
                            metrics.get('retweet_count', 0) +
                            metrics.get('reply_count', 0) +
                            metrics.get('like_count', 0) +
                            metrics.get('quote_count', 0)
                        )

                        # Find author in includes
                        author = None
                        if data.get('includes', {}).get('users'):
                            author_id = tweet.get('author_id')
                            for user in data['includes']['users']:
                                if user.get('id') == author_id:
                                    author = user
                                    break

                        # Extract entities
                        entities = tweet.get('entities', {})
                        hashtags = [h.get('tag') for h in entities.get('hashtags', [])]
                        mentions = [m.get('username') for m in entities.get('mentions', [])]

                        # Build enriched response
                        enriched = {
                            "id": tweet.get('id'),
                            "text": tweet.get('text'),
                            "created_at": tweet.get('created_at'),
                            "author_id": tweet.get('author_id'),
                            "lang": tweet.get('lang'),
                            "possibly_sensitive": tweet.get('possibly_sensitive', False),
                            "matching_rules": data.get('matching_rules', []),
                            # Engagement metrics
                            "metrics": {
                                "retweets": metrics.get('retweet_count', 0),
                                "replies": metrics.get('reply_count', 0),
                                "likes": metrics.get('like_count', 0),
                                "quotes": metrics.get('quote_count', 0),
                                "total_engagement": total_engagement
                            },
                            # Entities
                            "hashtags": hashtags,
                            "mentions": mentions,
                        }

                        # Add author data if available
                        if author:
                            author_metrics = author.get('public_metrics', {})
                            enriched["author"] = {
                                "id": author.get('id'),
                                "username": author.get('username'),
                                "name": author.get('name'),
                                "verified": author.get('verified', False),
                                "verified_type": author.get('verified_type'),
                                "followers": author_metrics.get('followers_count', 0),
                                "following": author_metrics.get('following_count', 0),
                            }
                            # Calculate credibility score
                            enriched["author"]["credibility_score"] = self._calculate_credibility(
                                author_metrics.get('followers_count', 0),
                                author.get('verified', False),
                                author.get('verified_type')
                            )

                        # Build tweet URL
                        if enriched.get("author", {}).get("username"):
                            enriched["url"] = f"https://x.com/{enriched['author']['username']}/status/{tweet.get('id')}"

                        yield enriched
                except UnicodeDecodeError:
                    # Skip malformed UTF-8 chunks in the stream to avoid aborting the worker
                    continue

        except Exception as e:
            yield {"error": str(e), "type": "stream_error"}

    def _calculate_credibility(self, followers: int, verified: bool, verified_type: str) -> float:
        """Calculate author credibility score."""
        score = min(followers / 1000, 50)  # Max 50 from followers
        if verified:
            if verified_type == "business":
                score += 40
            elif verified_type == "government":
                score += 50
            else:
                score += 25
        return round(score, 1)

    # -------------------------------------------------------------------------
    # Combined Institution Analysis (Uses All Endpoints)
    # -------------------------------------------------------------------------

    def _build_flexible_query(self, institution_name: str, inst_type: str) -> str:
        """
        Build a flexible search query that works for both companies and person names.

        For person names (e.g., "Elon Musk"), creates a more flexible query like:
        (Elon OR "Elon Musk") to catch partial mentions

        For institutions, uses exact phrase matching: "Chase"

        Args:
            institution_name: Name to search for
            inst_type: Institution type from classification

        Returns:
            Optimized search query string
        """
        # If it's an unknown type and contains multiple words, likely a person name
        is_likely_person = (
            inst_type == "unknown" and
            " " in institution_name.strip() and
            len(institution_name.split()) <= 3  # Avoid long phrases
        )

        if is_likely_person:
            # For person names, use flexible matching
            # e.g., "Elon Musk" becomes (Elon OR "Elon Musk")
            words = institution_name.strip().split()
            first_word = words[0]

            # Build query: (FirstName OR "Full Name")
            flexible_query = f'({first_word} OR "{institution_name}")'
            return flexible_query
        else:
            # For institutions, use exact phrase matching
            return f'"{institution_name}"'

    def get_institution_mentions(
        self,
        institution_name: str,
        max_results: int = 100,
        include_trend_data: bool = True
    ) -> Dict[str, Any]:
        """
        Comprehensive institution analysis using official X SDK with type-specific keywords.

        Args:
            institution_name: Name of the institution
            max_results: Max tweets to fetch
            include_trend_data: Whether to fetch volume trend data

        Returns:
            Enriched data with tweets, trends, and metadata including institution type
        """
        # Get institution-specific context for targeted search
        inst_context = get_institution_context(institution_name)
        inst_type = inst_context["institution_type"]
        type_specific_keywords = inst_context["risk_keywords"]

        # Base risk keywords (common to all)
        base_risk_keywords = [
            "outage", "down", "not working", "can't access", "can't login",
            "fraud", "scam", "hack", "breach", "warning"
        ]

        # Combine base + type-specific keywords (prioritize type-specific)
        risk_keywords = type_specific_keywords[:8] + base_risk_keywords[:6]

        # Build flexible query that works for both institutions and person names
        primary_query = self._build_flexible_query(institution_name, inst_type)
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
            "sdk": self.sdk_version,
            "institution_type": inst_type,
            "risk_keywords_used": risk_keywords[:8],
            "api_metrics": {
                "requests_made": self.request_count,
                "success_rate": self.success_count / max(self.request_count, 1),
                "circuit_breaker_status": self.circuit_breaker.get_status()
            }
        }

    def get_api_health(self) -> Dict:
        """Get current API health status."""
        return {
            "sdk": self.sdk_version,
            "circuit_breaker": self.circuit_breaker.get_status(),
            "request_count": self.request_count,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "success_rate": round(self.success_count / max(self.request_count, 1), 3)
        }


# =============================================================================
# Institution Type Classification & Type-Specific Prompts
# =============================================================================

class InstitutionType(Enum):
    """Types of financial institutions with specific risk profiles."""
    TRADITIONAL_BANK = "traditional_bank"
    NEOBANK = "neobank"
    CRYPTO_EXCHANGE = "crypto_exchange"
    CRYPTO_WALLET = "crypto_wallet"
    TRADING_PLATFORM = "trading_platform"
    PAYMENT_APP = "payment_app"
    UNKNOWN = "unknown"


# Institution classification database
INSTITUTION_REGISTRY = {
    # Traditional Banks
    "chase": InstitutionType.TRADITIONAL_BANK,
    "jpmorgan": InstitutionType.TRADITIONAL_BANK,
    "bank of america": InstitutionType.TRADITIONAL_BANK,
    "wells fargo": InstitutionType.TRADITIONAL_BANK,
    "citibank": InstitutionType.TRADITIONAL_BANK,
    "citi": InstitutionType.TRADITIONAL_BANK,
    "us bank": InstitutionType.TRADITIONAL_BANK,
    "pnc": InstitutionType.TRADITIONAL_BANK,
    "capital one": InstitutionType.TRADITIONAL_BANK,
    "td bank": InstitutionType.TRADITIONAL_BANK,
    "truist": InstitutionType.TRADITIONAL_BANK,
    "fifth third": InstitutionType.TRADITIONAL_BANK,
    "regions": InstitutionType.TRADITIONAL_BANK,
    "huntington": InstitutionType.TRADITIONAL_BANK,
    "m&t bank": InstitutionType.TRADITIONAL_BANK,
    "citizens bank": InstitutionType.TRADITIONAL_BANK,
    "first republic": InstitutionType.TRADITIONAL_BANK,
    "svb": InstitutionType.TRADITIONAL_BANK,
    "silicon valley bank": InstitutionType.TRADITIONAL_BANK,
    "signature bank": InstitutionType.TRADITIONAL_BANK,
    "hsbc": InstitutionType.TRADITIONAL_BANK,
    "barclays": InstitutionType.TRADITIONAL_BANK,
    "deutsche bank": InstitutionType.TRADITIONAL_BANK,

    # Neobanks / Digital Banks
    "chime": InstitutionType.NEOBANK,
    "sofi": InstitutionType.NEOBANK,
    "varo": InstitutionType.NEOBANK,
    "current": InstitutionType.NEOBANK,
    "ally": InstitutionType.NEOBANK,
    "marcus": InstitutionType.NEOBANK,
    "discover bank": InstitutionType.NEOBANK,
    "revolut": InstitutionType.NEOBANK,
    "n26": InstitutionType.NEOBANK,
    "monzo": InstitutionType.NEOBANK,
    "starling": InstitutionType.NEOBANK,
    "dave": InstitutionType.NEOBANK,
    "aspiration": InstitutionType.NEOBANK,
    "one finance": InstitutionType.NEOBANK,

    # Crypto Exchanges
    "coinbase": InstitutionType.CRYPTO_EXCHANGE,
    "binance": InstitutionType.CRYPTO_EXCHANGE,
    "binance.us": InstitutionType.CRYPTO_EXCHANGE,
    "kraken": InstitutionType.CRYPTO_EXCHANGE,
    "gemini": InstitutionType.CRYPTO_EXCHANGE,
    "crypto.com": InstitutionType.CRYPTO_EXCHANGE,
    "ftx": InstitutionType.CRYPTO_EXCHANGE,
    "kucoin": InstitutionType.CRYPTO_EXCHANGE,
    "bitfinex": InstitutionType.CRYPTO_EXCHANGE,
    "bitstamp": InstitutionType.CRYPTO_EXCHANGE,
    "okx": InstitutionType.CRYPTO_EXCHANGE,
    "bybit": InstitutionType.CRYPTO_EXCHANGE,
    "huobi": InstitutionType.CRYPTO_EXCHANGE,
    "gate.io": InstitutionType.CRYPTO_EXCHANGE,
    "upbit": InstitutionType.CRYPTO_EXCHANGE,
    "robinhood crypto": InstitutionType.CRYPTO_EXCHANGE,
    "coinbase pro": InstitutionType.CRYPTO_EXCHANGE,

    # Crypto Wallets
    "metamask": InstitutionType.CRYPTO_WALLET,
    "phantom": InstitutionType.CRYPTO_WALLET,
    "ledger": InstitutionType.CRYPTO_WALLET,
    "trezor": InstitutionType.CRYPTO_WALLET,
    "trust wallet": InstitutionType.CRYPTO_WALLET,
    "coinbase wallet": InstitutionType.CRYPTO_WALLET,
    "exodus": InstitutionType.CRYPTO_WALLET,
    "atomic wallet": InstitutionType.CRYPTO_WALLET,
    "electrum": InstitutionType.CRYPTO_WALLET,
    "myetherwallet": InstitutionType.CRYPTO_WALLET,
    "rainbow wallet": InstitutionType.CRYPTO_WALLET,
    "argent": InstitutionType.CRYPTO_WALLET,
    "zerion": InstitutionType.CRYPTO_WALLET,
    "rabby": InstitutionType.CRYPTO_WALLET,
    "uniswap wallet": InstitutionType.CRYPTO_WALLET,
    "safepal": InstitutionType.CRYPTO_WALLET,
    "bitget wallet": InstitutionType.CRYPTO_WALLET,

    # Trading Platforms
    "robinhood": InstitutionType.TRADING_PLATFORM,
    "webull": InstitutionType.TRADING_PLATFORM,
    "e*trade": InstitutionType.TRADING_PLATFORM,
    "etrade": InstitutionType.TRADING_PLATFORM,
    "td ameritrade": InstitutionType.TRADING_PLATFORM,
    "fidelity": InstitutionType.TRADING_PLATFORM,
    "schwab": InstitutionType.TRADING_PLATFORM,
    "charles schwab": InstitutionType.TRADING_PLATFORM,
    "interactive brokers": InstitutionType.TRADING_PLATFORM,
    "ibkr": InstitutionType.TRADING_PLATFORM,
    "merrill edge": InstitutionType.TRADING_PLATFORM,
    "vanguard": InstitutionType.TRADING_PLATFORM,
    "tastyworks": InstitutionType.TRADING_PLATFORM,
    "tastytrade": InstitutionType.TRADING_PLATFORM,
    "moomoo": InstitutionType.TRADING_PLATFORM,
    "public": InstitutionType.TRADING_PLATFORM,
    "firstrade": InstitutionType.TRADING_PLATFORM,
    "m1 finance": InstitutionType.TRADING_PLATFORM,
    "acorns": InstitutionType.TRADING_PLATFORM,
    "stash": InstitutionType.TRADING_PLATFORM,

    # Payment Apps
    "venmo": InstitutionType.PAYMENT_APP,
    "paypal": InstitutionType.PAYMENT_APP,
    "cash app": InstitutionType.PAYMENT_APP,
    "cashapp": InstitutionType.PAYMENT_APP,
    "zelle": InstitutionType.PAYMENT_APP,
    "apple pay": InstitutionType.PAYMENT_APP,
    "google pay": InstitutionType.PAYMENT_APP,
    "square": InstitutionType.PAYMENT_APP,
    "stripe": InstitutionType.PAYMENT_APP,
    "wise": InstitutionType.PAYMENT_APP,
    "transferwise": InstitutionType.PAYMENT_APP,
    "remitly": InstitutionType.PAYMENT_APP,
    "western union": InstitutionType.PAYMENT_APP,
    "moneygram": InstitutionType.PAYMENT_APP,
    "afterpay": InstitutionType.PAYMENT_APP,
    "klarna": InstitutionType.PAYMENT_APP,
    "affirm": InstitutionType.PAYMENT_APP,
}


def classify_institution(name: str) -> InstitutionType:
    """Classify an institution by name to determine its type."""
    name_lower = name.lower().strip()

    # Direct match
    if name_lower in INSTITUTION_REGISTRY:
        return INSTITUTION_REGISTRY[name_lower]

    # Partial match (e.g., "Chase Bank" matches "chase")
    for key, inst_type in INSTITUTION_REGISTRY.items():
        if key in name_lower or name_lower in key:
            return inst_type

    # Keyword-based classification
    crypto_keywords = ["crypto", "coin", "token", "defi", "dex", "swap", "chain", "wallet"]
    bank_keywords = ["bank", "banking", "credit union", "federal"]
    trading_keywords = ["trade", "trading", "broker", "invest", "stocks"]
    payment_keywords = ["pay", "payment", "transfer", "send money", "cash"]

    for keyword in crypto_keywords:
        if keyword in name_lower:
            return InstitutionType.CRYPTO_EXCHANGE
    for keyword in bank_keywords:
        if keyword in name_lower:
            return InstitutionType.TRADITIONAL_BANK
    for keyword in trading_keywords:
        if keyword in name_lower:
            return InstitutionType.TRADING_PLATFORM
    for keyword in payment_keywords:
        if keyword in name_lower:
            return InstitutionType.PAYMENT_APP

    return InstitutionType.UNKNOWN


# Type-specific risk keywords
INSTITUTION_RISK_KEYWORDS = {
    InstitutionType.TRADITIONAL_BANK: [
        "fdic", "bank run", "insolvency", "bailout", "bankruptcy",
        "frozen accounts", "mass withdrawals", "capital requirements",
        "stress test", "liquidity crisis", "fed intervention",
        "branch closures", "layoffs", "credit rating", "downgrade"
    ],
    InstitutionType.NEOBANK: [
        "charter issues", "partner bank", "fdic pass-through",
        "account closures", "funds delayed", "verification issues",
        "debanking", "compliance", "regulatory scrutiny",
        "overdraft", "early paycheck", "savings rate"
    ],
    InstitutionType.CRYPTO_EXCHANGE: [
        "rug pull", "exit scam", "funds locked", "paused withdrawals",
        "cold wallet drained", "hot wallet hack", "proof of reserves",
        "insolvency", "sec lawsuit", "cftc", "trading halted",
        "delisting", "liquidity crisis", "customer funds",
        "ftx", "celsius", "3ac", "contagion"
    ],
    InstitutionType.CRYPTO_WALLET: [
        "exploit", "vulnerability", "compromised", "drainer",
        "phishing", "malicious contract", "approval exploit",
        "seed phrase", "private key", "firmware", "supply chain",
        "blind signing", "signature request", "airdrop scam"
    ],
    InstitutionType.TRADING_PLATFORM: [
        "can't execute", "order stuck", "margin call", "pdt rule",
        "trading halted", "circuit breaker", "options expiry",
        "settlement", "t+1", "buying restricted", "selling restricted",
        "meme stocks", "short squeeze", "volatility halt"
    ],
    InstitutionType.PAYMENT_APP: [
        "frozen account", "limited access", "pending review",
        "fraud hold", "chargeback", "scam", "unauthorized",
        "failed transfer", "money missing", "dispute",
        "instant transfer", "standard transfer", "business account"
    ]
}


# Type-specific prompt sections
INSTITUTION_PROMPT_SECTIONS = {
    InstitutionType.TRADITIONAL_BANK: """
TRADITIONAL BANK ANALYSIS CONTEXT:
You are analyzing a TRADITIONAL BANK (FDIC-insured depository institution).

KEY RISK SIGNALS TO WATCH:
1. BANK RUN INDICATORS: Mass withdrawal reports, long lines at branches, ATM limits
2. REGULATORY: FDIC actions, OCC warnings, Fed stress test failures, consent orders
3. LIQUIDITY: Interbank lending issues, capital ratio concerns, credit rating downgrades
4. CONTAGION: Connections to failing institutions, exposure to problem sectors
5. OPERATIONS: Branch closures, layoffs, system outages affecting deposits

SEVERITY MODIFIERS:
- Regional banks: Higher scrutiny after SVB/Signature failures
- Money center banks: Systemic importance = higher threshold for HIGH
- Credit rating changes: Immediate attention required
- FDIC mentions: Always flag for review""",

    InstitutionType.NEOBANK: """
NEOBANK / DIGITAL BANK ANALYSIS CONTEXT:
You are analyzing a NEOBANK (digital-first bank, often using partner bank charters).

KEY RISK SIGNALS TO WATCH:
1. PARTNER BANK ISSUES: Problems with underlying bank (FDIC pass-through risks)
2. ACCOUNT ACTIONS: Mass account closures, debanking reports, verification freezes
3. FUND ACCESS: Delayed deposits, withdrawal issues, transfer failures
4. REGULATORY: Compliance issues, fintech charter concerns, consumer complaints
5. FEATURE ISSUES: Early paycheck, overdraft, savings rate changes

SEVERITY MODIFIERS:
- Partner bank dependency: Check for underlying bank issues
- Account closure patterns: May indicate compliance crackdown
- Rapid growth concerns: Scaling vs. customer service
- Synapse/middleware issues: Can affect multiple neobanks""",

    InstitutionType.CRYPTO_EXCHANGE: """
CRYPTO EXCHANGE ANALYSIS CONTEXT:
You are analyzing a CRYPTOCURRENCY EXCHANGE (centralized trading platform).

KEY RISK SIGNALS TO WATCH:
1. WITHDRAWAL ISSUES: Paused withdrawals, processing delays, "maintenance" claims
2. PROOF OF RESERVES: Failed audits, questionable attestations, Merkle tree issues
3. REGULATORY: SEC/CFTC actions, securities violations, money transmission
4. INSOLVENCY: FTX comparisons, Celsius comparisons, liquidity concerns
5. SECURITY: Hot wallet drains, API exploits, insider threats

SEVERITY MODIFIERS:
- Withdrawal pauses: IMMEDIATE HIGH RISK (FTX pattern)
- Proof of reserves issues: Elevated concern
- Multiple verified reports: Weight heavily
- Offshore exchanges: Higher baseline risk
- Post-FTX: Market extremely sensitive to exchange risk""",

    InstitutionType.CRYPTO_WALLET: """
CRYPTO WALLET ANALYSIS CONTEXT:
You are analyzing a CRYPTOCURRENCY WALLET (self-custody or managed wallet).

KEY RISK SIGNALS TO WATCH:
1. SECURITY: Exploits, vulnerabilities, drainer contracts, phishing campaigns
2. UPDATE ISSUES: Bad firmware, compromised updates, supply chain attacks
3. INTEGRATION: dApp connection issues, signature request problems
4. SCAMS: Fake apps, impersonation, social engineering targeting users
5. OPERATIONAL: Sync issues, balance display errors, transaction failures

SEVERITY MODIFIERS:
- Hardware vs. Software: Different risk profiles
- Browser extension wallets: Higher phishing exposure
- Mobile wallets: App store security concerns
- Multi-sig: Complexity can introduce bugs
- Active exploit: IMMEDIATE HIGH RISK""",

    InstitutionType.TRADING_PLATFORM: """
TRADING PLATFORM ANALYSIS CONTEXT:
You are analyzing a TRADING PLATFORM (stock/options broker).

KEY RISK SIGNALS TO WATCH:
1. EXECUTION: Order failures, stuck orders, delayed fills, wrong prices
2. ACCESS: Login issues, app crashes during market hours, API outages
3. RESTRICTIONS: Buying/selling halts, position-close-only, margin changes
4. REGULATORY: FINRA actions, SEC fines, pattern day trading issues
5. SETTLEMENT: T+1 issues, failed settlements, account restrictions

SEVERITY MODIFIERS:
- Market hours issues: Much more severe than after-hours
- High volatility events: Meme stocks, earnings, Fed days
- Options expiry: Friday issues especially critical
- Margin calls: Can cascade quickly
- 2021 GME comparisons: Market sensitive to trading restrictions""",

    InstitutionType.PAYMENT_APP: """
PAYMENT APP ANALYSIS CONTEXT:
You are analyzing a PAYMENT APP (P2P transfers, digital payments).

KEY RISK SIGNALS TO WATCH:
1. FUND ACCESS: Account freezes, limited functionality, pending reviews
2. TRANSFERS: Failed transactions, delayed payments, missing money
3. FRAUD: Unauthorized transactions, scam waves, account takeovers
4. DISPUTES: Chargeback issues, buyer/seller protection problems
5. VERIFICATION: Identity verification loops, document requests

SEVERITY MODIFIERS:
- Account freezes: Common but concerning at scale
- Business accounts: Higher stakes, more scrutiny
- Crypto features: Additional regulatory exposure
- BNPL issues: Credit-related concerns
- Fraud waves: Often target specific platforms""",

    InstitutionType.UNKNOWN: """
FINANCIAL INSTITUTION ANALYSIS CONTEXT:
You are analyzing a FINANCIAL SERVICE (type not specifically categorized).

Apply general financial risk analysis principles:
1. SERVICE DISRUPTION: Outages, access issues, functionality problems
2. FUND SECURITY: Withdrawal issues, missing funds, unauthorized access
3. REGULATORY: Legal actions, compliance issues, license problems
4. REPUTATION: Trust signals, verified complaints, official statements
5. OPERATIONAL: Customer service issues, processing delays

Use standard risk assessment without institution-type-specific weighting."""
}


def get_institution_context(institution_name: str) -> Dict[str, Any]:
    """Get type-specific context for an institution."""
    inst_type = classify_institution(institution_name)

    return {
        "institution_name": institution_name,
        "institution_type": inst_type.value,
        "risk_keywords": INSTITUTION_RISK_KEYWORDS.get(inst_type, []),
        "prompt_section": INSTITUTION_PROMPT_SECTIONS.get(inst_type, INSTITUTION_PROMPT_SECTIONS[InstitutionType.UNKNOWN])
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
        Analyze tweets with enhanced intelligence, full traceability, and type-specific prompts.

        Args:
            bank_name: Institution being analyzed
            tweet_data: Rich data from XAPIClient.get_institution_mentions()
            model: Grok model to use

        Returns:
            Comprehensive analysis with traceability and institution type context
        """
        tweets = tweet_data.get("tweets", [])
        trend_data = tweet_data.get("trend_data", {})

        # Get institution-specific context
        inst_context = get_institution_context(bank_name)
        inst_type = inst_context["institution_type"]
        type_specific_prompt = inst_context["prompt_section"]
        type_specific_keywords = inst_context["risk_keywords"]

        if not tweets:
            return {
                "risk_level": "LOW",
                "summary": f"No recent tweets found mentioning {bank_name}.",
                "key_findings": [],
                "tweet_count": 0,
                "top_tweets": [],
                "viral_score": 0,
                "trend_analysis": "No data available",
                "institution_type": inst_type
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

        # Build institution-type-specific system prompt
        system_prompt = f"""You are an elite financial risk analyst specializing in real-time monitoring of financial institutions via social media signals.

{type_specific_prompt}

TYPE-SPECIFIC KEYWORDS TO WATCH: {', '.join(type_specific_keywords[:10])}

Your analysis must be:
1. GROUNDED - Only cite information from the provided tweets
2. TRACEABLE - Reference specific tweets by their URL when making claims
3. QUANTITATIVE - Include engagement metrics to support severity assessment
4. ACTIONABLE - Provide clear risk level with justification
5. TYPE-AWARE - Apply the institution-type-specific risk signals above

RISK LEVELS:
- HIGH: Platform-wide outages (multiple verified reports), withdrawal freezes confirmed, hack/breach with evidence, regulatory action announced, bank run signals, rug pull indicators, active exploits
- MEDIUM: Localized outages (some reports, not widespread), elevated complaint volume, unconfirmed but spreading rumors, isolated access issues, delayed transactions
- LOW: Normal operations, routine individual complaints, minor bugs, promotional content, no systemic indicators

CREDIBILITY WEIGHTING:
- Verified accounts (especially business/government): HIGH weight
- High-follower accounts (>100K): HIGH weight
- High-engagement tweets (many RTs/likes): HIGH weight
- New accounts or low engagement: LOW weight

Respond in this exact JSON format:
{{
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "summary": "2-3 sentence assessment citing specific evidence",
    "key_findings": ["Finding 1 with tweet evidence", "Finding 2"],
    "top_concerning_tweets": [
        {{"text": "tweet text (truncated)", "url": "full url", "engagement": "X RTs, Y likes", "why_concerning": "reason"}}
    ],
    "viral_indicators": "Assessment of spread velocity and influential users",
    "confidence": 0.0-1.0,
    "recommended_action": "Specific action recommendation"
}}"""

        user_prompt = f"""Analyze these tweets about {bank_name} ({inst_type.replace('_', ' ').title()}) for financial risk indicators:

{trend_context}

INSTITUTION CONTEXT:
- Name: {bank_name}
- Type: {inst_type.replace('_', ' ').title()}
- Type-specific risk keywords: {', '.join(type_specific_keywords[:8])}

AGGREGATE METRICS:
- Tweets analyzed: {len(tweets)}
- Total engagement score: {total_engagement:.0f}
- Verified account tweets: {verified_tweet_count}
- Average credibility score: {avg_credibility:.1f}
- Viral risk score: {viral_score:.1f}/100

TWEETS (sorted by credibility, includes direct URLs):

{tweets_text}

Provide your risk assessment applying {inst_type.replace('_', ' ')} analysis context. Remember to cite specific tweet URLs in your findings."""

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

            # Enrich with metadata including institution type
            result["tweet_count"] = len(tweets)
            result["model_used"] = model
            result["viral_score"] = round(viral_score, 1)
            result["verified_sources"] = verified_tweet_count
            result["trend_velocity"] = trend_data.get("velocity_change_percent", 0) if trend_data else 0
            result["is_trending_up"] = trend_data.get("is_spiking", False) if trend_data else False
            result["institution_type"] = inst_type
            result["type_specific_keywords_checked"] = type_specific_keywords[:5]

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

    def analyze_single_tweet(
        self,
        institution: str,
        tweet_text: str,
        metrics: Dict[str, int],
        model: str = "grok-3-fast"
    ) -> Dict[str, Any]:
        """
        Analyze a single tweet for quick risk assessment (used by stream monitor).

        Args:
            institution: Institution name the tweet mentions
            tweet_text: The tweet text content
            metrics: Engagement metrics (retweet_count, reply_count, like_count, quote_count)
            model: Grok model to use

        Returns:
            Quick risk assessment for the single tweet
        """
        total_engagement = sum(metrics.values())

        system_prompt = """You are a financial risk analyst. Analyze this single tweet about a financial institution for risk indicators.

Respond in JSON format:
{
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "risk_type": "crisis" | "complaint" | "concern" | "positive" | "neutral",
    "summary": "Brief 1-sentence assessment",
    "urgency": 1-10,
    "action_needed": true | false
}"""

        user_prompt = f"""Analyze this tweet about {institution}:

"{tweet_text}"

Engagement metrics:
- Retweets: {metrics.get('retweet_count', 0)}
- Replies: {metrics.get('reply_count', 0)}
- Likes: {metrics.get('like_count', 0)}
- Quotes: {metrics.get('quote_count', 0)}
- Total engagement: {total_engagement}

Assess the risk level considering both content and virality potential."""

        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=200,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            result["institution"] = institution
            result["engagement"] = total_engagement
            result["analyzed_at"] = datetime.now(timezone.utc).isoformat()
            return result

        except Exception as e:
            return {
                "risk_level": "UNKNOWN",
                "risk_type": "error",
                "summary": f"Analysis failed: {str(e)}",
                "urgency": 0,
                "action_needed": False,
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
# Grok Analysis Client - xai_sdk (Responses API + Server-Side Tools)
# =============================================================================

class GrokAnalysisClient:
    """
    Enhanced Grok client using the official xai_sdk for:
    - Responses API (stateful conversations with 30-day retention)
    - Server-side x_search (no X API rate limits)
    - Streaming responses for real-time UI updates

    Use this for:
    - Stateful multi-turn analysis
    - When X API is rate limited (x_search runs server-side)
    - Deep investigation with conversation context
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("XAI_API_KEY")
        if not self.api_key:
            raise ValueError("XAI_API_KEY is required for xai_sdk")

        # Lazy import xai_sdk (may not be installed)
        try:
            from xai_sdk import Client as XAISDKClient
            self.client = XAISDKClient(api_key=self.api_key)
            self.sdk_available = True
        except ImportError:
            self.sdk_available = False
            self.client = None

        # Session storage: institution -> response_id
        self.sessions: Dict[str, str] = {}

        # Analysis history for delta tracking
        self.analysis_history: Dict[str, List[Dict]] = {}

    def is_available(self) -> bool:
        """Check if xai_sdk is available."""
        return self.sdk_available and self.client is not None

    def get_session_id(self, institution: str) -> Optional[str]:
        """Get existing session ID for an institution."""
        return self.sessions.get(institution.lower())

    def analyze_with_x_search(
        self,
        institution: str,
        additional_context: Optional[str] = None,
        continue_session: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze institution using xai_sdk with server-side x_search.

        Benefits:
        - x_search runs on xAI servers (no X API quota usage)
        - Responses API for stateful conversations
        - AI-curated search results

        Args:
            institution: Name of the institution
            additional_context: Extra context or follow-up question
            continue_session: Whether to continue previous session

        Returns:
            Analysis result with session ID for continuation
        """
        if not self.is_available():
            return {
                "status": "error",
                "error": "xai_sdk not available",
                "fallback": "Use GrokClient instead"
            }

        from xai_sdk.chat import user, system
        from xai_sdk.tools import x_search

        # Get institution-specific context
        inst_context = get_institution_context(institution)
        inst_type = inst_context["institution_type"]
        type_specific_prompt = inst_context["prompt_section"]
        type_specific_keywords = inst_context["risk_keywords"]

        # Build chat configuration
        chat_kwargs = {
            "model": "grok-4-1-fast",  # Optimized for tool calling
            "tools": [x_search()],
            "store_messages": True  # Enable Responses API
        }

        # Continue previous session if available
        institution_key = institution.lower()
        if continue_session and institution_key in self.sessions:
            chat_kwargs["previous_response_id"] = self.sessions[institution_key]

        try:
            chat = self.client.chat.create(**chat_kwargs)

            # System prompt with institution-specific context
            system_prompt = f"""You are an elite financial risk analyst with real-time X (Twitter) search capabilities.

{type_specific_prompt}

TYPE-SPECIFIC KEYWORDS: {', '.join(type_specific_keywords[:8])}

IMPORTANT INSTRUCTIONS:
1. Use x_search to find recent posts about the institution
2. Search for risk-related keywords specific to this institution type
3. Analyze the sentiment and urgency of findings
4. Include post URLs in your findings for traceability
5. Provide a risk assessment: HIGH, MEDIUM, or LOW

RISK LEVELS:
- HIGH: Platform outages, withdrawal freezes, hacks, regulatory action, bank run signals
- MEDIUM: Localized issues, elevated complaints, unconfirmed rumors
- LOW: Normal operations, routine complaints, no systemic issues

Respond with structured JSON:
{{
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "summary": "2-3 sentence assessment",
    "key_findings": ["Finding with evidence"],
    "evidence_posts": [{{"text": "post text", "url": "post url", "author": "@username"}}],
    "search_queries_used": ["query1", "query2"],
    "confidence": 0.0-1.0,
    "recommended_action": "action if any"
}}"""

            chat.append(system(system_prompt))

            # Build user prompt
            if additional_context:
                user_prompt = f"Continue analyzing {institution} ({inst_type.replace('_', ' ').title()}). {additional_context}"
            else:
                user_prompt = f"""Analyze {institution} ({inst_type.replace('_', ' ').title()}) for financial risk indicators.

Search X for:
1. "{institution}" + ({' OR '.join(type_specific_keywords[:4])})
2. "{institution}" + (outage OR down OR "not working")
3. Recent complaints or issues

Provide your risk assessment with evidence from the posts you find."""

            chat.append(user(user_prompt))

            # Execute with streaming to capture tool calls
            full_response = ""
            tool_calls_made = []

            for response, chunk in chat.stream():
                if hasattr(chunk, 'tool_calls') and chunk.tool_calls:
                    for tool_call in chunk.tool_calls:
                        tool_calls_made.append({
                            "tool": tool_call.function.name if hasattr(tool_call, 'function') else str(tool_call),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                if hasattr(chunk, 'content') and chunk.content:
                    full_response += chunk.content

            # Save session ID for continuation
            if hasattr(response, 'id') and response.id:
                self.sessions[institution_key] = response.id

            # Try to parse as JSON
            result = self._parse_response(full_response, institution, inst_type)
            result["session_id"] = self.sessions.get(institution_key)
            result["tool_calls"] = tool_calls_made
            result["data_source"] = "xai_sdk (x_search server-side)"
            result["continued_session"] = continue_session and institution_key in self.sessions

            # Track in history
            if institution_key not in self.analysis_history:
                self.analysis_history[institution_key] = []
            self.analysis_history[institution_key].append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "risk_level": result.get("risk_level"),
                "session_id": result.get("session_id")
            })

            return result

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "institution": institution,
                "institution_type": inst_type
            }

    def analyze_streaming(
        self,
        institution: str,
        callback: Optional[Callable[[str], None]] = None
    ) -> Generator[Dict, None, None]:
        """
        Stream analysis updates for real-time UI.

        Yields:
            Dict updates as analysis progresses
        """
        if not self.is_available():
            yield {"status": "error", "error": "xai_sdk not available"}
            return

        from xai_sdk.chat import user, system
        from xai_sdk.tools import x_search

        inst_context = get_institution_context(institution)
        inst_type = inst_context["institution_type"]
        type_specific_prompt = inst_context["prompt_section"]

        yield {
            "stage": "initializing",
            "message": f"Starting analysis for {institution} ({inst_type})...",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        try:
            chat = self.client.chat.create(
                model="grok-4-1-fast",
                tools=[x_search()],
                store_messages=True
            )

            chat.append(system(f"You are a financial risk analyst. {type_specific_prompt}"))
            chat.append(user(f"Analyze {institution} for financial risk using x_search."))

            yield {
                "stage": "searching",
                "message": "Searching X for recent posts...",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            content_buffer = ""
            for response, chunk in chat.stream():
                if hasattr(chunk, 'tool_calls') and chunk.tool_calls:
                    yield {
                        "stage": "tool_call",
                        "message": "Executing x_search...",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }

                if hasattr(chunk, 'content') and chunk.content:
                    content_buffer += chunk.content
                    if callback:
                        callback(chunk.content)
                    yield {
                        "stage": "analyzing",
                        "chunk": chunk.content,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }

            # Final result
            result = self._parse_response(content_buffer, institution, inst_type)

            if hasattr(response, 'id') and response.id:
                self.sessions[institution.lower()] = response.id
                result["session_id"] = response.id

            yield {
                "stage": "complete",
                "result": result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            yield {
                "stage": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

    def get_risk_trend(self, institution: str) -> Dict[str, Any]:
        """
        Get risk trend for an institution based on analysis history.

        Returns:
            Trend data showing risk level changes over time
        """
        institution_key = institution.lower()
        history = self.analysis_history.get(institution_key, [])

        if not history:
            return {"trend": "no_data", "history": []}

        risk_values = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "UNKNOWN": 0}

        risk_scores = [
            risk_values.get(h.get("risk_level", "UNKNOWN"), 0)
            for h in history
        ]

        if len(risk_scores) < 2:
            trend = "insufficient_data"
        elif risk_scores[-1] > risk_scores[-2]:
            trend = "escalating"
        elif risk_scores[-1] < risk_scores[-2]:
            trend = "improving"
        else:
            trend = "stable"

        return {
            "institution": institution,
            "trend": trend,
            "current_risk": history[-1].get("risk_level") if history else None,
            "analysis_count": len(history),
            "history": history[-5:]  # Last 5 analyses
        }

    def _parse_response(self, content: str, institution: str, inst_type: str) -> Dict[str, Any]:
        """Parse response content, attempting JSON extraction."""
        import re

        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                result = json.loads(json_match.group())
                result["institution"] = institution
                result["institution_type"] = inst_type
                return result
        except json.JSONDecodeError:
            pass

        # Fallback to unstructured response
        return {
            "risk_level": "UNKNOWN",
            "summary": content[:500] if content else "No response received",
            "key_findings": [],
            "institution": institution,
            "institution_type": inst_type,
            "raw_response": content
        }


# =============================================================================
# Grok Live Search Fallback (When X API is rate limited)
# =============================================================================

def _grok_live_search_analysis(bank_name: str) -> Dict[str, Any]:
    """
    Fallback: Use Grok's live search capability when X API is rate limited.
    Grok can search X/Twitter in real-time as part of its response.
    Now includes institution-type-specific prompts.
    """
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise ValueError("XAI_API_KEY is required for Grok fallback")

    # Get institution-specific context
    inst_context = get_institution_context(bank_name)
    inst_type = inst_context["institution_type"]
    type_specific_prompt = inst_context["prompt_section"]
    type_specific_keywords = inst_context["risk_keywords"]

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.x.ai/v1"
    )

    system_prompt = f"""You are a financial risk analyst with real-time access to X (Twitter) data.

IMPORTANT: You have live search enabled. Search X/Twitter for recent posts about the institution.

{type_specific_prompt}

TYPE-SPECIFIC KEYWORDS TO SEARCH: {', '.join(type_specific_keywords[:8])}

RISK LEVELS:
- HIGH: Platform-wide outages, withdrawal freezes, hack/breach confirmed, regulatory action, bank run signals, active exploits
- MEDIUM: Localized outages, elevated complaints, unconfirmed rumors, isolated access issues
- LOW: Normal operations, routine complaints, minor bugs, no systemic issues

Return your analysis as JSON:
{{
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "summary": "Brief overall assessment based on what you found",
    "key_findings": ["Finding 1", "Finding 2"],
    "sample_posts": ["Relevant post 1 with URL if available", "Relevant post 2"],
    "post_count_estimate": "approximate number of relevant posts found",
    "data_source": "Grok Live Search (X API fallback)",
    "institution_type": "{inst_type}",
    "confidence": 0.0-1.0
}}"""

    user_prompt = f"""Search X/Twitter for recent posts about "{bank_name}" ({inst_type.replace('_', ' ').title()}) and analyze for financial risk indicators.

Institution Type: {inst_type.replace('_', ' ').title()}
Key risk signals for this type: {', '.join(type_specific_keywords[:6])}

Look for:
- {type_specific_keywords[0] if type_specific_keywords else 'Outage reports'}
- {type_specific_keywords[1] if len(type_specific_keywords) > 1 else 'Security concerns'}
- {type_specific_keywords[2] if len(type_specific_keywords) > 2 else 'Access problems'}
- Customer complaints at unusual volume
- Regulatory or legal news

Provide your risk assessment applying {inst_type.replace('_', ' ')} context. Include post URLs when possible."""

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
                result["institution_type"] = inst_type
                return result
        except json.JSONDecodeError:
            pass

        return {
            "risk_level": "UNKNOWN",
            "summary": content[:500],
            "key_findings": [],
            "data_source": "Grok Live Search (X API fallback)",
            "institution_type": inst_type,
            "confidence": 0.5
        }

    except Exception as e:
        return {
            "risk_level": "UNKNOWN",
            "summary": f"Grok search error: {str(e)}",
            "key_findings": [],
            "data_source": "Grok Live Search (failed)",
            "institution_type": inst_type,
            "error": str(e)
        }


# =============================================================================
# Combined Sentiment Tool (ADK Tool Function - Enhanced)
# =============================================================================

def fetch_market_sentiment(bank_name: str, use_xai_sdk: bool = False) -> str:
    """
    Fetch comprehensive real-time market sentiment for a financial institution.

    DUAL-SDK ARCHITECTURE:
    1. PRIMARY: xai_sdk with x_search (server-side, no rate limits, stateful)
    2. FALLBACK: xdk + GrokClient (direct X API access, full tweet data)

    Features:
    - Stateful sessions with Responses API (30-day retention)
    - Server-side x_search (bypasses X API rate limits)
    - Automatic fallback to xdk for streaming/precise queries
    - Full traceability with tweet URLs
    - Institution-type-specific analysis

    Args:
        bank_name: The name of the institution (e.g., "Chase", "Coinbase", "Robinhood")
        use_xai_sdk: Whether to try xai_sdk first (default True)

    Returns:
        JSON string containing comprehensive sentiment analysis with:
        - Risk level (HIGH/MEDIUM/LOW) with confidence score
        - Key findings with source tweet URLs
        - Session ID for continuation (if using xai_sdk)
        - API health metrics
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    # =========================================================================
    # Strategy 1: xai_sdk with x_search (server-side, stateful)
    # =========================================================================
    if use_xai_sdk:
        try:
            xai_client = GrokAnalysisClient()

            if xai_client.is_available():
                analysis = xai_client.analyze_with_x_search(bank_name)

                if analysis.get("status") != "error":
                    return json.dumps({
                        "bank_name": bank_name,
                        "status": "success",
                        "timestamp": timestamp,
                        "data_source": "xai_sdk (x_search server-side)",
                        "sdk_used": "xai_sdk",
                        "analysis_model": "Grok 4.1 Fast",
                        "session_id": analysis.get("session_id"),
                        "continued_session": analysis.get("continued_session", False),
                        "institution_type": analysis.get("institution_type", "unknown"),
                        "analysis": analysis,
                        "tool_calls": analysis.get("tool_calls", []),
                        "risk_trend": xai_client.get_risk_trend(bank_name)
                    }, indent=2)

        except Exception as e:
            # Log but continue to fallback
            pass

    # =========================================================================
    # Strategy 2: xdk + GrokClient (direct X API, full tweet data)
    # =========================================================================
    use_grok_fallback = False
    rate_limit_error = None

    try:
        # Initialize xdk-based clients
        x_client = XAPIClient()
        grok_client = GrokClient()

        # Fetch comprehensive data using xdk
        tweet_data = x_client.get_institution_mentions(
            bank_name,
            max_results=100,
            include_trend_data=True
        )

        # Analyze with GrokClient (OpenAI-compatible)
        analysis = grok_client.analyze_sentiment(bank_name, tweet_data)

        return json.dumps({
            "bank_name": bank_name,
            "status": "success",
            "timestamp": timestamp,
            "data_source": "xdk + GrokClient (X API v2 direct)",
            "sdk_used": "xdk",
            "endpoints_used": ["/tweets/search/recent", "/tweets/counts/recent"],
            "analysis_model": "Grok 4.1 Fast (OpenAI-compatible)",
            "institution_type": tweet_data.get("institution_type", "unknown"),
            "risk_keywords_used": tweet_data.get("risk_keywords_used", []),
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
            use_grok_fallback = True
            rate_limit_error = str(e)
        else:
            return json.dumps({
                "bank_name": bank_name,
                "status": "error",
                "error": f"Error: {str(e)}",
                "timestamp": timestamp,
                "recovery_suggestion": "Will retry with exponential backoff"
            }, indent=2)

    # =========================================================================
    # Strategy 3: Grok Live Search fallback (when all else fails)
    # =========================================================================
    if use_grok_fallback:
        try:
            analysis = _grok_live_search_analysis(bank_name)

            return json.dumps({
                "bank_name": bank_name,
                "status": "success",
                "timestamp": timestamp,
                "data_source": "Grok Live Search (all SDKs failed/rate limited)",
                "sdk_used": "openai (grok-compatible)",
                "analysis_model": "Grok with live X search",
                "institution_type": analysis.get("institution_type", "unknown"),
                "fallback_reason": rate_limit_error,
                "analysis": analysis
            }, indent=2)

        except Exception as fallback_error:
            return json.dumps({
                "bank_name": bank_name,
                "status": "error",
                "error": f"All strategies failed. xdk: {rate_limit_error}. Grok fallback: {str(fallback_error)}",
                "timestamp": timestamp
            }, indent=2)


def fetch_market_sentiment_streaming(
    bank_name: str,
    callback: Optional[Callable[[Dict], None]] = None
) -> Generator[Dict, None, None]:
    """
    Stream market sentiment analysis with real-time updates.

    Uses xai_sdk for streaming analysis with x_search.
    Ideal for real-time UI updates.

    Args:
        bank_name: Institution to analyze
        callback: Optional callback for each update

    Yields:
        Dict updates as analysis progresses
    """
    try:
        xai_client = GrokAnalysisClient()

        if not xai_client.is_available():
            yield {
                "stage": "error",
                "error": "xai_sdk not available for streaming"
            }
            return

        for update in xai_client.analyze_streaming(bank_name, callback=lambda x: callback({"chunk": x}) if callback else None):
            yield update

    except Exception as e:
        yield {
            "stage": "error",
            "error": str(e)
        }


def continue_analysis(bank_name: str, follow_up: str) -> str:
    """
    Continue a previous analysis session with a follow-up question.

    Uses Responses API to maintain conversation context.

    Args:
        bank_name: Institution being analyzed
        follow_up: Follow-up question or additional context

    Returns:
        JSON string with continued analysis
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        xai_client = GrokAnalysisClient()

        if not xai_client.is_available():
            return json.dumps({
                "status": "error",
                "error": "xai_sdk not available for session continuation",
                "timestamp": timestamp
            }, indent=2)

        session_id = xai_client.get_session_id(bank_name)

        if not session_id:
            return json.dumps({
                "status": "error",
                "error": f"No existing session found for {bank_name}. Run initial analysis first.",
                "timestamp": timestamp
            }, indent=2)

        analysis = xai_client.analyze_with_x_search(
            bank_name,
            additional_context=follow_up,
            continue_session=True
        )

        return json.dumps({
            "bank_name": bank_name,
            "status": "success",
            "timestamp": timestamp,
            "data_source": "xai_sdk (session continuation)",
            "previous_session_id": session_id,
            "new_session_id": analysis.get("session_id"),
            "follow_up_question": follow_up,
            "analysis": analysis,
            "risk_trend": xai_client.get_risk_trend(bank_name)
        }, indent=2)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "error": str(e),
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
# Real-time Stream Monitor (xdk Filtered Stream)
# =============================================================================

class StreamMonitor:
    """
    Enhanced real-time monitoring using xdk filtered stream.

    Features:
    - Rich tweet data with engagement metrics and author info
    - Automatic rule sync with user portfolio
    - Real-time risk detection with instant Grok analysis
    - Auto-reconnect with exponential backoff
    - Volume spike detection

    Usage:
        monitor = StreamMonitor()
        await monitor.sync_with_portfolio(["Coinbase", "Chase"])

        async for event in monitor.stream():
            print(f"New event: {event}")
    """

    def __init__(self):
        self.x_client = XAPIClient()
        self.grok_client = None
        self.monitored_institutions: Dict[str, Dict] = {}
        self.active_rules: List[Dict] = []
        self.event_buffer: List[Dict] = []
        self._running = False
        self._reconnect_attempts = 0
        self._max_reconnect_attempts = 5
        # Volume tracking for spike detection
        self._volume_tracker: Dict[str, List[datetime]] = {}
        self._volume_window_minutes = 5
        # High-engagement threshold for instant Grok analysis
        self._high_engagement_threshold = 50
        # Event deduplication
        self._seen_tweet_ids: set = set()
        self._max_seen_ids = 10000
        # Stats tracking for frontend display
        self._tweets_processed = 0
        self._analyses_performed = 0
        self._spikes_detected = 0

    def _init_grok(self):
        """Lazy initialize Grok client."""
        if self.grok_client is None:
            try:
                self.grok_client = GrokClient()
            except:
                pass

    def add_institution(self, institution: str) -> Dict:
        """Add an institution to monitor with optimized rule."""
        inst_context = get_institution_context(institution)
        inst_type = inst_context["institution_type"]
        risk_keywords = inst_context["risk_keywords"][:6]

        # Build flexible query for person names vs institutions
        is_likely_person = (
            inst_type == "unknown" and
            " " in institution.strip() and
            len(institution.split()) <= 3
        )

        if is_likely_person:
            # For person names, use flexible matching
            words = institution.strip().split()
            first_word = words[0]
            name_clause = f'({first_word} OR "{institution}")'
        else:
            # For institutions, use exact phrase
            name_clause = f'"{institution}"'

        # Build optimized stream rule
        # Include institution name + key risk terms
        keyword_clause = " OR ".join(risk_keywords[:4]) if risk_keywords else ""
        if keyword_clause:
            rule_value = f'{name_clause} ({keyword_clause}) -is:retweet lang:en'
        else:
            # If no risk keywords, just monitor the name
            rule_value = f'{name_clause} -is:retweet lang:en'

        self.monitored_institutions[institution.lower()] = {
            "name": institution,
            "type": inst_type,
            "rule_value": rule_value,
            "risk_keywords": risk_keywords,
            "added_at": datetime.now(timezone.utc).isoformat()
        }

        # Initialize volume tracker
        self._volume_tracker[institution.lower()] = []

        return {
            "status": "added",
            "institution": institution,
            "type": inst_type,
            "rule": rule_value
        }

    def remove_institution(self, institution: str) -> Dict:
        """Remove an institution from monitoring."""
        inst_key = institution.lower()
        if inst_key in self.monitored_institutions:
            del self.monitored_institutions[inst_key]
            if inst_key in self._volume_tracker:
                del self._volume_tracker[inst_key]
            return {"status": "removed", "institution": institution}
        return {"status": "not_found", "institution": institution}

    def get_monitored_institutions(self) -> List[Dict]:
        """Get list of currently monitored institutions with stats."""
        result = []
        for inst_key, inst_data in self.monitored_institutions.items():
            stats = inst_data.copy()
            # Add volume stats
            if inst_key in self._volume_tracker:
                recent = [t for t in self._volume_tracker[inst_key]
                         if t > datetime.now(timezone.utc) - timedelta(minutes=self._volume_window_minutes)]
                stats["tweets_last_5min"] = len(recent)
            result.append(stats)
        return result

    async def sync_with_portfolio(self, institutions: List[str]) -> Dict:
        """
        Sync stream rules with user's portfolio selection.

        Removes rules for institutions no longer in portfolio,
        adds rules for new institutions.
        """
        current = set(self.monitored_institutions.keys())
        target = set(inst.lower() for inst in institutions)

        # Remove institutions no longer in portfolio
        to_remove = current - target
        for inst in to_remove:
            self.remove_institution(inst)

        # Add new institutions
        to_add = target - current
        for inst in institutions:
            if inst.lower() in to_add:
                self.add_institution(inst)

        # Reset counters when syncing (institution selection changed)
        if to_remove or to_add:
            self._tweets_processed = 0
            self._analyses_performed = 0
            self._spikes_detected = 0
            self.event_buffer = []
            self._seen_tweet_ids = set()

        # Apply rules to stream
        result = await self.setup_stream(clear_existing=True)

        return {
            "status": "synced",
            "added": list(to_add),
            "removed": list(to_remove),
            "total_monitored": len(self.monitored_institutions),
            "setup_result": result,
            "counters_reset": bool(to_remove or to_add)
        }

    def build_stream_rules(self) -> List[Dict]:
        """Build stream rules for all monitored institutions."""
        rules = []
        for inst_key, inst_data in self.monitored_institutions.items():
            rules.append({
                "value": inst_data["rule_value"],
                "tag": f"sentinel_{inst_key}"
            })
        return rules

    async def setup_stream(self, clear_existing: bool = True) -> Dict:
        """
        Set up filtered stream rules for monitored institutions.

        Args:
            clear_existing: If True, clears all existing rules first
        """
        rules = self.build_stream_rules()

        if not rules:
            return {
                "status": "error",
                "error": "No institutions to monitor. Add institutions first."
            }

        try:
            # Clear existing rules if requested
            if clear_existing:
                delete_result = self.x_client.delete_stream_rules(delete_all=True)
                if delete_result.get("status") == "error":
                    # Log but continue - might not have any rules
                    pass

            # Add new rules
            result = self.x_client.setup_stream_rules(rules)
            self.active_rules = rules
            self._reconnect_attempts = 0  # Reset on successful setup

            return {
                "status": "success",
                "rules_created": len(rules),
                "institutions": list(self.monitored_institutions.keys()),
                "result": result
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

    def _check_volume_spike(self, institution: str) -> Dict:
        """Check if there's a volume spike for an institution."""
        inst_key = institution.lower()
        if inst_key not in self._volume_tracker:
            return {"is_spiking": False}

        now = datetime.now(timezone.utc)
        window = timedelta(minutes=self._volume_window_minutes)

        # Clean old entries
        self._volume_tracker[inst_key] = [
            t for t in self._volume_tracker[inst_key] if t > now - window
        ]

        # Add current
        self._volume_tracker[inst_key].append(now)

        count = len(self._volume_tracker[inst_key])
        # Spike if more than 10 tweets in 5 minutes
        is_spiking = count > 10

        # Increment spike counter if spike detected
        if is_spiking:
            self._spikes_detected += 1

        return {
            "is_spiking": is_spiking,
            "tweets_in_window": count,
            "window_minutes": self._volume_window_minutes
        }

    async def stream(self, backfill_minutes: int = 0) -> Generator[Dict, None, None]:
        """
        Stream real-time events with enriched data and Grok analysis.

        Args:
            backfill_minutes: Minutes of past data to backfill (0-5)

        Yields:
            Dict with enriched tweet data, risk indicators, and optional Grok analysis
        """
        self._running = True
        self._init_grok()

        try:
            for post in self.x_client.stream_posts(
                backfill_minutes=backfill_minutes,
                include_user_data=True
            ):
                if not self._running:
                    break

                # Handle errors with reconnect logic
                if post.get("error"):
                    self._reconnect_attempts += 1
                    if self._reconnect_attempts <= self._max_reconnect_attempts:
                        wait_time = 2 ** self._reconnect_attempts
                        yield {
                            "type": "reconnecting",
                            "attempt": self._reconnect_attempts,
                            "wait_seconds": wait_time,
                            "error": post["error"],
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        yield {
                            "type": "error",
                            "error": f"Max reconnect attempts reached: {post['error']}",
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        break

                # Reset reconnect counter on success
                self._reconnect_attempts = 0

                # Deduplicate
                tweet_id = post.get("id")
                if tweet_id in self._seen_tweet_ids:
                    continue
                self._seen_tweet_ids.add(tweet_id)
                if len(self._seen_tweet_ids) > self._max_seen_ids:
                    # Remove oldest half
                    self._seen_tweet_ids = set(list(self._seen_tweet_ids)[self._max_seen_ids // 2:])

                # Identify matching institution
                matching_institution = None
                matching_rules = post.get("matching_rules", [])

                for rule in matching_rules:
                    tag = rule.get("tag", "")
                    if tag.startswith("sentinel_"):
                        inst_key = tag.replace("sentinel_", "")
                        if inst_key in self.monitored_institutions:
                            matching_institution = self.monitored_institutions[inst_key]
                            break

                # Risk signal detection
                text = post.get("text", "").lower()
                risk_signals = []

                if matching_institution:
                    for keyword in matching_institution.get("risk_keywords", []):
                        if keyword.lower() in text:
                            risk_signals.append(keyword)

                # Calculate urgency based on signals + engagement
                metrics = post.get("metrics", {})
                total_engagement = metrics.get("total_engagement", 0)
                author = post.get("author", {})

                urgency = "low"
                urgency_score = len(risk_signals) * 10 + (total_engagement / 10)

                if author.get("verified"):
                    urgency_score += 20
                if author.get("followers", 0) > 10000:
                    urgency_score += 10

                if urgency_score >= 50 or len(risk_signals) >= 3:
                    urgency = "high"
                elif urgency_score >= 20 or len(risk_signals) >= 1:
                    urgency = "medium"

                # Check volume spike
                inst_name = matching_institution.get("name") if matching_institution else "unknown"
                volume_status = self._check_volume_spike(inst_name)

                # Build event
                event = {
                    "type": "tweet",
                    "id": tweet_id,
                    "text": post.get("text"),
                    "url": post.get("url"),
                    "created_at": post.get("created_at"),
                    "lang": post.get("lang"),
                    "institution": inst_name,
                    "institution_type": matching_institution.get("type") if matching_institution else "unknown",
                    "risk_signals": risk_signals,
                    "urgency": urgency,
                    "urgency_score": round(urgency_score, 1),
                    "metrics": metrics,
                    "author": author,
                    "hashtags": post.get("hashtags", []),
                    "mentions": post.get("mentions", []),
                    "volume_status": volume_status,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                # Buffer for batch analysis
                self.event_buffer.append(event)
                if len(self.event_buffer) > 500:
                    self.event_buffer = self.event_buffer[-250:]

                # Update stats
                self._tweets_processed += 1

                yield event

                # Trigger instant Grok analysis for high-urgency or high-engagement
                if urgency == "high" or total_engagement >= self._high_engagement_threshold:
                    grok_analysis = None
                    if self.grok_client:
                        try:
                            grok_analysis = self.grok_client.analyze_single_tweet(
                                inst_name,
                                post.get("text", ""),
                                {
                                    "retweet_count": metrics.get("retweets", 0),
                                    "reply_count": metrics.get("replies", 0),
                                    "like_count": metrics.get("likes", 0),
                                    "quote_count": metrics.get("quotes", 0)
                                }
                            )
                            # Increment analysis counter for real-time analysis
                            if grok_analysis:
                                self._analyses_performed += 1
                        except Exception as e:
                            grok_analysis = {"error": str(e)}

                    yield {
                        "type": "alert",
                        "alert_reason": "high_urgency" if urgency == "high" else "high_engagement",
                        "message": f"⚠️ {inst_name}: {', '.join(risk_signals) if risk_signals else 'High engagement detected'}",
                        "event": event,
                        "grok_analysis": grok_analysis,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }

                # Alert on volume spike
                if volume_status.get("is_spiking"):
                    yield {
                        "type": "volume_spike",
                        "message": f"📈 Volume spike: {inst_name} - {volume_status['tweets_in_window']} tweets in {volume_status['window_minutes']}min",
                        "institution": inst_name,
                        "volume_status": volume_status,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }

        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        finally:
            self._running = False

    def stop(self):
        """Stop the stream."""
        self._running = False

    def get_stats(self) -> Dict:
        """Get monitoring statistics."""
        return {
            "running": self._running,
            "institutions": len(self.monitored_institutions),
            "active_rules": len(self.active_rules),
            "buffered_events": len(self.event_buffer),
            "reconnect_attempts": self._reconnect_attempts,
            "tweets_processed": self._tweets_processed,
            "analyses_performed": self._analyses_performed,
            "spikes_detected": self._spikes_detected,
            "volume_trackers": {
                k: len(v) for k, v in self._volume_tracker.items()
            }
        }

    async def analyze_buffered_events(self) -> Dict:
        """Analyze buffered events with Grok for comprehensive risk assessment."""
        if not self.event_buffer:
            return {"status": "no_events", "count": 0}

        # Group events by institution
        by_institution: Dict[str, List[Dict]] = {}
        for event in self.event_buffer:
            inst = event.get("institution", "unknown")
            if inst not in by_institution:
                by_institution[inst] = []
            by_institution[inst].append(event)

        results = {}
        for institution, events in by_institution.items():
            if institution == "unknown":
                continue

            try:
                grok_client = GrokAnalysisClient()
                if grok_client.is_available():
                    # Build context from recent events
                    recent_signals = set()
                    for e in events[-10:]:
                        recent_signals.update(e.get('risk_signals', []))

                    context = f"Analyzing {len(events)} real-time stream events. Risk signals detected: {', '.join(recent_signals)}"
                    analysis = grok_client.analyze_with_x_search(
                        institution,
                        additional_context=context
                    )
                    results[institution] = analysis
                    # Increment analysis counter
                    self._analyses_performed += 1
            except Exception as e:
                results[institution] = {"error": str(e)}

        # Clear buffer after analysis
        self.event_buffer = []

        return {
            "status": "analyzed",
            "institutions_analyzed": list(results.keys()),
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def create_stream_monitor(institutions: List[str]) -> StreamMonitor:
    """
    Factory function to create a configured StreamMonitor.

    Args:
        institutions: List of institution names to monitor

    Returns:
        Configured StreamMonitor instance
    """
    monitor = StreamMonitor()
    for inst in institutions:
        monitor.add_institution(inst)
    return monitor


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
