// ═══════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════

function SettingsModal({ onClose, userEmail }) {

  var defaults = {
    defaultView: "list",
    scheduleView: "project",
    notifyTaskComplete: true,
    notifyNewItem: true,
    notifyStatusChange: true,
    notifyScheduleChange: false,
    timezone: "Europe/London",
    dateFormat: "DD/MM/YYYY",
    theme: "light"
  };

  var [settings, setSettings] = useState(defaults);
  var [loaded, setLoaded] = useState(false);

  // Load saved settings from DB
  useEffect(function() {
    if (DB.isLive() && userEmail) {
      DB.getUserSettings(userEmail).then(function(saved) {
        if (saved) {
          setSettings(function(prev) { return Object.assign({}, prev, saved); });
        }
        setLoaded(true);
      }).catch(function(err) {
        console.error("DB: Failed to load settings", err);
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  }, []);

  var update = function(key, value) {
    setSettings(function(prev) { return Object.assign({}, prev, { [key]: value }); });
  };

  // Toggle switch component
  var Toggle = function(props) {
    return (
      <div onClick={function() { update(props.field, !settings[props.field]); }}
        style={{ width: 36, height: 20, borderRadius: 10, background: settings[props.field] ? "#111" : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: settings[props.field] ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
    );
  };

  // Section component
  var Section = function(props) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{props.title}</div>
        {props.children}
      </div>
    );
  };

  // Row component
  var Row = function(props) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{props.label}</div>
          {props.sub && <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>{props.sub}</div>}
        </div>
        {props.children}
      </div>
    );
  };

  if (!loaded) {
    return (
      <div className="wizard-overlay" onClick={onClose}>
        <div className="wizard-modal" style={{ width: 480, maxWidth: "90%", minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={function(e) { e.stopPropagation(); }}>
          <div style={{ fontSize: 12, color: "#999" }}>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" style={{ width: 480, maxWidth: "90%" }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex" }}>{IC.settings}</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Settings</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
        </div>

        <div style={{ padding: 24, maxHeight: 450, overflowY: "auto" }}>

          <Section title="Display Preferences">
            <Row label="Default Portfolio View" sub="How projects are shown on Exec Summary">
              <select style={Object.assign({}, s.select, { width: "auto", minWidth: 120, padding: "5px 10px", fontSize: 11 })}
                value={settings.defaultView} onChange={function(e) { update("defaultView", e.target.value); }}>
                <option value="list">List View</option>
                <option value="cards">Card View</option>
              </select>
            </Row>
            <Row label="Default Schedule View" sub="Initial view when opening Schedule tab">
              <select style={Object.assign({}, s.select, { width: "auto", minWidth: 120, padding: "5px 10px", fontSize: 11 })}
                value={settings.scheduleView} onChange={function(e) { update("scheduleView", e.target.value); }}>
                <option value="project">By Project</option>
                <option value="resource">By Resource</option>
              </select>
            </Row>
            <Row label="Date Format" sub="How dates are displayed throughout the app">
              <select style={Object.assign({}, s.select, { width: "auto", minWidth: 120, padding: "5px 10px", fontSize: 11 })}
                value={settings.dateFormat} onChange={function(e) { update("dateFormat", e.target.value); }}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </Row>
            <Row label="Theme" sub="Application colour scheme">
              <select style={Object.assign({}, s.select, { width: "auto", minWidth: 120, padding: "5px 10px", fontSize: 11 })}
                value={settings.theme} onChange={function(e) { update("theme", e.target.value); }}>
                <option value="light">Light</option>
                <option value="dark">Dark (coming soon)</option>
              </select>
            </Row>
          </Section>

          <Section title="Notifications">
            <Row label="Task Completed" sub="When an operator marks a task as complete">
              <Toggle field="notifyTaskComplete" />
            </Row>
            <Row label="New Line Item Added" sub="When a new line is added to any project">
              <Toggle field="notifyNewItem" />
            </Row>
            <Row label="Status Changes" sub="When a task status changes">
              <Toggle field="notifyStatusChange" />
            </Row>
            <Row label="Schedule Changes" sub="When items are rescheduled">
              <Toggle field="notifyScheduleChange" />
            </Row>
          </Section>

          <Section title="Regional">
            <Row label="Timezone">
              <select style={Object.assign({}, s.select, { width: "auto", minWidth: 160, padding: "5px 10px", fontSize: 11 })}
                value={settings.timezone} onChange={function(e) { update("timezone", e.target.value); }}>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Europe/Paris">Europe/Paris (CET)</option>
                <option value="America/New_York">America/New York (EST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </Row>
          </Section>

        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
          <button style={s.btn("secondary")} onClick={onClose}>Cancel</button>
          <button style={s.btn()} onClick={function() {
            if (DB.isLive() && userEmail) {
              DB.saveUserSettings(userEmail, settings)
                .catch(function(err) { console.error("DB: Failed to save settings", err); });
            }
            onClose();
          }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
