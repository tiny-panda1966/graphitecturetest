function CRMView({ allProjects, activeCustomer }) {
  var customers = [];
  var seen = {};
  allProjects.forEach(function(p) {
    if (!seen[p.info.customer]) { seen[p.info.customer] = true; customers.push(p.info.customer); }
  });
  var [selectedCustomer, setSelectedCustomer] = useState(activeCustomer && customers.indexOf(activeCustomer) >= 0 ? activeCustomer : customers[0] || "");
  var custProjects = allProjects.filter(function(p) { return p.info.customer === selectedCustomer; });
  var totItems = custProjects.reduce(function(a, p) { return a + (p.items ? p.items.length : 0); }, 0);
  var totFinished = custProjects.reduce(function(a, p) { return a + (p.items ? p.items.filter(function(i) { return calcItemStatus(i.tasks) === "FINISHED"; }).length : 0); }, 0);
  var info = custProjects.length > 0 ? custProjects[0].info : {};

  // Invoices
  var [invoices, setInvoices] = useState([]);
  var [loadingInvoices, setLoadingInvoices] = useState(false);
  var [selectedInvoice, setSelectedInvoice] = useState(null);

  // Load invoices when customer changes
  useEffect(function() {
    if (!selectedCustomer) return;
    setLoadingInvoices(true);
    setInvoices([]);
    if (DB.isLive()) {
      DB.getInvoicesByCustomer(selectedCustomer).then(function(data) {
        setInvoices(data || []);
        setLoadingInvoices(false);
      }).catch(function(err) {
        console.error("DB: Failed to load invoices", err);
        setLoadingInvoices(false);
      });
    } else {
      setLoadingInvoices(false);
    }
  }, [selectedCustomer]);

  var totalInvoiced = invoices.reduce(function(a, inv) { return a + (inv.totalInc || 0); }, 0);
  var totalSaleExVat = invoices.reduce(function(a, inv) { return a + (inv.totalSale || 0); }, 0);

  // Notes
  var [notes, setNotes] = useState([{ id: 1, date: todayStr(), author: "DH", text: "Account overview loaded." }]);
  var [newNote, setNewNote] = useState("");
  var addNote = function() {
    if (!newNote.trim()) return;
    setNotes(function(prev) { return [{ id: Date.now(), date: todayStr(), author: "DH", text: newNote.trim() }].concat(prev); });
    setNewNote("");
  };

  // Invoice statuses
  var INVOICE_STATUSES = ["Draft", "Sent", "Queried", "Overdue", "Paid", "Cancelled"];

  // Update invoice status
  var updateInvoiceStatus = function(inv, newStatus) {
    // Update local state
    setInvoices(function(prev) {
      return prev.map(function(i) {
        if ((i._id || i.invoiceId) !== (inv._id || inv.invoiceId)) return i;
        return Object.assign({}, i, { status: newStatus });
      });
    });
    // Update selected invoice if open
    if (selectedInvoice && (selectedInvoice._id || selectedInvoice.invoiceId) === (inv._id || inv.invoiceId)) {
      setSelectedInvoice(Object.assign({}, selectedInvoice, { status: newStatus }));
    }
    // Persist to DB
    if (DB.isLive()) {
      DB.updateInvoice(inv.invoiceId, { status: newStatus })
        .catch(function(err) { console.error("DB: Failed to update invoice status", err); });
    }
  };

  // Status badge
  var invoiceStatusBadge = function(status) {
    var colors = { "Draft": { bg: "#f0f0f0", fg: "#888" }, "Sent": { bg: "#e3f2fd", fg: "#1565c0" }, "Queried": { bg: "#fff3e0", fg: "#e65100" }, "Overdue": { bg: "#ffebee", fg: "#c62828" }, "Paid": { bg: "#e8f5e9", fg: "#2e7d32" }, "Cancelled": { bg: "#f5f5f5", fg: "#bbb" } };
    var c = colors[status] || colors.Draft;
    return { display: "inline-block", fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 3, background: c.bg, color: c.fg, textTransform: "uppercase", letterSpacing: "0.03em" };
  };

  // Status dropdown style
  var statusSelectStyle = function(status) {
    var colors = { "Draft": { bg: "#f0f0f0", fg: "#888" }, "Sent": { bg: "#e3f2fd", fg: "#1565c0" }, "Queried": { bg: "#fff3e0", fg: "#e65100" }, "Overdue": { bg: "#ffebee", fg: "#c62828" }, "Paid": { bg: "#e8f5e9", fg: "#2e7d32" }, "Cancelled": { bg: "#f5f5f5", fg: "#bbb" } };
    var c = colors[status] || colors.Draft;
    return { border: "none", background: c.bg, color: c.fg, fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 3, cursor: "pointer", outline: "none", textTransform: "uppercase", letterSpacing: "0.03em", fontFamily: "inherit" };
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div><div style={s.pageTitle}>CRM</div><div style={Object.assign({}, s.pageSub, { marginBottom: 0 })}>Client relationship management & invoice history</div></div>
        <select value={selectedCustomer} onChange={function(e) { setSelectedCustomer(e.target.value); }}
          style={Object.assign({}, s.select, { width: 260, fontSize: 13, padding: "8px 14px" })}>
          {customers.map(function(c) { return React.createElement("option", { key: c, value: c }, c); })}
        </select>
      </div>

      {/* Client Header */}
      <div style={Object.assign({}, s.card, { marginBottom: 20 })}>
        <div style={s.cardBody}>
          <div className="grid-4">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 500, flexShrink: 0 }}>
                {selectedCustomer ? selectedCustomer[0] : "?"}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{selectedCustomer}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{custProjects.length} project{custProjects.length !== 1 ? "s" : ""} · {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 500 }}>{fmt(totalSaleExVat)}</div><div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.03em" }}>Invoiced (ex VAT)</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 500 }}>{pctCalc(totFinished, totItems)}%</div><div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.03em" }}>Completion</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 500 }}>{totItems}</div><div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.03em" }}>Line Items</div></div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* ── INVOICES ── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardTitle}>Invoices</span>
            <span style={{ fontSize: 11, color: "#888" }}>{invoices.length} total</span>
          </div>
          <div style={s.cardBody}>
            {loadingInvoices ? (
              React.createElement("div", { style: { textAlign: "center", padding: 20, color: "#999", fontSize: 12 } }, "Loading invoices...")
            ) : invoices.length === 0 ? (
              React.createElement("div", { style: { textAlign: "center", padding: 20, color: "#999", fontSize: 12 } }, "No invoices yet for this account")
            ) : invoices.map(function(inv) {
              return React.createElement("div", {
                key: inv._id || inv.invoiceId,
                style: { padding: "12px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" },
                onClick: function() { setSelectedInvoice(inv); },
                onMouseEnter: function(e) { e.currentTarget.style.background = "#fafafa"; },
                onMouseLeave: function(e) { e.currentTarget.style.background = "transparent"; }
              },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 } },
                  React.createElement("span", { style: { fontSize: 12, fontWeight: 500 } },
                    inv.invoiceId,
                    inv.xeroInvoiceNumber ? React.createElement("span", { style: { fontSize: 10, color: "#1565c0", marginLeft: 6, fontWeight: 400 } }, "Xero: " + inv.xeroInvoiceNumber) : null
                  ),
                  React.createElement("select", {
                    value: inv.status || "Draft",
                    onClick: function(e) { e.stopPropagation(); },
                    onChange: function(e) { e.stopPropagation(); updateInvoiceStatus(inv, e.target.value); },
                    style: statusSelectStyle(inv.status || "Draft")
                  }, INVOICE_STATUSES.map(function(st) {
                    return React.createElement("option", { key: st, value: st }, st);
                  }))
                ),
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888" } },
                  React.createElement("span", null, inv.ref + " · " + fmtDate(inv.createdDate)),
                  React.createElement("span", { style: { fontWeight: 500, color: "#333" } }, fmt(inv.totalInc || 0) + " inc VAT")
                )
              );
            })}
          </div>
        </div>

        {/* ── PROJECTS ── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardTitle}>Projects</span></div>
          <div style={s.cardBody}>
            {custProjects.map(function(p) {
              var st = projStats(p.items || [], p.timesheet || []);
              return React.createElement("div", { key: p.id, style: { padding: "12px 0", borderBottom: "1px solid #f5f5f5" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 6 } },
                  React.createElement("span", { style: { fontSize: 12, fontWeight: 500 } }, p.info.project),
                  React.createElement("span", { style: { fontSize: 11, color: "#888" } }, p.info.ref)
                ),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 } },
                  React.createElement("div", { style: Object.assign({}, s.progressBar, { flex: 1, height: 6 }) },
                    React.createElement("div", { style: s.progressFill(st.pct) })
                  ),
                  React.createElement("span", { style: { fontSize: 11, fontWeight: 500 } }, st.pct + "%")
                ),
                React.createElement("div", { style: { display: "flex", gap: 16, fontSize: 11, color: "#888" } },
                  React.createElement("span", null, st.finished + "/" + st.total + " items"),
                  React.createElement("span", null, "Due: " + fmtDate(p.info.deliveryDate || p.info.dateRequired))
                )
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ACCOUNT DETAILS + NOTES ── */}
      <div className="grid-2" style={{ marginTop: 20 }}>
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardTitle}>Account Details</span></div>
          <div style={s.cardBody}>
            {[["Account Manager", info.manager || "DH"], ["Email", info.email || "—"], ["Supplier", info.supplier || "Graphitecture"], ["Payment Terms", "30 days net"], ["Account Status", "Active — Good Standing"]].map(function(pair) {
              return React.createElement("div", { key: pair[0], style: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 } },
                React.createElement("span", { style: { color: "#888" } }, pair[0]),
                React.createElement("span", { style: { fontWeight: 500 } }, pair[1])
              );
            })}
          </div>
        </div>
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardTitle}>Account Notes</span></div>
          <div style={s.cardBody}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input style={Object.assign({}, s.input, { flex: 1 })} placeholder="Add a note..." value={newNote}
                onChange={function(e) { setNewNote(e.target.value); }}
                onKeyDown={function(e) { if (e.key === "Enter") addNote(); }} />
              <button style={s.btn()} onClick={addNote}>Add</button>
            </div>
            {notes.map(function(n) {
              return React.createElement("div", { key: n.id, style: { padding: "10px 0", borderBottom: "1px solid #f5f5f5" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 } },
                  React.createElement("span", { style: { fontSize: 11, fontWeight: 500 } }, n.author),
                  React.createElement("span", { style: { fontSize: 10, color: "#bbb" } }, n.date)
                ),
                React.createElement("div", { style: { fontSize: 12, color: "#555", lineHeight: 1.5 } }, n.text)
              );
            })}
          </div>
        </div>
      </div>

      {/* ── INVOICE PREVIEW MODAL ── */}
      {selectedInvoice && (function() {
        var inv = selectedInvoice;
        var lines = [];
        try { lines = JSON.parse(inv.lineItems || "[]"); } catch(e) {}

        return React.createElement("div", { className: "wizard-overlay", onClick: function() { setSelectedInvoice(null); } },
          React.createElement("div", { className: "wizard-modal", style: { width: 600, maxWidth: "95%" }, onClick: function(e) { e.stopPropagation(); } },
            React.createElement("div", { style: { padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" } },
              React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 15, fontWeight: 500 } }, "Invoice " + inv.invoiceId),
                React.createElement("div", { style: { fontSize: 12, color: "#888", marginTop: 2 } },
                  inv.customer + " · " + fmtDate(inv.createdDate),
                  inv.xeroInvoiceNumber ? React.createElement("span", { style: { marginLeft: 8, padding: "1px 6px", borderRadius: 3, background: "#e3f2fd", color: "#1565c0", fontSize: 10, fontWeight: 500 } }, "Xero " + inv.xeroInvoiceNumber) : null
                )
              ),
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                React.createElement("select", {
                  value: inv.status || "Draft",
                  onClick: function(e) { e.stopPropagation(); },
                  onChange: function(e) { updateInvoiceStatus(inv, e.target.value); },
                  style: statusSelectStyle(inv.status || "Draft")
                }, INVOICE_STATUSES.map(function(st) {
                  return React.createElement("option", { key: st, value: st }, st);
                })),
                React.createElement("button", { onClick: function() { setSelectedInvoice(null); }, style: { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" } }, "✕")
              )
            ),
            React.createElement("div", { style: { padding: 24 } },
              // Invoice header
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 24 } },
                React.createElement("div", null,
                  React.createElement("div", { style: { fontWeight: 500, fontSize: 14 } }, "Graphitecture"),
                  React.createElement("div", { style: { fontSize: 11, color: "#888" } }, "2a Endeavour Way, London SW19 8UH")
                ),
                React.createElement("div", { style: { textAlign: "right" } },
                  React.createElement("div", { style: { fontWeight: 500, fontSize: 14 } }, "INVOICE"),
                  React.createElement("div", { style: { fontSize: 11, color: "#888" } }, inv.ref),
                  inv.xeroInvoiceNumber ? React.createElement("div", { style: { fontSize: 10, color: "#1565c0", marginTop: 2 } }, "Xero Ref: " + inv.xeroInvoiceNumber) : null
                )
              ),
              // Bill to / date
              React.createElement("div", { className: "grid-2", style: { marginBottom: 20, fontSize: 12 } },
                React.createElement("div", null,
                  React.createElement("div", { style: { color: "#888", fontSize: 11, textTransform: "uppercase" } }, "Bill To"),
                  React.createElement("div", { style: { fontWeight: 500 } }, inv.customer)
                ),
                React.createElement("div", { style: { textAlign: "right" } },
                  React.createElement("div", { style: { color: "#888", fontSize: 11, textTransform: "uppercase" } }, "Date"),
                  React.createElement("div", { style: { fontWeight: 500 } }, fmtDate(inv.createdDate))
                )
              ),
              // Line items
              React.createElement("table", { style: Object.assign({}, s.table, { marginBottom: 16 }) },
                React.createElement("thead", null,
                  React.createElement("tr", null,
                    React.createElement("th", { style: s.th }, "Description"),
                    React.createElement("th", { style: Object.assign({}, s.th, { textAlign: "right" }) }, "Amount")
                  )
                ),
                React.createElement("tbody", null,
                  lines.map(function(line, idx) {
                    return React.createElement("tr", { key: idx },
                      React.createElement("td", { style: s.td }, line.desc + (line.process ? " — " + line.process : "")),
                      React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(line.salePrice || 0))
                    );
                  })
                )
              ),
              // Totals
              React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 12 } },
                React.createElement("div", { style: { display: "flex", gap: 40 } },
                  React.createElement("span", { style: { color: "#888" } }, "Subtotal"),
                  React.createElement("span", { style: { fontWeight: 500 } }, fmt(inv.totalSale || 0))
                ),
                React.createElement("div", { style: { display: "flex", gap: 40 } },
                  React.createElement("span", { style: { color: "#888" } }, "VAT (20%)"),
                  React.createElement("span", { style: { fontWeight: 500 } }, fmt(inv.totalVat || 0))
                ),
                React.createElement("div", { style: { display: "flex", gap: 40, paddingTop: 8, borderTop: "2px solid #111", marginTop: 4, fontSize: 16 } },
                  React.createElement("span", { style: { fontWeight: 500 } }, "Total"),
                  React.createElement("span", { style: { fontWeight: 500 } }, fmt(inv.totalInc || 0))
                )
              ),
              // Internal note (margin info)
              React.createElement("div", { style: { marginTop: 16, padding: "10px 14px", background: "#f5f5f5", borderRadius: 4, fontSize: 10, color: "#888" } },
                "Internal: Cost " + fmt(inv.totalCost || 0) + " · Margin " + (inv.blendedMargin || 0) + "% · Profit " + fmt((inv.totalSale || 0) - (inv.totalCost || 0))
              )
            ),
            React.createElement("div", { style: { padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end" } },
              React.createElement("button", { style: s.btn("secondary"), onClick: function() { setSelectedInvoice(null); } }, "Close")
            )
          )
        );
      })()}
    </div>
  );
}
