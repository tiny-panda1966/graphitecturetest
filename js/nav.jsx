// ═══════════════════════════════════════════════════════════════
// USER MENU
// ═══════════════════════════════════════════════════════════════

function UserMenu({ userEmail, userName, userRole, onLogout, projectRef, onMenuAction, unreadCount }) {
  var [open, setOpen] = useState(false);
  var name = userName || (userEmail ? userEmail.split("@")[0].replace(".", " ") : "User");
  var initials = name.split(" ").map(function(w) { return w[0]; }).join("").toUpperCase().slice(0, 2);
  var isAdmin = userRole === "admin";

  var roleLabel = (userRole || "user").toUpperCase().replace("_", " ");
  var roleColor = isAdmin ? "#111" : userRole === "production" ? "#1565c0" : userRole === "marketing" ? "#7b1fa2" : userRole === "project manager" ? "#2e7d32" : "#666";

  var menuItems = [
    { icon: IC.profile, label: "Profile & Account", sub: "Manage your details", action: "profile" },
    { icon: IC.bell, label: "Notifications", sub: unreadCount > 0 ? unreadCount + " unread" : "No new notifications", badge: unreadCount || 0, action: "notifications" },
    { icon: IC.settings, label: "Settings", sub: "Preferences & display", action: "settings" },
    { icon: IC.activity, label: "Activity Log", sub: "Recent changes", action: "activity" }
  ];

  if (isAdmin) {
    menuItems.splice(3, 0, { icon: IC.users || IC.profile, label: "Members", sub: "Manage team access", action: "members" });
  }

  var handleClick = function(action) {
    setOpen(false);
    if (onMenuAction) onMenuAction(action);
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
      {projectRef && <span style={{ fontSize: 11, color: "#666" }}>{projectRef}</span>}
      <div onClick={function() { setOpen(!open); }}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 8px", borderRadius: 4, background: open ? "#222" : "transparent", transition: "background 0.15s" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 500, border: open ? "1px solid #555" : "1px solid transparent" }}>
          {initials}
        </div>
        <span style={{ fontSize: 11, color: "#999", display: "flex", alignItems: "center", gap: 4 }}>
          {name.split(" ")[0]} <span style={{ fontSize: 8, color: "#666" }}>▼</span>
        </span>
      </div>
      {open && (
        <div>
          <div className="user-menu-backdrop" onClick={function() { setOpen(false); }} />
          <div className="user-menu-dropdown">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 500, flexShrink: 0 }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111", textTransform: "capitalize" }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{userEmail}</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, background: roleColor, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>{roleLabel}</span>
              </div>
            </div>
            {menuItems.map(function(item, i) {
              return (
                <div key={i} className="user-menu-item" onClick={function() { handleClick(item.action); }}>
                  <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#111" }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: "#aaa" }}>{item.sub}</div>
                  </div>
                  {item.badge && (
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#111", color: "#fff", fontSize: 9, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {item.badge}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="user-menu-signout" onClick={onLogout}>
              <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{IC.logout}</span>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#c00" }}>Sign Out</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
