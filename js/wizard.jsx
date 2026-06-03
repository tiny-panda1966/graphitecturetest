function CreateProjectWizard({ onClose, onCreate, chargesData, userPrefs, onToggleFavourite, onAddToRecent }) {
  var [step, setStep] = useState(1);
  var [info, setInfo] = useState({
    customer: "GRAPHITECTURE", project: "",
    ref: "201-" + Math.floor(1600 + Math.random() * 100),
    manager: "DH", email: "david@graphitecture.co.uk",
    dateBooked: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    delivery: "TBC",
    supplier: "Graphitecture London"
  });
  var [lineItems, setLineItems] = useState([]);

  // Build groups list from charges DB or fallback
  var groups = chargesData ? Object.keys(chargesData).sort() : [];
  var defaultGroup = groups.length > 0 ? groups[0] : "";
  var defaultItem = chargesData && defaultGroup && chargesData[defaultGroup] && chargesData[defaultGroup].length > 0 ? chargesData[defaultGroup][0] : null;

  var [newItem, setNewItem] = useState({
    desc: "", processGroup: defaultGroup, process: defaultItem ? defaultItem.item : (MATERIAL_COSTS[0] || {}).name || "",
    costSqm: defaultItem ? defaultItem.costpersqm : (MATERIAL_COSTS[0] || {}).cost || 0,
    qty: 1, printW: 0, printH: 0,
    deliveryDate: "", duration: 1, durationUnit: "days", notes: ""
  });
  var [itemError, setItemError] = useState("");
  var [bulkOpen, setBulkOpen] = useState(false);
  var [bulkEditMode, setBulkEditMode] = useState(false);
  var artworkInputRef = useRef(null);
  var [artworkFile, setArtworkFile] = useState(null);
  var [preflightItem, setPreflightItem] = useState(null);
  var [renamingIdx, setRenamingIdx] = useState(null);
  var [renameValue, setRenameValue] = useState("");
  var lineFileRef = useRef(null);
  var [lineFileIdx, setLineFileIdx] = useState(null);

  var DURATION_UNITS = [
    { value: "minutes", label: "Minutes" },
    { value: "hours", label: "Hours" },
    { value: "days", label: "Days" },
    { value: "weeks", label: "Weeks" },
    { value: "months", label: "Months" }
  ];

  var addItem = function() {
    if (!newItem.desc.trim()) { setItemError("Please enter a description"); return; }
    if (!newItem.printW || !newItem.printH) { setItemError("Please enter width and height"); return; }
    if (!newItem.deliveryDate) { setItemError("Please set a delivery date"); return; }
    setItemError("");
    var costSqm = newItem.costSqm || 0;
    var sqm = (newItem.printW * newItem.printH / 1000000) * newItem.qty;
    var item = {
      id: lineItems.length + 1, desc: newItem.desc, file: artworkFile ? artworkFile.name : "TBC", status: "PENDING",
      process: newItem.process, processGroup: newItem.processGroup, finishing: "TBC",
      qty: newItem.qty, printW: newItem.printW, printH: newItem.printH,
      finW: newItem.printW, finH: newItem.printH,
      sqm: parseFloat(sqm.toFixed(2)), costSqm: costSqm,
      cost: parseFloat((sqm * costSqm).toFixed(2)),
      assignee: autoAssign(newItem.process),
      deliveryDate: newItem.deliveryDate || info.deliveryDate,
      duration: newItem.duration || 1,
      durationUnit: newItem.durationUnit || "days",
      notes: newItem.notes || "",
      _artworkFile: artworkFile || null
    };
    item.tasks = generateTasks(item);
    setLineItems(function(prev) { return prev.concat([item]); });
    setArtworkFile(null);
    if (artworkInputRef.current) artworkInputRef.current.value = "";
    setNewItem({
      desc: "", processGroup: newItem.processGroup, process: newItem.process,
      costSqm: newItem.costSqm,
      qty: 1, printW: 0, printH: 0,
      deliveryDate: info.deliveryDate, duration: 1, durationUnit: "days", notes: ""
    });
  };

  var handleBulkCreate = function(rows) {
    var newItems = rows.map(function(row, idx) {
      var sqm = ((row.printW || 0) * (row.printH || 0) / 1000000) * (row.qty || 1);
      var item = {
        id: lineItems.length + idx + 1, desc: row.desc, file: "TBC", status: "PENDING",
        process: row.process, processGroup: row.processGroup, finishing: "TBC",
        qty: row.qty || 1, printW: row.printW || 0, printH: row.printH || 0,
        finW: row.printW || 0, finH: row.printH || 0,
        sqm: parseFloat(sqm.toFixed(2)), costSqm: row.costSqm || 0,
        cost: parseFloat((sqm * (row.costSqm || 0)).toFixed(2)),
        assignee: autoAssign(row.process),
        deliveryDate: row.deliveryDate || info.deliveryDate,
        duration: 1, durationUnit: "days", notes: row.notes || ""
      };
      item.tasks = generateTasks(item);
      return item;
    });
    setLineItems(function(prev) { return prev.concat(newItems); });
    setBulkOpen(false);
  };

  var handleBulkEditSave = function(rows) {
    var editedItems = rows.map(function(row, idx) {
      var sqm = ((row.printW || 0) * (row.printH || 0) / 1000000) * (row.qty || 1);
      var item = {
        id: idx + 1, desc: row.desc, file: "TBC", status: "PENDING",
        process: row.process, processGroup: row.processGroup, finishing: "TBC",
        qty: row.qty || 1, printW: row.printW || 0, printH: row.printH || 0,
        finW: row.printW || 0, finH: row.printH || 0,
        sqm: parseFloat(sqm.toFixed(2)), costSqm: row.costSqm || 0,
        cost: parseFloat((sqm * (row.costSqm || 0)).toFixed(2)),
        assignee: autoAssign(row.process),
        deliveryDate: row.deliveryDate || info.deliveryDate,
        duration: row.duration || 1, durationUnit: row.durationUnit || "days", notes: row.notes || ""
      };
      item.tasks = generateTasks(item);
      return item;
    });
    setLineItems(editedItems);
    setBulkOpen(false);
    setBulkEditMode(false);
  };

  var removeItem = function(idx) {
    setLineItems(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); });
  };

  var duplicateItem = function(idx) {
    setLineItems(function(prev) {
      var original = prev[idx];
      var copy = Object.assign({}, original, {
        id: prev.length + 1,
        desc: original.desc + " (copy)",
        file: "TBC",
        _artworkFile: null,
        status: "PENDING",
        tasks: generateTasks(original)
      });
      return prev.concat([copy]);
    });
  };

  var handleLineFileChange = function(e) {
    var file = e.target.files && e.target.files[0];
    if (file && lineFileIdx !== null) {
      setLineItems(function(prev) {
        return prev.map(function(item, idx) {
          if (idx !== lineFileIdx) return item;
          return Object.assign({}, item, { file: file.name, _artworkFile: file });
        });
      });
    }
    setLineFileIdx(null);
    if (lineFileRef.current) lineFileRef.current.value = "";
  };

  var removeLineFile = function(idx) {
    setLineItems(function(prev) {
      return prev.map(function(item, i) {
        if (i !== idx) return item;
        return Object.assign({}, item, { file: "TBC", _artworkFile: null });
      });
    });
  };

  var finish = function() {
    onCreate({ info: Object.assign({}, info, { dateRequired: info.deliveryDate }), items: lineItems });
    onClose();
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #eee" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Create New Project</div>
            <div style={{ fontSize: 12, color: "#888" }}>Step {step} of 2 — {step === 1 ? "Project Details" : "Line Items"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
        </div>
        <div style={{ padding: "24px", maxHeight: "60vh", overflowY: "auto" }}>

          {/* ── STEP 1: Project Details ── */}
          {step === 1 && (
            <div className="grid-2" style={{ gap: 16 }}>
              {/* Customer with autocomplete */}
              <CustomerAutocomplete
                value={info.customer}
                onChange={function(val) { setInfo(Object.assign({}, info, { customer: val })); }}
                customerList={userPrefs ? userPrefs.customerList : []}
              />
              {[["Project Name", "project"], ["Reference", "ref"], ["Manager", "manager"]].map(function(pair) {
                return (
                  <div key={pair[1]}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>{pair[0]}</div>
                    <input style={s.input} value={info[pair[1]]} onChange={function(e) { setInfo(Object.assign({}, info, { [pair[1]]: e.target.value })); }} />
                  </div>
                );
              })}
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Date Booked</div>
                <input type="date" style={Object.assign({}, s.input, { background: "#f5f5f5", color: "#888" })} value={info.dateBooked} readOnly />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Project Delivery Date</div>
                <input type="date" style={s.input} value={info.deliveryDate} onChange={function(e) { setInfo(Object.assign({}, info, { deliveryDate: e.target.value })); }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Delivery Instructions</div>
                <input style={s.input} placeholder="e.g. Ship to Milan via freight" value={info.delivery} onChange={function(e) { setInfo(Object.assign({}, info, { delivery: e.target.value })); }} />
              </div>
            </div>
          )}

          {/* ── STEP 2: Project Items ── */}
          {step === 2 && (
            <div>
              {/* Input type tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <button style={Object.assign({}, s.btn(), { flex: 1, padding: "10px 16px", fontSize: 12 })}>
                  Line Items
                </button>
                <button style={{ flex: 1, padding: "10px 16px", fontSize: 12, background: "#f0f0f0", color: "#bbb", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "not-allowed" }}
                  disabled title="Coming in Phase 2">
                  Installation
                </button>
                <button style={{ flex: 1, padding: "10px 16px", fontSize: 12, background: "#f0f0f0", color: "#bbb", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "not-allowed" }}
                  disabled title="Coming in Phase 2">
                  Hire
                </button>
              </div>
              {/* Add item form */}
              <div style={{ background: "#fafafa", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #eee" }}>
                <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Description</div>
                    <input style={s.input} value={newItem.desc} placeholder="e.g. Entrance arch wrap"
                      onChange={function(e) { setItemError(""); setNewItem(Object.assign({}, newItem, { desc: e.target.value })); }}
                      onKeyDown={function(e) { if (e.key === "Enter") addItem(); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Print Material</div>
                    {chargesData ? (
                      <MaterialPicker
                        chargesData={chargesData}
                        selectedGroup={newItem.processGroup}
                        selectedItem={newItem.process}
                        selectedCost={newItem.costSqm}
                        favourites={userPrefs ? userPrefs.favouriteMaterials : []}
                        recents={userPrefs ? userPrefs.recentMaterials : []}
                        onToggleFavourite={onToggleFavourite}
                        onSelect={function(sel) {
                          setNewItem(Object.assign({}, newItem, { processGroup: sel.group, process: sel.item, costSqm: sel.costpersqm }));
                          if (onAddToRecent) onAddToRecent(sel.group, sel.item);
                        }}
                      />
                    ) : (
                      <select style={s.select} value={newItem.process} onChange={function(e) { setNewItem(Object.assign({}, newItem, { process: e.target.value })); }}>
                        {MATERIAL_COSTS.map(function(m) { return React.createElement("option", { key: m.name, value: m.name }, m.name + " (£" + m.cost + "/m²)"); })}
                      </select>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Qty</div>
                    <input style={s.input} type="number" value={newItem.qty} onChange={function(e) { setNewItem(Object.assign({}, newItem, { qty: parseInt(e.target.value) || 1 })); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>W (mm)</div>
                    <input style={s.input} type="number" value={newItem.printW} onChange={function(e) { setNewItem(Object.assign({}, newItem, { printW: parseInt(e.target.value) || 0 })); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>H (mm)</div>
                    <input style={s.input} type="number" value={newItem.printH} onChange={function(e) { setNewItem(Object.assign({}, newItem, { printH: parseInt(e.target.value) || 0 })); }} />
                  </div>
                </div>
                <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Duration</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={Object.assign({}, s.input, { width: 80 })} type="number" min="1" value={newItem.duration}
                        onChange={function(e) { setNewItem(Object.assign({}, newItem, { duration: parseInt(e.target.value) || 1 })); }} />
                      <select style={Object.assign({}, s.select, { flex: 1 })} value={newItem.durationUnit}
                        onChange={function(e) { setNewItem(Object.assign({}, newItem, { durationUnit: e.target.value })); }}>
                        {DURATION_UNITS.map(function(u) { return React.createElement("option", { key: u.value, value: u.value }, u.label); })}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Delivery Date</div>
                    <input type="date" style={s.input} value={newItem.deliveryDate}
                      onChange={function(e) { setNewItem(Object.assign({}, newItem, { deliveryDate: e.target.value })); }} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Notes</div>
                  <textarea style={Object.assign({}, s.input, { minHeight: 60, resize: "vertical", fontFamily: "inherit", fontSize: 12, lineHeight: 1.4 })}
                    value={newItem.notes || ""}
                    placeholder="Production notes, special requirements, client instructions..."
                    onChange={function(e) { setNewItem(Object.assign({}, newItem, { notes: e.target.value })); }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Artwork File</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input ref={artworkInputRef} type="file" accept=".pdf,.ai,.eps,.psd,.jpg,.jpeg,.png,.tiff,.tif,.svg"
                      style={{ fontSize: 11 }}
                      onChange={function(e) { setArtworkFile(e.target.files && e.target.files[0] ? e.target.files[0] : null); }} />
                    {artworkFile && (
                      <button onClick={function() { setArtworkFile(null); if (artworkInputRef.current) artworkInputRef.current.value = ""; }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 }}
                        onMouseEnter={function(e) { e.target.style.color = "#c00"; }}
                        onMouseLeave={function(e) { e.target.style.color = "#ccc"; }}>✕</button>
                    )}
                  </div>
                  {artworkFile && (
                    <div style={{ fontSize: 10, color: "#1565c0", marginTop: 4 }}>
                      {artworkFile.name} ({(artworkFile.size / 1024).toFixed(0)} KB) — will be uploaded to Print Ready Artwork
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    Steps: {(PROCESS_TASK_MAP[newItem.process] || DEFAULT_TASKS).map(function(tid) {
                      var td = PRODUCTION_TASKS.find(function(t) { return t.id === tid; });
                      return td ? td.label : tid;
                    }).join(" → ")}
                  </div>
                  {itemError && (
                    <div style={{ fontSize: 12, color: "#c00", padding: "8px 12px", background: "#fff5f5", borderRadius: 4, border: "1px solid #fdd", marginTop: 8 }}>
                      {itemError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button style={s.btn()} onClick={addItem}>+ Add Line Item</button>
                    {chargesData && <button style={s.btn("secondary")} onClick={function() { setBulkOpen(true); }}>Bulk Add</button>}
                  </div>
                </div>
              </div>

              {/* Line items table */}
              {lineItems.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{lineItems.length} line item{lineItems.length !== 1 ? "s" : ""}</div>
                    <button style={Object.assign({}, s.btn("secondary"), { fontSize: 10, padding: "4px 12px" })}
                      onClick={function() { setBulkEditMode(true); setBulkOpen(true); }}>
                      Bulk Edit All
                    </button>
                  </div>
                  <div className="table-wrap">
                  <table style={s.table}>
                    <thead><tr>
                      {["Description", "File", "Process", "Qty", "Size", "Duration", "Delivery", "Cost", ""].map(function(h) {
                        return React.createElement("th", { key: h, style: s.th }, h);
                      })}
                    </tr></thead>
                    <tbody>
                      {lineItems.map(function(li, i) {
                        return (
                          <tr key={i}>
                            <td style={Object.assign({}, s.td, { fontWeight: 500 })}>{li.desc}</td>
                            <td style={Object.assign({}, s.td, { fontSize: 10 })}>
                              {li.file && li.file !== "TBC" ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  {renamingIdx === i ? (
                                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                                      <input style={Object.assign({}, s.input, { fontSize: 10, padding: "2px 4px", width: 100 })} value={renameValue}
                                        onChange={function(e) { setRenameValue(e.target.value); }}
                                        onKeyDown={function(e) {
                                          if (e.key === "Enter" && renameValue.trim()) {
                                            setLineItems(function(prev) { return prev.map(function(item, idx) {
                                              if (idx !== i) return item;
                                              var newName = renameValue.trim();
                                              return Object.assign({}, item, { file: newName, _artworkFile: item._artworkFile ? new File([item._artworkFile], newName, { type: item._artworkFile.type }) : null });
                                            }); });
                                            setRenamingIdx(null);
                                          }
                                          if (e.key === "Escape") setRenamingIdx(null);
                                        }}
                                        autoFocus />
                                      <button onClick={function() { setRenamingIdx(null); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 10 }}>✕</button>
                                    </div>
                                  ) : (
                                    <span style={{ color: "#1565c0", cursor: "pointer" }} title={"Click to rename: " + li.file}
                                      onClick={function() { setRenamingIdx(i); setRenameValue(li.file); }}>
                                      📎 {li.file.length > 12 ? li.file.substring(0, 12) + "..." : li.file}
                                    </span>
                                  )}
                                  {li._artworkFile && (
                                    <button onClick={function() { setPreflightItem(li); }}
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 9, padding: "0 2px" }}
                                      title="Preflight check">⚡</button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#ccc" }}>—</span>
                              )}
                            </td>
                            <td style={Object.assign({}, s.td, { fontSize: 11 })}>{li.process}</td>
                            <td style={Object.assign({}, s.td, { textAlign: "center" })}>{li.qty}</td>
                            <td style={Object.assign({}, s.td, { fontSize: 11 })}>{li.printW}×{li.printH}</td>
                            <td style={Object.assign({}, s.td, { fontSize: 11 })}>{li.duration} {li.durationUnit}</td>
                            <td style={Object.assign({}, s.td, { fontSize: 11 })}>{li.deliveryDate ? fmtDate(li.deliveryDate) : "—"}</td>
                            <td style={Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 })}>{fmt(li.cost)}</td>
                            <td style={Object.assign({}, s.td, { textAlign: "center", width: 100 })}>
                              <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                                <button onClick={function() { setLineFileIdx(i); lineFileRef.current && lineFileRef.current.click(); }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: li.file && li.file !== "TBC" ? "#555" : "#1565c0", fontSize: 9, padding: "1px 4px" }}
                                  title={li.file && li.file !== "TBC" ? "Change file" : "Upload artwork"}>
                                  {li.file && li.file !== "TBC" ? "📎↻" : "📎+"}
                                </button>
                                {li._artworkFile && (
                                  <button onClick={function() { setPreflightItem(li); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#f59e0b", fontSize: 9, padding: "1px 4px" }}
                                    title="Preflight check">⚡</button>
                                )}
                                {li.file && li.file !== "TBC" && (
                                  <button onClick={function() { removeLineFile(i); }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 9, padding: "1px 4px" }}
                                    onMouseEnter={function(e) { e.target.style.color = "#c00"; }}
                                    onMouseLeave={function(e) { e.target.style.color = "#ccc"; }}
                                    title="Remove file">📎✕</button>
                                )}
                                <button onClick={function() { duplicateItem(i); }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 11, padding: "1px 4px" }}
                                  onMouseEnter={function(e) { e.target.style.color = "#1565c0"; }}
                                  onMouseLeave={function(e) { e.target.style.color = "#bbb"; }}
                                  title="Duplicate">⧉</button>
                                <button onClick={function() { removeItem(i); }}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: "1px 4px" }}
                                  onMouseEnter={function(e) { e.target.style.color = "#c00"; }}
                                  onMouseLeave={function(e) { e.target.style.color = "#ccc"; }}
                                  title="Remove item">✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #111" }}>
                        <td colSpan={4} style={Object.assign({}, s.td, { fontWeight: 500 })}>TOTAL ({lineItems.length} items)</td>
                        <td style={s.td}></td>
                        <td style={s.td}></td>
                        <td style={Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 })}>{fmt(lineItems.reduce(function(a, i) { return a + i.cost; }, 0))}</td>
                        <td style={s.td}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                </div>
              )}
              {lineItems.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: "#999", fontSize: 12 }}>
                  Add line items above. Each line item has its own delivery date and duration.
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 24px", borderTop: "1px solid #eee" }}>
          {step === 1 ? React.createElement("div", null) : React.createElement("button", { style: s.btn("secondary"), onClick: function() { setStep(1); } }, "← Back")}
          {step === 1
            ? React.createElement("button", { style: s.btn(), onClick: function() { if (!info.customer.trim() || !info.project.trim() || !info.deliveryDate) return; setStep(2); setNewItem(Object.assign({}, newItem, { deliveryDate: info.deliveryDate })); } }, "Next →")
            : React.createElement("button", { style: s.btn(), onClick: finish, disabled: lineItems.length === 0 }, lineItems.length === 0 ? "Add items first" : "Create Project")
          }
        </div>
      </div>
      {bulkOpen && chargesData && (
        <BulkLineEditor
          chargesData={chargesData}
          userPrefs={userPrefs}
          onToggleFavourite={onToggleFavourite}
          onAddToRecent={onAddToRecent}
          onCreateAll={bulkEditMode ? handleBulkEditSave : handleBulkCreate}
          onClose={function() { setBulkOpen(false); setBulkEditMode(false); }}
          templateItem={bulkEditMode ? null : null}
          editRows={bulkEditMode ? lineItems : null}
          editMode={bulkEditMode}
        />
      )}
      {preflightItem && preflightItem._artworkFile && (
        <PreflightModal
          file={{ name: preflightItem.file, size: preflightItem._artworkFile.size }}
          onClose={function() { setPreflightItem(null); }}
          localBlob={preflightItem._artworkFile}
        />
      )}

      {/* Hidden file input for line item file change */}
      <input ref={lineFileRef} type="file" accept=".pdf,.ai,.eps,.psd,.jpg,.jpeg,.png,.tiff,.tif,.svg"
        style={{ display: "none" }} onChange={handleLineFileChange} />
    </div>
  );
}
