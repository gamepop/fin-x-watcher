"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction } from "@copilotkit/react-core";
import { useState, useEffect } from "react";

// Institution categories with icons
const INSTITUTIONS = {
  "Traditional Banks": [
    "Chase", "Bank of America", "Wells Fargo", "Citibank", "Capital One", "US Bank", "PNC Bank"
  ],
  "Crypto Exchanges": [
    "Coinbase", "Binance", "Kraken", "Gemini", "Crypto.com", "KuCoin", "Bitfinex"
  ],
  "Crypto Wallets": [
    "MetaMask", "Phantom", "Ledger", "Trust Wallet", "Coinbase Wallet"
  ],
  "Stock Trading": [
    "Robinhood", "Webull", "E*TRADE", "Fidelity", "Charles Schwab", "TD Ameritrade", "Interactive Brokers"
  ],
  "Robo-Advisors": [
    "Wealthfront", "Betterment", "Acorns", "SoFi Invest", "Ellevest"
  ],
  "Payment Apps": [
    "Venmo", "Cash App", "PayPal", "Zelle", "Apple Pay"
  ],
  "Neobanks": [
    "Chime", "SoFi", "Revolut", "Current", "Varo"
  ],
};

const CATEGORY_ICONS: Record<string, string> = {
  "Traditional Banks": "bank",
  "Crypto Exchanges": "bitcoin",
  "Crypto Wallets": "wallet",
  "Stock Trading": "chart",
  "Robo-Advisors": "robot",
  "Payment Apps": "cash",
  "Neobanks": "phone",
};

