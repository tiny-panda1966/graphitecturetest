function XeroExport({ items, timesheet, info, projectId, userEmail }) {
  var [exporting, setExporting] = useState(false);
  var [step, setStep] = useState(0);
  var [done, setDone] = useState(false);
  var [toastVisible, setToastVisible] = useState(false);
  var [toastMsg, setToastMsg] = useState("");

  // Confirmation modal state
  var [showConfirm, setShowConfirm] = useState(false);
  var [confirmStep, setConfirmStep] = useState(1);

  // ── Xero connection state ──
  var [xeroStatus, setXeroStatus] = useState(null); // null = loading, { connected, expired }
  var [xeroLoading, setXeroLoading] = useState(true);

  // Check Xero connection on mount — auto-refresh if expired
  useEffect(function() {
    if (DB.isLive() && userEmail) {
      DB.getXeroConnectionStatus(userEmail).then(function(status) {
        if (status && status.connected && status.expired) {
          // Try auto-refresh
          console.log("Xero token expired, attempting refresh...");
          DB.refreshXeroToken(userEmail).then(function(result) {
            if (result && result.success) {
              console.log("Xero token refreshed successfully");
              setXeroStatus({ connected: true, expired: false });
            } else {
              console.error("Xero token refresh failed:", result);
              setXeroStatus({ connected: true, expired: true });
            }
            setXeroLoading(false);
          }).catch(function() {
            setXeroStatus({ connected: true, expired: true });
            setXeroLoading(false);
          });
        } else {
          setXeroStatus(status);
          setXeroLoading(false);
        }
      }).catch(function() {
        setXeroStatus({ connected: false });
        setXeroLoading(false);
      });
    } else {
      setXeroStatus({ connected: false });
      setXeroLoading(false);
    }
  }, []);

  // Connect to Xero
  var connectToXero = function() {
    if (!DB.isLive() || !userEmail) return;
    DB.getXeroAuthUrl(userEmail).then(function(url) {
      window.open(url, "xero-auth", "width=600,height=700");
    });
    // Listen for callback
    var handler = function(e) {
      if (e.data && e.data.type === "xero-auth-complete") {
        window.removeEventListener("message", handler);
        if (e.data.success) {
          setXeroStatus({ connected: true, expired: false });
          setToastMsg("Connected to Xero"); setToastVisible(true);
          setTimeout(function() { setToastVisible(false); }, 3000);
        }
      }
    };
    window.addEventListener("message", handler);
  };

  // ── Pricing ──

  // Calculate costs
  var totalProdCharge = items.reduce(function(a, i) { return a + (i.cost || 0); }, 0);
  var totalLabour = timesheet.reduce(function(a, t) { return a + (t.cost || 0); }, 0);

  // Get pricing for a line item — sale price IS the production charge
  var getLinePrice = function(item) {
    var prodCharge = item.cost || 0;
    // Proportional labour allocation (by production charge share)
    var labourShare = totalProdCharge > 0 ? (prodCharge / totalProdCharge) * totalLabour : 0;
    var salePrice = prodCharge; // Sale price = production charge (rate card)
    var profit = salePrice - labourShare;

    return { prodCharge: prodCharge, labourShare: labourShare, salePrice: salePrice, profit: profit };
  };

  // Totals
  var pricingRows = items.map(function(item) { return Object.assign({ item: item }, getLinePrice(item)); });
  var totalSale = pricingRows.reduce(function(a, r) { return a + r.salePrice; }, 0);
  var totalProfit = totalSale - totalLabour;

  // Export steps
  var [exportSteps, setExportSteps] = useState([
    "Connecting to Xero API...", "Authenticating...",
    "Creating invoice draft...", "Adding line items...",
    "Applying tax rates (20% VAT)...", "Validating totals...",
    "Invoice created successfully."
  ]);

  var handleExportClick = function() { setShowConfirm(true); setConfirmStep(1); };

  var confirmProjectComplete = function(isComplete) {
    if (!isComplete) {
      setShowConfirm(false);
      setToastMsg("Export cancelled — project not yet complete");
      setToastVisible(true);
      setTimeout(function() { setToastVisible(false); }, 3000);
      return;
    }
    if (DB.isLive()) {
      DB.updateProject(projectId, { status: "Complete" }).catch(function(err) { console.error("DB: Failed to update project status", err); });
    }
    setConfirmStep(2);
  };

  var confirmSocialSharing = function(enableSharing) {
    setShowConfirm(false);
    if (enableSharing && DB.isLive()) {
      DB.updateProject(projectId, { shareOnSocials: true }).catch(function(err) { console.error("DB: Failed to update social sharing", err); });
      DB.addNotification({
        recipientEmail: "jasmin@graphitecture.co.uk", projectId: projectId, type: "social_approval", scope: "personal",
        message: info.customer + " — " + info.project + " (" + info.ref + ") has been approved for social media sharing",
        read: false, timestamp: new Date()
      }).catch(function(err) { console.error("DB: Failed to create notification", err); });
    }
    startExport();
  };

  var [savedInvoiceId, setSavedInvoiceId] = useState(null);
  var [xeroResult, setXeroResult] = useState(null);

  var startExport = function() {
    setExporting(true); setStep(0); setDone(false); setXeroResult(null);
    var invId = "INV-" + info.ref + "-" + Date.now().toString(36).toUpperCase();
    setSavedInvoiceId(invId);

    var isLiveXero = xeroStatus && xeroStatus.connected && !xeroStatus.expired;
    var stepLabels = isLiveXero ? [
      "Connecting to Xero API...", "Authenticating...",
      "Creating invoice in Xero...", "Adding line items...",
      "Applying VAT...", "Saving to local database...",
      "Invoice created successfully."
    ] : [
      "Connecting to Xero API...", "Authenticating OAuth 2.0...",
      "Creating invoice draft...", "Adding line items (sale prices)...",
      "Applying tax rates (20% VAT)...", "Validating totals...",
      "Invoice saved locally."
    ];
    setExportSteps(stepLabels);

    var i = 0;
    var iv = setInterval(function() {
      i++;
      if (i >= stepLabels.length) {
        clearInterval(iv);

        // Save invoice to local DB
        if (DB.isLive()) {
          var invoiceData = {
            invoiceId: invId, projectId: projectId, customer: info.customer, ref: info.ref,
            status: "Draft",
            lineItems: JSON.stringify(pricingRows.map(function(r) {
              return { desc: r.item.desc, process: r.item.process, prodCharge: r.prodCharge, labourShare: r.labourShare, salePrice: r.salePrice, profit: r.profit };
            })),
            totalCost: totalLabour, totalSale: totalSale,
            totalVat: parseFloat((totalSale * 0.2).toFixed(2)),
            totalInc: parseFloat((totalSale * 1.2).toFixed(2)),
            blendedMargin: totalSale > 0 ? Math.round(totalProfit / totalSale * 100) : 0, defaultMargin: 0,
            createdDate: new Date()
          };

          // If connected to Xero, create real invoice
          if (isLiveXero && userEmail) {
            DB.xeroCreateInvoice(userEmail, {
              customer: info.customer, ref: info.ref,
              dueDate: info.deliveryDate || info.dateRequired || null,
              lineItems: pricingRows.map(function(r) { return { desc: r.item.desc, process: r.item.process, salePrice: r.salePrice }; })
            }).then(function(result) {
              setXeroResult(result);
              if (result && result.success) {
                invoiceData.xeroInvoiceId = result.xeroInvoiceId;
                invoiceData.xeroInvoiceNumber = result.xeroInvoiceNumber;
                invoiceData.status = "Sent";
              }
              DB.createInvoice(invoiceData).catch(function(err) { console.error("DB: Failed to save invoice", err); });
              setDone(true);
              setToastMsg(result && result.success ? "Invoice created in Xero" : "Invoice saved locally (Xero error)");
              setToastVisible(true);
              setTimeout(function() { setToastVisible(false); }, 3000);
            }).catch(function(err) {
              console.error("Xero export error:", err);
              DB.createInvoice(invoiceData).catch(function(e) { console.error("DB: Failed to save invoice", e); });
              setDone(true);
              setToastMsg("Invoice saved locally — Xero connection failed");
              setToastVisible(true);
              setTimeout(function() { setToastVisible(false); }, 3000);
            });
          } else {
            // Demo mode — just save locally
            DB.createInvoice(invoiceData).catch(function(err) { console.error("DB: Failed to save invoice", err); });
            setDone(true);
            setToastMsg("Invoice saved locally — connect Xero for live export");
            setToastVisible(true);
            setTimeout(function() { setToastVisible(false); }, 3000);
          }
        } else {
          setDone(true);
        }
      }
      setStep(i);
    }, isLiveXero ? 1200 : 800);
  };

  return (
    <div className="page-container">
      <div style={s.pageTitle}>Export to Xero</div>
      <div style={s.pageSub}>Review sale values and export invoice to Xero</div>

      {/* ── PRICING TABLE ── */}
      <div style={Object.assign({}, s.card, { marginBottom: 20 })}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Invoice Line Items</span>
          <span style={{ fontSize: 11, color: "#888" }}>Sale prices from rate card — labour shown as production cost</span>
        </div>
        <div className="table-wrap">
          <table style={s.table}>
            <thead><tr>
              {["Line Item", "Process", "Sq m", "Rate (£/m²)", "Sale Price", "Labour", "Profit"].map(function(h) {
                return React.createElement("th", { key: h, style: s.th }, h);
              })}
            </tr></thead>
            <tbody>
              {pricingRows.map(function(row) {
                return React.createElement("tr", { key: row.item.id },
                  React.createElement("td", { style: Object.assign({}, s.td, { fontWeight: 500 }) }, row.item.desc),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 11, color: "#888" }) }, row.item.process),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontSize: 11 }) }, (row.item.sqm || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontSize: 11 }) }, "£" + (row.item.costSqm || 0).toFixed(2)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(row.salePrice)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontSize: 11, color: "#c00" }) }, row.labourShare > 0 ? "−" + fmt(row.labourShare) : "—"),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500, color: row.profit >= 0 ? "#2e7d32" : "#c62828" }) }, fmt(row.profit))
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #111" }}>
                <td colSpan={4} style={Object.assign({}, s.td, { fontWeight: 500 })}>TOTALS</td>
                <td style={Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 })}>{fmt(totalSale)}</td>
                <td style={Object.assign({}, s.td, { textAlign: "right", fontWeight: 500, color: "#c00" })}>{totalLabour > 0 ? "−" + fmt(totalLabour) : "—"}</td>
                <td style={Object.assign({}, s.td, { textAlign: "right", fontWeight: 500, color: totalProfit >= 0 ? "#2e7d32" : "#c62828" })}>{fmt(totalProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── INVOICE PREVIEW + EXPORT ── */}
      <div className="grid-2">
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardTitle}>Invoice Preview</span><span style={Object.assign({}, s.tag, { background: done ? "#111" : "#f0f0f0", color: done ? "#fff" : "#999" })}>{done ? "EXPORTED" : "DRAFT"}</span></div>
          <div style={s.cardBody}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div><div style={{ fontWeight: 500, fontSize: 14 }}>Graphitecture</div><div style={{ fontSize: 11, color: "#888" }}>2a Endeavour Way, London SW19 8UH</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontWeight: 500, fontSize: 14 }}>INVOICE</div><div style={{ fontSize: 11, color: "#888" }}>{info.ref}</div></div>
            </div>
            <div className="grid-2" style={{ marginBottom: 20, fontSize: 12 }}>
              <div><div style={{ color: "#888", fontSize: 11, textTransform: "uppercase" }}>Bill To</div><div style={{ fontWeight: 500 }}>{info.customer}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ color: "#888", fontSize: 11, textTransform: "uppercase" }}>Date</div><div style={{ fontWeight: 500 }}>{fmtDate(info.deliveryDate || info.dateRequired)}</div></div>
            </div>
            <table style={Object.assign({}, s.table, { marginBottom: 16 })}>
              <thead><tr><th style={s.th}>Description</th><th style={Object.assign({}, s.th, { textAlign: "right" })}>Amount</th></tr></thead>
              <tbody>
                {pricingRows.map(function(row) {
                  return React.createElement("tr", { key: row.item.id },
                    React.createElement("td", { style: s.td }, row.item.desc + " — " + row.item.process),
                    React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 }) }, fmt(row.salePrice))
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 12 }}>
              <div style={{ display: "flex", gap: 40 }}><span style={{ color: "#888" }}>Subtotal</span><span style={{ fontWeight: 500 }}>{fmt(totalSale)}</span></div>
              <div style={{ display: "flex", gap: 40 }}><span style={{ color: "#888" }}>VAT (20%)</span><span style={{ fontWeight: 500 }}>{fmt(totalSale * 0.2)}</span></div>
              <div style={{ display: "flex", gap: 40, paddingTop: 8, borderTop: "2px solid #111", marginTop: 4, fontSize: 16 }}><span style={{ fontWeight: 500 }}>Total</span><span style={{ fontWeight: 500 }}>{fmt(totalSale * 1.2)}</span></div>
            </div>
            <div style={{ marginTop: 16, padding: "10px 14px", background: "#f5f5f5", borderRadius: 4, fontSize: 10, color: "#888" }}>
              Sale prices from rate card. Labour ({fmt(totalLabour)}) is a production cost and is not included in the invoice value.
            </div>
          </div>
        </div>
        <div>
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>Xero Integration</span>
              {xeroLoading ? React.createElement("span", { style: { fontSize: 11, color: "#888" } }, "Checking...") :
                xeroStatus && xeroStatus.connected && !xeroStatus.expired ?
                  React.createElement("span", { style: { fontSize: 9, padding: "2px 8px", borderRadius: 3, background: "#e8f5e9", color: "#2e7d32", fontWeight: 500 } }, "CONNECTED") :
                xeroStatus && xeroStatus.connected && xeroStatus.expired ?
                  React.createElement("span", { style: { fontSize: 9, padding: "2px 8px", borderRadius: 3, background: "#fff3e0", color: "#e65100", fontWeight: 500 } }, "EXPIRED — RECONNECT") :
                  React.createElement("span", { style: { fontSize: 9, padding: "2px 8px", borderRadius: 3, background: "#f0f0f0", color: "#888", fontWeight: 500 } }, "NOT CONNECTED")
              }
            </div>
            <div style={s.cardBody}>
              {/* Not connected */}
              {!xeroLoading && xeroStatus && !xeroStatus.connected && (
                <div>
                  <div style={{ padding: "16px 20px", background: "#f5f5f5", borderRadius: 4, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Connect your Xero account</div>
                    <div style={{ color: "#666" }}>Link your Xero account to create invoices directly. You'll be redirected to Xero to authorise access.</div>
                  </div>
                  <button style={Object.assign({}, s.btn(), { width: "100%", padding: "12px 0", fontSize: 13, marginBottom: 16 })} onClick={connectToXero}>
                    Connect to Xero
                  </button>
                  <div style={{ borderTop: "1px solid #eee", paddingTop: 16 }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Or save invoice locally without Xero:</div>
                  </div>
                </div>
              )}
              {/* Connected but expired */}
              {!xeroLoading && xeroStatus && xeroStatus.connected && xeroStatus.expired && (
                <div>
                  <div style={{ padding: "12px 16px", background: "#fff3e0", borderRadius: 4, marginBottom: 16, fontSize: 12 }}>
                    <div style={{ fontWeight: 500, color: "#e65100", marginBottom: 2 }}>Xero Session Expired</div>
                    <div style={{ color: "#666" }}>Your Xero connection has expired. Please reconnect to create invoices.</div>
                  </div>
                  <button style={Object.assign({}, s.btn(), { width: "100%", padding: "12px 0", fontSize: 13, marginBottom: 16 })} onClick={connectToXero}>
                    Reconnect to Xero
                  </button>
                  <div style={{ borderTop: "1px solid #eee", paddingTop: 16 }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Or save invoice locally without Xero:</div>
                  </div>
                </div>
              )}
              {/* Connected and valid */}
              {!xeroLoading && xeroStatus && xeroStatus.connected && !xeroStatus.expired && (
                <div style={{ padding: "12px 16px", background: "#e8f5e9", borderRadius: 4, marginBottom: 16, fontSize: 12 }}>
                  <div style={{ fontWeight: 500, color: "#2e7d32", marginBottom: 2 }}>Xero Connected</div>
                  <div style={{ color: "#666" }}>Invoices will be created directly in your Xero account.</div>
                </div>
              )}
              {!exporting && !done && React.createElement("button", { style: Object.assign({}, s.btn(), { width: "100%", padding: "12px 0", fontSize: 13 }), onClick: handleExportClick },
                xeroStatus && xeroStatus.connected && !xeroStatus.expired ? "Create Invoice in Xero" : "Save Invoice Locally"
              )}
              {exporting && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {exportSteps.map(function(st, i) {
                    return React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, opacity: i <= step ? 1 : 0.3, transition: "opacity 0.3s" } },
                      React.createElement("div", { style: { width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: i < step ? "#111" : i === step ? "#fff" : "#f0f0f0", color: i < step ? "#fff" : "#111", border: i === step ? "2px solid #111" : "none", flexShrink: 0 } },
                        i < step ? "✓" : i === step && !done ? React.createElement("div", { style: { width: 6, height: 6, borderRadius: "50%", background: "#111", animation: "pulse 1s infinite" } }) : ""
                      ),
                      React.createElement("span", { style: { fontWeight: i === step ? 500 : 400 } }, st)
                    );
                  })}
                </div>
              )}
              {done && (
                <div style={{ marginTop: 16, padding: "16px 20px", background: "#f5f5f5", borderRadius: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>Export Complete</div>
                  <div style={{ fontSize: 12, color: "#666" }}>Invoice INV-{info.ref} created as draft. Total: {fmt(totalSale * 1.2)} (inc. VAT).</div>
                  <button style={Object.assign({}, s.btn("secondary"), { marginTop: 12, fontSize: 11 })} onClick={function() {
                    setExporting(false); setDone(false);
                    setXeroLoading(true);
                    if (DB.isLive() && userEmail) {
                      DB.getXeroConnectionStatus(userEmail).then(function(status) {
                        if (status && status.connected && status.expired) {
                          DB.refreshXeroToken(userEmail).then(function(result) {
                            if (result && result.success) {
                              setXeroStatus({ connected: true, expired: false });
                              setToastMsg("Xero connection verified"); setToastVisible(true);
                            } else {
                              setXeroStatus({ connected: true, expired: true });
                              setToastMsg("Xero session expired — please reconnect"); setToastVisible(true);
                            }
                            setTimeout(function() { setToastVisible(false); }, 3000);
                            setXeroLoading(false);
                          });
                        } else {
                          setXeroStatus(status);
                          setToastMsg(status && status.connected ? "Xero connection verified" : "Not connected to Xero");
                          setToastVisible(true);
                          setTimeout(function() { setToastVisible(false); }, 3000);
                          setXeroLoading(false);
                        }
                      });
                    } else { setXeroLoading(false); }
                  }}>Verify Connection</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="wizard-overlay" onClick={function() { setShowConfirm(false); }}>
          <div className="wizard-modal" style={{ width: 440, maxWidth: "90%" }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Export to Xero</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{info.customer} — {info.project}</div>
            </div>
            <div style={{ padding: 24 }}>
              {confirmStep === 1 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Is this project fully complete?</div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
                    Confirming this will mark the project as complete and generate the Xero invoice at the sale prices shown above.
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button style={s.btn("secondary")} onClick={function() { confirmProjectComplete(false); }}>No, not yet</button>
                    <button style={s.btn()} onClick={function() { confirmProjectComplete(true); }}>Yes, project is complete</button>
                  </div>
                </div>
              )}
              {confirmStep === 2 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Enable social media sharing?</div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                    Would you like to approve this project for social media sharing? This will notify Jasmin Lynch that the project is available for promotion.
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button style={s.btn("secondary")} onClick={function() { confirmSocialSharing(false); }}>No, skip</button>
                    <button style={s.btn()} onClick={function() { confirmSocialSharing(true); }}>Yes, enable sharing</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMsg} visible={toastVisible} />
    </div>
  );
}
