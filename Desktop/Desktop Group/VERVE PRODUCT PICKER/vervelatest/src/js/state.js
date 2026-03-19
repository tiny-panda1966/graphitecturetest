/**
 * state.js — OrderState class
 * Single source of truth for all user selections.
 * Supports MULTIPLE size/quantity entries (sizeEntries array).
 * Cascade resets when changing earlier sections.
 */
class OrderState {
    constructor() {
        this._listeners = [];
        this.reset();
    }

    reset() {
        // Section 1
        this.collection = null;          // "Football" | "Boxing"

        // Section 2
        this.type = null;                // "Match Day Kits 2026" | "Training Wear" | "Active Wear" | "Bespoke Fightwear"
        this.trainingType = null;        // "instock" | "bespoke" (Training Wear only)
        this.productId = null;           // Wix DB _id
        this.productTitle = null;        // "Division Kit" etc.
        this.productData = null;         // Full product object from DB

        // Section 3
        this.variant = null;             // { fileName, displayName, imageUrl }

        // Section 4 — Multi-size support
        // Each entry: { size, sizeKey, priceGroup, unitPrice, quantity }
        this.sizeEntries = [];
        this.lineTotal = 0;

        // Legacy single-size accessors (kept for backwards compat with boxing flow)
        this.size = null;
        this.sizeKey = null;
        this.priceGroup = null;
        this.unitPrice = 0;
        this.quantity = 1;

        // Section 5
        this.customisation = this._defaultCustomisation();
        this.printingOptions = {};   // { [sku]: [{min,max,price}] } — loaded when S5 opens

        // Section 6
        this.deliveryOption = null;  // 'standard' or 'express'
        this.deliveryPrice = 0;

        // Totals
        this.customisationTotal = 0;
        this.orderTotal = 0;

        this._notify();
    }

    _defaultCustomisation() {
        return {
            type: null,  // "football-matchday" | "football-training" | "boxing-activewear" | "boxing-fightwear"

            // ── Football Match Day ──
            // Prices default to 0 — populated from footballOptions DB in Section 5
            clubBadge: {
                enabled: false, type: null, position: null,
                price: 0, kitType: null, mediaUrl: null
            },
            sponsors: {
                enabled: false, price: 0,
                rightSleeve:  { enabled: false, mediaUrl: null },
                leftSleeve:   { enabled: false, mediaUrl: null },
                frontSponsor: { enabled: false, mediaUrl: null },
                backSponsor:  { enabled: false, mediaUrl: null }
            },
            backNumbers: {
                enabled: false, price: 0,
                positions: {
                    topLeftShirt:      false,
                    bottomRightShorts: false,
                    backOfShirt:       false
                },
                // Keyed by "{priceGroup}-{size}" e.g. "junior-8YRS"
                // Each value is array of numbers: [2, 3]
                assignments: {}
            },
            names: {
                enabled: false, price: 0,
                // Same key structure as backNumbers
                // Each value is array of names: ["Smith", "Jones"]
                assignments: {}
            },
            initialsPrice: 0,         // Per-item initials cost from DB
            // Global font/colour for names+numbers
            font: 'standard',        // "standard" | "exclusive"
            printColour: null,        // { name, imageUrl, hex, price } from colour effects DB

            // ── Football Training Wear ──
            numberInitial: { enabled: false, price: 0, text: '', assignments: {} },
            verveLogoColour: null,
            numberInitialColour: null,

            // ── Boxing — Activewear ──
            frontLogo:   { enabled: false, price: 0, mediaUrl: null },
            backLogo:    { enabled: false, price: 0, mediaUrl: null },
            backBadgeMode: 'badge',  // 'badge' or 'text'
            clubBadgeFront: { enabled: false },
            clubBadgeBack: { enabled: false },
            backBadge:   { enabled: false, mediaUrl: null },
            backText:    { enabled: false, font: null, text: '', colourEffect: null, colour: null },
            sponsor:     { enabled: false, mediaUrl: null },

            // ── Boxing — Fightwear ──
            name:          { enabled: false, font: null, text: '', colourEffect: null, colour: null, surnameAssignments: {} },
            frontSponsors: { enabled: false, count: 0, positions: [], printing: 'standard', mediaUrls: [] },
            fwSponsors:    { enabled: false, positions: [], logoColour: 'standard', colourTone: null },

            // ── Socks (Football Match Day only) ──
            socks: {
                enabled: false,       // false = No Sock selected
                sockType: null,       // { _id, title, leadeImage } — the sock category
                sockVariant: null,    // { fileName, displayName, imageUrl } — chosen colour/style
                price: 0
            },
            frontSponsor:  { enabled: false, sleeve: false, mediaUrl: null },
            backSponsor:   { enabled: false, mediaUrl: null },
            sleeveSponsor: { enabled: false, mediaUrl: null },
            numbers:       { enabled: false, style: 'standard', names: {} },
            colourSelections: {}
        };
    }

