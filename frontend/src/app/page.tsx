"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction } from "@copilotkit/react-core";
import { useState, useEffect, useCallback, useRef } from "react";

// Institution categories with icons
const INSTITUTIONS = {
  "Traditional Banks": [
    "Elon Musk", "Chase", "Bank of America", "Wells Fargo", "Citibank", "Capital One", "US Bank", "PNC Bank"
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

// Live stream event type
interface LiveStreamEvent {
  id: string;
  type: 'tweet' | 'analysis' | 'spike' | 'alert' | 'error' | 'connected' | 'reconnecting';
  institution?: string;
  text?: string;
  author?: string;
  author_verified?: boolean;
  author_followers?: number;
  engagement?: {
    retweets: number;
    likes: number;
    replies: number;
  };
  risk_level?: string;
  risk_type?: string;
  urgency?: number;
  summary?: string;
  url?: string;
  timestamp: Date;
  matched_rules?: string[];
  alert_reason?: string;
  grok_analysis?: any;
}

// Streaming result type for chat history
interface StreamingResult {
  id: string;
  institution: string;
  analysis: any;
  timestamp: Date;
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

  // Live stream state
  const [liveStreamActive, setLiveStreamActive] = useState(false);
  const [liveStreamEvents, setLiveStreamEvents] = useState<LiveStreamEvent[]>([]);
  const [liveStreamStats, setLiveStreamStats] = useState<any>(null);
  const [liveStreamError, setLiveStreamError] = useState<string | null>(null);
  const liveStreamRef = useRef<EventSource | null>(null);
  const [showLivePanel, setShowLivePanel] = useState(true);

  // Analysis settings
  const [hoursBack, setHoursBack] = useState(24); // Time period for analysis
  const [analysisMode, setAnalysisMode] = useState<any>(null); // Current analysis mode info

  // Fetch API health on mount
  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then(res => res.json())
      .then(data => setApiHealth(data))
      .catch(() => setApiHealth({ status: "offline" }));
  }, []);

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

  // Sync stream rules with portfolio and start live stream
  const startLiveStream = useCallback(async () => {
    if (selectedInstitutions.length === 0) {
      setLiveStreamError("Please select at least one institution to monitor");
      return;
    }

    setLiveStreamError(null);
    setLiveStreamActive(true);
    // Clear previous events and stats when starting fresh
    setLiveStreamEvents([{
      id: `connecting-${Date.now()}`,
      type: 'reconnecting',
      timestamp: new Date(),
      summary: `Syncing rules for ${selectedInstitutions.length} institutions...`
    }]);
    setLiveStreamStats(null);

    try {
      // First sync rules with portfolio
      const syncResponse = await fetch("http://localhost:8000/monitor/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutions: selectedInstitutions })
      });

      if (!syncResponse.ok) {
        throw new Error("Failed to sync stream rules");
      }

      const syncData = await syncResponse.json();
      console.log("Synced stream rules:", syncData);

      // Check if there was an X API error (Filtered Stream requires Pro tier)
      if (syncData.setup_result?.result?.status === "error") {
        const errorMsg = syncData.setup_result.result.error || "Unknown error";
        if (errorMsg.includes("400") || errorMsg.includes("Bad Request")) {
          setLiveStreamEvents(prev => [...prev, {
            id: `error-${Date.now()}`,
            type: 'error',
            timestamp: new Date(),
            summary: "Filtered Stream API requires X API Pro tier ($5k/month). Using polling mode instead."
          }]);
          // Fall back to polling mode - use the continuous monitoring feature
          setLiveStreamActive(false);
          setIsMonitoring(true);
          return;
        }
        throw new Error(errorMsg);
      }

      // Add success event
      setLiveStreamEvents(prev => [...prev, {
        id: `synced-${Date.now()}`,
        type: 'connected',
        timestamp: new Date(),
        summary: `Rules synced! Monitoring: ${syncData.added?.join(", ") || selectedInstitutions.join(", ")}`
      }]);

      // Start SSE connection to live stream
      if (liveStreamRef.current) {
        liveStreamRef.current.close();
      }

      const eventSource = new EventSource("http://localhost:8000/monitor/stream");
      liveStreamRef.current = eventSource;

      eventSource.addEventListener("connected", (event) => {
        const data = JSON.parse(event.data);
        setLiveStreamActive(true);
        setLiveStreamEvents(prev => [...prev, {
          id: `connected-${Date.now()}`,
          type: 'connected',
          timestamp: new Date(),
          summary: `Connected! Monitoring ${data.institutions?.length || selectedInstitutions.length} institutions (${data.rules_count || 0} rules)`
        }]);
      });

      eventSource.addEventListener("heartbeat", (event) => {
        const data = JSON.parse(event.data);
        // Update stats to show we're still connected
        setLiveStreamStats(prev => ({
          ...prev,
          last_heartbeat: data.timestamp,
          status: data.status
        }));
      });

      eventSource.addEventListener("tweet", (event) => {
        const data = JSON.parse(event.data);
        const newEvent: LiveStreamEvent = {
          id: data.id || data.tweet_id || `tweet-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: 'tweet',
          institution: data.matched_rules?.[0]?.tag || data.institution,
          text: data.text,
          author: data.author?.username ? `@${data.author.username}` : 'Unknown',
          author_verified: data.author?.verified,
          author_followers: data.author?.followers_count,
          engagement: {
            retweets: data.metrics?.retweet_count || 0,
            likes: data.metrics?.like_count || 0,
            replies: data.metrics?.reply_count || 0
          },
          url: data.url,
          timestamp: new Date(data.created_at || Date.now()),
          matched_rules: data.matched_rules?.map((r: any) => r.tag)
        };
        setLiveStreamEvents(prev => [newEvent, ...prev].slice(0, 100)); // Keep last 100
      });

      eventSource.addEventListener("analysis", (event) => {
        const data = JSON.parse(event.data);
        const newEvent: LiveStreamEvent = {
          id: `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: 'analysis',
          institution: data.institution,
          risk_level: data.risk_level,
          risk_type: data.risk_type,
          urgency: data.urgency,
          summary: data.summary,
          text: data.tweet_text,
          timestamp: new Date()
        };
        setLiveStreamEvents(prev => [newEvent, ...prev].slice(0, 100));
      });

      eventSource.addEventListener("spike", (event) => {
        const data = JSON.parse(event.data);
        const newEvent: LiveStreamEvent = {
          id: `spike-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: 'spike',
          institution: data.institution,
          summary: `Volume spike detected! ${data.rate?.toFixed(1) || 0} tweets/min (threshold: ${data.threshold || 5})`,
          timestamp: new Date()
        };
        setLiveStreamEvents(prev => [newEvent, ...prev].slice(0, 100));
      });

      eventSource.addEventListener("alert", (event) => {
        const data = JSON.parse(event.data);
        const newEvent: LiveStreamEvent = {
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: 'alert',
          institution: data.institution || data.event?.institution,
          alert_reason: data.alert_reason,
          summary: data.message,
          text: data.event?.text,
          author: data.event?.author?.username ? `@${data.event.author.username}` : undefined,
          url: data.event?.url,
          grok_analysis: data.grok_analysis,
          timestamp: new Date(data.timestamp)
        };
        setLiveStreamEvents(prev => [newEvent, ...prev].slice(0, 100));
      });

      eventSource.addEventListener("stats", (event) => {
        const data = JSON.parse(event.data);
        setLiveStreamStats(data);
      });

      eventSource.addEventListener("error", (event) => {
        const data = event.data ? JSON.parse((event as any).data) : { message: "Stream error" };
        setLiveStreamError(data.message);
      });

      eventSource.addEventListener("reconnecting", () => {
        setLiveStreamEvents(prev => [...prev, {
          id: `reconnect-${Date.now()}`,
          type: 'reconnecting',
          timestamp: new Date(),
          summary: "Reconnecting to stream..."
        }]);
      });

      eventSource.onerror = (error) => {
        console.error("LiveStream SSE error:", error);
        setLiveStreamError("Connection lost - attempting to reconnect");
      };

    } catch (error) {
      console.error("Live stream error:", error);
      setLiveStreamError(`Failed to start live stream: ${error}`);
      setLiveStreamEvents(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'error',
        timestamp: new Date(),
        summary: `Error: ${error}`
      }]);
      setLiveStreamActive(false);
    }
  }, [selectedInstitutions]);

  // Stop live stream
  const stopLiveStream = useCallback(() => {
    if (liveStreamRef.current) {
      liveStreamRef.current.close();
      liveStreamRef.current = null;
    }
    setLiveStreamActive(false);
    // Clear events and reset stats when stopping
    setLiveStreamEvents([]);
    setLiveStreamStats(null);
    setLiveStreamError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveStreamRef.current) {
        liveStreamRef.current.close();
      }
    };
  }, []);

  // Fetch live stream stats periodically
  useEffect(() => {
    if (!liveStreamActive) return;

    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:8000/monitor/stats");
        if (response.ok) {
          const data = await response.json();
          setLiveStreamStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stream stats:", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [liveStreamActive]);

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

          {/* Live Stream Status */}
          {liveStreamActive && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                <span className="text-sm font-medium text-white">Live Stream Active</span>
              </div>
              {liveStreamStats && (
                <div className="grid grid-cols-2 gap-2 text-xs text-emerald-300 mt-2">
                  <div>Tweets: {liveStreamStats.stats?.tweets_processed || 0}</div>
                  <div>Analyzed: {liveStreamStats.stats?.analyses_performed || 0}</div>
                  <div>Spikes: {liveStreamStats.stats?.spikes_detected || 0}</div>
                  <div>Rules: {liveStreamStats.stats?.active_rules || 0}</div>
                </div>
              )}
              {liveStreamError && (
                <div className="text-xs text-red-400 mt-2">{liveStreamError}</div>
              )}
            </div>
          )}

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

          {/* Analysis Settings */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-white mb-3">Analysis Settings</h3>

            {/* Time Period Selector */}
            <div className="mb-3">
              <label className="text-sm text-slate-400 block mb-1">Look back</label>
              <select
                value={hoursBack}
                onChange={(e) => setHoursBack(Number(e.target.value))}
                className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2 border border-slate-600"
              >
                <option value={1}>Last 1 hour</option>
                <option value={6}>Last 6 hours</option>
                <option value={12}>Last 12 hours</option>
                <option value={24}>Last 24 hours (default)</option>
                <option value={48}>Last 2 days</option>
                <option value={72}>Last 3 days</option>
                <option value={168}>Last 7 days (max)</option>
              </select>
            </div>

            {/* Analysis Mode Indicator */}
            {selectedInstitutions.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`http://localhost:8000/analyze/mode/${selectedInstitutions[0]}`);
                      const data = await res.json();
                      setAnalysisMode(data);
                    } catch (e) {
                      console.error('Failed to fetch mode:', e);
                    }
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 px-3 rounded transition-colors text-left"
                >
                  Check Analysis Mode
                </button>

                {analysisMode && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    analysisMode.mode === 'stateful'
                      ? 'bg-green-900/30 border border-green-700/50'
                      : 'bg-blue-900/30 border border-blue-700/50'
                  }`}>
                    <div className="font-medium text-white mb-1">
                      Mode: {analysisMode.mode === 'stateful' ? '✓ Stateful (Responses API)' : '○ Direct (X API)'}
                    </div>
                    {analysisMode.session_active && (
                      <div className="text-green-300 text-[10px]">
                        Session Active • Delta updates available
                      </div>
                    )}
                    {!analysisMode.session_active && analysisMode.mode === 'stateful' && (
                      <div className="text-yellow-300 text-[10px]">
                        No session yet • Run analysis to start
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {selectedInstitutions.length > 0 && (
            <div className="mt-4 space-y-2">
              {/* Live Stream Button - Primary Action */}
              <button
                onClick={() => liveStreamActive ? stopLiveStream() : startLiveStream()}
                className={`w-full ${liveStreamActive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-sm py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium`}
              >
                {liveStreamActive ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Stop Live Stream
                  </>
                ) : (
                  <>
                    <span className="w-3 h-3 rounded-full bg-white animate-pulse"></span>
                    Start Live Stream
                  </>
                )}
              </button>

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
                    Analyzing...
                  </>
                ) : (
                  <>
                    Quick Analysis
                  </>
                )}
              </button>

              {/* Continue Analysis - Delta Updates */}
              {analysisMode?.session_active && (
                <button
                  onClick={async () => {
                    if (selectedInstitutions.length === 0 || isStreaming) return;

                    setIsStreaming(true);
                    setStreamingInstitution(selectedInstitutions[0]);
                    setStreamStatus('Fetching delta updates...');

                    try {
                      const res = await fetch('http://localhost:8000/analyze/continue', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          institution: selectedInstitutions[0],
                          follow_up: `Any new developments in the last ${hoursBack} hours?`
                        })
                      });

                      const data = await res.json();
                      setStreamStatus('Delta analysis complete');

                      // Add result to streaming results
                      setStreamingResults(prev => [
                        ...prev,
                        {
                          id: `delta-${Date.now()}`,
                          institution: selectedInstitutions[0],
                          analysis: data.analysis,
                          timestamp: new Date()
                        }
                      ]);
                    } catch (error) {
                      setStreamStatus(`Error: ${error}`);
                    } finally {
                      setIsStreaming(false);
                      setStreamingInstitution(null);
                    }
                  }}
                  disabled={isStreaming}
                  className={`w-full ${isStreaming ? 'bg-slate-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
                >
                  {isStreaming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Getting updates...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Continue Analysis (Delta)
                    </>
                  )}
                </button>
              )}

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
                  setLiveStreamEvents([]);
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
            <span className={`text-xs px-2 py-1 rounded ${liveStreamActive ? 'bg-emerald-600 text-white animate-pulse' : 'bg-emerald-700 text-white'}`}>
              Filtered Stream {liveStreamActive && '●'}
            </span>
            <span className="text-xs bg-purple-700 text-white px-2 py-1 rounded">Viral Scoring</span>
            <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded">SSE Streaming</span>
            <span className="text-xs bg-green-700 text-white px-2 py-1 rounded">Circuit Breaker</span>
          </div>
        </header>

        {/* Chat Interface - Results now appear inline in chat */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* Live Stream Panel - Real-time filtered stream events */}
          {(liveStreamActive || liveStreamEvents.length > 0) && showLivePanel && (
            <div className="bg-slate-900/80 border-b border-emerald-700/50 max-h-[45vh] flex flex-col">
              {/* Panel Header */}
              <div className="flex items-center justify-between p-3 bg-emerald-900/30 border-b border-emerald-700/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {liveStreamActive ? (
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-slate-500"></span>
                    )}
                    <h3 className="text-sm font-semibold text-white">
                      Live Stream {liveStreamActive ? '(Active)' : '(Stopped)'}
                    </h3>
                  </div>
                  {liveStreamStats && (
                    <div className="flex gap-3 text-xs text-emerald-300">
                      <span>{liveStreamStats.stats?.tweets_processed || 0} tweets</span>
                      <span>{liveStreamStats.stats?.analyses_performed || 0} analyzed</span>
                      {(liveStreamStats.stats?.spikes_detected || 0) > 0 && (
                        <span className="text-yellow-400">{liveStreamStats.stats?.spikes_detected} spikes</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLiveStreamEvents([])}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowLivePanel(false)}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Live Events Feed */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {liveStreamEvents.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-sm">Waiting for live tweets...</p>
                    <p className="text-xs mt-1">Tweets matching your portfolio will appear here</p>
                  </div>
                ) : (
                  liveStreamEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`rounded-lg p-3 text-sm ${
                        event.type === 'connected' ? 'bg-emerald-900/40 border border-emerald-700/50' :
                        event.type === 'reconnecting' ? 'bg-yellow-900/40 border border-yellow-700/50' :
                        event.type === 'error' ? 'bg-red-900/40 border border-red-700/50' :
                        event.type === 'spike' ? 'bg-orange-900/40 border border-orange-700/50' :
                        event.type === 'alert' ? (
                          event.alert_reason === 'high_urgency'
                            ? 'bg-red-900/60 border-2 border-red-600/70 shadow-lg shadow-red-900/50'
                            : 'bg-yellow-900/60 border-2 border-yellow-600/70 shadow-lg shadow-yellow-900/50'
                        ) :
                        event.type === 'analysis' ? (
                          event.risk_level === 'HIGH' ? 'bg-red-900/40 border border-red-700/50' :
                          event.risk_level === 'MEDIUM' ? 'bg-yellow-900/40 border border-yellow-700/50' :
                          'bg-green-900/40 border border-green-700/50'
                        ) :
                        'bg-slate-800/60 border border-slate-700/50'
                      }`}
                    >
                      {/* Event Header */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {event.type === 'tweet' && (
                            <>
                              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                              </svg>
                              <span className="font-medium text-slate-200">
                                {event.author}
                                {event.author_verified && <span className="ml-1 text-blue-400">✓</span>}
                              </span>
                              {event.institution && (
                                <span className="text-xs px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 rounded">
                                  {event.institution}
                                </span>
                              )}
                            </>
                          )}
                          {event.type === 'analysis' && (
                            <>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                event.risk_level === 'HIGH' ? 'bg-red-600 text-white' :
                                event.risk_level === 'MEDIUM' ? 'bg-yellow-600 text-white' :
                                'bg-green-600 text-white'
                              }`}>
                                {event.risk_level} RISK
                              </span>
                              <span className="text-slate-300">{event.institution}</span>
                              {event.risk_type && (
                                <span className="text-xs text-slate-400">({event.risk_type})</span>
                              )}
                            </>
                          )}
                          {event.type === 'spike' && (
                            <>
                              <span className="px-2 py-0.5 bg-orange-600 text-white rounded text-xs font-medium">SPIKE</span>
                              <span className="text-orange-300">{event.institution}</span>
                            </>
                          )}
                          {event.type === 'alert' && (
                            <>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                event.alert_reason === 'high_urgency'
                                  ? 'bg-red-600 text-white animate-pulse'
                                  : 'bg-yellow-600 text-white'
                              }`}>
                                🚨 {event.alert_reason === 'high_urgency' ? 'HIGH URGENCY' : 'HIGH ENGAGEMENT'}
                              </span>
                              <span className="text-yellow-300">{event.institution}</span>
                              {event.author && (
                                <span className="text-xs text-slate-400">by {event.author}</span>
                              )}
                            </>
                          )}
                          {(event.type === 'connected' || event.type === 'reconnecting' || event.type === 'error') && (
                            <span className={`text-xs ${
                              event.type === 'connected' ? 'text-emerald-400' :
                              event.type === 'reconnecting' ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {event.summary}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Tweet Text */}
                      {event.text && (
                        <p className="text-slate-300 text-sm mb-2 line-clamp-2">{event.text}</p>
                      )}

                      {/* Summary for analysis */}
                      {event.type === 'analysis' && event.summary && (
                        <p className="text-slate-300 text-sm mb-2">{event.summary}</p>
                      )}

                      {/* Grok Analysis for Alerts */}
                      {event.type === 'alert' && event.grok_analysis && (
                        <div className="mt-2 p-2 rounded bg-slate-700/50 border border-yellow-600/30">
                          <div className="text-xs font-medium text-yellow-400 mb-1">🤖 Grok Analysis</div>
                          {event.grok_analysis.risk_level && (
                            <div className="mb-1">
                              <span className={`text-xs font-medium ${
                                event.grok_analysis.risk_level === 'HIGH' ? 'text-red-400' :
                                event.grok_analysis.risk_level === 'MEDIUM' ? 'text-yellow-400' :
                                'text-green-400'
                              }`}>
                                Risk: {event.grok_analysis.risk_level}
                              </span>
                            </div>
                          )}
                          {event.grok_analysis.summary && (
                            <p className="text-slate-300 text-xs leading-relaxed">{event.grok_analysis.summary}</p>
                          )}
                          {event.grok_analysis.key_findings && event.grok_analysis.key_findings.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {event.grok_analysis.key_findings.slice(0, 2).map((finding: string, idx: number) => (
                                <li key={idx} className="text-xs text-slate-400">• {finding}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Engagement & Actions */}
                      {event.type === 'tweet' && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 text-slate-500">
                            {event.engagement && (
                              <>
                                <span>↻ {event.engagement.retweets}</span>
                                <span>♥ {event.engagement.likes}</span>
                                <span>💬 {event.engagement.replies}</span>
                              </>
                            )}
                            {event.author_followers && (
                              <span className="text-slate-600">{event.author_followers.toLocaleString()} followers</span>
                            )}
                          </div>
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              View on X
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Collapsed Live Panel Toggle */}
          {!showLivePanel && (liveStreamActive || liveStreamEvents.length > 0) && (
            <button
              onClick={() => setShowLivePanel(true)}
              className="bg-emerald-900/50 border-b border-emerald-700/50 px-4 py-2 flex items-center justify-center gap-2 hover:bg-emerald-900/70 transition-colors"
            >
              {liveStreamActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
              <span className="text-sm text-emerald-300">
                Show Live Stream ({liveStreamEvents.length} events)
              </span>
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

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
