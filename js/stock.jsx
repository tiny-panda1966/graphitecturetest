function StockView({ stockData, onStockUpdated }) {
  var [filter, setFilter] = useState("");
  var [groupFilter, setGroupFilter] = useState("ALL");
  var [editingId, setEditingId] = useState(null);
  var [editForm, setEditForm] = useState({});
  var [saving, setSaving] = useState(false);
  var [toast, setToast] = useState("");
  var [addOpen, setAddOpen] = useState(false);
  var [newItem, setNewItem] = useState({
    stock: true, group: "", subGroup: "", materialCode: "", material: "", description: "",
    sizeWidthMm: 0, sizeLengthMm: 0, minLevel: 0, reOrderQty: 0,
    supplier: "", stockLocation: "", rollPrice: 0, sqMtrPrice: 0, stockValue: 0
  });

  var items = stockData || [];

  // Get unique groups for filter
  var groups = [];
  var seen = {};
  items.forEach(function(i) { if (i.group && !seen[i.group]) { seen[i.group] = true; groups.push(i.group); } });
  groups.sort();

  // Filter items
  var filtered = items.filter(function(i) {
    if (groupFilter !== "ALL" && i.group !== groupFilter) return false;
    if (!filter.trim()) return true;
    var q = filter.toLowerCase();
    return (i.materialCode || "").toLowerCase().indexOf(q) >= 0 ||
           (i.material || "").toLowerCase().indexOf(q) >= 0 ||
           (i.description || "").toLowerCase().indexOf(q) >= 0 ||
           (i.supplier || "").toLowerCase().indexOf(q) >= 0;
  });

  var startEdit = function(item) {
    setEditingId(item._id);
    setEditForm(Object.assign({}, item));
  };

  var cancelEdit = function() { setEditingId(null); setEditForm({}); };

  var saveEdit = function() {
    if (!DB.isLive()) return;
    setSaving(true);
    var data = Object.assign({}, editForm);
    delete data._id;
    delete data._createdDate;
    delete data._updatedDate;
    delete data._owner;
    DB.updateStockItem(editingId, data).then(function() {
      setSaving(false); setEditingId(null); setEditForm({});
      setToast("Saved"); setTimeout(function() { setToast(""); }, 2000);
      if (onStockUpdated) onStockUpdated();
      DB.addNotification({ scope: "global", type: "stock_updated", message: "Stock item updated: " + (data.material || data.materialCode), read: false, timestamp: new Date() }).catch(function() {});
    }).catch(function(err) { setSaving(false); console.error("Save failed:", err); });
  };

  var deleteItem = function(id) {
    if (!DB.isLive()) return;
    DB.deleteStockItem(id).then(function() {
      setToast("Deleted"); setTimeout(function() { setToast(""); }, 2000);
      if (onStockUpdated) onStockUpdated();
    }).catch(function(err) { console.error("Delete failed:", err); });
  };

  var addItem = function() {
    if (!newItem.materialCode.trim() || !newItem.group.trim()) return;
    if (!DB.isLive()) return;
    setSaving(true);
    DB.addStockItem(newItem).then(function() {
      setSaving(false); setAddOpen(false);
      setNewItem({
        stock: true, group: "", subGroup: "", materialCode: "", material: "", description: "",
        sizeWidthMm: 0, sizeLengthMm: 0, minLevel: 0, reOrderQty: 0,
        supplier: "", stockLocation: "", rollPrice: 0, sqMtrPrice: 0, stockValue: 0
      });
      setToast("Added"); setTimeout(function() { setToast(""); }, 2000);
      if (onStockUpdated) onStockUpdated();
    }).catch(function(err) { setSaving(false); console.error("Add failed:", err); });
  };

  var stockCount = items.filter(function(i) { return i.stock; }).length;
  var nonStockCount = items.filter(function(i) { return !i.stock; }).length;

  var editField = function(field, type) {
    var val = editForm[field];
    if (type === "number") val = val || 0;
    if (type === "bool") {
      return React.createElement("select", {
        style: Object.assign({}, s.input, { fontSize: 10, padding: "3px 6px", width: "100%" }),
        value: val ? "true" : "false",
        onChange: function(e) { setEditForm(Object.assign({}, editForm, { [field]: e.target.value === "true" })); }
      }, React.createElement("option", { value: "true" }, "In Stock"), React.createElement("option", { value: "false" }, "Out of Stock"));
    }
    return React.createElement("input", {
      type: type === "number" ? "number" : "text", step: type === "number" ? "0.01" : undefined,
      style: Object.assign({}, s.input, { fontSize: 10, padding: "3px 6px", width: "100%" }),
      value: val || "",
      onChange: function(e) { setEditForm(Object.assign({}, editForm, { [field]: type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value })); }
    });
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div><div style={s.pageTitle}>Stock List</div><div style={s.pageSub}>Raw material inventory — purchase costs</div></div>
        <button style={s.btn()} onClick={function() { setAddOpen(!addOpen); }}>+ Add Item</button>
      </div>

      {/* KPI Strip */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <StatCard value={items.length} label="Total Items" />
        <StatCard value={stockCount} label="In Stock" />
        <StatCard value={nonStockCount} label="Non Stock" />
        <StatCard value={groups.length} label="Groups" />
      </div>

      {/* Add item form */}
      {addOpen && (
        <div style={Object.assign({}, s.card, { marginBottom: 16 })}>
          <div style={s.cardHead}><span style={s.cardTitle}>Add Stock Item</span></div>
          <div style={Object.assign({}, s.cardBody, { display: "flex", flexWrap: "wrap", gap: 8 })}>
            {[["Group", "group", "text"], ["Sub Group", "subGroup", "text"], ["Material Code", "materialCode", "text"], ["Material", "material", "text"],
              ["Supplier", "supplier", "text"], ["Width (mm)", "sizeWidthMm", "number"], ["Length (mm)", "sizeLengthMm", "number"],
              ["Roll Price", "rollPrice", "number"], ["£/m²", "sqMtrPrice", "number"]
            ].map(function(f) {
              return React.createElement("div", { key: f[1], style: { flex: f[2] === "number" ? "0 0 90px" : "1 1 150px" } },
                React.createElement("div", { style: { fontSize: 9, color: "#888", marginBottom: 2, textTransform: "uppercase" } }, f[0]),
                React.createElement("input", {
                  type: f[2], step: f[2] === "number" ? "0.01" : undefined,
                  style: Object.assign({}, s.input, { fontSize: 11, padding: "5px 8px" }),
                  value: newItem[f[1]] || "",
                  onChange: function(e) { setNewItem(Object.assign({}, newItem, { [f[1]]: f[2] === "number" ? (parseFloat(e.target.value) || 0) : e.target.value })); }
                })
              );
            })}
            <div style={{ flex: "1 1 100%", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button style={s.btn("secondary")} onClick={function() { setAddOpen(false); }}>Cancel</button>
              <button style={s.btn()} onClick={addItem} disabled={saving}>{saving ? "Saving..." : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <input style={Object.assign({}, s.input, { paddingLeft: 28, fontSize: 12 })} placeholder="Search materials..."
            value={filter} onChange={function(e) { setFilter(e.target.value); }} />
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#ccc", pointerEvents: "none" }}>🔍</span>
        </div>
        <select style={Object.assign({}, s.input, { width: "auto", fontSize: 11 })} value={groupFilter} onChange={function(e) { setGroupFilter(e.target.value); }}>
          <option value="ALL">All Groups</option>
          {groups.map(function(g) { return React.createElement("option", { key: g, value: g }, g); })}
        </select>
        <div style={{ fontSize: 11, color: "#888" }}>{filtered.length} of {items.length} items</div>
      </div>

      {/* Stock table */}
      <div style={s.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={Object.assign({}, s.table, { minWidth: 1100 })}>
            <thead><tr>
              {["Status", "Group", "Sub Group", "Material Code", "Material", "W", "L", "Supplier", "Roll £", "£/m²", "Stock Val", ""].map(function(h) {
                return React.createElement("th", { key: h, style: Object.assign({}, s.th, { fontSize: 9, padding: "8px 6px", whiteSpace: "nowrap" }) }, h);
              })}
            </tr></thead>
            <tbody>
              {filtered.map(function(item) {
                var isEditing = editingId === item._id;
                if (isEditing) {
                  return React.createElement("tr", { key: item._id, style: { background: "#fffde7" } },
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("stock", "bool")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("group", "text")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("subGroup", "text")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("materialCode", "text")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("material", "text")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("sizeWidthMm", "number")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("sizeLengthMm", "number")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("supplier", "text")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("rollPrice", "number")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("sqMtrPrice", "number")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px" }) }, editField("stockValue", "number")),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px", whiteSpace: "nowrap" }) },
                      React.createElement("button", { style: Object.assign({}, s.btn(), { fontSize: 9, padding: "3px 8px", marginRight: 4 }), onClick: saveEdit, disabled: saving }, saving ? "..." : "Save"),
                      React.createElement("button", { style: Object.assign({}, s.btn("secondary"), { fontSize: 9, padding: "3px 8px" }), onClick: cancelEdit }, "Cancel")
                    )
                  );
                }
                var inStock = item.stock === true || item.stock === "true";
                return React.createElement("tr", { key: item._id, style: { background: inStock ? "transparent" : "#fff5f5" } },
                  React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center", fontSize: 10, padding: "6px 4px" }) },
                    React.createElement("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: inStock ? "#4caf50" : "#ef5350" } })
                  ),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px" }) }, item.group),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px" }) }, item.subGroup),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px", fontWeight: 500 }) }, item.materialCode),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px" }) }, item.material),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px", textAlign: "right" }) }, item.sizeWidthMm || ""),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px", textAlign: "right" }) }, item.sizeLengthMm || ""),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px" }) }, item.supplier),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px", textAlign: "right" }) }, item.rollPrice ? "£" + (parseFloat(item.rollPrice) || 0).toFixed(2) : ""),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px", textAlign: "right", fontWeight: 500 }) }, item.sqMtrPrice ? "£" + (parseFloat(item.sqMtrPrice) || 0).toFixed(2) : ""),
                  React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 10, padding: "6px 6px", textAlign: "right" }) }, item.stockValue ? "£" + (parseFloat(item.stockValue) || 0).toFixed(2) : ""),
                  React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 4px", whiteSpace: "nowrap" }) },
                    React.createElement("button", {
                      onClick: function() { startEdit(item); },
                      style: { background: "none", border: "none", cursor: "pointer", color: "#1565c0", fontSize: 10, padding: "2px 6px" }
                    }, "Edit"),
                    React.createElement("button", {
                      onClick: function() { if (confirm("Delete " + item.materialCode + "?")) deleteItem(item._id); },
                      style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 10, padding: "2px 6px" },
                      onMouseEnter: function(e) { e.target.style.color = "#c00"; },
                      onMouseLeave: function(e) { e.target.style.color = "#ccc"; }
                    }, "Delete")
                  )
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Toast message={toast} visible={!!toast} />
    </div>
  );
}
