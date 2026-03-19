/**
 * app.js — Entry point
 * Phase 1 (initial): S1-S3 inline accordion
 * Phase 2 (modal mode): Once S4 is reached, ALL sections open as popups
 *   - S1/S2/S3 use a generic popup (body reparented in/out)
 *   - S4/S5 use dedicated popups
 */

const SECTION_TITLES = {
    1: 'Select Your Sport',
    2: 'Choose Product',
    3: 'Select Colour',
    4: 'Size & Quantity',
    5: 'Customisation',
    6: 'Delivery'
};

// ═══════════════════════════════════════════════════════
// POPUP MANAGER
// ═══════════════════════════════════════════════════════
const PopupManager = {
    activePopup: null,        // section number currently open
    _reparentedBody: null,    // reference to body element moved into generic popup
    _reparentedFrom: null,    // section number the body came from

    init() {
        // S4 close/done
        document.getElementById('popupClose4')?.addEventListener('click', () => this.close(4));
        document.getElementById('popupDone4')?.addEventListener('click', () => this.close(4));

        // S5 close/done
        document.getElementById('popupClose5')?.addEventListener('click', () => this.close(5));
        document.getElementById('popupDone5')?.addEventListener('click', () => this.close(5));

        // S5.1 close/done
        document.getElementById('popupClose51')?.addEventListener('click', () => Section51.close(false));
        document.getElementById('popupDone51')?.addEventListener('click',  () => Section51.close(true));

        // S6 close/done
        document.getElementById('popupClose6')?.addEventListener('click', () => this.close(6));
        document.getElementById('popupDone6')?.addEventListener('click', () => this.close(6));

        // Generic close/done
        document.getElementById('popupCloseGeneric')?.addEventListener('click', () => this._closeGeneric());
        document.getElementById('popupDoneGeneric')?.addEventListener('click', () => this._closeGeneric());
    },

    /** Open popup for section n */
    open(n) {
        if (this.activePopup) this._forceClose(this.activePopup);

        if (n >= 4 && n <= 6) {
            const popup = document.getElementById(`popupSection${n}`);
            if (popup) popup.style.display = 'flex';
        } else {
            this._openGeneric(n);
        }

        this.activePopup = n;
    },

    /** Close popup for section n */
    close(n, silent) {
        if (n >= 4 && n <= 6) {
            const popup = document.getElementById(`popupSection${n}`);
            if (popup) popup.style.display = 'none';
        } else {
            this._closeGeneric(silent);
            return;
        }

        this.activePopup = null;

        if (n === 4 && orderState.sizeEntries.length > 0) {
            SectionManager.complete(4);
            Section4._updateSectionHeader();
            SectionManager.unlockBase(5);
        }
        if (n === 5) {
            SectionManager.complete(5);
            Section5._updateSectionHeader();
            // For Football Match Day — open socks sub-section before delivery
            if (orderState.customisation.type === 'football-matchday') {
                setTimeout(() => Section51.activate(), 300);
                return;
            }
            // All other types — go straight to delivery
            SectionManager.unlockBase(6);
            setTimeout(() => {
                PopupManager.open(6);
                Section6.activate();
            }, 300);
        }
        if (n === 6 && orderState.deliveryOption) {
            SectionManager.complete(6);
            Section6._updateSectionHeader();
        }

        if (!silent) OrderSummaryUI.update();
    },

    /** Open generic popup for S1/S2/S3 */
    _openGeneric(n) {
        const popup = document.getElementById('popupGeneric');
        const popupBody = document.getElementById('popupGenericBody');
        if (!popup || !popupBody) return;

        // Set title
        document.getElementById('popupGenericNum').textContent = n;
        document.getElementById('popupGenericLabel').textContent = SECTION_TITLES[n] || `Section ${n}`;

        // Move the section body into the popup
        const sectionBody = document.getElementById(`section${n}Body`);
        if (sectionBody) {
            sectionBody.style.display = '';
            popupBody.appendChild(sectionBody);
            this._reparentedBody = sectionBody;
            this._reparentedFrom = n;
        }

        popup.style.display = 'flex';
    },

    /** Close generic popup — move body back to inline section */
    _closeGeneric(silent) {
        const popup = document.getElementById('popupGeneric');
        if (popup) popup.style.display = 'none';

        // Move body back to its original section
        if (this._reparentedBody && this._reparentedFrom) {
            const section = document.getElementById(`section${this._reparentedFrom}`);
            if (section) {
                section.appendChild(this._reparentedBody);
            }
        }

        this._reparentedBody = null;
        this._reparentedFrom = null;
        this.activePopup = null;

        if (!silent) OrderSummaryUI.update();
    },

    /** Force close any popup (used before opening another) */
    _forceClose(n) {
        if (n >= 4 && n <= 6) {
            const popup = document.getElementById(`popupSection${n}`);
            if (popup) popup.style.display = 'none';
        } else {
            // Return body to inline section without updating UI
            const popup = document.getElementById('popupGeneric');
            if (popup) popup.style.display = 'none';
            if (this._reparentedBody && this._reparentedFrom) {
                const section = document.getElementById(`section${this._reparentedFrom}`);
                if (section) section.appendChild(this._reparentedBody);
            }
            this._reparentedBody = null;
            this._reparentedFrom = null;
        }
        this.activePopup = null;
    }
};

