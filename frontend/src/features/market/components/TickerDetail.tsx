import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  History,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Ticker,
  MarketData,
  Narrative,
  PromiseRecord,
  Contradiction,
} from "../../../shared/types";
import { api } from "../../../shared/services/api";
import { Card, Badge } from "../../../shared/components/Shared";

const TickerDetail = ({
  ticker: propTicker,
  onBack: propOnBack,
}: {
  ticker?: Ticker;
  onBack?: () => void;
}) => {
  const { symbol: paramSymbol } = useParams();
  const navigate = useNavigate();

  const symbol = (propTicker?.symbol || paramSymbol || "").toUpperCase();

  const [ticker, setTicker] = useState<Ticker>(
    propTicker || {
      id: 0,
      symbol: symbol,
      companyName: "Loading...",
      sector: "...",
    },
  );

  const [timeframe, setTimeframe] = useState<"1M" | "5M" | "15M">("5M");
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [promises, setPromises] = useState<PromiseRecord[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState(true);

  const onBack = propOnBack || (() => navigate(-1));

  useEffect(() => {
    if (!propTicker && symbol) {
      api.market
        .search(symbol)
        .then((res) => {
          const found = res.find((t) => t.symbol === symbol);
          if (found) {
            setTicker(found);
          } else {
            setTicker((prev) => ({
              ...prev,
              companyName: `${symbol} Corp`,
              sector: "Unknown",
            }));
          }
        })
        .catch(() => {
          setTicker((prev) => ({
            ...prev,
            companyName: `${symbol} Corp`,
            sector: "Unknown",
          }));
        });
    } else if (propTicker) {
      setTicker(propTicker);
    }
  }, [propTicker, symbol]);

  useEffect(() => {
    if (!symbol) return;

    const load = async () => {
      setLoading(true);
      try {
        const [md, n, p, c] = await Promise.all([
          api.market.getData(symbol, timeframe),
          api.narratives.getLatest(symbol),
          api.narratives.getPromises(symbol),
          api.narratives.getContradictions(symbol),
        ]);
        setMarketData(md);
        setNarrative(n as any);
        setPromises(p);
        setContradictions(c);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [symbol, timeframe]);

  if (!symbol)
    return <div className="p-8 text-center text-red-500">Invalid Symbol</div>;

  if (loading)
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors group text-sm font-bold">
        <ArrowRight
          size={18}
          className="rotate-180 group-hover:-translate-x-1 transition-transform"
        />{" "}
        Back to Monitor
      </button>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-[#212124]">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 font-black text-4xl border border-emerald-500/20 shadow-xl dark:shadow-2xl">
            {ticker.symbol[0]}
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-5xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
                {ticker.symbol}
              </h1>
              <Badge variant="success">Scanning</Badge>
            </div>
            <p className="text-xl text-slate-500 dark:text-slate-400 font-medium">
              {ticker.companyName} · {ticker.sector}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-black tracking-tighter text-slate-900 dark:text-white">
            ${marketData[marketData.length - 1]?.close.toFixed(2)}
          </div>
          <div className="text-emerald-500 dark:text-emerald-400 font-black flex items-center gap-1 justify-end text-lg">
            <TrendingUp size={22} /> +2.4%{" "}
            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal ml-1">
              (intraday)
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500">
              Order Flow Anomaly Scan
            </h3>
            <div className="flex gap-2">
              {["1M", "5M", "15M"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t as any)}
                  className="focus:outline-none">
                  <Badge
                    variant={timeframe === t ? "success" : "default"}
                    className="cursor-pointer hover:opacity-80 transition-opacity">
                    {t}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
          <div className="h-full pb-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={marketData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(150,150,150,0.1)"
                />
                <XAxis dataKey="time" hide />
                <YAxis
                  domain={["auto", "auto"]}
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#888", fontStyle: "italic" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tw-prose-invert-body)",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                  itemStyle={{ color: "#10b981" }}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-8">
          <Card className="bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20">
            <h3 className="font-bold text-[10px] uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-500 mb-6">
              Gemini Narrative Synthesis
            </h3>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 font-medium italic">
              "{narrative?.summary}"
            </p>
            <div className="mt-6 pt-6 border-t border-emerald-200 dark:border-white/10">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-2">
                <span>Exec. Confidence</span>
                <span>{narrative?.managementConfidence}/10</span>
              </div>
              <div className="flex gap-1 h-3">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${i < (narrative?.managementConfidence || 0) ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-slate-200 dark:bg-white/5"}`}
                  />
                ))}
              </div>
            </div>
          </Card>

        <Card className="border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/5 flex flex-col h-[250px]">
          <h3 className="font-bold text-[10px] uppercase tracking-[0.3em] text-rose-500 mb-6 flex items-center gap-2 flex-shrink-0">
            <AlertTriangle size={16} /> Contradiction Engine
          </h3>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-rose-300 dark:scrollbar-thumb-rose-500/50 scrollbar-track-transparent hover:scrollbar-thumb-rose-400 dark:hover:scrollbar-thumb-rose-500/70 pr-2">
            <div className="space-y-4">
              {contradictions.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-white dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
                  <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-bold">
                    {c.explanation}
                  </p>
                  <div className="mt-3 flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-rose-600 dark:text-rose-400">
                      Severity: {c.severity}
                    </span>
                    <span className="text-slate-500">
                      Detected: {new Date(c.detected_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {contradictions.length === 0 && (
                <p className="text-xs text-slate-500 text-center italic">
                  No logical drifts detected.
                </p>
              )}
            </div>
          </div>
        </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <h3 className="font-bold text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-8 flex items-center gap-2">
              <History size={18} /> Guidance Performance Ledger
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promises.map((p) => (
                <div
                  key={p.id}
                  className="p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all relative">
                  <div
                    className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl ${
                      p.status === "kept"
                        ? "bg-emerald-500 text-black"
                        : p.status === "broken"
                          ? "bg-rose-500 text-white"
                          : "bg-sky-500 text-black"
                    }`}>
                    {p.status}
                  </div>
                  <p className="text-sm font-bold mb-4 pr-10 leading-relaxed text-slate-800 dark:text-white">
                    "{p.promise_text}"
                  </p>
                  <div className="text-[10px] space-y-2 text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2 font-mono">
                      <Clock size={12} /> Issued: {p.promise_date}
                    </div>
                    <div className="flex items-center gap-2 font-mono font-bold text-slate-700 dark:text-slate-200">
                      <CheckCircle2 size={12} /> Reality:{" "}
                      {p.verification_notes}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TickerDetail;
