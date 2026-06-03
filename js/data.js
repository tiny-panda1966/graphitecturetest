/**
 * Graphitecture Production Manager — Data
 * All project data, staff lists, material costs, and configuration constants.
 */

var LOGO_URL = "https://static.wixstatic.com/shapes/65ccc7_96ce49b7af7543058de0f4269639ed8d.svg";

// ── Cloudflare Worker / R2 Storage ──
// Credentials moved to Wix Secrets Manager (WORKER_URL, WORKER_AUTH)
// All worker operations go through DB.workerRequest/DB.workerUpload/DB.workerDownload
var DEFAULT_PROJECT_FOLDERS = ["01-Print Ready Artwork", "02-Completion Photographs"];

// Generate a safe R2 folder key from customer + project name
function makeProjectFolder(customer, project) {
  var raw = (customer || "Unknown") + "-" + (project || "Untitled");
  // Replace unsafe chars, collapse spaces/hyphens
  return raw
    .replace(/[\/\\'"<>|:*?]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Staff & Rates ──
var STAFF = [
  { name: "Andrew C", rate: 30 },
  { name: "Dima", rate: 30 },
  { name: "George C", rate: 20 },
  { name: "Harry", rate: 20 },
  { name: "Laimis", rate: 30 },
  { name: "Tomas", rate: 30 },
  { name: "Edvinas", rate: 30 },
  { name: "Elia", rate: 25 },
  { name: "Mark R", rate: 25 },
  { name: "Darren H", rate: 25 },
  { name: "Alius", rate: 25 },
  { name: "Chris C", rate: 25 },
  { name: "Kerry G", rate: 25 },
  { name: "Keiran", rate: 25 }
];

var FUNCTIONS = [
  { fn: "Artworking", rate: 35 },
  { fn: "Print", rate: 30 },
  { fn: "Laminating", rate: 25 },
  { fn: "Mounting", rate: 25 },
  { fn: "Cutting", rate: 30 },
  { fn: "Kiss Cutting", rate: 30 },
  { fn: "Weed and App Tape", rate: 25 },
  { fn: "Hand Assembly", rate: 25 },
  { fn: "Framework Construction", rate: 35 },
  { fn: "Timber Construction", rate: 35 },
  { fn: "Installation", rate: 27.50 },
  { fn: "Delivering / Collection", rate: 20 }
];

// ── Material Costs ──
var MATERIAL_COSTS = [
  { name: "Removable vinyl 8700 with seal", cost: 36 },
  { name: "Permanent vinyl with seal", cost: 36 },
  { name: "Super sticky vinyl with seal", cost: 40 },
  { name: "Black back Fabric", cost: 20 },
  { name: "Dilite/ACM face mounted with seal", cost: 52 },
  { name: "Contravision 70/30", cost: 40 },
  { name: "5mm Foamex – face mounted", cost: 45 },
  { name: "5mm Foamex – wrap mounted", cost: 50 },
  { name: "10mm Foamex – face mounted", cost: 55 },
  { name: "Stock vinyl kiss cut logo", cost: 25 },
  { name: "WW300 kiss cut logo", cost: 39 }
];

// ── Auto-assign rules (process keyword → default staff) ──
var ASSIGN_MAP = {
  "Permanent vinyl": "Dima",
  "Removable vinyl": "Dima",
  "Super sticky": "Laimis",
  "Kiss cut": "Tomas",
  "Black back": "Edvinas",
  "Contravision": "Laimis",
  "Foamex": "Mark R",
  "ACM": "Mark R"
};

function autoAssign(process) {
  for (const [k, v] of Object.entries(ASSIGN_MAP)) {
    if (process.includes(k)) return v;
  }
  return STAFF[0].name;
}

// ═══════════════════════════════════════════════════════════════
// TASK-LEVEL PRODUCTION MODEL
// ═══════════════════════════════════════════════════════════════

// Standard production tasks — the master list
var PRODUCTION_TASKS = [
  { id: "artwork",       label: "Artwork"       },
  { id: "print",         label: "Print"         },
  { id: "lamination",    label: "Lamination"    },
  { id: "cutting",       label: "Cutting"       },
  { id: "weed_apply",    label: "Weed & Apply"  },
  { id: "hand_assembly", label: "Hand Assembly" },
  { id: "packing",       label: "Packing"       }
];

// Which tasks apply to each process type (configurable per material/process)
var PROCESS_TASK_MAP = {
  "Removable vinyl 8700 with seal":  ["artwork", "print", "lamination", "cutting", "weed_apply", "packing"],
  "Permanent vinyl with seal":       ["artwork", "print", "lamination", "cutting", "weed_apply", "packing"],
  "Super sticky vinyl with seal":    ["artwork", "print", "lamination", "cutting", "weed_apply", "packing"],
  "Black back Fabric":               ["artwork", "print", "cutting", "hand_assembly", "packing"],
  "Dilite/ACM face mounted with seal": ["artwork", "print", "lamination", "cutting", "hand_assembly", "packing"],
  "Contravision 70/30":              ["artwork", "print", "lamination", "cutting", "packing"],
  "5mm Foamex – face mounted":       ["artwork", "print", "lamination", "cutting", "hand_assembly", "packing"],
  "5mm Foamex – wrap mounted":       ["artwork", "print", "lamination", "cutting", "hand_assembly", "packing"],
  "10mm Foamex – face mounted":      ["artwork", "print", "lamination", "cutting", "hand_assembly", "packing"],
  "Stock vinyl kiss cut logo":       ["artwork", "print", "cutting", "weed_apply", "packing"],
  "WW300 kiss cut logo":             ["artwork", "print", "cutting", "weed_apply", "packing"]
};

// Default fallback task list if process not mapped
var DEFAULT_TASKS = ["artwork", "print", "lamination", "cutting", "packing"];

// Task ID → Function name (for timesheet auto-population)
var TASK_FUNCTION_MAP = {
  "artwork": "Artworking",
  "print": "Print",
  "lamination": "Laminating",
  "cutting": "Cutting",
  "weed_apply": "Weed and App Tape",
  "hand_assembly": "Hand Assembly",
  "packing": "Hand Assembly",
  "kiss_cut": "Kiss Cutting"
};

// Default task assignee mapping (task type → preferred operator)
var TASK_ASSIGN_DEFAULTS = {
  "artwork":       "Elia",
  "print":         "Dima",
  "lamination":    "Tomas",
  "cutting":       "Laimis",
  "weed_apply":    "Tomas",
  "hand_assembly": "Edvinas",
  "packing":       "George C"
};

// Task statuses
var TASK_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN PROGRESS",
  COMPLETE: "COMPLETE",
  SKIPPED: "SKIPPED"
};

// Available printers (Mark to update with actual machines)
var PRINTERS = [
  "Mimaki 3200",
  "Mimaki UV1 1600",
  "Mimaki Solvent 1600",
  "Canon Colorado",
  "Graphtec Plotter",
  "Summa Plotter",
  "Install"
];

// Generate tasks array for a line item based on its process
function generateTasks(item) {
  var taskIds = PROCESS_TASK_MAP[item.process] || DEFAULT_TASKS;
  return taskIds.map(function(taskId) {
    var taskDef = PRODUCTION_TASKS.find(function(t) { return t.id === taskId; });
    return {
      id: taskId,
      label: taskDef ? taskDef.label : taskId,
      status: TASK_STATUS.PENDING,
      assignee: TASK_ASSIGN_DEFAULTS[taskId] || STAFF[0].name,
      timeSpent: 0,           // minutes — logged on status change
      materialExpected: item.sqm,  // pre-populated from line item
      materialUsed: 0,        // actual — operator adjusts
      materialType: item.process,  // can be changed by operator
      packages: 0             // only used for packing step
    };
  });
}

// Calculate overall item status from its tasks
function calcItemStatus(tasks) {
  if (!tasks || tasks.length === 0) return "PENDING";
  var active = tasks.filter(function(t) { return t.status !== TASK_STATUS.SKIPPED; });
  if (active.length === 0) return "FINISHED";
  var allComplete = active.every(function(t) { return t.status === TASK_STATUS.COMPLETE; });
  if (allComplete) return "FINISHED";
  var anyInProgress = active.some(function(t) { return t.status === TASK_STATUS.IN_PROGRESS; });
  var anyComplete = active.some(function(t) { return t.status === TASK_STATUS.COMPLETE; });
  if (anyInProgress || anyComplete) return "IN PROGRESS";
  return "PENDING";
}

// Get the next actionable task for a line item
function getNextTask(tasks) {
  if (!tasks) return null;
  return tasks.find(function(t) { return t.status !== TASK_STATUS.COMPLETE && t.status !== TASK_STATUS.SKIPPED; }) || null;
}

// ── Projects (loaded from database in live mode) ──
var ALL_PROJECTS = [];

