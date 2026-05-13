function CostsView({ chargesData, onChargesUpdated }) {
  var [expanded, setExpanded] = useState({});
  var [editing, setEditing] = useState(null); // group name being edited
  var [editItems, setEditItems] = useState([]); // working copy during edit
  var [saving, setSaving] = useState(false);
  var [addingGroup, setAddingGroup] = useState(false);
  var [newGroupName, setNewGroupName] = useState("");
  var [newItemForm, setNewItemForm] = useState({ item: "", costpersqm: 0 });
  var [toast, setToast] = useState("");

  // Split charges into print materials and delivery
  var printGroups = [];
  var deliveryItems = [];
  if (chargesData) {
    Object.keys(chargesData).sort().forEach(function(g) {
      if (g === "DELIVERY") {
        deliveryItems = chargesData[g];
      } else {
        var items = chargesData[g];
        var costs = items.map(function(i) { return i.costpersqm || 0; }).filter(function(c) { return c > 0; });
        printGroups.push({
          name: g,
          count: items.length,
          minCost: costs.length > 0 ? Math.min.apply(null, costs) : 0,
          maxCost: costs.length > 0 ? Math.max.apply(null, costs) : 0,
          items: items
        });
      }
    });
  }

  var toggleExpand = function(group) {
    setExpanded(function(prev) { var next = Object.assign({}, prev); next[group] = !prev[group]; return next; });
  };

  // ── Edit mode ──
  var startEdit = function(groupName, items) {
    setEditing(groupName);
    setEditItems(items.map(function(i) { return Object.assign({}, i); }));
    setNewItemForm({ item: "", costpersqm: 0 });
  };

  var cancelEdit = function() { setEditing(null); setEditItems([]); };

  var updateEditItem = function(idx, field, value) {
    setEditItems(function(prev) {
      return prev.map(function(item, i) {
        if (i !== idx) return item;
        var updated = Object.assign({}, item);
        updated[field] = field === "costpersqm" ? (parseFloat(value) || 0) : value;
        return updated;
      });
    });
  };

  var removeEditItem = function(idx) {
    setEditItems(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); });
  };

  var addEditItem = function() {
    if (!newItemForm.item.trim()) return;
    setEditItems(function(prev) {
      return prev.concat([{ _id: null, item: newItemForm.item.trim(), costpersqm: newItemForm.costpersqm || 0, group: editing }]);
    });
    setNewItemForm({ item: "", costpersqm: 0 });
  };

  var saveEdit = function() {
    if (!DB.isLive()) return;
    setSaving(true);

    // Find original items for this group
    var originalItems = chargesData && chargesData[editing] ? chargesData[editing] : [];
    var originalIds = originalItems.map(function(i) { return i._id; }).filter(Boolean);
    var editIds = editItems.map(function(i) { return i._id; }).filter(Boolean);

    // Items to delete (in original but not in edit)
    var toDelete = originalIds.filter(function(id) { return editIds.indexOf(id) < 0; });

    // Items to update (have _id)
    var toUpdate = editItems.filter(function(i) { return i._id; });

    // Items to add (no _id)
    var toAdd = editItems.filter(function(i) { return !i._id; });

    var promises = [];
    toDelete.forEach(function(id) { promises.push(DB.deleteCharge(id)); });
    toUpdate.forEach(function(i) { promises.push(DB.updateCharge(i._id, { item: i.item, costpersqm: i.costpersqm, group: i.group || editing })); });
    toAdd.forEach(function(i) { promises.push(DB.addCharge({ item: i.item, costpersqm: i.costpersqm || 0, group: editing })); });

    Promise.all(promises).then(function() {
      setSaving(false);
      setEditing(null);
      setEditItems([]);
      setToast("Saved " + editing);
      setTimeout(function() { setToast(""); }, 2000);
      if (onChargesUpdated) onChargesUpdated();
    }).catch(function(err) {
      setSaving(false);
      console.error("Failed to save charges:", err);
    });
  };

  // ── Add new group ──
  var createNewGroup = function() {
    if (!newGroupName.trim()) return;
    var name = newGroupName.trim().toUpperCase();
    if (chargesData && chargesData[name]) {
      setToast("Group already exists");
      setTimeout(function() { setToast(""); }, 2000);
      return;
    }
    // Just start editing the new group with no items
    setAddingGroup(false);
    setNewGroupName("");
    setEditing(name);
    setEditItems([]);
    setExpanded(function(prev) { var next = Object.assign({}, prev); next[name] = true; return next; });
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div><div style={s.pageTitle}>Materials & Costs</div><div style={s.pageSub}>Charges database — production rate card</div></div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard value={printGroups.length} label="Material Groups" />
        <StatCard value={printGroups.reduce(function(a, g) { return a + g.count; }, 0)} label="Total Items" />
        <StatCard value={deliveryItems.length} label="Delivery Options" />
        <StatCard value={chargesData ? "Live" : "—"} label="Data Source" />
      </div>

      {/* ── PRINT MATERIALS ACCORDION ── */}
      <div style={Object.assign({}, s.card, { marginBottom: 20 })}>
        <div style={Object.assign({}, s.cardHead, { display: "flex", justifyContent: "space-between", alignItems: "center" })}>
          <span style={s.cardTitle}>Print Materials (per m²)</span>
          <button style={Object.assign({}, s.btn(), { fontSize: 10, padding: "4px 12px" })} onClick={function() { setAddingGroup(true); setNewGroupName(""); }}>
            + New Group
          </button>
        </div>

        {/* Add new group input */}
        {addingGroup && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", background: "#fafafa", display: "flex", gap: 8, alignItems: "center" }}>
            <input style={Object.assign({}, s.input, { flex: 1, fontSize: 12, padding: "6px 10px" })}
              placeholder="New group name (e.g. CORRUGATED)"
              value={newGroupName}
              onChange={function(e) { setNewGroupName(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") createNewGroup(); }}
              autoFocus />
            <button style={Object.assign({}, s.btn(), { fontSize: 10, padding: "6px 12px" })} onClick={createNewGroup}>Create</button>
            <button style={Object.assign({}, s.btn("secondary"), { fontSize: 10, padding: "6px 12px" })} onClick={function() { setAddingGroup(false); }}>Cancel</button>
          </div>
        )}

        {/* Group rows */}
        {printGroups.map(function(group) {
          var isExpanded = expanded[group.name];
          var isEditing = editing === group.name;

          return React.createElement("div", { key: group.name },
            // Group header row
            React.createElement("div", {
              style: {
                padding: "10px 16px", borderBottom: "1px solid #f0f0f0", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: isExpanded ? "#fafafa" : "transparent"
              },
              onClick: function() { if (!isEditing) toggleExpand(group.name); }
            },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                React.createElement("span", { style: { fontSize: 11, color: "#999", fontFamily: "monospace", width: 16 } }, isExpanded ? "▾" : "▸"),
                React.createElement("span", { style: { fontSize: 12, fontWeight: 500 } }, group.name),
                React.createElement("span", { style: { fontSize: 10, color: "#bbb", marginLeft: 4 } }, group.count + " item" + (group.count !== 1 ? "s" : ""))
              ),
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
                group.minCost > 0 && React.createElement("span", { style: { fontSize: 11, color: "#888" } },
                  "£" + group.minCost + (group.maxCost !== group.minCost ? "–£" + group.maxCost : "") + "/m²"
                ),
                !isEditing && React.createElement("button", {
                  style: { background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#1565c0", padding: "2px 8px" },
                  onClick: function(e) { e.stopPropagation(); toggleExpand(group.name); startEdit(group.name, group.items); }
                }, "Edit")
              )
            ),

            // Expanded items (view mode)
            isExpanded && !isEditing && group.items.map(function(item, idx) {
              return React.createElement("div", {
                key: item._id || idx,
                style: { padding: "7px 16px 7px 40px", borderBottom: "1px solid #f8f8f8", display: "flex", justifyContent: "space-between", fontSize: 12 }
              },
                React.createElement("span", { style: { color: "#555" } }, item.item),
                React.createElement("span", { style: { fontWeight: 500, color: (item.costpersqm || 0) > 0 ? "#111" : "#ccc" } },
                  (item.costpersqm || 0) > 0 ? "£" + (item.costpersqm || 0).toFixed(2) + "/m²" : "TBC"
                )
              );
            }),

            // Expanded items (edit mode)
            isEditing && React.createElement("div", { style: { background: "#fafafa", borderBottom: "1px solid #eee" } },
              editItems.map(function(item, idx) {
                return React.createElement("div", {
                  key: idx,
                  style: { padding: "6px 16px 6px 40px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0" }
                },
                  React.createElement("input", {
                    style: Object.assign({}, s.input, { flex: 1, fontSize: 11, padding: "5px 8px" }),
                    value: item.item,
                    onChange: function(e) { updateEditItem(idx, "item", e.target.value); }
                  }),
                  React.createElement("span", { style: { fontSize: 11, color: "#888", flexShrink: 0 } }, "£"),
                  React.createElement("input", {
                    type: "number", step: "1",
                    style: Object.assign({}, s.input, { width: 70, fontSize: 11, padding: "5px 8px", textAlign: "right" }),
                    value: item.costpersqm,
                    onChange: function(e) { updateEditItem(idx, "costpersqm", e.target.value); }
                  }),
                  React.createElement("span", { style: { fontSize: 10, color: "#888", flexShrink: 0 } }, "/m²"),
                  React.createElement("button", {
                    onClick: function() { removeEditItem(idx); },
                    style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, flexShrink: 0 },
                    onMouseEnter: function(e) { e.target.style.color = "#c00"; },
                    onMouseLeave: function(e) { e.target.style.color = "#ccc"; }
                  }, "✕")
                );
              }),
              // Add new item row
              React.createElement("div", { style: { padding: "8px 16px 8px 40px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #eee" } },
                React.createElement("input", {
                  style: Object.assign({}, s.input, { flex: 1, fontSize: 11, padding: "5px 8px" }),
                  placeholder: "New item name...",
                  value: newItemForm.item,
                  onChange: function(e) { setNewItemForm(Object.assign({}, newItemForm, { item: e.target.value })); },
                  onKeyDown: function(e) { if (e.key === "Enter") addEditItem(); }
                }),
                React.createElement("span", { style: { fontSize: 11, color: "#888", flexShrink: 0 } }, "£"),
                React.createElement("input", {
                  type: "number", step: "1",
                  style: Object.assign({}, s.input, { width: 70, fontSize: 11, padding: "5px 8px", textAlign: "right" }),
                  value: newItemForm.costpersqm,
                  onChange: function(e) { setNewItemForm(Object.assign({}, newItemForm, { costpersqm: parseFloat(e.target.value) || 0 })); },
                  onKeyDown: function(e) { if (e.key === "Enter") addEditItem(); }
                }),
                React.createElement("span", { style: { fontSize: 10, color: "#888", flexShrink: 0 } }, "/m²"),
                React.createElement("button", {
                  style: Object.assign({}, s.btn(), { fontSize: 9, padding: "4px 10px", flexShrink: 0 }),
                  onClick: addEditItem
                }, "+ Add")
              ),
              // Save/Cancel buttons
              React.createElement("div", { style: { padding: "10px 16px", display: "flex", justifyContent: "flex-end", gap: 8 } },
                React.createElement("button", { style: s.btn("secondary"), onClick: cancelEdit }, "Cancel"),
                React.createElement("button", { style: s.btn(), onClick: saveEdit, disabled: saving }, saving ? "Saving..." : "Save Changes")
              )
            )
          );
        })}

        {/* Empty state when no charges loaded */}
        {(!chargesData || printGroups.length === 0) && (
          React.createElement("div", { style: { padding: 32, textAlign: "center", color: "#999", fontSize: 12 } },
            "No materials data loaded. Charges will appear once the database is populated."
          )
        )}

        {/* Editing a brand new group (not yet in chargesData) */}
        {editing && !chargesData[editing] && (
          React.createElement("div", { style: { background: "#fafafa", borderTop: "1px solid #eee" } },
            React.createElement("div", { style: { padding: "10px 16px", fontWeight: 500, fontSize: 12, borderBottom: "1px solid #f0f0f0" } }, editing + " (new group)"),
            editItems.map(function(item, idx) {
              return React.createElement("div", {
                key: idx,
                style: { padding: "6px 16px 6px 40px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0" }
              },
                React.createElement("input", {
                  style: Object.assign({}, s.input, { flex: 1, fontSize: 11, padding: "5px 8px" }),
                  value: item.item,
                  onChange: function(e) { updateEditItem(idx, "item", e.target.value); }
                }),
                React.createElement("span", { style: { fontSize: 11, color: "#888" } }, "£"),
                React.createElement("input", {
                  type: "number", step: "1",
                  style: Object.assign({}, s.input, { width: 70, fontSize: 11, padding: "5px 8px", textAlign: "right" }),
                  value: item.costpersqm,
                  onChange: function(e) { updateEditItem(idx, "costpersqm", e.target.value); }
                }),
                React.createElement("span", { style: { fontSize: 10, color: "#888" } }, "/m²"),
                React.createElement("button", {
                  onClick: function() { removeEditItem(idx); },
                  style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 },
                  onMouseEnter: function(e) { e.target.style.color = "#c00"; },
                  onMouseLeave: function(e) { e.target.style.color = "#ccc"; }
                }, "✕")
              );
            }),
            React.createElement("div", { style: { padding: "8px 16px 8px 40px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #eee" } },
              React.createElement("input", {
                style: Object.assign({}, s.input, { flex: 1, fontSize: 11, padding: "5px 8px" }),
                placeholder: "New item name...", value: newItemForm.item,
                onChange: function(e) { setNewItemForm(Object.assign({}, newItemForm, { item: e.target.value })); },
                onKeyDown: function(e) { if (e.key === "Enter") addEditItem(); }
              }),
              React.createElement("span", { style: { fontSize: 11, color: "#888" } }, "£"),
              React.createElement("input", {
                type: "number", step: "1",
                style: Object.assign({}, s.input, { width: 70, fontSize: 11, padding: "5px 8px", textAlign: "right" }),
                value: newItemForm.costpersqm,
                onChange: function(e) { setNewItemForm(Object.assign({}, newItemForm, { costpersqm: parseFloat(e.target.value) || 0 })); },
                onKeyDown: function(e) { if (e.key === "Enter") addEditItem(); }
              }),
              React.createElement("span", { style: { fontSize: 10, color: "#888" } }, "/m²"),
              React.createElement("button", { style: Object.assign({}, s.btn(), { fontSize: 9, padding: "4px 10px" }), onClick: addEditItem }, "+ Add")
            ),
            React.createElement("div", { style: { padding: "10px 16px", display: "flex", justifyContent: "flex-end", gap: 8 } },
              React.createElement("button", { style: s.btn("secondary"), onClick: cancelEdit }, "Cancel"),
              React.createElement("button", { style: s.btn(), onClick: saveEdit, disabled: saving }, saving ? "Saving..." : "Save Group")
            )
          )
        )}
      </div>

      {/* ── DELIVERY + INSTALLATION + FORMULA ── */}
      <div className="grid-2">
        {/* Delivery Costs */}
        <div style={s.card}>
          <div style={Object.assign({}, s.cardHead, { display: "flex", justifyContent: "space-between", alignItems: "center" })}>
            <span style={s.cardTitle}>Delivery Costs</span>
            {editing !== "DELIVERY" && React.createElement("button", {
              style: { background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#1565c0" },
              onClick: function() { startEdit("DELIVERY", deliveryItems); }
            }, "Edit")}
          </div>
          <div style={s.cardBody}>
            {editing === "DELIVERY" ? (
              <div>
                {editItems.map(function(item, idx) {
                  return React.createElement("div", { key: idx, style: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f5f5f5" } },
                    React.createElement("input", {
                      style: Object.assign({}, s.input, { flex: 1, fontSize: 11, padding: "5px 8px" }),
                      value: item.item,
                      onChange: function(e) { updateEditItem(idx, "item", e.target.value); }
                    }),
                    React.createElement("span", { style: { fontSize: 11, color: "#888" } }, "£"),
                    React.createElement("input", {
                      type: "number", step: "1",
                      style: Object.assign({}, s.input, { width: 70, fontSize: 11, padding: "5px 8px", textAlign: "right" }),
                      value: item.costpersqm,
                      onChange: function(e) { updateEditItem(idx, "costpersqm", e.target.value); }
                    }),
                    React.createElement("button", {
                      onClick: function() { removeEditItem(idx); },
                      style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14 },
                      onMouseEnter: function(e) { e.target.style.color = "#c00"; },
                      onMouseLeave: function(e) { e.target.style.color = "#ccc"; }
                    }, "✕")
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <input style={Object.assign({}, s.input, { flex: 1, fontSize: 11, padding: "5px 8px" })}
                    placeholder="New delivery option..." value={newItemForm.item}
                    onChange={function(e) { setNewItemForm(Object.assign({}, newItemForm, { item: e.target.value })); }}
                    onKeyDown={function(e) { if (e.key === "Enter") addEditItem(); }} />
                  <span style={{ fontSize: 11, color: "#888" }}>£</span>
                  <input type="number" step="1" style={Object.assign({}, s.input, { width: 70, fontSize: 11, padding: "5px 8px", textAlign: "right" })}
                    value={newItemForm.costpersqm}
                    onChange={function(e) { setNewItemForm(Object.assign({}, newItemForm, { costpersqm: parseFloat(e.target.value) || 0 })); }}
                    onKeyDown={function(e) { if (e.key === "Enter") addEditItem(); }} />
                  <button style={Object.assign({}, s.btn(), { fontSize: 9, padding: "4px 10px" })} onClick={addEditItem}>+ Add</button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                  <button style={s.btn("secondary")} onClick={cancelEdit}>Cancel</button>
                  <button style={s.btn()} onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            ) : (
              deliveryItems.length > 0 ? deliveryItems.map(function(item, idx) {
                return React.createElement("div", { key: item._id || idx, style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 } },
                  React.createElement("span", null, item.item),
                  React.createElement("span", { style: { fontWeight: 500 } }, (item.costpersqm || 0) > 0 ? "£" + (item.costpersqm || 0).toFixed(2) : "TBC")
                );
              }) : React.createElement("div", { style: { fontSize: 12, color: "#999", padding: 12, textAlign: "center" } }, "No delivery options configured")
            )}
          </div>
        </div>

        {/* Installation + Formula */}
        <div>
          <div style={s.card}>
            <div style={s.cardHead}><span style={s.cardTitle}>Installation Rates</span></div>
            <div style={s.cardBody}>
              {[["Install (normal)", "£25/hr"], ["Install (out of hours)", "£37.50/hr"], ["Frame Cutting / Prep", "£30/hr"], ["Mounting / Finishing", "£30/hr pp"]].map(function(pair) {
                return React.createElement("div", { key: pair[0], style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 } },
                  React.createElement("span", null, pair[0]),
                  React.createElement("span", { style: { fontWeight: 500 } }, pair[1])
                );
              })}
            </div>
          </div>
          <div style={s.card}>
            <div style={s.cardHead}><span style={s.cardTitle}>Calculation Formula</span></div>
            <div style={Object.assign({}, s.cardBody, { fontFamily: "monospace", fontSize: 12, lineHeight: 2, background: "#fafafa", borderRadius: 4, padding: 16 })}>
              <div><span style={{ color: "#888" }}>Sq m</span> = W × H ÷ 1,000,000 × Qty</div>
              <div><span style={{ color: "#888" }}>Cost/m²</span> = VLOOKUP(Process, Charges, costpersqm)</div>
              <div><span style={{ color: "#888" }}>Total</span> = Sq m × Cost/m²</div>
              <div style={{ marginTop: 8, borderTop: "1px solid #e0e0e0", paddingTop: 8 }}><span style={{ color: "#888" }}>Labour</span> = Hours × XLOOKUP(Function, Rates)</div>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast} visible={!!toast} />
    </div>
  );
}
