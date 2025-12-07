"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle2, ExternalLink, X } from "lucide-react";

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

interface LiveStreamFeedProps {
  events: LiveStreamEvent[];
  isActive: boolean;
  stats?: any;
  onClear?: () => void;
  onClose?: () => void;
  selectedInstitutions?: string[];
}

// Fallback financial news when there are no tweets
const FALLBACK_NEWS = [
  { id: 'news-1', title: 'Fed signals potential rate cuts ahead', source: 'Financial Times', time: '2m ago', keywords: ['fed', 'rate', 'bank'] },
  { id: 'news-2', title: 'Crypto markets show volatility as Bitcoin surges', source: 'CoinDesk', time: '5m ago', keywords: ['crypto', 'bitcoin', 'coinbase', 'binance'] },
  { id: 'news-3', title: 'Bank earnings beat expectations - Chase and Wells Fargo lead', source: 'Bloomberg', time: '8m ago', keywords: ['bank', 'chase', 'wells fargo', 'earnings'] },
  { id: 'news-4', title: 'Tech stocks rally on AI optimism - Robinhood sees gains', source: 'Reuters', time: '12m ago', keywords: ['robinhood', 'tech', 'stocks'] },
  { id: 'news-5', title: 'Oil prices stabilize after OPEC meeting', source: 'WSJ', time: '15m ago', keywords: ['oil', 'opec'] },
  { id: 'news-6', title: 'Coinbase announces new trading features', source: 'CoinDesk', time: '18m ago', keywords: ['coinbase', 'trading', 'crypto'] },
  { id: 'news-7', title: 'Bank of America reports strong Q4 results', source: 'Financial Times', time: '20m ago', keywords: ['bank of america', 'earnings', 'bank'] },
  { id: 'news-8', title: 'MetaMask introduces new security features', source: 'TechCrunch', time: '22m ago', keywords: ['metamask', 'security', 'crypto wallet'] },
  { id: 'news-9', title: 'Fidelity expands crypto offerings', source: 'Bloomberg', time: '25m ago', keywords: ['fidelity', 'crypto', 'trading'] },
  { id: 'news-10', title: 'Venmo adds new payment options', source: 'WSJ', time: '28m ago', keywords: ['venmo', 'payment', 'paypal'] },
];

