"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Bell, Palette, Clock, AlertCircle, Save } from "lucide-react";

interface SettingsPanelProps {
  onClose?: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState({
    // Notification preferences
    notifyHighRisk: true,
    notifyMediumRisk: true,
    notifyLowRisk: false,
    emailNotifications: false,
    slackNotifications: true,

    // Monitoring settings
    monitoringInterval: 15, // minutes
    autoRefresh: true,

    // Alert thresholds
    highRiskThreshold: 80,
    mediumRiskThreshold: 50,

    // Theme (for future dark/light mode)
    theme: "dark",
  });

  const handleSave = () => {
    // Save settings to localStorage or API
    localStorage.setItem("financialSentinelSettings", JSON.stringify(settings));
    // Show success toast or notification
    if (onClose) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Settings
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Notification Preferences */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-white">Notification Preferences</h4>
          </div>
          <div className="space-y-3 pl-6">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-300">Notify on HIGH risk</span>
              <input
                type="checkbox"
                checked={settings.notifyHighRisk}
                onChange={(e) =>
                  setSettings({ ...settings, notifyHighRisk: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-300">Notify on MEDIUM risk</span>
              <input
                type="checkbox"
                checked={settings.notifyMediumRisk}
                onChange={(e) =>
                  setSettings({ ...settings, notifyMediumRisk: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-300">Notify on LOW risk</span>
              <input
                type="checkbox"
                checked={settings.notifyLowRisk}
                onChange={(e) =>
                  setSettings({ ...settings, notifyLowRisk: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <div className="pt-2 border-t border-slate-700">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-300">Email notifications</span>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, emailNotifications: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer mt-3">
                <span className="text-sm text-slate-300">Slack notifications</span>
                <input
                  type="checkbox"
                  checked={settings.slackNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, slackNotifications: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Monitoring Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-white">Monitoring Settings</h4>
          </div>
          <div className="space-y-3 pl-6">
            <div>
              <label className="text-sm text-slate-300 block mb-2">
                Monitoring Interval: {settings.monitoringInterval} minutes
              </label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={settings.monitoringInterval}
                onChange={(e) =>
                  setSettings({ ...settings, monitoringInterval: parseInt(e.target.value) })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>5 min</span>
                <span>60 min</span>
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-300">Auto-refresh dashboard</span>
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) =>
                  setSettings({ ...settings, autoRefresh: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Alert Thresholds */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-white">Alert Thresholds</h4>
          </div>
          <div className="space-y-4 pl-6">
            <div>
              <label className="text-sm text-slate-300 block mb-2">
                HIGH Risk Threshold: {settings.highRiskThreshold}
              </label>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={settings.highRiskThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, highRiskThreshold: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-2">
                MEDIUM Risk Threshold: {settings.mediumRiskThreshold}
              </label>
              <input
                type="range"
                min="20"
                max="80"
                step="5"
                value={settings.mediumRiskThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, mediumRiskThreshold: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-700">
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>
    </motion.div>
  );
}

