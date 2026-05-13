function HistoryView({ history }) {
  const typeIcon = { status: "●", timesheet: "◷", schedule: "◫", stage: "▣", assignment: "◉", project: "★" };
  const typeColor = { status: "#111", timesheet: "#555", schedule: "#888", stage: "#aaa", assignment: "#666", project: "#333" };
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? history : history.filter(h => h.type === filter);
  const types = ["all", ...[...new Set(history.map(h => h.type))]];

  return (
    <div className="page-container">
      <div style={s.pageTitle}>Project History</div><div style={s.pageSub}>Complete audit trail of all changes</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            style={{ ...s.btn(filter === t ? "primary" : "secondary"), fontSize: 11, padding: "4px 14px", textTransform: "capitalize" }}>
            {t} {t !== "all" && `(${history.filter(h => h.type === t).length})`}
          </button>
        ))}
      </div>
      <div style={s.card}>
        {filtered.length === 0
          ? <div style={{ ...s.cardBody, textAlign: "center", color: "#999", padding: 40 }}>No history entries yet. Changes will appear here automatically.</div>
          : <div style={s.cardBody}>
              {filtered.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < filtered.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0, paddingTop: 2 }}>
                    <span style={{ fontSize: 12, color: typeColor[h.type] || "#888" }}>{typeIcon[h.type] || "●"}</span>
                    {i < filtered.length - 1 && <div style={{ width: 1, flex: 1, background: "#eee", marginTop: 6 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ ...s.tag, fontSize: 9, textTransform: "capitalize" }}>{h.type}</span>
                      <span style={{ fontSize: 10, color: "#bbb" }}>{h.time} · {h.date}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#333" }}>{h.detail}</div>
                    <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>by {h.user}</div>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