// ═══════════════════════════════════════════════════════
// SECTION MANAGER
// ═══════════════════════════════════════════════════════
const SectionManager = {
    sections: {},
    modalMode: false,

    init() {
        for (let i = 1; i <= 6; i++) {
            this.sections[i] = document.getElementById(`section${i}`);
            const header = this.sections[i]?.querySelector('.section-header');
            if (header) {
                const idx = i;
                header.addEventListener('click', () => this._onHeaderClick(idx));
            }
        }
    },

    unlock(n) {
        const el = this.sections[n];
        if (!el) return;
        el.classList.remove('locked');
        el.classList.remove('collapsed');

        if (n >= 4 && !this.modalMode) {
            this._enterModalMode();
        }

        if (n === 4) {
            PopupManager.open(4);
            Section4.activate();
        } else if (n === 5) {
            PopupManager.open(5);
            Section5.activate();
        } else if (n === 6) {
            PopupManager.open(6);
            Section6.activate();
        } else if (!this.modalMode) {
            this._collapseInlineSections(n);
        }
    },

    unlockBase(n) {
        const el = this.sections[n];
        if (!el) return;
        el.classList.remove('locked');
    },

    lock(n) {
        const el = this.sections[n];
        if (!el) return;
        el.classList.add('locked');
        el.classList.remove('complete');
        el.classList.remove('collapsed');
        if (PopupManager.activePopup === n) {
            PopupManager._forceClose(n);
        }
    },

    lockFrom(n) { for (let i = n; i <= 6; i++) this.lock(i); },

    complete(n) {
        const el = this.sections[n];
        if (el) {
            el.classList.add('complete');
            if (this.modalMode) el.classList.add('collapsed');
        }
    },

    _enterModalMode() {
        this.modalMode = true;
        for (let i = 1; i <= 3; i++) {
            const el = this.sections[i];
            if (el && el.classList.contains('complete')) {
                el.classList.add('collapsed');
            }
        }
    },

    _collapseInlineSections(except) {
        for (let i = 1; i <= 3; i++) {
            const el = this.sections[i];
            if (!el || i === except) continue;
            if (el.classList.contains('complete') && !el.classList.contains('locked')) {
                el.classList.add('collapsed');
            }
        }
    },

    _onHeaderClick(n) {
        const el = this.sections[n];
        if (!el) return;
        if (el.classList.contains('locked')) return;

        if (this.modalMode) {
            if (!el.classList.contains('complete') && n < 4) return;

            if (n === 4) {
                PopupManager.open(4);
                Section4.activate();
            } else if (n === 5) {
                PopupManager.open(5);
                Section5.activate();
            } else if (n === 6) {
                PopupManager.open(6);
                Section6.activate();
            } else {
                PopupManager.open(n);
            }
            return;
        }

        // Section 4+ clicked while not yet in modal mode — enter modal mode and open
        if (n >= 4) {
            if (!el.classList.contains('locked')) {
                this._enterModalMode();
                if (n === 4) { PopupManager.open(4); Section4.activate(); }
                else if (n === 5) { PopupManager.open(5); Section5.activate(); }
                else if (n === 6) { PopupManager.open(6); Section6.activate(); }
            }
            return;
        }
        if (!el.classList.contains('complete')) return;
        el.classList.remove('collapsed');
        this._collapseInlineSections(n);
    }
};

// ═══════════════════════════════════════════════════════
// LEFT PANE
// ═══════════════════════════════════════════════════════
const LeftPane = {
    imageEl: null, placeholderEl: null, bgEl: null, currentUrl: null,

    BG_URLS: {
        default:  'https://static.wixstatic.com/media/65ccc7_42405beb607f4e78986214de137fe6b3~mv2.png',
        Football: 'https://static.wixstatic.com/media/65ccc7_b376d8232fb343bf952acc046fb467b0~mv2.png',
        Boxing:   'https://static.wixstatic.com/media/65ccc7_8995a6bfe1c94d92ab04759a9587efa9~mv2.png'
    },

    init() {
        this.imageEl      = document.getElementById('displayImage');
        this.placeholderEl= document.getElementById('imagePlaceholder');
        this.bgEl         = document.getElementById('bgImage');
    },

    /** Switch background — only called when collection changes */
    setBg(collection) {
        if (!this.bgEl) return;
        const url = this.BG_URLS[collection] || this.BG_URLS.default;
        this.bgEl.src = url;
    },

    setImage(url) {
        if (!url || !this.imageEl || url === this.currentUrl) return;
        this.currentUrl = url;
        this.imageEl.src = url;
        this.imageEl.style.display = 'block';
        if (this.placeholderEl) this.placeholderEl.style.display = 'none';
    },
    clear() {
        if (this.imageEl) { this.imageEl.src = ''; this.imageEl.style.display = 'none'; }
        if (this.placeholderEl) this.placeholderEl.style.display = 'flex';
        this.currentUrl = null;
    }
};

