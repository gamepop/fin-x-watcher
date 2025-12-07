#!/usr/bin/env python3
"""
Polling-based recent tweets fetcher (no Pro stream required).

- Reads X_BEARER_TOKEN from .env (repo root) or env vars.
- Polls search_recent every 30s with a query.
- Tracks since_id to only show new tweets.
"""

import os, sys, time
from typing import Optional, Dict, List, Any
from xdk import Client
import requests

REPO_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")

# Institution keywords (from your UI list)
INSTITUTIONS = [
    # Banks
    "Chase", "Bank of America", "Wells Fargo", "Citibank", "Capital One", "US Bank", "PNC Bank",
    # Exchanges
    "Coinbase", "Binance", "Kraken", "Gemini", "Crypto.com", "KuCoin", "Bitfinex",
    # Wallets
    "MetaMask", "Phantom", "Ledger", "Trust Wallet", "Coinbase Wallet",
    # Stock Trading
    "Robinhood", "Webull", "E*TRADE", "Fidelity", "Charles Schwab", "TD Ameritrade", "Interactive Brokers",
    # Robo-Advisors
    "Wealthfront", "Betterment", "Acorns", "SoFi Invest", "Ellevest",
    # Payments
    "Venmo", "Cash App", "PayPal", "Zelle", "Apple Pay",
    # Neobanks
    "Chime", "SoFi", "Revolut", "Current", "Varo",
]

# Build an OR query across institutions, English, exclude retweets
QUERY_PRIMARY = " OR ".join(f'\"{name}\"' for name in INSTITUTIONS) + " lang:en -is:retweet"
# Fallback broader finance/news query
QUERY_FALLBACK = "(finance OR banking OR markets OR stocks OR crypto OR fintech) lang:en -is:retweet"

POLL_SECONDS = 30
POLL_ONCE = os.getenv("POLL_ONCE") is not None

def load_env(path: str):
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v

def fetch_new(client: Client, query: str, since_id: Optional[str]):
    tweets: List[Dict[str, Any]] = []
    users: Dict[str, Dict[str, Any]] = {}
    meta: Dict[str, Any] = {}

    try:
        stream = client.posts.search_recent(
            query=query,
            max_results=20,
            tweet_fields=["id","text","created_at","author_id","public_metrics","lang"],
            expansions=["author_id"],
            user_fields=["username","verified","public_metrics"],
            since_id=since_id,
        )
        for resp in stream:
            data = resp.model_dump() if hasattr(resp, "model_dump") else resp
            if not isinstance(data, dict):
                continue
            tweets.extend(data.get("data") or [])
            for u in data.get("includes", {}).get("users", []) or []:
                uid = u.get("id")
                if uid:
                    users[uid] = u
            if data.get("meta"):
                meta = data["meta"]
    except requests.exceptions.HTTPError as exc:
        print(f"HTTP error: {exc}", file=sys.stderr)
    except Exception as exc:
        print(f"Error fetching tweets: {exc}", file=sys.stderr)

    return tweets, users, meta

def main():
    load_env(REPO_ENV_PATH)
    token = os.getenv("X_BEARER_TOKEN")
    if not token:
        print("Set X_BEARER_TOKEN in .env or env vars.", file=sys.stderr)
        sys.exit(1)
    client = Client(bearer_token=token)

    since_id = None
    print(f"Polling recent tweets for institutions (primary query)...")
    try:
        while True:
            tweets, users, meta = fetch_new(client, QUERY_PRIMARY, since_id)

            # If no institution hits, try fallback finance/news query
            used_query = QUERY_PRIMARY
            if not tweets:
                tweets, users, meta = fetch_new(client, QUERY_FALLBACK, since_id)
                used_query = QUERY_FALLBACK

            if tweets:
                since_id = tweets[0].get("id", since_id)
                for t in tweets:
                    author = users.get(t.get("author_id"), {})
                    handle = f"@{author.get('username','unknown')}"
                    url = f"https://x.com/{author.get('username','unknown')}/status/{t.get('id')}"
                    text = (t.get("text") or "").replace("\n", " ")
                    metrics = t.get("public_metrics", {}) or {}
                    print(f"[{t.get('lang','?')}] {handle}: {text}")
                    print(f"  url: {url}")
                    print(f"  likes={metrics.get('like_count',0)} rt={metrics.get('retweet_count',0)} repl={metrics.get('reply_count',0)}")
                    print("----")
            else:
                print("No new tweets on primary or fallback queries.")

            if POLL_ONCE:
                print(f"Query used: {used_query}")
                break
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()