    /**
     * Store printing options lookup from newPrinting DB.
     * Called by Section5 when CUSTOMISATION_OPTIONS is received.
     * @param {Array} options — [{ sku, title, sizeGuide, tiers }]
     */
    setPrintingOptions(options) {
        this.printingOptions = {};
        (options || []).forEach(opt => {
            if (opt.sku) this.printingOptions[opt.sku] = opt.tiers || [];
        });
        this.recalculate();
        this._notify();
    }

    /**
     * Get unit price for a SKU at the given total quantity.
     * Uses getTierPrice helper from Helpers.
     */
    getSkuPrice(sku, qty) {
        const tiers = this.printingOptions[sku];
        if (!tiers || !tiers.length) return 0;
        return Helpers.getTierPrice(tiers, qty) || 0;
    }

    // ═══════════════════════════════════════════════════════
    // MULTI-SIZE ENTRY MANAGEMENT
    // ═══════════════════════════════════════════════════════

    /**
     * Add or update a size entry.
     * If size already exists, updates the quantity.
     */
    addSizeEntry(size, sizeKey, priceGroup, unitPrice, quantity, taxGroupId, sku) {
        const existingIdx = this.sizeEntries.findIndex(
            e => e.size === size && e.priceGroup === priceGroup
        );
        if (existingIdx >= 0) {
            this.sizeEntries[existingIdx].quantity = quantity;
        } else {
            this.sizeEntries.push({ size, sizeKey, priceGroup, unitPrice, quantity, taxGroupId: taxGroupId || null, sku: sku || null });
        }

        // Update legacy single-size fields to last-selected
        this.size = size;
        this.sizeKey = sizeKey;
        this.priceGroup = priceGroup;
        this.unitPrice = unitPrice;
        this.quantity = quantity;

        this._syncNumberNameAssignments();
        this.recalculate();
        this._notify();
    }

    /**
     * Update quantity for a specific size entry.
     * Returns false if entry not found.
     */
    updateSizeEntryQuantity(size, priceGroup, newQuantity) {
        const entry = this.sizeEntries.find(
            e => e.size === size && e.priceGroup === priceGroup
        );
        if (!entry) return false;

        if (newQuantity <= 0) {
            this.removeSizeEntry(size, priceGroup);
            return true;
        }

        entry.quantity = newQuantity;
        this._syncNumberNameAssignments();
        this.recalculate();
        this._notify();
        return true;
    }

    /**
     * Remove a size entry entirely.
     */
    removeSizeEntry(size, priceGroup) {
        this.sizeEntries = this.sizeEntries.filter(
            e => !(e.size === size && e.priceGroup === priceGroup)
        );
        this._syncNumberNameAssignments();
        this.recalculate();
        this._notify();
    }

    /**
     * Get total quantity across all size entries.
     */
    getTotalQuantity() {
        return this.sizeEntries.reduce((sum, e) => sum + e.quantity, 0);
    }

    /**
     * Get a unique key for a size entry (used as map key for names/numbers).
     */
    static sizeKey(entry) {
        return `${entry.priceGroup}-${entry.size}`;
    }

