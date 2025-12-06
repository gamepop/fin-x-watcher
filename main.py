#!/usr/bin/env python3
"""
Financial Sentinel - Main Execution Loop
=========================================
Continuous monitoring of target banks for financial risk indicators.
Uses Google ADK v1.20+ with xAI Grok 4.1 Fast.
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv

from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types

from agent import create_financial_sentinel_agent


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

DEFAULT_TARGETS: List[str] = [
    # Traditional Banks
    "Chase",
    "Bank of America",
    "Wells Fargo",
    # Crypto Exchanges
    "Coinbase",
    "Binance",
    "Kraken",
    # Crypto Wallets
    "MetaMask",
    "Phantom wallet",
    # Stock Trading
    "Robinhood",
    "Webull",
    "E*TRADE",
    "Fidelity",
    "Charles Schwab",
    # Robo-Advisors
    "Wealthfront",
    "Betterment",
    # Payment Apps
    "Venmo",
    "Cash App",
    "PayPal",
    # Neobanks
    "Chime",
    "SoFi",
]

DEFAULT_INTERVAL_SECONDS: int = 600  # 10 minutes


# -----------------------------------------------------------------------------
# Logging Setup
# -----------------------------------------------------------------------------

def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configure logging for the sentinel."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("sentinel.log", mode="a", encoding="utf-8")
        ]
    )

    return logging.getLogger("FinancialSentinel")


# -----------------------------------------------------------------------------
# Sentinel Runner
# -----------------------------------------------------------------------------

class FinancialSentinel:
    """
    Main sentinel class that orchestrates the monitoring loop.
    """

    def __init__(
        self,
        target_banks: Optional[List[str]] = None,
        interval_seconds: Optional[int] = None,
        logger: Optional[logging.Logger] = None
    ):
        self.target_banks = target_banks or DEFAULT_TARGETS
        self.interval_seconds = interval_seconds or int(
            os.getenv("MONITORING_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS)
        )
        self.logger = logger or setup_logging()

        # Metrics
        self.last_analysis: dict = {}
        self.alert_count: int = 0
        self.cycle_count: int = 0

        # ADK components (initialized async)
        self.agent = None
        self.session_service = None
        self.runner = None
        self.session_id = None

    async def initialize(self) -> None:
        """Initialize the agent and ADK components."""
        self.logger.info("Initializing Financial Sentinel Agent...")

        try:
            # Create the agent with Grok model
            self.agent = create_financial_sentinel_agent()

            # Create session service
            self.session_service = InMemorySessionService()

            # Create session (async operation)
            session = await self.session_service.create_session(
                app_name="financial_sentinel",
                user_id="sentinel_system"
            )
            self.session_id = session.id

            # Create runner
            self.runner = Runner(
                agent=self.agent,
                app_name="financial_sentinel",
                session_service=self.session_service
            )

            self.logger.info("Agent initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize agent: {e}")
            raise

    async def analyze_bank(self, bank_name: str) -> str:
        """
        Run analysis for a single bank.

        Args:
            bank_name: Name of the bank to analyze

        Returns:
            Agent's analysis response
        """
        query = (
            f"Analyze {bank_name} for any financial risks, negative sentiment, "
            f"bank run indicators, outages, or fraud reports. "
            f"Use the fetch_market_sentiment tool to gather current data."
        )

        content = types.Content(
            role='user',
            parts=[types.Part(text=query)]
        )

        response_text = ""

        try:
            async for event in self.runner.run_async(
                user_id="sentinel_system",
                session_id=self.session_id,
                new_message=content
            ):
                # Collect final response
                if hasattr(event, 'is_final_response') and event.is_final_response():
                    if event.content and event.content.parts:
                        response_text = event.content.parts[0].text
                    break
                elif hasattr(event, 'text') and event.text:
                    response_text += event.text
                elif hasattr(event, 'content') and event.content:
                    if isinstance(event.content, str):
                        response_text += event.content

        except Exception as e:
            self.logger.error(f"Error analyzing {bank_name}: {e}")
            response_text = f"Error during analysis: {str(e)}"

        return response_text

    async def run_monitoring_cycle(self) -> dict:
        """
        Run a complete monitoring cycle for all target banks.

        Returns:
            Dictionary with analysis results for each bank
        """
        self.cycle_count += 1
        cycle_start = datetime.now(timezone.utc)

        self.logger.info("=" * 60)
        self.logger.info(f"Starting Monitoring Cycle #{self.cycle_count}")
        self.logger.info(f"Time: {cycle_start.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        self.logger.info(f"Banks to analyze: {len(self.target_banks)}")
        self.logger.info("=" * 60)

        results = {}

        for idx, bank_name in enumerate(self.target_banks, 1):
            self.logger.info(f"\n[{idx}/{len(self.target_banks)}] Analyzing: {bank_name}")

            try:
                response = await self.analyze_bank(bank_name)
                results[bank_name] = {
                    "status": "completed",
                    "response": response,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                # Check for risk indicators in response
                response_upper = response.upper()
                if "HIGH" in response_upper and ("ALERT" in response_upper or "RISK" in response_upper):
                    self.alert_count += 1
                    self.logger.warning(f"HIGH RISK detected for {bank_name}")
                elif "MEDIUM" in response_upper:
                    self.logger.info(f"MEDIUM risk noted for {bank_name}")
                else:
                    self.logger.info(f"All clear for {bank_name}")

                # Log response preview
                preview = response[:200].replace('\n', ' ')
                self.logger.debug(f"Response preview: {preview}...")

            except Exception as e:
                self.logger.error(f"Failed to analyze {bank_name}: {e}")
                results[bank_name] = {
                    "status": "error",
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

            # Small delay between banks to avoid rate limits
            if idx < len(self.target_banks):
                await asyncio.sleep(3)

        cycle_end = datetime.now(timezone.utc)
        duration = (cycle_end - cycle_start).total_seconds()

        self.logger.info("\n" + "=" * 60)
        self.logger.info(f"Cycle #{self.cycle_count} Complete")
        self.logger.info(f"Duration: {duration:.1f} seconds")
        self.logger.info(f"Total alerts sent (all time): {self.alert_count}")
        self.logger.info("=" * 60 + "\n")

        self.last_analysis = results
        return results

    async def run_forever(self) -> None:
        """
        Run the sentinel in continuous monitoring mode.
        """
        self.logger.info("=" * 60)
        self.logger.info("FINANCIAL SENTINEL - Starting Continuous Monitoring")
        self.logger.info(f"Monitoring {len(self.target_banks)} banks")
        self.logger.info(f"Cycle interval: {self.interval_seconds} seconds")
        self.logger.info("=" * 60)

        await self.initialize()

        while True:
            try:
                await self.run_monitoring_cycle()

                self.logger.info(
                    f"Sleeping for {self.interval_seconds} seconds until next cycle..."
                )
                await asyncio.sleep(self.interval_seconds)

            except KeyboardInterrupt:
                self.logger.info("\nReceived shutdown signal. Exiting gracefully...")
                break
            except Exception as e:
                self.logger.error(f"Error in monitoring cycle: {e}")
                self.logger.info("Waiting 60 seconds before retry...")
                await asyncio.sleep(60)

    async def run_once(self) -> dict:
        """
        Run a single monitoring cycle and exit.

        Returns:
            Analysis results dictionary
        """
        await self.initialize()
        return await self.run_monitoring_cycle()


# -----------------------------------------------------------------------------
# CLI Entry Points
# -----------------------------------------------------------------------------

async def main_continuous():
    """Entry point for continuous monitoring."""
    load_dotenv()

    # Parse target banks from environment
    target_banks_env = os.getenv("TARGET_BANKS")
    target_banks = None
    if target_banks_env:
        target_banks = [b.strip() for b in target_banks_env.split(",")]

    log_level = os.getenv("LOG_LEVEL", "INFO")
    logger = setup_logging(log_level)

    # Validate required environment variables
    required_vars = ["XAI_API_KEY", "SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        logger.error("Please check your .env file")
        sys.exit(1)

    sentinel = FinancialSentinel(
        target_banks=target_banks,
        logger=logger
    )

    await sentinel.run_forever()


async def main_single_run():
    """Entry point for a single monitoring cycle."""
    load_dotenv()

    log_level = os.getenv("LOG_LEVEL", "INFO")
    logger = setup_logging(log_level)

    sentinel = FinancialSentinel(logger=logger)
    results = await sentinel.run_once()

    print("\n" + "=" * 60)
    print("ANALYSIS SUMMARY")
    print("=" * 60)

    for bank, result in results.items():
        status_icon = "OK" if result["status"] == "completed" else "ERR"
        print(f"[{status_icon}] {bank}: {result['status']}")

    return results


def cli():
    """Command-line interface entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Financial Sentinel - Bank Risk Monitoring Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                    # Run continuous monitoring
  python main.py --once             # Run single cycle and exit
  python main.py --banks "Chase,Wells Fargo"  # Monitor specific banks
  python main.py --interval 300     # Check every 5 minutes
        """
    )

    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single monitoring cycle and exit"
    )

    parser.add_argument(
        "--banks",
        type=str,
        help="Comma-separated list of banks to monitor"
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=600,
        help="Monitoring interval in seconds (default: 600)"
    )

    args = parser.parse_args()

    # Set environment variables from CLI args
    if args.banks:
        os.environ["TARGET_BANKS"] = args.banks

    if args.interval:
        os.environ["MONITORING_INTERVAL_SECONDS"] = str(args.interval)

    # Run appropriate mode
    if args.once:
        asyncio.run(main_single_run())
    else:
        asyncio.run(main_continuous())


# -----------------------------------------------------------------------------
# Script Entry Point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    cli()
