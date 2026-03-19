# Verver Sport — Product Picker Wix Blocks App
## Requirements Specification & Build Prompt

---

## 1. PROJECT OVERVIEW

Build a **Wix Blocks app** for Verver Sport (`@tiny-panda/vervesport`) that replaces the existing Wix Store product pages with a custom multi-section product picker. The app uses an **HTML iFrame component** hosted on GitHub (segmented into JS/CSS/HTML files with a `build.js` compositor) that communicates with the Wix Blocks widget via the Velo `HtmlComponent` postMessage API.

The picker guides users through a 5-section progressive flow: **Collection → Type → Product → Size & Pricing → Customisation**, building an order object as they go. The final order object is passed back to the Wix page for cart integration (built separately after this app is complete).

---

## 2. ARCHITECTURE

### 2.1 Component Structure

```
┌─────────────────────────────────────────────────────┐
│  WIX SITE PAGE                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  WIX BLOCKS WIDGET                            │  │
│  │  (@tiny-panda/vervesport)                     │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  HTML iFrame Component                  │  │  │
│  │  │  (GitHub-hosted, built via build.js)    │  │  │
│  │  │                                         │  │  │
│  │  │  - Renders all UI sections              │  │  │
│  │  │  - Manages selection state              │  │  │
│  │  │  - Sends events to parent               │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  Widget Velo Code:                            │  │
│  │  - Queries databases                          │  │
│  │  - Transforms wix:image URLs                  │  │
│  │  - Handles file uploads                       │  │
│  │  - Passes data to iFrame                      │  │
│  │  - Emits events to page                       │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Page Velo Code:                                    │
│  - Receives order object from widget                │
│  - Handles add-to-cart (future phase)               │
└─────────────────────────────────────────────────────┘
```

### 2.2 GitHub Repo Structure

```
/vervesport-picker/
├── src/
│   ├── html/
│   │   └── index.html          # Shell HTML with container divs
│   ├── css/
│   │   ├── base.css            # Reset, variables, typography
│   │   ├── sections.css        # Section-specific styles
│   │   ├── components.css      # Switches, dropdowns, popups, buttons
│   │   └── layout.css          # Left/right pane flex layout
│   ├── js/
│   │   ├── app.js              # Entry point, message handler, init
│   │   ├── state.js            # OrderState class (central state management)
│   │   ├── sections/
│   │   │   ├── section1.js     # Collection picker (Football / Boxing)
│   │   │   ├── section2.js     # Type & Title picker
│   │   │   ├── section3.js     # Media gallery / colour picker
│   │   │   ├── section4.js     # Size, price, quantity
│   │   │   └── section5.js     # Customisation options
│   │   ├── components/
│   │   │   ├── sizeGuidePopup.js
│   │   │   ├── colourEffects.js
│   │   │   └── uploadButton.js
│   │   └── utils/
│   │       ├── messaging.js    # postMessage wrapper
│   │       └── helpers.js      # Format price, parse image names, etc.
├── build.js                    # Composites all files into single HTML
├── dist/
│   └── picker.html             # Built output (served to Wix)
└── README.md
```

### 2.3 Communication Protocol (postMessage)

All communication between the iFrame and Wix Blocks widget uses `window.parent.postMessage` (iFrame → Wix) and `$w("#htmlComponent").postMessage` (Wix → iFrame). Every message is a JSON object with a `type` field.

#### Wix → iFrame Messages

| type | payload | when sent |
|------|---------|-----------|
| `INIT_DATA` | `{ collections, subcategories }` | On widget load |
| `PRODUCTS_LIST` | `{ products: [{title, leadeImage, _id}] }` | After Section 1+2 selection |
| `PRODUCT_DATA` | `{ product: {title, sizeGuide, mediaGallery, leadeImage, adultImage, juniorImage} }` | After product title selected |
| `IMAGE_URLS` | `{ images: [{fileName, displayUrl}] }` | Converted mediaGallery URLs |
| `CUSTOMISATION_OPTIONS` | `{ options: {…} }` | Boxing/Football options from DB |
| `COLOUR_EFFECTS_DATA` | `{ effects: [{title, colours, prices}] }` | From colorEffects DB |
| `UPLOAD_COMPLETE` | `{ field, mediaUrl }` | After Wix completes upload |

#### iFrame → Wix Messages

