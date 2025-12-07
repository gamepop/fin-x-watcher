"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction } from "@copilotkit/react-core";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import EnhancedRiskCard from "@/components/risk/EnhancedRiskCard";
import ToastContainer from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { RiskCardSkeleton } from "@/components/ui/Skeleton";
import TrendChart from "@/components/charts/TrendChart";
import ViralScoreChart from "@/components/charts/ViralScoreChart";
import ComparisonView from "@/components/charts/ComparisonView";
import TimeRangeSelector, { TimeRange } from "@/components/ui/TimeRangeSelector";
import AnalysisHistory from "@/components/history/AnalysisHistory";
import AlertCenter from "@/components/alerts/AlertCenter";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { exportToCSV, exportToPDF, ExportData } from "@/utils/export";
import SidePanel from "@/components/ui/SidePanel";
import AnalysisResultsView from "@/components/results/AnalysisResultsView";
import LiveStreamFeed from "@/components/stream/LiveStreamFeed";

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
  type: 'tweet' | 'analysis' | 'spike' | 'error' | 'connected' | 'reconnecting';
  institution?: string;
  text?: string;
  author?: string;
  author_name?: string;
  author_verified?: boolean;
  author_followers?: number;
  tweet_id?: string;
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
}

// Streaming result type for chat history
interface StreamingResult {
  id: string;
  institution: string;
  analysis: any;
  timestamp?: Date;
}

