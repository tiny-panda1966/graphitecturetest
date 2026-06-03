// ═══════════════════════════════════════════════════════════════
// PROFILE & ACCOUNT MODAL — with Change Password
// ═══════════════════════════════════════════════════════════════

function ProfileModal({ userEmail, userName, userRole, onClose }) {
  var name = userName || (userEmail ? userEmail.split("@")[0].replace(".", " ") : "User");
  var initials = name.split(" ").map(function(w) { return w[0]; }).join("").toUpperCase().slice(0, 2);

  // Change password state
  var [showChangePw, setShowChangePw] = useState(false);
  var [currentPw, setCurrentPw] = useState("");
  var [newPw, setNewPw] = useState("");
  var [confirmPw, setConfirmPw] = useState("");
  var [pwError, setPwError] = useState("");
  var [pwSuccess, setPwSuccess] = useState(false);
  var [pwLoading, setPwLoading] = useState(false);

  var handleChangePassword = function() {
    setPwError("");
    if (!currentPw) { setPwError("Please enter your current password"); return; }
    if (!newPw) { setPwError("Please enter a new password"); return; }
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    if (newPw === currentPw) { setPwError("New password must be different from current"); return; }

    setPwLoading(true);
    if (DB.isLive()) {
      DB.changePassword(userEmail, currentPw, newPw).then(function(result) {
        setPwLoading(false);
        if (result && result.success) {
          setPwSuccess(true);
          setCurrentPw(""); setNewPw(""); setConfirmPw("");
          setTimeout(function() { setPwSuccess(false); setShowChangePw(false); }, 3000);
        } else {
          setPwError(result.error || "Failed to change password");
        }
      }).catch(function(err) {
        setPwLoading(false);
        setPwError("Unable to connect. Please try again.");
      });
    } else {
      setPwLoading(false);
      setPwError("Password change is not available in standalone mode.");
    }
  };

  var fields = [
    { label: "Full Name", value: name },
    { label: "Email Address", value: userEmail },
    { label: "Role", value: userRole || "User", capitalize: true },
    { label: "Company", value: "Graphitecture" },
    { label: "Member Since", value: "March 2026" },
    { label: "Last Login", value: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
  ];

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" style={{ width: 480, maxWidth: "90%" }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex" }}>{IC.profile}</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Profile & Account</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
        </div>

        <div style={{ padding: 24, maxHeight: "60vh", overflowY: "auto" }}>
          {/* Avatar + name header */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 500, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, textTransform: "capitalize" }}>{name}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{userEmail}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 3, background: "#111", color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>{userRole || "User"}</span>
                <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 3, background: "#f0f0f0", color: "#666", letterSpacing: "0.04em", textTransform: "uppercase", marginLeft: 6 }}>Active</span>
              </div>
            </div>
          </div>

          {/* Detail fields */}
          {fields.map(function(field, i) {
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
                <span style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>{field.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, textTransform: field.capitalize ? "capitalize" : "none" }}>{field.value}</span>
              </div>
            );
          })}

          {/* Change password section */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
            {!showChangePw ? (
              <button onClick={function() { setShowChangePw(true); setPwError(""); setPwSuccess(false); }}
                style={Object.assign({}, s.btn("secondary"), { width: "100%", fontSize: 12 })}>
                Change Password
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Change Password</div>

                {pwSuccess ? (
                  <div style={{ padding: "12px 16px", background: "#e8f5e9", borderRadius: 6, fontSize: 12, color: "#2e7d32", textAlign: "center" }}>
                    Password changed successfully
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Current Password</div>
                      <input type="password" value={currentPw}
                        onChange={function(e) { setCurrentPw(e.target.value); setPwError(""); }}
                        style={Object.assign({}, s.input, { padding: "9px 12px", fontSize: 12 })} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>New Password</div>
                      <input type="password" value={newPw}
                        onChange={function(e) { setNewPw(e.target.value); setPwError(""); }}
                        style={Object.assign({}, s.input, { padding: "9px 12px", fontSize: 12 })} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.03em" }}>Confirm New Password</div>
                      <input type="password" value={confirmPw}
                        onChange={function(e) { setConfirmPw(e.target.value); setPwError(""); }}
                        onKeyDown={function(e) { if (e.key === "Enter") handleChangePassword(); }}
                        style={Object.assign({}, s.input, { padding: "9px 12px", fontSize: 12 })} />
                    </div>
                    {pwError && (
                      <div style={{ fontSize: 12, color: "#c00", padding: "8px 12px", background: "#fff5f5", borderRadius: 4, border: "1px solid #fdd", marginBottom: 12 }}>
                        {pwError}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button style={s.btn("secondary")} onClick={function() { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwError(""); }}>Cancel</button>
                      <button style={s.btn()} onClick={handleChangePassword} disabled={pwLoading}>
                        {pwLoading ? "Saving..." : "Update Password"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end" }}>
          <button style={s.btn("secondary")} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