| type | payload | when sent |
|------|---------|-----------|
| `SELECTION_CHANGED` | `{ section, key, value }` | Any picker change |
| `REQUEST_PRODUCTS` | `{ collection, type }` | Section 2 filters chosen |
| `REQUEST_PRODUCT_DATA` | `{ productId }` | Product title selected |
| `REQUEST_CUSTOMISATION` | `{ collection, type }` | Section 5 loads |
| `REQUEST_COLOUR_EFFECTS` | `{ effectName }` | User selects a colour effect category |
| `UPLOAD_REQUEST` | `{ field, label }` | User clicks upload button |
| `ORDER_COMPLETE` | `{ orderObject }` | User confirms / add to cart |

---

## 3. DATABASES

### 3.1 Products Database
**Collection:** `@tiny-panda/vervesport/products`

| Field | Type | Description |
|-------|------|-------------|
| `collection` | String | `"Football"` or `"Boxing"` |
| `type` | String | Subcategory: `"Match Day Kits 2026"`, `"Training Wear"`, `"Active Wear"`, `"Bespoke Fight Wear"` |
| `title` | String | Product name e.g. `"Division Kit"` |
| `leadeImage` | Image | Primary product image (wix:image URL) |
| `adultImage` | Image | Adult-specific image (optional) |
| `juniorImage` | Image | Junior-specific image (optional) |
| `sizeGuide` | JSON (text) | Array of size objects, each with measurements + `price` + `priceGroup` |
| `mediaGallery` | JSON (text) | Array of media objects with `fileName`, `src`, `slug`, `settings` |

**sizeGuide entry structure** (varies per product, but always includes):
```json
{
  "size": "MEDIUM",          // or "sizeUk" — the size key name varies
  "price": 24.00,            // per-size price (GBP)
  "priceGroup": "adult",     // "adult" or "junior"
  // ... measurement fields vary per product type
}
```

**mediaGallery entry structure:**
```json
{
  "fileName": "Division 2.0 - Blue_White.png",   // ← this IS the colour/option name
  "slug": "65ccc7_c319...~mv2.png",
  "src": "wix:image://v1/65ccc7_c319...~mv2.png/...",
  "title": "Division 2.0 - Blue_White.png",
  "type": "image",
  "settings": { "width": 1215, "height": 1215 }
}
```
> **Key insight:** The `fileName` (minus extension and product prefix) serves as the colour/variant label displayed to the user. Parse logic: strip the product name prefix and `.png` extension → e.g. `"Blue_White"`, `"Navy"`, `"Red"`.

### 3.2 Boxing Options Database
**Collection:** `@tiny-panda/vervesport/boxingOptions`

| Field | Type | Description |
|-------|------|-------------|
| `title` | String | Category key: `"Activewear"` or `"Bespoke Fightwear"` |
| `frontLogoPrice` | Number | Price for front logo printing |
| `backLogoPrice` | Number | Price for back logo printing |
| `nameFont` | JSON | Array: `[{ "fontName": "Dynamo", "price": 5.00 }, ...]` |
| `colorEffect` | JSON | Array of allowed effect category names: `["Premium Vinyl", "Metallic", ...]` |

### 3.3 Colour Effects Database
**Collection:** `@tiny-panda/vervesport/colorEffects`

| Field | Type | Description |
|-------|------|-------------|
| `title` | String | Effect category name e.g. `"Premium Vinyl"` |
| `colours` | JSON | Array of colour options: `[{ "name": "Red", "hex": "#FF0000", "price": 2.50 }, ...]` |

### 3.4 Football Options Database (PLACEHOLDER)
**Collection:** `@tiny-panda/vervesport/footballOptions`

> **Not yet defined.** Structure TBD — will follow a similar pattern to boxingOptions with `title` field matching `"Match Day Kits 2026"` or `"Training Wear"`. For now, Section 5 for Football products should render a placeholder message: *"Football customisation options coming soon."*

---

## 4. SECTION FLOW & LOGIC

### 4.1 Section Progression Rules

- Sections are **progressive** — Section N only becomes active/visible when Section N-1 is complete.
- **Changing a selection in any section resets all sections below it.** E.g., changing the collection in Section 1 clears Sections 2–5 and resets the order object for those fields.
- The user **can go back** and change any previous section at any time — the cascade reset handles data consistency.
- Each section should have a clear **active/inactive/complete** visual state.

