# Graphitecture — Production Manager 3.1

AI-powered production management demo for large-format print & signage. Built to showcase Excel workflow automation with a modern web interface.

## Features

- **Executive Summary** — Portfolio KPIs, production pipeline, at-risk items across all projects
- **Project View** — Brief details, cost breakdown, progress tracking, deliverables checklist with assignees
- **Production Tracker** — Status cycling (Pending → In Progress → Printed → Finished), search & filter
- **Gantt Scheduler** — Drag-to-reschedule, resize task spans, progress visualisation across days
- **Timesheet** — Labour tracking with XLOOKUP-style rate calculations, add/remove entries
- **Costs Database** — Material rates per m², delivery costs, calculation formulas
- **Xero Export** — Simulated OAuth invoice generation with step-by-step progress
- **Project History** — Full audit trail of all changes (status, timesheet, schedule, assignments)
- **CRM** — Unified customer view with picker, account details, project aggregation, notes
- **Create Project** — Full wizard with header details and line item builder (auto-costing)

## Demo Projects

| # | Project | Customer | Items |
|---|---------|----------|-------|
| P1 | Aston Martin Valhalla | Vyra | 12 |
| P2 | Range Rover House – Milan Design Week | Jaguar Land Rover | 8 |
| P3 | Summer Window Campaign 2026 | Harrods | 6 |
| P4 | Goodwood Festival of Speed 2026 | Rolls-Royce Motor Cars | 9 |

## Login

- **Email:** `tiny.panda@tiny-panda.com`
- **Password:** any value

## Structure

```
├── index.html          # HTML shell
├── css/
│   └── styles.css      # Base styles, animations, scrollbar, components
├── js/
│   ├── data.js         # Project data, staff, materials, constants
│   ├── utils.js        # Formatting, calculations, inline styles, SVG icons
│   └── app.jsx         # All React components (Babel-compiled in browser)
└── README.md
```

## Running

Open `index.html` in a browser via a local server (e.g. `npx serve` or VS Code Live Server). Babel standalone compiles JSX in the browser — no build step required.

For GitHub Pages, push the repo and enable Pages from the main branch.

### Wix Blocks / iframe Embedding

The app is built as a fixed-height container with internal scrolling — ideal for iframe embedding. In your Wix Blocks app or custom embed:

```html
<iframe src="https://your-github-username.github.io/graphitecture-production-manager/"
  width="100%" height="900" frameborder="0"
  style="border: none; border-radius: 8px;"></iframe>
```

Set the iframe height to match the Wix section height. The app handles all scrolling internally.

### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| > 1024px | Full desktop — 5/4/2-column grids, full nav bar |
| 641–1024px | Tablet — 3/2-column grids, compact nav labels |
| ≤ 640px | Mobile — single column, hamburger menu, full-screen wizard |
| ≤ 400px | Small mobile — tighter padding, stacked brief fields |

## Tech

- React 18 (CDN)
- Babel Standalone (in-browser JSX compilation)
- DM Sans (Google Fonts)
- Zero dependencies — no npm install needed

## Calculations

Preserved from the original Excel workbook:

```
Sq m     = (Width × Height ÷ 1,000,000) × Quantity
Cost/m²  = VLOOKUP(Process, MaterialCosts, 2)
Total    = Sq m × Cost/m²
Labour   = Hours × XLOOKUP(Function, FunctionRates)
Grand    = (Materials + Labour) × 1.2 (VAT)
```

---

Built by **Tiny Panda Graphic Artists Ltd.** using Claude AI.
