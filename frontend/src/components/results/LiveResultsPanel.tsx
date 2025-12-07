"use client";

import { motion } from "framer-motion";
import { Activity, X, Sparkles } from "lucide-react";
import EnhancedRiskCard from "@/components/risk/EnhancedRiskCard";

interface LiveResultsPanelProps {
  results: Array<{
    id: string;
    institution: string;
    analysis: any;
    timestamp: Date;
  }>;
  onClear: () => void;
  isStreaming?: boolean;
}

export default function LiveResultsPanel({
  results,
  onClear,
  isStreaming = false,
}: LiveResultsPanelProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-6 mb-4 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-800/80 backdrop-blur-sm shadow-2xl shadow-slate-900/50 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700/50 to-slate-700/30 px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
                {isStreaming ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5 text-green-400" />
                  </motion.div>
                ) : (
                  <Activity className="w-5 h-5 text-green-400" />
                )}
              </div>
              {isStreaming && (
                <motion.span
                  className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Live Analysis Results
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">
                  {results.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time risk monitoring & analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-all border border-slate-600/50 hover:border-slate-500"
          >
            <X className="w-3.5 h-3.5" />
            Clear All
          </button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="p-6 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-1 gap-4">
          {results.map((result, index) => {
            const analysis = result.analysis;
            // Parse evidence tweets from sample_posts
            const evidenceTweets = analysis?.sample_posts?.slice(0, 3).map((post: string) => {
              const urlMatch = post.match(/https:\/\/x\.com\/(\w+)\/status\/\d+/);
              const author = urlMatch ? `@${urlMatch[1]}` : "Unknown";
              const text = post.replace(/https:\/\/x\.com\/\S+/g, "").trim();
              return {
                author,
                text: text.slice(0, 200),
                url: urlMatch ? urlMatch[0] : undefined,
                verified: post.includes("[verified]") || post.includes("✓"),
              };
            }) || [];

            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
              >
                <EnhancedRiskCard
                  bankName={result.institution}
                  riskLevel={analysis?.risk_level || "LOW"}
                  summary={analysis?.summary || "No summary available"}
                  keyFindings={analysis?.key_findings}
                  confidence={analysis?.confidence}
                  viralScore={analysis?.viral_score}
                  trendVelocity={analysis?.trend_velocity}
                  evidenceTweets={evidenceTweets}
                  timestamp={result.timestamp}
                  isStreaming={isStreaming && index === results.length - 1}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

