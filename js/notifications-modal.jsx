// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS MODAL — For You / System / Archive tabs
// ═══════════════════════════════════════════════════════════════

function NotificationsModal({ userEmail, onClose, onCountUpdate }) {

  var [notifications, setNotifications] = useState([]);
  var [loading, setLoading] = useState(true);
  var [tab, setTab] = useState("foryou");

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

  var markRead = function(id) {
    if (DB.isLive()) {
      DB.markNotificationRead(id).catch(function(err) { console.error("DB: Failed to mark read", err); });
    }
    setNotifications(function(prev) {
      return prev.map(function(n) { return n._id === id ? Object.assign({}, n, { read: true }) : n; });
    });
    if (onCountUpdate) onCountUpdate();
  };

  var markAllRead = function() {
    if (DB.isLive() && userEmail) {
      DB.markAllNotificationsRead(userEmail).catch(function(err) { console.error("DB: Failed to mark all read", err); });
    }
    setNotifications(function(prev) {
      return prev.map(function(n) { return Object.assign({}, n, { read: true }); });
    });
    if (onCountUpdate) onCountUpdate();
  };

  var clearArchive = function() {
    if (DB.isLive() && userEmail) {
      DB.clearReadNotifications(userEmail).then(function(result) {
        console.log("Clear archive result:", result);
      }).catch(function(err) { console.error("DB: Failed to clear archive", err); });
    }
    setNotifications(function(prev) {
      return prev.filter(function(n) { return !n.read; });
    });
  };

  var unread = notifications.filter(function(n) { return !n.read; });
  var forYou = unread.filter(function(n) { return n.scope !== "global"; });
  var system = unread.filter(function(n) { return n.scope === "global"; });
  var archive = notifications.filter(function(n) { return n.read; });
  var unreadCount = unread.length;

  var tabItems = tab === "foryou" ? forYou : tab === "system" ? system : archive;

  var typeStyle = function(type) {
    var map = {
      "project_created": { icon: "+", label: "Project" },
      "project_completed": { icon: "✓", label: "Complete" },
      "project_deleted": { icon: "×", label: "Deleted" },
      "step_completed": { icon: "●", label: "Step" },
      "artwork_uploaded": { icon: "↑", label: "Artwork" },
      "file_removed": { icon: "−", label: "File" },
      "doc_uploaded": { icon: "↑", label: "Document" },
      "charges_updated": { icon: "£", label: "Charges" },
      "stock_updated": { icon: "■", label: "Stock" },
      "member_added": { icon: "+", label: "Team" },
      "member_updated": { icon: "✎", label: "Team" },
      "member_status": { icon: "●", label: "Team" },
      "user_login": { icon: "→", label: "Login" },
      "user_logout": { icon: "←", label: "Logout" },
      "social_approval": { icon: "✓", label: "Social" },
      "general": { icon: "●", label: "General" }
    };
    return map[type] || map.general;
  };

  var iconCircle = { width: 28, height: 28, borderRadius: "50%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#999", flexShrink: 0, marginTop: 2, fontWeight: 500 };

  var renderItem = function(n, isArchive) {
    var ts = typeStyle(n.type);
    return (
      <div key={n._id} onClick={function() { if (!isArchive && !n.read) markRead(n._id); }}
        style={{ padding: "12px 24px", borderBottom: "1px solid #f5f5f5", display: "flex", gap: 12, alignItems: "flex-start",
          background: isArchive ? "transparent" : "#fafafa", cursor: isArchive ? "default" : "pointer",
          opacity: isArchive ? 0.6 : 1 }}
        onMouseEnter={function(e) { if (!isArchive) e.currentTarget.style.background = "#f0f0f0"; }}
        onMouseLeave={function(e) { if (!isArchive) e.currentTarget.style.background = "#fafafa"; }}>
        <div style={iconCircle}>
          {ts.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: isArchive ? 400 : 500, color: isArchive ? "#888" : "#111" }}>{n.message}</div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {n.timestamp && <span>{fmtDate(n.timestamp)}</span>}
            <span style={{ padding: "1px 6px", borderRadius: 3, background: "#f0f0f0", color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {ts.label}
            </span>
          </div>
        </div>
        {!isArchive && !n.read && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#111", flexShrink: 0, marginTop: 6 }} />
        )}
      </div>
    );
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
            {tab !== "archive" && unreadCount > 0 && (
              <button onClick={markAllRead}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#888", textDecoration: "underline" }}>
                Mark all read
              </button>
            )}
            {tab === "archive" && archive.length > 0 && (
              <button onClick={clearArchive}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#c00", textDecoration: "underline" }}>
                Clear Archive
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "12px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 6 }}>
          {[
            ["foryou", "For You", forYou.length],
            ["system", "System", system.length],
            ["archive", "Archive", archive.length]
          ].map(function(pair) {
            var key = pair[0], label = pair[1], count = pair[2];
            return (
              <button key={key} onClick={function() { setTab(key); }}
                style={Object.assign({}, s.btn(tab === key ? "primary" : "secondary"), { fontSize: 10, padding: "4px 12px" })}>
                {label} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 12 }}>Loading notifications...</div>
          ) : tabItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 12 }}>
              {tab === "archive" ? "No archived notifications" : tab === "foryou" ? "No personal notifications" : "No system notifications"}
            </div>
          ) : tabItems.map(function(n) {
            return renderItem(n, tab === "archive");
          })}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end" }}>
          <button style={s.btn("secondary")} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