// ═══════════════════════════════════════════════════════
// ORDER SUMMARY UI
// ═══════════════════════════════════════════════════════
const OrderSummaryUI = {
    el: null, dockEl: null, linesEl: null, totalEl: null, peekValueEl: null, peekBadgeEl: null,
    init() {
        this.el = document.getElementById('orderSummary');
        this.dockEl = document.getElementById('orderSummaryDock');
        this.linesEl = document.getElementById('summaryLines');
        this.totalEl = document.getElementById('summaryTotalValue');
        this.peekValueEl = document.getElementById('summaryPeekValue');
        this.peekBadgeEl = document.getElementById('summaryPeekBadge');

        // Click to expand/collapse
        const peek = document.getElementById('summaryPeek');
        if (peek) {
            peek.addEventListener('click', () => {
                this.el.classList.toggle('is-open');
            });
        }
    },

    update() {
        if (!this.el || !this.dockEl) return;
        const hasEntries = orderState.sizeEntries.length > 0;
        const hasLegacy = !!orderState.size;
        if (!hasEntries && !hasLegacy) { this.dockEl.style.display = 'none'; return; }
        this.dockEl.style.display = 'block';

        let lines = '';

        if (orderState.productTitle) {
            const v = orderState.variant ? ` — ${orderState.variant.displayName}` : '';
            lines += this._line(`${orderState.productTitle}${v}`, '', null, null);
        }

        if (hasEntries) {
            orderState.sizeEntries.forEach(e => {
                const g      = e.priceGroup === 'junior' ? 'Junior' : 'Adult';
                const sku    = e.sku ? ` <span style="font-size:10px;color:var(--text-muted);">[${e.sku}]</span>` : '';
                const amount = e.unitPrice * e.quantity;
                const vatNote = e.priceGroup === 'adult'
                    ? ` <span style="font-size:10px;color:var(--text-muted);">inc. VAT</span>`
                    : '';
                lines += this._line(`${g} ${e.size}${sku}`, e.unitPrice, e.quantity, null);
            });
        } else if (hasLegacy) {
            const g = orderState.priceGroup ? ` (${orderState.priceGroup})` : '';
            lines += this._line(`${orderState.size}${g}`, orderState.unitPrice || orderState.lineTotal, orderState.quantity || 1, null);
        }

        const c = orderState.customisation;
        const custType = c.type;
        const qty = orderState.getTotalQuantity() || orderState.quantity || 1;

        if (custType === 'football-matchday') {
            const qty = orderState.getTotalQuantity() || orderState.quantity || 1;
            const font = c.font || 'standard';
            const fmtSku = (sku) => {
                const p = orderState.getSkuPrice(sku, qty);
                return p > 0 ? Helpers.formatPrice(p) + '/item' : '';
            };

            if (c.clubBadge?.enabled) {
                const badgeSku  = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
                const coverage  = c.clubBadge.kitType === 'kit' ? '×2 (kit)' : '×1 (shirt)';
                const position  = c.clubBadge.position ? ` — ${c.clubBadge.position.charAt(0).toUpperCase() + c.clubBadge.position.slice(1)}` : '';
                const badgeType = c.clubBadge.type === 'creation' ? ' + Creation' : c.clubBadge.type === 'redesign' ? ' + Re-design' : '';
                const surcharge = c.clubBadge.badgeSurcharge ? ` (inc. +${Helpers.formatPrice(c.clubBadge.badgeSurcharge)} fee)` : '';
                const badgeUnitPrice = orderState.getSkuPrice(badgeSku, qty);
                lines += this._line(`Club Badge ${coverage}${position}${badgeType}`, badgeUnitPrice, qty, badgeSku);
                if (c.clubBadge.badgeSurcharge) lines += this._line(`  ↳ Badge ${c.clubBadge.type === 'creation' ? 'Creation' : 'Re-design'} fee`, c.clubBadge.badgeSurcharge, null, null);
            }
            if (c.sponsors?.enabled) {
                const sponsorSkuMap = { rightSleeve:'PF-011', leftSleeve:'PF-012', frontSponsor:'PF-002', backSponsor:'PF-003' };
                const sponsorLabelMap = { rightSleeve:'Right Sleeve', leftSleeve:'Left Sleeve', frontSponsor:'Front', backSponsor:'Back' };
                ['rightSleeve','leftSleeve','frontSponsor','backSponsor'].forEach(pos => {
                    if (c.sponsors[pos]?.enabled) {
                        lines += this._line(`Sponsor — ${sponsorLabelMap[pos]}`, orderState.getSkuPrice(sponsorSkuMap[pos], qty), qty, sponsorSkuMap[pos]);
                    }
                });
            }
            if (c.backNumbers?.enabled) {
                const numSkuMap = {
                    backOfShirt:       font === 'exclusive' ? 'PF-005' : 'PF-004',
                    bottomRightShorts: font === 'exclusive' ? 'PF-007' : 'PF-006',
                    topLeftShirt:      'PF-008'
                };
                const numLabelMap = { backOfShirt:'Back of Shirt 21cm', bottomRightShorts:'Shorts 8cm', topLeftShirt:'Training 3cm' };
                Object.entries(c.backNumbers.positions || {}).forEach(([pos, enabled]) => {
                    if (enabled) lines += this._line(`Numbers — ${numLabelMap[pos] || pos}`, orderState.getSkuPrice(numSkuMap[pos], qty), qty, numSkuMap[pos]);
                });
                // Show individual player number assignments as chips
                const assignments = c.backNumbers.assignments || {};
                const assignChips = orderState.sizeEntries.map(e => {
                    const k = OrderState.sizeKey(e);
                    const gl = e.priceGroup === 'junior' ? 'Junior' : 'Adult';
                    const vals = (assignments[k] || []).filter(v => v !== null && v !== undefined);
                    return vals.length ? `${gl} ${e.size}: ${vals.join(', ')}` : null;
                }).filter(Boolean).join(' &nbsp;·&nbsp; ');
                if (assignChips) lines += `<div class="summary-line summary-line-sub"><span style="font-size:11px;color:var(--text-muted);padding-left:12px;">↳ ${assignChips}</span></div>`;
            }
            if (c.names?.enabled) {
                const nameSku = font === 'exclusive' ? 'PF-010' : 'PF-009';
                lines += this._line('Player Names', orderState.getSkuPrice(nameSku, qty), qty, nameSku);
            }
            lines += this._line('Font', font === 'exclusive' ? 'Exclusive ✓' : 'Standard', null, null);
            if (c.printColour?.name) lines += this._line('Print Colour', c.printColour.name, null, null);

        } else if (custType === 'football-training') {
            const qty = orderState.getTotalQuantity() || orderState.quantity || 1;
            const font = c.font || 'standard';
            const fmtSku = (sku) => { const p = orderState.getSkuPrice(sku, qty); return p > 0 ? Helpers.formatPrice(p) + '/item' : ''; };
            // Club badge — instock and bespoke
            if (c.clubBadge?.enabled) {
                const badgeSku = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
                const position = c.clubBadge.position ? ` — ${c.clubBadge.position.charAt(0).toUpperCase() + c.clubBadge.position.slice(1)}` : '';
                lines += this._line(`Club Badge${position}`, orderState.getSkuPrice(badgeSku, qty), qty, badgeSku);
            }
            // Sponsors — training uses flat fields (rightSleeveSponsor, leftSleeveSponsor, backSponsor) for both instock and bespoke
            if (c.rightSleeveSponsor?.enabled) lines += this._line('Sponsor — Right Sleeve', orderState.getSkuPrice('PF-011', qty), qty, 'PF-011');
            if (c.leftSleeveSponsor?.enabled)  lines += this._line('Sponsor — Left Sleeve',  orderState.getSkuPrice('PF-012', qty), qty, 'PF-012');
            if (c.backSponsor?.enabled)         lines += this._line('Sponsor — Back',          orderState.getSkuPrice('PF-003', qty), qty, 'PF-003');
            if (c.numberInitial?.enabled) {
                lines += this._line('Number / Initial', orderState.getSkuPrice('PF-008', qty), qty, 'PF-008');
                // Bundle colour notes as sub-rows (no price)
                const initColourNote = c.numberInitialColour?.name ? ` · Colour: ${c.numberInitialColour.name}` : '';
                const logoColourNote = c.verveLogoColour?.name ? ` · Logo: ${c.verveLogoColour.name}` : '';
                if (initColourNote || logoColourNote) {
                    lines += `<div class="summary-line summary-line-sub"><span style="font-size:11px;color:var(--text-muted);padding-left:12px;">↳${initColourNote}${logoColourNote}</span></div>`;
                }
            } else {
                // Not enabled — still show logo colour as a standalone info note
                if (c.verveLogoColour?.name) lines += this._line('Verve Logo Colour', c.verveLogoColour.name, null, null);
            }
            if (c.names?.enabled) {
                const nameSku = font === 'exclusive' ? 'PF-010' : 'PF-009';
                lines += this._line('Player Names', orderState.getSkuPrice(nameSku, qty), qty, nameSku);
            }
            lines += this._line('Font', font === 'exclusive' ? 'Exclusive' : 'Standard', null, null);

        } else if (custType === 'boxing-activewear') {
            const qty = orderState.getTotalQuantity() || orderState.quantity || 1;
            const fmtSku = (sku) => { const p = orderState.getSkuPrice(sku, qty); return p > 0 ? Helpers.formatPrice(p) + '/item' : 'Price TBC'; };
            if (c.clubBadge?.enabled) lines += this._line('Front — Club Badge', orderState.getSkuPrice('PB-005', qty), qty, 'PB-005');
            const backMode = c.backBadgeMode || 'badge';
            // Only one of badge / sponsor / text is active at a time
            if (backMode === 'badge' && c.backBadge?.enabled) {
                lines += this._line('Back — Badge', orderState.getSkuPrice('PB-005', qty), qty, 'PB-005');
            } else if (backMode === 'sponsor' && c.backSponsor?.enabled) {
                lines += this._line('Back — Sponsor Logo', orderState.getSkuPrice('PB-002', qty), qty, 'PB-002');
            } else if (backMode === 'text' && c.backText?.enabled) {
                const textVal  = c.backText?.text  || '';
                const textVal2 = c.backText?.text2 || '';
                const colourName = c.backText?.colourEffect?.name || '';
                const surcharge = c.backText?.effectSurcharge ? ` +£${c.backText.effectSurcharge.toFixed(2)}/item` : '';
                const textDisplay = [textVal ? `Line 1: "${textVal}"` : null, textVal2 ? `Line 2: "${textVal2}"` : null].filter(Boolean).join('  ');
                lines += this._line('Back — Team Name', orderState.getSkuPrice('PB-001', qty), qty, 'PB-001');
                if (textDisplay) lines += this._line('  ↳ Text', textDisplay, null, null);
                if (colourName) lines += this._line('  ↳ Colour', colourName + surcharge, null, null);
            }
            if (c.sponsor?.enabled) lines += this._line('Front — Sponsor Logo', orderState.getSkuPrice('PB-002', qty), qty, 'PB-002');

        } else if (custType === 'boxing-fightwear') {
            const qty = orderState.getTotalQuantity() || orderState.quantity || 1;
            const fmtSku = (sku) => { const p = orderState.getSkuPrice(sku, qty); return p > 0 ? Helpers.formatPrice(p) + '/item' : 'Price TBC'; };
            if (c.name?.enabled) {
                const teamText  = c.name.text  || '';
                const teamText2 = c.name.text2 || '';
                const colourName = c.name.colourEffect?.name || '';
                const surcharge = c.name.effectSurcharge ? ` +£${c.name.effectSurcharge.toFixed(2)}/item` : '';
                const teamDisplay = [teamText ? `Line 1: "${teamText}"` : null, teamText2 ? `Line 2: "${teamText2}"` : null].filter(Boolean).join('  ');
                lines += this._line('Team Name', orderState.getSkuPrice('PB-001', qty), qty, 'PB-001');
                if (teamDisplay) lines += this._line('  ↳ Text', teamDisplay, null, null);
                if (colourName)  lines += this._line('  ↳ Colour', colourName + surcharge, null, null);
            }
            if (c.fwSponsors?.enabled) {
                const positions = (c.fwSponsors.positions || []).filter(Boolean);
                if (positions.length) {
                    const frontPos  = positions.filter(p => p.startsWith('F'));
                    const backPos   = positions.filter(p => p.startsWith('B'));
                    const sleevePos = positions.filter(p => p === 'RS' || p === 'LS');
                    const parts = [];
                    if (frontPos.length)  parts.push(`Front ×${frontPos.length}`);
                    if (backPos.length)   parts.push(`Back ×${backPos.length}`);
                    if (sleevePos.length) parts.push(sleevePos.map(p => p === 'RS' ? 'Right Sleeve' : 'Left Sleeve').join(', '));
                    lines += this._line(`Sponsors (${positions.length} pos)`, orderState.getSkuPrice('PB-002', qty), positions.length, 'PB-002');
                }
            }
            if (c.sleeveSponsor?.enabled) lines += this._line('Right Sleeve Sponsor', orderState.getSkuPrice('PB-003', qty), qty, 'PB-003');

        } else {
            // Fallback for any unrecognised type — show whatever is enabled
            if (c.frontLogo?.enabled) lines += this._line('Front Logo', c.frontLogo.price ? Helpers.formatPrice(c.frontLogo.price) : '');
            if (c.backLogo?.enabled) lines += this._line('Back Logo', c.backLogo.price ? Helpers.formatPrice(c.backLogo.price) : '');
            if (c.backText?.enabled && c.backText.font) lines += this._line(`Back Text (${c.backText.font.fontName})`, Helpers.formatPrice(c.backText.font.price));
            if (c.name?.enabled && c.name.font) lines += this._line(`Name (${c.name.font.fontName})`, Helpers.formatPrice(c.name.font.price));
        }

        if (custType === 'football-matchday') {
            // Socks
            const socks = c.socks;
            if (socks?.enabled && socks.sockType) {
                const variantLabel = socks.sockVariant?.displayName ? ` — ${socks.sockVariant.displayName}` : '';
                const sockSku = [c.socks.groupSkus?.adult, c.socks.groupSkus?.junior].filter(Boolean).join(' / ') || socks.sockType.sku || 'SOCKS';
                const sockUnitPrice = qty > 0 ? (orderState.socksTotal / qty) : (socks.price || 0);
                lines += this._line(`Socks: ${socks.sockType.title}${variantLabel} [${sockSku}]`, sockUnitPrice, qty, null);
            } else if (socks && !socks.enabled && socks.sockType === null && c.type) {
                lines += this._line('Socks', 'None', null, null);
            }
        }

        if (orderState.customisationTotal > 0) {
            if (orderState.customisationTotal > 0) lines += this._line('Customisation subtotal', Helpers.formatPrice(orderState.customisationTotal), null, null);
            if (orderState.customisationVat > 0) lines += this._line('Customisation VAT (20%)', Helpers.formatPrice(orderState.customisationVat), null, null); // NEW ROW
        }

        lines += '<div class="summary-divider"></div>';

        // UPDATED: Include customisation VAT in the displayed item total
        const itemsTotal = orderState.lineTotal + orderState.customisationTotal + orderState.customisationVat + (orderState.socksTotal || 0) + (orderState.socksVat || 0);
        lines += this._line('<strong>Items Total</strong>', `<strong>${Helpers.formatPrice(itemsTotal)}</strong>`, null, null);
        lines += this._line('Delivery', '<span style="font-size:11px;color:var(--text-muted);">Added at checkout</span>', null, null);

        this.linesEl.innerHTML = lines;

        const totalFormatted = Helpers.formatPrice(orderState.orderTotal);
        if (this.totalEl) this.totalEl.textContent = totalFormatted;
        if (this.peekValueEl) this.peekValueEl.textContent = totalFormatted;

        // Update badge with item count
        if (this.peekBadgeEl) {
            const totalQty = orderState.getTotalQuantity() || orderState.quantity || 0;
            const sizeCount = orderState.sizeEntries.length || (orderState.size ? 1 : 0);
            this.peekBadgeEl.textContent = sizeCount > 1
                ? `${sizeCount} sizes · ${totalQty} items`
                : `${totalQty} item${totalQty !== 1 ? 's' : ''}`;
        }

        const cartBtn = document.getElementById('addToCartBtn');
        const appBtn = document.getElementById('submitApprovalBtn');
        const ready = hasEntries || hasLegacy;
        if (cartBtn) { cartBtn.textContent = `ADD TO CART — ${totalFormatted}`; }
        if (appBtn) { /* text stays */ }

        this._updateButtons();
    },

    _updateButtons() {
        const hasEntries = orderState.sizeEntries.length > 0;
        const hasLegacy = !!orderState.size;
        const ready = hasEntries || hasLegacy;
        const termsChecked = document.getElementById('termsCheckbox')?.checked || false;
        const enabled = ready && termsChecked;

        const cartBtn = document.getElementById('addToCartBtn');
        const appBtn = document.getElementById('submitApprovalBtn');
        if (cartBtn) cartBtn.disabled = !enabled;
        if (appBtn) appBtn.disabled = !enabled;
    },

    _line(l, unitPrice, qty, sku) {
        const skuTag = sku ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">[${sku}]</span>` : '';
        // 3-column: label | (mid + value grouped right)
        if (qty !== null && qty !== undefined && typeof unitPrice === 'number' && unitPrice > 0) {
            const subtotal = unitPrice * qty;
            const mid = `${Helpers.formatPrice(unitPrice)} × ${qty}`;
            return `<div class="summary-line"><span class="summary-line-label">${l}${skuTag}</span><span class="summary-line-right"><span class="summary-line-mid">${mid}</span><span class="summary-line-value">${Helpers.formatPrice(subtotal)}</span></span></div>`;
        }
        // Info line — label + value only
        const displayVal = typeof unitPrice === 'number' && unitPrice > 0 ? Helpers.formatPrice(unitPrice) : (unitPrice || '');
        return `<div class="summary-line"><span class="summary-line-label">${l}${skuTag}</span><span class="summary-line-right"><span class="summary-line-value">${displayVal}</span></span></div>`;
    }
};

