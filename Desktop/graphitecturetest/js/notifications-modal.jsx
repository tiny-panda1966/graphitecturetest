// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS MODAL — loads from DB, shows global + personal
// ═══════════════════════════════════════════════════════════════

function NotificationsModal({ userEmail, onClose }) {

  var [notifications, setNotifications] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState("all"); // "all", "personal", "global"

  // Load notifications from DB
  useEffect(function() {
    if (DB.isLive() && userEmail) {
      DB.getNotifications(userEmail).then(function(data) {
        setNotifications(data || []);
        setLoading(false);
      }).catch(function(err) {
        console.error("DB: Failed to load notifications", err);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  // Mark single notification as read
  var markRead = function(id) {
    if (DB.isLive()) {
      DB.markNotificationRead(id).catch(function(err) { console.error("DB: Failed to mark read", err); });
    }
    setNotifications(function(prev) {
      return prev.map(function(n) { return n._id === id ? Object.assign({}, n, { read: true }) : n; });
    });
  };

  // Mark all as read
  var markAllRead = function() {
    if (DB.isLive() && userEmail) {
      DB.markAllNotificationsRead(userEmail).catch(function(err) { console.error("DB: Failed to mark all read", err); });
    }
    setNotifications(function(prev) {
      return prev.map(function(n) { return Object.assign({}, n, { read: true }); });
    });
  };

  // Filter
  var filtered = notifications;
  if (filter === "personal") {
    filtered = notifications.filter(function(n) { return n.scope !== "global"; });
  } else if (filter === "global") {
    filtered = notifications.filter(function(n) { return n.scope === "global"; });
  }

  var unreadCount = notifications.filter(function(n) { return !n.read; }).length;

  // Type styling
  var typeStyle = function(type) {
    var map = {
      "social_approval": { bg: "#e8f5e9", icon: "📷", label: "Social Media" },
      "project_complete": { bg: "#e3f2fd", icon: "✓", label: "Project Complete" },
      "task_update": { bg: "#f0f0f0", icon: "⚙", label: "Task Update" },
      "system": { bg: "#f5f5f5", icon: "●", label: "System" },
      "general": { bg: "#f5f5f5", icon: "●", label: "General" }
    };
    return map[type] || map.general;
  };

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" style={{ width: 520, maxWidth: "90%" }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex" }}>{IC.bell}</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#111", color: "#fff", fontWeight: 500 }}>{unreadCount} new</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#888", textDecoration: "underline" }}>
                Mark all read
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 6 }}>
          {[["all", "All"], ["personal", "For You"], ["global", "System"]].map(function(pair) {
            var key = pair[0], label = pair[1];
            var count = key === "all" ? notifications.length
              : key === "personal" ? notifications.filter(function(n) { return n.scope !== "global"; }).length
              : notifications.filter(function(n) { return n.scope === "global"; }).length;
            return (
              <button key={key} onClick={function() { setFilter(key); }}
                style={Object.assign({}, s.btn(filter === key ? "primary" : "secondary"), { fontSize: 10, padding: "4px 12px" })}>
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 12 }}>Loading notifications...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 12 }}>No notifications</div>
          ) : filtered.map(function(n) {
            var ts = typeStyle(n.type);
            var isPersonal = n.scope !== "global";
            return (
              <div key={n._id} onClick={function() { if (!n.read) markRead(n._id); }}
                style={{ padding: "12px 24px", borderBottom: "1px solid #f5f5f5", display: "flex", gap: 12, alignItems: "flex-start",
                  background: n.read ? "transparent" : "#fafafa", cursor: n.read ? "default" : "pointer" }}
                onMouseEnter={function(e) { e.currentTarget.style.background = "#f8f8f8"; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = n.read ? "transparent" : "#fafafa"; }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: ts.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 2 }}>
                  {ts.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 500, color: "#111" }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: "#999", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {n.timestamp && <span>{fmtDate(n.timestamp)}</span>}
                    <span style={{ padding: "1px 6px", borderRadius: 3, background: isPersonal ? "#e8f5e9" : "#f0f0f0", color: isPersonal ? "#2e7d32" : "#888", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      {isPersonal ? "For You" : "System"}
                    </span>
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#111", flexShrink: 0, marginTop: 6 }} />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end" }}>
          <button style={s.btn("secondary")} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
