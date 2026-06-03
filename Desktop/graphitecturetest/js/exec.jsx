function ProjectsList({ projects, onSelect, activeProjectId, onCreateNew, onDeleteProject, highlightItemDescs }) {
  const [viewMode, setViewMode] = useState("list");
  const [confirmDelete, setConfirmDelete] = useState(null); // project id to confirm
  const isHighlighted = (desc) => highlightItemDescs.length > 0 && highlightItemDescs.some(h => desc.toLowerCase().includes(h));
  const allStats = projects.map(p => ({ ...p, stats: projStats(p.items, p.timesheet) }));
  const totProjects = projects.length;
  const totValue = allStats.reduce((a, p) => a + p.stats.grandTotal, 0);
  const totItems = allStats.reduce((a, p) => a + p.stats.total, 0);
  const totFinished = allStats.reduce((a, p) => a + p.stats.finished, 0);
  const overallPct = pctCalc(totFinished, totItems);
  const totSqm = allStats.reduce((a, p) => a + p.stats.sqm, 0);

  const sL = (pct) => pct === 100 ? "COMPLETE" : pct >= 70 ? "NEAR COMPLETE" : pct >= 30 ? "IN PRODUCTION" : "EARLY STAGE";
  const sBg = (pct) => pct === 100 ? "#111" : pct >= 70 ? "#555" : pct >= 30 ? "#e8e8e8" : "#f5f5f5";
  const sFg = (pct) => pct >= 70 ? "#fff" : "#666";

  // Gather at-risk items across all projects
  const atRisk = [];
  allStats.forEach(p => {
    p.items.filter(i => i.status === "PENDING" || i.status === "IN PROGRESS").forEach(i => {
      atRisk.push({ ...i, projName: p.info.project, custName: p.info.customer });
    });
  });

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={s.pageTitle}>Executive Summary</div>
          <div style={{ ...s.pageSub, marginBottom: 0 }}>Portfolio overview — {totProjects} active projects</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: 4, overflow: "hidden" }}>
            {[["list", "☰"], ["cards", "▦"]].map(([id, icon]) => (
              <button key={id} onClick={() => setViewMode(id)}
                style={{ fontFamily: FONT, fontSize: 13, padding: "5px 12px", background: viewMode === id ? "#111" : "#fff", color: viewMode === id ? "#fff" : "#888", border: "none", cursor: "pointer", transition: "all 0.15s" }}>
                {icon}
              </button>
            ))}
          </div>
          <button style={s.btn()} onClick={onCreateNew}>+ New Project</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-5" style={{ marginBottom: 28 }}>
        <StatCard value={totProjects} label="Active Projects" />
        <StatCard value={fmtK(totValue)} label="Total Cost" />
        <StatCard value={`${overallPct}%`} label="Overall Progress" />
        <StatCard value={totItems} label="Line Items" />
        <StatCard value={`${totSqm.toFixed(0)} m²`} label="Total Print Area" />
      </div>

      {/* Pipeline */}
      <div style={{ ...s.card, marginBottom: 28 }}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Production Pipeline</span>
          <span style={{ fontSize: 11, color: "#888" }}>{totFinished}/{totItems} items complete</span>
        </div>
        <div style={s.cardBody}>
          <div style={s.progressBar}><div style={s.progressFill(overallPct)} /></div>
          <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
            {STATUS_ORDER.slice().reverse().map(label => {
              const count = allStats.reduce((a, p) => a + p.items.filter(i => i.status === label).length, 0);
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor[label] }} />
                  <span style={{ color: "#888" }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div style={s.card}>
          <div className="table-wrap">
            <table style={s.table}>
              <thead>
                <tr>
                  {["", "Project", "Customer", "Ref", "Status", "Progress", "Items", "Area", "Value", "Due", ""].map((h, i) =>
                    <th key={h + i} style={s.th}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allStats.map(p => (
                  <tr key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: "pointer", background: activeProjectId === p.id ? "#f8f8f8" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (activeProjectId !== p.id) e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = activeProjectId === p.id ? "#f8f8f8" : "transparent"; }}>
                    <td style={{ ...s.td, width: 4, padding: "9px 0 9px 12px" }}>
                      <div style={{ width: 4, height: 32, borderRadius: 2, background: activeProjectId === p.id ? "#111" : "transparent" }} />
                    </td>
                    <td style={{ ...s.td, fontWeight: 500 }}>
                      <div>{p.info.project}</div>
                      <div style={{ fontSize: 10, color: "#aaa", fontWeight: 400, marginTop: 2 }}>PM: {p.info.manager}</div>
                    </td>
                    <td style={s.td}>{p.info.customer}</td>
                    <td style={{ ...s.td, fontFamily: "monospace", fontSize: 11 }}>{p.info.ref}</td>
                    <td style={s.td}>
                      <span style={{ ...s.tag, background: sBg(p.stats.pct), color: sFg(p.stats.pct), fontSize: 9, padding: "3px 10px" }}>
                        {sL(p.stats.pct)}
                      </span>
                    </td>
                    <td style={{ ...s.td, width: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ ...s.progressBar, flex: 1, height: 6 }}><div style={s.progressFill(p.stats.pct)} /></div>
                        <span style={{ fontSize: 11, fontWeight: 500, width: 30, textAlign: "right" }}>{p.stats.pct}%</span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>{p.stats.finished}/{p.stats.total}</td>
                    <td style={{ ...s.td, textAlign: "right", whiteSpace: "nowrap" }}>{(p.stats.sqm || 0).toFixed(0)} m²</td>
                    <td style={{ ...s.td, textAlign: "right", fontWeight: 500 }}>{fmtK(p.stats.grandTotal)}</td>
                    <td style={{ ...s.td, fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{fmtDate(p.info.deliveryDate || p.info.dateRequired)}</td>
                    <td style={{ ...s.td, textAlign: "center", width: 36, padding: "4px" }}>
                      <button onClick={function(e) { e.stopPropagation(); setConfirmDelete(p.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 4, color: "#ccc", fontSize: 14, lineHeight: 1 }}
                        onMouseEnter={function(e) { e.target.style.color = "#c00"; }}
                        onMouseLeave={function(e) { e.target.style.color = "#ccc"; }}
                        title="Delete project">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #111" }}>
                  <td style={s.td} />
                  <td colSpan={3} style={{ ...s.td, fontWeight: 500 }}>PORTFOLIO TOTAL</td>
                  <td style={s.td} />
                  <td style={{ ...s.td, width: 140 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ ...s.progressBar, flex: 1, height: 6 }}><div style={s.progressFill(overallPct)} /></div>
                      <span style={{ fontSize: 11, fontWeight: 500, width: 30, textAlign: "right" }}>{overallPct}%</span>
                    </div>
                  </td>
                  <td style={{ ...s.td, textAlign: "center", fontWeight: 500 }}>{totFinished}/{totItems}</td>
                  <td style={{ ...s.td, textAlign: "right", fontWeight: 500 }}>{totSqm.toFixed(0)} m²</td>
                  <td style={{ ...s.td, textAlign: "right", fontWeight: 500 }}>{fmtK(totValue)}</td>
                  <td style={s.td} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* CARD VIEW */}
      {viewMode === "cards" && (
        <div className="grid-2-cards">
          {allStats.map(p => (
            <div key={p.id} onClick={() => onSelect(p.id)}
              style={{ ...s.card, marginBottom: 0, cursor: "pointer", transition: "all 0.2s ease", border: activeProjectId === p.id ? "2px solid #111" : "1px solid #e0e0e0" }}
              onMouseEnter={e => { if (activeProjectId !== p.id) { e.currentTarget.style.borderColor = "#111"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
              onMouseLeave={e => { if (activeProjectId !== p.id) { e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.transform = "translateY(0)"; } }}>
              <div style={{ padding: "20px 20px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#999", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{p.info.ref} · {p.info.customer}</div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>{p.info.project}</div>
                  </div>
                  <span style={{ ...s.tag, background: sBg(p.stats.pct), color: sFg(p.stats.pct), fontSize: 9, padding: "3px 10px" }}>{sL(p.stats.pct)}</span>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#888" }}>Progress</span>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{p.stats.pct}%</span>
                  </div>
                  <div style={s.progressBar}><div style={s.progressFill(p.stats.pct)} /></div>
                </div>
              </div>
              <div className="grid-stat-bar">
                {[[p.stats.total, "Items"], [p.stats.finished + "/" + p.stats.total, "Done"], [fmtK(p.stats.grandTotal), "Cost"], [(p.stats.sqm || 0).toFixed(0) + " m²", "Area"]].map(([val, lbl], i) => (
                  <div key={lbl} style={{ textAlign: "center", padding: "14px 8px", borderLeft: i > 0 ? "1px solid #f0f0f0" : "none" }}>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>{val}</div>
                    <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.03em", marginTop: 2 }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "#888" }}>Due: {fmtDate(p.info.deliveryDate || p.info.dateRequired)}</div>
                  <button onClick={function(e) { e.stopPropagation(); setConfirmDelete(p.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4, color: "#ccc", fontSize: 12, lineHeight: 1 }}
                    onMouseEnter={function(e) { e.target.style.color = "#c00"; }}
                    onMouseLeave={function(e) { e.target.style.color = "#ccc"; }}
                    title="Delete project">✕</button>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#111" }}>{activeProjectId === p.id ? "Selected ✓" : "Select →"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AT-RISK ITEMS with Project + Customer columns */}
      {atRisk.length > 0 && (
        <div style={{ ...s.card, marginTop: 20 }}>
          <div style={s.cardHead}>
            <span style={s.cardTitle}>Items Requiring Attention (All Projects)</span>
            <span style={{ ...s.tag, background: "#fff", color: "#111", border: "1px solid #ccc" }}>{atRisk.length} items</span>
          </div>
          <div className="table-wrap">
            <table style={s.table}>
              <thead>
                <tr>
                  {["Project", "Customer", "Item", "Status", "Process", "Qty", "Cost"].map(h =>
                    <th key={h} style={s.th}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {atRisk.slice(0, 15).map((item, idx) => (
                  <tr key={idx} className={isHighlighted(item.desc) ? "ai-highlight-row" : ""}>
                    <td style={{ ...s.td, fontSize: 11, color: "#888" }}>{item.projName}</td>
                    <td style={{ ...s.td, fontSize: 11, fontWeight: 500 }}>{item.custName}</td>
                    <td style={{ ...s.td, fontWeight: 500 }}>{item.desc}</td>
                    <td style={s.td}><span style={s.badge(item.status)}>{item.status}</span></td>
                    <td style={{ ...s.td, fontSize: 11 }}>{item.process}</td>
                    <td style={{ ...s.td, textAlign: "center" }}>{item.qty}</td>
                    <td style={{ ...s.td, textAlign: "right", fontWeight: 500 }}>{fmt(item.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {atRisk.length > 15 && (
              <div style={{ padding: "12px 20px", fontSize: 11, color: "#888", textAlign: "center" }}>
                + {atRisk.length - 15} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (function() {
        var proj = projects.find(function(p) { return p.id === confirmDelete; });
        var projName = proj ? proj.info.project : confirmDelete;
        var custName = proj ? proj.info.customer : "";
        return (
          <div className="wizard-overlay" onClick={function() { setConfirmDelete(null); }}>
            <div className="wizard-modal" style={{ width: 420, maxWidth: "90%" }} onClick={function(e) { e.stopPropagation(); }}>
              <div style={{ padding: "24px" }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Delete Project?</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
                  This will permanently delete <strong>{projName}</strong>{custName ? " (" + custName + ")" : ""} and all associated data including line items, tasks, timesheet entries, schedule, and activity log.
                </div>
                <div style={{ fontSize: 11, color: "#c00", background: "#fff5f5", padding: "10px 14px", borderRadius: 6, marginBottom: 16 }}>
                  This action cannot be undone.
                </div>
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button style={s.btn("secondary")} onClick={function() { setConfirmDelete(null); }}>Cancel</button>
                <button style={{ ...s.btn(), background: "#c00", borderColor: "#c00" }}
                  onClick={function() {
                    var id = confirmDelete;
                    setConfirmDelete(null);
                    if (onDeleteProject) onDeleteProject(id);
                  }}>Delete Project</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