### 4.2 Section 1 — Collection

**Purpose:** Choose the sport category.

**Options:** `Football` | `Boxing`

**Behaviour:**
- On selection, determine available subcategories:
  - Football → `["Match Day Kits 2026", "Training Wear"]`
  - Boxing → `["Active Wear", "Bespoke Fight Wear"]`
- These subcategories come from the distinct `type` values in the products DB for the chosen `collection`.
- Update `orderState.collection`.
- Reveal Section 2.

### 4.3 Section 2 — Type & Product Title

**Purpose:** Choose the subcategory, then the specific product.

**Two-step within this section:**

**Step 1 — Subcategory:**
- Display subcategory buttons/tabs from Section 1 result.
- On selection, send `REQUEST_PRODUCTS` to Wix with `{ collection, type }`.
- Wix queries products DB, returns filtered product list.
- Update `orderState.type`.

**Step 2 — Product Title:**
- Display product titles as selectable cards/list (with `leadeImage` as thumbnail).
- On selection, send `REQUEST_PRODUCT_DATA` to Wix with `{ productId }`.
- Wix returns full product data including `sizeGuide` and `mediaGallery`.
- Update `orderState.productId` and `orderState.productTitle`.
- Reveal Section 3.

### 4.4 Section 3 — Colour / Variant Selection

**Purpose:** Choose the colour/variant from the media gallery.

**Behaviour:**
- Wix converts `wix:image://` URLs from `mediaGallery` to renderable `https://static.wixstatic.com/media/` URLs before sending to iFrame.
- Display each gallery image as a selectable thumbnail.
- **Parse `fileName` to derive the display label:** strip product name prefix and `.png` extension. E.g., `"Division 2.0 - Blue_White.png"` → `"Blue / White"` (replace underscores with ` / `).
- Show parsed label below each thumbnail.
- On selection, update the **left pane display image** to the chosen variant.
- Update `orderState.variant` with `{ fileName, displayName, imageUrl }`.
- Reveal Section 4.

**Image URL Conversion (Wix Blocks code):**
```javascript
// Convert wix:image URL to renderable URL
function getImageUrl(wixImageUrl) {
  // Extract slug from: wix:image://v1/SLUG/...
  const slug = wixImageUrl.split('/')[3].split('~')[0] + '~mv2.png';
  return `https://static.wixstatic.com/media/${slug}`;
}
// Or preferably use wix-image SDK if available in Blocks context
```

### 4.5 Section 4 — Size, Price & Quantity

**Purpose:** Select size, view price, set quantity.

**Behaviour:**
- Display a **size selector** (dropdown or button group) populated from `sizeGuide` array.
- Group sizes visually by `priceGroup` (`junior` / `adult`) with clear labels.
- Show a **"View Size Guide"** button that opens a popup/modal displaying the full measurement table.
- On size selection:
  - Read `price` from the selected sizeGuide entry.
  - Display unit price.
  - Update `orderState.size`, `orderState.priceGroup`, `orderState.unitPrice`.
- **Quantity selector:** numeric input (min 1, default 1).
- **Line total:** `unitPrice × quantity`, displayed and updated live.
- Update `orderState.quantity` and `orderState.lineTotal`.
- Reveal Section 5.

**Size Guide Popup Content:**
- Table with columns derived from the sizeGuide keys (excluding `price` and `priceGroup`).
- Highlight the currently selected size row.
- Show price per size in the table.

### 4.6 Section 5 — Customisation / Printing Options

**Purpose:** Add optional printing and personalisation.

**Behaviour varies by collection:**

#### 4.6.1 Football Products (PLACEHOLDER)
- Display message: *"Football customisation options coming soon."*
- No interactive elements for now.
- `orderState.customisation = { type: "football", options: {} }` — empty placeholder.

#### 4.6.2 Boxing — Active Wear

Data source: `@tiny-panda/vervesport/boxingOptions` where `title = "Activewear"`

**Options (all toggle switches, default OFF):**

| Option | Behaviour | Price Source |
|--------|-----------|-------------|
| **Front Logo** | Switch ON → shows upload button + adds `frontLogoPrice` | `boxingOptions.frontLogoPrice` |
| **Back Logo** | Switch ON → shows upload button + adds `backLogoPrice`. **Mutually exclusive with Back Text** — enabling Back Text auto-disables Back Logo. | `boxingOptions.backLogoPrice` |
| **Back Text** | Switch ON → auto-disables Back Logo if active. Reveals sub-options below. **Mutually exclusive with Back Logo.** | Price from `nameFont` entry |
| **Sponsor** | Switch ON → shows upload button | No additional price (or TBC) |

**Back Text Sub-Options (visible only when Back Text switch is ON):**

| Sub-option | UI Element | Data Source |
|------------|------------|-------------|
| Font | Dropdown | `boxingOptions.nameFont` → show `fontName` values. Price is NOT shown in dropdown but IS added to order. |
| Type | Text input | User types their text (e.g. boxing club name). Stored in order object. |
| Colour Effect | Dropdown | `boxingOptions.colorEffect` → list of allowed effect categories. On selection, send `REQUEST_COLOUR_EFFECTS` to Wix. |
| Colour | Visual picker | Loaded from `@tiny-panda/vervesport/colorEffects` for the chosen effect. Display colour swatches with name and hex. Selection adds colour effect price. |

**Mutual Exclusion Rule — Back Logo / Back Text:**
```
IF user enables Back Text AND Back Logo is ON:
  → Auto-disable Back Logo switch
  → Remove Back Logo price from total
  → Hide Back Logo upload button