// ═══════════════════════════════════════════════════════
// APPROVAL MODAL
// ═══════════════════════════════════════════════════════
const ApprovalModal = {
    overlay: null,
    confirmOverlay: null,

    init() {
        this.overlay = document.getElementById('approvalOverlay');
        this.confirmOverlay = document.getElementById('approvalConfirmOverlay');
        if (!this.overlay) return;

        // Close/cancel buttons
        const closeBtn = document.getElementById('approvalClose');
        const cancelBtn = document.getElementById('approvalCancel');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hide());

        // Backdrop click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Submit button
        const submitBtn = document.getElementById('approvalSubmit');
        if (submitBtn) submitBtn.addEventListener('click', () => this.submit());

        // Confirm done button
        const doneBtn = document.getElementById('approvalConfirmDone');
        if (doneBtn) doneBtn.addEventListener('click', () => {
            this.confirmOverlay.style.display = 'none';
        });

        // Confirm overlay backdrop
        if (this.confirmOverlay) {
            this.confirmOverlay.addEventListener('click', (e) => {
                if (e.target === this.confirmOverlay) this.confirmOverlay.style.display = 'none';
            });
        }
    },

    show() {
        if (this.overlay) this.overlay.style.display = 'flex';
        this._clearError();
        // Focus first field
        const nameInput = document.getElementById('approvalName');
        if (nameInput) setTimeout(() => nameInput.focus(), 100);
    },

    hide() {
        if (this.overlay) this.overlay.style.display = 'none';
    },

    _validate() {
        const name = document.getElementById('approvalName').value.trim();
        const email = document.getElementById('approvalEmail').value.trim();
        const addr1 = document.getElementById('approvalAddr1').value.trim();
        const city = document.getElementById('approvalCity').value.trim();
        const postcode = document.getElementById('approvalPostcode').value.trim();

        if (!name) return 'Full name is required';
        if (!email || !email.includes('@')) return 'Valid email address is required';
        if (!addr1) return 'Address line 1 is required';
        if (!city) return 'City is required';
        if (!postcode) return 'Postcode is required';
        return null;
    },

    _showError(msg) {
        const el = document.getElementById('approvalError');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    },

    _clearError() {
        const el = document.getElementById('approvalError');
        if (el) el.style.display = 'none';
    },

    _setLoading(loading) {
        const textEl = document.getElementById('approvalSubmitText');
        const loaderEl = document.getElementById('approvalSubmitLoader');
        const btn = document.getElementById('approvalSubmit');
        if (loading) {
            if (textEl) textEl.style.display = 'none';
            if (loaderEl) loaderEl.style.display = 'inline';
            if (btn) btn.disabled = true;
        } else {
            if (textEl) textEl.style.display = 'inline';
            if (loaderEl) loaderEl.style.display = 'none';
            if (btn) btn.disabled = false;
        }
    },

    _buildOrderSummary() {
        const lines = [];
        const state = orderState;
        const c = state.customisation;
        const custType = c.type;

        if (state.productTitle) {
            const v = state.variant ? ` — ${state.variant.displayName}` : '';
            lines.push(`${state.productTitle}${v}`);
        }

        if (state.sizeEntries.length > 0) {
            state.sizeEntries.forEach(e => {
                const g   = e.priceGroup === 'junior' ? 'Junior' : 'Adult';
                const sku = e.sku ? ` [${e.sku}]` : '';
                lines.push(`  ${g} ${e.size}${sku} × ${e.quantity} @ ${Helpers.formatPrice(e.unitPrice)} = ${Helpers.formatPrice(e.unitPrice * e.quantity)}`);
            });
        }
        lines.push(`  Line total: ${Helpers.formatPrice(state.lineTotal)}`);

        if (custType === 'football-matchday') {
            if (c.clubBadge?.enabled) {
                const t = c.clubBadge.type === 'creation' ? 'Badge Creation' : c.clubBadge.type === 'redesign' ? 'Badge Re-design' : 'Club Badge';
                lines.push(`  Club Badge: ${t}${c.clubBadge.position ? ' — ' + c.clubBadge.position : ''}${c.clubBadge.price ? ' — ' + Helpers.formatPrice(c.clubBadge.price) : ''}`);
            }
            if (c.sponsors?.enabled) {
                const pos = ['rightSleeve','leftSleeve','frontSponsor','backSponsor'].filter(p => c.sponsors[p]?.enabled);
                lines.push(`  Sponsors: ${pos.length ? pos.join(', ') : 'enabled'}`);
            }
            if (c.backNumbers?.enabled) {
                const pos = Object.entries(c.backNumbers.positions||{}).filter(([,v])=>v).map(([k])=>k);
                lines.push(`  Back Numbers: ${pos.length ? pos.join(', ') : 'enabled'}`);
            }
            if (c.names?.enabled) lines.push(`  Player Names: enabled`);
            if (c.font && c.font !== 'standard') lines.push(`  Font: ${c.font}`);
            if (c.printColour?.name) lines.push(`  Print Colour: ${c.printColour.name}`);
            // Socks
            if (c.socks?.enabled && c.socks.sockType) {
                const vl = c.socks.sockVariant?.displayName ? ` — ${c.socks.sockVariant.displayName}` : '';
                const sockSku = [c.socks.groupSkus?.adult, c.socks.groupSkus?.junior, c.socks.sockType.sku].filter(Boolean).join(' / ') || 'SOCKS';
                lines.push(`  Socks [${sockSku}]: ${c.socks.sockType.title}${vl}${c.socks.price ? ' — ' + Helpers.formatPrice(c.socks.price) : ''}`);
            } else if (c.socks && !c.socks.enabled) {
                lines.push(`  Socks: None`);
            }
        } else if (custType === 'football-training') {
            if (c.clubBadge?.enabled) lines.push(`  Club Badge: uploaded`);
            if (c.numberInitial?.enabled) {
                const initCol = c.numberInitialColour?.name ? ` · Colour: ${c.numberInitialColour.name}` : '';
                lines.push(`  Number / Initial${initCol}`);
            }
            if (c.rightSleeveSponsor?.enabled) lines.push(`  Sponsor — Right Sleeve: uploaded`);
            if (c.leftSleeveSponsor?.enabled)  lines.push(`  Sponsor — Left Sleeve: uploaded`);
            if (c.backSponsor?.enabled)         lines.push(`  Sponsor — Back: uploaded`);
            if (c.names?.enabled) lines.push(`  Player Names: enabled`);
            if (c.font && c.font !== 'standard') lines.push(`  Font: ${c.font}`);
            if (c.verveLogoColour?.name) lines.push(`  Verve Logo Colour: ${c.verveLogoColour.name}`);
            if (c.numberInitialColour?.name) lines.push(`  Number/Initial Colour: ${c.numberInitialColour.name}`);
        } else if (custType === 'boxing-activewear') {
            if (c.clubBadge?.enabled) lines.push(`  Front — Club Badge: uploaded`);
            const mode = c.backBadgeMode || 'badge';
            if (mode === 'badge' && c.backBadge?.enabled) {
                lines.push(`  Back — Badge: uploaded`);
            } else if (mode === 'sponsor' && c.backSponsor?.enabled) {
                lines.push(`  Back — Sponsor Logo: uploaded`);
            } else if (mode === 'text' && c.backText?.enabled) {
                const t1 = c.backText.text || ''; const t2 = c.backText.text2 || '';
                const textStr = [t1 ? `"${t1}"` : null, t2 ? `"${t2}"` : null].filter(Boolean).join(' / ');
                const colStr = c.backText.colourEffect?.name ? ` · Colour: ${c.backText.colourEffect.name}` : '';
                const fontStr = c.backText.font?.fontName ? ` · Font: ${c.backText.font.fontName}` : '';
                lines.push(`  Back — Team Name: ${textStr}${fontStr}${colStr}`);
            }
            if (c.sponsor?.enabled) lines.push(`  Front — Sponsor Logo: uploaded`);
        } else if (custType === 'boxing-fightwear') {
            if (c.name?.enabled) {
                lines.push(`  Team Name: "${c.name.text || ''}" — Font: ${c.name.font?.fontName || 'not set'}`);
                if (c.name.colourEffect?.name) lines.push(`  Colour Effect: ${c.name.colourEffect.name}${c.name.effectSurcharge ? ' +£' + c.name.effectSurcharge.toFixed(2) + '/item' : ''}`);
            }
            if (c.fwSponsors?.positions?.length) lines.push(`  Sponsor Positions: ${c.fwSponsors.positions.join(', ')}`);
        }

        if (state.customisationTotal > 0) lines.push(`Customisation subtotal: ${Helpers.formatPrice(state.customisationTotal)}`);
        if (state.customisationVat > 0) lines.push(`Customisation VAT (20%): ${Helpers.formatPrice(state.customisationVat)}`);
        
        if (state.socksTotal > 0) {
            const socks = c.socks;
            const vl = socks.sockVariant?.displayName ? ` — ${socks.sockVariant.displayName}` : '';
            const sockSku = [socks.groupSkus?.adult, socks.groupSkus?.junior, socks.sockType.sku].filter(Boolean).join(' / ') || 'SOCKS';
            lines.push(`  Socks [${sockSku}]: ${socks.sockType.title}${vl} × ${state.getTotalQuantity()} = ${Helpers.formatPrice(state.socksTotal)}`);
            if (state.socksVat > 0) lines.push(`  Socks VAT (Adults 20%): ${Helpers.formatPrice(state.socksVat)}`);
        }
        lines.push(`Delivery: Selected at checkout`);
        lines.push(`TOTAL (excl. delivery): ${Helpers.formatPrice(state.orderTotal)}`);

        return lines.join('\n');
    },

    async submit() {
        this._clearError();
        const err = this._validate();
        if (err) { this._showError(err); return; }

        this._setLoading(true);

        const customer = {
            fullName: document.getElementById('approvalName').value.trim(),
            email: document.getElementById('approvalEmail').value.trim(),
            phone: document.getElementById('approvalPhone').value.trim(),
            address: {
                line1: document.getElementById('approvalAddr1').value.trim(),
                line2: document.getElementById('approvalAddr2').value.trim(),
                city: document.getElementById('approvalCity').value.trim(),
                postcode: document.getElementById('approvalPostcode').value.trim(),
                country: 'GB'
            }
        };

        const orderJSON = orderState.toJSON();
        const orderSummaryText = this._buildOrderSummary();

        const payload = {
            customer,
            lineItem: (() => {
                // Derive dominant taxGroupId and sku from lineItems (highest subtotal wins)
                const groups = orderJSON.lineItems || [];
                const dominant = groups.reduce((best, g) => (!best || g.subtotal > best.subtotal) ? g : best, null);
                const rawSku = dominant?.entries?.[0]?.sku || orderJSON.productSku || 'VS-CUSTOM';
                const dominantTax = dominant?.taxGroupId || '';

                // Build SKU prefix matching verver-orders.web.js logic
                const col = (orderJSON.collection || '').toLowerCase();
                const typ = (orderJSON.type || '').toLowerCase();
                const SKU_PREFIX_MAP = {
                    'football-matchday':         'FB-MATCH-',
                    'football-training':         'FB-TRAIN-',
                    'football-training-bespoke': 'FB-BESPOKE-',
                    'boxing-activewear':         'BOX-ACT-',
                    'boxing-fightwear':          'BOX-FIGHT-'
                };
                let ruleKey;
                if (col === 'boxing') ruleKey = typ.includes('fight') ? 'boxing-fightwear' : 'boxing-activewear';
                else if (typ.includes('training')) ruleKey = 'football-training';
                else ruleKey = 'football-matchday';
                const skuPrefix = SKU_PREFIX_MAP[ruleKey] || '';

                return {
                    name:        orderJSON.productTitle || 'VerveSport Custom Order',
                    description: orderSummaryText,
                    price:       orderState.orderTotal,
                    quantity:    orderState.getTotalQuantity() || orderState.quantity || 1,
                    sku:         skuPrefix + rawSku,
                    taxGroupId:  dominantTax,
                    imageUrl:    orderState.variant?.imageUrl || null
                };
            })(),
            orderSummary: orderSummaryText,
            orderTotal: orderState.orderTotal,
            deliveryOptions: Section6.getDeliveryOptions(),
            orderData: orderJSON
        };

        Messaging.send('SUBMIT_FOR_APPROVAL', payload);
    },

    onSuccess(data) {
        this._setLoading(false);
        this.hide();

        // Show confirmation
        if (this.confirmOverlay) {
            const msgEl = document.getElementById('approvalConfirmMsg');
            const refEl = document.getElementById('approvalConfirmRef');
            const expEl = document.getElementById('approvalConfirmExpiry');

            if (msgEl) msgEl.textContent = `Two payment links have been sent to ${data.customerEmail || 'your email'} — one for Standard Delivery and one for Express. Choose the one you'd like to proceed with.`;
            if (refEl) refEl.textContent = `Reference: ${data.orderRef || ''}`;
            if (expEl) expEl.textContent = `Payment deadline: ${data.expiresAt ? new Date(data.expiresAt).toLocaleString() : '7 days'}`;

            this.confirmOverlay.style.display = 'flex';
        }
    },

    onError(error) {
        this._setLoading(false);
        this._showError(error || 'Failed to submit order. Please try again.');
    }
};


