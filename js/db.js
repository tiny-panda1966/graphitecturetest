// ═══════════════════════════════════════════════════════════════
// db.js — Data Service (postMessage bridge to Wix Velo)
// Replaces demo data.js with live database calls
// ═══════════════════════════════════════════════════════════════

var DB = (function() {

  // Pending request callbacks
  var _pending = {};
  var _requestCounter = 0;
  var _isIframe = (window.parent !== window);

  // Realtime callback (Pusher)
  var _realtimeCallback = null;
  var _currentUserEmail = null;
  var _pusherChannel = null;

  // Listen for responses from Wix
  window.addEventListener("message", function(event) {
    var msg = event.data;
    if (!msg || msg.type !== "gfx-response") return;
    var cb = _pending[msg.requestId];
    if (!cb) return;
    delete _pending[msg.requestId];
    if (msg.success) {
      cb.resolve(msg.data);
      // Auto-publish for write operations (not reads)
      if (cb.action && !READ_ACTIONS[cb.action]) {
        DB.publishChange(null, cb.action);
      }
    } else {
      cb.reject(new Error(msg.error || "Request failed"));
    }
  });

  // Read-only actions that should NOT trigger a publish
  var READ_ACTIONS = {
    getProjects: 1, getProject: 1, getLineItems: 1, getTasks: 1, getProjectTasks: 1,
    getTimesheet: 1, getActivityLog: 1, getAllActivityLog: 1, getSchedule: 1,
    getUserSettings: 1, getAllMembers: 1, getMembers: 1, getNotifications: 1,
    getUnreadCount: 1, getInvoices: 1, getInvoicesByCustomer: 1, getAllInvoices: 1,
    getCharges: 1, getStockList: 1, loadFullProject: 1, loadAppData: 1,
    authenticateUser: 1, getXeroAuthUrl: 1, getXeroConnectionStatus: 1,
    getXeroContacts: 1, getWorkerAuth: 1, workerRequest: 1, aiChat: 1
  };

  // Send request to Wix parent
  function request(action, payload) {
    return new Promise(function(resolve, reject) {
      if (!_isIframe) {
        reject(new Error("Not running inside Wix iframe. Using demo data."));
        return;
      }

      var requestId = "gfx-" + (++_requestCounter) + "-" + Date.now();
      _pending[requestId] = { resolve: resolve, reject: reject, action: action };

      // Timeout after 15 seconds
      setTimeout(function() {
        if (_pending[requestId]) {
          delete _pending[requestId];
          reject(new Error("Request timeout: " + action));
        }
      }, 15000);

      window.parent.postMessage({
        type: "gfx-request",
        action: action,
        payload: payload || {},
        requestId: requestId
      }, "*");
    });
  }

  return {

    // ── Check if running in Wix iframe ──
    isLive: function() { return _isIframe; },

    // ── Projects ──
    getProjects: function() {
      return request("getProjects");
    },

    getProject: function(projectId) {
      return request("getProject", { projectId: projectId });
    },

    createProject: function(data) {
      return request("createProject", { data: data });
    },

    updateProject: function(projectId, data) {
      return request("updateProject", { projectId: projectId, data: data });
    },

    deleteProject: function(projectId) {
      return request("deleteProject", { projectId: projectId });
    },

    // ── Line Items ──
    getLineItems: function(projectId) {
      return request("getLineItems", { projectId: projectId });
    },

    createLineItem: function(data) {
      return request("createLineItem", { data: data });
    },

    updateLineItem: function(projectId, itemId, data) {
      return request("updateLineItem", { projectId: projectId, itemId: itemId, data: data });
    },

    deleteLineItem: function(projectId, itemId) {
      return request("deleteLineItem", { projectId: projectId, itemId: itemId });
    },

    bulkInsertLineItems: function(items) {
      return request("bulkInsertLineItems", { items: items });
    },

    // ── Tasks ──
    getTasks: function(projectId, itemId) {
      return request("getTasks", { projectId: projectId, itemId: itemId });
    },

    getProjectTasks: function(projectId) {
      return request("getProjectTasks", { projectId: projectId });
    },

    updateTask: function(projectId, itemId, taskId, data) {
      return request("updateTask", { projectId: projectId, itemId: itemId, taskId: taskId, data: data });
    },

    bulkInsertTasks: function(tasks) {
      return request("bulkInsertTasks", { tasks: tasks });
    },

    deleteTasksForItem: function(projectId, itemId) {
      return request("deleteTasksForItem", { projectId: projectId, itemId: itemId });
    },

    // ── Timesheet ──
    getTimesheet: function(projectId) {
      return request("getTimesheet", { projectId: projectId });
    },

    addTimesheetEntry: function(data) {
      return request("addTimesheetEntry", { data: data });
    },

    updateTimesheetEntry: function(id, data) {
      return request("updateTimesheetEntry", { id: id, data: data });
    },

    deleteTimesheetEntry: function(id) {
      return request("deleteTimesheetEntry", { id: id });
    },

    // ── Activity Log ──
    getActivityLog: function(projectId) {
      return request("getActivityLog", { projectId: projectId });
    },

    getAllActivityLog: function() {
      return request("getAllActivityLog");
    },

    addActivityLog: function(data) {
      return request("addActivityLog", { data: data });
    },

    // ── Schedule ──
    getSchedule: function(projectId) {
      return request("getSchedule", { projectId: projectId });
    },

    updateScheduleItem: function(projectId, itemId, data) {
      return request("updateScheduleItem", { projectId: projectId, itemId: itemId, data: data });
    },

    bulkUpsertSchedule: function(projectId, items) {
      return request("bulkUpsertSchedule", { projectId: projectId, items: items });
    },

    // ── User Settings ──
    getUserSettings: function(email) {
      return request("getUserSettings", { email: email });
    },

    saveUserSettings: function(email, data) {
      return request("saveUserSettings", { email: email, data: data });
    },

    // ── Composite Loads ──
    loadFullProject: function(projectId) {
      return request("loadFullProject", { projectId: projectId });
    },

    loadAppData: function(email) {
      return request("loadAppData", { email: email });
    },

    // ── Full Delete ──
    deleteFullProject: function(projectId) {
      return request("deleteFullProject", { projectId: projectId });
    },

    // ── Auth ──
    authenticateUser: function(email, password) {
      return request("authenticateUser", { email: email, password: password });
    },

    getMembers: function() {
      return request("getMembers");
    },

    getAllMembers: function() {
      return request("getAllMembers");
    },

    updateMember: function(id, data) {
      return request("updateMember", { id: id, data: data });
    },

    addMember: function(data) {
      return request("addMember", { data: data });
    },

    deleteMember: function(id) {
      return request("deleteMember", { id: id });
    },

    changePassword: function(email, currentPassword, newPassword) {
      return request("changePassword", { email: email, currentPassword: currentPassword, newPassword: newPassword });
    },

    resetPassword: function(email) {
      return request("resetPassword", { email: email });
    },

    // ── Notifications ──
    getNotifications: function(email) {
      return request("getNotifications", { email: email });
    },

    getUnreadCount: function(email) {
      return request("getUnreadCount", { email: email });
    },

    addNotification: function(data) {
      return request("addNotification", { data: data });
    },

    markNotificationRead: function(id) {
      return request("markNotificationRead", { id: id });
    },

    markAllNotificationsRead: function(email) {
      return request("markAllNotificationsRead", { email: email });
    },

    // ── Invoices ──
    getInvoices: function(projectId) {
      return request("getInvoices", { projectId: projectId });
    },

    getInvoicesByCustomer: function(customer) {
      return request("getInvoicesByCustomer", { customer: customer });
    },

    getAllInvoices: function() {
      return request("getAllInvoices");
    },

    createInvoice: function(data) {
      return request("createInvoice", { data: data });
    },

    updateInvoice: function(invoiceId, data) {
      return request("updateInvoice", { invoiceId: invoiceId, data: data });
    },

    // ── Xero ──
    getXeroAuthUrl: function(userEmail) {
      return request("getXeroAuthUrl", { userEmail: userEmail });
    },

    getXeroConnectionStatus: function(userEmail) {
      return request("getXeroConnectionStatus", { userEmail: userEmail });
    },

    refreshXeroToken: function(userEmail) {
      return request("refreshXeroToken", { userEmail: userEmail });
    },

    xeroCreateInvoice: function(userEmail, invoiceData) {
      return request("xeroCreateInvoice", { userEmail: userEmail, invoiceData: invoiceData });
    },

    getXeroContacts: function(userEmail) {
      return request("getXeroContacts", { userEmail: userEmail });
    },

    // ── AI Chat ──
    aiChat: function(messages, systemPrompt) {
      return request("aiChat", { messages: messages, systemPrompt: systemPrompt });
    },

    // ── Worker Proxy ──
    workerRequest: function(method, path, body) {
      return request("workerRequest", { method: method, path: path, body: body });
    },

    getWorkerAuth: function() {
      return request("getWorkerAuth");
    },

    // ── Charges ──
    getCharges: function() {
      return request("getCharges");
    },

    updateCharge: function(id, data) {
      return request("updateCharge", { id: id, data: data });
    },

    addCharge: function(data) {
      return request("addCharge", { data: data });
    },

    deleteCharge: function(id) {
      return request("deleteCharge", { id: id });
    },

    // ── Stock List ──
    getStockList: function() {
      return request("getStockList");
    },

    updateStockItem: function(id, data) {
      return request("updateStockItem", { id: id, data: data });
    },

    addStockItem: function(data) {
      return request("addStockItem", { data: data });
    },

    deleteStockItem: function(id) {
      return request("deleteStockItem", { id: id });
    },

    // ── Members (Admin) ──
    getAllMembers: function() {
      return request("getAllMembers");
    },

    updateMember: function(id, data) {
      return request("updateMember", { id: id, data: data });
    },

    addMember: function(data) {
      return request("addMember", { data: data });
    },

    // ── Realtime (Pusher) ──
    _workerCreds: null,

    setCurrentUser: function(email) {
      _currentUserEmail = email;
    },

    setWorkerCreds: function(creds) {
      this._workerCreds = creds;
    },

    connectPusher: function() {
      if (typeof Pusher === "undefined") {
        console.warn("Pusher not loaded");
        return;
      }
      var pusher = new Pusher("af4403031bff0f37cc36", { cluster: "eu" });
      _pusherChannel = pusher.subscribe("graphitecture");
      _pusherChannel.bind("data-changed", function(data) {
        console.log("Pusher event received:", data);
        // Ignore our own changes
        if (data.changedBy && data.changedBy === _currentUserEmail) return;
        if (_realtimeCallback) _realtimeCallback(data);
      });
      console.log("Pusher connected and subscribed");
    },

    publishChange: function(projectId, changeType) {
      var creds = DB._workerCreds;
      if (!creds) return;
      fetch(creds.url + "/notify", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + creds.token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId: projectId || null,
          changeType: changeType || "update",
          changedBy: _currentUserEmail || "unknown"
        })
      }).catch(function(err) { console.warn("Publish failed:", err); });
    },

    onRealtimeUpdate: function(callback) {
      _realtimeCallback = callback;
    }
  };

})();