IF user enables Back Logo AND Back Text is ON:
  → Auto-disable Back Text switch
  → Collapse Back Text sub-options
  → Remove Back Text / font / colour prices from total
```

**Upload Buttons:**
- All upload buttons send `UPLOAD_REQUEST` event to Wix parent with `{ field: "frontLogo" | "backLogo" | "sponsor" }`.
- Wix handles the native upload dialog and media manager storage.
- Wix sends `UPLOAD_COMPLETE` back to iFrame with the stored media URL.
- iFrame shows upload confirmation (thumbnail or filename) next to the relevant switch.

#### 4.6.3 Boxing — Bespoke Fight Wear
Data source: `@tiny-panda/vervesport/boxingOptions` where `title = "Bespoke Fightwear"`

> Same structure as Activewear but may have different fonts, effects, and prices. The app should load options dynamically from the matching DB entry — no hardcoded differences.

**Pricing accumulation in Section 5:**
```
customisationTotal =
  (frontLogo enabled ? frontLogoPrice : 0)
  + (backLogo enabled ? backLogoPrice : 0)
  + (backText enabled ? selectedFont.price + selectedColourEffect.price : 0)
```

---

## 5. STATE MANAGEMENT — OrderState Class

The `OrderState` class is the single source of truth for all user selections. It lives in the iFrame and is serialised to JSON when sent to Wix.

```javascript
class OrderState {
  constructor() {
    this.reset();
  }

  reset() {
    // Section 1
    this.collection = null;         // "Football" | "Boxing"

    // Section 2
    this.type = null;               // "Match Day Kits 2026" | "Training Wear" | etc.
    this.productId = null;          // Wix DB item _id
    this.productTitle = null;       // "Division Kit" etc.

    // Section 3
    this.variant = null;            // { fileName, displayName, imageUrl }

    // Section 4
    this.size = null;               // "MEDIUM" etc.
    this.priceGroup = null;         // "adult" | "junior"
    this.unitPrice = 0;             // Base price from sizeGuide
    this.quantity = 1;
    this.lineTotal = 0;             // unitPrice × quantity

    // Section 5
    this.customisation = {
      type: null,                   // "football" | "boxing-activewear" | "boxing-bespoke"
      frontLogo: {
        enabled: false,
        price: 0,
        mediaUrl: null              // Set after upload
      },
      backLogo: {
        enabled: false,
        price: 0,
        mediaUrl: null
      },
      backText: {
        enabled: false,
        font: null,                 // { fontName, price }
        text: "",                   // User-entered text
        colourEffect: null,         // { effectName, price }
        colour: null                // { name, hex }
      },
      sponsor: {
        enabled: false,
        mediaUrl: null
      }
    };

    // Totals
    this.customisationTotal = 0;
    this.orderTotal = 0;            // lineTotal + customisationTotal
  }