export default function Home() {
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState(10); // minutes
  const [showSetup, setShowSetup] = useState(true);
  const [lastMonitorTime, setLastMonitorTime] = useState<Date | null>(null);

  // Register render function for risk analysis
  useCopilotAction({
    name: "display_risk_analysis",
    description: "Display a risk analysis card for a financial institution",
    parameters: [
      { name: "bankName", type: "string", description: "Name of the institution", required: true },
      { name: "riskLevel", type: "string", description: "Risk level: HIGH, MEDIUM, LOW", required: true },
      { name: "summary", type: "string", description: "Summary of the analysis", required: true },
      { name: "keyFindings", type: "string[]", description: "List of key findings", required: false },
      { name: "tweetCount", type: "number", description: "Number of tweets analyzed", required: false },
    ],
    render: ({ args }) => {
      const riskColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
        HIGH: { bg: "bg-red-100", border: "border-red-500", text: "text-red-700", badge: "bg-red-500" },
        MEDIUM: { bg: "bg-yellow-100", border: "border-yellow-500", text: "text-yellow-700", badge: "bg-yellow-500" },
        LOW: { bg: "bg-green-100", border: "border-green-500", text: "text-green-700", badge: "bg-green-500" },
      };
      const colors = riskColors[args.riskLevel || "LOW"] || riskColors.LOW;

      return (
        <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-4 my-3 shadow-sm`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{args.bankName}</h3>
            <span className={`${colors.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
              {args.riskLevel}
            </span>
          </div>
          <p className={`${colors.text} text-sm mb-3`}>{args.summary}</p>
          {args.keyFindings && args.keyFindings.length > 0 && (
            <ul className="text-sm text-gray-700 space-y-1 mb-3">
              {args.keyFindings.map((finding: string, idx: number) => (
                <li key={idx}>- {finding}</li>
              ))}
            </ul>
          )}
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
            Tweets analyzed: {args.tweetCount || 0} | Source: X API + Grok
          </div>
        </div>
      );
    },
  });

  const toggleInstitution = (name: string) => {
    setSelectedInstitutions(prev =>
      prev.includes(name)
        ? prev.filter(i => i !== name)
        : [...prev, name]
    );
  };

  const selectCategory = (category: string) => {
    const institutions = INSTITUTIONS[category as keyof typeof INSTITUTIONS];
    const allSelected = institutions.every(i => selectedInstitutions.includes(i));
    if (allSelected) {
      setSelectedInstitutions(prev => prev.filter(i => !institutions.includes(i)));
    } else {
      setSelectedInstitutions(prev => [...new Set([...prev, ...institutions])]);
    }
  };

  // Generate the monitoring prompt
  const getMonitoringPrompt = () => {
    if (selectedInstitutions.length === 0) return "";
    return `Analyze these financial institutions for risk: ${selectedInstitutions.join(", ")}. For each one, fetch market sentiment and send alerts for any HIGH or MEDIUM risk findings.`;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Sidebar - Institution Selection */}
      <aside className={`${showSetup ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-slate-800/50 border-r border-slate-700`}>
        <div className="p-4 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">My Portfolio</h2>
            <span className="text-xs text-slate-400">{selectedInstitutions.length} selected</span>
          </div>

          {/* Categories */}
          {Object.entries(INSTITUTIONS).map(([category, institutions]) => (
            <div key={category} className="mb-4">
              <button
                onClick={() => selectCategory(category)}
                className="flex items-center justify-between w-full text-left text-sm font-medium text-slate-300 hover:text-white mb-2"
              >
                <span>{category}</span>
                <span className="text-xs text-slate-500">
                  {institutions.filter(i => selectedInstitutions.includes(i)).length}/{institutions.length}
                </span>
              </button>
              <div className="flex flex-wrap gap-1.5">
                {institutions.map(inst => (
                  <button
                    key={inst}
                    onClick={() => toggleInstitution(inst)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                      selectedInstitutions.includes(inst)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Continuous Monitoring Settings */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-white mb-3">Continuous Monitoring</h3>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Status</span>
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                disabled={selectedInstitutions.length === 0}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isMonitoring ? 'bg-green-600' : 'bg-slate-600'
                } ${selectedInstitutions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isMonitoring ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mb-3">
              <label className="text-sm text-slate-400 block mb-1">Check every</label>
              <select
                value={monitoringInterval}
                onChange={(e) => setMonitoringInterval(Number(e.target.value))}
                className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2 border border-slate-600"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </div>

            {isMonitoring && (
              <div className="text-xs text-green-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Monitoring {selectedInstitutions.length} institutions
              </div>
            )}

            {lastMonitorTime && (
              <div className="text-xs text-slate-500 mt-2">
                Last check: {lastMonitorTime.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {selectedInstitutions.length > 0 && (
            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  const prompt = getMonitoringPrompt();
                  // This will be sent via the chat
                  navigator.clipboard.writeText(prompt);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              >
                Copy Analysis Prompt
              </button>
              <button
                onClick={() => setSelectedInstitutions([])}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm py-2 px-4 rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSetup(!showSetup)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Financial Sentinel</h1>
                <p className="text-xs text-slate-400">Real-time risk monitoring via X API + Grok</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {selectedInstitutions.length > 0 && (
                <span className="text-sm text-slate-400">
                  Watching: <span className="text-white">{selectedInstitutions.length}</span> institutions
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Live
              </span>
            </div>
          </div>
        </header>

        {/* Chat Interface */}
        <main className="flex-1 overflow-hidden">
          <CopilotChat
            className="h-full"
            labels={{
              title: "Financial Sentinel",
              initial: selectedInstitutions.length > 0
                ? `I'm monitoring ${selectedInstitutions.length} institutions for you: ${selectedInstitutions.slice(0, 3).join(", ")}${selectedInstitutions.length > 3 ? '...' : ''}.\n\nType "analyze all" to check them now, or ask about specific ones.`
                : "Hi! I'm your Financial Sentinel. Select institutions from the sidebar to monitor, or ask me to analyze any financial institution.\n\nExamples:\n- \"Analyze Chase and Coinbase\"\n- \"Check if Robinhood has any issues\"\n- \"Monitor my crypto: Binance, MetaMask, Phantom\"",
              placeholder: selectedInstitutions.length > 0
                ? `Analyze ${selectedInstitutions.length} selected institutions...`
                : "Ask me to analyze any financial institution...",
            }}
            instructions={`You are the Financial Sentinel monitoring financial institutions for risk.

${selectedInstitutions.length > 0 ? `The user has selected these institutions to monitor: ${selectedInstitutions.join(", ")}

If the user says "analyze all", "check all", "monitor all", or similar, analyze ALL of their selected institutions.` : ''}

When analyzing:
1. Use fetch_market_sentiment for each institution
2. Parse the risk_level from results
3. ALWAYS call send_alert for HIGH or MEDIUM risk - this is mandatory!
4. Present clear summaries

Be concise. Cite your data source (X API + Grok or Grok Live Search).`}
          />
        </main>

        {/* Footer */}
        <footer className="bg-slate-800/30 border-t border-slate-700 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Powered by Google ADK + xAI Grok 4.1 Fast</span>
            <span>Data: X API (api.x.com) | Analysis: Grok (api.x.ai)</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
