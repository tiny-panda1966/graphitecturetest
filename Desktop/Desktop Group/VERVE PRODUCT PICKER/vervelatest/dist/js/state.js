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
        this.sizeEntries = [];
        this.lineTotal = 0;

        // Legacy single-size accessors
        this.size = null;
        this.sizeKey = null;
        this.priceGroup = null;
        this.unitPrice = 0;
        this.quantity = 1;

        // Section 5
        this.customisation = this._defaultCustomisation();
        this.printingOptions = {};   

        // Section 6
        this.deliveryOption = null;  
        this.deliveryPrice = 0;

        // Totals
        this.customisationTotal = 0;
        this.customisationVat = 0; // NEW: Track VAT separately
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
            frontSponsor:       { enabled: false, sleeve: false, mediaUrl: null },
            rightSleeveSponsor: { enabled: false, mediaUrl: null },
            leftSleeveSponsor:  { enabled: false, mediaUrl: null },
            backSponsor:        { enabled: false, mediaUrl: null },
            sleeveSponsor:      { enabled: false, mediaUrl: null },
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

        // ── Colour effect surcharge ──
        // Guard: cap at £5 — garment prices should never leak in here
        if (c.printColour && c.printColour.price && c.printColour.price <= 5) custPerUnit += c.printColour.price;

        // ── Football Match Day ──
        if (c.type === 'football-matchday') {
            const font = c.font || 'standard';
            if (c.clubBadge.enabled) {
                const badgeSku = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
                custPerUnit += this.getSkuPrice(badgeSku, qty);
                if (c.clubBadge.badgeSurcharge) this.customisationTotal += c.clubBadge.badgeSurcharge;
            }
            if (c.sponsors.enabled) {
                const sponsorPositions = [
                    { key: 'frontSponsor', sku: 'PF-002' },
                    { key: 'backSponsor',  sku: 'PF-003' },
                    { key: 'rightSleeve',  sku: 'PF-011' },
                    { key: 'leftSleeve',   sku: 'PF-012' }
                ];
                sponsorPositions.forEach(({ key, sku }) => {
                    if (c.sponsors[key]?.enabled) custPerUnit += this.getSkuPrice(sku, qty);
                });
            }
            if (c.backNumbers.enabled) {
                const p = c.backNumbers.positions || {};
                if (p.backOfShirt)       custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-005' : 'PF-004', qty);
                if (p.bottomRightShorts) custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-007' : 'PF-006', qty);
                if (p.topLeftShirt)      custPerUnit += this.getSkuPrice('PF-008', qty);
            }
            if (c.names.enabled) {
                custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-010' : 'PF-009', qty);
            }
        }

        // ── Football Training Wear ──
        if (c.type === 'football-training') {
            const font = c.font || 'standard';
            if (c.clubBadge?.enabled) {
                const badgeSku = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
                custPerUnit += this.getSkuPrice(badgeSku, qty);
            }
            if (c.numberInitial?.enabled)       custPerUnit += this.getSkuPrice('PF-008', qty);
            if (c.names?.enabled)               custPerUnit += this.getSkuPrice(font === 'exclusive' ? 'PF-010' : 'PF-009', qty);
            if (c.rightSleeveSponsor?.enabled)  custPerUnit += this.getSkuPrice('PF-011', qty);
            if (c.leftSleeveSponsor?.enabled)   custPerUnit += this.getSkuPrice('PF-012', qty);
            if (c.backSponsor?.enabled)         custPerUnit += this.getSkuPrice('PF-003', qty);
            // Guard: cap at £5 — colour effect prices from DB may contain garment prices
            if (c.verveLogoColour?.price && c.verveLogoColour.price <= 5) custPerUnit += c.verveLogoColour.price;
            if (c.numberInitialColour?.price && c.numberInitialColour.price <= 5) custPerUnit += c.numberInitialColour.price;
        }

        // ── Boxing Activewear ──
        if (c.type === 'boxing-activewear') {
            // Front club badge
            if (c.clubBadge?.enabled) custPerUnit += this.getSkuPrice('PB-005', qty);
            // Back option — only one of badge / sponsor / text is active
            const backMode = c.backBadgeMode || 'badge';
            if (backMode === 'badge'   && c.backBadge?.enabled)   custPerUnit += this.getSkuPrice('PB-005', qty);
            if (backMode === 'sponsor' && c.backSponsor?.enabled) custPerUnit += this.getSkuPrice('PB-002', qty);
            if (backMode === 'text'    && c.backText?.enabled) {
                custPerUnit += this.getSkuPrice('PB-001', qty);
                if (c.backText.effectSurcharge) custPerUnit += c.backText.effectSurcharge;
            }
            // Front sponsor logo
            if (c.sponsor?.enabled) custPerUnit += this.getSkuPrice('PB-002', qty);
        }

        // ── Boxing Fightwear ──
        if (c.type === 'boxing-fightwear') {
            if (c.name?.enabled) {
                custPerUnit += this.getSkuPrice('PB-001', qty);
                // Colour effect surcharge is per-item
                if (c.name.effectSurcharge) custPerUnit += c.name.effectSurcharge;
            }
            // Sponsors: priced per position (not per garment) — add flat to customisationTotal directly
            if (c.fwSponsors?.enabled) {
                const positions = (c.fwSponsors.positions || []).filter(Boolean);
                if (positions.length > 0) {
                    const sponsorUnitPrice = this.getSkuPrice('PB-002', qty);
                    // Each position costs sponsorUnitPrice once (not × garment qty)
                    this.customisationTotal += sponsorUnitPrice * positions.length;
                }
            }
            if (c.sleeveSponsor?.enabled) custPerUnit += this.getSkuPrice('PB-003', qty);
        }


        this.customisationTotal += custPerUnit * (totalQty || this.quantity);

        // VAT only on adult portion — junior clothing/customisation is zero-rated (UK VAT)
        const adultQty   = this.sizeEntries.filter(e => e.priceGroup !== 'junior').reduce((s, e) => s + e.quantity, 0);
        const adultRatio = totalQty > 0 ? adultQty / totalQty : 1;
        this.customisationVat = this.customisationTotal * adultRatio * 0.20;

        // ── SOCKS (Calculated Separately) ──
        this.socksTotal = 0;
        this.socksVat = 0;
        // NEW: Create objects to hold the exact SKU and Price for the backend
        c.socks.groupPrices = { adult: 0, junior: 0 };
        c.socks.groupSkus = { adult: '', junior: '' };

        if (c.socks?.enabled && c.socks.sockType) {
            this.sizeEntries.forEach(e => {
                let sockPrice = 0; 
                let sockSku = c.socks.sockType.sku || '';

                if (c.socks.sockType.rows) {
                    // Find the exact row (Adult or Junior) for the socks
                    const row = c.socks.sockType.rows.find(r => r.group === e.priceGroup) || c.socks.sockType.rows[0];
                    if (row) {
                        if (row.sku) sockSku = row.sku; // Grab the exact SKU from the database row!
                        if (row.tiers) {
                            const groupQty = this.sizeEntries.filter(se => se.priceGroup === e.priceGroup).reduce((s, se) => s + se.quantity, 0);
                            sockPrice = Helpers.getTierPrice(row.tiers, groupQty) || 0;
                        }
                    }
                } else if (c.socks.price) {
                    sockPrice = c.socks.price; 
                }

                // Save the exact price and SKU for the Wix cart payload
                c.socks.groupPrices[e.priceGroup] = sockPrice;
                c.socks.groupSkus[e.priceGroup] = sockSku;
                
                const entryTotal = sockPrice * e.quantity;
                this.socksTotal += entryTotal;
                if (e.priceGroup !== 'junior') {
                    this.socksVat += entryTotal * 0.20;
                }
            });
        }
        
        // Add Customisation VAT to Order Total
        this.orderTotal = this.lineTotal + this.customisationTotal + this.customisationVat + this.socksTotal + this.socksVat + this.deliveryPrice;

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

    /**
     * Build an array of individual customisation line items for the cart.
     * Each entry with a SKU becomes its own cart line item.
     * No-SKU details (font, colour, names text) are folded into the
     * description of their parent line item.
     *
     * Returns: [{ sku, label, unitPrice, qty, subtotal, description }]
     */
    _buildCustomisationItems() {
        const c   = this.customisation;
        const qty = this.getTotalQuantity() || this.quantity || 1;
        const items = [];
        const fmt = (p) => `£${Number(p).toFixed(2)}`;

        const add = (sku, label, desc = '') => {
            const unitPrice = this.getSkuPrice(sku, qty);
            if (unitPrice <= 0) return; // skip if price not loaded yet
            items.push({ sku, label, unitPrice, qty, subtotal: unitPrice * qty, description: desc });
        };

        /**
         * Build a per-size assignment description string.
         * assignments = { "adult-M": ["Smith","Jones"], "junior-8Yr": ["Ali"] }
         * playerLabel = "Player" | "Fighter"
         * Returns multi-line string:
         *   Adult M ×2: Smith (P1), Jones (P2)
         *   Junior 8Yr ×1: Ali (P1)
         */
        const buildAssignmentDesc = (assignments, playerLabel = 'P') => {
            if (!assignments || !this.sizeEntries.length) return '';
            const lines = [];
            this.sizeEntries.forEach(e => {
                const k  = OrderState.sizeKey(e);
                const gl = e.priceGroup === 'junior' ? 'Junior' : 'Adult';
                const a  = assignments[k] || [];
                const filled = a.map((v, i) => v ? `${v} (${playerLabel}${i + 1})` : null).filter(Boolean);
                if (filled.length) lines.push(`${gl} ${e.size} ×${e.quantity}: ${filled.join(', ')}`);
            });
            return lines.join('\n');
        };

        // ── Football Match Day ──
        if (c.type === 'football-matchday') {
            const font = c.font || 'standard';
            const fontLabel = font === 'exclusive' ? 'Exclusive Font' : 'Standard Font';
            const colourNote = c.printColour?.name ? ` · Colour: ${c.printColour.name}` : '';

            if (c.clubBadge?.enabled) {
                const sku      = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
                const coverage = c.clubBadge.kitType === 'kit' ? 'Kit ×2' : 'Shirt ×1';
                const pos      = c.clubBadge.position ? ` · ${c.clubBadge.position}` : '';
                const type     = c.clubBadge.type === 'creation' ? ' · New creation' : c.clubBadge.type === 'redesign' ? ' · Re-design' : '';
                const surcharge= c.clubBadge.badgeSurcharge ? ` · One-off fee: ${fmt(c.clubBadge.badgeSurcharge)}` : '';
                add(sku, `Club Badge (${coverage})`, `${pos}${type}${surcharge}`.replace(/^ · /, ''));
                // Badge surcharge as flat fee line
                if (c.clubBadge.badgeSurcharge) {
                    const typeLabel = c.clubBadge.type === 'creation' ? 'Badge Creation Fee' : 'Badge Re-design Fee';
                    items.push({ sku: null, label: typeLabel, unitPrice: c.clubBadge.badgeSurcharge, qty: 1, subtotal: c.clubBadge.badgeSurcharge, description: 'One-off flat fee' });
                }
            }
            if (c.sponsors?.enabled) {
                const skuMap   = { rightSleeve:'PF-011', leftSleeve:'PF-012', frontSponsor:'PF-002', backSponsor:'PF-003' };
                const lblMap   = { rightSleeve:'Right Sleeve', leftSleeve:'Left Sleeve', frontSponsor:'Front', backSponsor:'Back' };
                Object.entries(skuMap).forEach(([pos, sku]) => {
                    if (c.sponsors[pos]?.enabled) add(sku, `Sponsor — ${lblMap[pos]}`);
                });
            }
            if (c.backNumbers?.enabled) {
                const p       = c.backNumbers.positions || {};
                const numDesc = buildAssignmentDesc(c.backNumbers.assignments, 'P');
                const numNote = numDesc ? `
${numDesc}` : '';
                if (p.backOfShirt)       add(font === 'exclusive' ? 'PF-005' : 'PF-004', 'Number — Back of Shirt',       fontLabel + colourNote + numNote);
                if (p.bottomRightShorts) add(font === 'exclusive' ? 'PF-007' : 'PF-006', 'Number — Bottom Right Shorts', fontLabel + colourNote + numNote);
                if (p.topLeftShirt)      add('PF-008', 'Number — Top Left Shirt',         fontLabel + colourNote + numNote);
            }
            if (c.names?.enabled) {
                const nameSku  = font === 'exclusive' ? 'PF-010' : 'PF-009';
                const nameDesc = buildAssignmentDesc(c.names.assignments, 'P');
                const nameNote = nameDesc ? `
${nameDesc}` : '';
                add(nameSku, 'Player Names', fontLabel + colourNote + nameNote);
            }
        }

        // ── Football Training ──
        else if (c.type === 'football-training') {
            const font = c.font || 'standard';
            const fontLabel = font === 'exclusive' ? 'Exclusive Font' : 'Standard Font';
            const logoColour = c.verveLogoColour?.name ? ` · Logo: ${c.verveLogoColour.name}` : '';
            const initColour = c.numberInitialColour?.name ? ` · Colour: ${c.numberInitialColour.name}` : '';
            if (c.clubBadge?.enabled) {
                const sku = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
                add(sku, 'Club Badge');
            }
            if (c.numberInitial?.enabled) {
                const initDesc = buildAssignmentDesc(c.numberInitial.assignments, 'P');
                const initNote = initDesc ? `
${initDesc}` : '';
                // Verve logo colour bundled here — no separate price, lives on this line
                add('PF-008', 'Number / Initial', fontLabel + initColour + logoColour + initNote);
            } else if (c.verveLogoColour?.name) {
                // Number/Initial not selected but logo colour was — record as zero-price info item
                items.push({ sku: null, label: 'Verve Logo Colour', unitPrice: 0, qty: 1, subtotal: 0, description: c.verveLogoColour.name });
            }
            if (c.rightSleeveSponsor?.enabled)  add('PF-011', 'Sponsor — Right Sleeve');
            if (c.leftSleeveSponsor?.enabled)   add('PF-012', 'Sponsor — Left Sleeve');
            if (c.backSponsor?.enabled)         add('PF-003', 'Sponsor — Back');
            if (c.names?.enabled) {
                const nameSku  = font === 'exclusive' ? 'PF-010' : 'PF-009';
                const nameDesc = buildAssignmentDesc(c.names.assignments, 'P');
                const nameNote = nameDesc ? `
${nameDesc}` : '';
                add(nameSku, 'Player Names', fontLabel + logoColour + nameNote);
            }
        }

        // ── Boxing Activewear ──
        else if (c.type === 'boxing-activewear') {
            if (c.clubBadge?.enabled)  add('PB-005', 'Front — Club Badge');
            const backMode = c.backBadgeMode || 'badge';
            if (backMode === 'badge'   && c.backBadge?.enabled)   add('PB-005', 'Back — Badge');
            if (backMode === 'sponsor' && c.backSponsor?.enabled) add('PB-002', 'Back — Sponsor Logo');
            if (backMode === 'text'    && c.backText?.enabled) {
                const t1 = c.backText.text  || '';
                const t2 = c.backText.text2 || '';
                const textNote = [t1, t2].filter(Boolean).join(' / ');
                const colNote  = c.backText.colourEffect?.name ? ` · Colour: ${c.backText.colourEffect.name}` : '';
                const fontNote = c.backText.font?.fontName ? ` · Font: ${c.backText.font.fontName}` : '';
                add('PB-001', 'Back — Team Name', (textNote ? `"${textNote}"` : '') + fontNote + colNote);
            }
            if (c.sponsor?.enabled)    add('PB-002', 'Front — Sponsor Logo');
        }

        // ── Boxing Fightwear ──
        else if (c.type === 'boxing-fightwear') {
            if (c.name?.enabled) {
                const t1 = c.name.text  || '';
                const t2 = c.name.text2 || '';
                const textNote = [t1, t2].filter(Boolean).join(' / ');
                const colNote  = c.name.colourEffect?.name ? ` · Colour: ${c.name.colourEffect.name}` : '';
                const fontNote = c.name.font?.fontName ? ` · Font: ${c.name.font.fontName}` : '';
                const surnameDesc = buildAssignmentDesc(c.name.surnameAssignments, 'F');
                const surnameNote = surnameDesc ? `
${surnameDesc}` : '';
                add('PB-001', 'Team Name', (textNote ? `"${textNote}"` : '') + fontNote + colNote + surnameNote);
            }
            if (c.fwSponsors?.enabled && c.fwSponsors.positions?.length) {
                const positions = c.fwSponsors.positions.filter(Boolean);
                positions.forEach(pos => add('PB-002', `Sponsor — ${pos}`));
            }
            if (c.sleeveSponsor?.enabled) add('PB-003', 'Right Sleeve Sponsor');
        }

        return items;
    }

    toJSON() {
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
            trainingType: this.trainingType,
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
            customisationVat: this.customisationVat, // Include in payload
            customisationItems: this._buildCustomisationItems(),
            deliveryPrice: this.deliveryPrice,
            deliveryOption: this.deliveryOption,
            orderTotal: this.orderTotal
        }));
    }
}

// Global singleton
const orderState = new OrderState();
