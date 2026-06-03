// ═══════════════════════════════════════════════════════════════
// PRODUCTION DASHBOARD — Cross-project task view with filters
// ═══════════════════════════════════════════════════════════════

function Dashboard({ allProjects, projectData, onSelectProject }) {

  var [taskFilter, setTaskFilter] = useState("ALL");
  var [operatorFilter, setOperatorFilter] = useState("ALL");

  // Gather all tasks across all projects
  var allTasks = [];
  allProjects.forEach(function(proj) {
    var pd = projectData[proj.id];
    if (!pd || !pd.items) return;
    pd.items.forEach(function(item) {
      if (!item.tasks) return;
      item.tasks.forEach(function(task) {
        allTasks.push({
          projectId: proj.id,
          projectName: proj.info.project,
          customer: proj.info.customer,
          ref: proj.info.ref,
          itemId: item.id,
          itemDesc: item.desc,
          itemQty: item.qty,
          itemSqm: item.sqm,
          process: item.process,
          taskId: task.id,
          taskLabel: task.label,
          taskStatus: task.status,
          assignee: task.assignee,
          timeSpent: task.timeSpent,
          materialUsed: task.materialUsed,
          packages: task.packages
        });
      });
    });
  });

  // Apply filters
  var filtered = allTasks.filter(function(t) {
    if (taskFilter !== "ALL" && t.taskId !== taskFilter) return false;
    if (operatorFilter !== "ALL" && t.assignee !== operatorFilter) return false;
    return true;
  });

  // Stats
  var totalTasks = filtered.length;
  var complete = filtered.filter(function(t) { return t.taskStatus === TASK_STATUS.COMPLETE; }).length;
  var inProgress = filtered.filter(function(t) { return t.taskStatus === TASK_STATUS.IN_PROGRESS; }).length;
  var pending = filtered.filter(function(t) { return t.taskStatus === TASK_STATUS.PENDING; }).length;
  var totalMinutes = filtered.reduce(function(a, t) { return a + t.timeSpent; }, 0);

  // Unique operators in current dataset
  var operators = [];
  var opSet = {};
  allTasks.forEach(function(t) {
    if (!opSet[t.assignee]) { opSet[t.assignee] = true; operators.push(t.assignee); }
  });
  operators.sort();

  // Task step counts for button badges
  var stepCounts = {};
  PRODUCTION_TASKS.forEach(function(pt) {
    stepCounts[pt.id] = allTasks.filter(function(t) { return t.taskId === pt.id && t.taskStatus !== TASK_STATUS.COMPLETE; }).length;
  });

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.pageTitle}>Production Dashboard</h1>
        <p style={s.pageSub}>Cross-project task view — filter by production step or operator</p>
      </div>

      {/* KPIs */}
      <div className="grid-5" style={{ marginBottom: 24 }}>
        <StatCard value={totalTasks} label="Tasks Shown" />
        <StatCard value={complete} label="Complete" />
        <StatCard value={inProgress} label="In Progress" />
        <StatCard value={pending} label="Pending" />
        <StatCard value={Math.floor(totalMinutes / 60) + "h " + (totalMinutes % 60) + "m"} label="Time Logged" />
      </div>

      {/* Task step filter buttons */}
      <div style={Object.assign({}, s.card, { marginBottom: 20 })}>
        <div style={s.cardBody}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={function() { setTaskFilter("ALL"); }}
              style={Object.assign({}, s.btn(taskFilter === "ALL" ? "primary" : "secondary"), { fontSize: 11, padding: "6px 16px" })}>
              All Steps
            </button>
            {PRODUCTION_TASKS.map(function(pt) {
              var isActive = taskFilter === pt.id;
              var count = stepCounts[pt.id] || 0;
              return (
                <button key={pt.id}
                  onClick={function() { setTaskFilter(isActive ? "ALL" : pt.id); }}
                  style={Object.assign({}, s.btn(isActive ? "primary" : "secondary"), { fontSize: 11, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 })}>
                  <span style={{ display: "inline-flex" }}>{TASK_ICONS[pt.id] || null}</span>
                  {pt.label}
                  {count > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
                      background: isActive ? "rgba(255,255,255,0.3)" : "#eee", color: isActive ? "#fff" : "#888"
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <span style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>Operator:</span>
            <select style={Object.assign({}, s.select, { width: "auto", minWidth: 160, padding: "5px 10px", fontSize: 12 })}
              value={operatorFilter}
              onChange={function(e) { setOperatorFilter(e.target.value); }}>
              <option value="ALL">All Operators</option>
              {operators.map(function(op) {
                return <option key={op} value={op}>{op}</option>;
              })}
            </select>
            {(taskFilter !== "ALL" || operatorFilter !== "ALL") && (
              <button style={Object.assign({}, s.btn("secondary"), { fontSize: 11, padding: "5px 12px" })}
                onClick={function() { setTaskFilter("ALL"); setOperatorFilter("ALL"); }}>
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Task table */}
      <div style={s.card}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>
            {taskFilter !== "ALL" ? PRODUCTION_TASKS.find(function(t) { return t.id === taskFilter; }).label : "All Tasks"}
            {operatorFilter !== "ALL" ? " — " + operatorFilter : ""}
          </span>
          <span style={{ fontSize: 11, color: "#888" }}>{filtered.length} tasks</span>
        </div>
        <div className="table-wrap">
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Task</th>
                <th style={s.th}>Project</th>
                <th style={s.th}>Line Item</th>
                <th style={s.th}>Operator</th>
                <th style={Object.assign({}, s.th, { textAlign: "center" })}>Status</th>
                <th style={Object.assign({}, s.th, { textAlign: "right" })}>Time</th>
                <th style={Object.assign({}, s.th, { textAlign: "right" })}>Material</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={Object.assign({}, s.td, { textAlign: "center", padding: 32, color: "#999" })}>
                    No tasks match the current filters.
                  </td>
                </tr>
              ) : filtered.map(function(t, idx) {
                var statusStyle = {
                  "PENDING": { bg: "#f5f5f5", color: "#999" },
                  "IN PROGRESS": { bg: "#e8e8e8", color: "#444" },
                  "COMPLETE": { bg: "#111", color: "#fff" }
                };
                var sc = statusStyle[t.taskStatus] || statusStyle.PENDING;
                return (
                  <tr key={idx}
                    style={{ cursor: "pointer" }}
                    onClick={function() { onSelectProject(t.projectId); }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}>
                    <td style={s.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ display: "inline-flex", width: 16 }}>{TASK_ICONS[t.taskId] || null}</span>
                        <span style={{ fontWeight: 500, fontSize: 12 }}>{t.taskLabel}</span>
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={{ fontSize: 12 }}>{t.projectName}</div>
                      <div style={{ fontSize: 10, color: "#999" }}>{t.ref} · {t.customer}</div>
                    </td>
                    <td style={Object.assign({}, s.td, { fontSize: 12 })}>{t.itemDesc}</td>
                    <td style={Object.assign({}, s.td, { fontSize: 12 })}>{t.assignee}</td>
                    <td style={Object.assign({}, s.td, { textAlign: "center" })}>
                      <span style={{
                        display: "inline-block", fontSize: 9, fontWeight: 500,
                        padding: "2px 8px", borderRadius: 3, letterSpacing: "0.04em",
                        textTransform: "uppercase", background: sc.bg, color: sc.color
                      }}>{t.taskStatus}</span>
                    </td>
                    <td style={Object.assign({}, s.td, { textAlign: "right", fontSize: 11, color: t.timeSpent > 0 ? "#111" : "#ccc" })}>
                      {t.timeSpent > 0 ? t.timeSpent + " min" : "—"}
                    </td>
                    <td style={Object.assign({}, s.td, { textAlign: "right", fontSize: 11, color: t.materialUsed > 0 ? "#111" : "#ccc" })}>
                      {t.materialUsed > 0 ? t.materialUsed.toFixed(2) + " m²" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operator workload summary */}
      <div style={Object.assign({}, s.card, { marginTop: 20 })}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Operator Workload</span>
        </div>
        <div className="table-wrap">
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Operator</th>
                <th style={Object.assign({}, s.th, { textAlign: "center" })}>Pending</th>
                <th style={Object.assign({}, s.th, { textAlign: "center" })}>In Progress</th>
                <th style={Object.assign({}, s.th, { textAlign: "center" })}>Complete</th>
                <th style={Object.assign({}, s.th, { textAlign: "right" })}>Time Logged</th>
                <th style={s.th}>Load</th>
              </tr>
            </thead>
            <tbody>
              {operators.map(function(op) {
                var opTasks = allTasks.filter(function(t) { return t.assignee === op; });
                var opPending = opTasks.filter(function(t) { return t.taskStatus === TASK_STATUS.PENDING; }).length;
                var opInProg = opTasks.filter(function(t) { return t.taskStatus === TASK_STATUS.IN_PROGRESS; }).length;
                var opDone = opTasks.filter(function(t) { return t.taskStatus === TASK_STATUS.COMPLETE; }).length;
                var opTime = opTasks.reduce(function(a, t) { return a + t.timeSpent; }, 0);
                var opActive = opPending + opInProg;
                var loadPct = opTasks.length > 0 ? Math.round((opDone / opTasks.length) * 100) : 0;
                return (
                  <tr key={op}
                    style={{ cursor: "pointer" }}
                    onClick={function() { setOperatorFilter(op === operatorFilter ? "ALL" : op); }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = "#fafafa"; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}>
                    <td style={Object.assign({}, s.td, { fontWeight: 500 })}>
                      {op}
                      {operatorFilter === op && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>✓ filtered</span>}
                    </td>
                    <td style={Object.assign({}, s.td, { textAlign: "center", color: opPending > 0 ? "#111" : "#ccc" })}>{opPending}</td>
                    <td style={Object.assign({}, s.td, { textAlign: "center", color: opInProg > 0 ? "#111" : "#ccc" })}>{opInProg}</td>
                    <td style={Object.assign({}, s.td, { textAlign: "center", color: opDone > 0 ? "#111" : "#ccc" })}>{opDone}</td>
                    <td style={Object.assign({}, s.td, { textAlign: "right", fontSize: 11 })}>
                      {opTime > 0 ? Math.floor(opTime / 60) + "h " + (opTime % 60) + "m" : "—"}
                    </td>
                    <td style={Object.assign({}, s.td, { width: 120 })}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={Object.assign({}, s.progressBar, { flex: 1 })}>
                          <div style={s.progressFill(loadPct)} />
                        </div>
                        <span style={{ fontSize: 10, color: "#888", width: 30, textAlign: "right" }}>{loadPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
