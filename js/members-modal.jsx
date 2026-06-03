function MembersModal({ onClose, userEmail }) {
  var [members, setMembers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [editingId, setEditingId] = useState(null);
  var [editForm, setEditForm] = useState({});
  var [addOpen, setAddOpen] = useState(false);
  var [newMember, setNewMember] = useState({ email: "", password: "", name: "", role: "production", active: true });
  var [saving, setSaving] = useState(false);
  var [toast, setToast] = useState("");

  var ROLES = [
    { value: "admin", label: "Admin" },
    { value: "production", label: "Production" },
    { value: "marketing", label: "Marketing" },
    { value: "project manager", label: "Project Manager" }
  ];

  // Load all members
  useEffect(function() {
    if (DB.isLive()) {
      DB.getAllMembers().then(function(data) {
        setMembers(data || []);
        setLoading(false);
      }).catch(function() { setLoading(false); });
    }
  }, []);

  var startEdit = function(member) {
    setEditingId(member._id);
    setEditForm({ email: member.email, name: member.name, role: member.role, active: member.active, password: member.password || "" });
  };

  var cancelEdit = function() { setEditingId(null); setEditForm({}); };

  var saveEdit = function() {
    setSaving(true);
    DB.updateMember(editingId, editForm).then(function() {
      setSaving(false); setEditingId(null);
      setToast("Saved"); setTimeout(function() { setToast(""); }, 2000);
      DB.getAllMembers().then(function(data) { setMembers(data || []); });
      DB.addNotification({ scope: "global", type: "member_updated", message: "Member updated: " + editForm.name + " (" + editForm.role + ")", read: false, timestamp: new Date() }).catch(function() {});
    }).catch(function(err) { setSaving(false); console.error("Save failed:", err); });
  };

  var addMember = function() {
    if (!newMember.email.trim() || !newMember.name.trim() || !newMember.password.trim()) return;
    setSaving(true);
    DB.addMember(newMember).then(function() {
      setSaving(false); setAddOpen(false);
      setNewMember({ email: "", password: "", name: "", role: "production", active: true });
      setToast("Member added"); setTimeout(function() { setToast(""); }, 2000);
      DB.getAllMembers().then(function(data) { setMembers(data || []); });
      DB.addNotification({ scope: "global", type: "member_added", message: "New team member added: " + newMember.name + " (" + newMember.role + ")", read: false, timestamp: new Date() }).catch(function() {});
    }).catch(function(err) { setSaving(false); console.error("Add failed:", err); });
  };

  var toggleActive = function(member) {
    var newActive = !member.active;
    DB.updateMember(member._id, { active: newActive }).then(function() {
      setToast(newActive ? "Activated" : "Deactivated"); setTimeout(function() { setToast(""); }, 2000);
      DB.getAllMembers().then(function(data) { setMembers(data || []); });
      DB.addNotification({ scope: "global", type: "member_status", message: "Member " + (newActive ? "activated" : "deactivated") + ": " + member.name, read: false, timestamp: new Date() }).catch(function() {});
    }).catch(function(err) { console.error("Toggle failed:", err); });
  };

  return (
    <div className="wizard-overlay" onClick={onClose} style={{ zIndex: 9000 }}>
      <div className="wizard-modal" style={{ width: 700, maxWidth: "95%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
        onClick={function(e) { e.stopPropagation(); }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Team Members</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{members.length} member{members.length !== 1 ? "s" : ""} · {members.filter(function(m) { return m.active; }).length} active</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={Object.assign({}, s.btn(), { fontSize: 10, padding: "6px 14px" })} onClick={function() { setAddOpen(!addOpen); }}>+ Add Member</button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
          </div>
        </div>

        {/* Add member form */}
        {addOpen && (
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #eee", background: "#fafafa" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 180px" }}>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 2, textTransform: "uppercase" }}>Name</div>
                <input style={Object.assign({}, s.input, { fontSize: 11, padding: "6px 8px" })} value={newMember.name}
                  onChange={function(e) { setNewMember(Object.assign({}, newMember, { name: e.target.value })); }} />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 2, textTransform: "uppercase" }}>Email</div>
                <input style={Object.assign({}, s.input, { fontSize: 11, padding: "6px 8px" })} value={newMember.email}
                  onChange={function(e) { setNewMember(Object.assign({}, newMember, { email: e.target.value })); }} />
              </div>
              <div style={{ flex: "0 0 120px" }}>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 2, textTransform: "uppercase" }}>Password</div>
                <input style={Object.assign({}, s.input, { fontSize: 11, padding: "6px 8px" })} value={newMember.password}
                  onChange={function(e) { setNewMember(Object.assign({}, newMember, { password: e.target.value })); }} />
              </div>
              <div style={{ flex: "0 0 140px" }}>
                <div style={{ fontSize: 9, color: "#888", marginBottom: 2, textTransform: "uppercase" }}>Role</div>
                <select style={Object.assign({}, s.select, { fontSize: 11, padding: "6px 8px" })} value={newMember.role}
                  onChange={function(e) { setNewMember(Object.assign({}, newMember, { role: e.target.value })); }}>
                  {ROLES.map(function(r) { return React.createElement("option", { key: r.value, value: r.value }, r.label); })}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={Object.assign({}, s.btn(), { fontSize: 10, padding: "6px 12px" })} onClick={addMember} disabled={saving}>{saving ? "..." : "Add"}</button>
                <button style={Object.assign({}, s.btn("secondary"), { fontSize: 10, padding: "6px 12px" })} onClick={function() { setAddOpen(false); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Members list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 12 }}>Loading...</div>
          ) : (
            <table style={Object.assign({}, s.table, { marginBottom: 0 })}>
              <thead><tr>
                {["Status", "Name", "Email", "Role", "Password", ""].map(function(h) {
                  return React.createElement("th", { key: h, style: Object.assign({}, s.th, { fontSize: 10, padding: "10px 12px" }) }, h);
                })}
              </tr></thead>
              <tbody>
                {members.map(function(member) {
                  var isEditing = editingId === member._id;
                  var isSelf = member.email === userEmail;
                  var roleObj = ROLES.find(function(r) { return r.value === member.role; });
                  var roleColor = member.role === "admin" ? "#111" : member.role === "production" ? "#1565c0" : member.role === "marketing" ? "#7b1fa2" : member.role === "project manager" ? "#2e7d32" : "#666";

                  if (isEditing) {
                    return React.createElement("tr", { key: member._id, style: { background: "#fffde7" } },
                      React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center", padding: "6px 8px" }) },
                        React.createElement("select", {
                          style: Object.assign({}, s.select, { fontSize: 10, padding: "3px 4px", width: 80 }),
                          value: editForm.active ? "true" : "false",
                          onChange: function(e) { setEditForm(Object.assign({}, editForm, { active: e.target.value === "true" })); }
                        }, React.createElement("option", { value: "true" }, "Active"), React.createElement("option", { value: "false" }, "Inactive"))
                      ),
                      React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 8px" }) },
                        React.createElement("input", { style: Object.assign({}, s.input, { fontSize: 11, padding: "4px 6px" }), value: editForm.name,
                          onChange: function(e) { setEditForm(Object.assign({}, editForm, { name: e.target.value })); } })
                      ),
                      React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 8px" }) },
                        React.createElement("input", { style: Object.assign({}, s.input, { fontSize: 11, padding: "4px 6px" }), value: editForm.email,
                          onChange: function(e) { setEditForm(Object.assign({}, editForm, { email: e.target.value })); } })
                      ),
                      React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 8px" }) },
                        React.createElement("select", { style: Object.assign({}, s.select, { fontSize: 11, padding: "4px 6px" }), value: editForm.role,
                          onChange: function(e) { setEditForm(Object.assign({}, editForm, { role: e.target.value })); } },
                          ROLES.map(function(r) { return React.createElement("option", { key: r.value, value: r.value }, r.label); })
                        )
                      ),
                      React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 8px" }) },
                        React.createElement("input", { style: Object.assign({}, s.input, { fontSize: 11, padding: "4px 6px" }), value: editForm.password,
                          onChange: function(e) { setEditForm(Object.assign({}, editForm, { password: e.target.value })); } })
                      ),
                      React.createElement("td", { style: Object.assign({}, s.td, { padding: "4px 8px", whiteSpace: "nowrap" }) },
                        React.createElement("button", { style: Object.assign({}, s.btn(), { fontSize: 9, padding: "3px 8px", marginRight: 4 }), onClick: saveEdit, disabled: saving }, saving ? "..." : "Save"),
                        React.createElement("button", { style: Object.assign({}, s.btn("secondary"), { fontSize: 9, padding: "3px 8px" }), onClick: cancelEdit }, "Cancel")
                      )
                    );
                  }

                  return React.createElement("tr", { key: member._id, style: { opacity: member.active ? 1 : 0.45 } },
                    React.createElement("td", { style: Object.assign({}, s.td, { textAlign: "center", padding: "8px 12px" }) },
                      React.createElement("span", {
                        onClick: function() { if (!isSelf) toggleActive(member); },
                        style: { display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: member.active ? "#4caf50" : "#ef5350", cursor: isSelf ? "default" : "pointer" },
                        title: isSelf ? "Cannot deactivate yourself" : (member.active ? "Click to deactivate" : "Click to activate")
                      })
                    ),
                    React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 12, fontWeight: 500, padding: "8px 12px" }) },
                      member.name,
                      isSelf && React.createElement("span", { style: { fontSize: 9, color: "#888", marginLeft: 6 } }, "(you)")
                    ),
                    React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 11, color: "#666", padding: "8px 12px" }) }, member.email),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "8px 12px" }) },
                      React.createElement("span", { style: { fontSize: 9, padding: "2px 8px", borderRadius: 3, background: roleColor, color: "#fff", textTransform: "uppercase" } },
                        roleObj ? roleObj.label : member.role
                      )
                    ),
                    React.createElement("td", { style: Object.assign({}, s.td, { fontSize: 11, color: "#ccc", padding: "8px 12px" }) }, "••••••••"),
                    React.createElement("td", { style: Object.assign({}, s.td, { padding: "8px 12px" }) },
                      React.createElement("button", {
                        onClick: function() { startEdit(member); },
                        style: { background: "none", border: "none", cursor: "pointer", color: "#1565c0", fontSize: 10, padding: "2px 6px" }
                      }, "Edit")
                    )
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "#888" }}>Only admin users can manage members</div>
          <button style={s.btn("secondary")} onClick={onClose}>Close</button>
        </div>

        <Toast message={toast} visible={!!toast} />
      </div>
    </div>
  );
}
