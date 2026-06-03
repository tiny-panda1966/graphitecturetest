function ProjectSummary({ items, setItems, info, timesheet, addHistory, highlightItemDescs, projectId }) {
  const isHighlighted = (desc) => highlightItemDescs.length > 0 && highlightItemDescs.some(h => desc.toLowerCase().includes(h));
  const st = projStats(items, timesheet);
  const byProcess = {};
  items.forEach(i => {
    if (!byProcess[i.process]) byProcess[i.process] = { qty: 0, sqm: 0, cost: 0 };
    byProcess[i.process].qty += i.qty;
    byProcess[i.process].sqm += i.sqm;
    byProcess[i.process].cost += i.cost;
  });
  const labCost = timesheet.reduce((a, t) => a + t.cost, 0);
  const riskItems = items.filter(i => i.status === "PENDING" || i.status === "IN PROGRESS");

  const toggleDone = (id) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const ns = i.status === "FINISHED" ? "PENDING" : "FINISHED";
      addHistory({ type: "status", detail: `${i.desc}: ${i.status} → ${ns}` });
      // Persist to DB
      if (DB.isLive()) {
        DB.updateLineItem(projectId, id, { status: ns })
          .catch(function(err) { console.error("DB: Failed to update line item status", err); });
      }
      return { ...i, status: ns };
    }));
  };

  const changeAssignee = (id, name) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      addHistory({ type: "assignment", detail: `${i.desc}: assigned to ${name}` });
      // Persist to DB
      if (DB.isLive()) {
        DB.updateLineItem(projectId, id, { assignee: name })
          .catch(function(err) { console.error("DB: Failed to update line item assignee", err); });
      }
      return { ...i, assignee: name };
    }));
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={s.pageTitle}>{info.project}</div>
          <div style={{ ...s.pageSub, marginBottom: 0 }}>{info.ref} · {info.customer} · PM: {info.manager}</div>
        </div>
        <span style={{ ...s.tag, background: st.pct === 100 ? "#111" : "#fff", color: st.pct === 100 ? "#fff" : "#111", border: "1px solid #111", fontSize: 11, padding: "4px 14px" }}>
          {st.pct === 100 ? "COMPLETE" : "IN PRODUCTION"}
        </span>
      </div>

      {/* Brief Card */}
      <div style={s.card}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Project Brief</span>
          <span style={{ fontSize: 11, color: "#888" }}>{info.ref}</span>
        </div>
        <div style={s.cardBody}>
          <div className="grid-brief">
            {[["Customer", info.customer], ["Date Booked", fmtDate(info.dateBooked)], ["Delivery Date", fmtDate(info.deliveryDate || info.dateRequired)], ["Delivery Instructions", info.delivery]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4">
        <StatCard value={`${st.pct}%`} label="Complete" />
        <StatCard value={st.total} label="Line Items" />
        <StatCard value={`${(st.sqm || 0).toFixed(1)} m²`} label="Print Area" />
        <StatCard value={fmt(st.prodCharge)} label="Production Charges" />
      </div>

      <div className="grid-2">
        {/* Progress Breakdown */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardTitle}>Production Progress</span></div>
          <div style={s.cardBody}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <ProgressBar pct={st.pct} label="Overall Completion" />
              {[["FINISHED", items.filter(i => i.status === "FINISHED").length, "#111"],
                ["PRINTED", items.filter(i => i.status === "PRINTED").length, "#555"],
                ["IN PROGRESS", items.filter(i => i.status === "IN PROGRESS").length, "#888"],
                ["PENDING", items.filter(i => i.status === "PENDING").length, "#d0d0d0"]
              ].map(([label, count, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12 }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{count}</span>
                  <span style={{ fontSize: 11, color: "#888", width: 30, textAlign: "right" }}>{pctCalc(count, st.total)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cost Summary */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardTitle}>Cost Summary</span></div>
          <div style={Object.assign({}, s.cardBody, { padding: "16px 20px" })}>
            {Object.entries(byProcess).map(([p, d]) => (
              <div key={p} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                <span style={{ color: "#666" }}>{p}</span>
                <span style={{ fontWeight: 500 }}>{fmt(d.cost)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, fontWeight: 600, borderTop: "2px solid #111", marginTop: 8 }}>
              <span>Sale Value (Production Charges)</span><span>{fmt(st.prodCharge)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}>
              <span>inc. VAT (20%)</span><span>{fmt(st.prodCharge * 1.2)}</span>
            </div>
            <div style={{ marginTop: 16, marginBottom: 4, fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>Production Costs</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>
              <span>Labour</span><span style={{ color: labCost > 0 ? "#c00" : "#ccc" }}>{labCost > 0 ? "−" + fmt(labCost) : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontSize: 16, fontWeight: 600, borderTop: "2px solid #111", marginTop: 8 }}>
              <span>Production Margin</span>
              <span style={{ color: (st.prodCharge - labCost) >= 0 ? "#2e7d32" : "#c00" }}>
                {fmt(st.prodCharge - labCost)}{st.prodCharge > 0 ? " (" + Math.round((st.prodCharge - labCost) / st.prodCharge * 100) + "%)" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* At-Risk */}
      {riskItems.length > 0 && (
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardTitle}>Items Requiring Attention</span>
            <span style={{ ...s.tag, background: "#fff", color: "#111", border: "1px solid #ccc" }}>{riskItems.length}</span>
          </div>
          <div className="table-wrap">
            <table style={s.table}>
              <thead><tr>{["Item", "Assignee", "Status", "Process", "Qty", "Notes"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {riskItems.map(item => (
                  <tr key={item.id} className={isHighlighted(item.desc) ? "ai-highlight-row" : ""}>
                    <td style={{ ...s.td, fontWeight: 500 }}>{item.desc}</td>
                    <td style={{ ...s.td, fontSize: 11 }}>{item.assignee || "—"}</td>
                    <td style={s.td}><span style={s.badge(item.status)}>{item.status}</span></td>
                    <td style={{ ...s.td, fontSize: 11 }}>{item.process}</td>
                    <td style={{ ...s.td, textAlign: "center" }}>{item.qty}</td>
                    <td style={{ ...s.td, fontSize: 11, color: "#888" }}>{item.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deliverables Checklist with Assignee + Clickable Checkbox */}
      <div style={s.card}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Deliverables Checklist</span>
          <span style={{ fontSize: 11, color: "#888" }}>{items.filter(i => i.status === "FINISHED").length}/{items.length} complete</span>
        </div>
        <div style={s.cardBody}>
          <div className="grid-deliverables">
            {items.map(item => (
              <div key={item.id} className={isHighlighted(item.desc) ? "ai-highlight-row" : ""} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderBottom: "1px solid #f5f5f5" }}>
                <div onClick={() => toggleDone(item.id)}
                  style={{ width: 18, height: 18, borderRadius: 3, border: item.status === "FINISHED" ? "none" : "1px solid #ccc", background: item.status === "FINISHED" ? "#111" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, flexShrink: 0, cursor: "pointer", transition: "all 0.15s" }}>
                  {item.status === "FINISHED" && "✓"}
                </div>
                <span style={{ fontSize: 12, flex: 1, textDecoration: item.status === "FINISHED" ? "line-through" : "none", color: item.status === "FINISHED" ? "#999" : "#111" }}>
                  {item.desc}
                </span>
                <select value={item.assignee || ""} onChange={e => changeAssignee(item.id, e.target.value)}
                  style={{ fontFamily: FONT, fontSize: 10, padding: "2px 6px", border: "1px solid #eee", borderRadius: 3, background: "#fafafa", color: "#666", width: 85, outline: "none" }}>
                  <option value="">Unassigned</option>
                  {STAFF.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <span style={{ fontSize: 10, color: "#bbb", width: 24, textAlign: "right" }}>×{item.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