// ═══════════════════════════════════════════════════════
// RESTORE MANAGER
// ═══════════════════════════════════════════════════════
const RestoreManager = {
    _snapshot:    null,   // saved state object
    _snapshotLabel: null, // human-readable summary
    _autoTimer:   null,   // auto-collapse timer
    _pendingAction: null, // function to call if user confirms change

    init() {
        document.getElementById('restoreBarBtn')?.addEventListener('click',    () => this.restore());
        document.getElementById('restoreBarDismiss')?.addEventListener('click', () => this.dismiss());
        document.getElementById('restoreTab')?.addEventListener('click',        () => this._expandBar());
        document.getElementById('changeWarningContinue')?.addEventListener('click', () => this._confirmChange());
        document.getElementById('changeWarningCancel')?.addEventListener('click',   () => this._cancelChange());
    },

    /** Called before a destructive section 1 or 2 change.
     *  If downstream state exists, shows warning popup.
     *  If confirmed, saves snapshot then fires action.
     *  If no downstream state, fires action immediately.
     */
    guardChange(label, action) {
        const hasDownstream = !!(orderState.productId || orderState.variant || orderState.sizeEntries.length);
        if (!hasDownstream) {
            action();
            return;
        }
        this._pendingAction = action;
        const msg = document.getElementById('changeWarningMsg');
        if (msg) msg.textContent = `Changing this will reset your current selections. Your previous choices can be restored if needed.`;
        const overlay = document.getElementById('changeWarningOverlay');
        if (overlay) overlay.style.display = 'flex';
    },

    _confirmChange() {
        document.getElementById('changeWarningOverlay').style.display = 'none';
        // Save snapshot before state gets wiped
        this._saveSnapshot();
        if (this._pendingAction) {
            this._pendingAction();
            this._pendingAction = null;
        }
    },

    _cancelChange() {
        document.getElementById('changeWarningOverlay').style.display = 'none';
        this._pendingAction = null;
    },

    _saveSnapshot() {
        // Deep copy current state fields we care about
        this._snapshot = {
            collection:   orderState.collection,
            type:         orderState.type,
            productId:    orderState.productId,
            productTitle: orderState.productTitle,
            productData:  JSON.parse(JSON.stringify(orderState.productData || {})),
            variant:      orderState.variant ? { ...orderState.variant } : null,
            sizeEntries:  JSON.parse(JSON.stringify(orderState.sizeEntries)),
            size:         orderState.size,
            sizeKey:      orderState.sizeKey,
            priceGroup:   orderState.priceGroup,
            unitPrice:    orderState.unitPrice,
            quantity:     orderState.quantity,
            customisation: JSON.parse(JSON.stringify(orderState.customisation)),
            printingOptions: JSON.parse(JSON.stringify(orderState.printingOptions || {})),
            deliveryOption: orderState.deliveryOption,
            deliveryPrice:  orderState.deliveryPrice,
        };

        // Build label: "Football — Division Kit — Red / White"
        const parts = [
            orderState.collection,
            orderState.productTitle,
            orderState.variant?.displayName
        ].filter(Boolean);
        this._snapshotLabel = parts.join(' — ');

        this._showBar();
    },

    _showBar() {
        const bar  = document.getElementById('restoreBar');
        const tab  = document.getElementById('restoreTab');
        const text = document.getElementById('restoreBarText');
        if (text) text.innerHTML = `Previous: <strong>${this._snapshotLabel}</strong>`;
        if (bar)  bar.classList.remove('restore-bar--hidden');
        if (tab)  tab.classList.add('restore-tab--hidden');

        // Auto-collapse after 5s, pause on hover
        this._startAutoTimer();
        if (bar) {
            bar.addEventListener('mouseenter', () => this._pauseTimer(),  { passive: true });
            bar.addEventListener('mouseleave', () => this._startAutoTimer(), { passive: true });
        }
    },

    _startAutoTimer() {
        this._pauseTimer();
        this._autoTimer = setTimeout(() => this._collapseBar(), 5000);
    },

    _pauseTimer() {
        if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
    },

    _collapseBar() {
        const bar = document.getElementById('restoreBar');
        const tab = document.getElementById('restoreTab');
        if (bar) bar.classList.add('restore-bar--hidden');
        if (tab && this._snapshot) tab.classList.remove('restore-tab--hidden');
    },

    _expandBar() {
        const bar = document.getElementById('restoreBar');
        const tab = document.getElementById('restoreTab');
        if (bar) bar.classList.remove('restore-bar--hidden');
        if (tab) tab.classList.add('restore-tab--hidden');
        this._startAutoTimer();
    },

    restore() {
        if (!this._snapshot) return;
        const s = this._snapshot;

        // Restore all state fields
        orderState.collection    = s.collection;
        orderState.type          = s.type;
        orderState.productId     = s.productId;
        orderState.productTitle  = s.productTitle;
        orderState.productData   = s.productData;
        orderState.variant       = s.variant;
        orderState.sizeEntries   = s.sizeEntries;
        orderState.size          = s.size;
        orderState.sizeKey       = s.sizeKey;
        orderState.priceGroup    = s.priceGroup;
        orderState.unitPrice     = s.unitPrice;
        orderState.quantity      = s.quantity;
        orderState.customisation = s.customisation;
        orderState.printingOptions = s.printingOptions;
        orderState.deliveryOption  = s.deliveryOption;
        orderState.deliveryPrice   = s.deliveryPrice;

        // Restore UI — re-render sections and left pane
        if (s.collection) {
            document.getElementById('appContainer').dataset.sport = s.collection.toLowerCase();
            LeftPane.setBg(s.collection);
        }
        if (s.variant?.imageUrl) LeftPane.setImage(s.variant.imageUrl);
        else LeftPane.clear();

        // Unlock sections that were complete
        SectionManager.lockFrom(1);
        if (s.collection)   { SectionManager.unlockBase(1); SectionManager.complete(1); }
        if (s.productId)    { SectionManager.unlockBase(2); SectionManager.complete(2); }
        if (s.variant)      { SectionManager.unlockBase(3); SectionManager.complete(3); }
        if (s.sizeEntries?.length || s.size) {
            SectionManager.unlockBase(4); SectionManager.complete(4);
            SectionManager.unlockBase(5); SectionManager.complete(5);
            SectionManager.unlockBase(6);
        }

        orderState.recalculate();
        orderState._notify();

        this.dismiss();
    },

    dismiss() {
        this._pauseTimer();
        this._snapshot     = null;
        this._snapshotLabel = null;
        const bar = document.getElementById('restoreBar');
        const tab = document.getElementById('restoreTab');
        if (bar) bar.classList.add('restore-bar--hidden');
        if (tab) tab.classList.add('restore-tab--hidden');
    }
};

