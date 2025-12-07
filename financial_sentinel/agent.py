"""
Financial Sentinel - Root Agent
================================

This module exposes the root agent for Google ADK.
The agent uses Grok 4.1 Fast via LiteLLM for analysis.
"""

from .agent_factory import create_financial_sentinel_agent

# ADK expects a 'root_agent' variable
root_agent = create_financial_sentinel_agent()
