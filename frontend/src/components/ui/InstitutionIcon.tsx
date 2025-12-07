"use client";

import { Building2, Wallet, TrendingUp, CreditCard, Smartphone, Coins, Banknote } from "lucide-react";
import { motion } from "framer-motion";

interface InstitutionIconProps {
  name: string;
  category?: string;
  size?: "sm" | "md" | "lg";
}

const CATEGORY_ICONS: Record<string, any> = {
  "Traditional Banks": Building2,
  "Crypto Exchanges": Coins,
  "Crypto Wallets": Wallet,
  "Stock Trading": TrendingUp,
  "Robo-Advisors": TrendingUp,
  "Payment Apps": CreditCard,
  "Neobanks": Smartphone,
};

const INSTITUTION_ICONS: Record<string, any> = {
  // Banks
  "Chase": Building2,
  "Bank of America": Building2,
  "Wells Fargo": Building2,
  "Citibank": Building2,
  "Capital One": Building2,
  "US Bank": Building2,
  "PNC Bank": Building2,
  // Crypto
  "Coinbase": Coins,
  "Binance": Coins,
  "Kraken": Coins,
  "Gemini": Coins,
  "Crypto.com": Coins,
  "KuCoin": Coins,
  "Bitfinex": Coins,
  // Wallets
  "MetaMask": Wallet,
  "Phantom": Wallet,
  "Ledger": Wallet,
  "Trust Wallet": Wallet,
  "Coinbase Wallet": Wallet,
  // Trading
  "Robinhood": TrendingUp,
  "Webull": TrendingUp,
  "E*TRADE": TrendingUp,
  "Fidelity": TrendingUp,
  "Charles Schwab": TrendingUp,
  "TD Ameritrade": TrendingUp,
  "Interactive Brokers": TrendingUp,
  // Payment
  "Venmo": CreditCard,
  "Cash App": CreditCard,
  "PayPal": CreditCard,
  "Zelle": CreditCard,
  "Apple Pay": CreditCard,
  // Neobanks
  "Chime": Smartphone,
  "SoFi": Smartphone,
  "Revolut": Smartphone,
  "Current": Smartphone,
  "Varo": Smartphone,
};

const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export default function InstitutionIcon({ name, category, size = "md" }: InstitutionIconProps) {
  // Try to find icon by institution name first, then by category
  const IconComponent = INSTITUTION_ICONS[name] || (category ? CATEGORY_ICONS[category] : null) || Building2;
  const sizeClass = sizeClasses[size];

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3, type: "spring" }}
      className={`${sizeClass} rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center`}
    >
      <IconComponent className={`${size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-6 h-6"} text-blue-300`} />
    </motion.div>
  );
}