    /**
     * Sync number/name assignment arrays with current size entries.
     * Auto-populates default numbers starting from 2.
     * Trims/extends arrays when quantity changes.
     */
    _syncNumberNameAssignments() {
        const nums = this.customisation.backNumbers.assignments;
        const names = this.customisation.names.assignments;

        // Build set of valid keys
        const validKeys = new Set();

        this.sizeEntries.forEach(entry => {
            const key = OrderState.sizeKey(entry);
            validKeys.add(key);

            // Numbers: ensure array exists with correct length, auto-fill from 2
            if (!nums[key]) {
                nums[key] = this._generateDefaultNumbers(entry.quantity);
            } else if (nums[key].length < entry.quantity) {
                // Extend with next sequential numbers
                const lastNum = nums[key].length > 0
                    ? Math.max(...nums[key].map(n => parseInt(n) || 0))
                    : 1;
                while (nums[key].length < entry.quantity) {
                    nums[key].push(lastNum + (nums[key].length - (nums[key].length - 1)) + nums[key].length);
                }
                // Re-generate cleanly
                nums[key] = this._generateDefaultNumbers(entry.quantity, nums[key]);
            } else if (nums[key].length > entry.quantity) {
                nums[key] = nums[key].slice(0, entry.quantity);
            }

            // Names: ensure array exists with correct length
            if (!names[key]) {
                names[key] = Array(entry.quantity).fill('');
            } else if (names[key].length < entry.quantity) {
                while (names[key].length < entry.quantity) {
                    names[key].push('');
                }
            } else if (names[key].length > entry.quantity) {
                names[key] = names[key].slice(0, entry.quantity);
            }
        });

        // Remove keys for sizes no longer in entries
        Object.keys(nums).forEach(k => { if (!validKeys.has(k)) delete nums[k]; });
        Object.keys(names).forEach(k => { if (!validKeys.has(k)) delete names[k]; });
    }

