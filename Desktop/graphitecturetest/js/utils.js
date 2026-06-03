/**
 * Graphitecture Production Manager — Utilities & Styles
 * Inline style objects, formatting helpers, calculation utils, SVG icons.
 */

// ── React Hooks (global for all JSX files) ──
var useState = React.useState;
var useEffect = React.useEffect;
var useMemo = React.useMemo;
var useCallback = React.useCallback;
var useRef = React.useRef;

// ── Formatting ──
var fmt = (n) => "\u00A3" + (n || 0).toFixed(2);
var fmtK = (n) => (n || 0) >= 1000 ? "\u00A3" + ((n || 0) / 1000).toFixed(1) + "k" : fmt(n);
var pctCalc = (n, t) => t === 0 ? 0 : Math.round((n / t) * 100);
var nowStr = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
var todayStr = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Date helpers — convert DB dates (Date objects or ISO strings) to display/input formats
var toDateInput = function(d) {
  if (!d) return "";
  var dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return typeof d === "string" ? d : "";
  return dt.toISOString().split("T")[0];
};
var fmtDate = function(d) {
  if (!d) return "";
  var dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return typeof d === "string" ? d : "";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
var fmtDateShort = function(d) {
  if (!d) return "";
  var dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Duration conversion helpers
var durationToDays = function(duration, unit) {
  var d = parseFloat(duration) || 0;
  switch (unit) {
    case "minutes": return d / (60 * 8); // 8hr working day
    case "hours": return d / 8;
    case "days": return d;
    case "weeks": return d * 5; // working days
    case "months": return d * 22; // working days
    default: return d;
  }
};
var durationToHours = function(duration, unit) {
  var d = parseFloat(duration) || 0;
  switch (unit) {
    case "minutes": return d / 60;
    case "hours": return d;
    case "days": return d * 8;
    case "weeks": return d * 40;
    case "months": return d * 176;
    default: return d;
  }
};
var calcStartDate = function(deliveryDate, duration, durationUnit) {
  if (!deliveryDate) return null;
  var dd = (deliveryDate instanceof Date) ? deliveryDate : new Date(deliveryDate);
  if (isNaN(dd.getTime())) return null;
  var daysBack = Math.ceil(durationToDays(duration, durationUnit));
  var start = new Date(dd);
  // Skip weekends going backwards
  var skipped = 0;
  while (skipped < daysBack) {
    start.setDate(start.getDate() - 1);
    var dow = start.getDay();
    if (dow !== 0 && dow !== 6) skipped++;
  }
  return start;
};
var daysBetween = function(d1, d2) {
  var a = (d1 instanceof Date) ? d1 : new Date(d1);
  var b = (d2 instanceof Date) ? d2 : new Date(d2);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};
var addDays = function(d, n) {
  var dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
};

// ── Status Maps ──
var STATUS_ORDER = ["PENDING", "IN PROGRESS", "PRINTED", "FINISHED"];
var statusProgress = { "PENDING": 0, "IN PROGRESS": 40, "PRINTED": 70, "FINISHED": 100 };
var statusColor = { "PENDING": "#d0d0d0", "IN PROGRESS": "#888", "PRINTED": "#555", "FINISHED": "#111" };

// ── Project Stats Calculator ──
function projStats(items, timesheet) {
  items = items || [];
  timesheet = timesheet || [];
  const total = items.length;
  const finished = items.filter(i => i.status === "FINISHED").length;
  const prodCharge = items.reduce((a, i) => a + (i.cost || 0), 0);
  const labCost = timesheet.reduce((a, t) => a + (t.cost || 0), 0);
  const sqm = items.reduce((a, i) => a + (i.sqm || 0), 0);
  const qty = items.reduce((a, i) => a + (i.qty || 0), 0);
  return {
    total, finished,
    pct: pctCalc(finished, total),
    prodCharge, labCost,
    grandTotal: prodCharge + labCost,
    sqm, qty,
    matCost: prodCharge // backward compat
  };
}

// ── Inline Style Objects ──
var FONT = "'DM Sans','Helvetica Neue',Helvetica,sans-serif";

var s = {
  nav: {
    position: "sticky", top: 0, zIndex: 100,
    background: "#111", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 24px", height: 52, borderBottom: "1px solid #333"
  },
  navLinks: { display: "flex", gap: 2, flexWrap: "wrap" },
  navLink: (active) => ({
    fontSize: 11, fontWeight: 500, padding: "5px 12px", borderRadius: 4,
    background: active ? "#fff" : "transparent",
    color: active ? "#111" : "#999",
    border: "none", cursor: "pointer", fontFamily: FONT,
    letterSpacing: "0.02em", transition: "all 0.15s ease"
  }),
  page: { maxWidth: 1280, margin: "0 auto", padding: "28px 24px" },
  pageTitle: { fontSize: 22, fontWeight: 500, marginBottom: 4, letterSpacing: "-0.02em" },
  pageSub: { fontSize: 12, color: "#888", marginBottom: 28 },
  card: { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 6, marginBottom: 20 },
  cardHead: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 20px", borderBottom: "1px solid #eee"
  },
  cardTitle: { fontSize: 13, fontWeight: 500, letterSpacing: "0.01em" },
  cardBody: { padding: "16px 20px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #111",
    fontWeight: 500, fontSize: 11, letterSpacing: "0.04em",
    textTransform: "uppercase", color: "#666", whiteSpace: "nowrap"
  },
  td: { padding: "9px 12px", borderBottom: "1px solid #f0f0f0", verticalAlign: "top" },
  badge: (type) => {
    const m = {
      FINISHED: { bg: "#111", color: "#fff" },
      PRINTED: { bg: "#fff", color: "#111", border: "1px solid #111" },
      "IN PROGRESS": { bg: "#e8e8e8", color: "#444" },
      PENDING: { bg: "#f5f5f5", color: "#999" }
    };
    const c = m[type] || m.PENDING;
    return {
      display: "inline-block", fontSize: 10, fontWeight: 500,
      padding: "3px 10px", borderRadius: 3,
      letterSpacing: "0.05em", textTransform: "uppercase",
      background: c.bg, color: c.color, border: c.border || "none"
    };
  },
  stat: { textAlign: "center", padding: "16px 0" },
  statVal: { fontSize: 28, fontWeight: 500, letterSpacing: "-0.03em" },
  statLabel: { fontSize: 11, color: "#999", marginTop: 4, letterSpacing: "0.03em", textTransform: "uppercase" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 },
  btn: (v = "primary") => ({
    fontFamily: FONT, fontSize: 12, fontWeight: 500,
    padding: "8px 20px", borderRadius: 4,
    border: v === "primary" ? "none" : "1px solid #ccc",
    background: v === "primary" ? "#111" : "#fff",
    color: v === "primary" ? "#fff" : "#111",
    cursor: "pointer", letterSpacing: "0.02em",
    transition: "all 0.15s ease"
  }),
  input: {
    fontFamily: FONT, fontSize: 12, padding: "7px 12px",
    border: "1px solid #ddd", borderRadius: 4, outline: "none",
    width: "100%", boxSizing: "border-box", background: "#fafafa"
  },
  select: {
    fontFamily: FONT, fontSize: 12, padding: "7px 12px",
    border: "1px solid #ddd", borderRadius: 4, outline: "none",
    background: "#fafafa", width: "100%", boxSizing: "border-box"
  },
  progressBar: { height: 4, borderRadius: 2, background: "#eee", position: "relative", overflow: "hidden" },
  progressFill: (p) => ({
    position: "absolute", left: 0, top: 0, height: "100%",
    width: `${p}%`, background: "#111", borderRadius: 2,
    transition: "width 0.6s ease"
  }),
  tag: {
    display: "inline-block", fontSize: 10, padding: "2px 8px",
    borderRadius: 3, background: "#f0f0f0", color: "#666",
    marginRight: 4, marginBottom: 4, letterSpacing: "0.02em"
  }
};

// ── Grey SVG Icons (for user menu) ──
var IC = {};
// We define these as functions so React can render them
IC.profile = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2 },
  React.createElement("path", { d: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" }),
  React.createElement("circle", { cx: 12, cy: 7, r: 4 })
);
IC.bell = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2 },
  React.createElement("path", { d: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" }),
  React.createElement("path", { d: "M13.73 21a2 2 0 01-3.46 0" })
);
IC.settings = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2 },
  React.createElement("circle", { cx: 12, cy: 12, r: 3 }),
  React.createElement("path", { d: "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" })
);
IC.activity = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2 },
  React.createElement("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
);
IC.logout = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2 },
  React.createElement("path", { d: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" }),
  React.createElement("polyline", { points: "16 17 21 12 16 7" }),
  React.createElement("line", { x1: 21, y1: 12, x2: 9, y2: 12 })
);

IC.users = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2 },
  React.createElement("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
  React.createElement("circle", { cx: 9, cy: 7, r: 4 }),
  React.createElement("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
  React.createElement("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
);

// ── Task Icons (grey SVGs for production tracker) ──
var TASK_ICONS = {};
// Artwork — pen tool
TASK_ICONS.artwork = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  React.createElement("path", { d: "M12 19l7-7 3 3-7 7-3-3z" }),
  React.createElement("path", { d: "M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" }),
  React.createElement("path", { d: "M2 2l7.586 7.586" }),
  React.createElement("circle", { cx: 11, cy: 11, r: 2 })
);
// Print — printer
TASK_ICONS.print = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  React.createElement("polyline", { points: "6 9 6 2 18 2 18 9" }),
  React.createElement("path", { d: "M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" }),
  React.createElement("rect", { x: 6, y: 14, width: 12, height: 8 })
);
// Lamination — layers
TASK_ICONS.lamination = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  React.createElement("polygon", { points: "12 2 2 7 12 12 22 7 12 2" }),
  React.createElement("polyline", { points: "2 17 12 22 22 17" }),
  React.createElement("polyline", { points: "2 12 12 17 22 12" })
);
// Cutting — scissors
TASK_ICONS.cutting = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  React.createElement("circle", { cx: 6, cy: 6, r: 3 }),
  React.createElement("circle", { cx: 6, cy: 18, r: 3 }),
  React.createElement("line", { x1: 20, y1: 4, x2: 8.12, y2: 15.88 }),
  React.createElement("line", { x1: 14.47, y1: 14.48, x2: 20, y2: 20 }),
  React.createElement("line", { x1: 8.12, y1: 8.12, x2: 12, y2: 12 })
);
// Weed & Apply — peeling/squeegee
TASK_ICONS.weed_apply = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  React.createElement("path", { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" }),
  React.createElement("polyline", { points: "14 2 14 8 20 8" }),
  React.createElement("line", { x1: 16, y1: 13, x2: 8, y2: 13 }),
  React.createElement("line", { x1: 16, y1: 17, x2: 8, y2: 17 })
);
// Hand Assembly — wrench/tool
TASK_ICONS.hand_assembly = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  React.createElement("path", { d: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" })
);
// Packing — box
TASK_ICONS.packing = React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "#999", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  React.createElement("path", { d: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" }),
  React.createElement("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }),
  React.createElement("line", { x1: 12, y1: 22.08, x2: 12, y2: 12 })
);

// ── Preflight helpers (shared across docs, tracker, wizard) ──

function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  var units = ["B", "KB", "MB", "GB"];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}
