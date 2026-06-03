// ═══════════════════════════════════════════════════════════════
// SCHEDULE — Timeline Overview + Weekly Board + Resource View
// All read-only — no dragging
// ═══════════════════════════════════════════════════════════════

function Scheduler({ allProjects, projectData, onSelectProject, onScheduleChange }) {

  var [expandedProject, setExpandedProject] = useState(null);
  var [viewMode, setViewMode] = useState("timeline"); // "timeline", "weekly", "resource"
  var [weekOffset, setWeekOffset] = useState(0);
  var [expandedDay, setExpandedDay] = useState(null); // for hourly view in timeline

  // ── Drag and drop state (weekly board) ──
  var [dragData, setDragData] = useState(null);
  var [dragPos, setDragPos] = useState(null);
  var dayColRefs = React.useRef([]);

  var handleDragStart = function(e, item, project, dayIdx) {
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    setDragData({ item: item, project: project, dayIdx: dayIdx, startX: e.clientX, startY: e.clientY });
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  var handleDragMove = function(e) {
    if (!dragData) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  var handleDragEnd = function(e) {
    if (!dragData) return;
    var dropDayIdx = -1;
    dayColRefs.current.forEach(function(ref, idx) {
      if (ref) {
        var rect = ref.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) dropDayIdx = idx;
      }
    });
    if (dropDayIdx >= 0 && dropDayIdx !== dragData.dayIdx) {
      var newDate = weekDays[dropDayIdx].date;
      var item = dragData.item;
      var dur = item.duration || 1;
      var unit = item.durationUnit || "days";
      var daysSpan = Math.max(1, Math.ceil(durationToDays(dur, unit)));
      var newDelivery = addDays(newDate, daysSpan);
      if (onScheduleChange) {
        onScheduleChange(dragData.project.id, item.id, {
          startDate: newDate.toISOString().split("T")[0],
          deliveryDate: newDelivery.toISOString().split("T")[0]
        });
      }
    }
    setDragData(null);
    setDragPos(null);
  };

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Item date calculations ──
  var getItemDates = function(item) {
    var delivery = item.deliveryDate ? new Date(item.deliveryDate) : null;
    var dur = item.duration || 1;
    var unit = item.durationUnit || "days";
    if (!delivery) {
      var daysSpan = Math.max(1, Math.ceil(durationToDays(dur, unit)));
      return { start: new Date(today), end: addDays(today, daysSpan), days: daysSpan };
    }
    var start = calcStartDate(delivery, dur, unit) || addDays(delivery, -Math.ceil(durationToDays(dur, unit)));
    return { start: start, end: delivery, days: Math.max(1, daysBetween(start, delivery)) };
  };

  var getProjectDates = function(pid) {
    var pd = projectData[pid];
    var items = pd && pd.items ? pd.items : [];
    if (items.length === 0) return { start: new Date(today), end: addDays(today, 7) };
    var earliest = null, latest = null;
    items.forEach(function(item) {
      var d = getItemDates(item);
      if (!earliest || d.start < earliest) earliest = new Date(d.start);
      if (!latest || d.end > latest) latest = new Date(d.end);
    });
    return { start: earliest || new Date(today), end: latest || addDays(today, 7) };
  };

  var getItems = function(pid) {
    var pd = projectData[pid];
    return pd && pd.items ? pd.items : [];
  };

  // ── Global date range for timeline ──
  var globalRange = (function() {
    var earliest = null, latest = null;
    allProjects.forEach(function(proj) {
      var d = getProjectDates(proj.id);
      if (!earliest || d.start < earliest) earliest = new Date(d.start);
      if (!latest || d.end > latest) latest = new Date(d.end);
    });
    if (!earliest) earliest = new Date(today);
    if (!latest) latest = addDays(today, 30);
    earliest = addDays(earliest, -2);
    latest = addDays(latest, 2);
    return { start: earliest, end: latest, totalDays: Math.max(7, daysBetween(earliest, latest)) };
  })();

  var getBarPercent = function(startDate, endDate) {
    var left = Math.max(0, daysBetween(globalRange.start, startDate));
    var width = Math.max(1, daysBetween(startDate, endDate));
    return { left: (left / globalRange.totalDays) * 100, width: Math.max(1, (width / globalRange.totalDays) * 100) };
  };

  var todayPct = (daysBetween(globalRange.start, today) / globalRange.totalDays) * 100;

  // Month markers
  var monthMarkers = (function() {
    var markers = [];
    var d = new Date(globalRange.start);
    d.setDate(1);
    if (d < globalRange.start) { d.setMonth(d.getMonth() + 1); d.setDate(1); }
    while (d <= globalRange.end) {
      markers.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), pct: (daysBetween(globalRange.start, d) / globalRange.totalDays) * 100 });
      d.setMonth(d.getMonth() + 1); d.setDate(1);
    }
    return markers;
  })();

  // ── Week days for weekly/resource views ──
  var getWeekDays = function() {
    var monday = new Date(today);
    var dow = monday.getDay();
    monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow) + (weekOffset * 7));
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = addDays(monday, i);
      days.push({ date: new Date(d), label: d.getDate().toString(), dayName: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()], month: d.toLocaleDateString("en-GB", { month: "short" }), isWeekend: d.getDay() === 0 || d.getDay() === 6, isToday: d.toDateString() === today.toDateString() });
    }
    return days;
  };
  var weekDays = getWeekDays();
  var weekLabel = fmtDateShort(weekDays[0].date) + " — " + fmtDateShort(weekDays[6].date);

  // ── Build all work items for a given day ──
  var getWorkForDay = function(date) {
    var work = [];
    allProjects.forEach(function(proj) {
      var items = getItems(proj.id);
      items.forEach(function(item) {
        var dates = getItemDates(item);
        if (date >= dates.start && date <= dates.end) {
          var tasksDone = item.tasks ? item.tasks.filter(function(t) { return t.status === TASK_STATUS.COMPLETE; }).length : 0;
          var tasksActive = item.tasks ? item.tasks.filter(function(t) { return t.status !== TASK_STATUS.SKIPPED; }).length : 0;
          work.push({ project: proj, item: item, tasksDone: tasksDone, tasksActive: tasksActive, pct: tasksActive > 0 ? Math.round(tasksDone / tasksActive * 100) : 0 });
        }
      });
    });
    return work;
  };

  // ── Build resource data ──
  var buildResourceData = function() {
    var resources = {};
    allProjects.forEach(function(proj) {
      var items = getItems(proj.id);
      items.forEach(function(item) {
        if (!item.tasks) return;
        var dates = getItemDates(item);
        item.tasks.forEach(function(task) {
          if (task.status === TASK_STATUS.SKIPPED) return;
          var assignee = task.assignee || "Unassigned";
          if (!resources[assignee]) resources[assignee] = [];
          resources[assignee].push({ start: dates.start, end: dates.end, task: task, item: item, project: proj });
        });
      });
    });
    return resources;
  };

  // Status colours
  var pctColor = function(pct) {
    if (pct === 100) return { bg: "#111", fg: "#fff" };
    if (pct >= 70) return { bg: "#555", fg: "#fff" };
    if (pct >= 30) return { bg: "#aaa", fg: "#fff" };
    return { bg: "#ddd", fg: "#555" };
  };

  // Load colour
  var loadColor = function(count) {
    if (count === 0) return { bg: "#f8f8f8", label: "Free", color: "#ccc" };
    if (count <= 2) return { bg: "#e8f5e9", label: "Light", color: "#2e7d32" };
    if (count <= 4) return { bg: "#fff3e0", label: "Busy", color: "#e65100" };
    return { bg: "#ffebee", label: "Heavy", color: "#c62828" };
  };

  // ── KPIs ──
  var totalItems = allProjects.reduce(function(a, p) { return a + getItems(p.id).length; }, 0);
  var activeItems = allProjects.reduce(function(a, p) { return a + getItems(p.id).filter(function(i) { return calcItemStatus(i.tasks) !== "FINISHED"; }).length; }, 0);
  var resourceNames = Object.keys(buildResourceData()).sort();

  // ── Week navigation ──
  var WeekNav = function() {
    return React.createElement("div", { style: { display: "flex", justifyContent: "center", gap: 8, marginBottom: 12, alignItems: "center" } },
      React.createElement("button", { style: s.btn("secondary"), onClick: function() { setWeekOffset(function(p) { return p - 1; }); } }, "←"),
      React.createElement("span", { style: { fontSize: 12, fontWeight: 500, padding: "0 12px", minWidth: 160, textAlign: "center" } }, weekLabel),
      React.createElement("button", { style: s.btn("secondary"), onClick: function() { setWeekOffset(0); } }, "Today"),
      React.createElement("button", { style: s.btn("secondary"), onClick: function() { setWeekOffset(function(p) { return p + 1; }); } }, "→")
    );
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={s.pageTitle}>Schedule</div>
          <div style={s.pageSub}>{allProjects.length} projects · {globalRange.totalDays} day span</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[["timeline","Timeline"],["weekly","Weekly Board"],["resource","Resources"]].map(function(pair) {
            return React.createElement("button", { key: pair[0], style: s.btn(viewMode === pair[0] ? "primary" : "secondary"), onClick: function() { setViewMode(pair[0]); } }, pair[1]);
          })}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={Object.assign({}, s.card, { marginBottom: 16 })}>
        <div style={s.cardBody}>
          <div className="grid-4" style={{ marginBottom: 0 }}>
            {[[allProjects.length, "Projects"], [activeItems + "/" + totalItems, "Active Items"], [globalRange.totalDays, "Days Span"], [resourceNames.length, "Operators"]].map(function(pair, idx) {
              return React.createElement("div", { key: idx, style: { textAlign: "center", padding: "10px 8px", borderLeft: idx > 0 ? "1px solid #f0f0f0" : "none" } },
                React.createElement("div", { style: { fontSize: 20, fontWeight: 500 } }, pair[0]),
                React.createElement("div", { style: { fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.03em" } }, pair[1])
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════ VIEW 1: TIMELINE OVERVIEW ═══════ */}
      {viewMode === "timeline" && (
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardTitle}>Project Timeline</span>
            <span style={{ fontSize: 11, color: "#888" }}>{fmtDateShort(globalRange.start)} → {fmtDateShort(globalRange.end)}</span>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            {/* Month labels + today */}
            <div style={{ position: "relative", height: 22, marginBottom: 4 }}>
              {monthMarkers.map(function(m, idx) {
                return React.createElement("div", { key: idx, style: { position: "absolute", left: m.pct + "%", fontSize: 9, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" } }, m.label);
              })}
              {todayPct >= 0 && todayPct <= 100 && React.createElement("div", { style: { position: "absolute", left: todayPct + "%", top: 14, width: 1, height: 8, background: "#c00" } })}
            </div>

            {allProjects.map(function(proj) {
              var items = getItems(proj.id);
              var st = projStats(items, []);
              var pc = pctColor(st.pct);
              var projDates = getProjectDates(proj.id);
              var bar = getBarPercent(projDates.start, projDates.end);
              var isExpanded = expandedProject === proj.id;

              return React.createElement("div", { key: proj.id },
                React.createElement("div", {
                  style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4, padding: "4px 0" }
                },
                  React.createElement("div", { style: { width: 160, flexShrink: 0, overflow: "hidden" } },
                    React.createElement("div", {
                      style: { fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" },
                      onClick: function() { if (onSelectProject) onSelectProject(proj.id); },
                      title: "Click to open project"
                    },
                      React.createElement("span", { style: { fontSize: 9, color: "#4a90d9" } }, "→"),
                      React.createElement("span", { style: { color: "#4a90d9" } }, proj.info.project)
                    ),
                    React.createElement("div", { style: { fontSize: 9, color: "#999", paddingLeft: 14 } }, proj.info.customer + " · " + fmtDateShort(projDates.end))
                  ),
                  React.createElement("div", {
                    style: { flex: 1, position: "relative", height: 22, background: "#f8f8f8", borderRadius: 4, cursor: "pointer" },
                    onClick: function() { setExpandedProject(isExpanded ? null : proj.id); }
                  },
                    todayPct >= 0 && todayPct <= 100 && React.createElement("div", { style: { position: "absolute", left: todayPct + "%", top: 0, bottom: 0, width: 1, background: "#c00", zIndex: 2 } }),
                    React.createElement("div", { style: { position: "absolute", left: bar.left + "%", width: bar.width + "%", top: 2, bottom: 2, background: pc.bg, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: pc.fg, fontWeight: 500, overflow: "hidden", whiteSpace: "nowrap" } },
                      bar.width > 8 ? st.pct + "% · " + items.length + " items" : st.pct + "%")
                  )
                ),
                // Expanded sub-items
                isExpanded && items.map(function(item) {
                  var dates = getItemDates(item);
                  var itemBar = getBarPercent(dates.start, dates.end);
                  var tasksDone = item.tasks ? item.tasks.filter(function(t) { return t.status === TASK_STATUS.COMPLETE; }).length : 0;
                  var tasksActive = item.tasks ? item.tasks.filter(function(t) { return t.status !== TASK_STATUS.SKIPPED; }).length : 0;
                  var itemPct = tasksActive > 0 ? Math.round(tasksDone / tasksActive * 100) : 0;
                  return React.createElement("div", { key: proj.id + "-" + item.id, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 2, paddingLeft: 16 } },
                    React.createElement("div", { style: { width: 144, flexShrink: 0, fontSize: 10, color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, item.desc),
                    React.createElement("div", { style: { flex: 1, position: "relative", height: 14, background: "#f8f8f8", borderRadius: 3 } },
                      todayPct >= 0 && todayPct <= 100 && React.createElement("div", { style: { position: "absolute", left: todayPct + "%", top: 0, bottom: 0, width: 1, background: "#c00", zIndex: 2 } }),
                      React.createElement("div", { style: { position: "absolute", left: itemBar.left + "%", width: itemBar.width + "%", top: 1, bottom: 1, background: itemPct === 100 ? "#111" : "#999", borderRadius: 2, fontSize: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" } },
                        itemBar.width > 6 ? itemPct + "%" : "")
                    )
                  );
                })
              );
            })}
          </div>

          {/* ── Day Detail Strip (click a day to expand hourly view) ── */}
          <div style={{ marginTop: 12, display: "flex", gap: 2, flexWrap: "wrap" }}>
            {(function() {
              var days = [];
              for (var d = 0; d < totalDays; d++) {
                var dayDate = addDays(rangeStart, d);
                var dayKey = dayDate.toISOString().split("T")[0];
                var isToday = dayDate.getTime() === today.getTime();
                var isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                var isSelected = expandedDay === dayKey;
                days.push(React.createElement("div", {
                  key: dayKey,
                  onClick: function(dk) { return function() { setExpandedDay(expandedDay === dk ? null : dk); }; }(dayKey),
                  style: { width: 28, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: isToday ? 600 : 400, background: isSelected ? "#111" : isToday ? "#f0f0f0" : "transparent", color: isSelected ? "#fff" : isWeekend ? "#ccc" : "#666", borderRadius: 4, cursor: "pointer", border: isToday ? "1px solid #ccc" : "1px solid transparent" },
                  title: dayDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
                }, dayDate.getDate()));
              }
              return days;
            })()}
          </div>

          {/* ── Expanded Hourly View ── */}
          {expandedDay && (function() {
            var dayDate = new Date(expandedDay + "T00:00:00");
            var dayLabel = dayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            var hours = [];
            for (var h = 6; h <= 20; h++) hours.push(h);

            // Find items active on this day
            var dayItems = [];
            allProjects.forEach(function(proj) {
              var items = getItems(proj.id);
              items.forEach(function(item) {
                var dates = getItemDates(item);
                var itemStart = new Date(dates.start); itemStart.setHours(0,0,0,0);
                var itemEnd = new Date(dates.end); itemEnd.setHours(0,0,0,0);
                if (dayDate >= itemStart && dayDate <= itemEnd) {
                  dayItems.push({ item: item, project: proj, dates: dates });
                }
              });
            });

            return React.createElement("div", { style: Object.assign({}, s.card, { marginTop: 8 }) },
              React.createElement("div", { style: { padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", null,
                  React.createElement("span", { style: { fontSize: 13, fontWeight: 500 } }, dayLabel),
                  React.createElement("span", { style: { fontSize: 11, color: "#888", marginLeft: 12 } }, dayItems.length + " item" + (dayItems.length !== 1 ? "s" : ""))
                ),
                React.createElement("button", { onClick: function() { setExpandedDay(null); }, style: { background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#999" } }, "✕")
              ),
              React.createElement("div", { style: { display: "flex", position: "relative", minHeight: 60 } },
                // Hour markers
                React.createElement("div", { style: { display: "flex", width: "100%", borderBottom: "1px solid #f0f0f0" } },
                  hours.map(function(h) {
                    return React.createElement("div", { key: h, style: { flex: 1, borderRight: "1px solid #f0f0f0", padding: "8px 0", textAlign: "center" } },
                      React.createElement("div", { style: { fontSize: 9, color: "#999", fontWeight: 500 } }, (h < 10 ? "0" : "") + h + ":00")
                    );
                  })
                )
              ),
              // Items active this day
              React.createElement("div", { style: { padding: "8px 16px 12px" } },
                dayItems.length === 0 ? React.createElement("div", { style: { textAlign: "center", padding: 16, color: "#ccc", fontSize: 11 } }, "No items scheduled for this day") :
                dayItems.map(function(di, idx) {
                  var tasksDone = di.item.tasks ? di.item.tasks.filter(function(t) { return t.status === TASK_STATUS.COMPLETE; }).length : 0;
                  var tasksTotal = di.item.tasks ? di.item.tasks.filter(function(t) { return t.status !== TASK_STATUS.SKIPPED; }).length : 0;
                  var pct = tasksTotal > 0 ? Math.round(tasksDone / tasksTotal * 100) : 0;
                  var pc = pctColor(pct);
                  return React.createElement("div", { key: idx, style: { display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid #f8f8f8" } },
                    React.createElement("div", { style: { width: 8, height: 8, borderRadius: "50%", background: pct === 100 ? "#111" : "#ccc", flexShrink: 0 } }),
                    React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                      React.createElement("div", { style: { fontSize: 11, fontWeight: 500 } }, di.item.desc),
                      React.createElement("div", { style: { fontSize: 10, color: "#888" } }, di.project.info.project + " · " + tasksDone + "/" + tasksTotal + " tasks")
                    ),
                    React.createElement("span", { style: { fontSize: 8, fontWeight: 500, padding: "1px 6px", borderRadius: 3, background: pc.bg, color: pc.fg } }, pct + "%")
                  );
                })
              )
            );
          })()}
        </div>
      )}

      {/* ═══════ VIEW 2: WEEKLY PRODUCTION BOARD ═══════ */}
      {viewMode === "weekly" && (
        <div onPointerMove={handleDragMove} onPointerUp={handleDragEnd}>
          <WeekNav />
          <div style={s.card}>
            <div style={{ padding: "0 0 4px" }}>
              {/* Day headers with load indicator */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, borderBottom: "2px solid #eee" }}>
                {weekDays.map(function(d, di) {
                  var work = getWorkForDay(d.date);
                  var lc = loadColor(work.length);
                  return React.createElement("div", { key: di, style: { textAlign: "center", padding: "10px 4px 8px", background: d.isToday ? "#f5f5f5" : d.isWeekend ? "#fafafa" : "transparent", borderRight: di < 6 ? "1px solid #f0f0f0" : "none" } },
                    React.createElement("div", { style: { fontSize: 11, fontWeight: d.isToday ? 600 : 400, color: d.isWeekend ? "#ccc" : "#555" } }, d.dayName),
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 500, color: d.isToday ? "#111" : d.isWeekend ? "#ddd" : "#333" } }, d.label + " " + d.month),
                    React.createElement("div", { style: { marginTop: 4, fontSize: 9, fontWeight: 500, color: lc.color, background: lc.bg, borderRadius: 10, padding: "2px 8px", display: "inline-block" } }, work.length + " items · " + lc.label)
                  );
                })}
              </div>
              {/* Day columns with work items */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, minHeight: 200 }}>
                {weekDays.map(function(d, di) {
                  var work = getWorkForDay(d.date);
                  return React.createElement("div", {
                    key: di,
                    ref: function(el) { dayColRefs.current[di] = el; },
                    style: { padding: "8px 6px", borderRight: di < 6 ? "1px solid #f0f0f0" : "none", background: dragData && dragPos ? (function() { var el = dayColRefs.current[di]; if (!el) return "transparent"; var r = el.getBoundingClientRect(); return dragPos.x >= r.left && dragPos.x <= r.right ? "rgba(0,0,0,0.04)" : "transparent"; })() : d.isToday ? "rgba(0,0,0,0.02)" : d.isWeekend ? "#fafafa" : "transparent" }
                  },
                    work.length === 0 ? React.createElement("div", { style: { textAlign: "center", padding: 16, color: "#ddd", fontSize: 11 } }, d.isWeekend ? "" : "No items") :
                    work.map(function(w, wi) {
                      var pc = pctColor(w.pct);
                      var isDragging = dragData && dragData.item.id === w.item.id && dragData.project.id === w.project.id;
                      return React.createElement("div", {
                        key: wi,
                        style: { marginBottom: 6, padding: "6px 8px", borderRadius: 6, border: isDragging ? "2px solid #111" : "1px solid #eee", background: isDragging ? "#f0f0f0" : "#fff", fontSize: 10, cursor: "grab", opacity: isDragging ? 0.4 : 1, touchAction: "none", userSelect: "none" },
                        onPointerDown: function(e) { handleDragStart(e, w.item, w.project, di); }
                      },
                        React.createElement("div", { style: { fontWeight: 500, fontSize: 11, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, w.item.desc),
                        React.createElement("div", { style: { color: "#888", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, w.project.info.project),
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                          React.createElement("span", { style: { fontSize: 9, color: "#999" } }, w.tasksDone + "/" + w.tasksActive + " tasks"),
                          React.createElement("span", { style: { fontSize: 8, fontWeight: 500, padding: "1px 6px", borderRadius: 3, background: pc.bg, color: pc.fg } }, w.pct + "%")
                        )
                      );
                    })
                  );
                })}
              </div>
            </div>
          </div>
          {/* Drag ghost */}
          {dragData && dragPos && React.createElement("div", {
            style: { position: "fixed", left: dragPos.x + 10, top: dragPos.y - 10, width: 160, padding: "6px 10px", background: "#111", color: "#fff", borderRadius: 6, fontSize: 10, fontWeight: 500, pointerEvents: "none", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }
          },
            React.createElement("div", null, dragData.item.desc),
            React.createElement("div", { style: { fontSize: 9, color: "#aaa", marginTop: 2 } }, dragData.project.info.project)
          )}
        </div>
      )}

      {/* ═══════ VIEW 3: RESOURCE WORKLOAD CARDS ═══════ */}
      {viewMode === "resource" && (function() {
        var resources = buildResourceData();
        var rNames = Object.keys(resources).sort();

        return React.createElement("div", null,
          React.createElement(WeekNav, null),
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 } },
            rNames.map(function(name) {
              var allTasks = resources[name];
              // Filter to tasks active this week
              var weekStart = weekDays[0].date;
              var weekEnd = weekDays[6].date;
              var weekTasks = allTasks.filter(function(t) {
                return t.end >= weekStart && t.start <= weekEnd;
              });
              var completeTasks = weekTasks.filter(function(t) { return t.task.status === "COMPLETE"; });
              var inProgressTasks = weekTasks.filter(function(t) { return t.task.status === "IN PROGRESS"; });
              var pendingTasks = weekTasks.filter(function(t) { return t.task.status === "PENDING"; });

              // Sort tasks by earliest start date (work top-down for priority)
              weekTasks.sort(function(a, b) { return a.start.getTime() - b.start.getTime(); });

              // Load level
              var loadLevel = weekTasks.length <= 3 ? "light" : weekTasks.length <= 6 ? "busy" : "heavy";
              var borderColor = loadLevel === "light" ? "#4caf50" : loadLevel === "busy" ? "#ff9800" : "#f44336";
              var loadLabel = loadLevel === "light" ? "Light" : loadLevel === "busy" ? "Busy" : "Heavy";
              var loadBg = loadLevel === "light" ? "#e8f5e9" : loadLevel === "busy" ? "#fff3e0" : "#ffebee";
              var loadFg = loadLevel === "light" ? "#2e7d32" : loadLevel === "busy" ? "#e65100" : "#c62828";

              // Capacity bar
              var maxCapacity = 10; // rough weekly capacity
              var capPct = Math.min(100, Math.round((weekTasks.length / maxCapacity) * 100));

              // Group tasks by project
              var byProject = {};
              weekTasks.forEach(function(t) {
                var pName = t.project.info.project;
                if (!byProject[pName]) byProject[pName] = { project: t.project, tasks: [] };
                byProject[pName].tasks.push(t);
              });

              return React.createElement("div", {
                key: name,
                style: { background: "#fff", borderRadius: 8, border: "1px solid #eee", overflow: "hidden" }
              },
                // Header
                React.createElement("div", { style: { padding: "14px 16px 10px", borderBottom: "1px solid #f0f0f0" } },
                  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 500 } }, name),
                    React.createElement("span", { style: { fontSize: 9, fontWeight: 500, padding: "2px 10px", borderRadius: 10, background: loadBg, color: loadFg } }, weekTasks.length + " tasks · " + loadLabel)
                  ),
                  // Capacity bar
                  React.createElement("div", { style: { height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" } },
                    React.createElement("div", { style: { height: "100%", width: capPct + "%", background: borderColor, borderRadius: 3, transition: "width 0.3s" } })
                  ),
                  // Stats row
                  React.createElement("div", { style: { display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#888" } },
                    React.createElement("span", null, "✓ " + completeTasks.length + " done"),
                    React.createElement("span", null, "▶ " + inProgressTasks.length + " active"),
                    React.createElement("span", null, "○ " + pendingTasks.length + " pending")
                  )
                ),
                // Task list grouped by project
                React.createElement("div", { style: { padding: "8px 16px 12px", maxHeight: 260, overflowY: "auto" } },
                  Object.keys(byProject).length === 0 ?
                    React.createElement("div", { style: { textAlign: "center", padding: 16, color: "#ccc", fontSize: 11 } }, "No tasks this week")
                  :
                  Object.keys(byProject).map(function(pName) {
                    var group = byProject[pName];
                    return React.createElement("div", { key: pName, style: { marginBottom: 8 } },
                      React.createElement("div", { style: { fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 } }, pName),
                      group.tasks.map(function(t, ti) {
                        var isDone = t.task.status === "COMPLETE";
                        var isActive = t.task.status === "IN PROGRESS";
                        return React.createElement("div", {
                          key: ti,
                          style: { display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #f8f8f8" }
                        },
                          // Status dot
                          React.createElement("div", { style: { width: 8, height: 8, borderRadius: "50%", background: isDone ? "#111" : isActive ? "#888" : "#ddd", flexShrink: 0 } }),
                          // Task info
                          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                            React.createElement("div", { style: { fontSize: 11, fontWeight: 500, textDecoration: isDone ? "line-through" : "none", color: isDone ? "#999" : "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
                              t.item.desc + " — " + t.task.label
                            )
                          ),
                          // Status badge
                          React.createElement("span", { style: { fontSize: 8, padding: "1px 6px", borderRadius: 3, background: isDone ? "#111" : isActive ? "#e8e8e8" : "#f5f5f5", color: isDone ? "#fff" : isActive ? "#444" : "#999", fontWeight: 500, flexShrink: 0, textTransform: "uppercase" } },
                            isDone ? "Done" : isActive ? "Active" : "Pending"
                          )
                        );
                      })
                    );
                  })
                )
              );
            }),
            // Empty state
            rNames.length === 0 ? React.createElement("div", { style: { gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "#ccc", fontSize: 12 } }, "No operators assigned to tasks this week") : null
          )
        );
      })()}
    </div>
  );
}
