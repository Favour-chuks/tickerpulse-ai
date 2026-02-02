import React, { useState, useEffect } from "react";
import {
  Loader2,
  BellRing,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Card, Badge } from "../../../shared/components/Shared";
import { api } from "../../../shared/services/api";
import { Alert, Ticker } from "../../../shared/types";
import { alertsSocket } from "../../../shared/services/websocketService";

interface AlertViewProps {
  onSelectTicker: (ticker: Ticker) => void;
}

const AlertsView: React.FC<AlertViewProps> = ({onSelectTicker}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();

    const unsubscribe = alertsSocket.subscribe((payload: any) => {
      if (payload.type === "ALERT" || payload.type === "DIVERGENCE_ALERT") {
        const newAlert: Alert = {
          id: payload.data.id || Date.now(),
          symbol: payload.data.ticker || payload.data.symbol,
          message:
            payload.data.hypothesis ||
            payload.data.message ||
            "New anomaly detected",
          priority: payload.data.severity || "medium",
          alert_type:
            payload.type === "DIVERGENCE_ALERT" ? "spike" : "contradiction",
          created_at: payload.data.timestamp || new Date().toISOString(),
        };
        setAlerts((prev) => [newAlert, ...prev]);
      }
    });
    
    // TODO: Watch this event
    const handleMockEvent = (e: any) => {
    const payload = e.detail;
    const newAlert: Alert = {
      id: payload.data.id || Date.now(),
      symbol: payload.data.ticker || payload.data.symbol,
      message: payload.data.message || "New anomaly detected",
      priority: payload.data.severity || "medium",
      alert_type: payload.type === "DIVERGENCE_ALERT" ? "spike" : "contradiction",
      created_at: payload.data.timestamp || new Date().toISOString(),
    };

    setAlerts(prev => [newAlert, ...prev]);
  };
    window.addEventListener('mock-alert', handleMockEvent);
    return () => {
      unsubscribe();
      window.removeEventListener('mock-alert', handleMockEvent);
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.alerts.getRecent();
      setAlerts(res || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDismiss = async (id: string | number) => {
    await api.alerts.dismiss(id.toString());
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  if (loading)
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto">
      <header className="flex items-end justify-between border-b border-slate-200 dark:border-[#212124] pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Alert Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
            Chronological log of all high-frequency signals and corporate
            narrative anomalies.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="neutral">{alerts.length} New</Badge>
        </div>
      </header>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <Card
            key={alert.id}
            className={`border-l-4 ${
              alert.priority === "critical"
                ? "border-l-rose-500 bg-rose-50 dark:bg-rose-500/5"
                : alert.priority === "high"
                  ? "border-l-amber-500"
                  : "border-l-sky-500"
            }`}>
            <button onClick={() => onSelectTicker({id: alert.id, symbol: alert.symbol, companyName: '', sector: ''})} className="p-2 w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/10">
                    {alert.alert_type === "spike" ? (
                      <Zap
                        className="text-emerald-600 dark:text-emerald-500"
                        size={24}
                      />
                    ) : (
                      <AlertTriangle className="text-amber-500" size={24} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-lg text-slate-900 dark:text-white">
                        {alert.symbol}
                      </span>
                      <Badge
                        variant={
                          alert.priority === "critical" ? "danger" : "default"
                        }>
                        {alert.priority}
                      </Badge>
                      <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                        {alert.alert_type}
                      </span>
                    </div>
                    <p className="text-sm  text-start text-slate-600 dark:text-slate-300 leading-relaxed">
                      {alert.message}
                    </p>
                    <p className="text-[10px] text-start text-slate-400 dark:text-slate-500 font-mono">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  role="button"
                  onClick={(e : React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation()
                    handleDismiss(alert.id)}}
                  className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-[#212124] rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                  Dismiss
                </span>
              </div>
            </button>
          </Card>
        ))}

        {alerts.length === 0 && (
          <div className="p-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-[#212124] rounded-3xl bg-slate-50/50 dark:bg-[#0a0a0b]/50">
            <div className="w-16 h-16 bg-slate-100 dark:bg-[#18181b] rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
              <BellRing size={24} />
            </div>
            <p className="font-bold text-slate-500 dark:text-slate-400">
              All Quiet
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              No active anomalies detected in the current monitoring window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsView;