// ═══════════════════════════════════════════════════════
// INITIALISATION
// ═══════════════════════════════════════════════════════
(function init() {
    Messaging.init();
    SectionManager.init();
    PopupManager.init();
    LeftPane.init();
    OrderSummaryUI.init();
    Section1.init();
    Section2.init();
    Section3.init();
    Section4.init();
    Section5.init();
    Section51.init();
    Section6.init();
    ApprovalModal.init();

    RestoreManager.init();

    orderState.onChange(() => OrderSummaryUI.update());

    const origReset = orderState.resetFrom.bind(orderState);
    orderState.resetFrom = function(s) {
        SectionManager.lockFrom(s + 1);
        for (let i = s; i <= 6; i++) {
            const el = document.getElementById(`section${i}`);
            if (el) el.classList.remove('complete');
        }
        // Clear left pane image when sport or product type changes
        if (s <= 3) LeftPane.clear();
        // Clear Section3 cached variants so old sport colours don't bleed through
        if (s <= 3) { Section3.variants = []; Section3.render(); }
        // Reset socks card if going back to section 5 or earlier
        if (s <= 5) Section51.reset();
        if (PopupManager.activePopup) PopupManager._forceClose(PopupManager.activePopup);
        origReset(s);
    };

    const cartBtn = document.getElementById('addToCartBtn');
    if (cartBtn) cartBtn.addEventListener('click', () => {
        if (orderState.sizeEntries.length > 0 || (orderState.size && orderState.quantity > 0)) {
            Messaging.sendOrderComplete(orderState.toJSON());
        }
    });

    const appBtn = document.getElementById('submitApprovalBtn');
    if (appBtn) appBtn.addEventListener('click', () => {
        if (orderState.sizeEntries.length > 0 || (orderState.size && orderState.quantity > 0)) {
            // Show the approval modal instead of sending directly
            ApprovalModal.show();
        }
    });

    Messaging.send('IFRAME_READY', {});

    // ── Terms checkbox — controls button enabled state ──
    const termsCheckbox = document.getElementById('termsCheckbox');
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', () => {
            OrderSummaryUI._updateButtons();
        });
    }

    // ── Policy popup: summary ──
    const termsLink = document.getElementById('termsLink');
    if (termsLink) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('policySummaryOverlay').style.display = 'flex';
        });
    }
    const policySummaryClose = document.getElementById('policySummaryClose');
    if (policySummaryClose) {
        policySummaryClose.addEventListener('click', () => {
            document.getElementById('policySummaryOverlay').style.display = 'none';
        });
    }

    // ── Policy popup: full policies ──
    const seeAllBtn = document.getElementById('seeAllPoliciesBtn');
    if (seeAllBtn) {
        seeAllBtn.addEventListener('click', () => {
            document.getElementById('policySummaryOverlay').style.display = 'none';
            document.getElementById('policyFullOverlay').style.display = 'flex';
        });
    }
    const policyFullClose = document.getElementById('policyFullClose');
    const policyFullDone = document.getElementById('policyFullDone');
    if (policyFullClose) {
        policyFullClose.addEventListener('click', () => {
            document.getElementById('policyFullOverlay').style.display = 'none';
        });
    }
    if (policyFullDone) {
        policyFullDone.addEventListener('click', () => {
            document.getElementById('policyFullOverlay').style.display = 'none';
        });
    }

    // Close policy overlays on backdrop click
    ['policySummaryOverlay', 'policyFullOverlay'].forEach(id => {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.style.display = 'none';
            });
        }
    });

    Messaging.on('CART_LOADING', (data) => {
        const cartBtn = document.getElementById('addToCartBtn');
        const appBtn = document.getElementById('submitApprovalBtn');
        if (data.loading) {
            if (cartBtn) { cartBtn.disabled = true; cartBtn.textContent = 'PROCESSING...'; }
            if (appBtn) appBtn.disabled = true;
        } else {
            OrderSummaryUI.update();
        }
    });

    Messaging.on('CART_SUCCESS', (data) => {
        const cartBtn = document.getElementById('addToCartBtn');
        if (cartBtn) { cartBtn.textContent = '✓ ADDED TO CART'; cartBtn.disabled = true; }
        console.log('Cart success, orderId:', data.orderId);
        setTimeout(() => OrderSummaryUI.update(), 3000);
    });

    Messaging.on('CART_ERROR', (data) => {
        const cartBtn = document.getElementById('addToCartBtn');
        if (cartBtn) { cartBtn.textContent = 'FAILED — TRY AGAIN'; cartBtn.disabled = false; }
        console.error('Cart error:', data.message);
    });

    // ── Approval response handlers ──
    Messaging.on('SUBMIT_FOR_APPROVAL_RESPONSE', (data) => {
        if (data.success) {
            ApprovalModal.onSuccess(data.data || data);
        } else {
            ApprovalModal.onError(data.error || 'Submission failed');
        }
    });

    console.log('Verver Sport Picker initialised');
})();
