/**
 * Graphitecture Production Manager — AI Assistant Panel
 * Side panel with chat interface, voice input, and Claude API integration.
 * Parses natural language into app actions (navigate, filter, create, update, analyse).
 */




function buildSystemPrompt(appState) {
  return `You are an AI assistant embedded in the Graphitecture Production Manager — a project tracking app for large-format print & signage production.

You can CONTROL the app by returning JSON actions, and you can ANSWER questions about the data.

ALWAYS respond with valid JSON in this exact format:
{
  "message": "Your conversational response to the user",
  "actions": [
    { "type": "action_type", ...params }
  ]
}

If no action is needed (just answering a question), return an empty actions array.

AVAILABLE ACTIONS:

1. Navigate to a tab:
   { "type": "navigate", "tab": "exec|summary|docs|tracker|scheduler|timesheet|costs|xero|history|crm" }

2. Switch project:
   { "type": "switch_project", "projectId": "P1|P2|P3|P4|..." }
   - You can combine with navigate: switch project then go to a tab

3. Filter tracker:
   { "type": "navigate", "tab": "tracker", "filter": "ALL|PENDING|IN PROGRESS|PRINTED|FINISHED" }

4. Update item status:
   { "type": "update_status", "itemDesc": "partial item description to match", "newStatus": "PENDING|IN PROGRESS|PRINTED|FINISHED" }

5. Create a new project:
   { "type": "create_project", "data": {
       "info": { "customer": "...", "project": "...", "ref": "201-XXXX", "manager": "DH", "dateRequired": "...", "delivery": "TBC", "supplier": "Graphitecture" },
       "items": [
         { "desc": "...", "process": "material process name", "qty": N, "printW": mm, "printH": mm }
       ]
   }}
   Available processes: "Removable vinyl 8700 with seal" (£36/m²), "Permanent vinyl with seal" (£36/m²), "Super sticky vinyl with seal" (£40/m²), "Black back Fabric" (£20/m²), "Contravision 70/30" (£40/m²), "5mm Foamex – face mounted" (£45/m²), "10mm Foamex – face mounted" (£55/m²), "Stock vinyl kiss cut logo" (£25/m²)
   When user gives dimensions in metres, convert to mm (×1000). Default process is "Removable vinyl 8700 with seal" if not specified.
   Auto-calculate: sqm = (W × H / 1,000,000) × qty, cost = sqm × rate

6. Add timesheet entry:
   { "type": "add_timesheet", "name": "staff name", "fn": "function name", "hours": N }
   Staff: Andrew C, Dima, George C, Harry, Laimis, Tomas, Edvinas, Elia, Mark R, Darren H, Alius, Chris C, Kerry G, Keiran
   Functions: Artworking (£35), Print (£30), Laminating (£25), Mounting (£25), Cutting (£30), Kiss Cutting (£30), Weed and App Tape (£25), Hand Assembly (£25), Installation (£27.50)

7. Highlight items (flash pink for 2 seconds):
   { "type": "highlight", "itemDesc": "partial description" }           — single item
   { "type": "highlight", "itemDesc": ["desc 1", "desc 2", "desc 3"] } — multiple items
   Use this whenever you mention specific items — so the user can see which ones you're referring to.
   Combine with navigate so the items are visible. For example, if user asks "how many items are pending?", navigate to tracker with PENDING filter AND highlight all the pending items by their descriptions.
   When answering questions like "what's the most expensive item?" or "which items are delayed?", always include a highlight action.

CURRENT APP STATE:
${JSON.stringify(appState, null, 2)}

GUIDELINES:
- Be concise and professional in your messages
- When creating projects, infer sensible defaults (process type from description, reasonable dimensions if not given)
- When user says "show me" or "go to", navigate to the right tab/project
- When user asks about costs, items, progress — compute from the data provided
- For ambiguous item references, match on partial description (case-insensitive)
- You can chain multiple actions in one response (e.g. switch project + navigate)
- Keep messages short — 1-2 sentences. This is a quick command interface, not a conversation
- If user asks to do something you can't, explain what you CAN do`;
}

