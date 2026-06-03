function LoginScreen({ onLogin }) {
  var [email, setEmail] = useState("");
  var [password, setPassword] = useState("");
  var [error, setError] = useState("");
  var [loading, setLoading] = useState(false);
  var [showForgot, setShowForgot] = useState(false);
  var [forgotEmail, setForgotEmail] = useState("");
  var [forgotResult, setForgotResult] = useState(null);
  var [forgotError, setForgotError] = useState("");
  var [forgotLoading, setForgotLoading] = useState(false);

  var go = function(e) {
    if (e) e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address"); return; }
    if (!password.trim()) { setError("Please enter your password"); return; }
    setLoading(true);

    if (DB.isLive()) {
      DB.authenticateUser(email.trim().toLowerCase(), password).then(function(result) {
        setLoading(false);
        if (result && result.success) {
          onLogin({ email: result.user.email, name: result.user.name, role: result.user.role });
        } else {
          setError(result.error || "Authentication failed. Please check your credentials.");
        }
      }).catch(function(err) {
        setLoading(false);
        setError("Unable to connect. Please try again.");
        console.error("Auth error:", err);
      });
    } else {
      setTimeout(function() {
        setLoading(false);
        if (email.trim().toLowerCase() === "tiny.panda@tiny-panda.com") {
          onLogin({ email: email.trim(), name: "Barrie", role: "admin" });
        } else {
          setError("Account not recognised. Use demo credentials in standalone mode.");
        }
      }, 800);
    }
  };

  var handleForgot = function() {
    setForgotError("");
    setForgotResult(null);
    if (!forgotEmail.trim()) { setForgotError("Please enter your email address"); return; }
    setForgotLoading(true);

    if (DB.isLive()) {
      DB.resetPassword(forgotEmail.trim().toLowerCase()).then(function(result) {
        setForgotLoading(false);
        if (result && result.success) {
          setForgotResult(result);
        } else {
          setForgotError(result.error || "Unable to reset password");
        }
      }).catch(function(err) {
        setForgotLoading(false);
        setForgotError("Unable to connect. Please try again.");
      });
    } else {
      setForgotLoading(false);
      setForgotError("Password reset is not available in standalone mode.");
    }
  };

  return (
    <div className="login-screen" style={{ fontFamily: FONT }}>
      <div style={{ width: 400, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <img src={LOGO_URL} alt="Graphitecture" style={{ height: 40, marginBottom: 16 }}
            onError={function(e) { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Graphitecture
          </div>
        </div>
        <div className="login-card">
          <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 28 }}>
            Enter your credentials to access the dashboard
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6, letterSpacing: "0.03em", textTransform: "uppercase" }}>Email Address</div>
            <input type="email" placeholder="you@graphitecture.co.uk" value={email}
              onChange={function(e) { setEmail(e.target.value); setError(""); }}
              onKeyDown={function(e) { if (e.key === "Enter") go(e); }}
              style={Object.assign({}, s.input, { padding: "11px 14px", fontSize: 13, background: "#fafafa" })} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#888", letterSpacing: "0.03em", textTransform: "uppercase" }}>Password</div>
              <div style={{ fontSize: 11, color: "#1565c0", cursor: "pointer" }}
                onClick={function() { setShowForgot(true); setForgotEmail(email); setForgotResult(null); setForgotError(""); }}>Forgot password?</div>
            </div>
            <input type="password" placeholder="••••••••" value={password}
              onChange={function(e) { setPassword(e.target.value); setError(""); }}
              onKeyDown={function(e) { if (e.key === "Enter") go(e); }}
              style={Object.assign({}, s.input, { padding: "11px 14px", fontSize: 13, background: "#fafafa" })} />
          </div>
          {error && (
            <div style={{ fontSize: 12, color: "#c00", marginBottom: 16, padding: "10px 14px", background: "#fff5f5", borderRadius: 4, border: "1px solid #fdd" }}>
              {error}
            </div>
          )}
          <button onClick={go} disabled={loading}
            style={Object.assign({}, s.btn(), { width: "100%", padding: "12px 0", fontSize: 13, opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer" })}>
            {loading
              ? React.createElement("span", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 } },
                  React.createElement("span", { className: "login-spinner" }), "Authenticating..."
                )
              : "Sign In"}
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "#444" }}>
          Powered by Tiny Panda Graphic Artists Ltd.
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgot && (
        <div className="wizard-overlay" onClick={function() { setShowForgot(false); }}>
          <div className="wizard-modal" style={{ width: 400, maxWidth: "90%" }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Reset Password</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Enter your email to receive a temporary password</div>
            </div>
            <div style={{ padding: 24 }}>
              {!forgotResult ? (
                <div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>Email Address</div>
                  <input type="email" placeholder="you@graphitecture.co.uk" value={forgotEmail}
                    onChange={function(e) { setForgotEmail(e.target.value); setForgotError(""); }}
                    onKeyDown={function(e) { if (e.key === "Enter") handleForgot(); }}
                    style={Object.assign({}, s.input, { padding: "11px 14px", fontSize: 13, background: "#fafafa" })} />
                  {forgotError && (
                    <div style={{ fontSize: 12, color: "#c00", marginTop: 12, padding: "10px 14px", background: "#fff5f5", borderRadius: 4, border: "1px solid #fdd" }}>
                      {forgotError}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ padding: "16px", background: "#e8f5e9", borderRadius: 6, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#2e7d32", marginBottom: 8 }}>Password reset successful</div>
                    <div style={{ fontSize: 12, color: "#333", marginBottom: 4 }}>Hi {forgotResult.name}, your password has been reset.</div>
                    <div style={{ fontSize: 12, color: "#333" }}>Your temporary password is:</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "monospace", marginTop: 8, padding: "8px 16px", background: "#fff", borderRadius: 4, display: "inline-block", letterSpacing: "0.1em" }}>{forgotResult.tempPassword}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>Please sign in with this password and change it in your Profile settings.</div>
                </div>
              )}
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              {!forgotResult ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.btn("secondary")} onClick={function() { setShowForgot(false); }}>Cancel</button>
                  <button style={s.btn()} onClick={handleForgot} disabled={forgotLoading}>
                    {forgotLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              ) : (
                <button style={s.btn()} onClick={function() { setShowForgot(false); setPassword(""); }}>Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
