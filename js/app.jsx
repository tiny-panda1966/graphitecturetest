
function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setLoggedIn(true);
    // Notification: user logged in (admin only)
    if (DB.isLive()) {
      DB.addNotification({
        recipientEmail: "tiny.panda@tiny-panda.com", type: "user_login",
        message: (user.name || user.email) + " logged in",
        read: false, timestamp: new Date()
      }).catch(function() {});
    }
  };
  const handleLogout = () => {
    if (DB.isLive()) {
      DB.addNotification({
        recipientEmail: "tiny.panda@tiny-panda.com", type: "user_logout",
        message: (currentUser ? currentUser.name || currentUser.email : "User") + " logged out",
        read: false, timestamp: new Date()
      }).catch(function() {});
    }
    setLoggedIn(false); setCurrentUser(null);
  };

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
  return <MainApp userEmail={currentUser.email} userName={currentUser.name} userRole={currentUser.role} onLogout={handleLogout} />;
}

function MainApp({ userEmail, userName, userRole, onLogout }) {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [page, setPage] = useState("exec");
  const [mounted, setMounted] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chargesData, setChargesData] = useState(null); // Loaded from DB
  const [stockData, setStockData] = useState(null); // Loaded from DB
  const [userPrefs, setUserPrefs] = useState({ favouriteMaterials: [], recentMaterials: [], customerList: [] });
  const [workerCreds, setWorkerCreds] = useState(null);
  useEffect(() => { setMounted(true); }, []);

  // Per-project mutable state — starts empty, populated from DB or demo
  const [projectData, setProjectData] = useState({});
  const [historyData, setHistoryData] = useState({});
  const [projectsMeta, setProjectsMeta] = useState([]);

  // ── Load data on mount ──
  useEffect(() => {
    if (DB.isLive()) {
      // Load from database
      DB.getProjects().then(function(projects) {
        if (!projects || projects.length === 0) {
          setAppLoading(false);
          return;
        }
        var meta = projects.map(function(p) {
          return {
            id: p.projectId,
            info: {
              customer: p.customer, project: p.project, ref: p.ref,
              manager: p.manager, email: p.email,
              dateBooked: toDateInput(p.dateBooked),
              dateRequired: toDateInput(p.dateRequired),
              deliveryDate: toDateInput(p.deliveryDate || p.dateRequired),
              delivery: p.delivery, supplier: p.supplier,
              folderKey: p.folderKey, shareOnSocials: p.shareOnSocials
            }
          };
        });
        setProjectsMeta(meta);

        // Load full data for all projects in parallel
        var loadPromises = meta.map(function(pm) {
          return DB.loadFullProject(pm.id).then(function(full) {
            return { id: pm.id, data: full };
          }).catch(function(err) {
            console.error("Failed to load project:", pm.id, err);
            return { id: pm.id, data: { items: [], timesheet: [], schedule: [], activityLog: [] } };
          });
        });

        Promise.all(loadPromises).then(function(results) {
          var pd = {};
          var hd = {};
          results.forEach(function(r) {
            // Normalize DB items: map itemId → id, taskId → id
            var dbItems = (r.data.items || []).map(function(item) {
              var normalized = Object.assign({}, item, {
                id: item.itemId || item.id,
                deliveryDate: toDateInput(item.deliveryDate),
                duration: item.duration || 1,
                durationUnit: item.durationUnit || "days"
              });
              if (normalized.tasks) {
                normalized.tasks = normalized.tasks.map(function(t) {
                  return Object.assign({}, t, { id: t.taskId || t.id });
                });
              }
              return normalized;
            });
            var dbTimesheet = (r.data.timesheet || []).map(function(t) {
              return Object.assign({}, t);
            });
            pd[r.id] = {
              items: dbItems,
              timesheet: dbTimesheet,
              stages: ["Artwork", "Print", "Laminate", "Cut", "Finish", "QC", "Deliver"],
              schedule: (r.data.schedule || []).map(function(si) {
                return { id: si.itemId || si.id, startDay: si.startDay, span: si.span };
              })
            };
            hd[r.id] = (r.data.activityLog || []).map(function(a) {
              return { type: a.type, detail: a.detail, user: a.user, time: a.time || "", date: a.date || "" };
            });
          });
          setProjectData(pd);
          setHistoryData(hd);
          if (meta.length > 0) setSelectedProjectId(meta[0].id);
          setAppLoading(false);
          // Load notification count, charges, and user prefs
          DB.getUnreadCount(userEmail).then(function(count) { setUnreadCount(count); }).catch(function() {});
          DB.getCharges().then(function(charges) {
            if (charges && charges.length > 0) {
              var grouped = {};
              charges.forEach(function(c) {
                var g = c.group || "OTHER";
                if (!grouped[g]) grouped[g] = [];
                grouped[g].push({ _id: c._id, item: c.item, costpersqm: c.costpersqm || 0, group: g });
              });
              setChargesData(grouped);
            }
          }).catch(function(err) { console.error("Failed to load charges:", err); });
          DB.getUserSettings(userEmail).then(function(settings) {
            if (settings) {
              try {
                var favs = settings.favouriteMaterials ? JSON.parse(settings.favouriteMaterials) : [];
                var recs = settings.recentMaterials ? JSON.parse(settings.recentMaterials) : [];
                var custs = settings.customerList ? JSON.parse(settings.customerList) : [];
                setUserPrefs({ favouriteMaterials: favs, recentMaterials: recs, customerList: custs });
              } catch(e) { /* ignore parse errors */ }
            }
          }).catch(function() {});
          DB.getStockList().then(function(items) {
            if (items) setStockData(items);
          }).catch(function(err) { console.error("Failed to load stock:", err); });
          DB.getWorkerAuth().then(function(res) {
            if (res && res.success) {
              setWorkerCreds({ url: res.url, token: res.token });
              DB.setWorkerCreds({ url: res.url, token: res.token });
            }
          }).catch(function() {});
        });
      }).catch(function(err) {
        console.error("Failed to load app data:", err);
        setAppLoading(false);
      });
    } else {
      // Standalone mode — use demo data
      loadDemoData();
    }
  }, []);

  // ── Realtime sync via Pusher ──
  var _refreshTimer = React.useRef(null);
  var _pendingRefresh = React.useRef(null);

  useEffect(function() {
    if (!DB.isLive()) return;
    DB.setCurrentUser(userEmail);
    DB.connectPusher();

    DB.onRealtimeUpdate(function(payload) {
      console.log("Pusher event received:", payload);
      var pid = payload.projectId;

      // Debounce: wait 2 seconds after last event before refreshing
      _pendingRefresh.current = payload;
      if (_refreshTimer.current) clearTimeout(_refreshTimer.current);
      _refreshTimer.current = setTimeout(function() {
        var p = _pendingRefresh.current;
        if (!p) return;
        _pendingRefresh.current = null;
        console.log("Realtime: refreshing after debounce");
        doRealtimeRefresh(p);
      }, 2000);
    });
  }, []);

  function doRealtimeRefresh(payload) {
    var pid = payload.projectId;

      // Always reload global data (charges, stock — small datasets, fast)
      DB.getCharges().then(function(charges) {
        if (charges && charges.length > 0) {
          var grouped = {};
          charges.forEach(function(c) {
            var g = c.group || "OTHER";
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push({ item: c.item, costpersqm: parseFloat(c.costpersqm) || 0, _id: c._id });
          });
          setChargesData(grouped);
        }
      }).catch(function() {});
      DB.getStockList().then(function(items) {
        if (items) setStockData(items);
      }).catch(function() {});

      // Reload notification count
      DB.getUnreadCount(userEmail).then(function(count) { setUnreadCount(count); }).catch(function() {});

      if (payload.changeType === "projectCreated" || payload.changeType === "projectDeleted") {
        // Reload project list
        DB.getProjects().then(function(projects) {
          if (!projects) return;
          var meta = projects.map(function(p) {
            return {
              id: p.projectId,
              info: {
                customer: p.customer, project: p.project, ref: p.ref,
                manager: p.manager, email: p.email,
                dateBooked: toDateInput(p.dateBooked),
                dateRequired: toDateInput(p.dateRequired),
                deliveryDate: toDateInput(p.deliveryDate || p.dateRequired),
                delivery: p.delivery, supplier: p.supplier,
                folderKey: p.folderKey, shareOnSocials: p.shareOnSocials
              }
            };
          });
          setProjectsMeta(meta);
          if (payload.changeType === "projectDeleted" && pid === selectedProjectId) {
            setSelectedProjectId(null);
            setPage("exec");
          }
        }).catch(function() {});
        return;
      }

      // Reload specific project data (use pid from event, or fall back to currently selected project)
      var refreshPid = pid || selectedProjectId;
      if (!refreshPid) return;

      DB.loadFullProject(refreshPid).then(function(data) {
        if (!data || !data.project) return;
        var dbItems = (data.items || []).map(function(item) {
          var normalized = Object.assign({}, item, {
            id: item.itemId || item.id,
            deliveryDate: toDateInput(item.deliveryDate),
            duration: item.duration || 1,
            durationUnit: item.durationUnit || "days"
          });
          if (normalized.tasks) {
            normalized.tasks = normalized.tasks.map(function(t) {
              return Object.assign({}, t, { id: t.taskId || t.id });
            });
          }
          return normalized;
        });
        var dbTimesheet = (data.timesheet || []).map(function(t) {
          return Object.assign({}, t);
        });

        setProjectData(function(prev) {
          var next = Object.assign({}, prev);
          next[refreshPid] = {
            items: dbItems,
            timesheet: dbTimesheet,
            stages: (prev[pid] && prev[pid].stages) || ["Artwork", "Print", "Laminate", "Cut", "Finish", "QC", "Deliver"],
            schedule: (data.schedule || []).map(function(si) {
              return { id: si.itemId || si.id, startDay: si.startDay, span: si.span };
            })
          };
          return next;
        });
        setHistoryData(function(prev) {
          var next = Object.assign({}, prev);
          next[pid] = (data.activityLog || []).map(function(a) {
            return { type: a.type, detail: a.detail, user: a.user, time: a.time || "", date: a.date || "" };
          });
          return next;
        });
        console.log("Realtime: project " + refreshPid + " refreshed");
      }).catch(function(err) {
        console.error("Realtime refresh failed:", err);
      });
  }

  // ── Notification sound when unread count increases ──
  var prevUnreadRef = React.useRef(unreadCount);
  useEffect(function() {
    if (unreadCount > prevUnreadRef.current) {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.value = 0.15;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch(e) { /* audio not available */ }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  function loadDemoData() {
    var d = {};
    var h = {};
    ALL_PROJECTS.forEach(function(p) {
      d[p.id] = { items: [...p.items], timesheet: [...p.timesheet], stages: [...p.stages], schedule: [] };
      h[p.id] = [];
    });
    setProjectData(d);
    setHistoryData(h);
    setProjectsMeta(ALL_PROJECTS.map(function(p) { return { id: p.id, info: p.info }; }));
    if (ALL_PROJECTS.length > 0) setSelectedProjectId(ALL_PROJECTS[0].id);
    setAppLoading(false);
  }

  const currentProject = projectsMeta.find(p => p.id === selectedProjectId);
  const current = selectedProjectId ? projectData[selectedProjectId] : null;

  const setItems = (fn) => {
    if (!selectedProjectId || !projectData[selectedProjectId]) return;
    setProjectData(prev => ({
      ...prev,
      [selectedProjectId]: {
        ...prev[selectedProjectId],
        items: typeof fn === "function" ? fn(prev[selectedProjectId].items) : fn
      }
    }));
  };
  const setTimesheet = (fn) => {
    if (!selectedProjectId || !projectData[selectedProjectId]) return;
    setProjectData(prev => ({
      ...prev,
      [selectedProjectId]: {
        ...prev[selectedProjectId],
        timesheet: typeof fn === "function" ? fn(prev[selectedProjectId].timesheet) : fn
      }
    }));
  };
  const setStages = (fn) => {
    if (!selectedProjectId || !projectData[selectedProjectId]) return;
    setProjectData(prev => ({
      ...prev,
      [selectedProjectId]: {
        ...prev[selectedProjectId],
        stages: typeof fn === "function" ? fn(prev[selectedProjectId].stages) : fn
      }
    }));
  };

  // ── Material favourites & recents ──
  // Helper to save all user prefs to DB
  var savePrefsToDb = function(prefs) {
    if (DB.isLive()) {
      DB.saveUserSettings(userEmail, {
        favouriteMaterials: JSON.stringify(prefs.favouriteMaterials || []),
        recentMaterials: JSON.stringify(prefs.recentMaterials || []),
        customerList: JSON.stringify(prefs.customerList || [])
      }).catch(function(err) { console.error("Failed to save user prefs:", err); });
    }
  };

  var toggleFavourite = function(itemName) {
    setUserPrefs(function(prev) {
      var favs = prev.favouriteMaterials || [];
      var idx = favs.indexOf(itemName);
      var newFavs = idx >= 0 ? favs.filter(function(f) { return f !== itemName; }) : favs.concat([itemName]);
      var updated = Object.assign({}, prev, { favouriteMaterials: newFavs });
      savePrefsToDb(updated);
      return updated;
    });
  };

  var addToRecent = function(group, itemName) {
    setUserPrefs(function(prev) {
      var recs = (prev.recentMaterials || []).filter(function(r) { return r.item !== itemName; });
      recs.unshift({ item: itemName, group: group });
      if (recs.length > 10) recs = recs.slice(0, 10);
      var updated = Object.assign({}, prev, { recentMaterials: recs });
      savePrefsToDb(updated);
      return updated;
    });
  };

  var addCustomer = function(name) {
    if (!name || !name.trim()) return;
    var trimmed = name.trim();
    setUserPrefs(function(prev) {
      var custs = prev.customerList || [];
      if (custs.indexOf(trimmed) >= 0) return prev; // already exists
      var updated = Object.assign({}, prev, { customerList: custs.concat([trimmed]).sort() });
      savePrefsToDb(updated);
      return updated;
    });
  };

  const addHistory = (entry) => {
    if (!selectedProjectId) return;
    const fullEntry = { ...entry, time: nowStr(), date: todayStr(), user: userName || userEmail };
    setHistoryData(prev => ({
      ...prev,
      [selectedProjectId]: [
        fullEntry,
        ...(prev[selectedProjectId] || [])
      ]
    }));
    // Persist to database
    if (DB.isLive()) {
      DB.addActivityLog({
        projectId: selectedProjectId,
        type: fullEntry.type || "general",
        detail: fullEntry.detail || "",
        user: fullEntry.user,
        timestamp: new Date()
      }).catch(function(err) { console.error("DB: Failed to save activity log", err); });
    }
  };

  const goToProject = (id) => {
    setSelectedProjectId(id);
    setPage("summary");
    // If project data not loaded yet, fetch it
    if (DB.isLive() && !projectData[id]) {
      DB.loadFullProject(id).then(function(full) {
        setProjectData(function(prev) {
          var next = Object.assign({}, prev);
          var dbItems = (full.items || []).map(function(item) {
            var normalized = Object.assign({}, item, {
              id: item.itemId || item.id,
              deliveryDate: toDateInput(item.deliveryDate),
              duration: item.duration || 1,
              durationUnit: item.durationUnit || "days"
            });
            if (normalized.tasks) {
              normalized.tasks = normalized.tasks.map(function(t) {
                return Object.assign({}, t, { id: t.taskId || t.id });
              });
            }
            return normalized;
          });
          next[id] = {
            items: dbItems,
            timesheet: (full.timesheet || []).map(function(t) { return Object.assign({}, t); }),
            stages: ["Artwork", "Print", "Laminate", "Cut", "Finish", "QC", "Deliver"],
            schedule: (full.schedule || []).map(function(si) {
              return { id: si.itemId || si.id, startDay: si.startDay, span: si.span };
            })
          };
          return next;
        });
        setHistoryData(function(prev) {
          var next = Object.assign({}, prev);
          next[id] = (full.activityLog || []).map(function(a) {
            return { type: a.type, detail: a.detail, user: a.user, time: a.time || "", date: a.date || "" };
          });
          return next;
        });
      }).catch(function(err) { console.error("Failed to load project:", id, err); });
    }
  };

  const handleDeleteProject = (projectId) => {
    // Get folder key before removing from state
    var meta = projectsMeta.find(function(p) { return p.id === projectId; });
    var folderKey = meta && meta.info ? meta.info.folderKey : null;

    // Remove from local state immediately
    setProjectsMeta(function(prev) { return prev.filter(function(p) { return p.id !== projectId; }); });
    setProjectData(function(prev) {
      var next = Object.assign({}, prev);
      delete next[projectId];
      return next;
    });
    setHistoryData(function(prev) {
      var next = Object.assign({}, prev);
      delete next[projectId];
      return next;
    });
    // If we were viewing this project, go back to exec
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setPage("exec");
    }
    // Delete from database and R2 storage
    if (DB.isLive()) {
      DB.deleteFullProject(projectId).then(function(result) {
        console.log("Project deleted:", projectId, result);
      }).catch(function(err) { console.error("DB: Failed to delete project", err); });

      // Notification: project deleted
      DB.addNotification({
        scope: "global", projectId: projectId, type: "project_deleted",
        message: "Project deleted: " + (meta && meta.info ? meta.info.project : projectId) + " by " + (userName || userEmail),
        read: false, timestamp: new Date()
      }).catch(function() {});

      // Delete project folder from R2
      if (folderKey) {
        DB.workerRequest("DELETE", "/folder/" + folderKey).then(function(res) {
          console.log("R2 folder deleted:", folderKey, res.ok);
        }).catch(function(err) { console.warn("R2 folder delete failed:", err); });
      }
    }
  };

  const handleCreateProject = ({ info, items }) => {
    const newId = "P" + Date.now().toString(36).toUpperCase();
    const folderKey = makeProjectFolder(info.customer, info.project);

    // Save customer name to user's autocomplete list
    addCustomer(info.customer);

    // Update local state immediately (optimistic)
    setProjectsMeta(prev => [...prev, { id: newId, info: { ...info, folderKey } }]);
    setProjectData(prev => ({
      ...prev,
      [newId]: {
        items: items,
        timesheet: [],
        stages: ["Artwork", "Print", "Laminate", "Cut", "Finish", "QC", "Deliver"],
        schedule: []
      }
    }));
    const logEntry = { type: "project", detail: `Project created: ${info.project}`, time: nowStr(), date: todayStr(), user: userName || userEmail };
    setHistoryData(prev => ({
      ...prev,
      [newId]: [logEntry]
    }));
    setSelectedProjectId(newId);
    setPage("summary");

    // Persist to database (fire-and-forget, non-blocking)
    if (DB.isLive()) {
      // Save project
      DB.createProject({
        projectId: newId,
        customer: info.customer,
        project: info.project,
        ref: info.ref,
        manager: info.manager || "DH",
        email: info.email || "",
        dateBooked: info.dateBooked ? new Date(info.dateBooked) : new Date(),
        dateRequired: info.dateRequired ? new Date(info.dateRequired) : (info.deliveryDate ? new Date(info.deliveryDate) : null),
        deliveryDate: info.deliveryDate ? new Date(info.deliveryDate) : (info.dateRequired ? new Date(info.dateRequired) : null),
        delivery: info.delivery || "TBC",
        supplier: info.supplier || "Graphitecture",
        shareOnSocials: false,
        status: "Active",
        folderKey: folderKey
      }).catch(function(err) { console.error("DB: Failed to save project", err); });

      // Save line items
      var dbItems = items.map(function(item) {
        return {
          projectId: newId,
          itemId: item.id,
          desc: item.desc,
          file: item.file || "TBC",
          status: item.status || "PENDING",
          process: item.process,
          finishing: item.finishing || "TBC",
          notes: item.notes || "",
          qty: item.qty,
          printW: item.printW,
          printH: item.printH,
          finW: item.finW,
          finH: item.finH,
          sqm: item.sqm,
          costSqm: item.costSqm,
          cost: item.cost,
          assignee: item.assignee || "",
          deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
          duration: item.duration || 1,
          durationUnit: item.durationUnit || "days"
        };
      });
      if (dbItems.length > 0) {
        DB.bulkInsertLineItems(dbItems).catch(function(err) { console.error("DB: Failed to save line items", err); });
      }

      // Save tasks
      var dbTasks = [];
      items.forEach(function(item) {
        if (!item.tasks) return;
        item.tasks.forEach(function(task, idx) {
          dbTasks.push({
            projectId: newId,
            itemId: item.id,
            taskId: task.id,
            label: task.label,
            status: task.status || "PENDING",
            assignee: task.assignee || "",
            timeSpent: task.timeSpent || 0,
            materialExpected: task.materialExpected || 0,
            materialUsed: task.materialUsed || 0,
            materialType: task.materialType || "",
            packages: task.packages || 0,
            printer: "",
            sortOrder: idx + 1
          });
        });
      });
      if (dbTasks.length > 0) {
        DB.bulkInsertTasks(dbTasks).catch(function(err) { console.error("DB: Failed to save tasks", err); });
      }

      // Save activity log entry
      DB.addActivityLog({
        projectId: newId,
        type: logEntry.type,
        detail: logEntry.detail,
        user: logEntry.user,
        timestamp: new Date()
      }).catch(function(err) { console.error("DB: Failed to save activity log", err); });

      // Notification: project created
      DB.addNotification({
        scope: "global", projectId: newId, type: "project_created",
        message: "New project created: " + info.project + " (" + info.ref + ") by " + (userName || userEmail),
        read: false, timestamp: new Date()
      }).catch(function() {});
    }

    // Auto-create default folders in R2 storage (ignore errors)
    if (DB.isLive()) {
      DEFAULT_PROJECT_FOLDERS.forEach(function(folderName) {
        DB.workerRequest("POST", "/folder/" + folderKey + "/" + folderName)
          .then(function(res) {
            if (!res.ok && res.status !== 409) console.warn("Folder creation issue:", folderName, res.status);
          }).catch(function(err) { console.warn("Failed to create folder:", folderName, err); });
      });

      // Upload artwork files for line items
      if (workerCreds) {
        items.forEach(function(item) {
          if (!item._artworkFile) return;
          var safeName = item._artworkFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          var safeDesc = (item.desc || "Item-" + item.id).replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 50);
          var subFolderPath = folderKey + "/01-Print Ready Artwork/" + safeDesc;
          // Create subfolder then upload
          DB.workerRequest("POST", "/folder/" + subFolderPath).then(function() {
            var uploadPath = subFolderPath + "/" + safeName;
            return fetch(workerCreds.url + "/upload/" + uploadPath, {
              method: "POST",
              headers: { "Authorization": "Bearer " + workerCreds.token, "Content-Type": item._artworkFile.type || "application/octet-stream" },
              body: item._artworkFile
            });
          }).then(function(res) {
            if (res.ok) {
              // Update the line item's file field in DB
              DB.updateLineItem(newId, item.id, { file: safeName }).catch(function() {});
              // Update local state
              setProjectData(function(prev) {
                if (!prev[newId]) return prev;
                var updated = Object.assign({}, prev[newId]);
                updated.items = updated.items.map(function(i) { return i.id === item.id ? Object.assign({}, i, { file: safeName }) : i; });
                return Object.assign({}, prev, { [newId]: updated });
              });
            }
          }).catch(function(err) { console.warn("Failed to upload artwork for", item.desc, err); });
        });
      }
    }
  };

  // Build live projects array
  const liveProjects = projectsMeta.map(p => ({
    ...p,
    items: projectData[p.id]?.items || [],
    timesheet: projectData[p.id]?.timesheet || []
  }));

  const allPages = [
    { id: "exec", label: "Exec Summary", roles: ["admin", "production", "marketing", "project manager"] },
    { id: "dashboard", label: "Dashboard", roles: ["admin", "production", "marketing", "project manager"] },
    { id: "summary", label: "Project", roles: ["admin", "production", "marketing", "project manager"] },
    { id: "docs", label: "Documents", roles: ["admin", "production", "marketing", "project manager"] },
    { id: "tracker", label: "Tracker", roles: ["admin", "production", "marketing"] },
    { id: "scheduler", label: "Schedule", roles: ["admin", "production", "marketing", "project manager"] },
    { id: "timesheet", label: "Timesheet", roles: ["admin", "production", "marketing"] },
    { id: "costs", label: "Costs", roles: ["admin"] },
    { id: "xero", label: "Xero Export", roles: ["admin"] },
    { id: "history", label: "History", roles: ["admin", "production", "marketing", "project manager"] },
    { id: "crm", label: "CRM", roles: ["admin", "project manager"] },
    { id: "stock", label: "Stock", roles: ["admin"] }
  ];

  var pages = allPages.filter(function(p) {
    if (!userRole) return true;
    return p.roles.indexOf(userRole.toLowerCase()) >= 0;
  });

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [highlightItemDescs, setHighlightItemDescs] = useState([]);
  const [menuModal, setMenuModal] = useState(null); // "profile" | "notifications" | "settings" | null

  const navTo = (id) => { setPage(id); setMobileNavOpen(false); };

  const handleMenuAction = (action) => {
    if (action === "activity") {
      navTo("history");
    } else {
      setMenuModal(action);
    }
  };

  // Build app state for AI context
  const buildAIState = () => {
    const cp = currentProject;
    const cd = current;
    const lp = projectsMeta.map(p => {
      const d = projectData[p.id];
      const st = projStats(d?.items || [], d?.timesheet || []);
      return { id: p.id, name: p.info.project, customer: p.info.customer, ref: p.info.ref, ...st };
    });
    return {
      currentPage: page,
      selectedProject: cp ? { id: cp.id, name: cp.info.project, customer: cp.info.customer, ref: cp.info.ref } : null,
      projects: lp,
      currentItems: cd ? cd.items.map(i => ({ id: i.id, desc: i.desc, status: i.status, assignee: i.assignee, process: i.process, qty: i.qty, sqm: i.sqm, cost: i.cost })) : [],
      currentTimesheet: cd ? cd.timesheet : [],
      portfolioTotal: fmtK(lp.reduce((a, p) => a + p.grandTotal, 0))
    };
  };

  // Handle AI actions
  const handleAIAction = (action) => {
    switch (action.type) {
      case "navigate":
        if (action.filter) {
          // Navigate to tracker with filter — we'll set page and let Tracker pick up
          setPage("tracker");
        } else {
          setPage(action.tab);
        }
        break;

      case "switch_project":
        const pid = action.projectId;
        if (projectData[pid]) {
          setSelectedProjectId(pid);
          setPage("summary");
        }
        break;

      case "update_status":
        if (current) {
          const desc = (action.itemDesc || "").toLowerCase();
          setItems(prev => prev.map(i => {
            if (i.desc.toLowerCase().includes(desc)) {
              addHistory({ type: "status", detail: `${i.desc}: ${i.status} → ${action.newStatus} (via AI)` });
              return { ...i, status: action.newStatus };
            }
            return i;
          }));
        }
        break;

      case "create_project":
        if (action.data) {
          const d = action.data;
          const info = { ...d.info, dateBooked: todayStr(), email: "david@graphitecture.co.uk", supplier: d.info.supplier || "Graphitecture" };
          const items = (d.items || []).map((it, idx) => {
            // Look up cost from charges DB or fallback to MATERIAL_COSTS
            var costSqm = 36; // default
            if (chargesData) {
              for (var gName in chargesData) {
                var match = chargesData[gName].find(function(c) { return c.item === it.process; });
                if (match) { costSqm = match.costpersqm || 0; break; }
              }
            } else {
              const mc = MATERIAL_COSTS.find(m => m.name === it.process) || MATERIAL_COSTS[0];
              costSqm = mc ? mc.cost : 36;
            }
            const sqm = (it.printW * it.printH / 1000000) * (it.qty || 1);
            const item = {
              id: idx + 1, desc: it.desc, file: "TBC", status: "PENDING",
              process: it.process || "", finishing: "TBC", notes: "",
              qty: it.qty || 1, printW: it.printW || 0, printH: it.printH || 0,
              finW: it.printW || 0, finH: it.printH || 0,
              sqm: parseFloat(sqm.toFixed(2)), costSqm: costSqm,
              cost: parseFloat((sqm * costSqm).toFixed(2)),
              assignee: autoAssign(it.process || "")
            };
            item.tasks = generateTasks(item);
            return item;
          });
          handleCreateProject({ info, items });
        }
        break;

      case "add_timesheet":
        if (current) {
          const fnRate = FUNCTIONS.find(f => f.fn === action.fn)?.rate || 25;
          setTimesheet(prev => [...prev, {
            name: action.name, fn: action.fn,
            hours: action.hours, rate: fnRate,
            cost: action.hours * fnRate
          }]);
          addHistory({ type: "timesheet", detail: `Added via AI: ${action.name} – ${action.fn} – ${action.hours}h` });
        }
        break;

      case "highlight":
        if (action.itemDesc) {
          const descs = Array.isArray(action.itemDesc) ? action.itemDesc : [action.itemDesc];
          setTimeout(() => {
            setHighlightItemDescs(prev => [...prev, ...descs.map(d => d.toLowerCase())]);
            setTimeout(() => setHighlightItemDescs([]), 2500);
          }, 300);
        }
        break;
    }
  };

  // ── Loading screen ──
  if (appLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#fafafa" }}>
        <img src={LOGO_URL} alt="Graphitecture" style={{ height: 40, marginBottom: 16, opacity: 0.6 }}
          onError={function(e) { e.target.style.display = "none"; }} />
        <div style={{ fontSize: 12, color: "#999", letterSpacing: "0.05em" }}>Loading projects...</div>
        <div className="shimmer" style={{ width: 200, height: 4, borderRadius: 2, marginTop: 12, background: "#eee" }} />
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease" }}>
      <nav className="nav-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => navTo("exec")}>
          <img src={LOGO_URL} alt="Graphitecture" style={{ height: 28, width: "auto", display: "block" }}
            onError={e => { e.target.style.display = "none"; }} />
          <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>Graphitecture</span>
        </div>
        <button className="hamburger" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
          {mobileNavOpen ? "✕" : "☰"}
        </button>
        <div className="nav-links">
          {pages.map(p => <button key={p.id} style={s.navLink(page === p.id)} onClick={() => navTo(p.id)}>{p.label}</button>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className={`ai-nav-btn ${aiPanelOpen ? "active" : ""}`} onClick={() => setAiPanelOpen(!aiPanelOpen)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 0110 10 10 10 0 01-10 10A10 10 0 012 12 10 10 0 0112 2z"/>
              <path d="M8 12h.01M12 12h.01M16 12h.01"/>
            </svg>
            AI
          </button>
          <div style={{ position: "relative", cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center" }}
            onClick={() => handleMenuAction("notifications")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={unreadCount > 0 ? "#fff" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <div style={{ position: "absolute", top: 2, right: 4, minWidth: 16, height: 16, borderRadius: "50%", background: "#c00", color: "#fff", fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                {unreadCount}
              </div>
            )}
          </div>
          <UserMenu userEmail={userEmail} userName={userName} userRole={userRole} onLogout={onLogout}
            projectRef={currentProject && page !== "exec" ? currentProject.info.ref + " · " + currentProject.info.customer : null}
            onMenuAction={handleMenuAction} unreadCount={0} />
        </div>
      </nav>

      {/* Mobile nav overlay */}
      <div className={`mobile-nav ${mobileNavOpen ? "open" : ""}`}>
        {pages.map(p => (
          <button key={p.id} style={s.navLink(page === p.id)} onClick={() => navTo(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="app-content">
        {page === "exec" && <ProjectsList projects={liveProjects} onSelect={goToProject} activeProjectId={selectedProjectId} onCreateNew={() => setShowCreateWizard(true)} onDeleteProject={handleDeleteProject} highlightItemDescs={highlightItemDescs} />}
        {page === "dashboard" && <Dashboard allProjects={projectsMeta} projectData={projectData} onSelectProject={(id) => { setSelectedProjectId(id); setPage("tracker"); }} />}
        {page === "scheduler" && <Scheduler allProjects={liveProjects} projectData={projectData} onSelectProject={(id) => { setSelectedProjectId(id); setPage("tracker"); }} onScheduleChange={function(pid, itemIdOrSchedule, dataOrItems) {
            console.log("onScheduleChange ENTERED:", typeof pid, pid, typeof itemIdOrSchedule, itemIdOrSchedule, typeof dataOrItems, dataOrItems);
            // Handle drag-and-drop date change: (pid, itemId, { startDate, deliveryDate })
            if ((typeof itemIdOrSchedule === "string" || typeof itemIdOrSchedule === "number") && dataOrItems && dataOrItems.deliveryDate) {
              var itemId = itemIdOrSchedule;
              var newDelivery = dataOrItems.deliveryDate;
              console.log("Schedule update: pid=" + pid + " itemId=" + itemId + " newDelivery=" + newDelivery);
              setProjectData(function(prev) {
                var next = Object.assign({}, prev);
                var updated = Object.assign({}, next[pid]);
                var found = false;
                updated.items = (updated.items || []).map(function(i) {
                  if (i.id === itemId) { found = true; return Object.assign({}, i, { deliveryDate: newDelivery }); }
                  return i;
                });
                console.log("Item found by id:", found, "items count:", (updated.items || []).length);
                if (!found) {
                  // Try _id field
                  updated.items = (updated.items || []).map(function(i) {
                    if (i._id === itemId) { found = true; return Object.assign({}, i, { deliveryDate: newDelivery }); }
                    return i;
                  });
                  console.log("Item found by _id:", found);
                }
                next[pid] = updated;
                return next;
              });
              if (DB.isLive()) {
                DB.updateLineItem(pid, itemId, { deliveryDate: newDelivery }).catch(function(err) { console.error("DB: Failed to update delivery date", err); });
              }
              addHistory({ type: "schedule", detail: "Rescheduled item via drag" });
              return;
            }
            // Handle legacy format: (pid, newSchedule, updatedItems)
            setProjectData(function(prev) {
              var next = Object.assign({}, prev);
              var updated = Object.assign({}, next[pid]);
              if (itemIdOrSchedule && Array.isArray(itemIdOrSchedule)) updated.schedule = itemIdOrSchedule;
              if (dataOrItems && Array.isArray(dataOrItems)) updated.items = dataOrItems;
              next[pid] = updated;
              return next;
            });
          }} />}

        {current && <>
          {page === "summary" && <ProjectSummary items={current.items} setItems={setItems} info={currentProject.info} timesheet={current.timesheet} addHistory={addHistory} highlightItemDescs={highlightItemDescs} projectId={selectedProjectId} />}
          {page === "docs" && <Documents projectId={currentProject.info.folderKey || selectedProjectId} projectName={currentProject.info.project} />}
          {page === "tracker" && <Tracker items={current.items} setItems={setItems} addHistory={addHistory} highlightItemDescs={highlightItemDescs} projectId={selectedProjectId} allProjects={liveProjects} onSelectProject={(id) => { setSelectedProjectId(id); }} currentProject={currentProject} chargesData={chargesData} userPrefs={userPrefs} onToggleFavourite={toggleFavourite} onAddToRecent={addToRecent} stockData={stockData} workerCreds={workerCreds} timesheet={current.timesheet} setTimesheet={setTimesheet} userName={userName} userEmail={userEmail} />}
          {page === "timesheet" && <TimesheetView timesheet={current.timesheet} setTimesheet={setTimesheet} addHistory={addHistory} projectId={selectedProjectId} items={current.items} />}
          {page === "costs" && <CostsView chargesData={chargesData} onChargesUpdated={function() {
            DB.getCharges().then(function(charges) {
              if (charges && charges.length > 0) {
                var grouped = {};
                charges.forEach(function(c) {
                  var g = c.group || "OTHER";
                  if (!grouped[g]) grouped[g] = [];
                  grouped[g].push({ _id: c._id, item: c.item, costpersqm: c.costpersqm || 0, group: g });
                });
                setChargesData(grouped);
              }
            }).catch(function() {});
          }} />}
          {page === "xero" && <XeroExport items={current.items} timesheet={current.timesheet} info={currentProject.info} projectId={selectedProjectId} userEmail={userEmail} />}
          {page === "history" && <HistoryView history={historyData[selectedProjectId] || []} />}
        </>}
        {page === "crm" && <CRMView allProjects={liveProjects} activeCustomer={currentProject ? currentProject.info.customer : null} />}
        {page === "stock" && <StockView stockData={stockData} onStockUpdated={function() {
          DB.getStockList().then(function(items) { if (items) setStockData(items); }).catch(function() {});
        }} />}
        {!current && page !== "exec" && page !== "dashboard" && page !== "scheduler" && page !== "crm" && page !== "stock" && (
          <div className="page-container">
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.15 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No project selected</div>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Select a project from the Exec Summary or create a new one to get started.</div>
              <button style={s.btn()} onClick={function() { setPage("exec"); }}>Go to Exec Summary</button>
            </div>
          </div>
        )}
      </div>

      <footer className="app-footer">
        <span>Created by Tiny Panda Graphic Artists Ltd.</span>
        <span>Graphitecture · AI-Powered Production Management</span>
      </footer>

      {showCreateWizard && <CreateProjectWizard onClose={() => setShowCreateWizard(false)} onCreate={handleCreateProject} chargesData={chargesData} userPrefs={userPrefs} onToggleFavourite={toggleFavourite} onAddToRecent={addToRecent} />}

      {menuModal === "profile" && <ProfileModal userEmail={userEmail} userName={userName} userRole={userRole} onClose={() => setMenuModal(null)} />}
      {menuModal === "notifications" && <NotificationsModal userEmail={userEmail} onClose={() => {
        setMenuModal(null);
        if (DB.isLive()) { DB.getUnreadCount(userEmail).then(function(c) { setUnreadCount(c); }).catch(function() {}); }
      }} />}
      {menuModal === "settings" && <SettingsModal onClose={() => setMenuModal(null)} userEmail={userEmail} />}
      {menuModal === "members" && userRole === "admin" && <MembersModal onClose={() => setMenuModal(null)} userEmail={userEmail} />}
      {menuModal === "members" && userRole === "admin" && <MembersModal onClose={() => setMenuModal(null)} userRole={userRole} />}

      <AIPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        appState={buildAIState()}
        onAction={handleAIAction}
      />
    </div>
  );
}

// ── Mount ──
ReactDOM.render(<App />, document.getElementById("root"));
