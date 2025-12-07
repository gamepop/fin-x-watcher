"use client";

import { motion } from "framer-motion";
import { Clock, TrendingUp, TrendingDown, Minus, Download, FileText } from "lucide-react";
import { format } from "date-fns";

interface HistoryEntry {
  institution: string;
  timestamp: Date;
  riskLevel: string;
  viralScore: number;
  tweetCount: number;
  summary: string;
}

interface AnalysisHistoryProps {
  history: HistoryEntry[];
  onExport?: (format: "csv" | "pdf") => void;
}

export default function AnalysisHistory({ history, onExport }: AnalysisHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
        <div className="text-center py-12">
          <Clock className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p className="text-slate-400">No analysis history yet</p>
          <p className="text-sm text-slate-500 mt-2">Analyses will appear here as you monitor institutions</p>
        </div>
      </div>
    );
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "HIGH":
        return "text-red-400 bg-red-500/20 border-red-500/50";
      case "MEDIUM":
        return "text-amber-400 bg-amber-500/20 border-amber-500/50";
      case "LOW":
        return "text-emerald-400 bg-emerald-500/20 border-emerald-500/50";
      default:
        return "text-slate-400 bg-slate-500/20 border-slate-500/50";
    }
  };

  const getTrendIcon = (current: number, previous?: number) => {
    if (!previous) return <Minus className="w-4 h-4 text-slate-400" />;
    if (current > previous) return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Analysis History
        </h3>
        {onExport && (
          <div className="flex gap-2">
            <button
              onClick={() => onExport("csv")}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => onExport("pdf")}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {history.map((entry, index) => {
          const previous = index < history.length - 1 ? history[index + 1] : undefined;
          const riskChanged = previous && previous.riskLevel !== entry.riskLevel;
          const scoreChanged = previous && previous.viralScore !== entry.viralScore;

          return (
            <motion.div
              key={`${entry.institution}-${entry.timestamp.getTime()}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-lg border ${
                riskChanged
                  ? "bg-slate-700/50 border-slate-600 ring-2 ring-blue-500/30"
                  : "bg-slate-700/30 border-slate-600/50"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-white">{entry.institution}</h4>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold border ${getRiskColor(
                        entry.riskLevel
                      )}`}
                    >
                      {entry.riskLevel}
                    </span>
                    {riskChanged && (
                      <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                        Risk Changed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{entry.summary}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 mb-1">
                    {format(entry.timestamp, "MMM d, yyyy")}
                  </div>
                  <div className="text-xs text-slate-400">
                    {format(entry.timestamp, "h:mm a")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  {getTrendIcon(entry.viralScore, previous?.viralScore)}
                  <span className="text-slate-300">
                    Viral Score: <span className="font-semibold text-white">{entry.viralScore}</span>
                  </span>
                </div>
                <div className="text-slate-400">
                  Tweets: <span className="font-semibold text-white">{entry.tweetCount}</span>
                </div>
                {scoreChanged && (
                  <span className="text-xs text-blue-400">
                    Score {entry.viralScore > (previous?.viralScore || 0) ? "↑" : "↓"}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

