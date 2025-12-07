#!/usr/bin/env python3
"""
Standalone X Filtered Stream test.

Reads X_BEARER_TOKEN from .env in repo root (or env vars) and connects to the
filtered stream with a few sample rules. Prints tweet text, author, URL, and
basic engagement metrics.

Usage:
  python stream_test.py
"""

import os
import sys
from typing import Dict, List

try:
    from xdk import Client  # Official X SDK
except ImportError:
    print("xdk is required. Install with `pip install xdk`.", file=sys.stderr)
    sys.exit(1)


REPO_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")


def load_env_from_file(path: str) -> None:
    """Minimal .env loader (key=value lines, ignores comments)."""
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception as exc:  # pragma: no cover - diagnostics only
        print(f"Warning: could not read .env file: {exc}", file=sys.stderr)


def add_rules(client: Client, rules: List[Dict[str, str]]) -> None:
    try:
        body = {"add": [{"value": r["value"], "tag": r.get("tag")} for r in rules]}
        added = client.stream.update_rules(body=body)
        print("Rules added:", added)
    except Exception as exc:
        print(f"Warning adding rules: {exc}", file=sys.stderr)


def stream(client: Client) -> None:
    print("Connecting to filtered stream… (Ctrl+C to stop)")
    stream_iter = iter(
        client.stream.posts(
            tweet_fields=["id", "text", "created_at", "author_id", "public_metrics", "lang"],
            expansions=["author_id"],
            user_fields=["username", "verified", "public_metrics"],
            backfill_minutes=0,
        )
    )

    while True:
        try:
            post = next(stream_iter)
        except StopIteration:
            break
        except UnicodeDecodeError:
            # Skip malformed UTF-8 chunks and continue streaming
            continue

        try:
            data = post.model_dump() if hasattr(post, "model_dump") else dict(post)
            tweet = data.get("data") or {}
            users = {u.get("id"): u for u in data.get("includes", {}).get("users", [])}

            author = users.get(tweet.get("author_id"), {})
            handle = f"@{author.get('username', 'unknown')}"
            tweet_id = tweet.get("id")
            url = (
                f"https://x.com/{author.get('username', 'unknown')}/status/{tweet_id}"
                if tweet_id
                else "(no url)"
            )
            text = (tweet.get("text") or "").replace("\n", " ")
            metrics = tweet.get("public_metrics", {}) or {}

            print(f"[{tweet.get('lang', '?')}] {handle}: {text}")
            print(
                f"  url: {url}\n"
                f"  likes={metrics.get('like_count', 0)} "
                f"rt={metrics.get('retweet_count', 0)} "
                f"repl={metrics.get('reply_count', 0)}"
            )
            print("----")
        except UnicodeDecodeError:
            # Skip malformed UTF-8 per tweet
            continue


def main() -> None:
    load_env_from_file(REPO_ENV_PATH)

    token = os.getenv("X_BEARER_TOKEN")
    if not token:
        print("Set X_BEARER_TOKEN in .env or env vars.", file=sys.stderr)
        sys.exit(1)

    client = Client(bearer_token=token)

    # Minimal sample rules; edit as needed.
    rules = [
        {"value": '"Chase" OR "Wells Fargo" lang:en -is:retweet', "tag": "banks"},
        {"value": '"Robinhood" lang:en -is:retweet', "tag": "broker"},
    ]

    add_rules(client, rules)
    try:
        stream(client)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

