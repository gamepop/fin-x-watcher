"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction } from "@copilotkit/react-core";
import { useState, useEffect, useCallback } from "react";

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

// Analysis stage type for SSE
interface AnalysisStage {
  stage: string;
  message: string;
  timestamp: string;
  institution?: string;
  risk_level?: string;
  tweet_count?: number;
  velocity?: number;
  is_spiking?: boolean;
  analysis?: any;
}

export default function Home() {
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState(10); // minutes
  const [showSetup, setShowSetup] = useState(true);
  const [lastMonitorTime, setLastMonitorTime] = useState<Date | null>(null);

  // Real-time streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingInstitution, setStreamingInstitution] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string>("");
  const [liveResults, setLiveResults] = useState<Record<string, any>>({});

  // API health status
  const [apiHealth, setApiHealth] = useState<any>(null);

  // Fetch API health on mount
  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then(res => res.json())
      .then(data => setApiHealth(data))
      .catch(() => setApiHealth({ status: "offline" }));
  }, []);

  // SSE streaming function
  const streamAnalysis = useCallback(async (institution: string) => {
    setIsStreaming(true);
    setStreamingInstitution(institution);
    setStreamStatus(`Connecting to X API for ${institution}...`);

    try {
      const eventSource = new EventSource(`http://localhost:8000/stream/analyze/${encodeURIComponent(institution)}`);

      eventSource.addEventListener("status", (event) => {
        const data: AnalysisStage = JSON.parse(event.data);
        setStreamStatus(data.message);
      });

      eventSource.addEventListener("progress", (event) => {
        const data: AnalysisStage = JSON.parse(event.data);
        setStreamStatus(data.message);
      });

      eventSource.addEventListener("result", (event) => {
        const data: AnalysisStage = JSON.parse(event.data);
        setLiveResults(prev => ({
          ...prev,
          [institution]: data.analysis
        }));
        setStreamStatus(`Analysis complete: ${data.risk_level}`);
      });

      eventSource.addEventListener("done", (event) => {
        eventSource.close();
        setIsStreaming(false);
        setStreamingInstitution(null);
        setLastMonitorTime(new Date());
      });

      eventSource.addEventListener("error", (event) => {
        const data = event.data ? JSON.parse((event as any).data) : { message: "Connection error" };
        setStreamStatus(`Error: ${data.message}`);
        eventSource.close();
        setIsStreaming(false);
      });

      eventSource.onerror = () => {
        eventSource.close();
        setIsStreaming(false);
        setStreamStatus("Connection lost");
      };

    } catch (error) {
      setIsStreaming(false);
      setStreamStatus(`Failed to connect: ${error}`);
    }
  }, []);

  // Register enhanced render function for risk analysis
  useCopilotAction({
    name: "display_risk_analysis",
    description: "Display a comprehensive risk analysis card for a financial institution with enhanced X API data",
    parameters: [
      { name: "bankName", type: "string", description: "Name of the institution", required: true },
      { name: "riskLevel", type: "string", description: "Risk level: HIGH, MEDIUM, LOW", required: true },
      { name: "summary", type: "string", description: "Summary of the analysis", required: true },
      { name: "keyFindings", type: "string[]", description: "List of key findings with sources", required: false },
      { name: "tweetCount", type: "number", description: "Number of tweets analyzed", required: false },
      { name: "viralScore", type: "number", description: "Viral risk score (0-100)", required: false },
      { name: "trendVelocity", type: "number", description: "Volume change percentage", required: false },
      { name: "evidenceTweets", type: "object[]", description: "Top evidence tweets with URLs", required: false },
      { name: "confidence", type: "number", description: "Analysis confidence score", required: false },
    ],
    render: ({ args }) => {
      const riskColors: Record<string, { bg: string; border: string; text: string; badge: string; glow: string }> = {
        HIGH: { bg: "bg-red-100", border: "border-red-500", text: "text-red-700", badge: "bg-red-500", glow: "shadow-red-500/30" },
        MEDIUM: { bg: "bg-yellow-100", border: "border-yellow-500", text: "text-yellow-700", badge: "bg-yellow-500", glow: "shadow-yellow-500/30" },
        LOW: { bg: "bg-green-100", border: "border-green-500", text: "text-green-700", badge: "bg-green-500", glow: "shadow-green-500/30" },
      };
      const colors = riskColors[args.riskLevel || "LOW"] || riskColors.LOW;

      return (
        <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-4 my-3 shadow-lg ${colors.glow}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">{args.bankName}</h3>
            <div className="flex items-center gap-2">
              {args.viralScore !== undefined && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Viral: {args.viralScore}/100
                </span>
              )}
              <span className={`${colors.badge} text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse`}>
                {args.riskLevel}
              </span>
            </div>
          </div>

          {/* Summary */}
          <p className={`${colors.text} text-sm mb-3 font-medium`}>{args.summary}</p>

          {/* Metrics Row */}
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <div className="bg-white/60 px-3 py-1.5 rounded-lg">
              <span className="text-gray-500">Tweets:</span>{" "}
              <span className="font-semibold text-gray-800">{args.tweetCount || 0}</span>
            </div>
            {args.trendVelocity !== undefined && (
              <div className="bg-white/60 px-3 py-1.5 rounded-lg">
                <span className="text-gray-500">Trend:</span>{" "}
                <span className={`font-semibold ${args.trendVelocity > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {args.trendVelocity > 0 ? '+' : ''}{args.trendVelocity?.toFixed(1)}%
                </span>
              </div>
            )}
            {args.confidence !== undefined && (
              <div className="bg-white/60 px-3 py-1.5 rounded-lg">
                <span className="text-gray-500">Confidence:</span>{" "}
                <span className="font-semibold text-gray-800">{(args.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Key Findings */}
          {args.keyFindings && args.keyFindings.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">Key Findings</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                {args.keyFindings.slice(0, 4).map((finding: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-400">-</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence Tweets */}
          {args.evidenceTweets && args.evidenceTweets.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">Evidence from X</h4>
              <div className="space-y-2">
                {args.evidenceTweets.slice(0, 2).map((tweet: any, idx: number) => (
                  <div key={idx} className="bg-white/80 rounded p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800">
                        {tweet.author}
                        {tweet.verified && <span className="ml-1 text-blue-500">✓</span>}
                      </span>
                      <span className="text-gray-400">{tweet.engagement}</span>
                    </div>
                    <p className="text-gray-600 line-clamp-2">{tweet.text}</p>
                    {tweet.url && (
                      <a
                        href={tweet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline mt-1 inline-block"
                      >
                        View on X
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-200 flex items-center justify-between">
            <span>Source: X API v2 + Grok</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Live data
            </span>
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

          {/* API Health Status */}
          {apiHealth && (
            <div className={`mb-4 p-3 rounded-lg ${apiHealth.status === 'healthy' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white">API Status</span>
                <span className={`text-xs px-2 py-0.5 rounded ${apiHealth.status === 'healthy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                  {apiHealth.status === 'healthy' ? 'Connected' : 'Offline'}
                </span>
              </div>
              {apiHealth.features && (
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-400">
                  <span>Multi-endpoint</span>
                  <span>Circuit breaker</span>
                  <span>Viral scoring</span>
                  <span>SSE streaming</span>
                </div>
              )}
            </div>
          )}

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
                    } ${liveResults[inst] ? 'ring-2 ring-green-400' : ''}`}
                  >
                    {inst}
                    {liveResults[inst] && (
                      <span className={`ml-1 ${
                        liveResults[inst].risk_level === 'HIGH' ? 'text-red-300' :
                        liveResults[inst].risk_level === 'MEDIUM' ? 'text-yellow-300' :
                        'text-green-300'
                      }`}>
                        {liveResults[inst].risk_level === 'HIGH' ? '!' :
                         liveResults[inst].risk_level === 'MEDIUM' ? '?' : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Streaming Status */}
          {isStreaming && (
            <div className="mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-blue-400 animate-ping"></div>
                <span className="text-sm font-medium text-white">Streaming Live</span>
              </div>
              <div className="text-xs text-blue-300">{streamingInstitution}</div>
              <div className="text-xs text-slate-400 mt-1">{streamStatus}</div>
            </div>
          )}

          {/* Live Results Display */}
          {Object.keys(liveResults).length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-white mb-2 flex items-center justify-between">
                <span>Analysis Results</span>
                <button
                  onClick={() => setLiveResults({})}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(liveResults).map(([institution, analysis]: [string, any]) => {
                  const riskColors: Record<string, string> = {
                    HIGH: "border-red-500 bg-red-900/30",
                    MEDIUM: "border-yellow-500 bg-yellow-900/30",
                    LOW: "border-green-500 bg-green-900/30",
                  };
                  const riskBadgeColors: Record<string, string> = {
                    HIGH: "bg-red-500",
                    MEDIUM: "bg-yellow-500",
                    LOW: "bg-green-500",
                  };
                  const riskLevel = analysis?.risk_level || "LOW";
                  return (
                    <div
                      key={institution}
                      className={`p-3 rounded-lg border ${riskColors[riskLevel] || riskColors.LOW}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{institution}</span>
                        <span className={`text-xs px-2 py-0.5 rounded text-white ${riskBadgeColors[riskLevel] || riskBadgeColors.LOW}`}>
                          {riskLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-3">
                        {analysis?.summary || "No summary available"}
                      </p>
                      {analysis?.key_findings && analysis.key_findings.length > 0 && (
                        <div className="mt-2 text-xs text-slate-400">
                          <span className="font-medium">Findings:</span>
                          <ul className="mt-1 space-y-1">
                            {analysis.key_findings.slice(0, 2).map((finding: string, idx: number) => (
                              <li key={idx} className="line-clamp-2">• {finding}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis?.sample_posts && analysis.sample_posts.length > 0 && (
                        <div className="mt-2">
                          <a
                            href={analysis.sample_posts[0]?.match(/https:\/\/x\.com\/\S+/)?.[0] || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                          >
                            View source on X →
                          </a>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-slate-500">
                        Confidence: {((analysis?.confidence || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                <option value={1}>1 minute (SSE)</option>
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
                  if (selectedInstitutions.length > 0 && !isStreaming) {
                    streamAnalysis(selectedInstitutions[0]);
                  }
                }}
                disabled={isStreaming}
                className={`w-full ${isStreaming ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
              >
                {isStreaming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Streaming...
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                    Stream Analysis
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  const prompt = getMonitoringPrompt();
                  navigator.clipboard.writeText(prompt);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              >
                Copy Analysis Prompt
              </button>
              <button
                onClick={() => {
                  setSelectedInstitutions([]);
                  setLiveResults({});
                }}
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
                <p className="text-xs text-slate-400">Multi-endpoint X API + Grok | Real-time SSE</p>
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

          {/* Feature badges */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">/tweets/search/recent</span>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">/tweets/counts/recent</span>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">/users/by</span>
            <span className="text-xs bg-purple-700 text-white px-2 py-1 rounded">Viral Scoring</span>
            <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded">SSE Streaming</span>
            <span className="text-xs bg-green-700 text-white px-2 py-1 rounded">Circuit Breaker</span>
          </div>
        </header>

        {/* Chat Interface */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* Loading overlay for long operations */}
          {isStreaming && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-slate-700 max-w-md">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Analyzing {streamingInstitution}</h3>
                    <p className="text-slate-400 text-sm">{streamStatus}</p>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full animate-pulse" style={{width: '60%'}}></div>
                </div>
              </div>
            </div>
          )}

          {/* Streaming Results Panel - Shows above chat when results exist */}
          {Object.keys(liveResults).length > 0 && (
            <div className="bg-slate-800/80 border-b border-slate-700 p-4 max-h-[50vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Live Analysis Results ({Object.keys(liveResults).length})
                </h3>
                <button
                  onClick={() => setLiveResults({})}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700"
                >
                  Clear All
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(liveResults).map(([institution, analysis]: [string, any]) => {
                  const riskColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
                    HIGH: { bg: "bg-red-100", border: "border-red-500", text: "text-red-700", badge: "bg-red-500" },
                    MEDIUM: { bg: "bg-yellow-100", border: "border-yellow-500", text: "text-yellow-700", badge: "bg-yellow-500" },
                    LOW: { bg: "bg-green-100", border: "border-green-500", text: "text-green-700", badge: "bg-green-500" },
                  };
                  const riskLevel = analysis?.risk_level || "LOW";
                  const colors = riskColors[riskLevel] || riskColors.LOW;

                  return (
                    <div
                      key={institution}
                      className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-4 shadow-lg`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-base font-bold text-gray-900">{institution}</h4>
                        <span className={`${colors.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                          {riskLevel}
                        </span>
                      </div>

                      {/* Summary */}
                      <p className={`${colors.text} text-sm mb-3`}>
                        {analysis?.summary || "No summary available"}
                      </p>

                      {/* Metrics */}
                      <div className="flex flex-wrap gap-2 mb-3 text-xs">
                        {analysis?.confidence !== undefined && (
                          <span className="bg-white/60 px-2 py-1 rounded text-gray-700">
                            Confidence: {(analysis.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        <span className="bg-white/60 px-2 py-1 rounded text-gray-700">
                          Source: Grok Live Search
                        </span>
                      </div>

                      {/* Key Findings */}
                      {analysis?.key_findings && analysis.key_findings.length > 0 && (
                        <div className="mb-3">
                          <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Key Findings</h5>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {analysis.key_findings.slice(0, 2).map((finding: string, idx: number) => (
                              <li key={idx} className="line-clamp-2">• {finding}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sample Posts */}
                      {analysis?.sample_posts && analysis.sample_posts.length > 0 && (
                        <div className="border-t border-gray-200 pt-2 mt-2">
                          <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Evidence from X</h5>
                          {analysis.sample_posts.slice(0, 1).map((post: string, idx: number) => {
                            const urlMatch = post.match(/https:\/\/x\.com\/\S+/);
                            return (
                              <div key={idx} className="text-xs text-gray-600">
                                <p className="line-clamp-2 mb-1">{post.replace(/https:\/\/x\.com\/\S+/, '').trim()}</p>
                                {urlMatch && (
                                  <a
                                    href={urlMatch[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    View on X →
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <CopilotChat
            className="flex-1 min-h-0"
            labels={{
              title: "Financial Sentinel",
              initial: selectedInstitutions.length > 0
                ? `I'm monitoring ${selectedInstitutions.length} institutions for you: ${selectedInstitutions.slice(0, 3).join(", ")}${selectedInstitutions.length > 3 ? '...' : ''}.\n\n**Features active:**\n- Multi-endpoint X API (/tweets/search, /tweets/counts)\n- Viral risk scoring & trend detection\n- Verified account weighting\n- Full tweet URL traceability\n\nType "analyze all" to check them now, or ask about specific ones.`
                : "Hi! I'm your Financial Sentinel with **sophisticated X API integration**.\n\n**My capabilities:**\n- Multi-endpoint X API (search + counts + users)\n- Viral risk scoring (engagement-weighted)\n- Trend detection (volume velocity)\n- Circuit breaker (resilient to rate limits)\n- Full traceability (tweet URLs included)\n\nExamples:\n- \"Analyze Chase and Coinbase\"\n- \"Check if Robinhood has any issues\"\n- \"Monitor my crypto: Binance, MetaMask, Phantom\"",
              placeholder: selectedInstitutions.length > 0
                ? `Analyze ${selectedInstitutions.length} selected institutions...`
                : "Ask me to analyze any financial institution...",
            }}
            instructions={`You are the Financial Sentinel with SOPHISTICATED X API integration.

${selectedInstitutions.length > 0 ? `The user has selected these institutions to monitor: ${selectedInstitutions.join(", ")}

If the user says "analyze all", "check all", "monitor all", or similar, analyze ALL of their selected institutions.` : ''}

## Your X API Integration
You use MULTIPLE X API ENDPOINTS for comprehensive analysis:
1. /tweets/search/recent - Fetch tweets with full metadata
2. /tweets/counts/recent - Detect volume trends and spikes
3. /users/by - Verify account credibility

## Analysis Features
- Viral risk scoring (0-100) based on engagement velocity
- Trend detection comparing recent vs historical volume
- Verification weighting (verified accounts carry more weight)
- Full traceability with tweet URLs

## When Analyzing:
1. Use fetch_market_sentiment for each institution
2. Parse the rich results including:
   - risk_level (HIGH/MEDIUM/LOW)
   - viral_score (0-100)
   - trend_velocity (% change)
   - evidence_tweets (with URLs)
3. ALWAYS call send_alert for HIGH or MEDIUM risk - this is mandatory!
4. Present clear summaries with tweet sources

## Response Format
Include in your response:
- Risk level with viral score
- Trend direction (is volume spiking?)
- Key findings WITH tweet URLs for verification
- Evidence tweets from high-credibility sources

Be concise. Cite your data source (X API + Grok) and include tweet URLs for traceability.`}
          />
        </main>

        {/* Footer */}
        <footer className="bg-slate-800/30 border-t border-slate-700 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Powered by Google ADK + xAI Grok 4.1 Fast | Multi-endpoint X API v2</span>
            <span>Data: api.x.com | Analysis: api.x.ai | Streaming: SSE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