export default function LiveStreamFeed({
  events,
  isActive,
  stats,
  onClear,
  onClose,
  selectedInstitutions = [],
}: LiveStreamFeedProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [displayItems, setDisplayItems] = useState<(LiveStreamEvent | typeof FALLBACK_NEWS[0])[]>([]);
  const [autoScroll] = useState(false);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if an item matches selected institutions
  const matchesInstitution = (item: LiveStreamEvent | typeof FALLBACK_NEWS[0]): boolean => {
    if ('type' in item) {
      // It's a LiveStreamEvent
      if (item.institution && selectedInstitutions.length > 0) {
        return selectedInstitutions.some(inst => {
          const itemInst = item.institution?.toLowerCase() || '';
          const selectedInst = inst.toLowerCase();
          return itemInst.includes(selectedInst) || selectedInst.includes(itemInst);
        });
      }
      // Check text content for institution mentions
      if (item.text && selectedInstitutions.length > 0) {
        return selectedInstitutions.some(inst => 
          item.text?.toLowerCase().includes(inst.toLowerCase())
        );
      }
    }
    // News items are no longer rendered; default to no highlight
    return false;
  };

  // Show only real events; newest first; keep view at top
  useEffect(() => {
    if (events.length > 0) {
      const sorted = [...events].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp as any).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp as any).getTime() : 0;
        return tb - ta; // newest first
      });
      setDisplayItems(sorted);
      // keep scrolled to top (latest)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0 });
      }
    } else {
      setDisplayItems([]);
    }
  }, [events]);

  // Handle scroll (no auto-scroll toggling needed now)
  const handleScroll = () => {};

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'tweet':
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'analysis':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'spike':
        return <TrendingUp className="w-4 h-4 text-orange-400" />;
      case 'connected':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getEventColor = (event: LiveStreamEvent | typeof FALLBACK_NEWS[0]) => {
    if ('type' in event) {
      switch (event.type) {
        case 'tweet':
          return 'bg-blue-900/30 border-blue-700/50';
        case 'analysis':
          if (event.risk_level === 'HIGH') return 'bg-red-900/30 border-red-700/50';
          if (event.risk_level === 'MEDIUM') return 'bg-yellow-900/30 border-yellow-700/50';
          return 'bg-green-900/30 border-green-700/50';
        case 'spike':
          return 'bg-orange-900/30 border-orange-700/50';
        case 'connected':
          return 'bg-emerald-900/30 border-emerald-700/50';
        case 'error':
          return 'bg-red-900/30 border-red-700/50';
        default:
          return 'bg-slate-800/60 border-slate-700/50';
      }
    }
    return 'bg-slate-800/40 border-slate-700/30';
  };

  return (
    <div className="fixed right-0 top-[96px] h-[calc(100vh-96px)] w-[380px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-l border-slate-700/50 shadow-2xl z-30 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          )}
          <h3 className="text-sm font-bold text-white">Live Feed</h3>
          {stats && (
            <span className="text-xs text-slate-400">
              {stats.tweets_processed || 0} tweets
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onClear && (
            <button
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
              title="Clear feed"
            >
              Clear
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
              title="Close feed"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrolling Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(71, 85, 105, 0.5) transparent',
        }}
      >
        <div className="p-3 space-y-2">
          {displayItems.length === 0 && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-4 text-sm text-slate-300 text-center">
              Waiting for live tweets… start the stream with at least one institution selected.
            </div>
          )}
          <AnimatePresence initial={false}>
            {displayItems.map((item, idx) => {
              const isNews = !('type' in item);
              const itemIsHighlighted = matchesInstitution(item);
              const isTweet = !isNews && 'type' in item && item.type === 'tweet';
              
              // Generate tweet URL if not provided. Prefer backend URL; otherwise build from handle + tweet id.
              const tweetUrl = isTweet
                ? (item.url || (item.author && item.tweet_id
                  ? `https://x.com/${item.author.replace('@', '')}/status/${item.tweet_id}`
                  : undefined))
                : undefined;

              return (
                <motion.div
                  key={isNews ? item.id : item.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className={`rounded-lg p-4 text-sm border backdrop-blur-sm transition-all ${
                    itemIsHighlighted 
                      ? 'bg-blue-900/50 border-blue-500/70 ring-2 ring-blue-400/30 shadow-lg shadow-blue-500/20' 
                      : getEventColor(item)
                  } ${isTweet && tweetUrl ? 'cursor-pointer hover:bg-slate-800/80 hover:border-slate-600 hover:shadow-xl' : ''}`}
                  onClick={isTweet && tweetUrl ? () => window.open(tweetUrl, '_blank', 'noopener,noreferrer') : undefined}
                  role={isTweet && tweetUrl ? "button" : undefined}
                  tabIndex={isTweet && tweetUrl ? 0 : undefined}
                  onKeyDown={isTweet && tweetUrl ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.open(tweetUrl, '_blank', 'noopener,noreferrer');
                    }
                  } : undefined}
                >
                  {isNews ? (
                    // No fallback cards shown; keep slot empty for future real events
                    null
                  ) : (
                    // Live stream event
                    <>
                      {item.type === 'tweet' ? (
                        // Tweet card - styled like real X tweet (div wrapper to avoid nested anchors)
                        <div
                          className="space-y-2 block focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-lg cursor-pointer"
                          role={tweetUrl ? "button" : undefined}
                          tabIndex={tweetUrl ? 0 : undefined}
                          onClick={() => tweetUrl && window.open(tweetUrl, "_blank", "noopener,noreferrer")}
                          onKeyDown={(e) => {
                            if (!tweetUrl) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              window.open(tweetUrl, "_blank", "noopener,noreferrer");
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 ring-2 ring-slate-700/50">
                              <span className="text-white text-sm font-bold">
                                {item.author_name?.[0]?.toUpperCase() || item.author?.[1]?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                {item.author_name && (
                                  <span className="font-bold text-white text-[15px] hover:underline">
                                    {item.author_name}
                                  </span>
                                )}
                                <span className="text-slate-500 text-[15px]">
                                  {item.author}
                                </span>
                                {item.author_verified && (
                                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                                  </svg>
                                )}
                                <span className="text-slate-500 text-[15px]">·</span>
                                <span className="text-slate-500 text-[15px] hover:underline">
                                  {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {item.institution && (
                                  <span className="text-xs px-2 py-0.5 bg-indigo-900/50 text-indigo-300 rounded-full flex-shrink-0 ml-auto">
                                    {item.institution}
                                  </span>
                                )}
                              </div>
                              {item.text && (
                                <div className="mb-2">
                                  <p className="text-white text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
                                    {item.text}
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-[13px] mt-3 pt-2 border-t border-slate-700/50">
                                <div className="flex items-center gap-8 text-slate-500">
                                  {item.engagement && (
                                    <>
                                      <button 
                                        className="flex items-center gap-2 hover:text-blue-400 transition-colors group"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <svg className="w-5 h-5 group-hover:text-blue-400 group-hover:bg-blue-400/10 rounded-full p-1 transition-all" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.47-4 6.92l-2.736 1.416c-.35.18-.77.18-1.123 0l-2.736-1.416C3.358 15.47 1.752 12.96 1.752 10H1.75zm8.005-6a6.005 6.005 0 1 0 0 12.01A6.005 6.005 0 0 0 9.756 4z"/>
                                        </svg>
                                        {item.engagement.replies > 0 && <span className="group-hover:text-blue-400">{item.engagement.replies.toLocaleString()}</span>}
                                      </button>
                                      <button 
                                        className="flex items-center gap-2 hover:text-green-400 transition-colors group"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <svg className="w-5 h-5 group-hover:text-green-400 group-hover:bg-green-400/10 rounded-full p-1 transition-all" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M4.5 3.88l4.432 4.14-1.364 4.98L12 17.88l4.432-5.78-1.364-4.98L19.5 3.88 12 6.11 4.5 3.88zM16.5 6l-2.5 1.19L12 8.5 10 7.19 7.5 6l2.5 1.19L12 9.5l2-1.31L16.5 6z"/>
                                        </svg>
                                        {item.engagement.retweets > 0 && <span className="group-hover:text-green-400">{item.engagement.retweets.toLocaleString()}</span>}
                                      </button>
                                      <button 
                                        className="flex items-center gap-2 hover:text-red-400 transition-colors group"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <svg className="w-5 h-5 group-hover:text-red-400 group-hover:bg-red-400/10 rounded-full p-1 transition-all" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>
                                        </svg>
                                        {item.engagement.likes > 0 && <span className="group-hover:text-red-400">{item.engagement.likes.toLocaleString()}</span>}
                                      </button>
                                    </>
                                  )}
                                </div>
                                {tweetUrl && (
                                  <button
                                    type="button"
                                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(tweetUrl, "_blank", "noopener,noreferrer");
                                    }}
                                  >
                                    <span>View</span>
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Other event types (analysis, spike, etc.)
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {getEventIcon(item.type)}
                              {item.type === 'analysis' && (
                                <>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    item.risk_level === 'HIGH' ? 'bg-red-600 text-white' :
                                    item.risk_level === 'MEDIUM' ? 'bg-yellow-600 text-white' :
                                    'bg-green-600 text-white'
                                  }`}>
                                    {item.risk_level} RISK
                                  </span>
                                  <span className="text-slate-300 text-xs truncate">{item.institution}</span>
                                </>
                              )}
                              {item.type === 'spike' && (
                                <>
                                  <span className="px-2 py-0.5 bg-orange-600 text-white rounded text-xs font-medium">SPIKE</span>
                                  <span className="text-orange-300 text-xs truncate">{item.institution}</span>
                                </>
                              )}
                              {(item.type === 'connected' || item.type === 'reconnecting' || item.type === 'error') && (
                                <span className={`text-xs ${
                                  item.type === 'connected' ? 'text-emerald-400' :
                                  item.type === 'reconnecting' ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {item.summary}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                              {item.timestamp.toLocaleTimeString()}
                            </span>
                          </div>

                          {item.text && (
                            <p className="text-slate-300 text-sm mb-2 line-clamp-3 leading-relaxed">{item.text}</p>
                          )}

                          {item.type === 'analysis' && item.summary && (
                            <p className="text-slate-300 text-sm mb-2">{item.summary}</p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}

