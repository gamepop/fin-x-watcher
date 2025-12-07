"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ExternalLink, CheckCircle2 } from "lucide-react";
import InstitutionIcon from "../ui/InstitutionIcon";
import Sparkline from "../charts/Sparkline";

interface EnhancedRiskCardProps {
  bankName: string;
  riskLevel: string;
  summary: string;
  keyFindings?: string[];
  tweetCount?: number;
  viralScore?: number;
  trendVelocity?: number;
  evidenceTweets?: {
    author: string;
    verified?: boolean;
    engagement?: string;
    text: string;
    url?: string;
  }[];
  confidence?: number;
  timestamp?: Date;
  isStreaming?: boolean;
}

export default function EnhancedRiskCard({
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
  isStreaming = false,
}: EnhancedRiskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const riskColors: Record<
    string,
    {
      bg: string;
      border: string;
      text: string;
      badge: string;
      glow: string;
      pulse: string;
      progress: string;
    }
  > = {
    HIGH: {
      bg: "bg-red-950/40",
      border: "border-red-500/50",
      text: "text-red-100",
      badge: "bg-red-500",
      glow: "shadow-red-500/30",
      pulse: "animate-pulse",
      progress: "bg-red-500",
    },
    MEDIUM: {
      bg: "bg-amber-950/40",
      border: "border-amber-500/50",
      text: "text-amber-100",
      badge: "bg-amber-500",
      glow: "shadow-amber-500/20",
      pulse: "",
      progress: "bg-amber-500",
    },
    LOW: {
      bg: "bg-emerald-950/40",
      border: "border-emerald-500/50",
      text: "text-emerald-100",
      badge: "bg-emerald-500",
      glow: "shadow-emerald-500/10",
      pulse: "",
      progress: "bg-emerald-500",
    },
  };

  const colors = riskColors[riskLevel] || riskColors.LOW;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.01 }}
      className={`rounded-xl border-2 ${colors.border} ${colors.bg} backdrop-blur-sm p-6 my-4 shadow-xl ${colors.glow} ${riskLevel === "HIGH" ? colors.pulse : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {isStreaming && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-blue-500"
            />
          )}
          <InstitutionIcon name={bankName} size="md" />
          <h3 className="text-xl font-bold text-white">{bankName}</h3>
        </div>
        <div className="flex items-center gap-2">
          {viralScore !== undefined && (
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-300 mb-1">Viral Score</span>
              <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${viralScore}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full ${colors.progress} rounded-full`}
                />
              </div>
              <span className="text-xs text-slate-400 mt-1">{viralScore}/100</span>
            </div>
          )}
          <motion.span
            whileHover={{ scale: 1.1 }}
            className={`${colors.badge} text-white text-xs font-bold px-4 py-2 rounded-full ${riskLevel === "HIGH" ? "animate-pulse" : ""}`}
          >
            {riskLevel}
          </motion.span>
        </div>
      </div>

      {/* Summary */}
      <p className={`${colors.text} text-sm mb-4 font-medium leading-relaxed`}>{summary}</p>

      {/* Metrics Row */}
      <div className="flex flex-wrap gap-3 mb-4">
        {tweetCount !== undefined && tweetCount > 0 && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50"
          >
            <span className="text-xs text-slate-400 block mb-1">Tweets</span>
            <span className="text-sm font-semibold text-white">{tweetCount}</span>
          </motion.div>
        )}
        {trendVelocity !== undefined && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50"
          >
            <span className="text-xs text-slate-400 block mb-1">Trend</span>
            <div className="flex items-center gap-1">
              {trendVelocity > 0 ? (
                <TrendingUp className="w-4 h-4 text-red-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              )}
              <span
                className={`text-sm font-semibold ${
                  trendVelocity > 0 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {trendVelocity > 0 ? "+" : ""}
                {trendVelocity.toFixed(1)}%
              </span>
            </div>
          </motion.div>
        )}
        {confidence !== undefined && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50"
          >
            <span className="text-xs text-slate-400 block mb-1">Confidence</span>
            <span className="text-sm font-semibold text-white">
              {(confidence * 100).toFixed(0)}%
            </span>
          </motion.div>
        )}
        {viralScore !== undefined && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50 flex-1 min-w-[120px]"
          >
            <span className="text-xs text-slate-400 block mb-1">Trend Sparkline</span>
            <Sparkline
              data={[
                viralScore * 0.7,
                viralScore * 0.85,
                viralScore * 0.9,
                viralScore,
                viralScore * 0.95,
              ]}
              color={colors.progress}
              height={24}
            />
          </motion.div>
        )}
      </div>

      {/* Expandable Details */}
      {(keyFindings?.length || evidenceTweets?.length) && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors mb-3"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            <span>{isExpanded ? "Hide Details" : "Show Details"}</span>
          </button>

          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Key Findings */}
              {keyFindings && keyFindings.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2 tracking-wide">
                    Key Findings
                  </h4>
                  <ul className="space-y-2">
                    {keyFindings.slice(0, 4).map((finding: string, idx: number) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-start gap-2 text-sm text-slate-300"
                      >
                        <span className="text-slate-500 mt-1">•</span>
                        <span>{finding}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Evidence Tweets */}
              {evidenceTweets && evidenceTweets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2 tracking-wide">
                    Evidence from X
                  </h4>
                  <div className="space-y-3">
                    {evidenceTweets.slice(0, 2).map((tweet: any, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-slate-800/60 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{tweet.author}</span>
                            {tweet.verified && (
                              <CheckCircle2 className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          {tweet.engagement && (
                            <span className="text-xs text-slate-400">{tweet.engagement}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-3 mb-2">{tweet.text}</p>
                        {tweet.url && (
                          <a
                            href={tweet.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            View on X <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-slate-500 pt-4 mt-4 border-t border-slate-700/50 flex items-center justify-between">
        <span>Source: X API v2 + Grok Live Search</span>
        <span className="flex items-center gap-2">
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
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>{timestamp ? timestamp.toLocaleTimeString() : "Live data"}</span>
            </>
          )}
        </span>
      </div>
    </motion.div>
  );
}

