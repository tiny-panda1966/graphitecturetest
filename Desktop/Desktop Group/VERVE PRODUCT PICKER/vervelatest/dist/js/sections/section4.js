/**
 * section4.js — Size, Price & Quantity (newProducts DB)
 *
 * Product rows come pre-parsed from backend:
 *   productData.rows = [
 *     { group:'adult',  sku, sizes:['S','M','L','XL','2XL'], tiers:[{min,max,price},...], vatInc, taxGroupId },
 *     { group:'junior', sku, sizes:['6Yr','8Yr',...],        tiers:[...],                 vatInc, taxGroupId }
 *   ]
 *
 * Tier pricing: total qty per group determines unit price for ALL entries in that group.
 * Prices update live as user adds/removes sizes.
 * Each sizeEntry: { size, sizeKey:'size', priceGroup, unitPrice, quantity, taxGroupId, sku }
 */
const Section4 = {
    el: null,
    body: null,
    rows: [],
    _pendingSize: null,
    _pendingGroup: null,
    _warnConfirmedFor: new Set(), // tracks size-group combos user has confirmed reducing

    init() {
        this.el   = document.getElementById('section4');
        this.body = document.getElementById('popupBody4');
    },

    activate() {
        const product = orderState.productData;
        if (!product || !product.rows || !product.rows.length) {
            this.body.innerHTML = '<p class="text-sm text-muted">No sizing data available.</p>';
            return;
        }
        this.rows = product.rows;
        this._pendingSize  = null;
        this._pendingGroup = null;
        this._warnConfirmedFor = new Set();
        this.render();
    },

    render() {
        if (!this.rows.length) {
            this.body.innerHTML = '<p class="text-sm text-muted">No sizes available for this product.</p>';
            return;
        }

        const juniorRow = this.rows.find(r => r.group === 'junior');
        const adultRow  = this.rows.find(r => r.group === 'adult');

        let html = `
            <div class="subsection" style="display:flex;justify-content:space-between;align-items:center;border:none;padding:0;margin:0 0 12px 0;">
                <span class="subsection-label" style="margin:0;">Select Size</span>
            </div>
        `;

        if (juniorRow) html += this._renderSizeGroup('Junior Sizes', juniorRow);
        if (adultRow)  html += this._renderSizeGroup('Adult Sizes',  adultRow);
        html += '<div id="sizeSummaryTable"></div>';

        // Inline warning banner for destructive qty changes
        html += `<div id="s4WarnBanner" style="display:none;margin:12px 0 0 0;padding:12px 14px;background:rgba(255,160,0,0.1);border:1px solid rgba(255,160,0,0.35);border-radius:8px;font-size:12px;color:var(--text-secondary);line-height:1.5;">
            <strong style="color:var(--text-primary);display:block;margin-bottom:8px;">⚠ This will remove name/number assignments</strong>
            <span id="s4WarnMsg"></span>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="cta-button secondary" id="s4WarnCancel" style="flex:1;font-size:11px;padding:7px;">Cancel</button>
                <button class="cta-button primary"   id="s4WarnConfirm" style="flex:1;font-size:11px;padding:7px;">Continue</button>
            </div>
        </div>`;

        this.body.innerHTML = html;
        this._bindEvents();
        this._renderSummaryTable();
    },

    _renderSizeGroup(label, row) {
        const group = row.group;
        const currentGroupQty = orderState.sizeEntries
            .filter(e => e.priceGroup === group)
            .reduce((s, e) => s + e.quantity, 0);
        const currentTierPrice = Helpers.getTierPrice(row.tiers, Math.max(currentGroupQty, 1));
        const isActive = this._pendingGroup === group;

        let html = `<div class="size-group" data-group="${group}">`;
        html += `<div class="subsection-label" style="margin-top:8px;">${label}`;
        if (row.sku) html += ` <span style="font-size:10px;color:var(--text-muted);font-weight:400;">[${row.sku}]</span>`;
        html += `</div>`;

        // Tier strip
        if (row.tiers.length > 1) {
            html += `<div class="tier-info-strip" data-group="${group}">`;
            row.tiers.forEach(t => {
                const isActiveTier = currentGroupQty >= t.min && (t.max === null || currentGroupQty <= t.max);
                const rangeLabel = (t.max === null || t.max === Infinity) ? `${t.min}+` : `${t.min}–${t.max}`;
                html += `<span class="tier-badge${isActiveTier ? ' active' : ''}">${rangeLabel}: ${Helpers.formatPrice(t.price)}</span>`;
            });
            html += `</div>`;
        }

        html += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">`;

        row.sizes.forEach(sizeName => {
            const inEntries = orderState.sizeEntries.some(e => e.size === sizeName && e.priceGroup === group);
            const pending   = this._pendingSize === sizeName && this._pendingGroup === group;
            const isOut     = (row.stockMap || {})[sizeName] === 'outOfStock';

            let cls = 'tab-btn size-btn';
            if (pending)   cls += ' active';
            if (inEntries) cls += ' added';
            if (isOut)     cls += ' size-out-of-stock';

            if (isOut) {
                html += `
                    <button class="${cls}" data-size="${sizeName}" data-group="${group}" disabled
                        style="flex:0 0 auto;min-width:60px;position:relative;opacity:0.45;cursor:not-allowed;">
                        ${sizeName}
                        <span style="display:block;font-size:9px;color:var(--text-muted);font-weight:400;margin-top:2px;">Out of Stock</span>
                    </button>
                `;
            } else {
                html += `
                    <button class="${cls}" data-size="${sizeName}" data-group="${group}"
                        style="flex:0 0 auto;min-width:60px;position:relative;">
                        ${sizeName}
                        <span style="display:block;font-size:9px;color:var(--text-muted);font-weight:400;margin-top:2px;">${Helpers.formatPrice(currentTierPrice)}</span>
                        ${inEntries ? '<span class="size-added-tick">✓</span>' : ''}
                    </button>
                `;
            }
        });

        // Inline qty picker
        const existing = (this._pendingSize && this._pendingGroup === group)
            ? orderState.sizeEntries.find(e => e.size === this._pendingSize && e.priceGroup === group)
            : null;
        const qtyVal = existing ? existing.quantity : this._getMinQty();

        html += `
            <div class="inline-qty-picker" data-qty-group="${group}" style="display:${isActive ? 'flex' : 'none'};align-items:center;gap:6px;margin-left:4px;">
                <div class="qty-control" style="justify-content:flex-start;">
                    <button class="qty-btn inline-qty-down" data-group="${group}">−</button>
                    <input type="number" class="qty-input inline-qty-input" data-group="${group}" value="${qtyVal}" min="${this._getMinQty()}" max="999" style="width:44px;">
                    <button class="qty-btn inline-qty-up" data-group="${group}">+</button>
                </div>
                <button class="tab-btn active inline-add-btn" data-group="${group}" style="padding:8px 14px;font-size:12px;min-width:unset;white-space:nowrap;">
                    + Add
                </button>
            </div>
        `;

        html += '</div></div>';
        return html;
    },

    _bindEvents() {
        this.body.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled || btn.classList.contains('size-out-of-stock')) return;
                const size  = btn.dataset.size;
                const group = btn.dataset.group;

                this.body.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._pendingSize  = size;
                this._pendingGroup = group;

                this.body.querySelectorAll('.inline-qty-picker').forEach(qp => {
                    qp.style.display = qp.dataset.qtyGroup === group ? 'flex' : 'none';
                });

                const existing = orderState.sizeEntries.find(e => e.size === size && e.priceGroup === group);
                const qtyInput = this.body.querySelector(`.inline-qty-input[data-group="${group}"]`);
                if (qtyInput) qtyInput.value = existing ? existing.quantity : this._getMinQty();

                this._updateLeftPaneImage(group);
                this._updatePreviewPrice(group);
                Messaging.selectionChanged(4, 'size', size);
            });
        });

        this.body.querySelectorAll('.inline-qty-input').forEach(input => {
            input.addEventListener('input', () => {
                if (this._pendingGroup === input.dataset.group) this._updatePreviewPrice(input.dataset.group);
            });
        });

        this.body.querySelectorAll('.inline-qty-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const group = btn.dataset.group;
                const input = this.body.querySelector(`.inline-qty-input[data-group="${group}"]`);
                if (input) { input.value = Math.max(this._getMinQty(), (parseInt(input.value) || 1) - 1); this._updatePreviewPrice(group); }
            });
        });

        this.body.querySelectorAll('.inline-qty-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const group = btn.dataset.group;
                const input = this.body.querySelector(`.inline-qty-input[data-group="${group}"]`);
                if (input) { input.value = Math.min(999, (parseInt(input.value) || 1) + 1); this._updatePreviewPrice(group); }
            });
        });

        this.body.querySelectorAll('.inline-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._addCurrentSize(); });
        });
    },

    /** Returns minimum allowed quantity for current product type */
    _getMinQty() {
        return (orderState.collection === 'Football' &&
                orderState.type &&
                orderState.type.toLowerCase().includes('training') &&
                orderState.trainingType === 'bespoke') ? 15 : 1;
    },

    _updatePreviewPrice(group) {
        if (this._pendingGroup !== group || !this._pendingSize) return;
        const row = this.rows.find(r => r.group === group);
        if (!row) return;
        const input = this.body.querySelector(`.inline-qty-input[data-group="${group}"]`);
        const newQty = Math.max(this._getMinQty(), parseInt(input?.value) || 1);
        const otherQty = orderState.sizeEntries
            .filter(e => e.priceGroup === group && e.size !== this._pendingSize)
            .reduce((s, e) => s + e.quantity, 0);
        const previewQty   = otherQty + newQty;
        const previewPrice = Helpers.getTierPrice(row.tiers, previewQty);

        const activeBtn = this.body.querySelector(`.size-btn.active[data-group="${group}"]`);
        if (activeBtn) {
            const sub = activeBtn.querySelector('span');
            if (sub) sub.textContent = Helpers.formatPrice(previewPrice);
        }
        this._refreshTierStrip(group, previewQty);
    },

    _refreshTierStrip(group, qty) {
        const strip = this.body.querySelector(`.tier-info-strip[data-group="${group}"]`);
        if (!strip) return;
        const row = this.rows.find(r => r.group === group);
        if (!row) return;
        strip.querySelectorAll('.tier-badge').forEach((badge, i) => {
            const t = row.tiers[i];
            if (!t) return;
            const isActive = qty >= t.min && (t.max === null || t.max === Infinity || qty <= t.max);
            badge.classList.toggle('active', isActive);
        });
    },

    _addCurrentSize() {
        if (!this._pendingSize || !this._pendingGroup) return;
        const row = this.rows.find(r => r.group === this._pendingGroup);
        if (!row) return;

        const qtyInput = this.body.querySelector(`.inline-qty-input[data-group="${this._pendingGroup}"]`);
        const qty = Math.max(this._getMinQty(), parseInt(qtyInput?.value) || 1);

        // Calculate tier price based on total group qty after adding this item
        const otherGroupQty = orderState.sizeEntries
            .filter(e => e.priceGroup === this._pendingGroup && e.size !== this._pendingSize)
            .reduce((s, e) => s + e.quantity, 0);
        const totalGroupQty = otherGroupQty + qty;
        const unitPrice = Helpers.getTierPrice(row.tiers, totalGroupQty);

        orderState.addSizeEntry(
            this._pendingSize,
            'size',
            this._pendingGroup,
            unitPrice,
            qty,
            row.taxGroupId,
            row.sku
        );

        this._pendingSize  = null;
        this._pendingGroup = null;
        this._warnConfirmedFor = new Set();
        this.render();
        this._checkComplete();
    },

    _renderSummaryTable() {
        const container = document.getElementById('sizeSummaryTable');
        if (!container) return;

        if (!orderState.sizeEntries.length) { container.innerHTML = ''; return; }

        let html = `
            <div class="size-summary">
                <table class="size-summary-table">
                    <thead>
                        <tr><th>SIZE</th><th>SKU</th><th>UNIT</th><th>QTY</th><th>TOTAL</th><th></th></tr>
                    </thead>
                    <tbody>
        `;

        orderState.sizeEntries.forEach(entry => {
            const g     = entry.priceGroup === 'junior' ? 'JNR' : 'ADT';
            const total = entry.unitPrice * entry.quantity;
            const sku   = entry.sku ? `<span style="font-size:10px;color:var(--text-muted);">${entry.sku}</span>` : '—';

            html += `
                <tr data-entry-size="${entry.size}" data-entry-group="${entry.priceGroup}">
                    <td class="size-summary-size">${g} ${entry.size}</td>
                    <td>${sku}</td>
                    <td class="size-summary-price">${Helpers.formatPrice(entry.unitPrice)}</td>
                    <td class="size-summary-qty">
                        <div class="qty-control qty-control-sm">
                            <button class="qty-btn qty-btn-sm summary-qty-down" data-size="${entry.size}" data-group="${entry.priceGroup}">−</button>
                            <span class="qty-display">${entry.quantity}</span>
                            <button class="qty-btn qty-btn-sm summary-qty-up" data-size="${entry.size}" data-group="${entry.priceGroup}">+</button>
                        </div>
                    </td>
                    <td class="size-summary-total">${Helpers.formatPrice(total)}</td>
                    <td><button class="summary-remove" data-size="${entry.size}" data-group="${entry.priceGroup}" title="Remove">×</button></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                    <tfoot>
                        <tr class="size-summary-grand">
                            <td colspan="3"><strong>TOTAL</strong></td>
                            <td><strong>${orderState.getTotalQuantity()}</strong></td>
                            <td><strong>${Helpers.formatPrice(orderState.lineTotal)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        container.innerHTML = html;
        this._bindSummaryEvents();
    },

    _bindSummaryEvents() {
        this.body.querySelectorAll('.summary-qty-down').forEach(btn => {
            btn.addEventListener('click', () => {
                const { size, group } = btn.dataset;
                const entry = orderState.sizeEntries.find(e => e.size === size && e.priceGroup === group);
                if (!entry || entry.quantity <= this._getMinQty()) return;
                const newQty = entry.quantity - 1;
                const warnKey = `${group}-${size}`;
                if (this._hasFilledAssignments(size, group, newQty) && !this._warnConfirmedFor.has(warnKey)) {
                    this._showWarnBanner(
                        `Reducing <strong>${group === 'junior' ? 'Junior' : 'Adult'} ${size}</strong> to ${newQty} will remove the last assignment entry.`,
                        () => {
                            this._warnConfirmedFor.add(warnKey);
                            this._trimAssignments(size, group, newQty);
                            orderState.updateSizeEntryQuantity(size, group, newQty);
                            this._renderSummaryTable();
                            this._refreshAllTierStrips();
                            this._updateSectionHeader();
                            OrderSummaryUI.update();
                            Section5?._renderNumberNameBreakdown?.();
                        }
                    );
                } else {
                    orderState.updateSizeEntryQuantity(size, group, newQty);
                    this._renderSummaryTable();
                    this._refreshAllTierStrips();
                    this._updateSectionHeader();
                    OrderSummaryUI.update();
                    Section5?._renderNumberNameBreakdown?.();
                }
            });
        });

        this.body.querySelectorAll('.summary-qty-up').forEach(btn => {
            btn.addEventListener('click', () => {
                const { size, group } = btn.dataset;
                const entry = orderState.sizeEntries.find(e => e.size === size && e.priceGroup === group);
                if (entry) {
                    orderState.updateSizeEntryQuantity(size, group, entry.quantity + 1);
                    this.render();
                    this._checkComplete();
                    OrderSummaryUI.update();
                    Section5?._renderNumberNameBreakdown?.();
                }
            });
        });

        this.body.querySelectorAll('.summary-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const { size, group } = btn.dataset;
                if (this._hasFilledAssignments(size, group, 0)) {
                    this._showWarnBanner(
                        `Removing <strong>${group === 'junior' ? 'Junior' : 'Adult'} ${size}</strong> will delete all name/number assignments for this size.`,
                        () => {
                            this._removeAssignments(size, group);
                            orderState.removeSizeEntry(size, group);
                            this.render();
                            this._checkComplete();
                            OrderSummaryUI.update();
                            Section5?._renderNumberNameBreakdown?.();
                        }
                    );
                } else {
                    orderState.removeSizeEntry(size, group);
                    this.render();
                    this._checkComplete();
                    OrderSummaryUI.update();
                    Section5?._renderNumberNameBreakdown?.();
                }
            });
        });
    },

    _refreshAllTierStrips() {
        ['adult', 'junior'].forEach(group => {
            const row = this.rows.find(r => r.group === group);
            if (!row) return;
            const groupQty = orderState.sizeEntries
                .filter(e => e.priceGroup === group)
                .reduce((s, e) => s + e.quantity, 0);
            const tierPrice = Helpers.getTierPrice(row.tiers, Math.max(groupQty, 1));
            this.body.querySelectorAll(`.size-btn[data-group="${group}"] span`).forEach(s => {
                s.textContent = Helpers.formatPrice(tierPrice);
            });
            this._refreshTierStrip(group, Math.max(groupQty, 1));
        });
    },

    _updateLeftPaneImage(group) {
        if (!orderState.productData) return;
        const p = orderState.productData;
        if (group === 'junior' && p.juniorImage) LeftPane.setImage(p.juniorImage);
        else if (group === 'adult'  && p.adultImage)  LeftPane.setImage(p.adultImage);
    },

    _updateSectionHeader() {
        const totalQty   = orderState.getTotalQuantity();
        const entryCount = orderState.sizeEntries.length;
        if (entryCount > 0) {
            this.el.querySelector('.section-header').innerHTML = `
                <span class="section-number">4</span>
                <span class="section-title">Size & Quantity</span>
                <span class="section-value">${entryCount} size${entryCount > 1 ? 's' : ''}, ${totalQty} items</span>
            `;
        }
    },

    _checkComplete() {
        if (orderState.sizeEntries.length > 0) {
            this._updateSectionHeader();
            const doneBtn = document.getElementById('popupDone4');
            if (doneBtn) {
                const total = orderState.getTotalQuantity();
                doneBtn.textContent = `Done — ${total} item${total > 1 ? 's' : ''} selected`;
            }
        } else {
            this.el.classList.remove('complete');
        }
    },

    // ─── Assignment helpers ───────────────────────────────

    /** Returns true if the assignment arrays for this size/group
     *  have any filled (non-empty) values at index >= fromIndex */
    _hasFilledAssignments(size, group, fromIndex) {
        const key = `${group}-${size}`;
        const c = orderState.customisation;
        const sources = [
            c.backNumbers?.assignments,
            c.names?.assignments,
            c.numberInitial?.assignments
        ].filter(Boolean);
        return sources.some(asgn => {
            const arr = asgn[key];
            if (!arr || !arr.length) return false;
            return arr.slice(fromIndex).some(v => v !== undefined && v !== '' && v !== null);
        });
    },

    /** Trim assignment arrays for size/group to newQty entries */
    _trimAssignments(size, group, newQty) {
        const key = `${group}-${size}`;
        const c = orderState.customisation;
        [c.backNumbers?.assignments, c.names?.assignments, c.numberInitial?.assignments]
            .filter(Boolean)
            .forEach(asgn => {
                if (asgn[key]) asgn[key] = asgn[key].slice(0, newQty);
            });
    },

    /** Remove all assignment entries for size/group */
    _removeAssignments(size, group) {
        const key = `${group}-${size}`;
        const c = orderState.customisation;
        [c.backNumbers?.assignments, c.names?.assignments, c.numberInitial?.assignments]
            .filter(Boolean)
            .forEach(asgn => { delete asgn[key]; });
    },

    /** Show inline warning banner with message and confirm/cancel actions */
    _showWarnBanner(msg, onConfirm) {
        const banner  = document.getElementById('s4WarnBanner');
        const msgEl   = document.getElementById('s4WarnMsg');
        const confirm = document.getElementById('s4WarnConfirm');
        const cancel  = document.getElementById('s4WarnCancel');
        if (!banner || !msgEl) return;

        msgEl.innerHTML = msg;
        banner.style.display = 'block';
        banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Replace event listeners each time
        const newConfirm = confirm.cloneNode(true);
        const newCancel  = cancel.cloneNode(true);
        confirm.replaceWith(newConfirm);
        cancel.replaceWith(newCancel);

        newConfirm.addEventListener('click', () => {
            banner.style.display = 'none';
            onConfirm();
        });
        newCancel.addEventListener('click', () => {
            banner.style.display = 'none';
        });
    },

    _updateDisplay() {
        this._renderSummaryTable();
        this._updateSectionHeader();
        OrderSummaryUI.update();
    }
};