// Keep old RiskAnalysisCard for CopilotKit render (lightweight version)
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
  const riskColors: Record<string, { bg: string; border: string; text: string; badge: string; glow: string; pulse: string }> = {
    HIGH: { bg: "bg-red-950/40", border: "border-red-500/50", text: "text-red-100", badge: "bg-red-500", glow: "shadow-red-500/30", pulse: "animate-pulse" },
    MEDIUM: { bg: "bg-amber-950/40", border: "border-amber-500/50", text: "text-amber-100", badge: "bg-amber-500", glow: "shadow-amber-500/20", pulse: "" },
    LOW: { bg: "bg-emerald-950/40", border: "border-emerald-500/50", text: "text-emerald-100", badge: "bg-emerald-500", glow: "shadow-emerald-500/10", pulse: "" },
  };
  const colors = riskColors[riskLevel] || riskColors.LOW;

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} backdrop-blur-sm p-5 my-4 shadow-xl ${colors.glow} ${riskLevel === 'HIGH' ? colors.pulse : ''} !bg-opacity-100`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {isStreaming && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2.5 h-2.5 rounded-full bg-blue-400"
            />
          )}
          <h3 className="text-lg font-bold text-white">{bankName}</h3>
        </div>
        <div className="flex items-center gap-2">
          {viralScore !== undefined && (
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full border border-purple-500/30 font-semibold">
              Viral: {viralScore}/100
            </span>
          )}
          <span className={`${colors.badge} text-white text-xs font-bold px-3 py-1.5 rounded-full ${riskLevel === 'HIGH' ? 'animate-pulse' : ''} shadow-lg`}>
            {riskLevel}
          </span>
        </div>
      </div>
      <p className={`${colors.text} text-sm mb-4 font-medium leading-relaxed`}>{summary}</p>
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {tweetCount !== undefined && tweetCount > 0 && (
          <div className="bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600/50">
            <span className="text-slate-400">Tweets:</span>{" "}
            <span className="font-semibold text-white">{tweetCount}</span>
          </div>
        )}
        {trendVelocity !== undefined && (
          <div className="bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600/50">
            <span className="text-slate-400">Trend:</span>{" "}
            <span className={`font-semibold ${trendVelocity > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {trendVelocity > 0 ? '+' : ''}{trendVelocity?.toFixed(1)}%
            </span>
          </div>
        )}
        {confidence !== undefined && (
          <div className="bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600/50">
            <span className="text-slate-400">Confidence:</span>{" "}
            <span className="font-semibold text-white">{(confidence * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>
      {keyFindings && keyFindings.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2 tracking-wide">Key Findings</h4>
          <ul className="text-sm text-slate-200 space-y-2">
            {keyFindings.slice(0, 4).map((finding: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span className="leading-relaxed">{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {evidenceTweets && evidenceTweets.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2 tracking-wide">Evidence from X</h4>
          <div className="space-y-2">
            {evidenceTweets.slice(0, 2).map((tweet: any, idx: number) => (
              <div key={idx} className="bg-slate-700/50 rounded-lg p-3 text-xs border border-slate-600/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-white">
                    {tweet.author}
                    {tweet.verified && <span className="ml-1 text-blue-400">✓</span>}
                  </span>
                  {tweet.engagement && <span className="text-slate-400 text-xs">{tweet.engagement}</span>}
                </div>
                <p className="text-slate-300 line-clamp-2 leading-relaxed">{tweet.text}</p>
                {tweet.url && (
                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline mt-1.5 inline-block text-xs font-medium"
                  >
                    View on X →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs text-slate-400 pt-3 border-t border-slate-700/50 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          Source: X API v2 + Grok Live Search
        </span>
        <span className="flex items-center gap-1.5">
          {isStreaming ? (
            <>
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-blue-400"
              />
              <span className="text-blue-400">Streaming</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              <span className="text-green-400">{timestamp ? timestamp.toLocaleTimeString() : 'Live data'}</span>
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

  // API health status
  const [apiHealth, setApiHealth] = useState<any>(null);

  // Live stream state
  const [liveStreamActive, setLiveStreamActive] = useState(false);
  const [liveStreamEvents, setLiveStreamEvents] = useState<LiveStreamEvent[]>([]);
  const [liveStreamStats, setLiveStreamStats] = useState<any>(null);
  const [liveStreamError, setLiveStreamError] = useState<string | null>(null);
  const liveStreamRef = useRef<EventSource | null>(null);
  const [showLivePanel, setShowLivePanel] = useState(true);
  const [usePolling, setUsePolling] = useState(true); // toggle between polling and filtered stream
  const pollingInFlightRef = useRef<boolean>(false);

  // Toast notifications
  const toast = useToast();

  // Time range for charts
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  // Analysis settings
  const [hoursBack, setHoursBack] = useState(24); // Lookback window for analysis
  const [analysisMode, setAnalysisMode] = useState<any>(null); // Mode info from backend

  // Phase 3: Enhanced Sidebar state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "risk" | "viralScore">("name");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Phase 3: Settings & Alerts state
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertFilter, setAlertFilter] = useState<"HIGH" | "MEDIUM" | "ALL">("ALL");
  
  // Side panel state
  const [showSidePanel, setShowSidePanel] = useState(false);
  const chatRef = useRef<any>(null);
  const sidePanelContentRef = useRef<HTMLDivElement | null>(null);

  // Calculate dashboard stats
  const dashboardStats = useMemo(() => {
    const allResults = Object.values(liveResults);
    const riskDistribution = {
      HIGH: allResults.filter((r: any) => r?.risk_level === "HIGH").length,
      MEDIUM: allResults.filter((r: any) => r?.risk_level === "MEDIUM").length,
      LOW: allResults.filter((r: any) => r?.risk_level === "LOW").length,
    };
    const activeAlerts = riskDistribution.HIGH + riskDistribution.MEDIUM;
    const totalTweets = allResults.reduce((sum: number, r: any) => sum + (r?.tweet_count || 0), 0);
    const avgViralScore =
      allResults.length > 0
        ? allResults.reduce((sum: number, r: any) => sum + (r?.viral_score || 0), 0) /
          allResults.length
        : 0;

    return {
      totalInstitutions: selectedInstitutions.length,
      activeAlerts,
      riskDistribution,
      totalTweetsToday: totalTweets,
      avgViralScore,
      lastAnalysisTime: lastMonitorTime || undefined,
    };
  }, [liveResults, selectedInstitutions.length, lastMonitorTime]);

  // Generate trend chart data
  // NOTE: Volume data is simulated based on current tweet counts
  // Real historical volume data would require calling /trends/{institution} API endpoint
  const trendChartData = useMemo(() => {
    const allResults = Object.values(liveResults);
    if (allResults.length === 0) return [];

    // Get average tweet count and viral score from current results
    const avgTweetCount = allResults.length > 0
      ? Math.round(allResults.reduce((sum: number, r: any) => sum + (r?.tweet_count || 0), 0) / allResults.length)
      : 0;
    const avgViralScore = allResults.length > 0
      ? allResults.reduce((sum: number, r: any) => sum + (r?.viral_score || 0), 0) / allResults.length
      : 0;

    // Generate time series data based on time range
    const hours = timeRange === "1h" ? 1 : timeRange === "6h" ? 6 : timeRange === "24h" ? 24 : 168;
    const dataPoints = Math.max(2, Math.min(hours, 12)); // ensure at least 2 to avoid division by zero
    const interval = hours / (dataPoints - 1); // spread across range

    // Use current tweet count as baseline, with some variation to show trend
    // This simulates historical data - for real data, call /trends/{institution} endpoint
    return Array.from({ length: dataPoints }, (_, i) => {
      const timeValue = hours - (i * interval);
      const timeLabel =
        timeRange === "7d"
          ? `${Math.floor(timeValue / 24)}d`
          : `${Math.floor(timeValue)}h`;
      
      // Simulate volume trend: start lower, build up to current count
      // This is simulated - real data would come from API
      const progress = i / (dataPoints - 1); // 0 to 1
      const volume = Math.round(avgTweetCount * (0.6 + 0.4 * progress) + (Math.random() * 20 - 10));
      
      return {
        time: timeLabel,
        volume: Math.max(0, volume), // Ensure non-negative
        viralScore: avgViralScore,
      };
    }).reverse();
  }, [liveResults, timeRange]);

  // Generate viral score chart data
  // ✅ REAL DATA: Uses actual viral scores and risk levels from analysis results
  const viralScoreChartData = useMemo(() => {
    return Object.entries(liveResults).map(([institution, analysis]: [string, any]) => ({
      institution,
      viralScore: analysis?.viral_score || 0,
      riskLevel: analysis?.risk_level || "LOW",
    }));
  }, [liveResults]);

  // Generate comparison view data
  // ✅ REAL DATA: Uses actual analysis results (risk level, viral score, trend velocity, tweet count)
  const comparisonData = useMemo(() => {
    return Object.entries(liveResults).map(([institution, analysis]: [string, any]) => ({
      institution,
      riskLevel: analysis?.risk_level || "LOW",
      viralScore: analysis?.viral_score || 0,
      trendVelocity: analysis?.trend_velocity || 0,
      tweetCount: analysis?.tweet_count || 0,
    }));
  }, [liveResults]);

  // Phase 3: Generate analysis history from streaming results
  const analysisHistory = useMemo(() => {
    return streamingResults
      .filter((result) => result.timestamp) // Filter out entries without timestamps
      .map((result) => ({
        institution: result.institution,
        timestamp: result.timestamp!, // Non-null assertion after filter
        riskLevel: result.analysis?.risk_level || "LOW",
        viralScore: result.analysis?.viral_score || 0,
        tweetCount: result.analysis?.tweet_count || 0,
        summary: result.analysis?.summary || "",
        keyFindings: result.analysis?.key_findings || [],
      }));
  }, [streamingResults]);

  // Phase 3: Generate alerts from analysis results
  const alerts = useMemo(() => {
    const alertList: Array<{
      id: string;
      institution: string;
      riskLevel: "HIGH" | "MEDIUM";
      message: string;
      timestamp: Date;
      read: boolean;
      details?: {
        viralScore: number;
        tweetCount: number;
        keyFindings: string[];
      };
    }> = [];

    Object.entries(liveResults).forEach(([institution, analysis]: [string, any]) => {
      if (analysis?.risk_level === "HIGH" || analysis?.risk_level === "MEDIUM") {
        alertList.push({
          id: `${institution}-${analysis.last_updated || analysis.timestamp || institution}`,
          institution,
          riskLevel: analysis.risk_level,
          message: analysis.summary || `${analysis.risk_level} risk detected for ${institution}`,
          timestamp: analysis.last_updated
            ? new Date(analysis.last_updated)
            : analysis.timestamp
              ? new Date(analysis.timestamp)
              : new Date(),
          read: false,
          details: {
            viralScore: analysis.viral_score || 0,
            tweetCount: analysis.tweet_count || 0,
            keyFindings: analysis.key_findings || [],
          },
        });
      }
    });

    return alertList;
  }, [liveResults]);

  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const activeAlerts = useMemo(() => {
    return alerts
      .filter((alert) => !dismissedAlerts.has(alert.id))
      .map((alert) => ({
        ...alert,
        read: readAlerts.has(alert.id),
      }));
  }, [alerts, readAlerts, dismissedAlerts]);

  // Phase 3: Export handlers
  const handleExport = (format: "csv" | "pdf") => {
    const exportData: ExportData[] = analysisHistory
      .filter((entry) => entry.timestamp) // Filter out entries without timestamps
      .map((entry) => ({
        institution: entry.institution,
        timestamp: entry.timestamp!.toISOString(), // Non-null assertion after filter
        riskLevel: entry.riskLevel,
        viralScore: entry.viralScore,
        tweetCount: entry.tweetCount,
        summary: entry.summary,
        keyFindings: entry.keyFindings,
    }));

    if (format === "csv") {
      exportToCSV(exportData);
    } else {
      exportToPDF(exportData);
    }
  };

  // Fetch API health on mount
  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then(res => res.json())
      .then(data => setApiHealth(data))
      .catch(() => setApiHealth({ status: "offline" }));
  }, []);

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

        // Toast notification based on risk level
        if (data.risk_level === "HIGH") {
          toast.error(`HIGH risk detected for ${institution}!`);
        } else if (data.risk_level === "MEDIUM") {
          toast.info(`MEDIUM risk detected for ${institution}`);
        } else {
          toast.success(`Analysis complete for ${institution} - LOW risk`);
        }
      });

      eventSource.addEventListener("done", () => {
        eventSource.close();
        setIsStreaming(false);
        setStreamingInstitution(null);
        setLastMonitorTime(new Date());
        toast.success(`Analysis complete for ${institution}`);
      });

      eventSource.addEventListener("error", (event: any) => {
        const data = event.data ? JSON.parse(event.data) : { message: "Connection error" };
        setStreamStatus(`Error: ${data.message}`);
        eventSource.close();
        setIsStreaming(false);
        toast.error(`Analysis failed for ${institution}: ${data.message}`);
      });

      eventSource.onerror = () => {
        eventSource.close();
        setIsStreaming(false);
        setStreamStatus("Connection lost");
        toast.error(`Connection lost for ${institution}`);
      };

    } catch (error) {
      setIsStreaming(false);
      setStreamStatus(`Failed to connect: ${error}`);
      toast.error(`Failed to connect: ${error}`);
    }
  }, [toast]);

  // Polling fallback (search_recent) when monitoring mode is on
  const pollTweets = useCallback(
    async function pollTweetsCallback() {
      if (pollingInFlightRef.current) return;
      if (selectedInstitutions.length === 0) return;
      pollingInFlightRef.current = true;
      try {
        const response = await fetch("http://localhost:8000/monitor/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institutions: selectedInstitutions,
            max_results: 20,
          }),
        });
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const tweets = data.tweets || [];
        setLastMonitorTime(new Date());
        setLiveStreamEvents((prev) => {
          const existing = new Set(prev.map((e) => e.id));
          const mapped: LiveStreamEvent[] = tweets
            .filter((t: any) => t.id && !existing.has(t.id))
            .map((t: any) => {
              const authorObj = typeof t.author === "object" && t.author !== null ? t.author : undefined;
              const handle =
                typeof t.author === "string"
                  ? t.author
                  : authorObj?.username
                    ? `@${authorObj.username}`
                    : authorObj?.handle
                      ? authorObj.handle
                      : "";
              const name =
                typeof t.author_name === "string"
                  ? t.author_name
                  : authorObj?.name || authorObj?.username || "";
              const verified =
                typeof t.author_verified === "boolean"
                  ? t.author_verified
                  : Boolean(authorObj?.verified || authorObj?.verified_type);
              const followers =
                typeof t.author_followers === "number"
                  ? t.author_followers
                  : typeof authorObj?.followers === "number"
                    ? authorObj.followers
                    : 0;
              return {
                id: t.id,
                type: "tweet",
                institution: t.institution,
                text: t.text,
                author: handle || name || "",
                author_name: name || handle || "",
                author_verified: verified,
                author_followers: followers,
                tweet_id: t.id,
                engagement: t.engagement || { retweets: 0, likes: 0, replies: 0 },
                url: t.url,
                timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
                matched_rules: t.institution ? [t.institution] : [],
              };
            });
          // Update liveResults coverage for institutions we saw tweets for
          if (mapped.length > 0) {
            const now = new Date();
            setLiveResults((prevResults) => {
              const next = { ...prevResults };
              mapped.forEach((m) => {
                if (!m.institution) return;
                const existing = next[m.institution] || {};
                next[m.institution] = {
                  ...existing, // preserve prior analysis fields (viral_score, tweet_count, etc.)
                  risk_level: existing.risk_level || "LOW",
                  summary: existing.summary || "Recent tweet activity detected.",
                  last_updated: now,
                };
              });
              return next;
            });
          }
          return [...mapped, ...prev].slice(0, 100);
        });
      } catch (error: any) {
        console.error("Polling error:", error);
        setLiveStreamError(error?.message || "Polling error");
      } finally {
        pollingInFlightRef.current = false;
      }
    },
    [selectedInstitutions]
  );

  // Sync stream rules with portfolio and start live stream (prefer filtered stream; fallback to polling)
  const startLiveStream = useCallback(async () => {
    if (selectedInstitutions.length === 0) {
      setLiveStreamError("Please select at least one institution to monitor");
      return;
    }

    setLiveStreamError(null);
    setLiveStreamActive(true);
    setShowLivePanel(true);
    // Do NOT toggle scheduled monitoring here; live stream should be independent

    // Attempt filtered stream (SSE). If it fails, fall back to polling.
    try {
      await fetch("http://localhost:8000/monitor/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutions: selectedInstitutions }),
      });

      setUsePolling(false);
      const es = new EventSource("http://localhost:8000/monitor/stream");
      liveStreamRef.current = es;

      es.addEventListener("connected", () => {
        setLiveStreamEvents(prev => [{
          id: `connected-${Date.now()}`,
          type: 'connected',
          timestamp: new Date(),
          summary: "Connected to filtered stream"
        } as LiveStreamEvent, ...prev].slice(0, 200));
      });

      es.addEventListener("tweet", (event: any) => {
        try {
          const data = JSON.parse(event.data);
          const authorObj = typeof data.author === "object" && data.author !== null ? data.author : undefined;
          const handle =
            typeof data.author === "string"
              ? data.author
              : authorObj?.username
                ? `@${authorObj.username}`
                : authorObj?.handle
                  ? authorObj.handle
                  : "";
          const name =
            typeof data.author_name === "string"
              ? data.author_name
              : authorObj?.name || authorObj?.username || "";
          const verified =
            typeof data.author_verified === "boolean"
              ? data.author_verified
              : Boolean(authorObj?.verified || authorObj?.verified_type);
          const followers =
            typeof data.author_followers === "number"
              ? data.author_followers
              : typeof authorObj?.followers === "number"
                ? authorObj.followers
                : 0;
          const item: LiveStreamEvent = {
            id: data.id || `tweet-${Date.now()}`,
            type: 'tweet',
            institution: data.institution,
            text: data.text,
            author: handle || name || "",
            author_name: name || handle || "",
            author_verified: verified,
            author_followers: followers,
            engagement: data.engagement || { retweets: 0, likes: 0, replies: 0 },
            tweet_id: data.id,
            url: data.url,
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
            matched_rules: data.matched_rules || [],
          };
          setLiveStreamEvents(prev => [item, ...prev].slice(0, 200));
        } catch (e) {
          console.error("Failed to parse tweet event", e);
        }
      });

      es.addEventListener("alert", (event: any) => {
        try {
          const data = JSON.parse(event.data);
          const item: LiveStreamEvent = {
            id: data.id || `alert-${Date.now()}`,
            type: 'analysis', // reuse analysis type for alerts to fit union
            institution: data.institution,
            summary: data.summary,
            risk_level: data.risk_level,
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          };
          setLiveStreamEvents(prev => [item, ...prev].slice(0, 200));
        } catch (e) {
          console.error("Failed to parse alert event", e);
        }
      });

      es.addEventListener("heartbeat", () => {
        setLiveStreamStats((prev: any) => ({
          ...(prev || {}),
          last_heartbeat: new Date(),
        }));
      });

      es.addEventListener("error", (event: any) => {
        const data = event?.data ? JSON.parse(event.data) : { error: "Stream error" };
        setLiveStreamError(data.error || "Stream error");
      });

      es.onerror = () => {
        setLiveStreamError("Stream connection lost. Attempting to continue without polling.");
        setLiveStreamActive(true);
        setLiveStreamEvents((prev: LiveStreamEvent[]) => [{
          id: `stream-error-${Date.now()}`,
          type: 'error',
          timestamp: new Date(),
          summary: "Stream error encountered; staying on stream (no polling fallback)."
        } as LiveStreamEvent, ...prev].slice(0, 200));
      };
    } catch (e) {
      setUsePolling(false);
      setLiveStreamError(`Stream failed to start: ${e}`);
      setLiveStreamEvents(prev => [
        {
          id: `stream-start-error-${Date.now()}`,
          type: 'error',
          timestamp: new Date(),
          summary: "Stream failed to start; not falling back to polling."
        } as LiveStreamEvent,
        ...prev
      ].slice(0, 100));
    }
  }, [selectedInstitutions, pollTweets]);

  // Stop live stream
  const stopLiveStream = useCallback(() => {
    if (liveStreamRef.current) {
      liveStreamRef.current.close();
      liveStreamRef.current = null;
    }
    setLiveStreamActive(false);
    setIsMonitoring(false);
    setUsePolling(false);
    setLiveStreamEvents((prev: LiveStreamEvent[]) => [...prev, {
      id: `disconnected-${Date.now()}`,
      type: 'error',
      timestamp: new Date(),
      summary: "Stream disconnected"
    } as LiveStreamEvent]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveStreamRef.current) {
        liveStreamRef.current.close();
      }
    };
  }, []);

  // Polling interval when monitoring is enabled (fallback mode)
  useEffect(() => {
    if (!isMonitoring || !usePolling) return;
    pollTweets();
    const interval = setInterval(pollTweets, Math.max(monitoringInterval, 1) * 60 * 1000);
    return () => clearInterval(interval);
  }, [isMonitoring, usePolling, monitoringInterval, pollTweets]);

  // Fetch live stream stats periodically
  useEffect(() => {
    if (!liveStreamActive) return;

    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:8000/monitor/stats");
        if (response.ok) {
          const data = await response.json();
          setLiveStreamStats(data?.stats || data);
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

  const sendSuggestionPrompt = useCallback(async () => {
    const prompt = getMonitoringPrompt();
    if (!prompt) {
      toast.error("Select at least one institution to generate a prompt");
      return;
    }

    const tryDomSend = () => {
      const root = sidePanelContentRef.current;
      if (!root) return false;
      const textarea = root.querySelector("textarea") as HTMLTextAreaElement | null;
      const submitBtn =
        (root.querySelector('button[aria-label="Send message"]') as HTMLButtonElement | null) ||
        (root.querySelector('button[type="submit"]') as HTMLButtonElement | null) ||
        (root.querySelector('button[aria-label="Send"]') as HTMLButtonElement | null) ||
        (root.querySelector('button[title="Send"]') as HTMLButtonElement | null) ||
        (root.querySelector('button svg')?.closest("button") as HTMLButtonElement | null);

      if (textarea) {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
        textarea.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
          })
        );
        return true;
      }
      return false;
    };

    if (tryDomSend()) {
      toast.success("Prompt sent to chat");
    } else {
      toast.error("Could not send prompt. Please type it manually.");
    }
  }, [getMonitoringPrompt, toast]);

  const handleQuickAnalysis = useCallback(async () => {
    if (selectedInstitutions.length === 0) return;
    // Allow a new batch even if a prior stream flag was set
    setIsStreaming(false);
    for (const inst of selectedInstitutions) {
      await streamAnalysis(inst);
    }
  }, [selectedInstitutions, streamAnalysis]);

  // Run full quick analysis on a schedule while monitoring (mirrors Quick Analysis behavior)
  useEffect(() => {
    if (!isMonitoring || selectedInstitutions.length === 0) return;
    const run = () => handleQuickAnalysis();
    run();
    const interval = setInterval(run, Math.max(monitoringInterval, 1) * 60 * 1000);
    return () => clearInterval(interval);
    // We intentionally omit handleQuickAnalysis to avoid effect churn; it is stable enough for interval callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitoring, monitoringInterval, selectedInstitutions.length]);

  return (
    <div className="relative">
      <ToastContainer />
    <div className="flex h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Sidebar - Institution Selection */}
      <aside className={`${showSetup ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-slate-800/50 border-r border-slate-700`}>
        <div className="p-4 h-full overflow-y-auto flex flex-col">
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

          {/* Live Stream Status */}
          {liveStreamActive && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                <span className="text-sm font-medium text-white">Live Stream Active</span>
              </div>
              {liveStreamStats && (
                <div className="grid grid-cols-2 gap-2 text-xs text-emerald-300 mt-2">
                  <div>Tweets: {liveStreamStats.tweets_processed || 0}</div>
                  <div>Analyzed: {liveStreamStats.analyses_performed || 0}</div>
                  <div>Spikes: {liveStreamStats.spikes_detected || 0}</div>
                  <div>Rules: {liveStreamStats.active_rules || 0}</div>
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

          {/* Analysis Settings (from main) */}
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

          {/* Quick Actions (UI from main, Quick Analysis logic retained) */}
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
                onClick={handleQuickAnalysis}
                disabled={isStreaming || selectedInstitutions.length === 0}
                className={`w-full ${(isStreaming || selectedInstitutions.length === 0) ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
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
            </div>
          )}

          {/* Clear Button - Bottom Left Corner */}
          <div className="mt-auto pt-4 border-t border-slate-700">
            <button
              onClick={() => {
                setSelectedInstitutions([]);
                setLiveResults({});
                setStreamingResults([]);
                setLiveStreamEvents([]);
                toast.info("Cleared all selections and results");
              }}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear All
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 px-6 py-4 relative z-50">
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
              {/* Phase 3: Header Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors relative"
                  title="View History"
                >
                  <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Settings"
                >
                  <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors relative"
                  title="Alerts"
                >
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {activeAlerts.length > 0 && activeAlerts.filter(a => !a.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                      {activeAlerts.filter(a => !a.read).length}
                    </span>
                  )}
                </button>
              </div>
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

        {/* Chat Interface - Results now appear inline in chat */}
        <main
          className="flex-1 relative flex flex-col"
          style={{
            height: 'calc(100vh - 64px)', // align with header height to remove top gap
            overflowY: 'auto',
            paddingRight: '320px', // match left pane width so layout stays balanced
          }}
        >
          {/* Dashboard Overview */}
          <div className="px-6 pt-6 pb-4">
            <DashboardOverview
              {...dashboardStats}
              isLoading={isStreaming && streamingResults.length === 0}
            />
              </div>

          {/* Phase 2: Data Visualization Charts */}
          {streamingResults.length > 0 && (
            <div className="px-6 pb-4 space-y-6">
              {/* Time Range Selector */}
              <div className="flex items-center justify-end">
                <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Trend Chart */}
                {trendChartData.length > 0 && (
                  <TrendChart
                    timeRange={timeRange}
                    data={trendChartData}
                    showViralScore={true}
                  />
                )}

                {/* Viral Score Comparison */}
                {viralScoreChartData.length > 0 && (
                  <ViralScoreChart data={viralScoreChartData} maxInstitutions={8} />
                )}
              </div>

              {/* Comparison View */}
              {comparisonData.length > 1 && (
                <ComparisonView institutions={comparisonData} maxInstitutions={5} />
              )}
            </div>
          )}

          {/* Streaming Results Cards - Loading State */}
          {isStreaming && streamingResults.length === 0 && (
            <div className="px-6 pb-4">
              <div className="space-y-4">
                <RiskCardSkeleton />
                <RiskCardSkeleton />
              </div>
            </div>
          )}

          {/* Analysis Results View - Main Content Area */}
          {streamingResults.length > 0 && (
            <div className="px-6 pb-6">
              <AnalysisResultsView
                results={streamingResults.map(result => ({
                  institution: result.institution,
                  riskLevel: result.analysis?.risk_level || 'LOW',
                  summary: result.analysis?.summary || 'No summary available',
                  keyFindings: result.analysis?.key_findings,
                  tweetCount: result.analysis?.tweet_count,
                  viralScore: result.analysis?.viral_score,
                  trendVelocity: result.analysis?.trend_velocity,
                  evidenceTweets: result.analysis?.sample_posts?.slice(0, 3).map((post: string) => {
                    const urlMatch = post.match(/https:\/\/x\.com\/(\w+)\/status\/\d+/);
                    const author = urlMatch ? `@${urlMatch[1]}` : 'Unknown';
                    const text = post.replace(/https:\/\/x\.com\/\S+/g, '').trim();
                    return {
                      author,
                      text: text.slice(0, 200),
                      url: urlMatch ? urlMatch[0] : undefined,
                      verified: post.includes('[verified]') || post.includes('✓'),
                    };
                  }) || [],
                  confidence: result.analysis?.confidence,
                  timestamp: result.timestamp,
                }))}
                onClear={() => {
                  setStreamingResults([]);
                  toast.info("Results cleared");
                }}
              />
            </div>
          )}
        </main>

        {/* Live Stream Feed - Right Side (Always Visible) */}
        <LiveStreamFeed
          events={liveStreamEvents}
          isActive={liveStreamActive}
          stats={liveStreamStats}
          selectedInstitutions={selectedInstitutions}
          onClear={() => setLiveStreamEvents([])}
        />

        {/* Side Panel - Chat Assistant */}
        <SidePanel
          isOpen={showSidePanel}
          onClose={() => setShowSidePanel(false)}
          title="Financial Sentinel"
          showLivePanel={showLivePanel}
        >
          <div className="relative h-full" ref={sidePanelContentRef}>
            <CopilotChat
              // @ts-expect-error CopilotChat ref used for programmatic send
              ref={chatRef}
              className="h-full pb-16"
              labels={{
                title: "Financial Sentinel",
                initial: selectedInstitutions.length > 0
                  ? `I'm monitoring ${selectedInstitutions.length} institutions for you: ${selectedInstitutions.slice(0, 3).join(", ")}${selectedInstitutions.length > 3 ? '...' : ''}.\n\n**Features active:**\n- Multi-endpoint X API (/tweets/search, /tweets/counts)\n- Viral risk scoring & trend detection\n- Verified account weighting\n- Full tweet URL traceability\n\nType "analyze all" to check them now, or ask about specific ones.`
                  : "Hi! I'm your Financial Sentinel with **sophisticated X API integration**.\n\n**My capabilities:**\n- Multi-endpoint X API (search + counts + users)\n- Viral risk scoring (engagement-weighted)\n- Trend detection (volume velocity)\n- Circuit breaker (resilient to rate limits)\n- Full traceability (tweet URLs included)\n\nExamples:\n- \"Analyze Chase and Coinbase\"\n- \"Check if Robinhood has any issues\"\n- \"Monitor my crypto: Binance, MetaMask, Phantom\"",
                placeholder: selectedInstitutions.length > 0
                  ? `Analyze ${selectedInstitutions.length} selected institutions...`
                  : "Ask me to analyze any financial institution...",
              }}
              instructions={(() => {
                const baseInstructions = "You are the Financial Sentinel with SOPHISTICATED X API integration.\n\n";
                const institutionNote = selectedInstitutions.length > 0
                  ? `The user has selected these institutions to monitor: ${selectedInstitutions.join(", ")}\n\nIf the user says "analyze all", "check all", "monitor all", or similar, analyze ALL of their selected institutions.\n\n`
                  : "";
                const restInstructions = `## Your X API Integration
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

Be concise. Cite your data source (X API + Grok) and include tweet URLs for traceability.`;
                return baseInstructions + institutionNote + restInstructions;
              })()}
            />
            {selectedInstitutions.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4">
                <button
                  onClick={sendSuggestionPrompt}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-3 px-4 rounded-lg transition-colors shadow-lg shadow-indigo-900/40"
                >
                  Analyze {selectedInstitutions.length} selected institution{selectedInstitutions.length > 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>
        </SidePanel>

        {/* Footer */}
        <footer className="bg-slate-800/30 border-t border-slate-700 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Powered by Google ADK + xAI Grok 4.1 Fast | Multi-endpoint X API v2</span>
            <span>Data: api.x.com | Analysis: api.x.ai | Streaming: SSE</span>
          </div>
        </footer>
      </div>
      </div>

      {/* Phase 3: Modals and Panels */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Analysis History</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <AnalysisHistory history={analysisHistory} onExport={handleExport} />
            </div>
          </div>
        </div>
      )}

      {showAlerts && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Alert Center</h2>
                <button
                  onClick={() => setShowAlerts(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <AlertCenter
                alerts={activeAlerts}
                onMarkRead={(id) => {
                  setReadAlerts((prev) => {
                    // Create a new Set from the previous one and add the new id
                    const newSet = new Set(prev);
                    newSet.add(id);
                    // Return a new Set instance to ensure React detects the change
                    return new Set(Array.from(newSet));
                  });
                }}
                onMarkAllRead={() => {
                  const allIds = activeAlerts.map((a) => a.id);
                  setReadAlerts(new Set(allIds));
                }}
                onDismiss={(id) => {
                  setDismissedAlerts((prev) => {
                    const newSet = new Set(prev);
                    newSet.add(id);
                    return new Set(Array.from(newSet));
                  });
                }}
                filterRisk={alertFilter}
                onFilterChange={setAlertFilter}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Button - Bottom Left */}
      <button
        onClick={() => setShowSidePanel(!showSidePanel)}
        className={`fixed bottom-6 left-6 z-50 flex items-center justify-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 ${
          showSidePanel
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        }`}
        title={showSidePanel ? "Close Chat" : "Open Chat Assistant"}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="font-medium text-sm hidden sm:inline">
          {showSidePanel ? "Close Chat" : "Chat"}
        </span>
        {showSidePanel && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white"></span>
        )}
      </button>
    </div>
  );
}