    /**
     * Generate default shirt numbers starting from 2.
     * If existing array provided, preserves user-entered values.
     */
    _generateDefaultNumbers(quantity, existing) {
        if (existing && existing.length >= quantity) {
            return existing.slice(0, quantity);
        }
        const result = [];
        for (let i = 0; i < quantity; i++) {
            if (existing && existing[i] !== undefined) {
                result.push(existing[i]);
            } else {
                result.push(i + 2); // Start from 2
            }
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════
    // RESET
    // ═══════════════════════════════════════════════════════

    /**
     * Reset from a given section downward (inclusive).
     * E.g. resetFrom(2) clears sections 2, 3, 4, 5.
     */
    resetFrom(section) {
        if (section <= 1) {
            this.collection = null;
            document.getElementById('appContainer')?.removeAttribute('data-sport');
        }
        if (section <= 2) {
            this.type = null;
            this.trainingType = null;
            this.productId = null;
            this.productTitle = null;
            this.productData = null;
        }
        if (section <= 3) {
            this.variant = null;
        }
        if (section <= 4) {
            this.sizeEntries = [];
            this.size = null;
            this.sizeKey = null;
            this.priceGroup = null;
            this.unitPrice = 0;
            this.quantity = 1;
            this.lineTotal = 0;
        }
        if (section <= 5) {
            this.customisation = this._defaultCustomisation();
            this.printingOptions = {};
            this.customisationTotal = 0;
        }
        this.recalculate();
        this._notify();
    }

    // ═══════════════════════════════════════════════════════
    // PRICING
    // ═══════════════════════════════════════════════════════

    /** Recalculate all totals */
    recalculate() {
        // ── Tier-based pricing: update unitPrice per group from productData.rows ──
        if (this.productData?.rows?.length) {
            ['adult', 'junior'].forEach(group => {
                const row = this.productData.rows.find(r => r.group === group);
                if (!row || !row.tiers || !row.tiers.length) return;
                const groupEntries = this.sizeEntries.filter(e => e.priceGroup === group);
                const groupQty = groupEntries.reduce((sum, e) => sum + e.quantity, 0);
                const tierPrice = Helpers.getTierPrice(row.tiers, groupQty);
                groupEntries.forEach(e => { e.unitPrice = tierPrice; });
            });
        }

        // Line total from all size entries
        this.lineTotal = this.sizeEntries.reduce(
            (sum, e) => sum + (e.unitPrice * e.quantity), 0
        );

        // Total quantity
        const totalQty = this.getTotalQuantity();

        // Customisation total — SKU-based tier pricing from newPrinting DB
        let custPerUnit = 0;
        this.customisationTotal = 0;
        const c = this.customisation;
        const qty = totalQty || this.quantity;

        // ── Colour effect surcharge (shared, hardcoded £2.50 for Reflective/Glitter/Exclusive) ──
        if (c.printColour && c.printColour.price) custPerUnit += c.printColour.price;

        // ── Football Match Day ─────────────────────────────────────────────
        if (c.type === 'football-matchday') {
            const font = c.font || 'standard';   // "standard" | "exclusive"

            // Club Badge — 1 badge (PF-001A) or 2 badges per garment (PF-001B)
            if (c.clubBadge.enabled) {
                const badgeSku = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
                custPerUnit += this.getSkuPrice(badgeSku, qty);
                // One-off badge creation/redesign surcharge (not per-unit, added flat)
                if (c.clubBadge.badgeSurcharge) {
                    this.customisationTotal += c.clubBadge.badgeSurcharge;
                }
            }

            // Sponsors — each enabled position is a separate print
            if (c.sponsors.enabled) {
                const sponsorPositions = [
                    { key: 'frontSponsor', sku: 'PF-002' },
                    { key: 'backSponsor',  sku: 'PF-003' },
                    { key: 'rightSleeve',  sku: 'PF-011' },
                    { key: 'leftSleeve',   sku: 'PF-012' }
                ];
                sponsorPositions.forEach(({ key, sku }) => {
                    if (c.sponsors[key]?.enabled) {
                        custPerUnit += this.getSkuPrice(sku, qty);
                    }
                });
            }

            // Back Numbers — back-of-shirt and shorts use font-aware SKUs; top-left is PF-008
            if (c.backNumbers.enabled) {
                const p = c.backNumbers.positions || {};
                if (p.backOfShirt)       custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-005' : 'PF-004', qty);
                if (p.bottomRightShorts) custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-007' : 'PF-006', qty);
                if (p.topLeftShirt)      custPerUnit += this.getSkuPrice('PF-008', qty);
            }

            // Names — font-aware SKU
            if (c.names.enabled) {
                custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-010' : 'PF-009', qty);
            }
        }

        // ── Football Training Wear ─────────────────────────────────────────
        if (c.type === 'football-training') {
            const font = c.font || 'standard';

            // numberInitial maps to PF-008 (top-left / initials — no font variant)
            if (c.numberInitial?.enabled) {
                custPerUnit += this.getSkuPrice('PF-008', qty);
            }

            // Names on training (use same font-aware SKUs as match day)
            if (c.names?.enabled) {
                custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-010' : 'PF-009', qty);
            }

            // Training colour surcharges (hardcoded — not in newPrinting)
            if (c.verveLogoColour?.price)      custPerUnit += c.verveLogoColour.price;
            if (c.numberInitialColour?.price)  custPerUnit += c.numberInitialColour.price;
        }

        // ── Boxing Activewear ──────────────────────────────────────────────
        if (c.type === 'boxing-activewear') {
            // Front club badge — PB-005
            if (c.clubBadgeFront?.enabled || c.clubBadgeBack?.enabled) {
                custPerUnit += this.getSkuPrice('PB-005', qty);
            }

            // Back — badge mode uses PB-005; text mode uses PB-001
            if (c.backBadge?.enabled) {
                custPerUnit += this.getSkuPrice('PB-005', qty);
            }
            if (c.backText?.enabled) {
                custPerUnit += this.getSkuPrice('PB-001', qty);
                if (c.backText.effectSurcharge) custPerUnit += c.backText.effectSurcharge;
            }

            // Sponsor — PB-002
            if (c.sponsor?.enabled) {
                custPerUnit += this.getSkuPrice('PB-002', qty);
            }
        }

        // ── Boxing Fightwear ───────────────────────────────────────────────
        if (c.type === 'boxing-fightwear') {
            // Name — PB-001 (team name)
            if (c.name?.enabled) {
                custPerUnit += this.getSkuPrice('PB-001', qty);
                if (c.name.effectSurcharge) custPerUnit += c.name.effectSurcharge;
            }

            // Front/back sponsors — PB-002 per enabled position
            if (c.frontSponsors?.enabled) {
                const posCount = (c.frontSponsors.positions || []).filter(Boolean).length || c.frontSponsors.count || 0;
                if (posCount > 0) custPerUnit += this.getSkuPrice('PB-002', qty) * posCount;
            }
            if (c.fwSponsors?.enabled) {
                const posCount = (c.fwSponsors.positions || []).filter(p => p?.enabled).length || 0;
                if (posCount > 0) custPerUnit += this.getSkuPrice('PB-002', qty) * posCount;
            }

            // Sleeve prints — PB-003 right, PB-004 left
            if (c.sleeveSponsor?.enabled) custPerUnit += this.getSkuPrice('PB-003', qty);
        }

        // ── Socks (Match Day only — price stored on sock variant, not in newPrinting) ──
        if (c.socks?.enabled && c.socks.price) custPerUnit += c.socks.price;

        this.customisationTotal += custPerUnit * (totalQty || this.quantity);
        this.orderTotal = this.lineTotal + this.customisationTotal + this.deliveryPrice;

        this._notify();
    }

    /** Subscribe to state changes */
    onChange(listener) {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter(l => l !== listener);
        };
    }

    _notify() {
        this._listeners.forEach(l => {
            try { l(this); } catch (e) { console.error('State listener error:', e); }
        });
    }

    /** Determine which customisation type to use based on collection + type */
    getCustomisationType() {
        if (!this.collection || !this.type) return null;
        if (this.collection === 'Football') {
            // type may be 'Match Day Kits 2026', 'Match-Day Kits 2026', 'Match Day Socks', or 'Training Wear'
            return (this.type === 'Training Wear') ? 'football-training' : 'football-matchday';
        }
        if (this.collection === 'Boxing') {
            return this.type === 'Active Wear' ? 'boxing-activewear' : 'boxing-fightwear'; // "Bespoke Fightwear"
        }
        return null;
    }

    /** Export as plain object for sending to Wix */
    toJSON() {
        // Build lineItems split by taxGroupId for cart (adult and junior separately)
        const lineItemGroups = {};
        this.sizeEntries.forEach(e => {
            const key = e.taxGroupId || 'default';
            if (!lineItemGroups[key]) lineItemGroups[key] = { taxGroupId: e.taxGroupId, priceGroup: e.priceGroup, entries: [] };
            lineItemGroups[key].entries.push(e);
        });
        const lineItems = Object.values(lineItemGroups).map(g => ({
            taxGroupId: g.taxGroupId,
            priceGroup: g.priceGroup,
            entries: g.entries,
            subtotal: g.entries.reduce((s, e) => s + e.unitPrice * e.quantity, 0),
            totalQuantity: g.entries.reduce((s, e) => s + e.quantity, 0)
        }));

        return JSON.parse(JSON.stringify({
            collection: this.collection,
            type: this.type,
            productId: this.productId,
            productTitle: this.productTitle,
            productSku: this.productData?.sku || null,
            variant: this.variant,
            sizeEntries: this.sizeEntries,
            lineItems,
            size: this.size,
            priceGroup: this.priceGroup,
            unitPrice: this.unitPrice,
            quantity: this.getTotalQuantity(),
            lineTotal: this.lineTotal,
            customisation: this.customisation,
            customisationTotal: this.customisationTotal,
            deliveryPrice: this.deliveryPrice,
            deliveryOption: this.deliveryOption,
            orderTotal: this.orderTotal
        }));
    }
}

// Global singleton
const orderState = new OrderState();


