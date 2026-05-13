function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? "visible" : ""}`}>
      <span style={{ fontSize: 16 }}>✓</span> {message}
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div style={{ ...s.card, ...s.stat }}>
      <div style={s.statVal}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function ProgressBar({ pct, label }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{pct}%</span>
      </div>
      <div style={s.progressBar}><div style={s.progressFill(pct)} /></div>
    </div>
  );
}

function KVRow({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 }}>
      <span style={{ color: "#888" }}>{k}</span>
      <span style={{ fontWeight: 500 }}>{v}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MATERIAL PICKER — Modal with group tabs, search, item selection
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// CUSTOMER AUTOCOMPLETE — Type-ahead for customer names
// ═══════════════════════════════════════════════════════════════

function CustomerAutocomplete({ value, onChange, customerList }) {
  var [focused, setFocused] = useState(false);
  var [showSuggestions, setShowSuggestions] = useState(false);

  var suggestions = (customerList || []).filter(function(name) {
    if (!value || !value.trim()) return false;
    return name.toLowerCase().indexOf(value.toLowerCase()) >= 0 && name.toLowerCase() !== value.toLowerCase();
  });

  var handleChange = function(e) {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  var selectSuggestion = function(name) {
    onChange(name);
    setShowSuggestions(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Customer</div>
      <input
        style={s.input}
        value={value}
        onChange={handleChange}
        onFocus={function() { setFocused(true); setShowSuggestions(true); }}
        onBlur={function() { setTimeout(function() { setFocused(false); setShowSuggestions(false); }, 200); }}
        placeholder="Type customer name..."
      />
      {showSuggestions && focused && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "#fff", border: "1px solid #e0e0e0", borderTop: "none",
          borderRadius: "0 0 6px 6px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          maxHeight: 180, overflowY: "auto"
        }}>
          {suggestions.map(function(name) {
            return React.createElement("div", {
              key: name,
              onMouseDown: function(e) { e.preventDefault(); selectSuggestion(name); },
              style: { padding: "8px 12px", cursor: "pointer", fontSize: 12, borderBottom: "1px solid #f5f5f5" },
              onMouseEnter: function(e) { e.currentTarget.style.background = "#f0f7ff"; },
              onMouseLeave: function(e) { e.currentTarget.style.background = "transparent"; }
            }, name);
          })}
        </div>
      )}
    </div>
  );
}

function MaterialPicker({ chargesData, selectedGroup, selectedItem, selectedCost, onSelect, favourites, recents, onToggleFavourite }) {
  var [open, setOpen] = useState(false);
  var [activeTab, setActiveTab] = useState(selectedGroup || "");
  var [search, setSearch] = useState("");

  var groups = chargesData ? Object.keys(chargesData).sort() : [];
  var favList = favourites || [];
  var recList = recents || [];

  // Flatten all items for lookup
  var allItems = [];
  if (chargesData) {
    groups.forEach(function(g) {
      chargesData[g].forEach(function(item) {
        allItems.push(Object.assign({}, item, { _group: g }));
      });
    });
  }

  var openPicker = function() {
    // Default to favourites if user has some, otherwise selected group
    setActiveTab(favList.length > 0 ? "★ FAVOURITES" : (selectedGroup || groups[0] || ""));
    setSearch("");
    setOpen(true);
  };

  // Get filtered items based on active tab and search
  var getFilteredItems = function() {
    if (!chargesData) return [];

    // Search mode — across ALL items
    if (search.trim()) {
      var query = search.toLowerCase();
      return allItems.filter(function(item) {
        return item.item.toLowerCase().indexOf(query) >= 0 || item._group.toLowerCase().indexOf(query) >= 0;
      });
    }

    // Favourites tab
    if (activeTab === "★ FAVOURITES") {
      return allItems.filter(function(item) { return favList.indexOf(item.item) >= 0; });
    }

    // Recent tab
    if (activeTab === "🕐 RECENT") {
      var recItems = [];
      recList.forEach(function(r) {
        var match = allItems.find(function(a) { return a.item === r.item && a._group === r.group; });
        if (match) recItems.push(match);
      });
      return recItems;
    }

    // Group tab
    return (chargesData[activeTab] || []).map(function(item) {
      return Object.assign({}, item, { _group: activeTab });
    });
  };

  var filteredItems = getFilteredItems();
  var isSearching = search.trim().length > 0;

  var handleSelect = function(item) {
    onSelect({ group: item._group || item.group, item: item.item, costpersqm: item.costpersqm || 0 });
    setOpen(false);
  };

  var isFavourited = function(itemName) { return favList.indexOf(itemName) >= 0; };

  return (
    <div>
      {/* Selection display card */}
      <div onClick={openPicker} style={{
        border: "1px solid #e0e0e0", borderRadius: 6, padding: "10px 14px", cursor: "pointer",
        background: "#fafafa", transition: "border-color 0.2s",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}
        onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#999"; }}
        onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#e0e0e0"; }}>
        {selectedItem ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, color: "#1565c0", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{selectedGroup}</div>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedItem}</div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#999" }}>No material selected</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
          {selectedItem && React.createElement("span", { style: { fontSize: 12, fontWeight: 500, color: "#1565c0" } }, "£" + (selectedCost || 0).toFixed(2) + "/m²")}
          <span style={{ fontSize: 11, color: "#999" }}>✎</span>
        </div>
      </div>

      {/* Picker modal */}
      {open && (
        <div className="wizard-overlay" onClick={function() { setOpen(false); }} style={{ zIndex: 10000 }}>
          <div className="wizard-modal" style={{ width: 720, maxWidth: "95%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
            onClick={function(e) { e.stopPropagation(); }}>

            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Select Material</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{groups.length} categories · {allItems.length} items{favList.length > 0 ? " · " + favList.length + " favourites" : ""}</div>
              </div>
              <button onClick={function() { setOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
            </div>

            {/* Search bar */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#ccc", pointerEvents: "none" }}>🔍</span>
                <input
                  style={Object.assign({}, s.input, { paddingLeft: 32, fontSize: 13, background: "#fafafa" })}
                  placeholder="Search materials..."
                  value={search}
                  onChange={function(e) { setSearch(e.target.value); }}
                  autoFocus />
              </div>
            </div>

            {/* Body: tabs + items */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

              {/* Group tabs (left) */}
              {!isSearching && (
                <div style={{ width: 180, borderRight: "1px solid #f0f0f0", overflowY: "auto", flexShrink: 0 }}>
                  {/* Favourites tab */}
                  {favList.length > 0 && React.createElement("div", {
                    onClick: function() { setActiveTab("★ FAVOURITES"); },
                    style: {
                      padding: "10px 14px", cursor: "pointer", fontSize: 11, fontWeight: activeTab === "★ FAVOURITES" ? 600 : 400,
                      background: activeTab === "★ FAVOURITES" ? "#fffde7" : "transparent",
                      color: activeTab === "★ FAVOURITES" ? "#f9a825" : "#888",
                      borderLeft: activeTab === "★ FAVOURITES" ? "3px solid #f9a825" : "3px solid transparent",
                      borderBottom: "1px solid #f5f5f5"
                    }
                  },
                    React.createElement("div", null, "★ Favourites"),
                    React.createElement("div", { style: { fontSize: 9, color: "#ccc", marginTop: 2 } }, favList.length + " item" + (favList.length !== 1 ? "s" : ""))
                  )}

                  {/* Recent tab */}
                  {recList.length > 0 && React.createElement("div", {
                    onClick: function() { setActiveTab("🕐 RECENT"); },
                    style: {
                      padding: "10px 14px", cursor: "pointer", fontSize: 11, fontWeight: activeTab === "🕐 RECENT" ? 600 : 400,
                      background: activeTab === "🕐 RECENT" ? "#f5f5f5" : "transparent",
                      color: activeTab === "🕐 RECENT" ? "#555" : "#888",
                      borderLeft: activeTab === "🕐 RECENT" ? "3px solid #888" : "3px solid transparent",
                      borderBottom: "1px solid #f5f5f5"
                    }
                  },
                    React.createElement("div", null, "🕐 Recent"),
                    React.createElement("div", { style: { fontSize: 9, color: "#ccc", marginTop: 2 } }, recList.length + " item" + (recList.length !== 1 ? "s" : ""))
                  )}

                  {/* Divider if favourites or recents exist */}
                  {(favList.length > 0 || recList.length > 0) && React.createElement("div", {
                    style: { height: 1, background: "#e0e0e0", margin: "4px 14px" }
                  })}

                  {/* Group tabs */}
                  {groups.map(function(g) {
                    var isActive = g === activeTab;
                    var count = chargesData[g] ? chargesData[g].length : 0;
                    return React.createElement("div", {
                      key: g,
                      onClick: function() { setActiveTab(g); },
                      style: {
                        padding: "10px 14px", cursor: "pointer", fontSize: 11, fontWeight: isActive ? 600 : 400,
                        background: isActive ? "#fff" : "transparent", color: isActive ? "#111" : "#666",
                        borderLeft: isActive ? "3px solid #111" : "3px solid transparent",
                        borderBottom: "1px solid #f5f5f5",
                        transition: "all 0.15s"
                      }
                    },
                      React.createElement("div", null, g),
                      React.createElement("div", { style: { fontSize: 9, color: "#bbb", marginTop: 2 } }, count + " item" + (count !== 1 ? "s" : ""))
                    );
                  })}
                </div>
              )}

              {/* Items list (right) */}
              <div style={{ flex: 1, overflowY: "auto", padding: 0 }}>
                {filteredItems.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 12 }}>
                    {isSearching ? "No materials matching \"" + search + "\"" :
                     activeTab === "★ FAVOURITES" ? "No favourites yet — click the ★ on any item" :
                     activeTab === "🕐 RECENT" ? "No recent selections yet" :
                     "No items in this category"}
                  </div>
                ) : filteredItems.map(function(item, idx) {
                  var isSelected = item.item === selectedItem && (item._group || item.group) === selectedGroup;
                  var isFav = isFavourited(item.item);
                  return React.createElement("div", {
                    key: (item._group || "") + "-" + item.item + "-" + idx,
                    style: {
                      padding: "10px 16px", cursor: "pointer",
                      borderBottom: "1px solid #f8f8f8",
                      background: isSelected ? "#f0f7ff" : "transparent",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      transition: "background 0.1s"
                    },
                    onMouseEnter: function(e) { if (!isSelected) e.currentTarget.style.background = "#fafafa"; },
                    onMouseLeave: function(e) { if (!isSelected) e.currentTarget.style.background = isSelected ? "#f0f7ff" : "transparent"; }
                  },
                    // Item info (clickable to select)
                    React.createElement("div", {
                      style: { flex: 1, minWidth: 0, cursor: "pointer" },
                      onClick: function() { handleSelect(item); }
                    },
                      (isSearching || activeTab === "★ FAVOURITES" || activeTab === "🕐 RECENT") && React.createElement("div", { style: { fontSize: 9, color: "#1565c0", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 } }, item._group),
                      React.createElement("div", { style: { fontSize: 12, color: "#333" } }, item.item)
                    ),
                    // Right side: cost + favourite star + selected check
                    React.createElement("div", { style: { flexShrink: 0, marginLeft: 12, display: "flex", alignItems: "center", gap: 8 } },
                      React.createElement("span", { style: { fontSize: 12, fontWeight: 500, color: (item.costpersqm || 0) > 0 ? "#111" : "#ccc" } },
                        (item.costpersqm || 0) > 0 ? "£" + item.costpersqm + "/m²" : "TBC"
                      ),
                      // Favourite star
                      onToggleFavourite && React.createElement("button", {
                        onClick: function(e) { e.stopPropagation(); onToggleFavourite(item.item); },
                        style: { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 4px", color: isFav ? "#f9a825" : "#ddd" },
                        onMouseEnter: function(e) { if (!isFav) e.target.style.color = "#f9a825"; },
                        onMouseLeave: function(e) { if (!isFav) e.target.style.color = "#ddd"; },
                        title: isFav ? "Remove from favourites" : "Add to favourites"
                      }, isFav ? "★" : "☆"),
                      isSelected && React.createElement("span", { style: { color: "#1565c0", fontSize: 14 } }, "✓")
                    )
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "#888" }}>
                {selectedItem ? selectedGroup + " › " + selectedItem : "Click an item to select"}
              </div>
              <button style={s.btn("secondary")} onClick={function() { setOpen(false); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BULK LINE EDITOR — Spreadsheet-style mass line item creation
// ═══════════════════════════════════════════════════════════════

function BulkLineEditor({ chargesData, userPrefs, onToggleFavourite, onAddToRecent, onCreateAll, onClose, templateItem, editRows, editMode }) {
  var groups = chargesData ? Object.keys(chargesData).sort() : [];
  var allItems = [];
  if (chargesData) {
    groups.forEach(function(g) {
      chargesData[g].forEach(function(item) { allItems.push(Object.assign({}, item, { _group: g })); });
    });
  }

  // Build default row from template or empty
  var makeRow = function(idx, template) {
    if (template) {
      return {
        desc: template.desc + " " + (idx + 1), qty: template.qty || 1,
        printW: template.printW || 0, printH: template.printH || 0,
        processGroup: template.processGroup || "", process: template.process || "",
        costSqm: template.costSqm || 0, deliveryDate: template.deliveryDate || "",
        notes: template.notes || ""
      };
    }
    return { desc: "Item " + (idx + 1), qty: 1, printW: 0, printH: 0, processGroup: groups[0] || "", process: "", costSqm: 0, deliveryDate: "", notes: "" };
  };

  // Initial rows — from editRows, template, or empty
  var startRows = [];
  if (editRows && editRows.length > 0) {
    startRows = editRows.map(function(r) {
      return { desc: r.desc || "", qty: r.qty || 1, printW: r.printW || 0, printH: r.printH || 0,
        processGroup: r.processGroup || "", process: r.process || "", costSqm: r.costSqm || 0,
        deliveryDate: r.deliveryDate || "", notes: r.notes || "" };
    });
  } else {
    var initialCount = templateItem ? 5 : 3;
    for (var ri = 0; ri < initialCount; ri++) startRows.push(makeRow(ri, templateItem));
  }

  var [rows, setRows] = useState(startRows);
  var [pickingRow, setPickingRow] = useState(null);
  var [pickSearch, setPickSearch] = useState("");
  var [pickTab, setPickTab] = useState(groups[0] || "");

  var favList = userPrefs ? (userPrefs.favouriteMaterials || []) : [];
  var recList = userPrefs ? (userPrefs.recentMaterials || []) : [];

  var updateRow = function(idx, field, value) {
    setRows(function(prev) {
      return prev.map(function(r, i) {
        if (i !== idx) return r;
        var updated = Object.assign({}, r);
        if (field === "qty") updated[field] = parseInt(value) || 1;
        else if (field === "printW" || field === "printH" || field === "costSqm") updated[field] = parseFloat(value) || 0;
        else updated[field] = value;
        return updated;
      });
    });
  };

  var removeRow = function(idx) { setRows(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); }); };

  var duplicateRow = function(idx) {
    setRows(function(prev) {
      var copy = Object.assign({}, prev[idx], { desc: prev[idx].desc + " (copy)" });
      var next = prev.slice();
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  var addRow = function() { setRows(function(prev) { return prev.concat([makeRow(prev.length, templateItem)]); }); };

  var applyTemplate = function() {
    if (!templateItem) return;
    setRows(function(prev) {
      return prev.map(function(r, i) {
        return Object.assign({}, r, {
          qty: templateItem.qty || 1, printW: templateItem.printW || 0, printH: templateItem.printH || 0,
          processGroup: templateItem.processGroup || r.processGroup, process: templateItem.process || r.process,
          costSqm: templateItem.costSqm || r.costSqm, deliveryDate: templateItem.deliveryDate || r.deliveryDate
        });
      });
    });
  };

  var calcRowCost = function(r) {
    var sqm = ((r.printW || 0) * (r.printH || 0) / 1000000) * (r.qty || 1);
    return parseFloat((sqm * (r.costSqm || 0)).toFixed(2));
  };

  var totalCost = rows.reduce(function(a, r) { return a + calcRowCost(r); }, 0);

  // Material picker for a specific row
  var openMaterialPicker = function(idx) {
    var row = rows[idx];
    setPickingRow(idx);
    setPickSearch("");
    setPickTab(row.processGroup || (favList.length > 0 ? "★ FAVOURITES" : groups[0] || ""));
  };

  var selectMaterial = function(item) {
    if (pickingRow === null) return;
    updateRow(pickingRow, "processGroup", item._group || item.group);
    updateRow(pickingRow, "process", item.item);
    updateRow(pickingRow, "costSqm", item.costpersqm || 0);
    if (onAddToRecent) onAddToRecent(item._group || item.group, item.item);
    setPickingRow(null);
  };

  var getPickerItems = function() {
    if (pickSearch.trim()) {
      var q = pickSearch.toLowerCase();
      return allItems.filter(function(i) { return i.item.toLowerCase().indexOf(q) >= 0 || i._group.toLowerCase().indexOf(q) >= 0; });
    }
    if (pickTab === "★ FAVOURITES") return allItems.filter(function(i) { return favList.indexOf(i.item) >= 0; });
    if (pickTab === "🕐 RECENT") {
      var results = [];
      recList.forEach(function(r) { var m = allItems.find(function(a) { return a.item === r.item && a._group === r.group; }); if (m) results.push(m); });
      return results;
    }
    return (chargesData[pickTab] || []).map(function(i) { return Object.assign({}, i, { _group: pickTab }); });
  };

  var handleCreateAll = function() {
    var valid = rows.filter(function(r) { return r.desc.trim() && r.printW > 0 && r.printH > 0; });
    if (valid.length === 0) return;
    onCreateAll(valid);
    onClose();
  };

  var validCount = rows.filter(function(r) { return r.desc.trim() && r.printW > 0 && r.printH > 0; }).length;

  return (
    <div className="wizard-overlay" onClick={onClose} style={{ zIndex: 9000 }}>
      <div className="wizard-modal" style={{ width: 900, maxWidth: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={function(e) { e.stopPropagation(); }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{editMode ? "Edit Line Items" : "Bulk Line Items"}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{rows.length} rows · {validCount} valid · Total: {fmt(totalCost)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {templateItem && React.createElement("button", {
              style: Object.assign({}, s.btn("secondary"), { fontSize: 10, padding: "4px 10px" }),
              onClick: applyTemplate
            }, "Apply Template to All")}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
          </div>
        </div>

        {/* Spreadsheet grid */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: 0 }}>
          <table style={Object.assign({}, s.table, { tableLayout: "fixed", minWidth: 820 })}>
            <colgroup>
              <col style={{ width: "4%" }} /><col style={{ width: "22%" }} /><col style={{ width: "6%" }} />
              <col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} /><col style={{ width: "13%" }} /><col style={{ width: "5%" }} />
            </colgroup>
            <thead><tr>
              {["#", "Description", "Qty", "W (mm)", "H (mm)", "Material", "Cost/m²", "Line Cost", ""].map(function(h) {
                return React.createElement("th", { key: h, style: Object.assign({}, s.th, { fontSize: 10, padding: "8px 6px" }) }, h);
              })}
            </tr></thead>
            <tbody>
              {rows.map(function(row, idx) {
                var lineCost = calcRowCost(row);
                return React.createElement("tr", { key: idx, style: { background: idx % 2 === 0 ? "#fff" : "#fafafa" } },
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center", fontSize: 10, color: "#bbb", padding: "6px 4px" }) }, idx + 1),
                  React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) },
                    React.createElement("input", { style: Object.assign({}, s.input, { fontSize: 11, padding: "5px 6px" }), value: row.desc,
                      onChange: function(e) { updateRow(idx, "desc", e.target.value); } })
                  ),
                  React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) },
                    React.createElement("input", { type: "number", style: Object.assign({}, s.input, { fontSize: 11, padding: "5px 4px", textAlign: "center" }), value: row.qty,
                      onChange: function(e) { updateRow(idx, "qty", e.target.value); } })
                  ),
                  React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) },
                    React.createElement("input", { type: "number", style: Object.assign({}, s.input, { fontSize: 11, padding: "5px 4px", textAlign: "center" }), value: row.printW,
                      onChange: function(e) { updateRow(idx, "printW", e.target.value); } })
                  ),
                  React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) },
                    React.createElement("input", { type: "number", style: Object.assign({}, s.input, { fontSize: 11, padding: "5px 4px", textAlign: "center" }), value: row.printH,
                      onChange: function(e) { updateRow(idx, "printH", e.target.value); } })
                  ),
                  // Material cell — clickable
                  React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) },
                    React.createElement("div", {
                      onClick: function() { openMaterialPicker(idx); },
                      style: { padding: "4px 6px", borderRadius: 4, border: "1px solid #e0e0e0", cursor: "pointer", fontSize: 10, background: "#fafafa", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
                      onMouseEnter: function(e) { e.currentTarget.style.borderColor = "#999"; },
                      onMouseLeave: function(e) { e.currentTarget.style.borderColor = "#e0e0e0"; }
                    },
                      row.process ? React.createElement("span", null,
                        React.createElement("span", { style: { color: "#1565c0", fontSize: 8, textTransform: "uppercase" } }, row.processGroup ? row.processGroup.substring(0, 12) + " › " : ""),
                        row.process.substring(0, 25)
                      ) : React.createElement("span", { style: { color: "#ccc" } }, "Select...")
                    )
                  ),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontSize: 11, color: "#888", padding: "6px 6px" }) },
                    row.costSqm > 0 ? "£" + row.costSqm.toFixed(0) : "—"
                  ),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "right", fontSize: 11, fontWeight: 500, padding: "6px 6px" }) }, fmt(lineCost)),
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center", padding: "4px 2px" }) },
                    React.createElement("div", { style: { display: "flex", gap: 2, justifyContent: "center" } },
                      React.createElement("button", {
                        onClick: function() { duplicateRow(idx); },
                        style: { background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 11, padding: "0 2px" },
                        onMouseEnter: function(e) { e.target.style.color = "#1565c0"; },
                        onMouseLeave: function(e) { e.target.style.color = "#bbb"; },
                        title: "Duplicate row"
                      }, "⧉"),
                      rows.length > 1 && React.createElement("button", {
                        onClick: function() { removeRow(idx); },
                        style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 13, padding: "0 2px" },
                        onMouseEnter: function(e) { e.target.style.color = "#c00"; },
                        onMouseLeave: function(e) { e.target.style.color = "#ccc"; },
                        title: "Remove row"
                      }, "✕")
                    )
                  )
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "8px 12px" }}>
            <button style={Object.assign({}, s.btn("secondary"), { fontSize: 10, padding: "6px 14px" })} onClick={addRow}>+ Add Row</button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#888" }}>Total: </span><span style={{ fontWeight: 500 }}>{fmt(totalCost)}</span>
            <span style={{ color: "#888", marginLeft: 16 }}>{validCount} of {rows.length} rows ready</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.btn("secondary")} onClick={onClose}>Cancel</button>
            <button style={s.btn()} onClick={handleCreateAll} disabled={validCount === 0}>
              {editMode ? "Save Changes" : "Create " + validCount + " Line Item" + (validCount !== 1 ? "s" : "")}
            </button>
          </div>
        </div>
      </div>

      {/* Material picker sub-modal */}
      {pickingRow !== null && (function() {
        var pickerItems = getPickerItems();
        var isSearching = pickSearch.trim().length > 0;
        return React.createElement("div", {
          className: "wizard-overlay", style: { zIndex: 10001 },
          onClick: function() { setPickingRow(null); }
        },
          React.createElement("div", {
            className: "wizard-modal", style: { width: 640, maxWidth: "90%", maxHeight: "70vh", display: "flex", flexDirection: "column" },
            onClick: function(e) { e.stopPropagation(); }
          },
            React.createElement("div", { style: { padding: "14px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 } },
              React.createElement("div", { style: { fontSize: 14, fontWeight: 500 } }, "Material for Row " + (pickingRow + 1)),
              React.createElement("button", { onClick: function() { setPickingRow(null); }, style: { background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#999" } }, "✕")
            ),
            React.createElement("div", { style: { padding: "10px 20px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 } },
              React.createElement("input", {
                style: Object.assign({}, s.input, { fontSize: 12, background: "#fafafa" }),
                placeholder: "Search materials...", value: pickSearch,
                onChange: function(e) { setPickSearch(e.target.value); }, autoFocus: true
              })
            ),
            React.createElement("div", { style: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 } },
              !isSearching && React.createElement("div", { style: { width: 160, borderRight: "1px solid #f0f0f0", overflowY: "auto", flexShrink: 0 } },
                favList.length > 0 && React.createElement("div", {
                  onClick: function() { setPickTab("★ FAVOURITES"); },
                  style: { padding: "8px 12px", cursor: "pointer", fontSize: 10, fontWeight: pickTab === "★ FAVOURITES" ? 600 : 400, color: pickTab === "★ FAVOURITES" ? "#f9a825" : "#888", borderLeft: pickTab === "★ FAVOURITES" ? "3px solid #f9a825" : "3px solid transparent", borderBottom: "1px solid #f5f5f5" }
                }, "★ Favourites"),
                recList.length > 0 && React.createElement("div", {
                  onClick: function() { setPickTab("🕐 RECENT"); },
                  style: { padding: "8px 12px", cursor: "pointer", fontSize: 10, fontWeight: pickTab === "🕐 RECENT" ? 600 : 400, color: pickTab === "🕐 RECENT" ? "#555" : "#888", borderLeft: pickTab === "🕐 RECENT" ? "3px solid #888" : "3px solid transparent", borderBottom: "1px solid #f5f5f5" }
                }, "🕐 Recent"),
                (favList.length > 0 || recList.length > 0) && React.createElement("div", { style: { height: 1, background: "#e0e0e0", margin: "2px 12px" } }),
                groups.map(function(g) {
                  return React.createElement("div", {
                    key: g, onClick: function() { setPickTab(g); },
                    style: { padding: "8px 12px", cursor: "pointer", fontSize: 10, fontWeight: pickTab === g ? 600 : 400, color: pickTab === g ? "#111" : "#666", borderLeft: pickTab === g ? "3px solid #111" : "3px solid transparent", borderBottom: "1px solid #f5f5f5" }
                  }, g);
                })
              ),
              React.createElement("div", { style: { flex: 1, overflowY: "auto" } },
                pickerItems.length === 0 ?
                  React.createElement("div", { style: { padding: 30, textAlign: "center", color: "#999", fontSize: 11 } }, "No items") :
                  pickerItems.map(function(item, idx) {
                    var isFav = favList.indexOf(item.item) >= 0;
                    return React.createElement("div", {
                      key: idx, style: { padding: "8px 14px", borderBottom: "1px solid #f8f8f8", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" },
                      onClick: function() { selectMaterial(item); },
                      onMouseEnter: function(e) { e.currentTarget.style.background = "#fafafa"; },
                      onMouseLeave: function(e) { e.currentTarget.style.background = "transparent"; }
                    },
                      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        (isSearching || pickTab === "★ FAVOURITES" || pickTab === "🕐 RECENT") && React.createElement("div", { style: { fontSize: 8, color: "#1565c0", textTransform: "uppercase", marginBottom: 1 } }, item._group),
                        React.createElement("div", { style: { fontSize: 11 } }, item.item)
                      ),
                      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 } },
                        React.createElement("span", { style: { fontSize: 11, fontWeight: 500, color: (item.costpersqm || 0) > 0 ? "#111" : "#ccc" } },
                          (item.costpersqm || 0) > 0 ? "£" + item.costpersqm + "/m²" : "TBC"
                        ),
                        onToggleFavourite && React.createElement("button", {
                          onClick: function(e) { e.stopPropagation(); onToggleFavourite(item.item); },
                          style: { background: "none", border: "none", cursor: "pointer", fontSize: 12, color: isFav ? "#f9a825" : "#ddd", padding: "0 2px" }
                        }, isFav ? "★" : "☆")
                      )
                    );
                  })
              )
            )
          )
        );
      })()}
    </div>
  );
}