  // Reset from a given section downward
  resetFrom(section) {
    if (section <= 1) {
      this.collection = null;
    }
    if (section <= 2) {
      this.type = null;
      this.productId = null;
      this.productTitle = null;
    }
    if (section <= 3) {
      this.variant = null;
    }
    if (section <= 4) {
      this.size = null;
      this.priceGroup = null;
      this.unitPrice = 0;
      this.quantity = 1;
      this.lineTotal = 0;
    }
    if (section <= 5) {
      this.customisation = { /* ... reset to defaults */ };
      this.customisationTotal = 0;
    }
    this.recalculate();
  }

  recalculate() {
    this.lineTotal = this.unitPrice * this.quantity;

    let custTotal = 0;
    const c = this.customisation;
    if (c.frontLogo.enabled) custTotal += c.frontLogo.price;
    if (c.backLogo.enabled) custTotal += c.backLogo.price;
    if (c.backText.enabled) {
      if (c.backText.font) custTotal += c.backText.font.price;
      if (c.backText.colourEffect) custTotal += c.backText.colourEffect.price;
    }
    this.customisationTotal = custTotal;

    // Customisation is per-unit, multiplied by quantity
    this.orderTotal = this.lineTotal + (this.customisationTotal * this.quantity);
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this));
  }
}
```

> **Note on customisation pricing:** Customisation prices (logos, text) are typically **per unit** — i.e., if someone orders 5 shirts with a front logo, they pay logo price × 5. The `recalculate()` method reflects this. **Confirm with client if any customisation options are flat-rate regardless of quantity.**

---

## 6. IMAGE HANDLING

### 6.1 The Problem
`wix:image://` URLs cannot be rendered directly in an HTML iFrame. They must be converted to public `https://` URLs.

### 6.2 Conversion Approach (Wix Blocks Widget Code)

```javascript
import { media } from 'wix-sdk';

// Preferred: Use Wix SDK media.getImageUrl()
function convertImageUrl(wixImageSrc) {
  try {
    return media.getImageUrl(wixImageSrc).url;
  } catch (e) {
    // Fallback: manual extraction
    const match = wixImageSrc.match(/wix:image:\/\/v1\/([^/]+)\//);
    if (match) {
      return `https://static.wixstatic.com/media/${match[1]}`;
    }
    return null;
  }
}
```

### 6.3 When Conversion Happens
- **On `PRODUCT_DATA` send:** Widget converts ALL `mediaGallery[].src` URLs before sending `IMAGE_URLS` to iFrame.
- **On `PRODUCT_DATA` send:** Widget converts `leadeImage`, `adultImage`, `juniorImage` URLs.
- The iFrame **never** receives `wix:image://` URLs — only renderable `https://` URLs.

---

## 7. LEFT PANE — DISPLAY IMAGE

The left pane shows the currently selected product image and updates as the user progresses:

| State | Image Shown |
|-------|-------------|
| No product selected | Empty / placeholder |
| Product selected (Section 2 complete) | `leadeImage` |
| Variant selected (Section 3 complete) | Selected mediaGallery image |
| Size selected as junior + `juniorImage` exists | Swap to `juniorImage` |
| Size selected as adult + `adultImage` exists | Swap to `adultImage` |

> **Future enhancement:** The left pane may overlay printing previews (logo placement, text preview) based on Section 5 selections. This is out of scope for the initial build but the architecture should not prevent it.

---

## 8. WIX BLOCKS WIDGET CODE — RESPONSIBILITIES

The Wix Blocks widget code (`widget.js`) handles:

1. **Initialisation:** Query distinct collections from products DB → send `INIT_DATA` to iFrame.
2. **Database queries:** On `REQUEST_PRODUCTS`, `REQUEST_PRODUCT_DATA`, `REQUEST_CUSTOMISATION`, `REQUEST_COLOUR_EFFECTS` — query the appropriate DB and return results.
3. **Image URL conversion:** Convert all `wix:image://` to `https://` before passing to iFrame.
4. **File uploads:** On `UPLOAD_REQUEST`, trigger Wix native upload flow → store in media manager → return URL via `UPLOAD_COMPLETE`.
5. **Event emission to page:** On `ORDER_COMPLETE`, emit a custom event that the hosting page code can listen for.

