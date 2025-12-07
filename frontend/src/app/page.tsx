"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction } from "@copilotkit/react-core";
import { useState, useEffect, useCallback, useRef } from "react";

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

// Streaming result type for chat history
interface StreamingResult {
  id: string;
  institution: string;
  analysis: any;
  timestamp: Date;
}

// Webhook event type for real-time push notifications
interface WebhookEvent {
  id: string;
  type: string;
  institution: string;
  tweet: {
    id: string;
    text: string;
    author_id: string;
    created_at: string;
    public_metrics: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
    };
  };
  grok_analysis?: {
    risk_level: string;
    risk_type: string;
    summary: string;
    urgency: number;
    action_needed: boolean;
  };
  received_at: string;
  timestamp: string;
}

// Helper function to render text with clickable X/Twitter links
function TextWithLinks({ text }: { text: string }) {
  // Split text by X/Twitter URLs
  const urlRegex = /(https?:\/\/(?:x\.com|twitter\.com)\/\w+\/status\/\d+)/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={idx}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              [view]
            </a>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

// Reusable Risk Analysis Card Component - matches the agent's display_risk_analysis render
function RiskAnalysisCard({
  bankName,
  riskLevel,
  summary,
  keyFindings,
  tweetCount,
  viralScore,
  trendVelocity,
  evidenceTweets,
  confidence,
  timestamp,
  isStreaming = false
}: {
  bankName: string;
  riskLevel: string;
  summary: string;
  keyFindings?: string[];
  tweetCount?: number;
  viralScore?: number;
  trendVelocity?: number;
  evidenceTweets?: { author: string; verified?: boolean; engagement?: string; text: string; url?: string }[];
  confidence?: number;
  timestamp?: Date;
  isStreaming?: boolean;
}) {
  const riskColors: Record<string, { bg: string; border: string; text: string; badge: string; glow: string }> = {
    HIGH: { bg: "bg-red-100", border: "border-red-500", text: "text-red-700", badge: "bg-red-500", glow: "shadow-red-500/30" },
    MEDIUM: { bg: "bg-yellow-100", border: "border-yellow-500", text: "text-yellow-700", badge: "bg-yellow-500", glow: "shadow-yellow-500/30" },
    LOW: { bg: "bg-green-100", border: "border-green-500", text: "text-green-700", badge: "bg-green-500", glow: "shadow-green-500/30" },
  };
  const colors = riskColors[riskLevel] || riskColors.LOW;

  return (
    <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-4 my-3 shadow-lg ${colors.glow}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          )}
          <h3 className="text-lg font-bold text-gray-900">{bankName}</h3>
        </div>
        <div className="flex items-center gap-2">
          {viralScore !== undefined && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              Viral: {viralScore}/100
            </span>
          )}
          <span className={`${colors.badge} text-white text-xs font-bold px-3 py-1 rounded-full ${riskLevel === 'HIGH' ? 'animate-pulse' : ''}`}>
            {riskLevel}
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className={`${colors.text} text-sm mb-3 font-medium`}>
        <TextWithLinks text={summary} />
      </p>

      {/* Metrics Row */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        {tweetCount !== undefined && tweetCount > 0 && (
          <div className="bg-white/60 px-3 py-1.5 rounded-lg">
            <span className="text-gray-500">Tweets:</span>{" "}
            <span className="font-semibold text-gray-800">{tweetCount}</span>
          </div>
        )}
        {trendVelocity !== undefined && (
          <div className="bg-white/60 px-3 py-1.5 rounded-lg">
            <span className="text-gray-500">Trend:</span>{" "}
            <span className={`font-semibold ${trendVelocity > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {trendVelocity > 0 ? '+' : ''}{trendVelocity?.toFixed(1)}%
            </span>
          </div>
        )}
        {confidence !== undefined && (
          <div className="bg-white/60 px-3 py-1.5 rounded-lg">
            <span className="text-gray-500">Confidence:</span>{" "}
            <span className="font-semibold text-gray-800">{(confidence * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Key Findings */}
      {keyFindings && keyFindings.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">Key Findings</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            {keyFindings.slice(0, 4).map((finding: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-gray-400 flex-shrink-0">-</span>
                <span><TextWithLinks text={finding} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence Tweets */}
      {evidenceTweets && evidenceTweets.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">Evidence from X</h4>
          <div className="space-y-2">
            {evidenceTweets.slice(0, 2).map((tweet: any, idx: number) => (
              <div key={idx} className="bg-white/80 rounded p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">
                    {tweet.author}
                    {tweet.verified && <span className="ml-1 text-blue-500">✓</span>}
                  </span>
                  {tweet.engagement && <span className="text-gray-400">{tweet.engagement}</span>}
                </div>
                <p className="text-gray-600 line-clamp-2">{tweet.text}</p>
                {tweet.url && (
                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline mt-1 inline-flex items-center gap-1 font-medium cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    View on X →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200 flex items-center justify-between">
        <span>Source: X API v2 + Grok Live Search</span>
        <span className="flex items-center gap-1">
          {isStreaming ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              Streaming
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              {timestamp ? timestamp.toLocaleTimeString() : 'Live data'}
            </>
          )}
        </span>
      </div>
    </div>
  );
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

  // Streaming results for chat history (renders as cards)
  const [streamingResults, setStreamingResults] = useState<StreamingResult[]>([]);

  // Continuous monitoring state
  const [nextCheckTime, setNextCheckTime] = useState<Date | null>(null);
  const [monitoringQueue, setMonitoringQueue] = useState<string[]>([]);
  const [currentMonitoringIndex, setCurrentMonitoringIndex] = useState(0);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // API health status
  const [apiHealth, setApiHealth] = useState<any>(null);

  // Webhook events state
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [webhookConnected, setWebhookConnected] = useState(false);
  const [showWebhookPanel, setShowWebhookPanel] = useState(false);
  const webhookEventSourceRef = useRef<EventSource | null>(null);

  // Fetch API health on mount
  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then(res => res.json())
      .then(data => setApiHealth(data))
      .catch(() => setApiHealth({ status: "offline" }));
  }, []);

  // Connect to webhook stream when panel is shown
  useEffect(() => {
    if (showWebhookPanel && !webhookEventSourceRef.current) {
      const eventSource = new EventSource("http://localhost:8000/webhooks/x/stream");

      eventSource.addEventListener("connected", () => {
        setWebhookConnected(true);
      });

      eventSource.addEventListener("webhook_tweet", (event) => {
        const data = JSON.parse(event.data);
        setWebhookEvents(prev => [{
          id: `${data.tweet?.id || Date.now()}`,
          ...data
        }, ...prev].slice(0, 50)); // Keep last 50 events
      });

      eventSource.addEventListener("keepalive", () => {
        // Just keep connection alive
      });

      eventSource.onerror = () => {
        setWebhookConnected(false);
      };

      webhookEventSourceRef.current = eventSource;
    }

    return () => {
      if (!showWebhookPanel && webhookEventSourceRef.current) {
        webhookEventSourceRef.current.close();
        webhookEventSourceRef.current = null;
        setWebhookConnected(false);
      }
    };
  }, [showWebhookPanel]);

  // Function to run a monitoring cycle (analyze all selected institutions)
  const runMonitoringCycle = useCallback(async () => {
    if (selectedInstitutions.length === 0 || isStreaming) return;

    // Analyze each institution sequentially
    for (const institution of selectedInstitutions) {
      setStreamingInstitution(institution);
      setStreamStatus(`Monitoring: Analyzing ${institution}...`);

      try {
        // Use SSE to get the result
        const eventSource = new EventSource(
          `http://localhost:8000/stream/analyze/${encodeURIComponent(institution)}`
        );

        await new Promise<void>((resolve, reject) => {
          eventSource.addEventListener("result", (event) => {
            const data: AnalysisStage = JSON.parse(event.data);
            const analysis = data.analysis;

            // Store result
            setLiveResults(prev => ({
              ...prev,
              [institution]: analysis
            }));

            // Add to streaming results for card display
            setStreamingResults(prev => [
              ...prev,
              {
                id: `monitor-${institution}-${Date.now()}`,
                institution,
                analysis,
                timestamp: new Date()
              }
            ]);
          });

          eventSource.addEventListener("done", () => {
            eventSource.close();
            resolve();
          });

          eventSource.addEventListener("error", () => {
            eventSource.close();
            resolve(); // Continue to next institution even on error
          });

          eventSource.onerror = () => {
            eventSource.close();
            resolve();
          };

          // Timeout after 60 seconds per institution
          setTimeout(() => {
            eventSource.close();
            resolve();
          }, 60000);
        });

        // Small delay between institutions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error monitoring ${institution}:`, error);
      }
    }

    setStreamingInstitution(null);
    setStreamStatus("");
    setLastMonitorTime(new Date());

    // Calculate next check time
    const nextTime = new Date(Date.now() + monitoringInterval * 60 * 1000);
    setNextCheckTime(nextTime);
  }, [selectedInstitutions, isStreaming, monitoringInterval]);

  // Continuous monitoring effect
  useEffect(() => {
    if (isMonitoring && selectedInstitutions.length > 0) {
      // Run immediately on first enable
      runMonitoringCycle();

      // Set up interval for subsequent checks
      const intervalMs = monitoringInterval * 60 * 1000;
      monitoringIntervalRef.current = setInterval(() => {
        runMonitoringCycle();
      }, intervalMs);

      // Calculate initial next check time
      const nextTime = new Date(Date.now() + intervalMs);
      setNextCheckTime(nextTime);

      return () => {
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current);
          monitoringIntervalRef.current = null;
        }
        setNextCheckTime(null);
      };
    } else {
      // Clear interval when monitoring is disabled
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
      setNextCheckTime(null);
    }
  }, [isMonitoring, selectedInstitutions.length, monitoringInterval, runMonitoringCycle]);

  // SSE streaming function - results render as cards above chat
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
        const analysis = data.analysis;

        // Store result for sidebar badge indicators
        setLiveResults(prev => ({
          ...prev,
          [institution]: analysis
        }));
        setStreamStatus(`Analysis complete: ${data.risk_level}`);

        // Add result to streaming results for card rendering
        setStreamingResults(prev => [
          ...prev,
          {
            id: `result-${institution}-${Date.now()}`,
            institution,
            analysis,
            timestamp: new Date()
          }
        ]);
      });

      eventSource.addEventListener("done", () => {
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

  // Register enhanced render function for risk analysis - uses shared RiskAnalysisCard component
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
    render: ({ args }) => (
      <RiskAnalysisCard
        bankName={args.bankName || 'Unknown'}
        riskLevel={args.riskLevel || 'LOW'}
        summary={args.summary || 'No summary available'}
        keyFindings={args.keyFindings}
        tweetCount={args.tweetCount}
        viralScore={args.viralScore}
        trendVelocity={args.trendVelocity}
        evidenceTweets={args.evidenceTweets}
        confidence={args.confidence}
      />
    ),
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
                    className={`px-2.5 py-1 text-xs rounded-full transition-all ${selectedInstitutions.includes(inst)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      } ${liveResults[inst] ? 'ring-2 ring-green-400' : ''}`}
                  >
                    {inst}
                    {liveResults[inst] && (
                      <span className={`ml-1 ${liveResults[inst].risk_level === 'HIGH' ? 'text-red-300' :
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

          {/* Continuous Monitoring Settings */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-white mb-3">Continuous Monitoring</h3>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Status</span>
              <button
                onClick={() => setIsMonitoring(!isMonitoring)}
                disabled={selectedInstitutions.length === 0}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMonitoring ? 'bg-green-600' : 'bg-slate-600'
                  } ${selectedInstitutions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMonitoring ? 'translate-x-6' : 'translate-x-1'
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
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={360}>6 hours</option>
                <option value={720}>12 hours</option>
                <option value={1440}>Daily (24 hours)</option>
                <option value={10080}>Weekly</option>
              </select>
            </div>

            {isMonitoring && (
              <div className="space-y-2">
                <div className="text-xs text-green-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Monitoring {selectedInstitutions.length} institutions
                </div>
                {streamingInstitution && (
                  <div className="text-xs text-blue-400 flex items-center gap-2">
                    <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    Analyzing: {streamingInstitution}
                  </div>
                )}
                {nextCheckTime && !streamingInstitution && (
                  <div className="text-xs text-slate-400">
                    Next check: {nextCheckTime.toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}

            {lastMonitorTime && (
              <div className="text-xs text-slate-500 mt-2">
                Last check: {lastMonitorTime.toLocaleTimeString()}
              </div>
            )}

            {/* Interval info for longer periods */}
            {monitoringInterval >= 360 && (
              <div className="text-xs text-slate-500 mt-1">
                {monitoringInterval === 360 && "Every 6 hours"}
                {monitoringInterval === 720 && "Every 12 hours"}
                {monitoringInterval === 1440 && "Once daily"}
                {monitoringInterval === 10080 && "Once weekly"}
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
            <button
              onClick={() => setShowWebhookPanel(!showWebhookPanel)}
              className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                showWebhookPanel
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-700/50 text-orange-300 hover:bg-orange-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${webhookConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}></span>
              Webhooks {webhookEvents.length > 0 && `(${webhookEvents.length})`}
            </button>
          </div>
        </header>

        {/* Webhook Events Panel */}
        {showWebhookPanel && (
          <div className="bg-slate-800/80 border-b border-orange-700/50 p-4 max-h-[40vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${webhookConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                Real-time Webhook Events
                <span className="text-xs font-normal text-slate-400">
                  {webhookConnected ? 'Connected' : 'Disconnected'}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{webhookEvents.length} events</span>
                <button
                  onClick={() => setWebhookEvents([])}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowWebhookPanel(false)}
                  className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            {webhookEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-2xl mb-2">📡</div>
                <p className="text-sm">Waiting for real-time events...</p>
                <p className="text-xs mt-1">Events will appear here when X sends webhook notifications</p>
              </div>
            ) : (
              <div className="space-y-2">
                {webhookEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border ${
                      event.grok_analysis?.risk_level === 'HIGH'
                        ? 'bg-red-900/30 border-red-700'
                        : event.grok_analysis?.risk_level === 'MEDIUM'
                        ? 'bg-yellow-900/30 border-yellow-700'
                        : 'bg-slate-700/50 border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{event.institution}</span>
                        {event.grok_analysis && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            event.grok_analysis.risk_level === 'HIGH'
                              ? 'bg-red-600 text-white'
                              : event.grok_analysis.risk_level === 'MEDIUM'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-green-600 text-white'
                          }`}>
                            {event.grok_analysis.risk_level}
                          </span>
                        )}
                        {event.grok_analysis?.action_needed && (
                          <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded animate-pulse">
                            ACTION NEEDED
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(event.received_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 line-clamp-2">{event.tweet?.text}</p>

                    {event.grok_analysis?.summary && (
                      <p className="text-xs text-slate-400 mt-1 italic">
                        Grok: {event.grok_analysis.summary}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>🔄 {event.tweet?.public_metrics?.retweet_count || 0}</span>
                      <span>❤️ {event.tweet?.public_metrics?.like_count || 0}</span>
                      <span>💬 {event.tweet?.public_metrics?.reply_count || 0}</span>
                      {event.tweet?.id && (
                        <a
                          href={`https://x.com/i/status/${event.tweet.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 ml-auto"
                        >
                          View on X →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Interface - Results now appear inline in chat */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* Streaming Results Cards - Rendered above chat when available */}
          {streamingResults.length > 0 && (
            <div className="bg-slate-800/50 border-b border-slate-700 p-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Live Analysis Results ({streamingResults.length})
                </h3>
                <button
                  onClick={() => setStreamingResults([])}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-4">
                {streamingResults.map((result) => {
                  const analysis = result.analysis;
                  // Parse evidence tweets from sample_posts - handle URLs in parentheses or standalone
                  const evidenceTweets = analysis?.sample_posts?.slice(0, 3).map((post: string) => {
                    // Match X/Twitter URLs - handle parentheses, brackets, and various formats
                    const urlMatch = post.match(/https?:\/\/(?:x\.com|twitter\.com)\/(\w+)\/status\/(\d+)/);
                    const author = urlMatch ? `@${urlMatch[1]}` : 'Unknown';
                    // Remove all URLs from text for cleaner display
                    const text = post.replace(/https?:\/\/(?:x\.com|twitter\.com)\/\S+/g, '').replace(/[()[\]]/g, ' ').trim();
                    // Construct clean URL
                    const cleanUrl = urlMatch ? `https://x.com/${urlMatch[1]}/status/${urlMatch[2]}` : undefined;
                    return {
                      author,
                      text: text.slice(0, 200),
                      url: cleanUrl,
                      verified: post.includes('[verified]') || post.includes('✓') || post.includes('verified')
                    };
                  }) || [];

                  return (
                    <RiskAnalysisCard
                      key={result.id}
                      bankName={result.institution}
                      riskLevel={analysis?.risk_level || 'LOW'}
                      summary={analysis?.summary || 'No summary available'}
                      keyFindings={analysis?.key_findings}
                      confidence={analysis?.confidence}
                      viralScore={analysis?.viral_score}
                      trendVelocity={analysis?.trend_velocity}
                      evidenceTweets={evidenceTweets}
                      timestamp={result.timestamp}
                    />
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
