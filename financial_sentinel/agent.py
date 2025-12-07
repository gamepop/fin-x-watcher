"""
Financial Sentinel - Root Agent
================================

This module exposes the root agent for Google ADK.
The agent uses Grok 4.1 Fast via LiteLLM for analysis.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent import create_financial_sentinel_agent

# ADK expects a 'root_agent' variable
root_agent = create_financial_sentinel_agent()
