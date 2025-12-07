"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";

interface AnalysisResult {
  institution: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  keyFindings?: string[];
  tweetCount?: number;
  viralScore?: number;
  trendVelocity?: number;
  evidenceTweets?: Array<{
    author: string;
    text: string;
    url?: string;
    verified?: boolean;
    engagement?: string;
  }>;
  confidence?: number;
  timestamp?: Date;
}

interface AnalysisResultsViewProps {
  results: AnalysisResult[];
  onClear?: () => void;
}

export default function AnalysisResultsView({
  results,
  onClear,
}: AnalysisResultsViewProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (institution: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(institution)) {
        newSet.delete(institution);
      } else {
        newSet.add(institution);
      }
      return newSet;
    });
  };

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Analysis Results</h3>
        <p className="text-sm text-slate-400 max-w-md">
          Analysis results will appear here when you analyze financial institutions.
        </p>
      </div>
    );
  }

  const riskColors = {
    HIGH: {
      bg: "from-red-950/40 to-red-900/20",
      border: "border-red-500/50",
      text: "text-red-100",
      badge: "bg-red-500",
      icon: "text-red-400",
      glow: "shadow-red-500/20",
    },
    MEDIUM: {
      bg: "from-amber-950/40 to-amber-900/20",
      border: "border-amber-500/50",
      text: "text-amber-100",
      badge: "bg-amber-500",
      icon: "text-amber-400",
      glow: "shadow-amber-500/20",
    },
    LOW: {
      bg: "from-emerald-950/40 to-emerald-900/20",
      border: "border-emerald-500/50",
      text: "text-emerald-100",
      badge: "bg-emerald-500",
      icon: "text-emerald-400",
      glow: "shadow-emerald-500/10",
    },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Analysis Results</h2>
          <p className="text-sm text-slate-400">{results.length} institution{results.length !== 1 ? 's' : ''} analyzed</p>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-all border border-slate-600/50"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Results Grid */}
      <div className="space-y-6">
        {results.map((result, index) => {
          const colors = riskColors[result.riskLevel] || riskColors.LOW;
          const isExpanded = expandedCards.has(result.institution);

          return (
            <motion.div
              key={result.institution}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} backdrop-blur-sm p-6 shadow-xl ${colors.glow} ${result.riskLevel === 'HIGH' ? 'animate-pulse' : ''}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg ${colors.badge}/20 border ${colors.border} flex items-center justify-center`}>
                    <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{result.institution}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {result.timestamp ? result.timestamp.toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>
                <span className={`${colors.badge} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg`}>
                  {result.riskLevel}
                </span>
              </div>

              {/* Summary */}
              <p className={`${colors.text} text-sm mb-4 leading-relaxed`}>{result.summary}</p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {result.tweetCount !== undefined && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400 mb-1">Tweets</div>
                    <div className="text-lg font-bold text-white">{result.tweetCount}</div>
                  </div>
                )}
                {result.viralScore !== undefined && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400 mb-1">Viral Score</div>
                    <div className="text-lg font-bold text-white">{result.viralScore}/100</div>
                  </div>
                )}
                {result.confidence !== undefined && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400 mb-1">Confidence</div>
                    <div className="text-lg font-bold text-white">{(result.confidence * 100).toFixed(0)}%</div>
                  </div>
                )}
              </div>

              {/* Expandable Details */}
              <button
                onClick={() => toggleExpand(result.institution)}
                className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isExpanded ? 'Hide Details' : 'Show Details'}
                {isExpanded ? '↑' : '↓'}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4 border-t border-slate-700/50">
                      {/* Key Findings */}
                      {result.keyFindings && result.keyFindings.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-300 uppercase mb-2 tracking-wide flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                            Key Findings
                          </h4>
                          <ul className="space-y-2">
                            {result.keyFindings.map((finding, idx) => (
                              <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="text-blue-400 mt-1">•</span>
                                <span className="leading-relaxed">{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Evidence Tweets */}
                      {result.evidenceTweets && result.evidenceTweets.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-300 uppercase mb-2 tracking-wide flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                            Evidence Tweets
                          </h4>
                          <div className="space-y-3">
                            {result.evidenceTweets.map((tweet, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-white text-sm">
                                    {tweet.author}
                                    {tweet.verified && (
                                      <span className="ml-1.5 text-blue-400">✓</span>
                                    )}
                                  </span>
                                  {tweet.engagement && (
                                    <span className="text-xs text-slate-400">{tweet.engagement}</span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed mb-2 line-clamp-3">
                                  {tweet.text}
                                </p>
                                {tweet.url && (
                                  <a
                                    href={tweet.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                                  >
                                    View on X
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Trend Indicator */}
                      {result.trendVelocity !== undefined && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-400">Trend:</span>
                          {result.trendVelocity > 0 ? (
                            <div className="flex items-center gap-1 text-red-400">
                              <TrendingUp className="w-4 h-4" />
                              <span className="font-semibold">+{result.trendVelocity.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-400">
                              <TrendingDown className="w-4 h-4" />
                              <span className="font-semibold">{result.trendVelocity.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

