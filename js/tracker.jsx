// ═══════════════════════════════════════════════════════════════
// PRODUCTION TRACKER — Task-Level Workflow
// ═══════════════════════════════════════════════════════════════

function Tracker({ items, setItems, addHistory, highlightItemDescs, projectId, allProjects, onSelectProject, currentProject, chargesData, userPrefs, onToggleFavourite, onAddToRecent, stockData, workerCreds }) {

  var [expandedItems, setExpandedItems] = useState({});
  var [statusModal, setStatusModal] = useState(null);
  var [packingModal, setPackingModal] = useState(null);
  var [addLineOpen, setAddLineOpen] = useState(false);
  var [bulkOpen, setBulkOpen] = useState(false);
  var [bulkTemplate, setBulkTemplate] = useState(null);
  var [editLineItem, setEditLineItem] = useState(null); // item being edited
  var [editLineForm, setEditLineForm] = useState({});
  var [modalMaterials, setModalMaterials] = useState([]); // multi-material for step completion
  var fileChangeRef = useRef(null);
  var [fileChangeItemId, setFileChangeItemId] = useState(null);
  var [preflightItem, setPreflightItem] = useState(null);
  var [renamingFileItemId, setRenamingFileItemId] = useState(null);
  var [renameFileValue, setRenameFileValue] = useState("");

  // Build groups list from charges DB or fallback
  var groups = chargesData ? Object.keys(chargesData).sort() : [];
  var defaultGroup = groups.length > 0 ? groups[0] : "";
  var defaultItem = chargesData && defaultGroup && chargesData[defaultGroup] && chargesData[defaultGroup].length > 0 ? chargesData[defaultGroup][0] : null;

  var [newLine, setNewLine] = useState({
    desc: "", processGroup: defaultGroup, process: defaultItem ? defaultItem.item : (MATERIAL_COSTS[0] || {}).name || "",
    costSqm: defaultItem ? defaultItem.costpersqm : (MATERIAL_COSTS[0] || {}).cost || 0,
    qty: 1, printW: 0, printH: 0,
    duration: 1, durationUnit: "days", deliveryDate: "", notes: ""
  });
  var [lineError, setLineError] = useState("");

  var [filter, setFilter] = useState("ALL");
  var [search, setSearch] = useState("");
  var [undoAction, setUndoAction] = useState(null); // { itemId, taskId, prevStatus, prevTime, prevMaterial, prevMaterialType, prevPackages }
  var [undoTimer, setUndoTimer] = useState(null);

  // Status modal form state
  var [modalTime, setModalTime] = useState(0);
  var [modalMaterial, setModalMaterial] = useState(0);
  var [modalMaterialType, setModalMaterialType] = useState("");
  var [modalPackages, setModalPackages] = useState(1);

  var isHighlighted = function(desc) {
    if (!highlightItemDescs || !highlightItemDescs.length) return false;
    return highlightItemDescs.some(function(d) { return desc.toLowerCase().includes(d); });
  };

  // Filter items
  var filtered = items.filter(function(i) {
    if (filter !== "ALL" && calcItemStatus(i.tasks) !== filter) return false;
    if (search && i.desc.toLowerCase().indexOf(search.toLowerCase()) === -1) return false;
    return true;
  });

  var toggleExpand = function(itemId) {
    setExpandedItems(function(prev) {
      var next = Object.assign({}, prev);
      if (next[itemId]) { delete next[itemId]; } else { next[itemId] = true; }
      return next;
    });
  };

  // Open status change modal
  var beginStatusChange = function(itemId, taskId, newStatus) {
    var item = items.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var task = item.tasks.find(function(t) { return t.id === taskId; });
    if (!task) return;

    // Calculate default material from item dimensions (mm → m²)
    var calcMaterial = task.materialUsed > 0 ? task.materialUsed : parseFloat((((item.printW || 0) * (item.printH || 0) / 1000000) * (item.qty || 1)).toFixed(2)) || 0;

    // Packing step gets its own modal
    if (taskId === "packing" && newStatus === TASK_STATUS.COMPLETE) {
      setModalPackages(Math.max(1, item.qty));
      setModalTime(0);
      setModalMaterial(0);
      setModalMaterialType(task.materialType || item.process || "");
      setPackingModal({ itemId: itemId, taskId: taskId });
      return;
    }

    // Pre-populate with existing data if re-editing
    var isReEdit = task.status === TASK_STATUS.COMPLETE;
    setModalTime(isReEdit ? (task.timeSpent || 0) : 0);
    setModalMaterial(0);
    setModalMaterialType(task.materialType || item.process || "");
    // Initialize multi-materials from existing data or empty
    var existingMats = task.materialsUsed ? (typeof task.materialsUsed === "string" ? JSON.parse(task.materialsUsed) : task.materialsUsed) : [];
    setModalMaterials(Array.isArray(existingMats) && existingMats.length > 0 ? existingMats : []);
    setStatusModal({ itemId: itemId, taskId: taskId, newStatus: newStatus });
  };

  // Confirm status change from modal
  var confirmStatusChange = function() {
    var info = statusModal;
    if (!info) return;
    // Capture undo state before changing
    var item = items.find(function(i) { return i.id === info.itemId; });
    var task = item && item.tasks.find(function(t) { return t.id === info.taskId; });
    if (item && task) {
      if (undoTimer) clearTimeout(undoTimer);
      setUndoAction({
        itemId: info.itemId, taskId: info.taskId,
        prevStatus: task.status, prevTime: task.timeSpent || 0,
        prevMaterial: task.materialUsed || 0, prevMaterialType: task.materialType || "",
        prevPackages: task.packages || 0, label: item.desc + " → " + task.label
      });
      var timer = setTimeout(function() { setUndoAction(null); }, 8000);
      setUndoTimer(timer);
    }

    // Calculate total material from multi-material entries
    var totalMaterialUsed = modalMaterials.reduce(function(a, m) { return a + (m.qty || 0); }, 0);
    var totalMaterialCost = modalMaterials.reduce(function(a, m) { return a + ((m.qty || 0) * (m.sqMtrPrice || 0)); }, 0);
    var materialsJson = modalMaterials.length > 0 ? JSON.stringify(modalMaterials) : "";

    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== info.itemId) return item;
        var newTasks = item.tasks.map(function(t) {
          if (t.id !== info.taskId) return t;
          return Object.assign({}, t, {
            status: info.newStatus,
            timeSpent: modalTime,
            materialUsed: totalMaterialUsed,
            materialType: modalMaterialType,
            materialsUsed: materialsJson,
            materialCost: totalMaterialCost
          });
        });
        return Object.assign({}, item, { tasks: newTasks, status: calcItemStatus(newTasks) });
      });
    });

    addHistory({
      type: "task",
      detail: item.desc + " → " + (task ? task.label : info.taskId) + ": " + info.newStatus + " (" + modalTime + " min" + (totalMaterialUsed > 0 ? ", " + totalMaterialUsed.toFixed(2) + " m²" : "") + (modalMaterials.length > 0 ? ", " + modalMaterials.length + " materials" : "") + ")"
    });
    setStatusModal(null);

    // Persist to DB
    if (DB.isLive()) {
      DB.updateTask(projectId, info.itemId, info.taskId, {
        status: info.newStatus,
        timeSpent: modalTime,
        materialUsed: totalMaterialUsed,
        materialType: modalMaterialType,
        materialsUsed: materialsJson,
        materialCost: totalMaterialCost
      }).catch(function(err) { console.error("DB: Failed to update task", err); });
      var updatedTasks = item.tasks.map(function(t) {
        return t.id === info.taskId ? Object.assign({}, t, { status: info.newStatus }) : t;
      });
      DB.updateLineItem(projectId, info.itemId, {
        status: calcItemStatus(updatedTasks)
      }).catch(function(err) { console.error("DB: Failed to update line item status", err); });

      DB.publishChange(projectId, "stepCompleted");
    }
  };

  // Confirm packing modal
  var confirmPacking = function() {
    var info = packingModal;
    if (!info) return;
    // Capture undo state
    var item = items.find(function(i) { return i.id === info.itemId; });
    var task = item && item.tasks.find(function(t) { return t.id === info.taskId; });
    if (item && task) {
      if (undoTimer) clearTimeout(undoTimer);
      setUndoAction({
        itemId: info.itemId, taskId: info.taskId,
        prevStatus: task.status, prevTime: task.timeSpent || 0,
        prevMaterial: task.materialUsed || 0, prevMaterialType: task.materialType || "",
        prevPackages: task.packages || 0, label: item.desc + " → " + task.label
      });
      var timer = setTimeout(function() { setUndoAction(null); }, 8000);
      setUndoTimer(timer);
    }
    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== info.itemId) return item;
        var newTasks = item.tasks.map(function(t) {
          if (t.id !== info.taskId) return t;
          return Object.assign({}, t, {
            status: TASK_STATUS.COMPLETE,
            timeSpent: modalTime,
            materialUsed: modalMaterial,
            materialType: modalMaterialType,
            packages: modalPackages
          });
        });
        return Object.assign({}, item, { tasks: newTasks, status: calcItemStatus(newTasks) });
      });
    });

    var item = items.find(function(i) { return i.id === info.itemId; });
    addHistory({
      type: "task",
      detail: item.desc + " → Packing: COMPLETE (" + modalPackages + " packages, " + modalTime + " min)"
    });
    setPackingModal(null);

    // Persist to DB
    if (DB.isLive()) {
      DB.updateTask(projectId, info.itemId, info.taskId, {
        status: TASK_STATUS.COMPLETE,
        timeSpent: modalTime,
        materialUsed: modalMaterial,
        materialType: modalMaterialType,
        packages: modalPackages
      }).catch(function(err) { console.error("DB: Failed to update packing task", err); });
      var updatedTasks = item.tasks.map(function(t) {
        return t.id === info.taskId ? Object.assign({}, t, { status: TASK_STATUS.COMPLETE }) : t;
      });
      DB.updateLineItem(projectId, info.itemId, {
        status: calcItemStatus(updatedTasks)
      }).catch(function(err) { console.error("DB: Failed to update line item status", err); });
    }
  };

  // ── Undo last status change ──
  var performUndo = function() {
    if (!undoAction) return;
    var ua = undoAction;

    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== ua.itemId) return item;
        var newTasks = item.tasks.map(function(t) {
          if (t.id !== ua.taskId) return t;
          return Object.assign({}, t, {
            status: ua.prevStatus,
            timeSpent: ua.prevTime,
            materialUsed: ua.prevMaterial,
            materialType: ua.prevMaterialType,
            packages: ua.prevPackages
          });
        });
        return Object.assign({}, item, { tasks: newTasks, status: calcItemStatus(newTasks) });
      });
    });

    // Persist undo to DB
    if (DB.isLive()) {
      DB.updateTask(projectId, ua.itemId, ua.taskId, {
        status: ua.prevStatus,
        timeSpent: ua.prevTime,
        materialUsed: ua.prevMaterial,
        materialType: ua.prevMaterialType,
        packages: ua.prevPackages
      }).catch(function(err) { console.error("DB: Failed to undo task", err); });
      var item = items.find(function(i) { return i.id === ua.itemId; });
      if (item) {
        var revertedTasks = item.tasks.map(function(t) {
          return t.id === ua.taskId ? Object.assign({}, t, { status: ua.prevStatus }) : t;
        });
        DB.updateLineItem(projectId, ua.itemId, { status: calcItemStatus(revertedTasks) })
          .catch(function(err) { console.error("DB: Failed to undo line item status", err); });
      }
    }

    addHistory({ type: "task", detail: "Undo: " + ua.label });
    if (undoTimer) clearTimeout(undoTimer);
    setUndoAction(null);
    setUndoTimer(null);
  };

  // Change task assignee
  var changeTaskAssignee = function(itemId, taskId, newAssignee) {
    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== itemId) return item;
        var newTasks = item.tasks.map(function(t) {
          if (t.id !== taskId) return t;
          return Object.assign({}, t, { assignee: newAssignee });
        });
        return Object.assign({}, item, { tasks: newTasks });
      });
    });
    // Persist to DB
    if (DB.isLive()) {
      DB.updateTask(projectId, itemId, taskId, { assignee: newAssignee })
        .catch(function(err) { console.error("DB: Failed to update task assignee", err); });
    }
  };

  // Toggle task skip/unskip
  var toggleTaskSkip = function(itemId, taskId) {
    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== itemId) return item;
        var newTasks = item.tasks.map(function(t) {
          if (t.id !== taskId) return t;
          var newStatus = t.status === TASK_STATUS.SKIPPED ? TASK_STATUS.PENDING : TASK_STATUS.SKIPPED;
          return Object.assign({}, t, { status: newStatus });
        });
        return Object.assign({}, item, { tasks: newTasks, status: calcItemStatus(newTasks) });
      });
    });
    // Find current status to determine new status
    var item = items.find(function(i) { return i.id === itemId; });
    var task = item && item.tasks.find(function(t) { return t.id === taskId; });
    var newStatus = task && task.status === TASK_STATUS.SKIPPED ? TASK_STATUS.PENDING : TASK_STATUS.SKIPPED;
    if (DB.isLive()) {
      DB.updateTask(projectId, itemId, taskId, { status: newStatus })
        .catch(function(err) { console.error("DB: Failed to toggle task skip", err); });
      var updatedTasks = item.tasks.map(function(t) {
        return t.id === taskId ? Object.assign({}, t, { status: newStatus }) : t;
      });
      DB.updateLineItem(projectId, itemId, { status: calcItemStatus(updatedTasks) })
        .catch(function(err) { console.error("DB: Failed to update line item status", err); });
    }
    addHistory({ type: "task", detail: item.desc + " → " + (task ? task.label : taskId) + ": " + (newStatus === TASK_STATUS.SKIPPED ? "Skipped" : "Restored") });
  };

  // Assign printer to print task
  var assignPrinter = function(itemId, taskId, printer) {
    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== itemId) return item;
        var newTasks = item.tasks.map(function(t) {
          if (t.id !== taskId) return t;
          return Object.assign({}, t, { printer: printer });
        });
        return Object.assign({}, item, { tasks: newTasks });
      });
    });
    if (DB.isLive()) {
      DB.updateTask(projectId, itemId, taskId, { printer: printer })
        .catch(function(err) { console.error("DB: Failed to assign printer", err); });
    }
  };

  // Notes modal state
  var [notesModal, setNotesModal] = useState(null); // { itemId, notes }
  var [notesText, setNotesText] = useState("");

  var openNotesModal = function(itemId) {
    var item = items.find(function(i) { return i.id === itemId; });
    setNotesText(item && item.notes ? item.notes : "");
    setNotesModal({ itemId: itemId });
  };

  var saveNotes = function() {
    if (!notesModal) return;
    var itemId = notesModal.itemId;
    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== itemId) return item;
        return Object.assign({}, item, { notes: notesText });
      });
    });
    if (DB.isLive()) {
      DB.updateLineItem(projectId, itemId, { notes: notesText })
        .catch(function(err) { console.error("DB: Failed to save notes", err); });
    }
    setNotesModal(null);
  };

  // ── Task Editor Modal ──
  var [taskEditorModal, setTaskEditorModal] = useState(null); // { itemId }
  var [editTasks, setEditTasks] = useState([]);
  var [dragTaskIdx, setDragTaskIdx] = useState(null);

  var openTaskEditor = function(itemId) {
    var item = items.find(function(i) { return i.id === itemId; });
    if (!item || !item.tasks) return;
    setEditTasks(item.tasks.map(function(t, idx) {
      return {
        id: t.id, label: t.label, assignee: t.assignee || "", status: t.status || TASK_STATUS.PENDING,
        sortOrder: idx + 1, printer: t.printer || "", timeSpent: t.timeSpent || 0,
        materialUsed: t.materialUsed || 0, materialType: t.materialType || "", packages: t.packages || 0,
        estimatedDuration: t.estimatedDuration || 0, estimatedUnit: t.estimatedUnit || "minutes"
      };
    }));
    setTaskEditorModal({ itemId: itemId });
  };

  var addEditTask = function() {
    var newId = "custom_" + Date.now();
    setEditTasks(function(prev) {
      return prev.concat([{
        id: newId, label: "New Step", assignee: STAFF[0].name, status: TASK_STATUS.PENDING,
        sortOrder: prev.length + 1, printer: "", timeSpent: 0, materialUsed: 0, materialType: "", packages: 0,
        estimatedDuration: 0, estimatedUnit: "minutes"
      }]);
    });
  };

  var removeEditTask = function(idx) {
    setEditTasks(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); });
  };

  var updateEditTask = function(idx, field, value) {
    setEditTasks(function(prev) {
      return prev.map(function(t, i) {
        if (i !== idx) return t;
        return Object.assign({}, t, { [field]: value });
      });
    });
  };

  var moveEditTask = function(fromIdx, toIdx) {
    if (toIdx < 0 || toIdx >= editTasks.length) return;
    setEditTasks(function(prev) {
      var arr = prev.slice();
      var moved = arr.splice(fromIdx, 1)[0];
      arr.splice(toIdx, 0, moved);
      return arr.map(function(t, i) { return Object.assign({}, t, { sortOrder: i + 1 }); });
    });
  };

  var handleTaskDragStart = function(idx, e) {
    setDragTaskIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  var handleTaskDragOver = function(idx, e) {
    e.preventDefault();
    if (dragTaskIdx !== null && dragTaskIdx !== idx) {
      moveEditTask(dragTaskIdx, idx);
      setDragTaskIdx(idx);
    }
  };

  var handleTaskDragEnd = function() { setDragTaskIdx(null); };

  var saveTaskEditor = function() {
    if (!taskEditorModal) return;
    var itemId = taskEditorModal.itemId;
    var newTasks = editTasks.map(function(t, idx) {
      return Object.assign({}, t, { sortOrder: idx + 1 });
    });

    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id !== itemId) return item;
        return Object.assign({}, item, { tasks: newTasks, status: calcItemStatus(newTasks) });
      });
    });

    // Persist to DB — delete old tasks, insert new ones
    if (DB.isLive()) {
      DB.deleteTasksForItem(projectId, itemId).then(function() {
        var dbTasks = newTasks.map(function(t, idx) {
          return {
            projectId: projectId, itemId: itemId, taskId: t.id, label: t.label,
            status: t.status, assignee: t.assignee, timeSpent: t.timeSpent || 0,
            materialExpected: 0, materialUsed: t.materialUsed || 0, materialType: t.materialType || "",
            packages: t.packages || 0, printer: t.printer || "", sortOrder: idx + 1,
            estimatedDuration: t.estimatedDuration || 0, estimatedUnit: t.estimatedUnit || "minutes"
          };
        });
        return DB.bulkInsertTasks(dbTasks);
      }).catch(function(err) { console.error("DB: Failed to save task edits", err); });

      DB.updateLineItem(projectId, itemId, { status: calcItemStatus(newTasks) })
        .catch(function(err) { console.error("DB: Failed to update line item status", err); });
    }

    addHistory({ type: "task", detail: "Edited steps for item " + itemId });
    setTaskEditorModal(null);
  };

  // Add new line item
  var addNewLine = function() {
    if (!newLine.desc.trim()) { setLineError("Please enter a description"); return; }
    if (!newLine.printW || !newLine.printH) { setLineError("Please enter width and height"); return; }
    setLineError("");
    var costSqm = newLine.costSqm || 0;
    var sqm = (newLine.printW * newLine.printH / 1000000) * newLine.qty;
    var newItem = {
      id: items.length > 0 ? Math.max.apply(null, items.map(function(i) { return i.id; })) + 1 : 1,
      desc: newLine.desc, file: "TBC", status: "PENDING",
      process: newLine.process, processGroup: newLine.processGroup, finishing: "TBC", notes: newLine.notes || "",
      qty: newLine.qty, printW: newLine.printW, printH: newLine.printH,
      finW: newLine.printW, finH: newLine.printH,
      sqm: parseFloat(sqm.toFixed(2)), costSqm: costSqm,
      cost: parseFloat((sqm * costSqm).toFixed(2)),
      assignee: autoAssign(newLine.process),
      duration: newLine.duration || 1,
      durationUnit: newLine.durationUnit || "days",
      deliveryDate: newLine.deliveryDate || ""
    };
    newItem.tasks = generateTasks(newItem);
    setItems(function(prev) { return prev.concat([newItem]); });
    addHistory({ type: "line", detail: "Added line: " + newLine.desc });
    setNewLine({
      desc: "", processGroup: newLine.processGroup, process: newLine.process,
      costSqm: newLine.costSqm, qty: 1, printW: 0, printH: 0,
      duration: 1, durationUnit: "days", deliveryDate: "", notes: ""
    });
    setAddLineOpen(false);

    // Persist to DB
    if (DB.isLive()) {
      var dbItem = {
        projectId: projectId, itemId: newItem.id, desc: newItem.desc, file: newItem.file,
        status: newItem.status, process: newItem.process, finishing: newItem.finishing, notes: newItem.notes || "",
        qty: newItem.qty, printW: newItem.printW, printH: newItem.printH,
        finW: newItem.finW, finH: newItem.finH, sqm: newItem.sqm,
        costSqm: newItem.costSqm, cost: newItem.cost, assignee: newItem.assignee,
        duration: newItem.duration, durationUnit: newItem.durationUnit,
        deliveryDate: newItem.deliveryDate ? new Date(newItem.deliveryDate) : null
      };
      DB.createLineItem(dbItem).catch(function(err) { console.error("DB: Failed to save line item", err); });
      var dbTasks = newItem.tasks.map(function(task, idx) {
        return {
          projectId: projectId, itemId: newItem.id, taskId: task.id, label: task.label,
          status: task.status || "PENDING", assignee: task.assignee || "",
          timeSpent: 0, materialExpected: 0, materialUsed: 0, materialType: "",
          packages: 0, printer: "", sortOrder: idx + 1
        };
      });
      if (dbTasks.length > 0) {
        DB.bulkInsertTasks(dbTasks).catch(function(err) { console.error("DB: Failed to save tasks", err); });
      }
    }
  };

  // Delete line item
  var [deleteConfirm, setDeleteConfirm] = useState(null); // itemId

  // Duplicate a single line item
  var duplicateLineItem = function(item) {
    var nextId = items.length > 0 ? Math.max.apply(null, items.map(function(i) { return i.id; })) + 1 : 1;
    var copy = Object.assign({}, item, {
      id: nextId,
      desc: item.desc + " (copy)",
      file: "TBC",
      status: "PENDING",
      tasks: generateTasks(item)
    });
    setItems(function(prev) { return prev.concat([copy]); });
    addHistory({ type: "line", detail: "Duplicated: " + item.desc });

    if (DB.isLive()) {
      var dbItem = {
        projectId: projectId, itemId: copy.id, desc: copy.desc, file: copy.file,
        status: copy.status, process: copy.process, processGroup: copy.processGroup,
        finishing: copy.finishing, notes: copy.notes || "",
        qty: copy.qty, printW: copy.printW, printH: copy.printH,
        finW: copy.finW, finH: copy.finH,
        sqm: copy.sqm, costSqm: copy.costSqm, cost: copy.cost,
        assignee: copy.assignee, duration: copy.duration || 1,
        durationUnit: copy.durationUnit || "days", deliveryDate: copy.deliveryDate
      };
      DB.createLineItem(dbItem).then(function() {
        var dbTasks = copy.tasks.map(function(t, ti) {
          return {
            projectId: projectId, itemId: copy.id, taskId: t.id,
            label: t.label, status: t.status, sortOrder: ti,
            assignee: t.assignee, timeSpent: 0, materialUsed: 0
          };
        });
        return DB.bulkInsertTasks(dbTasks);
      }).catch(function(err) { console.error("DB: Failed to duplicate item", err); });
    }
  };

  // File management for line items
  var handleFileChange = function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file || !fileChangeItemId || !workerCreds || !currentProject) return;
    var item = items.find(function(i) { return i.id === fileChangeItemId; });
    if (!item) return;
    var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    var safeDesc = (item.desc || "Item-" + item.id).replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 50);
    var folderKey = currentProject.info.folderKey;
    var subFolderPath = folderKey + "/01-Print Ready Artwork/" + safeDesc;

    // Delete old file from R2 if one exists
    var deleteOldPromise = Promise.resolve();
    if (item.file && item.file !== "TBC") {
      var oldPath = subFolderPath + "/" + item.file;
      deleteOldPromise = DB.workerRequest("DELETE", "/file/" + oldPath).catch(function() {});
    }

    deleteOldPromise.then(function() {
      return DB.workerRequest("POST", "/folder/" + subFolderPath);
    }).then(function() {
      return fetch(workerCreds.url + "/upload/" + subFolderPath + "/" + safeName, {
        method: "POST",
        headers: { "Authorization": "Bearer " + workerCreds.token, "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
    }).then(function(res) {
      if (res.ok) {
        setItems(function(prev) { return prev.map(function(i) { return i.id === fileChangeItemId ? Object.assign({}, i, { file: safeName }) : i; }); });
        addHistory({ type: "line", detail: "Artwork uploaded: " + safeName + " for " + item.desc });
        if (DB.isLive()) DB.updateLineItem(projectId, fileChangeItemId, { file: safeName }).catch(function() {});
      }
    }).catch(function(err) { console.error("Upload failed:", err); });
    setFileChangeItemId(null);
    if (fileChangeRef.current) fileChangeRef.current.value = "";
  };

  var removeFile = function(itemObj) {
    // Delete from R2 storage
    if (DB.isLive() && currentProject && itemObj.file && itemObj.file !== "TBC") {
      var safeDesc = (itemObj.desc || "Item-" + itemObj.id).replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 50);
      var filePath = currentProject.info.folderKey + "/01-Print Ready Artwork/" + safeDesc + "/" + itemObj.file;
      DB.workerRequest("DELETE", "/file/" + filePath).catch(function(err) { console.warn("R2 delete failed:", err); });
    }
    setItems(function(prev) { return prev.map(function(i) { return i.id === itemObj.id ? Object.assign({}, i, { file: "TBC" }) : i; }); });
    addHistory({ type: "line", detail: "Artwork removed from " + itemObj.desc });
    if (DB.isLive()) DB.updateLineItem(projectId, itemObj.id, { file: "TBC" }).catch(function() {});
  };

  var renameFile = function(itemObj, newName) {
    if (!newName || !newName.trim() || !workerCreds || !currentProject) return;
    var oldName = itemObj.file;
    var safeDesc = (itemObj.desc || "Item-" + itemObj.id).replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 50);
    var folderKey = currentProject.info.folderKey;
    var basePath = folderKey + "/01-Print Ready Artwork/" + safeDesc + "/";
    var safeName = newName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");

    DB.workerRequest("PUT", "/rename", { key: basePath + oldName, newKey: basePath + safeName }).then(function(res) {
      if (res.ok) {
        setItems(function(prev) { return prev.map(function(i) { return i.id === itemObj.id ? Object.assign({}, i, { file: safeName }) : i; }); });
        addHistory({ type: "line", detail: "Artwork renamed: " + oldName + " → " + safeName });
        if (DB.isLive()) DB.updateLineItem(projectId, itemObj.id, { file: safeName }).catch(function() {});
      }
    }).catch(function(err) { console.error("Rename failed:", err); });
    setRenamingFileItemId(null);
  };

  // Edit line item
  var openEditLineItem = function(item) {
    setEditLineItem(item);
    setEditLineForm({
      desc: item.desc, qty: item.qty, printW: item.printW, printH: item.printH,
      processGroup: item.processGroup || "", process: item.process, costSqm: item.costSqm || 0,
      deliveryDate: item.deliveryDate || "", duration: item.duration || 1,
      durationUnit: item.durationUnit || "days", notes: item.notes || ""
    });
  };

  var saveEditLineItem = function() {
    if (!editLineItem) return;
    var f = editLineForm;
    var sqm = ((f.printW || 0) * (f.printH || 0) / 1000000) * (f.qty || 1);
    var updated = Object.assign({}, editLineItem, {
      desc: f.desc, qty: f.qty || 1, printW: f.printW || 0, printH: f.printH || 0,
      finW: f.printW || 0, finH: f.printH || 0,
      processGroup: f.processGroup, process: f.process, costSqm: f.costSqm || 0,
      sqm: parseFloat(sqm.toFixed(2)), cost: parseFloat((sqm * (f.costSqm || 0)).toFixed(2)),
      deliveryDate: f.deliveryDate, duration: f.duration || 1,
      durationUnit: f.durationUnit || "days", notes: f.notes || ""
    });
    setItems(function(prev) { return prev.map(function(i) { return i.id === editLineItem.id ? updated : i; }); });
    addHistory({ type: "line", detail: "Edited: " + updated.desc });
    if (DB.isLive()) {
      DB.updateLineItem(projectId, editLineItem.id, {
        desc: updated.desc, qty: updated.qty, printW: updated.printW, printH: updated.printH,
        finW: updated.finW, finH: updated.finH, processGroup: updated.processGroup,
        process: updated.process, costSqm: updated.costSqm, sqm: updated.sqm, cost: updated.cost,
        deliveryDate: updated.deliveryDate, duration: updated.duration,
        durationUnit: updated.durationUnit, notes: updated.notes
      }).catch(function(err) { console.error("DB: Failed to update line item", err); });
    }
    setEditLineItem(null);
  };

  // Bulk create line items
  var handleBulkCreate = function(rows) {
    var nextId = items.length > 0 ? Math.max.apply(null, items.map(function(i) { return i.id; })) + 1 : 1;
    var newItems = rows.map(function(row, idx) {
      var sqm = ((row.printW || 0) * (row.printH || 0) / 1000000) * (row.qty || 1);
      var item = {
        id: nextId + idx, desc: row.desc, file: "TBC", status: "PENDING",
        process: row.process, processGroup: row.processGroup, finishing: "TBC", notes: row.notes || "",
        qty: row.qty || 1, printW: row.printW || 0, printH: row.printH || 0,
        finW: row.printW || 0, finH: row.printH || 0,
        sqm: parseFloat(sqm.toFixed(2)), costSqm: row.costSqm || 0,
        cost: parseFloat((sqm * (row.costSqm || 0)).toFixed(2)),
        assignee: autoAssign(row.process),
        duration: 1, durationUnit: "days",
        deliveryDate: row.deliveryDate || ""
      };
      item.tasks = generateTasks(item);
      return item;
    });
    setItems(function(prev) { return prev.concat(newItems); });
    addHistory({ type: "line", detail: "Bulk added " + newItems.length + " line items" });

    // Persist to DB
    if (DB.isLive()) {
      newItems.forEach(function(newItem) {
        var dbItem = {
          projectId: projectId, itemId: newItem.id, desc: newItem.desc, file: newItem.file,
          status: newItem.status, process: newItem.process, processGroup: newItem.processGroup,
          finishing: newItem.finishing, notes: newItem.notes || "",
          qty: newItem.qty, printW: newItem.printW, printH: newItem.printH,
          finW: newItem.finW, finH: newItem.finH,
          sqm: newItem.sqm, costSqm: newItem.costSqm, cost: newItem.cost,
          assignee: newItem.assignee, duration: newItem.duration || 1,
          durationUnit: newItem.durationUnit || "days", deliveryDate: newItem.deliveryDate
        };
        DB.createLineItem(dbItem).then(function() {
          var dbTasks = newItem.tasks.map(function(t, ti) {
            return {
              projectId: projectId, itemId: newItem.id, taskId: t.id,
              label: t.label, status: t.status, sortOrder: ti,
              assignee: t.assignee, timeSpent: 0, materialUsed: 0
            };
          });
          return DB.bulkInsertTasks(dbTasks);
        }).catch(function(err) { console.error("DB: Failed to save bulk item", err); });
      });
    }
    setBulkOpen(false);
    setBulkTemplate(null);
  };

  var deleteLineItem = function(itemId) {
    var item = items.find(function(i) { return i.id === itemId; });
    if (!item) return;

    setItems(function(prev) { return prev.filter(function(i) { return i.id !== itemId; }); });
    addHistory({ type: "line", detail: "Deleted line: " + item.desc });
    setDeleteConfirm(null);

    // Persist to DB — delete line item and its tasks
    if (DB.isLive()) {
      DB.deleteLineItem(projectId, itemId)
        .catch(function(err) { console.error("DB: Failed to delete line item", err); });
      // Delete associated tasks too
      DB.deleteTasksForItem(projectId, itemId).catch(function() {});
    }
  };

  // Task status badge style
  var taskBadgeStyle = function(status) {
    var colors = {
      "PENDING": { bg: "#f5f5f5", color: "#999" },
      "IN PROGRESS": { bg: "#e8e8e8", color: "#444" },
      "COMPLETE": { bg: "#111", color: "#fff" },
      "SKIPPED": { bg: "#f5f5f5", color: "#ccc" }
    };
    var c = colors[status] || colors.PENDING;
    return {
      display: "inline-block", fontSize: 9, fontWeight: 500,
      padding: "2px 8px", borderRadius: 3, letterSpacing: "0.04em",
      textTransform: "uppercase", background: c.bg, color: c.color,
      cursor: "pointer", border: "none", fontFamily: "inherit",
      transition: "all 0.15s"
    };
  };

  // Task progress for an item (excludes skipped)
  var taskProgress = function(tasks) {
    if (!tasks || tasks.length === 0) return 0;
    var active = tasks.filter(function(t) { return t.status !== TASK_STATUS.SKIPPED; });
    if (active.length === 0) return 100;
    var complete = active.filter(function(t) { return t.status === TASK_STATUS.COMPLETE; }).length;
    return Math.round((complete / active.length) * 100);
  };

  // Get next status for a task
  var nextStatus = function(current) {
    if (current === TASK_STATUS.PENDING) return TASK_STATUS.IN_PROGRESS;
    if (current === TASK_STATUS.IN_PROGRESS) return TASK_STATUS.COMPLETE;
    return null;
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={s.pageTitle}>Production Tracker</h1>
          <p style={s.pageSub}>Task-level tracking with operator time &amp; material capture</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {allProjects && allProjects.length > 1 && (
            <select style={Object.assign({}, s.select, { minWidth: 180, fontSize: 11 })}
              value={projectId}
              onChange={function(e) { if (onSelectProject) onSelectProject(e.target.value); }}>
              {allProjects.map(function(p) {
                return React.createElement("option", { key: p.id, value: p.id }, p.info.project + " — " + p.info.customer);
              })}
            </select>
          )}
          <button style={Object.assign({}, s.btn(), { whiteSpace: "nowrap", padding: "8px 16px" })} onClick={function() { setAddLineOpen(true); }}>+ Add Line</button>
          <button style={Object.assign({}, s.btn("secondary"), { whiteSpace: "nowrap", padding: "8px 16px" })} onClick={function() { setBulkTemplate(null); setBulkOpen(true); }}>Bulk Add</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {["ALL", "FINISHED", "IN PROGRESS", "PENDING"].map(function(f) {
          return (
            <button key={f} onClick={function() { setFilter(f); }}
              style={Object.assign({}, s.btn(filter === f ? "primary" : "secondary"), { fontSize: 11, padding: "5px 14px" })}>
              {f} {f !== "ALL" ? "(" + items.filter(function(i) { return calcItemStatus(i.tasks) === f; }).length + ")" : ""}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", width: 220 }}>
          <input style={s.input} placeholder="Search items..." value={search} onChange={function(e) { setSearch(e.target.value); }} />
        </div>
      </div>

      {/* Add line modal */}
      {addLineOpen && (
        <div className="wizard-overlay" onClick={function() { setAddLineOpen(false); }}>
          <div className="wizard-modal" style={{ width: 600, maxWidth: "95%" }} onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #eee" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Add Line Item</div>
                <div style={{ fontSize: 12, color: "#888" }}>{currentProject ? currentProject.info.project + " — " + currentProject.info.customer : "Current Project"}</div>
              </div>
              <button onClick={function() { setAddLineOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
            </div>
            <div style={{ padding: 24, maxHeight: "60vh", overflowY: "auto" }}>
              <div style={{ background: "#fafafa", borderRadius: 8, padding: 16, border: "1px solid #eee" }}>
                <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Description</div>
                    <input style={s.input} value={newLine.desc} placeholder="e.g. Entrance arch wrap"
                      onChange={function(e) { setLineError(""); setNewLine(Object.assign({}, newLine, { desc: e.target.value })); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Print Material</div>
                    {chargesData ? (
                      <MaterialPicker
                        chargesData={chargesData}
                        selectedGroup={newLine.processGroup}
                        selectedItem={newLine.process}
                        selectedCost={newLine.costSqm}
                        favourites={userPrefs ? userPrefs.favouriteMaterials : []}
                        recents={userPrefs ? userPrefs.recentMaterials : []}
                        onToggleFavourite={onToggleFavourite}
                        onSelect={function(sel) {
                          setNewLine(Object.assign({}, newLine, { processGroup: sel.group, process: sel.item, costSqm: sel.costpersqm }));
                          if (onAddToRecent) onAddToRecent(sel.group, sel.item);
                        }}
                      />
                    ) : (
                      <select style={s.select} value={newLine.process} onChange={function(e) { setNewLine(Object.assign({}, newLine, { process: e.target.value })); }}>
                        {MATERIAL_COSTS.map(function(m) { return React.createElement("option", { key: m.name, value: m.name }, m.name + " (£" + m.cost + "/m²)"); })}
                      </select>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Qty</div>
                    <input style={s.input} type="number" value={newLine.qty} onChange={function(e) { setNewLine(Object.assign({}, newLine, { qty: parseInt(e.target.value) || 1 })); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>W (mm)</div>
                    <input style={s.input} type="number" value={newLine.printW} onChange={function(e) { setNewLine(Object.assign({}, newLine, { printW: parseInt(e.target.value) || 0 })); }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>H (mm)</div>
                    <input style={s.input} type="number" value={newLine.printH} onChange={function(e) { setNewLine(Object.assign({}, newLine, { printH: parseInt(e.target.value) || 0 })); }} />
                  </div>
                </div>
                <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Duration</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={Object.assign({}, s.input, { width: 80 })} type="number" min="1" value={newLine.duration}
                        onChange={function(e) { setNewLine(Object.assign({}, newLine, { duration: parseInt(e.target.value) || 1 })); }} />
                      <select style={Object.assign({}, s.select, { flex: 1 })} value={newLine.durationUnit}
                        onChange={function(e) { setNewLine(Object.assign({}, newLine, { durationUnit: e.target.value })); }}>
                        {[["minutes","Minutes"],["hours","Hours"],["days","Days"],["weeks","Weeks"],["months","Months"]].map(function(u) {
                          return React.createElement("option", { key: u[0], value: u[0] }, u[1]);
                        })}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Delivery Date</div>
                    <input type="date" style={s.input} value={newLine.deliveryDate}
                      onChange={function(e) { setNewLine(Object.assign({}, newLine, { deliveryDate: e.target.value })); }} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Notes</div>
                  <textarea style={Object.assign({}, s.input, { minHeight: 60, resize: "vertical", fontFamily: "inherit", fontSize: 12, lineHeight: 1.4 })}
                    value={newLine.notes || ""}
                    placeholder="Production notes, special requirements, client instructions..."
                    onChange={function(e) { setNewLine(Object.assign({}, newLine, { notes: e.target.value })); }} />
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 8, padding: "8px 12px", background: "#f0f0f0", borderRadius: 4 }}>
                  Steps auto-generated: {(PROCESS_TASK_MAP[newLine.process] || DEFAULT_TASKS).map(function(tid) {
                    var td = PRODUCTION_TASKS.find(function(t) { return t.id === tid; });
                    return td ? td.label : tid;
                  }).join(" → ")}
                </div>
                {lineError && (
                  <div style={{ fontSize: 12, color: "#c00", padding: "8px 12px", background: "#fff5f5", borderRadius: 4, border: "1px solid #fdd", marginTop: 8 }}>
                    {lineError}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 24px", borderTop: "1px solid #eee" }}>
              <button style={s.btn("secondary")} onClick={function() { setAddLineOpen(false); setLineError(""); }}>Cancel</button>
              <button style={s.btn()} onClick={addNewLine}>Add Line Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Line items with expandable tasks */}
      <div style={s.card}>
        <div className="table-wrap">
          <table style={s.table}>
            <thead>
              <tr>
                <th style={Object.assign({}, s.th, { width: 30 })}></th>
                <th style={s.th}>Line Item</th>
                <th style={s.th}>Process</th>
                <th style={Object.assign({}, s.th, { textAlign: "center" })}>Qty</th>
                <th style={s.th}>Size</th>
                <th style={s.th}>Progress</th>
                <th style={Object.assign({}, s.th, { textAlign: "right" })}>Cost</th>
                <th style={Object.assign({}, s.th, { textAlign: "center" })}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(item) {
                var isExp = !!expandedItems[item.id];
                var pct = taskProgress(item.tasks);
                var itemStatus = calcItemStatus(item.tasks);
                var rows = [];

                // Parent row
                rows.push(
                  <tr key={"item-" + item.id} className={isHighlighted(item.desc) ? "ai-highlight-row" : ""}
                    style={{ cursor: "pointer" }}
                    onClick={function() { toggleExpand(item.id); }}
                    onMouseEnter={function(e) { if (!isHighlighted(item.desc)) e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={function(e) { if (!isHighlighted(item.desc)) e.currentTarget.style.background = "transparent"; }}>
                    <td style={s.td}>
                      <span style={{ fontSize: 10, color: "#888", transition: "transform 0.2s", transform: isExp ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                    </td>
                    <td style={Object.assign({}, s.td, { fontWeight: 500 })}>
                      <div>{item.desc}</div>
                      <div style={{ fontSize: 10, color: "#999", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                        {item.tasks ? item.tasks.filter(function(t) { return t.status === TASK_STATUS.COMPLETE; }).length + "/" + item.tasks.filter(function(t) { return t.status !== TASK_STATUS.SKIPPED; }).length + " tasks" : "—"}
                        {item.file && item.file !== "TBC" && (
                          <span style={{ color: "#1565c0" }} title={item.file}>📎 {item.file.length > 20 ? item.file.substring(0, 20) + "..." : item.file}</span>
                        )}
                      </div>
                    </td>
                    <td style={Object.assign({}, s.td, { fontSize: 11 })}>
                      <div>{item.process}</div>
                      <button onClick={function(e) { e.stopPropagation(); openNotesModal(item.id); }}
                        title={item.notes ? "View/edit notes" : "Add notes"}
                        style={{ background: "none", border: item.notes ? "1px solid #ddd" : "1px dashed #ddd", borderRadius: 4, cursor: "pointer", padding: "2px 6px", fontSize: 10, color: item.notes ? "#555" : "#ccc", marginTop: 4, display: "block", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.notes ? item.notes.substring(0, 18) + (item.notes.length > 18 ? "..." : "") : "+ Notes"}
                      </button>
                    </td>
                    <td style={Object.assign({}, s.td, { textAlign: "center" })}>{item.qty}</td>
                    <td style={Object.assign({}, s.td, { fontSize: 10, color: "#888", whiteSpace: "nowrap" })}>
                      {item.printW && item.printH ? item.printW + " × " + item.printH + " mm" : "—"}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={Object.assign({}, s.progressBar, { flex: 1 })}>
                          <div style={s.progressFill(pct)} />
                        </div>
                        <span style={{ fontSize: 10, color: "#888", width: 30, textAlign: "right" }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 })}>{fmt(item.cost)}</td>
                    <td style={Object.assign({}, s.td, { textAlign: "center" })}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <span style={s.badge(itemStatus)}>{itemStatus}</span>
                        <button onClick={function(e) { e.stopPropagation(); setDeleteConfirm(item.id); }}
                          title="Delete line item"
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#ddd", padding: "0 2px", lineHeight: 1 }}
                          onMouseEnter={function(e) { e.target.style.color = "#c00"; }}
                          onMouseLeave={function(e) { e.target.style.color = "#ddd"; }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );

                // Expanded task rows
                if (isExp && item.tasks) {
                  item.tasks.forEach(function(task) {
                    var taskDef = PRODUCTION_TASKS.find(function(t) { return t.id === task.id; });
                    var isSkipped = task.status === TASK_STATUS.SKIPPED;
                    var ns = isSkipped ? null : nextStatus(task.status);

                    // Inline update function
                    var updateField = function(field, value) {
                      setItems(function(prev) {
                        return prev.map(function(it) {
                          if (it.id !== item.id) return it;
                          var newTasks = it.tasks.map(function(t) {
                            if (t.id !== task.id) return t;
                            return Object.assign({}, t, { [field]: value });
                          });
                          return Object.assign({}, it, { tasks: newTasks });
                        });
                      });
                      if (DB.isLive()) {
                        DB.updateTask(projectId, item.id, task.id, { [field]: value })
                          .catch(function(err) { console.error("DB: Failed to update task field", err); });
                      }
                    };

                    rows.push(
                      <tr key={"task-" + item.id + "-" + task.id} style={{ background: "#fafafa", opacity: isSkipped ? 0.5 : 1 }}>
                        <td style={Object.assign({}, s.td, { textAlign: "center", width: 30, verticalAlign: "top", paddingTop: 10 })}>
                          <input type="checkbox" checked={!isSkipped}
                            onChange={function(e) { e.stopPropagation(); toggleTaskSkip(item.id, task.id); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            title={isSkipped ? "Restore this step" : "Skip this step"}
                            style={{ cursor: "pointer", accentColor: "#111" }} />
                        </td>
                        <td style={s.td} colSpan={2}>
                          {/* Step name row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 20, textDecoration: isSkipped ? "line-through" : "none", marginBottom: isSkipped ? 0 : 6 }}>
                            <span style={{ width: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{TASK_ICONS[task.id] || "•"}</span>
                            <span style={{ fontWeight: 500, fontSize: 12 }}>{task.label}</span>
                          </div>
                          {/* Data fields row — always visible */}
                          {!isSkipped && (
                            <div style={{ paddingLeft: 48, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {/* Time — shows actual if set, otherwise estimated from Edit Steps */}
                              {(function() {
                                var hasActual = task.timeSpent > 0;
                                var hasEst = task.estimatedDuration > 0;
                                var bg = hasActual ? "#e8e8e8" : hasEst ? "#e3f2fd" : "#f5f5f5";
                                var color = hasActual ? "#333" : hasEst ? "#1565c0" : "#ccc";
                                var label = hasActual ? "Actual:" : hasEst ? "Est:" : "Time:";
                                var value = hasActual ? task.timeSpent + " min" : hasEst ? task.estimatedDuration + " " + (task.estimatedUnit || "minutes").substring(0, 3) : "—";
                                return (
                                  <div style={{ display: "flex", alignItems: "center", gap: 3, background: bg, borderRadius: 4, padding: "3px 8px" }}>
                                    <span style={{ fontSize: 9, color: hasActual ? "#666" : hasEst ? "#1565c0" : "#999" }}>{label}</span>
                                    <span style={{ fontSize: 10, fontWeight: 500, color: color }}>{value}</span>
                                  </div>
                                );
                              })()}
                              {/* Material used */}
                              <div style={{ display: "flex", alignItems: "center", gap: 2, background: task.materialUsed > 0 ? "#e8e8e8" : "#f5f5f5", borderRadius: 4, padding: "2px 6px" }}>
                                <span style={{ fontSize: 9, color: "#666" }}>Material:</span>
                                <input type="number" min="0" step="0.01"
                                  value={task.materialUsed || ""}
                                  placeholder="—"
                                  onClick={function(e) { e.stopPropagation(); }}
                                  onChange={function(e) { updateField("materialUsed", parseFloat(e.target.value) || 0); }}
                                  style={{ width: 40, border: "none", background: "transparent", fontSize: 10, fontWeight: 500, color: "#333", textAlign: "center", outline: "none" }} />
                                <span style={{ fontSize: 9, color: "#888" }}>m²</span>
                              </div>
                              {/* Packages — packing step only */}
                              {task.id === "packing" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 2, background: task.packages > 0 ? "#e8e8e8" : "#f5f5f5", borderRadius: 4, padding: "2px 6px" }}>
                                  <span style={{ fontSize: 9, color: "#666" }}>Pkg:</span>
                                  <input type="number" min="0"
                                    value={task.packages || ""}
                                    placeholder="—"
                                    onClick={function(e) { e.stopPropagation(); }}
                                    onChange={function(e) { updateField("packages", parseInt(e.target.value) || 0); }}
                                    style={{ width: 30, border: "none", background: "transparent", fontSize: 10, fontWeight: 500, color: "#333", textAlign: "center", outline: "none" }} />
                                </div>
                              )}
                              {/* Printer — print step only */}
                              {task.id === "print" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 2, background: task.printer ? "#e3f2fd" : "#f5f5f5", borderRadius: 4, padding: "2px 4px" }}>
                                  <select value={task.printer || ""}
                                    onClick={function(e) { e.stopPropagation(); }}
                                    onChange={function(e) { assignPrinter(item.id, task.id, e.target.value); }}
                                    style={{ border: "none", background: "transparent", fontSize: 9, color: task.printer ? "#1565c0" : "#999", outline: "none", cursor: "pointer" }}>
                                    <option value="">Printer...</option>
                                    {PRINTERS.map(function(p) { return <option key={p} value={p}>{p}</option>; })}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={Object.assign({}, s.td, { verticalAlign: "top", paddingTop: 8 })}>
                          {!isSkipped && (
                            <select style={Object.assign({}, s.select, { width: "auto", minWidth: 100, padding: "4px 8px", fontSize: 11 })}
                              value={task.assignee}
                              onClick={function(e) { e.stopPropagation(); }}
                              onChange={function(e) { changeTaskAssignee(item.id, task.id, e.target.value); }}>
                              {STAFF.map(function(st) { return <option key={st.name} value={st.name}>{st.name}</option>; })}
                            </select>
                          )}
                        </td>
                        <td style={s.td} colSpan={2}></td>
                        <td style={Object.assign({}, s.td, { textAlign: "center", verticalAlign: "top", paddingTop: 8 })}>
                          {isSkipped ? (
                            <span style={taskBadgeStyle(TASK_STATUS.SKIPPED)}>Skipped</span>
                          ) : ns ? (
                            <button style={taskBadgeStyle(task.status)}
                              onClick={function(e) {
                                e.stopPropagation();
                                beginStatusChange(item.id, task.id, ns);
                              }}>
                              {task.status === TASK_STATUS.PENDING ? "Start" : "Complete"}
                            </button>
                          ) : (
                            <button style={Object.assign({}, taskBadgeStyle(task.status), { cursor: "pointer" })}
                              title="Click to edit time & materials"
                              onClick={function(e) {
                                e.stopPropagation();
                                beginStatusChange(item.id, task.id, TASK_STATUS.COMPLETE);
                              }}>✓ Done</button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                  // Edit steps button row
                  rows.push(
                    <tr key={"edit-" + item.id} style={{ background: "#fafafa" }}>
                      <td style={s.td} colSpan={8}>
                        <div style={{ paddingLeft: 48, paddingTop: 4, paddingBottom: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={function(e) { e.stopPropagation(); openEditLineItem(item); }}
                            style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: "#1565c0" }}>
                            Edit Item
                          </button>
                          <button onClick={function(e) { e.stopPropagation(); openTaskEditor(item.id); }}
                            style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: "#888" }}>
                            Edit Steps
                          </button>
                          <button onClick={function(e) { e.stopPropagation(); setFileChangeItemId(item.id); fileChangeRef.current && fileChangeRef.current.click(); }}
                            style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: item.file && item.file !== "TBC" ? "#555" : "#1565c0" }}>
                            {item.file && item.file !== "TBC" ? "Change File" : "Upload Artwork"}
                          </button>
                          {item.file && item.file !== "TBC" && (
                            <button onClick={function(e) { e.stopPropagation(); setRenamingFileItemId(item.id); setRenameFileValue(item.file); }}
                              style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: "#555" }}>
                              Rename File
                            </button>
                          )}
                          {item.file && item.file !== "TBC" && (
                            <button onClick={function(e) { e.stopPropagation(); setPreflightItem(item); }}
                              style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: "#f59e0b" }}>
                              Preflight
                            </button>
                          )}
                          {item.file && item.file !== "TBC" && (
                            <button onClick={function(e) { e.stopPropagation(); removeFile(item); }}
                              style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: "#c00" }}>
                              Remove File
                            </button>
                          )}
                          <button onClick={function(e) { e.stopPropagation(); duplicateLineItem(item); }}
                            style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: "#555" }}>
                            Duplicate
                          </button>
                          <button onClick={function(e) { e.stopPropagation(); setBulkTemplate(item); setBulkOpen(true); }}
                            style={{ background: "none", border: "1px dashed #ccc", borderRadius: 4, cursor: "pointer", padding: "4px 12px", fontSize: 10, color: "#1565c0" }}>
                            Clone
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #111" }}>
                <td style={s.td}></td>
                <td style={Object.assign({}, s.td, { fontWeight: 500 })}>TOTALS ({filtered.length} items)</td>
                <td style={s.td}></td>
                <td style={Object.assign({}, s.td, { fontWeight: 500, textAlign: "center" })}>{filtered.reduce(function(a, i) { return a + i.qty; }, 0)}</td>
                <td style={s.td}></td>
                <td style={s.td}></td>
                <td style={Object.assign({}, s.td, { textAlign: "right", fontWeight: 500 })}>{fmt(filtered.reduce(function(a, i) { return a + i.cost; }, 0))}</td>
                <td style={s.td}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Status change modal — time & material capture */}
      {statusModal && (function() {
        var item = items.find(function(i) { return i.id === statusModal.itemId; });
        var task = item && item.tasks.find(function(t) { return t.id === statusModal.taskId; });
        if (!item || !task) return null;
        var taskDef = PRODUCTION_TASKS.find(function(t) { return t.id === task.id; });

        // Build stock groups for picker
        var stockGroups = {};
        if (stockData) {
          stockData.forEach(function(si) {
            var g = si.group || "Other";
            if (!stockGroups[g]) stockGroups[g] = {};
            var sg = si.subGroup || "Other";
            if (!stockGroups[g][sg]) stockGroups[g][sg] = [];
            stockGroups[g][sg].push(si);
          });
        }

        var addMaterialRow = function() {
          setModalMaterials(function(prev) { return prev.concat([{ stockItemId: "", materialCode: "", material: "", group: "", subGroup: "", qty: 0, sqMtrPrice: 0 }]); });
        };
        var updateMaterialRow = function(idx, field, value) {
          setModalMaterials(function(prev) {
            return prev.map(function(m, i) {
              if (i !== idx) return m;
              return Object.assign({}, m, { [field]: value });
            });
          });
        };
        var removeMaterialRow = function(idx) {
          setModalMaterials(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); });
        };
        var selectStockItem = function(idx, stockItem) {
          setModalMaterials(function(prev) {
            return prev.map(function(m, i) {
              if (i !== idx) return m;
              return Object.assign({}, m, {
                stockItemId: stockItem._id, materialCode: stockItem.materialCode,
                material: stockItem.material, group: stockItem.group, subGroup: stockItem.subGroup,
                sqMtrPrice: parseFloat(stockItem.sqMtrPrice) || 0,
                qty: m.qty || 0
              });
            });
          });
        };
        var materialsTotalCost = modalMaterials.reduce(function(a, m) { return a + ((m.qty || 0) * (m.sqMtrPrice || 0)); }, 0);

        return (
          <div className="wizard-overlay" onClick={function() { setStatusModal(null); }}>
            <div className="wizard-modal" style={{ width: 540, maxWidth: "90%" }}
              onClick={function(e) { e.stopPropagation(); }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex" }}>{TASK_ICONS[task.id] || null}</span>
                  {task.label} {task.status === TASK_STATUS.COMPLETE ? "— Edit" : "→ " + statusModal.newStatus}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{item.desc} — {item.printW}×{item.printH}mm × {item.qty}</div>
              </div>
              <div style={{ padding: 24, maxHeight: "60vh", overflowY: "auto" }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Time Spent (minutes)</div>
                  <input style={s.input} type="number" min="0" value={modalTime}
                    onChange={function(e) { setModalTime(parseInt(e.target.value) || 0); }} autoFocus />
                </div>
                {statusModal.newStatus === TASK_STATUS.COMPLETE && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Materials Used {materialsTotalCost > 0 ? " — cost: " + fmt(materialsTotalCost) : ""}
                      </div>
                      <button style={Object.assign({}, s.btn(), { fontSize: 9, padding: "3px 10px" })} onClick={addMaterialRow}>+ Add Material</button>
                    </div>
                    {modalMaterials.length === 0 && (
                      <div style={{ padding: 16, textAlign: "center", color: "#ccc", fontSize: 11, border: "1px dashed #e0e0e0", borderRadius: 6, marginBottom: 12 }}>
                        No materials added — click "+ Add Material" to track usage
                      </div>
                    )}
                    {modalMaterials.map(function(mat, idx) {
                      return React.createElement("div", { key: idx, style: { padding: "10px 12px", background: "#fafafa", borderRadius: 6, marginBottom: 8, border: "1px solid #f0f0f0" } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                          React.createElement("span", { style: { fontSize: 10, color: "#888" } }, "Material " + (idx + 1)),
                          React.createElement("button", {
                            onClick: function() { removeMaterialRow(idx); },
                            style: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 12 },
                            onMouseEnter: function(e) { e.target.style.color = "#c00"; },
                            onMouseLeave: function(e) { e.target.style.color = "#ccc"; }
                          }, "✕")
                        ),
                        React.createElement("div", { style: { marginBottom: 6 } },
                          stockData ? React.createElement("select", {
                            style: Object.assign({}, s.select, { fontSize: 11 }),
                            value: mat.stockItemId || "",
                            onChange: function(e) {
                              var selected = stockData.find(function(si) { return si._id === e.target.value; });
                              if (selected) selectStockItem(idx, selected);
                            }
                          },
                            React.createElement("option", { value: "" }, "Select material..."),
                            Object.keys(stockGroups).sort().map(function(g) {
                              return React.createElement("optgroup", { key: g, label: g },
                                Object.keys(stockGroups[g]).sort().map(function(sg) {
                                  return stockGroups[g][sg].map(function(si) {
                                    return React.createElement("option", { key: si._id, value: si._id },
                                      sg + " — " + si.materialCode + " (" + si.sizeWidthMm + "×" + si.sizeLengthMm + ") £" + (parseFloat(si.sqMtrPrice) || 0).toFixed(2) + "/m²"
                                    );
                                  });
                                })
                              );
                            })
                          ) : React.createElement("input", { style: s.input, value: mat.material, placeholder: "Material name",
                            onChange: function(e) { updateMaterialRow(idx, "material", e.target.value); } })
                        ),
                        React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                          React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: { fontSize: 9, color: "#888", marginBottom: 2 } }, "Quantity (m²)"),
                            React.createElement("input", { type: "number", step: "0.01", min: "0",
                              style: Object.assign({}, s.input, { fontSize: 11 }), value: mat.qty,
                              onChange: function(e) { updateMaterialRow(idx, "qty", parseFloat(e.target.value) || 0); }
                            })
                          ),
                          React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: { fontSize: 9, color: "#888", marginBottom: 2 } }, "Cost/m²"),
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 500, padding: "7px 0" } }, "£" + (mat.sqMtrPrice || 0).toFixed(2))
                          ),
                          React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: { fontSize: 9, color: "#888", marginBottom: 2 } }, "Line Cost"),
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 500, padding: "7px 0", color: "#1565c0" } }, fmt((mat.qty || 0) * (mat.sqMtrPrice || 0)))
                          )
                        )
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 24px", borderTop: "1px solid #eee" }}>
                <button style={s.btn("secondary")} onClick={function() { setStatusModal(null); }}>Cancel</button>
                <button style={s.btn()} onClick={confirmStatusChange}>Confirm</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Packing confirmation modal */}
      {packingModal && (function() {
        var item = items.find(function(i) { return i.id === packingModal.itemId; });
        if (!item) return null;
        return (
          <div className="wizard-overlay" onClick={function() { setPackingModal(null); }}>
            <div className="wizard-modal" style={{ width: 440, maxWidth: "90%" }}
              onClick={function(e) { e.stopPropagation(); }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex" }}>{TASK_ICONS.packing}</span>
                  Packing Confirmation
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{item.desc}</div>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Confirm line is packed</div>
                  <div style={{ fontSize: 13, padding: "10px 14px", background: "#f0fdf4", borderRadius: 4, border: "1px solid #bbf7d0" }}>
                    {item.desc} — Qty: {item.qty} — {(item.sqm || 0).toFixed(2)} m²
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Number of Packages Created</div>
                  <input style={s.input} type="number" min="1" value={modalPackages}
                    onChange={function(e) { setModalPackages(parseInt(e.target.value) || 1); }} autoFocus />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Time Spent (minutes)</div>
                  <input style={s.input} type="number" min="0" value={modalTime}
                    onChange={function(e) { setModalTime(parseInt(e.target.value) || 0); }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 24px", borderTop: "1px solid #eee" }}>
                <button style={s.btn("secondary")} onClick={function() { setPackingModal(null); }}>Cancel</button>
                <button style={s.btn()} onClick={confirmPacking}>Confirm Packed</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete line item confirmation */}
      {deleteConfirm && (function() {
        var item = items.find(function(i) { return i.id === deleteConfirm; });
        if (!item) return null;
        return (
          <div className="wizard-overlay" onClick={function() { setDeleteConfirm(null); }}>
            <div className="wizard-modal" style={{ width: 400, maxWidth: "90%" }}
              onClick={function(e) { e.stopPropagation(); }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Delete Line Item</div>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>Are you sure you want to delete this line item?</div>
                <div style={{ fontSize: 12, fontWeight: 500, padding: "10px 14px", background: "#f5f5f5", borderRadius: 6, marginBottom: 12 }}>
                  {item.desc}
                  <div style={{ fontSize: 11, color: "#888", fontWeight: 400, marginTop: 4 }}>
                    {item.process} · {item.qty} qty · {item.tasks ? item.tasks.length + " steps" : "no steps"}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#c00" }}>This action cannot be undone. All task data for this item will be removed.</div>
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button style={s.btn("secondary")} onClick={function() { setDeleteConfirm(null); }}>Cancel</button>
                <button style={Object.assign({}, s.btn(), { background: "#c00" })} onClick={function() { deleteLineItem(deleteConfirm); }}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Undo toast */}
      {undoAction && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#333", color: "#fff", borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", fontSize: 12, animation: "fadeIn 0.2s" }}>
          <span>{undoAction.label}: status changed</span>
          <button onClick={function(e) { e.stopPropagation(); performUndo(); }}
            style={{ background: "#fff", color: "#333", border: "none", borderRadius: 4, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Undo
          </button>
          <button onClick={function() { if (undoTimer) clearTimeout(undoTimer); setUndoAction(null); }}
            style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* Notes modal */}
      {notesModal && (function() {
        var item = items.find(function(i) { return i.id === notesModal.itemId; });
        if (!item) return null;
        return (
          <div className="wizard-overlay" onClick={function() { setNotesModal(null); }}>
            <div className="wizard-modal" style={{ width: 440, maxWidth: "90%" }}
              onClick={function(e) { e.stopPropagation(); }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Line Notes</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{item.desc}</div>
              </div>
              <div style={{ padding: 24 }}>
                <textarea
                  value={notesText}
                  onChange={function(e) { setNotesText(e.target.value); }}
                  placeholder="Add notes for this line item — production instructions, special requirements, client requests..."
                  style={Object.assign({}, s.input, { minHeight: 120, resize: "vertical", fontFamily: "inherit", fontSize: 12, lineHeight: 1.5 })} />
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
                <button style={s.btn("secondary")} onClick={function() { setNotesModal(null); }}>Cancel</button>
                <button style={s.btn()} onClick={saveNotes}>Save Notes</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Task Editor Modal */}
      {taskEditorModal && (function() {
        var item = items.find(function(i) { return i.id === taskEditorModal.itemId; });
        if (!item) return null;
        // Calculate totals for warning
        var totalEstHours = editTasks.filter(function(t) { return t.status !== TASK_STATUS.SKIPPED; }).reduce(function(acc, t) {
          return acc + durationToHours(t.estimatedDuration || 0, t.estimatedUnit || "minutes");
        }, 0);
        var itemDurationHours = durationToHours(item.duration || 1, item.durationUnit || "days");
        var isOverBudget = totalEstHours > 0 && itemDurationHours > 0 && totalEstHours > itemDurationHours;

        return (
          <div className="wizard-overlay" onClick={function() { setTaskEditorModal(null); }}>
            <div className="wizard-modal" style={{ width: 640, maxWidth: "95%" }}
              onClick={function(e) { e.stopPropagation(); }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Edit Production Steps</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                  {item.desc} — {item.process}
                  {item.duration ? " · " + item.duration + " " + (item.durationUnit || "days") + " budget" : ""}
                  {item.deliveryDate ? " · Due " + fmtDateShort(item.deliveryDate) : ""}
                </div>
              </div>
              <div style={{ padding: 24, maxHeight: 400, overflowY: "auto" }}>
                {/* Duration warning */}
                {isOverBudget && (
                  <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 6, background: "#fff3e0", border: "1px solid #ffcc80", fontSize: 11, color: "#e65100", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>⚠</span>
                    <span>Step estimates total <strong>{(totalEstHours || 0).toFixed(1)}h</strong> which exceeds the line item budget of <strong>{(itemDurationHours || 0).toFixed(1)}h</strong> ({item.duration} {item.durationUnit || "days"})</span>
                  </div>
                )}
                {totalEstHours > 0 && !isOverBudget && (
                  <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 6, background: "#e8f5e9", border: "1px solid #a5d6a7", fontSize: 11, color: "#2e7d32", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>✓</span>
                    <span>Step estimates total <strong>{(totalEstHours || 0).toFixed(1)}h</strong> within budget of <strong>{(itemDurationHours || 0).toFixed(1)}h</strong></span>
                  </div>
                )}

                <div style={{ fontSize: 10, color: "#999", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Drag to reorder · Edit labels, assignees &amp; durations · Remove steps not needed
                </div>
                {editTasks.map(function(task, idx) {
                  var isSkipped = task.status === TASK_STATUS.SKIPPED;
                  return (
                    <div key={task.id + "-" + idx}
                      draggable={true}
                      onDragStart={function(e) { handleTaskDragStart(idx, e); }}
                      onDragOver={function(e) { handleTaskDragOver(idx, e); }}
                      onDragEnd={handleTaskDragEnd}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", marginBottom: 4,
                        borderRadius: 6, border: "1px solid #eee", background: dragTaskIdx === idx ? "#f0f0f0" : "#fafafa",
                        opacity: isSkipped ? 0.5 : 1, cursor: "grab", flexWrap: "wrap"
                      }}>
                      <div style={{ cursor: "grab", color: "#ccc", fontSize: 14, flexShrink: 0, userSelect: "none" }}>⋮⋮</div>
                      <div style={{ fontSize: 10, color: "#999", width: 18, textAlign: "center", flexShrink: 0 }}>{idx + 1}</div>
                      <span style={{ width: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{TASK_ICONS[task.id] || "•"}</span>
                      <input
                        value={task.label}
                        onChange={function(e) { updateEditTask(idx, "label", e.target.value); }}
                        onClick={function(e) { e.stopPropagation(); }}
                        style={Object.assign({}, s.input, { flex: 1, minWidth: 80, padding: "4px 8px", fontSize: 11, textDecoration: isSkipped ? "line-through" : "none" })} />
                      <select
                        value={task.assignee}
                        onChange={function(e) { updateEditTask(idx, "assignee", e.target.value); }}
                        onClick={function(e) { e.stopPropagation(); }}
                        style={Object.assign({}, s.select, { width: "auto", minWidth: 80, padding: "3px 6px", fontSize: 10 })}>
                        {STAFF.map(function(st) { return React.createElement("option", { key: st.name, value: st.name }, st.name); })}
                      </select>
                      {/* Duration estimate */}
                      {!isSkipped && (
                        <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                          <input type="number" min="0" step="0.5"
                            value={task.estimatedDuration || ""}
                            placeholder="Est"
                            onChange={function(e) { updateEditTask(idx, "estimatedDuration", parseFloat(e.target.value) || 0); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            style={Object.assign({}, s.input, { width: 45, padding: "3px 6px", fontSize: 10, textAlign: "center" })} />
                          <select
                            value={task.estimatedUnit || "minutes"}
                            onChange={function(e) { updateEditTask(idx, "estimatedUnit", e.target.value); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            style={Object.assign({}, s.select, { width: "auto", padding: "3px 4px", fontSize: 9 })}>
                            <option value="minutes">min</option>
                            <option value="hours">hrs</option>
                            <option value="days">days</option>
                          </select>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                        <button onClick={function(e) { e.stopPropagation(); moveEditTask(idx, idx - 1); }}
                          disabled={idx === 0}
                          style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", padding: 0, fontSize: 9, color: idx === 0 ? "#ddd" : "#888", lineHeight: 1 }}>▲</button>
                        <button onClick={function(e) { e.stopPropagation(); moveEditTask(idx, idx + 1); }}
                          disabled={idx === editTasks.length - 1}
                          style={{ background: "none", border: "none", cursor: idx === editTasks.length - 1 ? "default" : "pointer", padding: 0, fontSize: 9, color: idx === editTasks.length - 1 ? "#ddd" : "#888", lineHeight: 1 }}>▼</button>
                      </div>
                      <button onClick={function(e) { e.stopPropagation(); removeEditTask(idx); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontSize: 14, color: "#ccc", flexShrink: 0, lineHeight: 1 }}
                        onMouseEnter={function(e) { e.target.style.color = "#c00"; }}
                        onMouseLeave={function(e) { e.target.style.color = "#ccc"; }}>✕</button>
                    </div>
                  );
                })}
                <button onClick={addEditTask}
                  style={{ background: "none", border: "1px dashed #ccc", borderRadius: 6, cursor: "pointer", padding: "8px 16px", fontSize: 11, color: "#888", width: "100%", marginTop: 8 }}>
                  + Add Step
                </button>
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {totalEstHours > 0 ? "Total: " + (totalEstHours || 0).toFixed(1) + "h" : "No estimates set"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.btn("secondary")} onClick={function() { setTaskEditorModal(null); }}>Cancel</button>
                  <button style={s.btn()} onClick={saveTaskEditor}>Save Steps</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk Line Editor */}
      {bulkOpen && chargesData && (
        <BulkLineEditor
          chargesData={chargesData}
          userPrefs={userPrefs}
          onToggleFavourite={onToggleFavourite}
          onAddToRecent={onAddToRecent}
          onCreateAll={handleBulkCreate}
          onClose={function() { setBulkOpen(false); setBulkTemplate(null); }}
          templateItem={bulkTemplate}
        />
      )}

      {/* Edit Line Item modal */}
      {editLineItem && (
        <div className="wizard-overlay" onClick={function() { setEditLineItem(null); }}>
          <div className="wizard-modal" style={{ width: 560, maxWidth: "90%" }}
            onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Edit Line Item</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Item #{editLineItem.id}</div>
            </div>
            <div style={{ padding: 24, maxHeight: "60vh", overflowY: "auto" }}>
              <div className="grid-2" style={{ gap: 16 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Description</div>
                  <input style={s.input} value={editLineForm.desc || ""} onChange={function(e) { setEditLineForm(Object.assign({}, editLineForm, { desc: e.target.value })); }} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Print Material</div>
                  {chargesData ? (
                    <MaterialPicker
                      chargesData={chargesData}
                      selectedGroup={editLineForm.processGroup}
                      selectedItem={editLineForm.process}
                      selectedCost={editLineForm.costSqm}
                      favourites={userPrefs ? userPrefs.favouriteMaterials : []}
                      recents={userPrefs ? userPrefs.recentMaterials : []}
                      onToggleFavourite={onToggleFavourite}
                      onSelect={function(sel) {
                        setEditLineForm(Object.assign({}, editLineForm, { processGroup: sel.group, process: sel.item, costSqm: sel.costpersqm }));
                        if (onAddToRecent) onAddToRecent(sel.group, sel.item);
                      }}
                    />
                  ) : (
                    <input style={s.input} value={editLineForm.process || ""} onChange={function(e) { setEditLineForm(Object.assign({}, editLineForm, { process: e.target.value })); }} />
                  )}
                </div>
                {[["Quantity", "qty", "number"], ["Width (mm)", "printW", "number"], ["Height (mm)", "printH", "number"]].map(function(f) {
                  return React.createElement("div", { key: f[1] },
                    React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" } }, f[0]),
                    React.createElement("input", { type: f[2], style: s.input, value: editLineForm[f[1]] || "",
                      onChange: function(e) { setEditLineForm(Object.assign({}, editLineForm, { [f[1]]: f[2] === "number" ? (parseFloat(e.target.value) || 0) : e.target.value })); }
                    })
                  );
                })}
                <div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Delivery Date</div>
                  <input type="date" style={s.input} value={editLineForm.deliveryDate || ""} onChange={function(e) { setEditLineForm(Object.assign({}, editLineForm, { deliveryDate: e.target.value })); }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Duration</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" min="1" style={Object.assign({}, s.input, { flex: 1 })} value={editLineForm.duration || 1}
                      onChange={function(e) { setEditLineForm(Object.assign({}, editLineForm, { duration: parseInt(e.target.value) || 1 })); }} />
                    <select style={Object.assign({}, s.select, { flex: 1 })} value={editLineForm.durationUnit || "days"}
                      onChange={function(e) { setEditLineForm(Object.assign({}, editLineForm, { durationUnit: e.target.value })); }}>
                      {[["minutes","Minutes"],["hours","Hours"],["days","Days"],["weeks","Weeks"],["months","Months"]].map(function(u) {
                        return React.createElement("option", { key: u[0], value: u[0] }, u[1]);
                      })}
                    </select>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>Notes</div>
                  <textarea style={Object.assign({}, s.input, { minHeight: 60, resize: "vertical", fontFamily: "inherit", fontSize: 12 })}
                    value={editLineForm.notes || ""} onChange={function(e) { setEditLineForm(Object.assign({}, editLineForm, { notes: e.target.value })); }} />
                </div>
              </div>
              {/* Cost preview */}
              <div style={{ marginTop: 16, padding: 12, background: "#f5f5f5", borderRadius: 6, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#888" }}>
                  {((editLineForm.printW || 0) * (editLineForm.printH || 0) / 1000000 * (editLineForm.qty || 1)).toFixed(2)} m² × £{(editLineForm.costSqm || 0).toFixed(2)}/m²
                </span>
                <span style={{ fontWeight: 500 }}>
                  {fmt((editLineForm.printW || 0) * (editLineForm.printH || 0) / 1000000 * (editLineForm.qty || 1) * (editLineForm.costSqm || 0))}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 24px", borderTop: "1px solid #eee" }}>
              <button style={s.btn("secondary")} onClick={function() { setEditLineItem(null); }}>Cancel</button>
              <button style={s.btn()} onClick={saveEditLineItem}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for artwork change */}
      <input ref={fileChangeRef} type="file" accept=".pdf,.ai,.eps,.psd,.jpg,.jpeg,.png,.tiff,.tif,.svg"
        style={{ display: "none" }} onChange={handleFileChange} />

      {/* Rename file modal */}
      {renamingFileItemId && (function() {
        var item = items.find(function(i) { return i.id === renamingFileItemId; });
        if (!item) return null;
        return React.createElement("div", { className: "wizard-overlay", onClick: function() { setRenamingFileItemId(null); }, style: { zIndex: 9500 } },
          React.createElement("div", { className: "wizard-modal", style: { width: 400, maxWidth: "90%" }, onClick: function(e) { e.stopPropagation(); } },
            React.createElement("div", { style: { padding: "20px 24px", borderBottom: "1px solid #eee" } },
              React.createElement("div", { style: { fontSize: 15, fontWeight: 500 } }, "Rename File"),
              React.createElement("div", { style: { fontSize: 11, color: "#888", marginTop: 4 } }, item.desc)
            ),
            React.createElement("div", { style: { padding: 24 } },
              React.createElement("div", { style: { fontSize: 11, color: "#888", marginBottom: 4, textTransform: "uppercase" } }, "File Name"),
              React.createElement("input", { style: s.input, value: renameFileValue, autoFocus: true,
                onChange: function(e) { setRenameFileValue(e.target.value); },
                onKeyDown: function(e) { if (e.key === "Enter") renameFile(item, renameFileValue); if (e.key === "Escape") setRenamingFileItemId(null); }
              })
            ),
            React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 24px", borderTop: "1px solid #eee" } },
              React.createElement("button", { style: s.btn("secondary"), onClick: function() { setRenamingFileItemId(null); } }, "Cancel"),
              React.createElement("button", { style: s.btn(), onClick: function() { renameFile(item, renameFileValue); } }, "Rename")
            )
          )
        );
      })()}

      {/* Preflight modal */}
      {preflightItem && preflightItem.file && preflightItem.file !== "TBC" && (function() {
        var safeDesc = (preflightItem.desc || "Item").replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 50);
        var folderKey = currentProject ? currentProject.info.folderKey : "";
        var fileKey = folderKey + "/01-Print Ready Artwork/" + safeDesc + "/" + preflightItem.file;
        return React.createElement(PreflightModal, {
          file: { key: fileKey, name: preflightItem.file, size: 0 },
          onClose: function() { setPreflightItem(null); },
          workerCreds: workerCreds
        });
      })()}
    </div>
  );
}
