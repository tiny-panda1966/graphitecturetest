function TimesheetView({ timesheet, setTimesheet, addHistory, projectId, items }) {
  var [adding, setAdding] = useState(false);
  var [form, setForm] = useState({ name: STAFF[0].name, fn: FUNCTIONS[0].fn, hours: "" });
  var [editingIdx, setEditingIdx] = useState(null);
  var [editForm, setEditForm] = useState({});

  // ── Labour totals ──
  var totalHours = timesheet.reduce(function(a, t) { return a + (t.hours || 0); }, 0);
  var totalLabourCost = timesheet.reduce(function(a, t) { return a + (t.cost || 0); }, 0);

  // ── Material totals from line items (PRODUCTION CHARGES) ──
  var materialItems = (items || []).map(function(item) {
    var sqm = (item.sqm || 0);
    var cost = (item.cost || 0);
    return { id: item.id, desc: item.desc, process: item.process, qty: item.qty || 0, sqm: sqm, costSqm: item.costSqm || 0, cost: cost };
  });
  var totalProdCharge = materialItems.reduce(function(a, m) { return a + m.cost; }, 0);
  var totalSqm = materialItems.reduce(function(a, m) { return a + m.sqm; }, 0);

  // ── Materials consumed from step completion (ACTUAL STOCK COSTS) ──
  var consumedMaterials = [];
  (items || []).forEach(function(item) {
    if (!item.tasks) return;
    item.tasks.forEach(function(task) {
      if (!task.materialsUsed) return;
      try {
        var mats = typeof task.materialsUsed === "string" ? JSON.parse(task.materialsUsed) : task.materialsUsed;
        if (!Array.isArray(mats)) return;
        mats.forEach(function(m) {
          if (!m.materialCode && !m.material) return;
          consumedMaterials.push({
            itemDesc: item.desc,
            stepLabel: task.label || task.id,
            materialCode: m.materialCode || "",
            material: m.material || m.materialCode || "",
            group: m.group || "",
            subGroup: m.subGroup || "",
            qty: m.qty || 0,
            sqMtrPrice: m.sqMtrPrice || 0,
            lineCost: (m.qty || 0) * (m.sqMtrPrice || 0)
          });
        });
      } catch(e) { /* ignore parse errors */ }
    });
  });
  var totalConsumedCost = consumedMaterials.reduce(function(a, m) { return a + m.lineCost; }, 0);
  var totalConsumedQty = consumedMaterials.reduce(function(a, m) { return a + m.qty; }, 0);

  // ── Combined ──
  var totalProjectCost = totalLabourCost + totalProdCharge;
  var margin = totalProdCharge - totalConsumedCost;

  // ── Labour functions ──
  var addEntry = function() {
    var h = parseFloat(form.hours);
    if (!h || h <= 0) return;
    var fnRate = (FUNCTIONS.find(function(f) { return f.fn === form.fn; }) || {}).rate || 25;
    var entry = { name: form.name, fn: form.fn, hours: h, rate: fnRate, cost: h * fnRate, source: "manual", date: todayStr() };
    setTimesheet(function(prev) { return prev.concat([entry]); });
    addHistory({ type: "timesheet", detail: "Added: " + form.name + " – " + form.fn + " – " + h + "h (" + fmt(h * fnRate) + ")" });
    setForm({ name: STAFF[0].name, fn: FUNCTIONS[0].fn, hours: "" });
    setAdding(false);
    if (DB.isLive()) {
      DB.addTimesheetEntry({ projectId: projectId, name: form.name, fn: form.fn, hours: h, rate: fnRate, cost: h * fnRate, date: todayStr() })
        .catch(function(err) { console.error("DB: Failed to save timesheet entry", err); });
    }
  };

  var removeEntry = function(idx) {
    var t = timesheet[idx];
    addHistory({ type: "timesheet", detail: "Removed: " + t.name + " – " + t.fn + " – " + t.hours + "h" });
    setTimesheet(function(p) { return p.filter(function(_, j) { return j !== idx; }); });
    if (DB.isLive() && t._id) {
      DB.deleteTimesheetEntry(t._id).catch(function(err) { console.error("DB: Failed to delete timesheet entry", err); });
    }
  };

  var startEdit = function(idx) {
    var t = timesheet[idx];
    setEditingIdx(idx);
    setEditForm({ name: t.name, fn: t.fn, hours: t.hours, rate: t.rate });
  };
  var saveEdit = function() {
    if (editingIdx === null) return;
    var h = parseFloat(editForm.hours) || 0;
    var r = parseFloat(editForm.rate) || 0;
    var updated = Object.assign({}, timesheet[editingIdx], { name: editForm.name, fn: editForm.fn, hours: h, rate: r, cost: h * r });
    setTimesheet(function(prev) { return prev.map(function(t, i) { return i === editingIdx ? updated : t; }); });
    if (DB.isLive() && updated._id) {
      DB.updateTimesheetEntry(updated._id, { name: editForm.name, fn: editForm.fn, hours: h, rate: r, cost: h * r })
        .catch(function(err) { console.error("DB: Failed to update timesheet", err); });
    }
    setEditingIdx(null);
  };
  var cancelEdit = function() { setEditingIdx(null); };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div><div style={s.pageTitle}>Timesheet & Costs</div><div style={s.pageSub}>Full project cost breakdown — production charges, materials consumed + labour</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btn()} onClick={function() { setAdding(true); }}>+ Add Entry</button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard value={fmt(totalProdCharge)} label="Production Charges" />
        <StatCard value={fmt(totalConsumedCost)} label="Materials Consumed" />
        <StatCard value={fmt(totalLabourCost)} label="Labour Cost" />
        <StatCard value={totalHours.toFixed(1) + "h"} label="Total Hours" />
      </div>

      {/* ── PRODUCTION CHARGES SECTION ── */}
      <div style={Object.assign({}, s.card, { marginBottom: 20 })}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Production Charges</span>
          <span style={{ fontSize: 11, color: "#888" }}>{materialItems.length} items · {totalSqm.toFixed(2)} m² · Rate card prices</span>
        </div>
        <div className="table-wrap">
          <table style={Object.assign({}, s.table, { tableLayout: "fixed" })}>
            <colgroup>
              <col style={{ width: "28%" }} /><col style={{ width: "22%" }} /><col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} />
            </colgroup>
            <thead><tr>
              {["Line Item", "Process", "Qty", "Sq m", "Rate (£/m²)", "Charge"].map(function(h) {
                return React.createElement("th", { key: h, style: s.th }, h);
              })}
            </tr></thead>
            <tbody>
              {materialItems.map(function(m, i) {
                return React.createElement("tr", { key: i },
                  React.createElement("td", { style: Object.assign({}, s.td, { fontWeight: 500 }) }, m.desc),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 11 }) }, m.process),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center" }) }, m.qty),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right" }) }, (m.sqm || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right" }) }, "£" + (m.costSqm || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(m.cost))
                );
              })}
              {materialItems.length === 0 && React.createElement("tr", null,
                React.createElement("td", { colSpan: 6, style: Object.assign({}, s.td, { textAlign: "center", color: "#999", padding: 20 }) }, "No line items")
              )}
            </tbody>
            {materialItems.length > 0 && React.createElement("tfoot", null,
              React.createElement("tr", { style: { borderTop: "2px solid #111" } },
                React.createElement("td", { colSpan: 3, style: Object.assign({}, s.td, { fontWeight: 500 }) }, "PRODUCTION CHARGES TOTAL"),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, totalSqm.toFixed(2)),
                React.createElement("td", { style: s.td }),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(totalProdCharge))
              )
            )}
          </table>
        </div>
      </div>

      {/* ── MATERIALS CONSUMED SECTION ── */}
      <div style={Object.assign({}, s.card, { marginBottom: 20 })}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Materials Consumed</span>
          <span style={{ fontSize: 11, color: "#888" }}>
            {consumedMaterials.length > 0 ? consumedMaterials.length + " entries · " + totalConsumedQty.toFixed(2) + " m² · Actual stock costs" : "No materials logged yet"}
          </span>
        </div>
        <div className="table-wrap">
          <table style={Object.assign({}, s.table, { tableLayout: "fixed" })}>
            <colgroup>
              <col style={{ width: "20%" }} /><col style={{ width: "15%" }} /><col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "10%" }} /><col style={{ width: "11%" }} />
            </colgroup>
            <thead><tr>
              {["Line Item", "Step", "Material", "Code", "Qty (m²)", "Cost/m²", "Cost"].map(function(h) {
                return React.createElement("th", { key: h, style: s.th }, h);
              })}
            </tr></thead>
            <tbody>
              {consumedMaterials.map(function(m, i) {
                return React.createElement("tr", { key: i },
                  React.createElement("td", { style: Object.assign({}, s.td, { fontWeight: 500, fontSize: 11 }) }, m.itemDesc),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, color: "#888" }) }, m.stepLabel),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 11 }) }, m.material),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, color: "#888" }) }, m.materialCode),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right" }) }, (m.qty || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right" }) }, "£" + (m.sqMtrPrice || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(m.lineCost))
                );
              })}
              {consumedMaterials.length === 0 && React.createElement("tr", null,
                React.createElement("td", { colSpan: 7, style: Object.assign({}, s.td, { textAlign: "center", color: "#999", padding: 20 }) },
                  "No materials logged — materials are recorded when completing steps in the tracker"
                )
              )}
            </tbody>
            {consumedMaterials.length > 0 && React.createElement("tfoot", null,
              React.createElement("tr", { style: { borderTop: "2px solid #111" } },
                React.createElement("td", { colSpan: 4, style: Object.assign({}, s.td, { fontWeight: 500 }) }, "MATERIALS CONSUMED TOTAL"),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, totalConsumedQty.toFixed(2)),
                React.createElement("td", { style: s.td }),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(totalConsumedCost))
              )
            )}
          </table>
        </div>
      </div>

      {/* ── COST SUMMARY ── */}
      <div style={Object.assign({}, s.card, { marginBottom: 20 })}>
        <div style={s.cardHead}><span style={s.cardTitle}>Cost Summary</span></div>
        <div style={Object.assign({}, s.cardBody, { padding: "16px 20px" })}>
          {/* Sale value */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, fontWeight: 600, borderBottom: "2px solid #111" }}>
            <span>Sale Value (Production Charges)</span><span>{fmt(totalProdCharge)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}>
            <span>inc. VAT (20%)</span><span>{fmt(totalProdCharge * 1.2)}</span>
          </div>

          {/* Production costs */}
          <div style={{ marginTop: 16, marginBottom: 4, fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>Production Costs</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>
            <span>Materials Consumed</span><span style={{ color: "#c00" }}>{consumedMaterials.length > 0 ? "−" + fmt(totalConsumedCost) : "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #f0f0f0" }}>
            <span>Labour</span><span style={{ color: "#c00" }}>{totalLabourCost > 0 ? "−" + fmt(totalLabourCost) : "—"}</span>
          </div>

          {/* Margin */}
          {React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontSize: 16, fontWeight: 600, borderTop: "2px solid #111", marginTop: 8 } },
            React.createElement("span", null, "Production Margin"),
            React.createElement("span", { style: { color: (totalProdCharge - totalConsumedCost - totalLabourCost) >= 0 ? "#2e7d32" : "#c00" } },
              fmt(totalProdCharge - totalConsumedCost - totalLabourCost) +
              (totalProdCharge > 0 ? " (" + Math.round((totalProdCharge - totalConsumedCost - totalLabourCost) / totalProdCharge * 100) + "%)" : "")
            )
          )}
        </div>
      </div>

      {/* ── Add manual entry modal ── */}
      {adding && (
        <div className="wizard-overlay" onClick={function() { setAdding(false); }}>
          <div className="wizard-modal" style={{ width: 480, maxWidth: "90%" }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>New Timesheet Entry</div>
            </div>
            <div style={{ padding: 24 }}>
              <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Staff Member</div>
                  <select style={s.select} value={form.name} onChange={function(e) { setForm(Object.assign({}, form, { name: e.target.value })); }}>
                    {STAFF.map(function(p) { return React.createElement("option", { key: p.name, value: p.name }, p.name + " (£" + p.rate + "/hr)"); })}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Function</div>
                  <select style={s.select} value={form.fn} onChange={function(e) { setForm(Object.assign({}, form, { fn: e.target.value })); }}>
                    {FUNCTIONS.map(function(f) { return React.createElement("option", { key: f.fn, value: f.fn }, f.fn + " (£" + f.rate + "/hr)"); })}
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Hours</div>
                <input style={s.input} type="number" step="0.5" placeholder="0" value={form.hours}
                  onChange={function(e) { setForm(Object.assign({}, form, { hours: e.target.value })); }}
                  onKeyDown={function(e) { if (e.key === "Enter") addEntry(); }} />
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={s.btn("secondary")} onClick={function() { setAdding(false); }}>Cancel</button>
              <button style={s.btn()} onClick={addEntry}>Add Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LABOUR SECTION ── */}
      <div style={s.card}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Labour</span>
          <span style={{ fontSize: 11, color: "#888" }}>{timesheet.length} entries · {totalHours.toFixed(1)}h</span>
        </div>
        <div className="table-wrap">
          <table style={Object.assign({}, s.table, { tableLayout: "fixed" })}>
            <colgroup>
              <col style={{ width: "18%" }} /><col style={{ width: "18%" }} /><col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} /><col style={{ width: "8%" }} />
            </colgroup>
            <thead><tr>
              {["Staff", "Function", "Source", "Hours", "Rate (£/hr)", "Cost", "Date", ""].map(function(h) {
                return React.createElement("th", { key: h, style: s.th }, h);
              })}
            </tr></thead>
            <tbody>
              {timesheet.map(function(t, i) {
                var isEditing = editingIdx === i;
                if (isEditing) {
                  return React.createElement("tr", { key: i, style: { background: "#f8f8f8" } },
                    React.createElement("td", { style: s.td },
                      React.createElement("select", { style: Object.assign({}, s.select, { fontSize: 11, padding: "4px 6px" }), value: editForm.name,
                        onChange: function(e) { setEditForm(Object.assign({}, editForm, { name: e.target.value })); }
                      }, STAFF.map(function(p) { return React.createElement("option", { key: p.name, value: p.name }, p.name); }))
                    ),
                    React.createElement("td", { style: s.td },
                      React.createElement("select", { style: Object.assign({}, s.select, { fontSize: 11, padding: "4px 6px" }), value: editForm.fn,
                        onChange: function(e) {
                          var rate = (FUNCTIONS.find(function(f) { return f.fn === e.target.value; }) || {}).rate || 25;
                          setEditForm(Object.assign({}, editForm, { fn: e.target.value, rate: rate }));
                        }
                      }, FUNCTIONS.map(function(f) { return React.createElement("option", { key: f.fn, value: f.fn }, f.fn); }))
                    ),
                    React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, color: "#888" }) }, t.source === "tracker" ? "Tracker" : "Manual"),
                    React.createElement("td", { style: s.td },
                      React.createElement("input", { type: "number", step: "0.25", style: Object.assign({}, s.input, { fontSize: 11, padding: "4px 6px", textAlign: "center" }), value: editForm.hours,
                        onChange: function(e) { setEditForm(Object.assign({}, editForm, { hours: e.target.value })); }
                      })
                    ),
                    React.createElement("td", { style: s.td },
                      React.createElement("input", { type: "number", step: "0.5", style: Object.assign({}, s.input, { fontSize: 11, padding: "4px 6px", textAlign: "right" }), value: editForm.rate,
                        onChange: function(e) { setEditForm(Object.assign({}, editForm, { rate: e.target.value })); }
                      })
                    ),
                    React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt((parseFloat(editForm.hours) || 0) * (parseFloat(editForm.rate) || 0))),
                    React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10 }) }, t.date || ""),
                    React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center" }) },
                      React.createElement("div", { style: { display: "flex", gap: 4, justifyContent: "center" } },
                        React.createElement("button", { onClick: saveEdit, style: { background: "none", border: "none", cursor: "pointer", color: "#2e7d32", fontSize: 12 }, title: "Save" }, "✓"),
                        React.createElement("button", { onClick: cancelEdit, style: { background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 12 }, title: "Cancel" }, "✕")
                      )
                    )
                  );
                }
                return React.createElement("tr", { key: i },
                  React.createElement("td", { style: Object.assign({}, s.td, { fontWeight: 500 }) }, t.name),
                  React.createElement("td", { style: s.td }, React.createElement("span", { style: s.tag }, t.fn)),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10 }) },
                    t.source === "tracker" ?
                      React.createElement("span", { style: { padding: "1px 6px", borderRadius: 3, background: "#e3f2fd", color: "#1565c0", fontSize: 9, fontWeight: 500 } }, "Tracker") :
                      React.createElement("span", { style: { padding: "1px 6px", borderRadius: 3, background: "#f5f5f5", color: "#888", fontSize: 9 } }, "Manual"),
                    t.itemDesc ? React.createElement("div", { style: { fontSize: 9, color: "#999", marginTop: 2 } }, t.itemDesc) : null
                  ),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center" }) }, (t.hours || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right" }) }, "£" + (t.rate || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(t.cost || 0)),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, color: "#888" }) }, t.date || ""),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center" }) },
                    React.createElement("div", { style: { display: "flex", gap: 4, justifyContent: "center" } },
                      React.createElement("button", { onClick: function() { startEdit(i); }, style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 11 }, title: "Edit",
                        onMouseEnter: function(e) { e.target.style.color = "#555"; }, onMouseLeave: function(e) { e.target.style.color = "#ccc"; }
                      }, "✎"),
                      React.createElement("button", { onClick: function() { removeEntry(i); }, style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 },
                        onMouseEnter: function(e) { e.target.style.color = "#c00"; }, onMouseLeave: function(e) { e.target.style.color = "#ccc"; }
                      }, "✕")
                    )
                  )
                );
              })}
              {timesheet.length === 0 && React.createElement("tr", null,
                React.createElement("td", { colSpan: 8, style: Object.assign({}, s.td, { textAlign: "center", color: "#999", padding: 32 }) },
                  "No labour entries yet. Labour entries are created automatically when steps are completed in the tracker."
                )
              )}
            </tbody>
            {timesheet.length > 0 && React.createElement("tfoot", null,
              React.createElement("tr", { style: { borderTop: "2px solid #111" } },
                React.createElement("td", { colSpan: 3, style: Object.assign({}, s.td, { fontWeight: 500 }) }, "LABOUR TOTAL"),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center", fontWeight: 500 }) }, totalHours.toFixed(1) + "h"),
                React.createElement("td", { style: s.td }),
                React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(totalLabourCost)),
                React.createElement("td", { colSpan: 2, style: s.td })
              )
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
