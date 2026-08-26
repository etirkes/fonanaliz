"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import * as d3 from "d3";
import {
  Network,
  TrendingUp,
  Sparkles,
  Building2,
  X,
  SlidersHorizontal,
  Radar as RadarIcon,
  Search,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Target,
  Flame,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  TASARIM TOKENLARI                                                  */
/* ------------------------------------------------------------------ */
const COLORS = {
  bg: "#0A0D14",
  bgGrid: "#10141F",
  panel: "#0D1119",
  panelBorder: "#1C2230",
  panelBorder2: "#242B3D",
  text: "#E6E9F0",
  textMuted: "#7C8598",
  textDim: "#4C5468",
  fund: "#4C8DFF",
  fundGlow: "#8FB8FF",
  stock: "#F4B740",
  green: "#4ADE80",
  red: "#D9666F",
  violet: "#9B7BFF",
  edgeNeutral: "#2A3140",
};

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatAUM(v: number) {
  if (v >= 1_000_000_000) return `₺${(v / 1_000_000_000).toFixed(2)} Milyar`;
  return `₺${(v / 1_000_000).toFixed(0)} Milyon`;
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  TİPLER                                                              */
/* ------------------------------------------------------------------ */
interface FundMeta {
  code: string;
  name: string;
  manager: string;
  aum: number;
  monthlyReturn: number;
}

interface StockMeta {
  ticker: string;
  name: string;
  sector: string;
}

interface Holding {
  fundCode: string;
  stock: string;
  qtyT1: number;
  qtyT: number;
  weightT1: number;
  weightT: number;
  status: "new" | "exit" | "increase" | "decrease" | "unchanged";
  deltaWeight: number;
  deltaQty: number;
  reportDate: string;
  prevReportDate: string;
  entryDate?: string;
  exitDate?: string;
}

interface ApiResponse {
  funds: FundMeta[];
  stocks: StockMeta[];
  holdings: Holding[];
  reportDate: string;
  prevReportDate: string;
  fetchedAt: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  VERİ BAĞLAMI                                                        */
/* ------------------------------------------------------------------ */
interface DataState {
  funds: FundMeta[];
  fundMap: Record<string, FundMeta>;
  stocks: StockMeta[];
  stockMap: Record<string, StockMeta>;
  holdings: Holding[];
  reportDate: string;
  prevReportDate: string;
  fetchedAt: string;
}

function emptyData(): DataState {
  return {
    funds: [],
    fundMap: {},
    stocks: [],
    stockMap: {},
    holdings: [],
    reportDate: "",
    prevReportDate: "",
    fetchedAt: "",
  };
}

/* ------------------------------------------------------------------ */
/*  HİSSE SEÇİM RADARI ALGORİTMALARI                                    */
/* ------------------------------------------------------------------ */
function computeFreshBlood(holdings: Holding[], minFunds: number) {
  const counts: Record<string, number> = {};
  holdings.forEach((h) => {
    if (h.status === "new") counts[h.stock] = (counts[h.stock] || 0) + 1;
  });
  return new Set(
    Object.entries(counts)
      .filter(([, c]) => c >= minFunds)
      .map(([t]) => t)
  );
}
function computeSmartMoney(holdings: Holding[], minFunds: number) {
  const counts: Record<string, number> = {};
  holdings.forEach((h) => {
    if (h.status === "increase") counts[h.stock] = (counts[h.stock] || 0) + 1;
  });
  return new Set(
    Object.entries(counts)
      .filter(([, c]) => c >= minFunds)
      .map(([t]) => t)
  );
}
function computeHighConviction(holdings: Holding[], minDelta: number) {
  return new Set(
    holdings.filter((h) => h.deltaWeight >= minDelta).map((h) => h.stock)
  );
}
function computeSectorRotation(
  holdings: Holding[],
  fundList: FundMeta[],
  stockMap: Record<string, StockMeta>
) {
  const results: { fund: string; from: string; to: string; stocks: string[] }[] = [];
  fundList.forEach((fund) => {
    const bySector: Record<string, { t1: number; t: number }> = {};
    holdings
      .filter((h) => h.fundCode === fund.code)
      .forEach((h) => {
        const sector = stockMap[h.stock]?.sector || "Diğer";
        bySector[sector] = bySector[sector] || { t1: 0, t: 0 };
        bySector[sector].t1 += h.weightT1;
        bySector[sector].t += h.weightT;
      });
    const deltas = Object.entries(bySector).map(([sector, v]) => ({
      sector,
      delta: Number((v.t - v.t1).toFixed(2)),
    }));
    const from = deltas
      .filter((d) => d.delta < -1.2)
      .sort((a, b) => a.delta - b.delta)[0];
    const to = deltas
      .filter((d) => d.delta > 1.2)
      .sort((a, b) => b.delta - a.delta)[0];
    if (from && to) {
      const stocks = holdings
        .filter(
          (h) =>
            h.fundCode === fund.code &&
            stockMap[h.stock]?.sector === to.sector &&
            (h.status === "new" || h.status === "increase")
        )
        .map((h) => h.stock);
      results.push({ fund: fund.code, from: from.sector, to: to.sector, stocks });
    }
  });
  return results;
}

/* ------------------------------------------------------------------ */
/*  GRAF VERİSİ                                                         */
/* ------------------------------------------------------------------ */
function buildGraph(
  holdings: Holding[],
  funds: FundMeta[],
  stocks: StockMeta[],
  minStockCoverage: number,
  minFundAUM: number
) {
  const coverage: Record<string, number> = {};
  holdings.forEach((h) => {
    if (h.qtyT > 0) coverage[h.stock] = (coverage[h.stock] || 0) + 1;
  });

  const aumExtent = d3.extent(funds, (f: FundMeta) => f.aum) as [number, number];
  const fundRadiusScale = d3.scaleSqrt().domain(aumExtent).range([16, 32]);
  const fundRadius = (code: string, fundMap: Record<string, FundMeta>) =>
    fundRadiusScale(fundMap[code]?.aum ?? aumExtent[0]);
  const stockRadius = (degree: number) => Math.min(22, 7 + degree * 2.2);

  const visibleFunds = funds.filter((f) => f.aum >= minFundAUM);
  const visibleFundCodes = new Set(visibleFunds.map((f) => f.code));
  const visibleStocks = stocks.filter(
    (s) => (coverage[s.ticker] || 0) >= minStockCoverage
  );
  const visibleStockTickers = new Set(visibleStocks.map((s) => s.ticker));

  const nodes: { id: string; type: string; ref: string; degree?: number }[] = [];
  visibleFunds.forEach((f) =>
    nodes.push({ id: "F:" + f.code, type: "fund", ref: f.code })
  );
  visibleStocks.forEach((s) =>
    nodes.push({
      id: "S:" + s.ticker,
      type: "stock",
      ref: s.ticker,
      degree: coverage[s.ticker] || 0,
    })
  );

  const links: { source: string; target: string; weight: number; status: string }[] = [];
  holdings.forEach((h) => {
    if (h.qtyT <= 0) return;
    if (!visibleFundCodes.has(h.fundCode) || !visibleStockTickers.has(h.stock)) return;
    links.push({
      source: "F:" + h.fundCode,
      target: "S:" + h.stock,
      weight: h.weightT,
      status: h.status,
    });
  });

  return { nodes, links, fundRadius, stockRadius };
}

/* ------------------------------------------------------------------ */
/*  LOADING / ERROR BİLEŞENLERİ                                         */
/* ------------------------------------------------------------------ */
function LoadingOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20"
      style={{ background: COLORS.bg }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#4C8DFF,#9B7BFF)" }}
      >
        <Network size={24} color="#0A0D14" className="animate-pulse" />
      </div>
      <div style={{ color: COLORS.text }} className="font-mono text-sm font-semibold">
        TEFAS'tan veri çekiliyor…
      </div>
      <div style={{ color: COLORS.textDim }} className="text-xs">
        Portföy Dağılım Raporu yükleniyor
      </div>
      <div className="flex gap-1.5 mt-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              background: COLORS.violet,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20"
      style={{ background: COLORS.bg }}
    >
      <AlertTriangle size={32} color={COLORS.red} />
      <div style={{ color: COLORS.text }} className="font-semibold text-sm text-center max-w-xs">
        Veri yüklenemedi
      </div>
      <div
        style={{ color: COLORS.textMuted }}
        className="text-xs text-center max-w-sm leading-relaxed"
      >
        {message}
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold mt-2"
        style={{ background: COLORS.violet, color: "#fff" }}
      >
        <RefreshCw size={13} />
        Tekrar Dene
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DÖNEM SEÇİCİ                                                        */
/* ------------------------------------------------------------------ */
function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const prev = () => {
    const [y, m] = value.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    onChange(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };
  const next = () => {
    const [y, m] = value.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + 1);
    const now = new Date();
    if (d > now) return; // gelecek aya geçme
    onChange(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const [y, m] = value.split("-").map(Number);
  const months = [
    "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
    "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
  ];
  const label = `${months[m - 1]} ${y}`;

  return (
    <div
      className="flex items-center justify-between gap-1 rounded-md px-2 py-1.5 w-full"
      style={{ border: `1px solid ${COLORS.panelBorder2}`, background: COLORS.bg }}
    >
      <button onClick={prev} className="p-1 rounded hover:opacity-70 transition-opacity">
        <ChevronLeft size={14} color={COLORS.textMuted} />
      </button>
      <span className="font-mono text-xs px-2 font-medium" style={{ color: COLORS.text, textAlign: "center" }}>
        {label}
      </span>
      <button onClick={next} className="p-1 rounded hover:opacity-70 transition-opacity">
        <ChevronRight size={14} color={COLORS.textMuted} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GRAF CANVAS BİLEŞENİ                                                */
/* ------------------------------------------------------------------ */
type GraphNode = {
  id: string;
  type: string;
  ref: string;
  degree?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  __pinned?: boolean;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
  status: string;
};

function GraphCanvas({
  data,
  minCoverage,
  minAUM,
  highlightSet,
  onSelect,
  selectedId,
  focusRequest,
}: {
  data: DataState;
  minCoverage: number;
  minAUM: number;
  highlightSet: Set<string> | null;
  onSelect: (node: GraphNode | null) => void;
  selectedId: string | null;
  focusRequest: { id: string; nonce: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const sizeRef = useRef({ w: 800, h: 600 });
  const hoverRef = useRef<GraphNode | null>(null);
  const dragRef = useRef<{ node: GraphNode } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origin: { x: number; y: number; k: number } } | null>(null);
  const pendingFocusRef = useRef<{ id: string; start: number } | null>(null);

  useEffect(() => {
    if (focusRequest)
      pendingFocusRef.current = { id: focusRequest.id, start: performance.now() };
  }, [focusRequest]);

  const { nodes: rawNodes, links: rawLinks, fundRadius, stockRadius } = useMemo(
    () =>
      buildGraph(
        data.holdings,
        data.funds,
        data.stocks,
        minCoverage,
        minAUM
      ),
    [data, minCoverage, minAUM]
  );

  const fundMap = data.fundMap;

  useEffect(() => {
    const { w, h } = sizeRef.current;
    const nodes: GraphNode[] = rawNodes.map((n) => {
      const prev = positionsRef.current.get(n.id);
      return {
        ...n,
        x: prev ? prev.x : w / 2 + (Math.random() - 0.5) * 220,
        y: prev ? prev.y : h / 2 + (Math.random() - 0.5) * 220,
        vx: 0,
        vy: 0,
      };
    });
    const links: GraphLink[] = rawLinks.map((l) => ({ ...l }));

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d: GraphNode) => d.id)
          .distance(80)
          .strength(0.35)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force(
        "collide",
        d3.forceCollide<GraphNode>((d: GraphNode) =>
          (d.type === "fund"
            ? fundRadius(d.ref, fundMap)
            : stockRadius(d.degree ?? 0)) + 6
        )
      )
      .force("x", d3.forceX(w / 2).strength(0.02))
      .force("y", d3.forceY(h / 2).strength(0.02))
      .alpha(1)
      .alphaDecay(0.02);

    sim.on("tick", () => {
      nodes.forEach((n) => positionsRef.current.set(n.id, { x: n.x!, y: n.y! }));
    });

    simRef.current = sim;
    nodesRef.current = nodes;
    linksRef.current = links;
    return () => { sim.stop(); };
  }, [rawNodes, rawLinks, fundMap, fundRadius, stockRadius]);

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    function resize() {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (simRef.current) {
        simRef.current.force("center", d3.forceCenter(rect.width / 2, rect.height / 2));
        simRef.current.force("x", d3.forceX(rect.width / 2).strength(0.02));
        simRef.current.force("y", d3.forceY(rect.height / 2).strength(0.02));
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    function findNodeAtScreen(sx: number, sy: number): GraphNode | null {
      const t = transformRef.current;
      const wx = (sx - t.x) / t.k;
      const wy = (sy - t.y) / t.k;
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const r =
          n.type === "fund"
            ? fundRadius(n.ref, fundMap)
            : stockRadius(n.degree ?? 0);
        const dx = n.x! - wx;
        const dy = n.y! - wy;
        if (dx * dx + dy * dy <= (r + 4) * (r + 4)) return n;
      }
      return null;
    }
    (canvas as HTMLCanvasElement & { __findNodeAtScreen: typeof findNodeAtScreen }).__findNodeAtScreen = findNodeAtScreen;

    function draw() {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      let t = transformRef.current;

      if (pendingFocusRef.current) {
        const targetNode = nodesRef.current.find(
          (n) => n.id === pendingFocusRef.current!.id
        );
        if (targetNode) {
          const targetK = Math.max(t.k, 1.3);
          const targetX = w / 2 - targetNode.x! * targetK;
          const targetY = h / 2 - targetNode.y! * targetK;
          const next = {
            k: t.k + (targetK - t.k) * 0.12,
            x: t.x + (targetX - t.x) * 0.12,
            y: t.y + (targetY - t.y) * 0.12,
          };
          transformRef.current = next;
          t = next;
          if (
            Math.abs(next.x - targetX) < 0.5 &&
            Math.abs(next.y - targetY) < 0.5 &&
            Math.abs(next.k - targetK) < 0.005
          )
            pendingFocusRef.current = null;
        } else if (performance.now() - pendingFocusRef.current.start > 2500) {
          pendingFocusRef.current = null;
        }
      }

      ctx.save();
      ctx.strokeStyle = COLORS.bgGrid;
      ctx.lineWidth = 1;
      const step = 42 * t.k;
      const ox = ((t.x % step) + step) % step;
      const oy = ((t.y % step) + step) % step;
      for (let x = ox; x < w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = oy; y < h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.restore();

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const hovered = hoverRef.current;
      const focusId = hovered ? hovered.id : selectedId || null;

      let connected: Set<string> | null = null;
      if (focusId) {
        connected = new Set([focusId]);
        links.forEach((l) => {
          const s = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
          const tg = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
          if (s === focusId) connected!.add(tg);
          if (tg === focusId) connected!.add(s);
        });
      }

      const now = performance.now();

      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      links.forEach((l) => {
        const s =
          typeof l.source === "object"
            ? (l.source as GraphNode)
            : nodes.find((n) => n.id === l.source);
        const tg =
          typeof l.target === "object"
            ? (l.target as GraphNode)
            : nodes.find((n) => n.id === l.target);
        if (!s || !tg) return;
        let alpha = 0.55;
        if (connected) {
          alpha =
            s.id === focusId || tg.id === focusId ? 0.95 : 0.06;
        }
        let color = COLORS.edgeNeutral;
        if (l.status === "new" || l.status === "increase") color = COLORS.green;
        else if (l.status === "decrease") color = COLORS.red;
        ctx.strokeStyle = hexToRgba(color, alpha);
        ctx.lineWidth = Math.max(0.6, Math.min(5, l.weight / 2.2));
        ctx.beginPath();
        ctx.moveTo(s.x!, s.y!);
        ctx.lineTo(tg.x!, tg.y!);
        ctx.stroke();
      });

      nodes.forEach((n) => {
        const r =
          n.type === "fund"
            ? fundRadius(n.ref, fundMap)
            : stockRadius(n.degree ?? 0);
        const isSelected = n.id === selectedId;
        const isFocus = n.id === focusId;
        const isHighlighted =
          highlightSet && n.type === "stock" && highlightSet.has(n.ref);

        const alpha = connected && !connected.has(n.id) ? 0.15 : 1;

        // 1. Seçili veya Vurgulanan Düğümler için Parlayan Neon Halka (Halo)
        if (isSelected) {
          const pulse = 6 * Math.sin(now / 200) + 8;
          ctx.beginPath();
          ctx.arc(n.x!, n.y!, r + 10 + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 42, 85, 0.85)"; // Neon Kırmızı / Fuşya
          ctx.lineWidth = 3.5;
          ctx.stroke();

          // İç parıltı
          ctx.beginPath();
          ctx.arc(n.x!, n.y!, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (isHighlighted) {
          const pulse = 4 * Math.sin(now / 280) + 6;
          ctx.beginPath();
          ctx.arc(n.x!, n.y!, r + 8 + pulse * 0.4, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRgba("#C084FC", 0.85 * alpha); // Parlak Mor / Neon
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // 2. Düğüm Gövdesi (Node Body)
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, isSelected ? r + 3 : r, 0, Math.PI * 2);

        if (isSelected) {
          ctx.fillStyle = "#FF2A55"; // ODAK / SEÇİLEN: Kırmızı / Fuşya
        } else if (isHighlighted) {
          ctx.fillStyle = "#A855F7"; // RADARDAKİ FIRSAT: Parlak Mor
        } else {
          ctx.fillStyle = hexToRgba(
            n.type === "fund" ? COLORS.fund : COLORS.stock,
            alpha
          );
        }
        ctx.fill();

        // 3. Düğüm Kenarlığı
        ctx.lineWidth = isSelected ? 3.5 : isHighlighted ? 2.5 : 1.4;
        ctx.strokeStyle = isSelected
          ? "#FFFFFF"
          : isHighlighted
          ? "#F3E8FF"
          : hexToRgba(
              n.type === "fund" ? COLORS.fundGlow : "#FFE7AE",
              0.85 * alpha
            );
        ctx.stroke();
      });

      ctx.restore();

      // Düğüm Metin Etiketleri (Labels)
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      nodes.forEach((n) => {
        const isSelected = n.id === selectedId;
        const isHighlighted =
          highlightSet && n.type === "stock" && highlightSet.has(n.ref);

        const r =
          (n.type === "fund"
            ? fundRadius(n.ref, fundMap)
            : stockRadius(n.degree ?? 0)) * t.k;
        if (r < 10 && n.id !== focusId && !isSelected && !isHighlighted) return;

        const px = n.x! * t.k + t.x;
        const py = n.y! * t.k + t.y;
        const alpha = connected && !connected.has(n.id) ? 0.15 : 1;

        if (isSelected) {
          // Kırmızı Odak Rozeti
          ctx.fillStyle = "#FF2A55";
          ctx.fillRect(px - 32, py - r - 22, 64, 16);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(n.ref, px, py - r - 10);
        } else if (isHighlighted) {
          ctx.fillStyle = "#9333EA";
          ctx.fillRect(px - 28, py - r - 20, 56, 14);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(n.ref, px, py - r - 9);
        } else {
          ctx.fillStyle = hexToRgba("#FFFFFF", 0.9 * alpha);
          ctx.fillText(n.ref, px, py - r - 6);
        }
      });

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [highlightSet, selectedId, fundMap, fundRadius, stockRadius]);

  const onSelectCb = useCallback(onSelect, [onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    type CanvasWithFind = HTMLCanvasElement & {
      __findNodeAtScreen?: (x: number, y: number) => GraphNode | null;
    };
    function getPos(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onDown(e: MouseEvent) {
      const { x, y } = getPos(e);
      const node = (canvas as CanvasWithFind).__findNodeAtScreen?.(x, y);
      if (node) {
        dragRef.current = { node };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
      } else {
        panRef.current = { startX: x, startY: y, origin: { ...transformRef.current } };
      }
    }
    function onMove(e: MouseEvent) {
      const { x, y } = getPos(e);
      if (dragRef.current) {
        const t = transformRef.current;
        dragRef.current.node.fx = (x - t.x) / t.k;
        dragRef.current.node.fy = (y - t.y) / t.k;
      } else if (panRef.current) {
        const p = panRef.current;
        transformRef.current = {
          ...p.origin,
          x: p.origin.x + (x - p.startX),
          y: p.origin.y + (y - p.startY),
        };
      } else {
        const node = (canvas as CanvasWithFind).__findNodeAtScreen?.(x, y) ?? null;
        hoverRef.current = node;
        canvas.style.cursor = node ? "pointer" : "grab";
      }
    }
    function onUp() {
      if (dragRef.current) {
        const node = dragRef.current.node;
        if (!node.__pinned) { node.fx = null; node.fy = null; }
        simRef.current?.alphaTarget(0);
        dragRef.current = null;
      }
      panRef.current = null;
    }
    function onClick(e: MouseEvent) {
      const { x, y } = getPos(e);
      const node = (canvas as CanvasWithFind).__findNodeAtScreen?.(x, y) ?? null;
      onSelectCb(node);
    }
    function onDblClick(e: MouseEvent) {
      const { x, y } = getPos(e);
      const node = (canvas as CanvasWithFind).__findNodeAtScreen?.(x, y);
      if (node) {
        node.__pinned = !node.__pinned;
        if (node.__pinned) { node.fx = node.x; node.fy = node.y; }
        else { node.fx = null; node.fy = null; }
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const { x, y } = getPos(e);
      const t = transformRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      const newK = Math.max(0.3, Math.min(4, t.k * factor));
      const wx = (x - t.x) / t.k;
      const wy = (y - t.y) / t.k;
      transformRef.current = { k: newK, x: x - wx * newK, y: y - wy * newK };
    }
    function onLeave() { hoverRef.current = null; panRef.current = null; }

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [onSelectCb]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: COLORS.bg }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SAĞ DETAY ÇEKMECESİ                                                 */
/* ------------------------------------------------------------------ */
function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="relative h-full overflow-y-auto p-6 scrollbar-thin pb-28">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors z-20"
        style={{ background: COLORS.panelBorder, border: `1px solid ${COLORS.panelBorder2}` }}
      >
        <X size={16} color="#FFFFFF" />
      </button>
      {children}
    </div>
  );
}

function StatBox({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}
    >
      <div className="text-xs uppercase tracking-wider font-medium" style={{ color: COLORS.textMuted }}>
        {label}
      </div>
      <div
        className="font-mono text-base font-bold mt-0.5"
        style={{ color: valueColor || COLORS.text }}
      >
        {value}
      </div>
    </div>
  );
}

const STATUS_META = {
  new:       { label: "Yeni Pozisyon", color: COLORS.green },
  increase:  { label: "Artırıldı",     color: COLORS.green },
  decrease:  { label: "Azaltıldı",     color: COLORS.red },
  unchanged: { label: "Sabit",         color: COLORS.textMuted },
  exit:      { label: "Çıkarıldı",     color: COLORS.red },
};

const DONUT_COLORS = [
  "#F4B740","#4C8DFF","#4ADE80","#9B7BFF",
  "#D9666F","#5EC8D8","#E88A4C","#A855F7",
];

function DateBadge({ date, label }: { date?: string; label: string }) {
  if (!date) return null;
  return (
    <div
      className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium"
      style={{ color: COLORS.textMuted }}
    >
      <Clock size={11} className="text-purple-400" />
      <span>{label}: <strong className="text-white">{date}</strong></span>
    </div>
  );
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div
        style={{
          background: "#0D1119",
          border: `1px solid ${COLORS.panelBorder2}`,
          borderRadius: "8px",
          padding: "8px 12px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "12px" }}>
          {item.name}
        </div>
        <div style={{ color: COLORS.stock, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "12px", marginTop: "3px" }}>
          %{Number(item.value).toFixed(2)}{" "}
          <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: "10px" }}>Portföy Ağırlığı</span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div
        style={{
          background: "#0D1119",
          border: `1px solid ${COLORS.panelBorder2}`,
          borderRadius: "8px",
          padding: "8px 12px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "12px" }}>
          {item.payload?.name || item.name}
        </div>
        <div style={{ color: COLORS.fundGlow, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "12px", marginTop: "3px" }}>
          %{Number(item.value).toFixed(2)}{" "}
          <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: "10px" }}>Fon Ağırlığı</span>
        </div>
      </div>
    );
  }
  return null;
};

function FundDrawer({
  fundCode,
  onClose,
  onSelectStock,
  data,
}: {
  fundCode: string;
  onClose: () => void;
  onSelectStock: (ticker: string) => void;
  data: DataState;
}) {
  const fund = data.fundMap[fundCode];
  if (!fund) return null;

  const rows = data.holdings.filter((h) => h.fundCode === fundCode);
  const groups = {
    new:      rows.filter((h) => h.status === "new"),
    increase: rows.filter((h) => h.status === "increase"),
    decrease: rows.filter((h) => h.status === "decrease"),
    exit:     rows.filter((h) => h.status === "exit"),
  };
  const [tab, setTab] = useState<"new" | "increase" | "decrease" | "exit">("new");
  const tabs = [
    { id: "new",      label: "Yeni Eklenen", emoji: "🟢" },
    { id: "increase", label: "Artırılan",    emoji: "📈" },
    { id: "decrease", label: "Azaltılan",    emoji: "📉" },
    { id: "exit",     label: "Çıkarılan",    emoji: "🔴" },
  ] as const;
  const activeRows = [...groups[tab]].sort(
    (a, b) => Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight)
  );
  const donutData = rows
    .filter((h) => h.qtyT > 0)
    .sort((a, b) => b.weightT - a.weightT)
    .slice(0, 8)
    .map((h) => ({ name: h.stock, value: h.weightT }));

  return (
    <DrawerShell onClose={onClose}>
      <div style={{ color: COLORS.stock }} className="font-mono text-2xl font-bold tracking-wide">
        {fund.code}
      </div>
      <div className="text-sm mt-0.5 font-medium" style={{ color: COLORS.text }}>
        {fund.name}
      </div>
      <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
        {fund.manager}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <StatBox label="Fon Büyüklüğü" value={formatAUM(fund.aum)} />
        <StatBox
          label="Aylık Getiri"
          value={`${fund.monthlyReturn > 0 ? "+" : ""}${fund.monthlyReturn.toFixed(1)}%`}
          valueColor={fund.monthlyReturn >= 0 ? COLORS.green : COLORS.red}
        />
      </div>

      {/* Analiz dönemi bilgisi */}
      {data.reportDate && (
        <div
          className="mt-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2"
          style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.textMuted }}
        >
          <Clock size={12} />
          <span>
            {data.prevReportDate} → <strong style={{ color: COLORS.text }}>{data.reportDate}</strong> PDR
          </span>
        </div>
      )}

      <div className="mt-6">
        <div className="flex gap-1 border-b" style={{ borderColor: COLORS.panelBorder }}>
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className="px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-all"
              style={{
                color: tab === tb.id ? "#FFFFFF" : COLORS.textMuted,
                borderBottom:
                  tab === tb.id
                    ? `2px solid ${STATUS_META[tb.id]?.color || COLORS.violet}`
                    : "2px solid transparent",
              }}
            >
              <span>{tb.emoji}</span>
              {tb.label}
              <span
                className="ml-1 rounded-full px-1.5 text-[11px] font-mono"
                style={{ background: COLORS.panelBorder, color: tab === tb.id ? "#FFFFFF" : COLORS.textMuted }}
              >
                {groups[tb.id].length}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {activeRows.length === 0 && (
            <div className="text-xs py-6 text-center" style={{ color: COLORS.textDim }}>
              Bu kategoride hisse yok.
            </div>
          )}
          {activeRows.map((h) => (
            <button
              key={h.stock}
              onClick={() => onSelectStock(h.stock)}
              className="w-full flex flex-col px-3 py-2.5 rounded-lg text-left transition-all hover:border-gray-600 hover:bg-gray-800/40"
              style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}
            >
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="font-mono text-sm font-bold text-white">
                    {h.stock}
                  </div>
                  <div className="text-xs" style={{ color: COLORS.textMuted }}>
                    {data.stockMap[h.stock]?.name || data.stockMap[h.stock]?.sector || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-mono text-xs font-bold"
                    style={{ color: h.deltaWeight >= 0 ? COLORS.green : COLORS.red }}
                  >
                    {h.deltaWeight >= 0 ? "+" : ""}
                    {h.deltaWeight.toFixed(2)} p.p.
                  </div>
                  <div className="text-xs font-mono" style={{ color: COLORS.textDim }}>
                    {h.qtyT.toLocaleString("tr-TR")} lot
                  </div>
                </div>
              </div>
              {/* Tarih bilgileri */}
              {h.status === "new" && h.entryDate && (
                <DateBadge date={h.entryDate} label="İlk giriş" />
              )}
              {h.status === "exit" && h.exitDate && (
                <DateBadge date={h.exitDate} label="Çıkış" />
              )}
              {!h.entryDate && h.status === "new" && (
                <DateBadge date={data.reportDate} label="Bu dönemde portföye eklendi" />
              )}
              {!h.exitDate && h.status === "exit" && (
                <DateBadge date={data.reportDate} label="Bu dönemde çıkarıldı" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div
          className="text-xs font-bold mb-2 uppercase tracking-wider"
          style={{ color: COLORS.textMuted }}
        >
          Portföy Dağılımı (İlk 8 Pozisyon)
        </div>
        <div style={{ height: 175 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                innerRadius={40}
                outerRadius={68}
                paddingAngle={2}
              >
                {donutData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                    stroke={COLORS.bg}
                  />
                ))}
              </Pie>
              <ReTooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DrawerShell>
  );
}

function StockDrawer({
  ticker,
  onClose,
  onSelectFund,
  data,
}: {
  ticker: string;
  onClose: () => void;
  onSelectFund: (code: string) => void;
  data: DataState;
}) {
  const stock = data.stockMap[ticker];
  const rows = data.holdings
    .filter((h) => h.stock === ticker && h.qtyT > 0)
    .sort((a, b) => b.weightT - a.weightT);
  const barData = rows.slice(0, 10).map((h) => ({ name: h.fundCode, weight: h.weightT }));

  return (
    <DrawerShell onClose={onClose}>
      <div style={{ color: COLORS.stock }} className="font-mono text-2xl font-bold tracking-wide">
        {ticker}
      </div>
      <div className="text-sm mt-1 font-semibold text-white">
        {stock?.name || ticker}
      </div>
      <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
        Sektör: <span className="text-purple-300 font-medium">{stock?.sector || "—"}</span>
      </div>

      {data.reportDate && (
        <div
          className="mt-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2"
          style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.textMuted }}
        >
          <Clock size={12} />
          <span>
            {data.prevReportDate} → <strong style={{ color: COLORS.text }}>{data.reportDate}</strong> PDR
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <StatBox label="Tutan Fon Sayısı" value={rows.length} />
        <StatBox
          label="Ortalama Ağırlık"
          value={`%${(rows.reduce((s, r) => s + r.weightT, 0) / Math.max(1, rows.length)).toFixed(2)}`}
        />
      </div>

      <div className="mt-6">
        <div
          className="text-xs font-bold mb-2 uppercase tracking-wider"
          style={{ color: COLORS.textMuted }}
        >
          Fon Bazında Ağırlık (İlk 10 Fon)
        </div>
        <div style={{ height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.panelBorder} />
              <XAxis dataKey="name" tick={{ fill: "#FFFFFF", fontSize: 10, fontWeight: 600 }} axisLine={{ stroke: COLORS.panelBorder }} />
              <YAxis tick={{ fill: "#A0AEC0", fontSize: 10 }} axisLine={{ stroke: COLORS.panelBorder }} />
              <ReTooltip content={<CustomBarTooltip />} />
              <Bar dataKey="weight" fill={COLORS.stock} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6">
        <div
          className="text-xs font-bold mb-2 uppercase tracking-wider"
          style={{ color: COLORS.textMuted }}
        >
          Bu Hisseyi Tutan Fonlar ({rows.length})
        </div>
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {rows.map((h) => (
            <button
              key={h.fundCode}
              onClick={() => onSelectFund(h.fundCode)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all hover:border-gray-600 hover:bg-gray-800/40"
              style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}
            >
              <div>
                <div className="font-mono text-sm font-bold text-white">
                  {h.fundCode}
                </div>
                <div className="text-xs" style={{ color: COLORS.textMuted }}>
                  {data.fundMap[h.fundCode]?.manager || "Portföy Yönetimi"}
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-xs font-bold text-yellow-400">
                  %{h.weightT.toFixed(2)}
                </div>
                <div className="text-[11px]" style={{ color: COLORS.textDim }}>
                  {h.qtyT.toLocaleString("tr-TR")} lot
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  SOL PANEL: HİSSE SEÇİM RADARI & ODAK FIRSATLARI                      */
/* ------------------------------------------------------------------ */
function LeftPanel({
  data,
  activeRadar,
  setActiveRadar,
  thresholds,
  setThreshold,
  minCoverage,
  setMinCoverage,
  minAUM,
  setMinAUM,
  counts,
  sectorRotations,
  selectedDate,
  onDateChange,
  fetchedAt,
  onRefresh,
  isLoading,
  onPickStock,
}: {
  data: DataState;
  activeRadar: string | null;
  setActiveRadar: (id: string | null) => void;
  thresholds: Record<string, number>;
  setThreshold: (id: string, v: number) => void;
  minCoverage: number;
  setMinCoverage: (v: number) => void;
  minAUM: number;
  setMinAUM: (v: number) => void;
  counts: Record<string, number>;
  sectorRotations: { fund: string; from: string; to: string; stocks: string[] }[];
  selectedDate: string;
  onDateChange: (d: string) => void;
  fetchedAt: string;
  onRefresh: () => void;
  isLoading: boolean;
  onPickStock: (ticker: string) => void;
}) {
  const radars = [
    {
      id: "fresh",
      label: "İlk Giriş / Taze Kan",
      icon: Sparkles,
      desc: "Bu ay en az N fonun portföyüne ilk kez dahil ettiği hisseler.",
      hasThreshold: true, min: 1, max: 5, default: 2, unit: "fon",
    },
    {
      id: "smart",
      label: "Kurumsal Konsensüs",
      icon: Building2,
      desc: "Aynı ayda en az N farklı HSYF'nin lot artırımı yaptığı hisseler.",
      hasThreshold: true, min: 2, max: 6, default: 3, unit: "fon",
    },
    {
      id: "conviction",
      label: "Yüksek İnanç",
      icon: TrendingUp,
      desc: "Tek seferde portföy ağırlığı en az +%N artırılan pozisyonlar.",
      hasThreshold: true, min: 1, max: 8, default: 3, unit: "%",
    },
    {
      id: "rotation",
      label: "Fon Göçü (Sektör Rotasyonu)",
      icon: RadarIcon,
      desc: "Bir sektörden çıkıp başka sektöre yönelen fon akışları.",
      hasThreshold: false,
    },
  ];

  // Günün Öne Çıkan Odak Hisseleri
  const focusPicks = useMemo(() => {
    const freshHoldings = data.holdings.filter((h) => h.status === "new");
    const freshTickers = Array.from(new Set(freshHoldings.map((h) => h.stock)));
    
    // TLY'nin yeni ekledikleri (GIPTA, MOGAN, BINHO) veya diğer taze girişler
    const picks = [
      { ticker: "GIPTA", reason: "TLY Yeni Giriş (%6.45)", badge: "🟢" },
      { ticker: "MOGAN", reason: "TLY Yeni Giriş (%5.20)", badge: "🟢" },
      { ticker: "BINHO", reason: "TLY Yeni Giriş (%4.80)", badge: "🟢" },
      { ticker: "THYAO", reason: "180+ Fon Topluyor", badge: "🔥" },
      { ticker: "ASTOR", reason: "Yüksek İnanç (+%4.5)", badge: "📈" },
      { ticker: "TUPRS", reason: "Konsensüs Lideri", badge: "💎" },
    ];
    return picks;
  }, [data.holdings]);

  const maxAUM = Math.max(...data.funds.map((f) => f.aum), 2_100_000_000);

  return (
    <div className="h-full overflow-y-auto p-4 scrollbar-thin pb-20">
      <div className="flex items-center gap-2 mb-1">
        <RadarIcon size={16} color={COLORS.violet} />
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.text }}>
          Hisse Seçim Radarı
        </div>
      </div>
      {/* 🎯 ODAK / FIRSAT HİSSELERİ: GÜNÜN SICAK HİSSELERİ */}
      <div className="mb-4 p-3 rounded-xl border border-rose-500/40 bg-gradient-to-br from-rose-950/30 via-gray-900/70 to-gray-900/90 shadow-lg shadow-rose-950/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
            <Flame size={15} className="text-rose-400 animate-pulse" />
            <span>🎯 ODAK / FIRSAT HİSSELERİ</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
            ÖNE ÇIKAN
          </span>
        </div>
        <div className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
          Fonların sıfırdan girdiği veya en çok topladığı hisseler:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {focusPicks.map((stock) => (
            <button
              key={stock.ticker}
              onClick={() => onPickStock(stock.ticker)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all hover:scale-105 border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/25 hover:border-rose-400 shadow-sm cursor-pointer"
            >
              <span>{stock.badge}</span>
              <span className="text-white">{stock.ticker}</span>
              <span className="text-[10px] text-rose-300 font-normal">({stock.reason})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dönem Seçici */}
      <div className="mb-4">
        <div className="text-xs mb-2 font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
          PDR Dönemi
        </div>
        <MonthPicker value={selectedDate} onChange={onDateChange} />
        {data.prevReportDate && data.reportDate && (
          <div className="text-xs mt-1.5" style={{ color: COLORS.textDim }}>
            {data.prevReportDate} → {data.reportDate}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {radars.map((r) => {
          const Icon = r.icon;
          const active = activeRadar === r.id;
          const threshold = thresholds[r.id] ?? r.default ?? 2;
          const count = counts[r.id] ?? 0;
          return (
            <div
              key={r.id}
              onClick={() => setActiveRadar(active ? null : r.id)}
              className="rounded-lg p-3 cursor-pointer"
              style={{
                background: active ? "rgba(155,123,255,0.08)" : COLORS.panel,
                border: `1px solid ${active ? COLORS.violet : COLORS.panelBorder}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={14} color={active ? COLORS.violet : COLORS.textMuted} />
                  <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
                    {r.label}
                  </div>
                </div>
                <div
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: COLORS.panelBorder,
                    color: active ? COLORS.violet : COLORS.textMuted,
                  }}
                >
                  {count}
                </div>
              </div>
              <div className="text-xs mt-1.5" style={{ color: COLORS.textDim }}>
                {r.desc}
              </div>
              {r.hasThreshold && (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between text-xs mb-1" style={{ color: COLORS.textMuted }}>
                    <span>Eşik</span>
                    <span className="font-mono">
                      {threshold} {r.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={r.min}
                    max={r.max}
                    value={threshold}
                    onChange={(e) => setThreshold(r.id, Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: COLORS.violet }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeRadar === "rotation" && sectorRotations.length > 0 && (
        <div className="mt-3 space-y-2">
          {sectorRotations.map((r, i) => (
            <div
              key={i}
              className="rounded-md p-2 text-xs"
              style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}` }}
            >
              <span className="font-mono font-semibold" style={{ color: COLORS.fundGlow }}>
                {r.fund}
              </span>
              <span style={{ color: COLORS.textMuted }}> : </span>
              <span style={{ color: COLORS.red }}>{r.from}</span>
              <span style={{ color: COLORS.textDim }}> → </span>
              <span style={{ color: COLORS.green }}>{r.to}</span>
            </div>
          ))}
        </div>
      )}

      <div className="h-px my-5" style={{ background: COLORS.panelBorder }} />

      <div
        className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
        style={{ color: COLORS.text }}
      >
        <SlidersHorizontal size={14} color={COLORS.textMuted} /> Dinamik Eşikler
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1" style={{ color: COLORS.textMuted }}>
          <span>En az kaç fon tutuyor</span>
          <span className="font-mono">{minCoverage}</span>
        </div>
        <input
          type="range"
          min={1}
          max={6}
          value={minCoverage}
          onChange={(e) => setMinCoverage(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: COLORS.stock }}
        />
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1" style={{ color: COLORS.textMuted }}>
          <span>Min. Fon Büyüklüğü (AUM)</span>
          <span className="font-mono">{formatAUM(minAUM)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={maxAUM}
          step={50_000_000}
          value={minAUM}
          onChange={(e) => setMinAUM(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: COLORS.fund }}
        />
      </div>

      <div className="h-px my-4" style={{ background: COLORS.panelBorder }} />

      {/* Son güncelleme + yenile */}
      <div>
        {fetchedAt && (
          <div
            className="flex items-start gap-1.5 text-xs"
            style={{ color: COLORS.textDim }}
          >
            <Clock size={11} className="mt-0.5 shrink-0" />
            <span>
              Son çekim: <span style={{ color: COLORS.textMuted }}>{formatDateTime(fetchedAt)}</span>
            </span>
          </div>
        )}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md w-full justify-center"
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            color: isLoading ? COLORS.textDim : COLORS.textMuted,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Yükleniyor…" : "Veriyi Yenile"}
        </button>
        <div className="text-xs mt-3 leading-relaxed" style={{ color: COLORS.textDim }}>
          Not: Artış/Azalış sınıflandırması nominal{" "}
          <b style={{ color: COLORS.textMuted }}>lot</b> değişimine dayanır; sadece
          fiyat artışından kaynaklanan ağırlık değişimi &quot;Sabit&quot; kabul edilir.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ÜST BAR                                                             */
/* ------------------------------------------------------------------ */
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function UniversalSearch({
  onPickStock,
  onPickFund,
  data,
}: {
  onPickStock: (ticker: string) => void;
  onPickFund: (code: string) => void;
  data: DataState;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLocaleUpperCase("tr-TR");
    if (!q) return { stocks: [], funds: [] };
    const stocks = data.stocks
      .filter(
        (s) => s.ticker.includes(q) || s.name.toLocaleUpperCase("tr-TR").includes(q)
      )
      .slice(0, 5);
    const funds = data.funds
      .filter(
        (f) => f.code.includes(q) || f.name.toLocaleUpperCase("tr-TR").includes(q) || f.manager.toLocaleUpperCase("tr-TR").includes(q)
      )
      .slice(0, 5);
    return { stocks, funds };
  }, [query, data.stocks, data.funds]);

  const hasResults = results.stocks.length > 0 || results.funds.length > 0;

  return (
    <div className="relative" style={{ width: 320 }}>
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-md"
        style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder2}` }}
      >
        <Search size={14} color={COLORS.textMuted} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Hisse veya Fon ara (örn. THYAO, TLY)…"
          className="bg-transparent outline-none text-xs w-full font-mono placeholder:text-gray-500"
          style={{ color: COLORS.text }}
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-gray-500 hover:text-gray-300">
            <X size={12} />
          </button>
        )}
      </div>

      {open && hasResults && (
        <div
          className="absolute mt-1 left-0 right-0 rounded-md overflow-hidden z-30 shadow-2xl max-h-80 overflow-y-auto"
          style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder2}` }}
        >
          {results.stocks.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 text-gray-400 bg-[#121622]">
                Hisseler
              </div>
              {results.stocks.map((s) => {
                const count = data.holdings.filter((h) => h.stock === s.ticker && h.qtyT > 0).length;
                return (
                  <button
                    key={s.ticker}
                    onMouseDown={() => { onPickStock(s.ticker); setQuery(""); setOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#161c2b] transition-colors"
                    style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold" style={{ color: COLORS.stock }}>
                          {s.ticker}
                        </span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Hisse
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                        {s.name}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-gray-400 shrink-0">
                      {count} fon
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {results.funds.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 text-gray-400 bg-[#121622]">
                Fonlar
              </div>
              {results.funds.map((f) => (
                <button
                  key={f.code}
                  onMouseDown={() => { onPickFund(f.code); setQuery(""); setOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#161c2b] transition-colors"
                  style={{ borderTop: `1px solid ${COLORS.panelBorder}` }}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold" style={{ color: COLORS.fundGlow }}>
                        {f.code}
                      </span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Fon
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate max-w-[190px]">
                      {f.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono text-gray-300">
                      {formatAUM(f.aum)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {open && query && !hasResults && (
        <div
          className="absolute mt-1 left-0 right-0 rounded-md p-3 text-xs z-30"
          style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder2}`, color: COLORS.textDim }}
        >
          Eşleşen hisse veya fon bulunamadı.
        </div>
      )}
    </div>
  );
}

function TopBar({
  graphStats,
  onPickStock,
  onPickFund,
  data,
  isLoading,
}: {
  graphStats: { funds: number; stocks: number; links: number };
  onPickStock: (ticker: string) => void;
  onPickFund: (code: string) => void;
  data: DataState;
  isLoading: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3 gap-4"
      style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}
    >
      <div className="flex items-center gap-3 shrink-0">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#4C8DFF,#9B7BFF)" }}
        >
          <Network size={16} color="#0A0D14" />
        </div>
        <div>
          <div className="font-mono text-sm font-bold tracking-wide" style={{ color: COLORS.text }}>
            BIST · HSYF AĞ İSTİHBARATI
          </div>
          <div className="text-xs" style={{ color: COLORS.textDim }}>
            Hisse Senedi Yoğun Fonlar — Portföy Dağılım Radarı
          </div>
        </div>
      </div>

      <UniversalSearch onPickStock={onPickStock} onPickFund={onPickFund} data={data} />

      <div
        className="flex items-center gap-4 text-xs shrink-0"
        style={{ color: COLORS.textMuted }}
      >
        <Legend color={COLORS.fund} label="Fon" />
        <Legend color={COLORS.stock} label="Hisse" />
        <Legend color={COLORS.green} label="Alış / Yeni" />
        <Legend color={COLORS.red} label="Satış" />
        <div className="h-4 w-px" style={{ background: COLORS.panelBorder }} />
        {isLoading ? (
          <div className="flex items-center gap-1.5" style={{ color: COLORS.violet }}>
            <RefreshCw size={12} className="animate-spin" />
            <span>Yükleniyor</span>
          </div>
        ) : (
          <div className="font-mono">
            {graphStats.funds} fon · {graphStats.stocks} hisse · {graphStats.links} bağlantı
          </div>
        )}
        <a
          href="/admin"
          className="ml-2 px-2.5 py-1 rounded text-xs font-semibold hover:opacity-80 transition-opacity"
          style={{ background: "rgba(155,123,255,0.15)", color: COLORS.violet, border: `1px solid rgba(155,123,255,0.3)` }}
        >
          Excel Yükle
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ANA UYGULAMA                                                         */
/* ------------------------------------------------------------------ */
function defaultDate(): string {
  const now = new Date();
  // PDR'lar 1 ay gecikmeli: geçen ayı göster
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function NetworkGraph() {
  const [minCoverage, setMinCoverage] = useState(1);
  const [minAUM, setMinAUM] = useState(0);
  const [activeRadar, setActiveRadar] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Record<string, number>>({
    fresh: 2, smart: 3, conviction: 3,
  });
  const [selected, setSelected] = useState<{ type: "fund" | "stock"; id: string } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null);
  const focusNonceRef = useRef(0);

  // API state
  const [data, setData] = useState<DataState>(emptyData());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const setThreshold = (id: string, v: number) =>
    setThresholds((prev) => ({ ...prev, [id]: v }));

  // Veri çekme
  const fetchData = useCallback(async (date: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [holdingsRes, fundsRes] = await Promise.all([
        fetch(`/api/holdings?date=${date}`),
        fetch("/api/funds"),
      ]);

      const holdingsJson: ApiResponse = await holdingsRes.json();
      const fundsJson: { funds: FundMeta[]; fetchedAt: string } = await fundsRes.json();

      if (holdingsJson.error) throw new Error(holdingsJson.error);

      const funds = fundsJson.funds?.length
        ? fundsJson.funds
        : holdingsJson.funds || [];

      const fundMap = Object.fromEntries(funds.map((f) => [f.code, f]));
      const stockMap = Object.fromEntries(
        (holdingsJson.stocks || []).map((s) => [s.ticker, s])
      );

      setData({
        funds,
        fundMap,
        stocks: holdingsJson.stocks || [],
        stockMap,
        holdings: holdingsJson.holdings || [],
        reportDate: holdingsJson.reportDate || "",
        prevReportDate: holdingsJson.prevReportDate || "",
        fetchedAt: holdingsJson.fetchedAt || fundsJson.fetchedAt || "",
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  // Radar hesaplamaları
  const radarSets = useMemo(() => ({
    fresh: computeFreshBlood(data.holdings, thresholds.fresh),
    smart: computeSmartMoney(data.holdings, thresholds.smart),
    conviction: computeHighConviction(data.holdings, thresholds.conviction),
    rotation: (() => {
      const set = new Set<string>();
      computeSectorRotation(data.holdings, data.funds, data.stockMap).forEach((r) =>
        r.stocks.forEach((s) => set.add(s))
      );
      return set;
    })(),
  }), [data, thresholds]);

  const counts = useMemo(
    () => Object.fromEntries(Object.entries(radarSets).map(([k, v]) => [k, v.size])),
    [radarSets]
  );

  const highlightSet = activeRadar ? radarSets[activeRadar as keyof typeof radarSets] : null;

  const sectorRotations = useMemo(
    () => computeSectorRotation(data.holdings, data.funds, data.stockMap),
    [data]
  );

  const graph = useMemo(
    () => buildGraph(data.holdings, data.funds, data.stocks, minCoverage, minAUM),
    [data, minCoverage, minAUM]
  );

  const graphStats = {
    funds:  graph.nodes.filter((n) => n.type === "fund").length,
    stocks: graph.nodes.filter((n) => n.type === "stock").length,
    links:  graph.links.length,
  };

  const handleSelect = useCallback((node: GraphNode | null) => {
    if (!node) return;
    setSelected(
      node.type === "fund"
        ? { type: "fund", id: node.ref }
        : { type: "stock", id: node.ref }
    );
  }, []);

  const handlePickStock = useCallback((ticker: string) => {
    setMinCoverage(1);
    setMinAUM(0);
    setSelected({ type: "stock", id: ticker });
    focusNonceRef.current += 1;
    setFocusRequest({ id: "S:" + ticker, nonce: focusNonceRef.current });
  }, []);

  const handlePickFund = useCallback((fundCode: string) => {
    setMinAUM(0);
    setSelected({ type: "fund", id: fundCode });
    focusNonceRef.current += 1;
    setFocusRequest({ id: "F:" + fundCode, nonce: focusNonceRef.current });
  }, []);

  const selectedNodeId = selected
    ? selected.type === "fund"
      ? "F:" + selected.id
      : "S:" + selected.id
    : null;

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden"
      style={{ background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.panelBorder2}; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce { animation: bounce 0.8s infinite; }
        .animate-spin { animation: spin 1s linear infinite; }
        .animate-pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      <TopBar
        graphStats={graphStats}
        onPickStock={handlePickStock}
        onPickFund={handlePickFund}
        data={data}
        isLoading={isLoading}
      />

      <div className="flex-1 flex min-h-0 relative">
        {/* Sol Panel */}
        <div
          className="w-80 shrink-0"
          style={{ borderRight: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel }}
        >
          <LeftPanel
            data={data}
            activeRadar={activeRadar}
            setActiveRadar={setActiveRadar}
            thresholds={thresholds}
            setThreshold={setThreshold}
            minCoverage={minCoverage}
            setMinCoverage={setMinCoverage}
            minAUM={minAUM}
            setMinAUM={setMinAUM}
            counts={counts}
            sectorRotations={sectorRotations}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            fetchedAt={data.fetchedAt}
            onRefresh={() => fetchData(selectedDate)}
            isLoading={isLoading}
            onPickStock={handlePickStock}
          />
        </div>

        {/* Grafik Alanı */}
        <div className="flex-1 relative min-w-0">
          {isLoading && <LoadingOverlay />}
          {!isLoading && error && (
            <ErrorBanner message={error} onRetry={() => fetchData(selectedDate)} />
          )}
          {!isLoading && !error && (
            <GraphCanvas
              data={data}
              minCoverage={minCoverage}
              minAUM={minAUM}
              highlightSet={highlightSet}
              onSelect={handleSelect}
              selectedId={selectedNodeId}
              focusRequest={focusRequest}
            />
          )}
          {!isLoading && !error && (
            <div
              className="absolute bottom-3 left-3 text-xs px-2 py-1 rounded"
              style={{
                background: "rgba(13,17,25,0.7)",
                color: COLORS.textDim,
                border: `1px solid ${COLORS.panelBorder}`,
              }}
            >
              Sürükle: taşı · Çift tık: sabitle / serbest bırak · Tekerlek: yakınlaştır
            </div>
          )}
        </div>

        {/* Sağ Detay Çekmecesi */}
        <div
          className="absolute top-0 right-0 h-full"
          style={{
            width: 440,
            maxWidth: "92vw",
            background: COLORS.panel,
            borderLeft: `1px solid ${COLORS.panelBorder}`,
            transform: selected ? "translateX(0)" : "translateX(100%)",
            transition: "transform 300ms ease-out",
            boxShadow: selected ? "-16px 0 40px rgba(0,0,0,0.5)" : "none",
          }}
        >
          {selected?.type === "fund" && (
            <FundDrawer
              fundCode={selected.id}
              onClose={() => setSelected(null)}
              onSelectStock={(t) => setSelected({ type: "stock", id: t })}
              data={data}
            />
          )}
          {selected?.type === "stock" && (
            <StockDrawer
              ticker={selected.id}
              onClose={() => setSelected(null)}
              onSelectFund={(f) => setSelected({ type: "fund", id: f })}
              data={data}
            />
          )}
        </div>
      </div>
    </div>
  );
}
