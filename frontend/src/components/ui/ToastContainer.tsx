"use client";

import { Toaster } from "react-hot-toast";

export default function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "rgba(30, 41, 59, 0.95)",
          color: "#f1f5f9",
          border: "1px solid rgba(71, 85, 105, 0.5)",
          borderRadius: "0.75rem",
          padding: "12px 16px",
          backdropFilter: "blur(8px)",
        },
        success: {
          iconTheme: {
            primary: "#10b981",
            secondary: "#f1f5f9",
          },
          style: {
            border: "1px solid rgba(16, 185, 129, 0.3)",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#f1f5f9",
          },
          style: {
            border: "1px solid rgba(239, 68, 68, 0.3)",
          },
        },
      }}
    />
  );
}