async function callClaude(messages, appState) {
  if (!DB.isLive()) {
    return { message: "AI assistant requires a live connection. Please use the app within Wix.", actions: [] };
  }

  var systemPrompt = buildSystemPrompt(appState);
  var result = await DB.aiChat(messages, systemPrompt);

  if (!result || !result.success) {
    throw new Error(result ? result.error : "AI request failed");
  }

  var data = result.data;
  var text = data.content.map(function(c) { return c.text || ""; }).join("");

  // Parse JSON response
  try {
    var cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return { message: text, actions: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// AI PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════

function AIPanel({ isOpen, onClose, appState, onAction }) {
  const [messages, setMessages] = React.useState([
    { role: "assistant", text: "Hi — I'm your AI assistant. Ask me anything about your projects, or tell me what to do.\n\nTry: \"Show me pending items for Harrods\" or \"Create a new project for Audi\"" }
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const messagesEndRef = React.useRef(null);
  const recognitionRef = React.useRef(null);
  const sendMessageRef = React.useRef(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Detect if we're inside an iframe
  const inIframe = React.useRef(false);
  try { inIframe.current = window.self !== window.top; } catch(e) { inIframe.current = true; }

  // Set up speech recognition (direct mode for non-iframe)
  const listeningRef = React.useRef(false);
  const voicePopupRef = React.useRef(null);

  React.useEffect(() => {
    // Listen for postMessage from voice popup (works in both iframe and direct)
    const handleVoiceMessage = (event) => {
      if (event.data && event.data.type === "voice-transcript" && event.data.text) {
        setListening(false);
        voicePopupRef.current = null;
        // Auto-submit the voice transcript
        sendMessageRef.current(event.data.text);
      }
    };
    window.addEventListener("message", handleVoiceMessage);

    // Only set up direct SpeechRecognition if NOT in iframe
    if (!inIframe.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.log("Speech recognition not supported in this browser");
        return () => window.removeEventListener("message", handleVoiceMessage);
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-GB";

      recognition.onstart = () => {
        listeningRef.current = true;
        setListening(true);
      };

      const lastTranscriptRef = { current: "" };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(r => r[0].transcript)
          .join("");
        lastTranscriptRef.current = transcript;
        setInput(transcript);
      };

      recognition.onerror = (event) => {
        console.log("Speech error:", event.error);
        listeningRef.current = false;
        setListening(false);
        lastTranscriptRef.current = "";
        if (event.error === "not-allowed") {
          setMessages(prev => [...prev, { role: "assistant", text: "Microphone access was denied. Click the lock icon in your address bar, set Microphone to Allow, then reload the page.", actions: [] }]);
        } else if (event.error !== "aborted") {
          setMessages(prev => [...prev, { role: "assistant", text: `Voice input error: ${event.error}. Try using the text input instead.`, actions: [] }]);
        }
      };

      recognition.onend = () => {
        listeningRef.current = false;
        setListening(false);
        // Auto-submit if we captured speech
        const text = lastTranscriptRef.current.trim();
        lastTranscriptRef.current = "";
        if (text && sendMessageRef.current) {
          sendMessageRef.current(text);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => window.removeEventListener("message", handleVoiceMessage);
  }, []);

  const toggleVoice = () => {
    if (inIframe.current) {
      // Iframe mode: open popup window for voice capture
      if (voicePopupRef.current && !voicePopupRef.current.closed) {
        voicePopupRef.current.focus();
        return;
      }
      // Build the popup URL relative to the app's origin
      const base = document.baseURI || window.location.href;
      const voiceUrl = new URL("voice.html", base).href;
      const popup = window.open(voiceUrl, "VoiceInput", "width=400,height=300,left=200,top=200,toolbar=no,menubar=no,scrollbars=no,resizable=no");
      if (popup) {
        voicePopupRef.current = popup;
        setListening(true);
        // Monitor popup close
        const check = setInterval(() => {
          if (popup.closed) {
            clearInterval(check);
            setListening(false);
            voicePopupRef.current = null;
          }
        }, 500);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: "Popup was blocked by the browser. Please allow popups for this site and try again.", actions: [] }]);
      }
    } else {
      // Direct mode: use SpeechRecognition in this window
      if (!recognitionRef.current) {
        setMessages(prev => [...prev, { role: "assistant", text: "Voice input isn't available in this browser. Try Chrome or Edge for speech recognition.", actions: [] }]);
        return;
      }
      if (listeningRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
        listeningRef.current = false;
        setListening(false);
      } else {
        try {
          setInput("");
          recognitionRef.current.start();
        } catch (e) {
          console.log("Speech start error:", e);
          setMessages(prev => [...prev, { role: "assistant", text: "Couldn't start voice input. Make sure you're on HTTPS and have allowed microphone access.", actions: [] }]);
          listeningRef.current = false;
          setListening(false);
        }
      }
    }
  };

  const sendMessage = async (directText) => {
    const text = (directText || input).trim();
    if (!text || loading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      // Build conversation history for Claude (last 10 messages)
      const history = [...messages.slice(-10), { role: "user", text }]
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.role === "assistant" ? JSON.stringify({ message: m.text, actions: [] }) : m.text
        }));

      // Only send user/assistant pairs
      const apiMessages = history.filter(m => m.role === "user").length > 0
        ? history
        : [{ role: "user", content: text }];

      const result = await callClaude(apiMessages, appState);

      // Add assistant response
      setMessages(prev => [...prev, {
        role: "assistant",
        text: result.message || "Done.",
        actions: result.actions || []
      }]);

      // Execute actions
      if (result.actions && result.actions.length > 0) {
        for (const action of result.actions) {
          onAction(action);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `Sorry, I hit an error: ${err.message}`,
        actions: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Keep ref updated so event listeners can call latest sendMessage
  sendMessageRef.current = sendMessage;

  // Quick suggestion chips
  const suggestions = [
    "What's our total portfolio value?",
    "Show pending items",
    "Switch to the Rolls-Royce project",
    "Create a new project"
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="ai-backdrop" onClick={onClose} />}

      {/* Panel */}
      <div className={`ai-panel ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="ai-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 2a10 10 0 0110 10 10 10 0 01-10 10A10 10 0 012 12 10 10 0 0112 2z"/>
                <path d="M8 12h.01M12 12h.01M16 12h.01"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Control Centre</div>
              <div style={{ fontSize: 10, color: "#888" }}>Graphitecture AI</div>
            </div>
          </div>
          <button onClick={onClose} className="ai-close-btn">✕</button>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ${msg.role}`}>
              {msg.role === "assistant" && (
                <div className="ai-msg-avatar">AI</div>
              )}
              <div className={`ai-msg-bubble ${msg.role}`}>
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="ai-msg-actions">
                    {msg.actions.map((a, j) => (
                      <span key={j} className="ai-action-tag">
                        {a.type === "navigate" && `→ ${a.tab}`}
                        {a.type === "switch_project" && `→ Project ${a.projectId}`}
                        {a.type === "update_status" && `✓ Status updated`}
                        {a.type === "create_project" && `+ New project`}
                        {a.type === "add_timesheet" && `+ Timesheet entry`}
                        {a.type === "filter" && `⊞ Filter: ${a.filter}`}
                        {a.type === "highlight" && `◉ ${a.itemDesc}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-msg assistant">
              <div className="ai-msg-avatar">AI</div>
              <div className="ai-msg-bubble assistant">
                <div className="ai-thinking">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions (show only if few messages) */}
        {messages.length <= 2 && (
          <div className="ai-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="ai-suggestion-chip"
                onClick={() => { sendMessage(s); }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="ai-input-bar">
          <button
            className={`ai-mic-btn ${listening ? "active" : ""}`}
            onClick={toggleVoice}
            title={listening ? "Stop listening" : "Voice input"}>
            {listening ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#c00" stroke="none">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>
          <input
            className="ai-text-input"
            type="text"
            placeholder={listening ? "Listening..." : "Ask anything or give a command..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            disabled={loading}
          />
          <button
            className="ai-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