**Widget does NOT:**
- Handle UI rendering (that's all iFrame).
- Store state (iFrame's `OrderState` is the source of truth).
- Process payments or cart logic (that's page code, future phase).

---

## 9. PRICING SUMMARY DISPLAY

A persistent pricing summary should be visible (sticky footer or sidebar element) once the user reaches Section 4:

```
┌──────────────────────────────────────────┐
│  Division Kit — Blue / White             │
│  Size: MEDIUM (Adult)         £24.00     │
│  Qty: 3                       £72.00     │
│  ─────────────────────────────────────── │
│  Front Logo                    £5.00     │
│  Back Text (Dynamo)            £4.00     │
│  Colour: Premium Vinyl - Red   £2.50     │
│  Customisation × 3            £34.50     │
│  ─────────────────────────────────────── │
│  ORDER TOTAL                 £106.50     │
└──────────────────────────────────────────┘
```

---

## 10. OPEN QUESTIONS / CLIENT DECISIONS NEEDED

These items require client input before or during build:

| # | Question | Impact |
|---|----------|--------|
| 1 | **Football customisation options** — What printing/personalisation options exist for Match Day Kits and Training Wear? | Section 5 for Football products |
| 2 | **Customisation pricing model** — Are printing prices per-unit or flat-rate per order? | `OrderState.recalculate()` logic |
| 3 | **Sponsor logo pricing** — Is there a price for adding a sponsor logo, or is it included? | Section 5 pricing |
| 4 | **Size surcharges** — Some catalog items had size-based surcharges (e.g. 2XL+ costs more). Should the per-size pricing in sizeGuide already account for this, or is there an additional surcharge layer? | Section 4 pricing |
| 5 | **Confirm 8 unmatched product prices** — Union Kit, Premiere 2, Technical Kit, Fightnight Shirts, Competition Vests, Pro X T-shirt, Pro X Training Shorts, Pro X Tracksuit Pants currently use best-guess defaults. | Products DB accuracy |
| 6 | **Boxing options DB — actual data** — The schema is defined but the actual database entries need populating with real font names, prices, and colour effect names. | Section 5 rendering |
| 7 | **Colour effects DB — actual data** — Same as above — needs real colour swatches, hex values, and prices per effect category. | Section 5 colour picker |
| 8 | **Maximum quantity per order line** — Is there an upper limit? | Section 4 validation |

---

## 11. BUILD ORDER (SUGGESTED PHASES)

### Phase 1 — Foundation
- [ ] Set up GitHub repo structure with `build.js`
- [ ] Create `OrderState` class with reset cascade logic
- [ ] Set up postMessage communication layer (both directions)
- [ ] Build Wix Blocks widget scaffolding with DB query functions
- [ ] Implement image URL conversion utility

### Phase 2 — Sections 1–3
- [ ] Section 1: Collection picker (Football / Boxing)
- [ ] Section 2: Type filter + Product title selector with thumbnails
- [ ] Section 3: Media gallery colour picker with label parsing
- [ ] Left pane image display with update logic

### Phase 3 — Section 4
- [ ] Size selector with price group separation
- [ ] Size guide popup with full measurement table
- [ ] Quantity selector
- [ ] Live price calculation and display

### Phase 4 — Section 5 (Boxing)
- [ ] Toggle switches for Front Logo, Back Logo, Back Text, Sponsor
- [ ] Back Logo / Back Text mutual exclusion logic
- [ ] Back Text sub-options: font dropdown, text input, colour effect selector
- [ ] Colour effects loader from DB with swatch display
- [ ] Upload button → Wix delegation flow
- [ ] Pricing accumulation

### Phase 5 — Section 5 (Football) + Polish
- [ ] Implement Football customisation when client provides spec
- [ ] Pricing summary component
- [ ] Section state indicators (active/inactive/complete)
- [ ] Final order object emission to page

### Phase 6 — Cart Integration (Future)
- [ ] Page-level code to receive order object
- [ ] Wix Cart API integration
- [ ] Payment flow

---

## 12. DESIGN CONSTRAINTS & NOTES

- **Layout is flexible** — the spec defines data flow, not pixel-level design. Use the glassmorphism / dark aesthetic from previous Verver mockups as a guide.
- **The iFrame must be fully self-contained** — no external API calls from within the iFrame. All data comes via postMessage from Wix.
- **Mobile responsiveness** — the left/right pane layout should stack vertically on mobile. The iFrame handles its own responsive behaviour.
- **No hardcoded product data in the iFrame** — everything is driven by database queries through the widget.
- **The `build.js` approach is proven** — we've used this pattern before for Wix Blocks HTML component hosting.
