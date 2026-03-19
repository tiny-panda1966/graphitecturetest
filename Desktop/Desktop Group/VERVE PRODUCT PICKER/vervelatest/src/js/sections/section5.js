/**
 * section5.js — Customisation / Printing Options (UPDATED)
 *
 * Football Match Day flow restructured:
 *   Option 1 — Club Badge (switch + upload)
 *   Option 2 — Sponsors (switch, 4 individual uploads)
 *   Option 3 — Back Numbers (switch, 3 position checkboxes, popup table)
 *   Option 4 — Names (switch, popup table)
 *   Global — Font (Standard/Exclusive) + Colour (Premium+ Vinyl)
 *   Footer — "VerveSport guarantee — 12 months"
 */
const Section5 = {
    el: null,
    body: null,
    optionsData: null,
    colourEffectsData: null,
    footballColoursData: null,
    leftPaneImages: {},

    init() {
        this.el = document.getElementById('section5');
        this.body = document.getElementById('popupBody5');
        Messaging.on('CUSTOMISATION_OPTIONS', (data) => this.onOptionsReceived(data));
        Messaging.on('COLOUR_EFFECTS_DATA', (data) => this.onColourEffectsReceived(data));
        Messaging.on('FOOTBALL_COLOURS_DATA', (data) => this.onFootballColoursReceived(data));
        Messaging.on('UPLOAD_COMPLETE', (data) => this.onUploadComplete(data));
    },

    activate() {
        const custType = orderState.getCustomisationType();
        if (!custType) return;
        orderState.customisation.type = custType;
        Messaging.requestCustomisation(orderState.collection, orderState.type);
        this.body.innerHTML = '<p class="text-sm text-muted">Loading customisation options...</p>';
    },

    onOptionsReceived(data) {
        this.optionsData = data.options || data;
        this.leftPaneImages = data.images || {};

        console.log('[S5] leftPaneImages:', JSON.stringify(this.leftPaneImages));

        // Store SKU-based printing options in state (replaces old flat prices)
        if (data.printingOptions?.length) {
            orderState.setPrintingOptions(data.printingOptions);
        }

        this.render();
    },

    onColourEffectsReceived(data) {
        this.colourEffectsData = data.effects || data;
        // If font preview popup is open, route there instead of main grid
        if (this._fontPopupColourCallback) {
            const effects = Array.isArray(this.colourEffectsData) ? this.colourEffectsData : (this.colourEffectsData.effects || []);
            this._fontPopupColourCallback(effects);
        } else {
            this._renderColourEffectSwatches();
        }
    },

    onFootballColoursReceived(data) {
        this.footballColoursData = data.colours || data;
        this._renderFootballColourSwatches();
    },

    onUploadComplete(data) {
        const field = data.field;
        const mediaUrl = data.mediaUrl || data.url;
        if (!field || !mediaUrl) return;
        const c = orderState.customisation;
        if (field.startsWith('sponsors-')) {
            const sub = field.replace('sponsors-', '');
            if (c.sponsors[sub]) c.sponsors[sub].mediaUrl = mediaUrl;
        } else if (c[field] && typeof c[field] === 'object') {
            c[field].mediaUrl = mediaUrl;
            // Mark as enabled when uploaded — drives order summary
            if (field === 'backBadge' || field === 'backSponsor' || field === 'sponsor' || field === 'clubBadge') {
                c[field].enabled = true;
            }
        }
        const btn = this.body.querySelector(`[data-upload-field="${field}"]`);
        if (btn) btn.classList.add('has-file');

        // Show tick on the active back-option tab after upload
        if (field === 'backBadge' || field === 'backSponsor') {
            const mode = field === 'backBadge' ? 'badge' : 'sponsor';
            const tab = this.body.querySelector(`[data-backoption="${mode}"]`);
            if (tab && !tab.querySelector('.tab-confirm-tick')) {
                const tick = document.createElement('span');
                tick.className = 'tab-confirm-tick';
                tick.textContent = '✓';
                tab.appendChild(tick);
            }
            // Badge and Text are mutually exclusive — clear the other when badge uploaded
            if (field === 'backBadge') {
                const c2 = orderState.customisation;
                if (c2.backText) { c2.backText.enabled = false; c2.backText.text = ''; c2.backText.text2 = ''; }
                const textTab = this.body.querySelector('[data-backoption="text"]');
                if (textTab) { const t = textTab.querySelector('.tab-confirm-tick'); if (t) t.remove(); }
            }
        }
        orderState.recalculate();
        OrderSummaryUI.update();
    },

    render() {
        const custType = orderState.customisation.type;
        switch (custType) {
            case 'boxing-activewear':  this._renderBoxingActivewear(); break;
            case 'boxing-fightwear':   this._renderBoxingFightwear(); break;
            case 'football-matchday':  this._renderFootballMatchDay(); break;
            case 'football-training':  this._renderFootballTraining(); break;
            default:
                this.body.innerHTML = '<p class="text-sm text-muted">Customisation options not available.</p>';
        }
    },

    // ═══════════════════════════════════════════════
    // FOOTBALL MATCH DAY (NEW FLOW)
    // ═══════════════════════════════════════════════
    _renderFootballMatchDay() {
        const c = orderState.customisation;
        const opts = this.optionsData || {};
        const qty = orderState.getTotalQuantity() || orderState.quantity || 1;
        const font = c.font || 'standard';

        // Derive display prices from newPrinting SKU tiers at current quantity
        const fmtSku = (sku) => {
            const p = orderState.getSkuPrice(sku, qty);
            return p > 0 ? Helpers.formatPrice(p) : '—';
        };
        const badgeSku    = c.clubBadge.kitType === 'kit' ? 'PF-001B' : 'PF-001A';
        const badgePrice  = fmtSku(badgeSku);
        const rightSleevePrice  = fmtSku('PF-011');
        const leftSleevePrice   = fmtSku('PF-012');
        const frontSponsorPrice = fmtSku('PF-002');
        const backSponsorPrice  = fmtSku('PF-003');
        const numberPrice  = fmtSku(font === 'exclusive' ? 'PF-005' : 'PF-004'); // back-of-shirt representative
        const namePrice    = fmtSku(font === 'exclusive' ? 'PF-010' : 'PF-009');

        this.body.innerHTML = `
            <!-- OPTION 1: CLUB BADGE -->
            ${this._optionRow('clubBadge','Club Badge',badgePrice,true)}
            <div class="sub-options" id="clubBadgeSub">
                <div class="sub-option-group">
                    <div class="sub-option-label">Badge Position</div>
                    <div class="tab-row">
                        <button class="tab-btn" data-pos="central">Central</button>
                        <button class="tab-btn" data-pos="standard">Standard</button>
                    </div>
                </div>
                <div class="sub-option-group" id="badgeOptionGroup">
                    <div class="sub-option-label">Badge Option</div>
                    <div class="tab-row">
                        <button class="tab-btn" data-badge="none">None</button>
                        <button class="tab-btn" data-badge="creation">Badge Creation +£10</button>
                        <button class="tab-btn" data-badge="redesign">Badge Re-design +£5</button>
                    </div>
                </div>
                <div id="badgeRedesignMsg" style="display:none;padding:8px 0;font-size:11px;color:var(--text-muted);font-style:italic;">We will discuss &amp; confirm your badge redesign request after payment.</div>
            </div>

            <!-- OPTION 2: SPONSORS -->
            ${this._optionRow('sponsors','Sponsors','',false)}
            <div class="sub-options" id="sponsorsSub">
                <div class="sub-option-group sponsor-uploads">
                    ${this._sponsorUploadRow('sponsors-rightSleeve','Right Sleeve', rightSleevePrice)}
                    ${this._sponsorUploadRow('sponsors-leftSleeve','Left Sleeve', leftSleevePrice)}
                    ${this._sponsorUploadRow('sponsors-frontSponsor','Front Sponsor', frontSponsorPrice)}
                    ${this._sponsorUploadRow('sponsors-backSponsor','Back Sponsor', backSponsorPrice)}
                </div>
            </div>

            <!-- OPTION 3: BACK NUMBERS -->
            ${this._optionRow('backNumbers','Numbers','',false)}
            <div class="sub-options" id="backNumbersSub">
                <div class="sub-option-group">
                    ${this._numberPositionRow('topLeftShirt',    'Back of Shirt', '21cm', fmtSku(font==='exclusive'?'PF-005':'PF-004'))}
                    ${this._numberPositionRow('bottomRightShorts','Shorts',        '8cm',  fmtSku(font==='exclusive'?'PF-007':'PF-006'))}
                    ${this._numberPositionRow('backOfShirt',      'Training',      '3cm',  fmtSku('PF-008'))}
                </div>
                <div id="backNumbersBreakdown" class="assignment-breakdown"></div>
                <div class="sub-option-group" style="margin-top:8px;">
                    <button class="tab-btn" id="editNumbersBtn" style="width:100%;text-align:center;">Edit Numbers →</button>
                </div>
            </div>

            <!-- OPTION 4: NAMES -->
            ${this._optionRow('names','Names',namePrice,false)}
            <div class="sub-options" id="namesSub">
                <div id="namesBreakdown" class="assignment-breakdown"></div>
                <div class="sub-option-group" style="margin-top:8px;">
                    <button class="tab-btn" id="editNamesBtn" style="width:100%;text-align:center;">Edit Names →</button>
                </div>
            </div>

            <!-- GLOBAL FONT & COLOUR -->
            <div class="global-options">
                <div class="global-option">
                    <span class="global-label">FONT:</span>
                    <button class="global-value-btn" id="fontPickerBtn">${c.font==='exclusive'?'EXCLUSIVE':'STANDARD'}</button>
                </div>
                <div class="global-option" style="flex-wrap:wrap;gap:6px;">
                    <span class="global-label">COLOUR:</span>
                    <button class="global-value-btn" id="colourPickerBtn">PREMIUM+ VINYL</button>
                    <span id="kitColourLabel" style="font-size:11px;color:var(--text-muted);align-self:center;"></span>
                </div>
            </div>
            <div class="inline-popup" id="fontPopup" style="display:none;">
                <div class="sub-option-label">Select Font Style</div>
                <div class="tab-row">
                    <button class="tab-btn ${c.font==='standard'?'active':''}" data-font="standard">Standard</button>
                    <button class="tab-btn ${c.font==='exclusive'?'active':''}" data-font="exclusive">Exclusive</button>
                </div>
            </div>
            <div class="inline-popup" id="colourPopup" style="display:block;">
                <div class="sub-option-label">Select Colour</div>
                <div class="colour-swatch-grid" id="printColourGrid"><p class="text-sm text-muted">Loading colours...</p></div>
            </div>

            <!-- GUARANTEE -->
            <div class="guarantee-footer">
                <button class="guarantee-btn" id="guaranteeBtn">Click here to see our 12 month printing guarantee</button>
            </div>
            <div class="guarantee-popup" id="guaranteePopup" style="display:none;">
                <div class="guarantee-popup-overlay" id="guaranteeOverlay"></div>
                <div class="guarantee-popup-content">
                    <button class="guarantee-popup-close" id="guaranteeClose">×</button>
                    <p>VerveSport offer a 12-month guarantee on all customised garments. In the unfortunate event your prints have come off the garments purchased, we will re-print/replace the print free of charge.</p>
                </div>
            </div>
        `;

        this._bindFootballMatchDaySwitches();
        this._bindGuaranteePopup();
        this._restoreUIFromState();
        this._renderNumberNameBreakdown();
        Messaging.requestColourEffects('Premium Vinyl B');

        // Set kit colour label live — updates if user goes back to section 3
        const _updateKitLabel = () => {
            const el = document.getElementById('kitColourLabel');
            if (!el) return;
            const name = orderState.variant?.displayName;
            el.textContent = name ? `Kit colour: ${name}` : '';
        };
        _updateKitLabel();
        if (this._kitLabelUnsubscribe) this._kitLabelUnsubscribe();
        this._kitLabelUnsubscribe = orderState.onChange(_updateKitLabel);
    },

    /** Option row: LABEL £PRICE [SWITCH] [UPLOAD] */
    _optionRow(field, name, priceDisplay, hasUpload) {
        const upHtml = hasUpload ? `<button class="upload-btn" data-upload-field="${field}"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>` : '';
        return `<div class="option-row" data-option="${field}"><div class="option-info"><span class="option-name">${name}</span></div><span class="option-price">${priceDisplay}</span><div class="option-controls"><div class="toggle-switch" data-field="${field}"></div>${upHtml}</div></div>`;
    },

    /** Individual number position row — switch only, no upload */
    _numberPositionRow(pos, label, size, price) {
        const isOn = !!(orderState.customisation.backNumbers?.positions?.[pos]);
        const activeClass = isOn ? ' is-on' : '';
        const priceTag = price && price !== '—' ? `<span class="option-desc" style="font-size:10px;color:var(--text-muted);margin-left:6px;">${price}/pos</span>` : '';
        const sizeTag  = size ? `<span class="option-desc" style="font-size:10px;color:var(--text-muted);margin-left:4px;">${size}</span>` : '';
        return `<div class="option-row sponsor-upload-row" style="padding:6px 0;" data-numpos-row="${pos}"><div class="option-info"><span class="option-name" style="font-size:12px;">${label}</span>${sizeTag}${priceTag}</div><div class="option-controls"><div class="toggle-switch numpos-switch${activeClass}" data-numpos="${pos}"></div></div></div>`;
    },

    /** Individual sponsor upload slot */
    _sponsorUploadRow(field, label, price) {
        const priceTag = price ? `<span class="option-desc" style="font-size:10px;color:var(--text-muted);margin-left:6px;">${price}/pos</span>` : '';
        return `<div class="option-row sponsor-upload-row" style="padding:6px 0;"><div class="option-info"><span class="option-name" style="font-size:12px;">${label}</span>${priceTag}</div><div class="option-controls"><div class="toggle-switch" data-field="${field}"></div><button class="upload-btn" data-upload-field="${field}"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button></div></div>`;
    },

    // ═══════════════════════════════════════════════
    // NUMBER / NAME BREAKDOWN
    // ═══════════════════════════════════════════════
    _renderNumberNameBreakdown() {
        const entries = orderState.sizeEntries;
        const nums = orderState.customisation.backNumbers.assignments;
        const names = orderState.customisation.names.assignments;

        const numC = document.getElementById('backNumbersBreakdown');
        if (numC) {
            if (entries.length && orderState.customisation.backNumbers.enabled) {
                let h = '';
                entries.forEach(e => {
                    const k = OrderState.sizeKey(e);
                    const gl = e.priceGroup === 'junior' ? 'JUNIOR' : 'ADULT';
                    const nl = (nums[k]||[]).join(', ');
                    h += `<div class="assignment-row"><span class="assignment-label">${gl} ${e.size} × ${e.quantity}</span><span class="assignment-values">${nl||'—'}</span></div>`;
                });
                numC.innerHTML = h;
            } else { numC.innerHTML = ''; }
        }

        const nameC = document.getElementById('namesBreakdown');
        if (nameC) {
            if (entries.length && orderState.customisation.names.enabled) {
                let h = '';
                entries.forEach(e => {
                    const k = OrderState.sizeKey(e);
                    const gl = e.priceGroup === 'junior' ? 'JUNIOR' : 'ADULT';
                    const nl = (names[k]||[]).filter(n=>n).join(', ');
                    h += `<div class="assignment-row"><span class="assignment-label">${gl} ${e.size} × ${e.quantity}</span><span class="assignment-values">${nl||'—'}</span></div>`;
                });
                nameC.innerHTML = h;
            } else { nameC.innerHTML = ''; }
        }
    },

    // ═══════════════════════════════════════════════
    // POPUP TABLES
    // ═══════════════════════════════════════════════
    _renderSurnamesBreakdown() {
        const entries = orderState.sizeEntries;
        const assigns = orderState.customisation.name.surnameAssignments || {};
        const ctn = document.getElementById('surnamesBreakdown');
        if (!ctn) return;
        if (entries.length && orderState.customisation.name.enabled) {
            let h = '';
            entries.forEach(e => {
                const k = OrderState.sizeKey(e);
                const gl = e.priceGroup === 'junior' ? 'JUNIOR' : 'ADULT';
                const nl = (assigns[k] || []).filter(n => n).join(', ');
                h += `<div class="assignment-row"><span class="assignment-label">${gl} ${e.size} × ${e.quantity}</span><span class="assignment-values">${nl || '—'}</span></div>`;
            });
            ctn.innerHTML = h;
        } else { ctn.innerHTML = ''; }
    },

    _showSurnamesPopup() {
        const entries = orderState.sizeEntries;
        if (!entries.length) return;
        if (!orderState.customisation.name.surnameAssignments) orderState.customisation.name.surnameAssignments = {};
        const assigns = orderState.customisation.name.surnameAssignments;
        let rows = '';
        entries.forEach(e => {
            const k = OrderState.sizeKey(e);
            const gl = e.priceGroup === 'junior' ? 'Junior' : 'Adult';
            const a = assigns[k] || [];
            rows += `<tr class="popup-group-header"><td colspan="2" style="font-weight:600;padding:10px 8px 4px;color:var(--text-primary);font-size:12px;">${gl} ${e.size} × ${e.quantity}</td></tr>`;
            for (let i = 0; i < e.quantity; i++) {
                rows += `<tr><td style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">Fighter ${i + 1}</td><td style="padding:4px 8px;"><input type="text" class="picker-input popup-surname-input" data-key="${k}" data-index="${i}" value="${a[i] || ''}" placeholder="Enter surname" style="width:140px;"></td></tr>`;
            }
        });
        this._showAssignmentPopup('Edit Surnames', rows, 'surnames');
    },

    _renderInitialsBreakdown() {
        const entries = orderState.sizeEntries;
        const assigns = orderState.customisation.numberInitial.assignments;
        const ctn = document.getElementById('initialsBreakdown');
        if (!ctn) return;
        if (entries.length && orderState.customisation.numberInitial.enabled) {
            let h = '';
            entries.forEach(e => {
                const k = OrderState.sizeKey(e);
                const gl = e.priceGroup === 'junior' ? 'JUNIOR' : 'ADULT';
                const nl = (assigns[k]||[]).filter(n=>n).join(', ');
                h += `<div class="assignment-row"><span class="assignment-label">${gl} ${e.size} × ${e.quantity}</span><span class="assignment-values">${nl||'—'}</span></div>`;
            });
            ctn.innerHTML = h;
        } else { ctn.innerHTML = ''; }
    },

    _showInitialsPopup() {
        const entries = orderState.sizeEntries;
        if (!entries.length) return;
        const assigns = orderState.customisation.numberInitial.assignments;
        let rows = '';
        entries.forEach(e => {
            const k = OrderState.sizeKey(e);
            const gl = e.priceGroup==='junior'?'Junior':'Adult';
            const a = assigns[k]||[];
            rows += `<tr class="popup-group-header"><td colspan="2" style="font-weight:600;padding:10px 8px 4px;color:var(--text-primary);font-size:12px;">${gl} ${e.size} × ${e.quantity}</td></tr>`;
            for (let i=0;i<e.quantity;i++) {
                rows += `<tr><td style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">Player ${i+1}</td><td style="padding:4px 8px;"><input type="text" class="picker-input popup-initial-input" data-key="${k}" data-index="${i}" value="${a[i]||''}" placeholder="e.g. 7 or J" maxlength="3" style="width:100px;text-align:center;"></td></tr>`;
            }
        });
        this._showAssignmentPopup('Edit Numbers / Initials', rows, 'initials');
    },

    _showNumbersPopup() {
        const entries = orderState.sizeEntries;
        const nums = orderState.customisation.backNumbers.assignments;
        let rows = '';
        entries.forEach(e => {
            const k = OrderState.sizeKey(e);
            const gl = e.priceGroup==='junior'?'Junior':'Adult';
            const a = nums[k]||[];
            rows += `<tr class="popup-group-header"><td colspan="2" style="font-weight:600;padding:10px 8px 4px;color:var(--text-primary);font-size:12px;">${gl} ${e.size} × ${e.quantity}</td></tr>`;
            for (let i=0;i<e.quantity;i++) {
                rows += `<tr><td style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">Player ${i+1}</td><td style="padding:4px 8px;"><input type="text" class="picker-input popup-number-input" data-key="${k}" data-index="${i}" value="${a[i]!==undefined?a[i]:''}" placeholder="${i+2}" style="width:60px;text-align:center;"></td></tr>`;
            }
        });
        this._showAssignmentPopup('Edit Shirt Numbers', rows, 'numbers');
    },

    _showNamesPopup() {
        const entries = orderState.sizeEntries;
        const names = orderState.customisation.names.assignments;
        let rows = '';
        entries.forEach(e => {
            const k = OrderState.sizeKey(e);
            const gl = e.priceGroup==='junior'?'Junior':'Adult';
            const a = names[k]||[];
            rows += `<tr class="popup-group-header"><td colspan="2" style="font-weight:600;padding:10px 8px 4px;color:var(--text-primary);font-size:12px;">${gl} ${e.size} × ${e.quantity}</td></tr>`;
            for (let i=0;i<e.quantity;i++) {
                rows += `<tr><td style="padding:4px 8px;font-size:12px;color:var(--text-secondary);">Player ${i+1}</td><td style="padding:4px 8px;"><input type="text" class="picker-input popup-name-input" data-key="${k}" data-index="${i}" value="${a[i]||''}" placeholder="Enter name" style="width:140px;"></td></tr>`;
            }
        });
        this._showAssignmentPopup('Edit Player Names', rows, 'names');
    },

    _showAssignmentPopup(title, rowsHtml, type) {
        const existing = document.getElementById('assignmentPopup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'assignmentPopup';
        popup.className = 'assignment-popup';
        popup.innerHTML = `
            <div class="assignment-popup-overlay"></div>
            <div class="assignment-popup-content">
                <div class="assignment-popup-header">
                    <span class="assignment-popup-title">${title}</span>
                    <button class="assignment-popup-close" id="closeAssignmentPopup">×</button>
                </div>
                <div class="assignment-popup-body">
                    <table class="assignment-table" style="width:100%;"><tbody>${rowsHtml}</tbody></table>
                </div>
                <div class="assignment-popup-footer">
                    <button class="tab-btn active" id="saveAssignmentPopup" style="width:100%;padding:10px;">Save & Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.classList.add('visible'));

        const close = () => { popup.classList.remove('visible'); setTimeout(()=>popup.remove(),200); };
        popup.querySelector('#closeAssignmentPopup').addEventListener('click', close);
        popup.querySelector('.assignment-popup-overlay').addEventListener('click', close);

        popup.querySelector('#saveAssignmentPopup').addEventListener('click', () => {
            if (type === 'numbers') {
                popup.querySelectorAll('.popup-number-input').forEach(input => {
                    const k = input.dataset.key, idx = parseInt(input.dataset.index);
                    if (!orderState.customisation.backNumbers.assignments[k]) orderState.customisation.backNumbers.assignments[k] = [];
                    const v = input.value.trim();
                    orderState.customisation.backNumbers.assignments[k][idx] = v===''?(idx+2):v;
                });
            } else if (type === 'names') {
                popup.querySelectorAll('.popup-name-input').forEach(input => {
                    const k = input.dataset.key, idx = parseInt(input.dataset.index);
                    if (!orderState.customisation.names.assignments[k]) orderState.customisation.names.assignments[k] = [];
                    orderState.customisation.names.assignments[k][idx] = input.value.trim();
                });
            } else if (type === 'initials') {
                popup.querySelectorAll('.popup-initial-input').forEach(input => {
                    const k = input.dataset.key, idx = parseInt(input.dataset.index);
                    if (!orderState.customisation.numberInitial.assignments[k]) orderState.customisation.numberInitial.assignments[k] = [];
                    orderState.customisation.numberInitial.assignments[k][idx] = input.value.trim();
                });
                this._renderInitialsBreakdown();
            } else if (type === 'surnames') {
                if (!orderState.customisation.name.surnameAssignments) orderState.customisation.name.surnameAssignments = {};
                popup.querySelectorAll('.popup-surname-input').forEach(input => {
                    const k = input.dataset.key, idx = parseInt(input.dataset.index);
                    if (!orderState.customisation.name.surnameAssignments[k]) orderState.customisation.name.surnameAssignments[k] = [];
                    orderState.customisation.name.surnameAssignments[k][idx] = input.value.trim();
                });
                this._renderSurnamesBreakdown();
            }
            this._renderNumberNameBreakdown();
            orderState.recalculate();
            OrderSummaryUI.update();
            close();
        });
    },

    // ═══════════════════════════════════════════════════════
    // STATE RESTORATION — called after every render+bind pass
    // Reads orderState.customisation and reapplies active classes,
    // expanded panels, checked inputs, select values & button labels.
    // ═══════════════════════════════════════════════════════
    _restoreUIFromState() {
        const c = orderState.customisation;
        const type = c.type;

        // ── Helper: activate a toggle switch + expand its sub-panel ──
        const restoreSwitch = (field, enabled) => {
            if (!enabled) return;
            const sw = this.body.querySelector(`.toggle-switch[data-field="${field}"]`);
            if (sw) sw.classList.add('active');
            const sub = document.getElementById(`${field}Sub`);
            if (sub) sub.classList.add('expanded');
        };

        // ── Helper: activate a tab button by data attribute ──
        const restoreTab = (attr, val) => {
            if (!val) return;
            const btn = this.body.querySelector(`[${attr}="${val}"]`);
            if (btn) {
                btn.closest('.tab-row')?.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        };

        // ── Helper: mark upload button as having a file ──
        const restoreUpload = (field, mediaUrl) => {
            if (!mediaUrl) return;
            const btn = this.body.querySelector(`[data-upload-field="${field}"]`);
            if (btn) btn.classList.add('has-file');
        };

        if (type === 'football-matchday') {
            restoreSwitch('clubBadge', c.clubBadge.enabled);
            if (c.clubBadge.enabled) {
                restoreTab('data-pos', c.clubBadge.position);
                restoreTab('data-badge', c.clubBadge.type || 'none');
                // Redesign message
                const msg = document.getElementById('badgeRedesignMsg');
                if (msg) msg.style.display = c.clubBadge.type === 'redesign' ? 'block' : 'none';
                restoreUpload('clubBadge', c.clubBadge.mediaUrl);
            }

            restoreSwitch('sponsors', c.sponsors.enabled);
            if (c.sponsors.enabled) {
                ['rightSleeve','leftSleeve','frontSponsor','backSponsor'].forEach(pos => {
                    if (c.sponsors[pos]?.enabled) {
                        const sw = this.body.querySelector(`.toggle-switch[data-field="sponsors-${pos}"]`);
                        if (sw) sw.classList.add('active');
                        restoreUpload(`sponsors-${pos}`, c.sponsors[pos].mediaUrl);
                    }
                });
            }

            restoreSwitch('backNumbers', c.backNumbers.enabled);
            if (c.backNumbers.enabled) {
                Object.entries(c.backNumbers.positions || {}).forEach(([pos, checked]) => {
                    if (checked) {
                        const sw = this.body.querySelector(`.numpos-switch[data-numpos="${pos}"]`);
                        if (sw) sw.classList.add('is-on');
                    }
                });
            }

            restoreSwitch('names', c.names.enabled);

            // Font & colour button labels
            const fb = document.getElementById('fontPickerBtn');
            if (fb) fb.textContent = c.font === 'exclusive' ? 'EXCLUSIVE' : 'STANDARD';
            restoreTab('data-font', c.font);

            const cb2 = document.getElementById('colourPickerBtn');
            if (cb2 && c.printColour?.name) cb2.textContent = c.printColour.name;

            this._renderNumberNameBreakdown();

        } else if (type === 'football-training') {
            restoreSwitch('clubBadge', c.clubBadge.enabled);
            restoreUpload('clubBadge', c.clubBadge.mediaUrl);

            restoreSwitch('numberInitial', c.numberInitial?.enabled);
            this._renderInitialsBreakdown();

            restoreSwitch('frontSponsor', c.frontSponsor?.enabled);
            if (c.frontSponsor?.enabled) {
                ['rightSleeveSponsor','leftSleeveSponsor','backSponsor'].forEach(f => {
                    if (c[f]?.enabled) {
                        const sw = this.body.querySelector(`.toggle-switch[data-field="${f}"]`);
                        if (sw) sw.classList.add('active');
                        restoreUpload(f, c[f].mediaUrl);
                    }
                });
            }

            const vcb = document.getElementById('verveColourPickerBtn');
            if (vcb && c.verveLogoColour?.name) vcb.textContent = c.verveLogoColour.name;

            const icb = document.getElementById('initialsColourPickerBtn');
            if (icb && c.numberInitialColour?.name) icb.textContent = c.numberInitialColour.name;

        } else if (type === 'boxing-activewear') {
            restoreSwitch('clubBadge', c.clubBadge?.enabled);
            restoreUpload('clubBadge', c.clubBadge?.mediaUrl);

            // backOption switch
            const backEnabled = !!(c.backBadgeMode && c.backBadgeMode !== 'badge') ||
                c.backBadge?.enabled || c.backSponsor?.enabled || c.backText?.enabled;
            restoreSwitch('backOption', backEnabled);
            if (backEnabled) {
                const mode = c.backBadgeMode || 'badge';
                restoreTab('data-backoption', mode);
                document.getElementById('backOptionBadgeWrap').style.display   = mode === 'badge'   ? 'block' : 'none';
                document.getElementById('backOptionSponsorWrap').style.display = mode === 'sponsor' ? 'block' : 'none';
                document.getElementById('backOptionTextWrap').style.display    = mode === 'text'    ? 'block' : 'none';

                restoreUpload('backBadge', c.backBadge?.mediaUrl);
                restoreUpload('backSponsor', c.backSponsor?.mediaUrl);
                // Restore confirmation ticks — badge and text are mutually exclusive
                const activeMode = c.backBadgeMode || 'badge';
                if (activeMode === 'badge' && c.backBadge?.enabled) {
                    const t = this.body.querySelector('[data-backoption="badge"]');
                    if (t && !t.querySelector('.tab-confirm-tick')) { const tk = document.createElement('span'); tk.className='tab-confirm-tick'; tk.textContent='✓'; t.appendChild(tk); }
                } else if (activeMode === 'text' && c.backText?.enabled) {
                    const t = this.body.querySelector('[data-backoption="text"]');
                    if (t && !t.querySelector('.tab-confirm-tick')) { const tk = document.createElement('span'); tk.className='tab-confirm-tick'; tk.textContent='✓'; t.appendChild(tk); }
                }
                // Sponsor tick is always independent
                if (c.backSponsor?.enabled) {
                    const t = this.body.querySelector('[data-backoption="sponsor"]');
                    if (t && !t.querySelector('.tab-confirm-tick')) { const tk = document.createElement('span'); tk.className='tab-confirm-tick'; tk.textContent='✓'; t.appendChild(tk); }
                }

                // Restore text summary
                if (mode === 'text' && (c.backText?.font || c.backText?.text)) {
                    const summary = document.getElementById('backTextPreviewSummary');
                    if (summary) {
                        const label = [c.backText.font?.fontName, c.backText.text].filter(Boolean).join(' — ');
                        if (label) { summary.textContent = label; summary.style.display = 'block'; }
                    }
                }
            }

            restoreSwitch('sponsor', c.sponsor?.enabled);
            restoreUpload('sponsor', c.sponsor?.mediaUrl);

        } else if (type === 'boxing-fightwear') {
            restoreSwitch('name', c.name?.enabled);
            if (c.name?.enabled && (c.name?.font || c.name?.text)) {
                const summary = document.getElementById('fwNameSummary');
                if (summary) {
                    const label = [c.name.font?.fontName, c.name.text].filter(Boolean).join(' — ');
                    summary.textContent = label;
                    summary.style.display = label ? 'block' : 'none';
                }
            }

            restoreSwitch('fwSponsors', c.fwSponsors?.enabled);
            if (c.fwSponsors?.enabled && c.fwSponsors.positions?.length) {
                c.fwSponsors.positions.forEach(code => {
                    const cb = this.body.querySelector(`[data-fwsponsor="${code}"]`);
                    if (cb) {
                        cb.checked = true;
                        // Show the inline upload button
                        const row = cb.closest('.fw-sponsor-row');
                        const uploadBtn = row?.querySelector('.upload-btn-sm');
                        if (uploadBtn) uploadBtn.style.display = 'inline-flex';
                        // Mark if already uploaded
                        restoreUpload(`fwSponsor-${code}`, c.fwSponsors.uploads?.[code]);
                    }
                });
            }
        }
    },
    _bindFootballMatchDaySwitches() {
        this._bindSwitches();
        const c = orderState.customisation;

        // Kit-type tabs (Shirt Only / Full Kit) — determines PF-001A vs PF-001B
        // Badge tabs (None / Creation / Redesign)
        this.body.querySelectorAll('[data-badge]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.body.querySelectorAll('[data-badge]').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                const t = btn.dataset.badge;
                const msg = document.getElementById('badgeRedesignMsg');
                if (t === 'none') {
                    c.clubBadge.type = null;
                    c.clubBadge.badgeSurcharge = 0;
                    if (msg) msg.style.display = 'none';
                    if (orderState.variant) LeftPane.setImage(orderState.variant.imageUrl);
                } else {
                    c.clubBadge.type = t;
                    c.clubBadge.badgeSurcharge = t === 'creation' ? 10 : t === 'redesign' ? 5 : 0;
                    if (msg) msg.style.display = t === 'redesign' ? 'block' : 'none';
                    // Badge option — show club badge image
                    if (this.leftPaneImages.clubBadge) LeftPane.setImage(this.leftPaneImages.clubBadge);
                }
                orderState.recalculate(); OrderSummaryUI.update();
            });
        });

        this.body.querySelectorAll('[data-pos]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.body.querySelectorAll('[data-pos]').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                c.clubBadge.position = btn.dataset.pos;
                // Badge position — show clubBadgePosition image
                if (this.leftPaneImages.clubBadgePosition) LeftPane.setImage(this.leftPaneImages.clubBadgePosition);
                else if (this.leftPaneImages.clubBadge) LeftPane.setImage(this.leftPaneImages.clubBadge);
            });
        });

        // Number position switches (replace checkboxes)
        this.body.querySelectorAll('.numpos-switch').forEach(sw => {
            sw.addEventListener('click', () => {
                const pos = sw.dataset.numpos;
                const isNowOn = !sw.classList.contains('is-on');
                sw.classList.toggle('is-on', isNowOn);
                c.backNumbers.positions[pos] = isNowOn;
                orderState.recalculate();
                OrderSummaryUI.update();
            });
        });

        // Edit buttons
        const enb = document.getElementById('editNumbersBtn');
        if (enb) enb.addEventListener('click', ()=>this._showNumbersPopup());
        const enab = document.getElementById('editNamesBtn');
        if (enab) enab.addEventListener('click', ()=>this._showNamesPopup());

        // Font picker
        const fb = document.getElementById('fontPickerBtn');
        if (fb) fb.addEventListener('click', () => {
            const fp = document.getElementById('fontPopup');
            const cp = document.getElementById('colourPopup');
            if (fp) fp.style.display = fp.style.display==='none'?'block':'none';
            if (cp) cp.style.display = 'none';
        });

        this.body.querySelectorAll('[data-font]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.body.querySelectorAll('[data-font]').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                c.font = btn.dataset.font;
                const fb2 = document.getElementById('fontPickerBtn');
                if (fb2) fb2.textContent = c.font==='exclusive'?'EXCLUSIVE':'STANDARD';
                document.getElementById('fontPopup').style.display = 'none';
                // Font — nameTypes shows name font options, numberOptions shows number font options
                if (c.font === 'exclusive') {
                    if (this.leftPaneImages.numberOptions) LeftPane.setImage(this.leftPaneImages.numberOptions);
                    else if (this.leftPaneImages.nameTypes) LeftPane.setImage(this.leftPaneImages.nameTypes);
                } else {
                    if (this.leftPaneImages.nameTypes) LeftPane.setImage(this.leftPaneImages.nameTypes);
                    else if (this.leftPaneImages.names) LeftPane.setImage(this.leftPaneImages.names);
                }
                orderState.recalculate(); OrderSummaryUI.update();
            });
        });

        // Colour picker
        const cb = document.getElementById('colourPickerBtn');
        if (cb) cb.addEventListener('click', () => {
            const cp = document.getElementById('colourPopup');
            const fp = document.getElementById('fontPopup');
            if (cp) cp.style.display = cp.style.display==='none'?'block':'none';
            if (fp) fp.style.display = 'none';
        });
    },

    // ═══════════════════════════════════════════════
    // SHARED SWITCH BINDING
    // ═══════════════════════════════════════════════
    _bindSwitches() {
        this.body.querySelectorAll('.toggle-switch[data-field]').forEach(sw => {
            sw.addEventListener('click', () => {
                sw.classList.toggle('active');
                this._onSwitchChange(sw.dataset.field, sw.classList.contains('active'));
            });
        });
        this.body.querySelectorAll('.upload-btn[data-upload-field]').forEach(btn => {
            btn.addEventListener('click', () => Messaging.requestUpload(btn.dataset.uploadField, btn.dataset.uploadField));
        });
    },

    _onSwitchChange(field, enabled) {
        const c = orderState.customisation;
        // Handle sponsor sub-fields (e.g. "sponsors-rightSleeve")
        if (field.startsWith('sponsors-')) {
            const sub = field.replace('sponsors-', '');
            if (c.sponsors[sub]) c.sponsors[sub].enabled = enabled;
        } else if (field === 'backOption') {
            // backOption toggle — propagate to the active back mode's state field
            const mode = c.backBadgeMode || 'badge';
            if (mode === 'badge')   { if (!c.backBadge)   c.backBadge   = { enabled: false, mediaUrl: null }; c.backBadge.enabled   = enabled; }
            if (mode === 'sponsor') { if (!c.backSponsor) c.backSponsor = { enabled: false, mediaUrl: null }; c.backSponsor.enabled = enabled; }
            if (mode === 'text')    { if (!c.backText)    c.backText    = { enabled: false, font: null, text: '', colourEffect: null }; c.backText.enabled = enabled; }
            if (!enabled) {
                // Clear all back modes when toggled off
                if (c.backBadge)   c.backBadge.enabled   = false;
                if (c.backSponsor) c.backSponsor.enabled = false;
                if (c.backText)    c.backText.enabled    = false;
            }
        } else if (c[field] && typeof c[field]==='object') {
            c[field].enabled = enabled;
        }
        const sub = document.getElementById(field+'Sub');
        if (sub) sub.classList.toggle('expanded', enabled);
        if (field==='backNumbers'||field==='names') this._renderNumberNameBreakdown();
        this._handleMutualExclusion(field, enabled);
        this._handleLeftPaneUpdate(field, enabled);
        orderState.recalculate(); OrderSummaryUI.update();
    },

    _handleMutualExclusion(field, enabled) {
        const c = orderState.customisation;
        if (field==='backText'&&enabled&&c.backLogo&&c.backLogo.enabled) { c.backLogo.enabled=false; const s=this.body.querySelector('[data-field="backLogo"]'); if(s)s.classList.remove('active'); }
        if (field==='backLogo'&&enabled&&c.backText&&c.backText.enabled) { c.backText.enabled=false; const s=this.body.querySelector('[data-field="backText"]'); if(s)s.classList.remove('active'); const sub=document.getElementById('backTextSub'); if(sub)sub.classList.remove('expanded'); }
    },

    _handleLeftPaneUpdate(field, enabled) {
        const imgs = this.leftPaneImages;
        console.log('[S5] _handleLeftPaneUpdate', field, enabled, 'imgs keys:', Object.keys(imgs || {}));
        if (!imgs) return;
        // When disabled — fightwear reverts to sponsorsLogo, others revert to variant
        if (!enabled) {
            if (custType === 'boxing-fightwear' && imgs.sponsorsLogo) {
                LeftPane.setImage(imgs.sponsorsLogo);
            } else if (orderState.variant) {
                LeftPane.setImage(orderState.variant.imageUrl);
            }
            return;
        }

        const custType = orderState.customisation.type;

        if (custType === 'football-matchday' || custType === 'football-training') {
            if (field === 'clubBadge'    && imgs.clubBadge)      LeftPane.setImage(imgs.clubBadge);
            if (field === 'sponsors'     && imgs.sponsors)       LeftPane.setImage(imgs.sponsors);
            if (field === 'backNumbers'  && imgs.numbers)        LeftPane.setImage(imgs.numbers);
            if (field === 'names'        && imgs.names)          LeftPane.setImage(imgs.names);
            if (field === 'numberInitial'&& imgs.numbers)        LeftPane.setImage(imgs.numbers);
        }

        if (custType === 'boxing-activewear') {
            // Front - Club Badge → clubBadgeText image
            if (field === 'clubBadge'   && imgs.clubBadgeText)  LeftPane.setImage(imgs.clubBadgeText);
            // Sponsor Logo → sponsors image
            if (field === 'sponsorLogo' && imgs.sponsors)       LeftPane.setImage(imgs.sponsors);
            // Back - Badge/Sponsor/Text switch (backLogo field) — no image change, stays on variant
        }

        // Boxing fightwear
        if (field === 'backText'       && imgs.clubBadgeText)  LeftPane.setImage(imgs.clubBadgeText);
        if (field === 'sponsor'        && imgs.sponsors)       LeftPane.setImage(imgs.sponsors);
        if (field === 'name'           && imgs.teamNames)      LeftPane.setImage(imgs.teamNames);
        if (field === 'frontSponsors'  && imgs.sponsorSleeves) LeftPane.setImage(imgs.sponsorSleeves);
        if (field === 'fwSponsors'     && imgs.sponsorSleeves) LeftPane.setImage(imgs.sponsorSleeves);
        if (field === 'frontSponsor'   && imgs.sponsors)       LeftPane.setImage(imgs.sponsors);
    },

    // ═══════════════════════════════════════════════
    // COLOUR EFFECT SWATCHES
    // ═══════════════════════════════════════════════
    _renderColourEffectSwatches() {
        const mdGrid = document.getElementById('printColourGrid');
        const bxGrid = document.getElementById('effectColourGrid') || document.getElementById('nameEffectColourGrid');
        const verveGrid = document.getElementById('verveColourGrid');
        const initialsGrid = document.getElementById('initialsColourGrid');
        const logoGrid = document.getElementById('logoColourSwatches');

        const grids = [mdGrid, bxGrid, verveGrid, initialsGrid, logoGrid].filter(g => g);
        if (!grids.length || !this.colourEffectsData) return;

        const effects = Array.isArray(this.colourEffectsData) ? this.colourEffectsData : (this.colourEffectsData.effects || []);
        if (!effects.length) return;

        grids.forEach(grid => {
            grid.innerHTML = '';
            effects.forEach(eff => {
            const swatch = document.createElement('button');
            swatch.className = 'variant-btn';
            swatch.title = `${eff.colourName} — ${Helpers.formatPrice(eff.price||0)}`;
            if (eff.imageUrl) {
                swatch.innerHTML = `<div class="variant-swatch"><img src="${eff.imageUrl}" alt="${eff.colourName}" loading="lazy"></div><span class="variant-label">${eff.colourName}</span>`;
            } else if (eff.hex) {
                swatch.innerHTML = `<div class="variant-swatch" style="background:${eff.hex};border-radius:var(--radius-md);"></div><span class="variant-label">${eff.colourName}</span>`;
            } else {
                swatch.innerHTML = `<div class="variant-swatch" style="display:flex;align-items:center;justify-content:center;background:var(--bg-input);font-size:9px;color:var(--text-muted);">${eff.colourName}</div><span class="variant-label">${eff.colourName}</span>`;
            }
            swatch.addEventListener('click', () => {
                grid.querySelectorAll('.variant-btn').forEach(s=>s.classList.remove('active'));
                swatch.classList.add('active');
                const obj = { name:eff.colourName, price:eff.price||0, imageUrl:eff.imageUrl||null, hex:eff.hex||null };
                const ct = orderState.customisation.type;
                if (ct==='football-matchday') {
                    orderState.customisation.printColour = obj;
                    const cb = document.getElementById('colourPickerBtn');
                    if (cb) cb.textContent = eff.colourName;
                    const cp = document.getElementById('colourPopup');
                    if (cp) cp.style.display = 'none';
                    if (this.leftPaneImages.names) LeftPane.setImage(this.leftPaneImages.names);
                } else if (ct==='football-training') {
                    if (grid === verveGrid) {
                        orderState.customisation.verveLogoColour = obj;
                        const vb = document.getElementById('verveColourPickerBtn');
                        if (vb) vb.textContent = eff.colourName;
                        const vp = document.getElementById('verveColourPopup');
                        if (vp) vp.style.display = 'none';
                    } else if (grid === initialsGrid) {
                        orderState.customisation.numberInitialColour = obj;
                        const ib = document.getElementById('initialsColourPickerBtn');
                        if (ib) ib.textContent = eff.colourName;
                        const ip = document.getElementById('initialsColourPopup');
                        if (ip) ip.style.display = 'none';
                    }
                } else if (ct==='boxing-activewear') {
                    orderState.customisation.backText.colourEffect = obj;
                    orderState.customisation.backText.colour = {name:eff.colourName, imageUrl:eff.imageUrl, hex:eff.hex};
                } else if (ct==='boxing-fightwear') {
                    if (grid === logoGrid) {
                        if (!orderState.customisation.fwSponsors) orderState.customisation.fwSponsors = { enabled: false, positions: [], logoColour: 'tone' };
                        orderState.customisation.fwSponsors.colourTone = obj;
                        const tb = document.getElementById('logoColourToneBtn');
                        if (tb) tb.textContent = eff.colourName;
                    } else {
                        orderState.customisation.name.colourEffect = obj;
                        orderState.customisation.name.colour = {name:eff.colourName, imageUrl:eff.imageUrl, hex:eff.hex};
                    }
                }
                orderState.recalculate(); OrderSummaryUI.update();
            });
            grid.appendChild(swatch);
        });
        });
    },

    _renderFootballColourSwatches() {
        if (!this.footballColoursData) return;
        const colours = Array.isArray(this.footballColoursData) ? this.footballColoursData : (this.footballColoursData.colours||[]);
        ['verveLogoColourPicker','numberInitialColourPicker'].forEach(pid => {
            const ctn = document.getElementById(pid);
            if (!ctn) return;
            ctn.innerHTML = '';
            colours.forEach(c => {
                const sw = document.createElement('div');
                sw.className = 'colour-swatch';
                sw.style.background = c.hex||c.color||'#666';
                sw.title = `${c.name||c.colorName||''} — ${Helpers.formatPrice(c.price||0)}`;
                sw.addEventListener('click', () => {
                    ctn.querySelectorAll('.colour-swatch').forEach(s=>s.classList.remove('active'));
                    sw.classList.add('active');
                    const obj = {name: c.name||c.colorName, hex: c.hex, price: c.price||0};
                    if (pid==='verveLogoColourPicker') orderState.customisation.verveLogoColour = obj;
                    else orderState.customisation.numberInitialColour = obj;
                    orderState.recalculate(); OrderSummaryUI.update();
                });
                ctn.appendChild(sw);
            });
        });
    },

    // ═══════════════════════════════════════════════
    // BOXING FLOWS (unchanged)
    // ═══════════════════════════════════════════════
    _renderBoxingActivewear() {
        const opts = this.optionsData || {};
        const qty = orderState.getTotalQuantity() || orderState.quantity || 1;

        const fmtSku = (sku) => {
            const p = orderState.getSkuPrice(sku, qty);
            return p > 0 ? Helpers.formatPrice(p) : '—';
        };

        const badgePrice   = fmtSku('PB-005'); // Club Badge
        const sponsorPrice = fmtSku('PB-002'); // Sponsor
        const textPrice    = fmtSku('PB-001'); // Team Name / Text

        this.body.innerHTML = `
            <!-- FRONT - CLUB BADGE -->
            ${this._switchRow('clubBadge','Front - Club Badge','Upload your club badge', badgePrice, true)}

            <!-- BACK - BADGE / SPONSOR / TEXT -->
            <div class="option-row" data-option="backOption">
                <div class="option-info">
                    <span class="option-name">Back - Badge / Sponsor / Text</span>
                </div>
                <div class="option-controls">
                    <div class="toggle-switch" data-field="backOption"></div>
                </div>
            </div>
            <div class="sub-options" id="backOptionSub">
                <div class="sub-option-group">
                    <div class="tab-row">
                        <button class="tab-btn active" data-backoption="badge">BADGE<span class="tab-price">${badgePrice}</span></button>
                        <button class="tab-btn" data-backoption="sponsor">SPONSOR<span class="tab-price">${sponsorPrice}</span></button>
                        <button class="tab-btn" data-backoption="text">TEXT<span class="tab-price">${textPrice}</span></button>
                    </div>
                </div>
                <div id="backOptionBadgeWrap" style="margin-top:8px;">
                    <button class="upload-btn" data-upload-field="backBadge" style="width:100%;height:auto;padding:10px;display:flex;gap:8px;justify-content:center;font-size:12px;font-family:inherit;color:var(--text-secondary);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload Back Badge</button>
                </div>
                <div id="backOptionSponsorWrap" style="display:none;margin-top:8px;">
                    <button class="upload-btn" data-upload-field="backSponsor" style="width:100%;height:auto;padding:10px;display:flex;gap:8px;justify-content:center;font-size:12px;font-family:inherit;color:var(--text-secondary);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload Sponsor Logo</button>
                </div>
                <div id="backOptionTextWrap" style="display:none;margin-top:8px;">
                    <div id="backTextPreviewSummary" class="back-text-summary" style="display:none;"></div>
                    <button class="tab-btn" id="openFontPopupBtn" style="width:100%;text-align:center;">Choose Font &amp; Colour →</button>
                </div>
            </div>

            <!-- SPONSOR LOGO -->
            ${this._switchRow('sponsor','Sponsor Logo','Upload sponsor logo', sponsorPrice, true)}
        `;
        this._bindBoxingActivewearSwitches();
        this._restoreUIFromState();
    },

    _renderBoxingFightwear() {
        const opts = this.optionsData || {};
        const qty = orderState.getTotalQuantity() || orderState.quantity || 1;

        const fmtSku = (sku) => {
            const p = orderState.getSkuPrice(sku, qty);
            return p > 0 ? Helpers.formatPrice(p) : '—';
        };

        const namePrice      = fmtSku('PB-001'); // Team Name
        const sponsorPrice   = fmtSku('PB-002'); // Front & Back positions
        const rSleevePrice   = fmtSku('PB-003'); // Right Sleeve
        const lSleevePrice   = fmtSku('PB-004'); // Left Sleeve

        // Default image when section loads — use sponsorsLogo as the hero image
        const defaultImg = this.leftPaneImages.sponsorsLogo
            || this.leftPaneImages.default
            || this.leftPaneImages.fightwear;
        if (defaultImg) LeftPane.setImage(defaultImg);

        this.body.innerHTML = `
            ${this._switchRow('name','Team Name','Front &amp; Back', namePrice, false)}
            <div class="sub-options" id="nameSub">
                <div class="sub-option-group">
                    <button class="tab-btn" id="openFwFontPopupBtn" style="width:100%;text-align:center;">Choose Font &amp; Colour →</button>
                    <div id="fwNameSummary" class="back-text-summary" style="display:${orderState.customisation.name?.font || orderState.customisation.name?.text ? 'block' : 'none'};">
                        ${[orderState.customisation.name?.font?.fontName, orderState.customisation.name?.text].filter(Boolean).join(' — ')}
                    </div>
                </div>
            </div>

            ${this._switchRow('fwSponsors','Sponsors','Front, Back &amp; Sleeve positions', null, false)}
            <div class="sub-options" id="fwSponsorsSub">
                <div class="sub-option-group">
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 12px;">
                        <div>
                            <div class="sub-option-label" style="font-weight:600;margin-bottom:8px;">Front <span style="font-size:10px;color:var(--accent-primary);font-weight:500;">${sponsorPrice}</span></div>
                            ${this._fwSponsorRow('F1','Front 1')}
                            ${this._fwSponsorRow('F2','Front 2')}
                            ${this._fwSponsorRow('F3','Front 3')}
                            ${this._fwSponsorRow('F4','Front 4')}
                            ${this._fwSponsorRow('F5','Front 5')}
                            ${this._fwSponsorRow('F6','Front 6')}
                        </div>
                        <div>
                            <div class="sub-option-label" style="font-weight:600;margin-bottom:8px;">Back <span style="font-size:10px;color:var(--accent-primary);font-weight:500;">${sponsorPrice}</span></div>
                            ${this._fwSponsorRow('B1','Back 1')}
                            ${this._fwSponsorRow('B2','Back 2')}
                            ${this._fwSponsorRow('B3','Back 3')}
                            ${this._fwSponsorRow('B4','Back 4')}
                            ${this._fwSponsorRow('B5','Back 5')}
                            ${this._fwSponsorRow('B6','Back 6')}
                        </div>
                        <div>
                            <div class="sub-option-label" style="font-weight:600;margin-bottom:8px;">Sleeve</div>
                            ${this._fwSponsorRow('RS','Right Sleeve', rSleevePrice)}
                            ${this._fwSponsorRow('LS','Left Sleeve', lSleevePrice)}
                        </div>
                    </div>
                </div>
                <div class="sub-option-group" style="margin-top:12px;border-top:1px solid var(--border-color);padding-top:12px;">
                    <p style="font-size:11px;color:var(--accent-primary);text-align:center;margin:0;">Or email your logos to <a href="mailto:info@vervesport.co.uk" style="color:var(--accent-primary);font-weight:600;">info@vervesport.co.uk</a></p>
                </div>
            </div>

            <div class="mockup-approval-note">After purchase we provide a detailed mockup which requires your approval before production. If you have any hesitations we can edit the product to exactly how you want it.</div>
        `;
        this._bindFightwearSwitches();
        this._restoreUIFromState();
    },

    /** Sponsor row with checkbox + inline upload (revealed on check) */
    _fwSponsorRow(code, label, price) {
        const priceHtml = price ? `<span style="font-size:10px;color:var(--accent-primary);margin-left:6px;">${price}</span>` : '';
        return `<div class="fw-sponsor-row" data-sponsorcode="${code}">
            <label class="checkbox-row" style="margin-bottom:0;flex:1;">
                <input type="checkbox" data-fwsponsor="${code}">
                <span style="font-size:12px;font-weight:500;">${label}${priceHtml}</span>
            </label>
            <button class="upload-btn upload-btn-sm" data-upload-field="fwSponsor-${code}" style="display:none;margin-left:8px;border:1px solid var(--accent-primary);color:var(--accent-primary);"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
        </div>`;
    },

    _renderFootballTraining() {
        const opts = this.optionsData || {};
        const c = orderState.customisation;
        const badgePrice = opts.clubBadgePrice || c.clubBadge.price || 0;
        const sponsorPrice = opts.sponsorPrice || 0;
        const initialPrice = opts.initialsPrice || c.initialsPrice || 0;

        this.body.innerHTML = `
            ${this._switchRow('clubBadge','Club Badge','Add club badge',badgePrice,true)}
            ${this._switchRow('numberInitial','Number / Initial','Front left number or initial',initialPrice,false)}
            <div class="sub-options" id="numberInitialSub">
                <div id="initialsBreakdown" class="assignment-breakdown"></div>
                <div class="sub-option-group" style="margin-top:8px;">
                    <button class="tab-btn" id="editInitialsBtn" style="width:100%;text-align:center;">Edit Numbers / Initials →</button>
                </div>
            </div>
            ${this._switchRow('frontSponsor','Sponsor','Sleeve and/or back sponsor',sponsorPrice,false)}
            <div class="sub-options" id="frontSponsorSub">
                <div class="option-row" style="padding:6px 0;"><div class="option-info"><span class="option-name" style="font-size:12px;">Right Sleeve Sponsor</span> <span class="option-desc" style="font-size:10px;color:var(--text-muted);margin-left:6px;">Optional</span></div><div class="option-controls"><div class="toggle-switch" data-field="rightSleeveSponsor"></div><button class="upload-btn" data-upload-field="rightSleeveSponsor"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button></div></div>
                <div class="option-row" style="padding:6px 0;"><div class="option-info"><span class="option-name" style="font-size:12px;">Left Sleeve Sponsor</span> <span class="option-desc" style="font-size:10px;color:var(--text-muted);margin-left:6px;">Optional</span></div><div class="option-controls"><div class="toggle-switch" data-field="leftSleeveSponsor"></div><button class="upload-btn" data-upload-field="leftSleeveSponsor"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button></div></div>
                <div class="option-row" style="padding:6px 0;"><div class="option-info"><span class="option-name" style="font-size:12px;">Back Sponsor</span> <span class="option-desc" style="font-size:10px;color:var(--text-muted);margin-left:6px;">Optional</span></div><div class="option-controls"><div class="toggle-switch" data-field="backSponsor"></div><button class="upload-btn" data-upload-field="backSponsor"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button></div></div>
            </div>

            <!-- GLOBAL COLOURS -->
            <div class="global-options">
                <div class="global-option">
                    <span class="global-label">VERVE LOGO COLOUR:</span>
                    <button class="global-value-btn" id="verveColourPickerBtn">PREMIUM+ VINYL</button>
                </div>
                <div class="global-option">
                    <span class="global-label">NUMBERS/INITIAL COLOUR:</span>
                    <button class="global-value-btn" id="initialsColourPickerBtn">PREMIUM+ VINYL</button>
                </div>
            </div>
            <div class="inline-popup" id="verveColourPopup" style="display:none;">
                <div class="sub-option-label">Select Verve Logo Colour</div>
                <div class="colour-swatch-grid" id="verveColourGrid"><p class="text-sm text-muted">Loading colours...</p></div>
            </div>
            <div class="inline-popup" id="initialsColourPopup" style="display:none;">
                <div class="sub-option-label">Select Numbers / Initial Colour</div>
                <div class="colour-swatch-grid" id="initialsColourGrid"><p class="text-sm text-muted">Loading colours...</p></div>
            </div>

            <!-- GUARANTEE -->
            <div class="guarantee-footer">
                <button class="guarantee-btn" id="guaranteeBtn">Click here to see our 12 month printing guarantee</button>
            </div>
            <div class="guarantee-popup" id="guaranteePopup" style="display:none;">
                <div class="guarantee-popup-overlay" id="guaranteeOverlay"></div>
                <div class="guarantee-popup-content">
                    <button class="guarantee-popup-close" id="guaranteeClose">×</button>
                    <p>VerveSport offer a 12-month guarantee on all customised garments. In the unfortunate event your prints have come off the garments purchased, we will re-print/replace the print free of charge.</p>
                </div>
            </div>
        `;
        this._bindFootballTrainingSwitches();
        this._bindGuaranteePopup();
        this._restoreUIFromState();
        Messaging.requestColourEffects('Premium Vinyl B');

        // Set kit colour label live — updates if user goes back to section 3
        const _updateKitLabel = () => {
            const el = document.getElementById('kitColourLabel');
            if (!el) return;
            const name = orderState.variant?.displayName;
            el.textContent = name ? `Kit colour: ${name}` : '';
        };
        _updateKitLabel();
        if (this._kitLabelUnsubscribe) this._kitLabelUnsubscribe();
        this._kitLabelUnsubscribe = orderState.onChange(_updateKitLabel);
    },

    /** Legacy switch row for boxing/training */
    _switchRow(field, name, desc, price, hasUpload) {
        const ph = price ? `<span class="option-price">${typeof price === 'string' ? price : Helpers.formatPrice(price)}</span>` : '';
        const uh = hasUpload ? `<button class="upload-btn" data-upload-field="${field}"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>` : '';
        return `<div class="option-row" data-option="${field}"><div class="option-info"><span class="option-name">${name}</span> <span class="option-desc" style="margin-left:6px;">${desc}</span></div>${ph}<div class="option-controls"><div class="toggle-switch" data-field="${field}"></div>${uh}</div></div>`;
    },

    _backTextSubOptions(opts) {
        const fonts=opts.nameFont||[], effects=opts.colorEffect||[];
        let fo='<option value="">Select font...</option>'; fonts.forEach(f=>{fo+=`<option value="${f.fontName}" data-price="${f.price}">${f.fontName}</option>`;});
        let eo='<option value="">Select effect...</option>'; effects.forEach(e=>{const n=e.colourEffect||e; eo+=`<option value="${n}">${n}</option>`;});
        return `<div class="sub-option-group"><div class="sub-option-label">Font</div><select class="picker-dropdown" id="backTextFont">${fo}</select></div><div class="sub-option-group"><div class="sub-option-label">Type (Club Name)</div><input type="text" class="picker-input" id="backTextType" placeholder="Enter boxing club name"></div><div class="sub-option-group"><div class="sub-option-label">Colour Effect</div><select class="picker-dropdown" id="backTextEffect">${eo}</select></div><div class="sub-option-group" id="colourEffectSwatches" style="display:none;"><div class="sub-option-label">Colour</div><div class="colour-swatch-grid" id="effectColourGrid"></div></div>`;
    },

    _nameSubOptions(opts) {
        const fonts=opts.nameFont||[], effects=opts.colorEffect||[];
        const SURCHARGE = ['Reflective','Glitter','Exclusive'];
        let fo='<option value="">Select font...</option>'; fonts.forEach(f=>{fo+=`<option value="${f.fontName}" data-price="${f.price}">${f.fontName}</option>`;});
        let eo='<option value="">Select effect...</option>'; effects.forEach(e=>{
            const n=e.colourEffect||e;
            const extra = SURCHARGE.some(s => n.toLowerCase().includes(s.toLowerCase())) ? ' +£2.50/item' : '';
            const surcharge = extra ? ' data-surcharge="2.50"' : '';
            eo+=`<option value="${n}"${surcharge}>${n}${extra}</option>`;
        });
        return `<div class="sub-option-group"><div class="sub-option-label">Font</div><select class="picker-dropdown" id="nameFont">${fo}</select></div><div class="sub-option-group"><div class="sub-option-label">Team Name</div><input type="text" class="picker-input" id="nameType" placeholder="Enter team name"></div><div class="sub-option-group"><div class="sub-option-label">Colour Effect</div><select class="picker-dropdown" id="nameEffect">${eo}</select></div><div class="sub-option-group" id="nameColourEffectSwatches" style="display:none;"><div class="sub-option-label">Colour</div><div class="colour-swatch-grid" id="nameEffectColourGrid"></div></div>`;
    },

    _frontSponsorsSubOptions(opts) {
        return `<div class="sub-option-group"><div class="sub-option-label">Number of Sponsors (max 12)</div><div class="qty-control" style="justify-content:flex-start;"><button class="qty-btn" id="sponsorCountDown">−</button><input type="number" class="qty-input" id="sponsorCountInput" value="0" min="0" max="12"><button class="qty-btn" id="sponsorCountUp">+</button></div></div><div class="sub-option-group"><div class="sub-option-label">Sponsor Positions</div><div class="option-row"><div class="option-info"><span class="option-name">Front Sleeve (×2)</span></div><div class="toggle-switch" data-field="sponsorSleeve"></div></div><div class="option-row" style="margin-top:8px;"><div class="option-info"><span class="option-name">Front (up to 4 positions)</span><span class="option-desc">1 large logo = 2 positions</span></div><div class="toggle-switch" data-field="sponsorFront"></div></div><div class="option-row" style="margin-top:8px;"><div class="option-info"><span class="option-name">Back (up to 6 positions)</span></div><div class="toggle-switch" data-field="sponsorBack"></div></div></div><div class="sub-option-group"><button class="upload-btn" data-upload-field="frontSponsors" style="width:100%;height:auto;padding:10px;display:flex;gap:8px;justify-content:center;font-size:12px;font-family:inherit;color:var(--text-secondary);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload Sponsor Logos</button></div>`;
    },

    _bindBoxingActivewearSwitches() {
        this._bindSwitches();
        const c = orderState.customisation;

        // Back option tabs: BADGE / SPONSOR / TEXT
        this.body.querySelectorAll('[data-backoption]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.body.querySelectorAll('[data-backoption]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.backoption;
                c.backBadgeMode = mode;
                document.getElementById('backOptionBadgeWrap').style.display   = mode === 'badge'   ? 'block' : 'none';
                document.getElementById('backOptionSponsorWrap').style.display = mode === 'sponsor' ? 'block' : 'none';
                document.getElementById('backOptionTextWrap').style.display    = mode === 'text'    ? 'block' : 'none';

                // Left pane image switching for back option tabs
                const imgs = this.leftPaneImages;
                if (mode === 'sponsor' && imgs.sponsors)       LeftPane.setImage(imgs.sponsors);
                else if (mode === 'text'   && imgs.clubBadgeText) LeftPane.setImage(imgs.clubBadgeText);
                else if (mode === 'badge'  && imgs.clubBadgeText) LeftPane.setImage(imgs.clubBadgeText);
                else if (orderState.variant) LeftPane.setImage(orderState.variant.imageUrl);
            });
        });

        // Font preview popup trigger
        const fpBtn = document.getElementById('openFontPopupBtn');
        if (fpBtn) fpBtn.addEventListener('click', () => this._showFontPreviewPopup());
    },

    /**
     * Apply a colour selection to all .font-preview-text-display elements in a popup.
     * - hex colour  → sets text color directly
     * - imageUrl    → background-clip: text so the texture shows through the letterforms
     * - null/reset  → restores default text colour
     */
    _applyFontPreviewColour(popup, colour) {
        popup.querySelectorAll('.font-preview-text-display').forEach(el => {
            if (!colour) {
                // Reset to default
                el.style.color = '';
                el.style.backgroundImage = '';
                el.style.webkitBackgroundClip = '';
                el.style.backgroundClip = '';
                el.style.webkitTextFillColor = '';
            } else if (colour.imageUrl) {
                // Texture/foil/glitter — clip background image to text shape
                el.style.backgroundImage = `url('${colour.imageUrl}')`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.style.webkitBackgroundClip = 'text';
                el.style.backgroundClip = 'text';
                el.style.webkitTextFillColor = 'transparent';
                el.style.color = 'transparent';
            } else if (colour.hex) {
                // Solid colour — reset any clip and just set color
                el.style.backgroundImage = '';
                el.style.webkitBackgroundClip = '';
                el.style.backgroundClip = '';
                el.style.webkitTextFillColor = '';
                el.style.color = colour.hex;
            }
        });
    },


    _resolvePreviewFontFamily(fontName) {
        const name = String(fontName || '').trim().toLowerCase();
        const aliases = {
            'sportsfan': 'Sportzan',
            'sportzan': 'Sportzan',
            'rocky serif': 'CS Rocky',
            'cs rocky': 'CS Rocky',
            'hyperwave': 'Hyperwave One',
            'hyperwave one': 'Hyperwave One',
            'dynamo': 'Dynamo',
            'vampire wars': 'Vampire Wars'
        };
        return aliases[name] || fontName || 'Impact';
    },

    _showFontPreviewPopup() {
        const opts = this.optionsData || {};
        const fonts = opts.nameFont || [];
        const existing = document.getElementById('fontPreviewPopup');
        if (existing) existing.remove();

        // Build font cards
        const fontCards = fonts.map(f => {
            const previewFamily = this._resolvePreviewFontFamily(f.fontName);
            return `
            <div class="font-preview-card" data-font="${f.fontName}" data-price="${f.price||0}">
                <div class="font-preview-sample" style="font-family:'${previewFamily}',Impact,sans-serif;">
                    <span class="font-preview-text-display font-preview-line1" style="display:block;line-height:1.2;">Line 1</span><span class="font-preview-text-display font-preview-line2" style="display:block;line-height:1.2;">Line 2</span>
                </div>
                <div class="font-preview-meta">
                    <span class="font-preview-name">${f.fontName}</span>
                </div>
            </div>
        `;
        }).join('');

        // Build effect options for colour
        const effects = opts.colorEffect || [];
        const SURCHARGE = ['Reflective','Glitter','Exclusive'];
        let effectOpts = '<option value="">Select effect...</option>';
        effects.forEach(e => {
            const n = e.colourEffect || e;
            const extra = SURCHARGE.some(s => n.toLowerCase().includes(s.toLowerCase())) ? ' +£2.50' : '';
            effectOpts += `<option value="${n}">${n}${extra}</option>`;
        });

        const popup = document.createElement('div');
        popup.id = 'fontPreviewPopup';
        popup.className = 'assignment-popup';
        popup.innerHTML = `
            <div class="assignment-popup-overlay"></div>
            <div class="assignment-popup-content font-popup-content">
                <div class="assignment-popup-header">
                    <span class="assignment-popup-title">Choose Font &amp; Colour</span>
                    <button class="assignment-popup-close" id="closeFontPopup">×</button>
                </div>
                <div class="assignment-popup-body">
                    <div class="font-popup-input-row">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Line 1</label>
                        <input type="text" class="picker-input font-preview-input" id="fontPreviewLine1" placeholder="Input line 1" maxlength="30" style="margin-bottom:8px;width:100%;">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;margin-top:4px;">Line 2</label>
                        <input type="text" class="picker-input font-preview-input" id="fontPreviewLine2" placeholder="Input line 2" maxlength="30" style="width:100%;">
                    </div>
                    <div class="font-preview-grid" id="fontPreviewGrid">
                        ${fontCards || '<p class="text-sm text-muted">No fonts configured.</p>'}
                    </div>
                    <div class="font-popup-divider"></div>
                    <div class="sub-option-label" style="margin-bottom:8px;">Colour Effect</div>
                    <select class="picker-dropdown" id="fontPopupEffect">${effectOpts}</select>
                    <div id="fontPopupColourWrap" style="display:none;margin-top:10px;">
                        <div class="sub-option-label" style="margin-bottom:8px;">Colour</div>
                        <div class="colour-swatch-grid" id="fontPopupColourGrid"></div>
                    </div>
                    <div id="fontPopupColourPreview" style="display:none;margin-top:8px;font-size:11px;color:var(--text-muted);"></div>
                </div>
                <div class="assignment-popup-footer">
                    <button class="tab-btn active" id="saveFontPopup" style="width:100%;padding:10px;">Save &amp; Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.classList.add('visible'));

        const c = orderState.customisation;
        let selectedFont = c.backText.font || null;
        let selectedColour = c.backText.colourEffect || null;
        let selectedSurcharge = 0;

        // Restore selections
        if (selectedFont) {
            const card = popup.querySelector(`[data-font="${selectedFont.fontName}"]`);
            if (card) card.classList.add('active');
        }

        // Text input — live preview
        const line1Input = popup.querySelector('#fontPreviewLine1');
        const line2Input = popup.querySelector('#fontPreviewLine2');
        line1Input.value = c.backText.text  || '';
        line2Input.value = c.backText.text2 || '';
        const updatePreviewText = () => {
            const val1 = line1Input.value;
            const val2 = line2Input.value;
            popup.querySelectorAll('.font-preview-line1').forEach(el => el.textContent = val1);
            popup.querySelectorAll('.font-preview-line2').forEach(el => el.textContent = val2);
            this._applyFontPreviewColour(popup, selectedColour);
        };
        line1Input.addEventListener('input', updatePreviewText);
        line2Input.addEventListener('input', updatePreviewText);
        updatePreviewText();

        // Font card selection
        popup.querySelectorAll('.font-preview-card').forEach(card => {
            card.addEventListener('click', () => {
                popup.querySelectorAll('.font-preview-card').forEach(c2 => c2.classList.remove('active'));
                card.classList.add('active');
                selectedFont = { fontName: card.dataset.font, price: parseFloat(card.dataset.price) || 0 };
            });
        });

        // Effect dropdown
        const effectSel = popup.querySelector('#fontPopupEffect');
        const SURCHARGE_EFFECTS = ['Reflective','Glitter','Exclusive'];
        effectSel.addEventListener('change', () => {
            const v = effectSel.value;
            const wrap = popup.querySelector('#fontPopupColourWrap');
            if (v) {
                wrap.style.display = 'block';
                selectedSurcharge = SURCHARGE_EFFECTS.some(s => v.toLowerCase().includes(s.toLowerCase())) ? 2.50 : 0;
                Messaging.requestColourEffects(v);
                popup.querySelector('#fontPopupColourGrid').innerHTML = '<p class="text-sm text-muted">Loading...</p>';
            } else {
                wrap.style.display = 'none';
                selectedSurcharge = 0;
            }
        });

        // Intercept colour effects for this popup
        this._fontPopupColourCallback = (effects) => {
            const grid = popup.querySelector('#fontPopupColourGrid');
            if (!grid) return;
            grid.innerHTML = '';
            effects.forEach(eff => {
                const sw = document.createElement('button');
                sw.className = 'variant-btn';
                sw.title = eff.colourName;
                if (eff.imageUrl) {
                    sw.innerHTML = `<div class="variant-swatch"><img src="${eff.imageUrl}" alt="${eff.colourName}" loading="lazy"></div><span class="variant-label">${eff.colourName}</span>`;
                } else if (eff.hex) {
                    sw.innerHTML = `<div class="variant-swatch" style="background:${eff.hex};border-radius:var(--radius-md);"></div><span class="variant-label">${eff.colourName}</span>`;
                } else {
                    sw.innerHTML = `<div class="variant-swatch" style="background:var(--bg-input);"></div><span class="variant-label">${eff.colourName}</span>`;
                }
                sw.addEventListener('click', () => {
                    grid.querySelectorAll('.variant-btn').forEach(s => s.classList.remove('active'));
                    sw.classList.add('active');
                    selectedColour = { name: eff.colourName, price: eff.price || 0, imageUrl: eff.imageUrl || null, hex: eff.hex || null };
                    this._applyFontPreviewColour(popup, selectedColour);
                    const prev = popup.querySelector('#fontPopupColourPreview');
                    if (prev) { prev.style.display = 'block'; prev.textContent = `Selected: ${eff.colourName}`; }
                });
                grid.appendChild(sw);
            });
        };

        const close = () => {
            this._fontPopupColourCallback = null;
            popup.classList.remove('visible');
            setTimeout(() => popup.remove(), 200);
        };

        popup.querySelector('.assignment-popup-overlay').addEventListener('click', close);
        popup.querySelector('#closeFontPopup').addEventListener('click', close);

        popup.querySelector('#saveFontPopup').addEventListener('click', () => {
            c.backText.font           = selectedFont;
            c.backText.text           = line1Input.value.trim();
            c.backText.text2          = line2Input.value.trim();
            c.backText.colourEffect   = selectedColour;
            c.backText.effectSurcharge = selectedSurcharge;
            c.backText.enabled        = !!(c.backText.text || c.backText.text2);
            // Update summary button
            const summary = document.getElementById('backTextPreviewSummary');
            if (summary) {
                const parts = [selectedFont?.fontName, c.backText.text || null, c.backText.text2 || null].filter(Boolean);
                const label = parts.join(' — ');
                summary.textContent = label;
                summary.style.display = label ? 'block' : 'none';
            }
            // Badge and Text are mutually exclusive — clear badge when text saved
            if (c.backText.enabled) {
                c.backBadge = { enabled: false, mediaUrl: null };
                const badgeBtn = this.body ? this.body.querySelector('[data-upload-field="backBadge"]') : null;
                if (badgeBtn) badgeBtn.classList.remove('has-file');
                const badgeTab = document.querySelector('[data-backoption="badge"]');
                if (badgeTab) { const t = badgeTab.querySelector('.tab-confirm-tick'); if (t) t.remove(); }
                // Show tick on TEXT tab
                const textTab = document.querySelector('[data-backoption="text"]');
                if (textTab && !textTab.querySelector('.tab-confirm-tick')) {
                    const tick = document.createElement('span');
                    tick.className = 'tab-confirm-tick';
                    tick.textContent = '✓';
                    textTab.appendChild(tick);
                }
            }
            orderState.recalculate(); OrderSummaryUI.update();
            close();
        });
    },

    _showFightwearFontPopup() {
        const opts  = this.optionsData || {};
        const fonts = opts.nameFont || [];
        const existing = document.getElementById('fwFontPreviewPopup');
        if (existing) existing.remove();

        // Font cards
        const fontCards = fonts.map(f => {
            const previewFamily = this._resolvePreviewFontFamily(f.fontName);
            return `
            <div class="font-preview-card" data-font="${f.fontName}" data-price="${f.price||0}">
                <div class="font-preview-sample" style="font-family:'${previewFamily}',Impact,sans-serif;">
                    <span class="font-preview-text-display font-preview-line1" style="display:block;line-height:1.2;">Line 1</span><span class="font-preview-text-display font-preview-line2" style="display:block;line-height:1.2;">Line 2</span>
                </div>
                <div class="font-preview-meta">
                    <span class="font-preview-name">${f.fontName}</span>
                </div>
            </div>`;
        }).join('');

        // Effect options
        const effects = opts.colorEffect || [];
        const SURCHARGE = ['Reflective','Glitter','Exclusive'];
        let effectOpts = '<option value="">Select effect...</option>';
        effects.forEach(e => {
            const n = e.colourEffect || e;
            const extra = SURCHARGE.some(s => n.toLowerCase().includes(s.toLowerCase())) ? ' +£2.50' : '';
            effectOpts += `<option value="${n}">${n}${extra}</option>`;
        });

        const popup = document.createElement('div');
        popup.id = 'fwFontPreviewPopup';
        popup.className = 'assignment-popup';
        popup.innerHTML = `
            <div class="assignment-popup-overlay"></div>
            <div class="assignment-popup-content font-popup-content">
                <div class="assignment-popup-header">
                    <span class="assignment-popup-title">Team Name — Font &amp; Colour</span>
                    <button class="assignment-popup-close" id="closeFwFontPopup">×</button>
                </div>
                <div class="assignment-popup-body">
                    <div class="font-popup-input-row">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Line 1</label>
                        <input type="text" class="picker-input font-preview-input" id="fwFontPreviewLine1" placeholder="Input line 1" maxlength="30" style="margin-bottom:8px;width:100%;">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;margin-top:4px;">Line 2</label>
                        <input type="text" class="picker-input font-preview-input" id="fwFontPreviewLine2" placeholder="Input line 2" maxlength="30" style="width:100%;">
                    </div>
                    <div class="font-preview-grid" id="fwFontPreviewGrid">
                        ${fontCards || '<p class="text-sm text-muted">No fonts configured.</p>'}
                    </div>
                    <div class="font-popup-divider"></div>
                    <div class="sub-option-label" style="margin-bottom:8px;">Colour Effect</div>
                    <select class="picker-dropdown" id="fwFontPopupEffect">${effectOpts}</select>
                    <div id="fwFontPopupColourWrap" style="display:none;margin-top:10px;">
                        <div class="sub-option-label" style="margin-bottom:8px;">Colour</div>
                        <div class="colour-swatch-grid" id="fwFontPopupColourGrid"></div>
                    </div>
                    <div id="fwFontPopupColourPreview" style="display:none;margin-top:8px;font-size:11px;color:var(--text-muted);"></div>
                </div>
                <div class="assignment-popup-footer">
                    <button class="tab-btn active" id="saveFwFontPopup" style="width:100%;padding:10px;">Save &amp; Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.classList.add('visible'));

        const c = orderState.customisation;
        let selectedFont    = c.name.font    || null;
        let selectedColour  = c.name.colourEffect || null;
        let selectedSurcharge = c.name.effectSurcharge || 0;

        // Restore font selection
        if (selectedFont) {
            const card = popup.querySelector(`[data-font="${selectedFont.fontName}"]`);
            if (card) card.classList.add('active');
        }

        // Restore effect dropdown
        const effectSel = popup.querySelector('#fwFontPopupEffect');
        if (selectedColour?.name) {
            Array.from(effectSel.options).forEach(o => {
                if (o.value === selectedColour.name) effectSel.value = o.value;
            });
            popup.querySelector('#fwFontPopupColourWrap').style.display = 'block';
        }

        // Text inputs + live preview
        const line1Input = popup.querySelector('#fwFontPreviewLine1');
        const line2Input = popup.querySelector('#fwFontPreviewLine2');
        line1Input.value = c.name.text  || '';
        line2Input.value = c.name.text2 || '';
        const updatePreview = () => {
            const val1 = line1Input.value;
            const val2 = line2Input.value;
            popup.querySelectorAll('.font-preview-line1').forEach(el => el.textContent = val1);
            popup.querySelectorAll('.font-preview-line2').forEach(el => el.textContent = val2);
            this._applyFontPreviewColour(popup, selectedColour);
        };
        line1Input.addEventListener('input', updatePreview);
        line2Input.addEventListener('input', updatePreview);
        updatePreview();

        // Font card selection
        popup.querySelectorAll('.font-preview-card').forEach(card => {
            card.addEventListener('click', () => {
                popup.querySelectorAll('.font-preview-card').forEach(c2 => c2.classList.remove('active'));
                card.classList.add('active');
                selectedFont = { fontName: card.dataset.font, price: parseFloat(card.dataset.price) || 0 };
            });
        });

        // Effect dropdown
        const SURCHARGE_EFFECTS = ['Reflective','Glitter','Exclusive'];
        effectSel.addEventListener('change', () => {
            const v = effectSel.value;
            const wrap = popup.querySelector('#fwFontPopupColourWrap');
            if (v) {
                wrap.style.display = 'block';
                selectedSurcharge = SURCHARGE_EFFECTS.some(s => v.toLowerCase().includes(s.toLowerCase())) ? 2.50 : 0;
                Messaging.requestColourEffects(v);
                popup.querySelector('#fwFontPopupColourGrid').innerHTML = '<p class="text-sm text-muted">Loading...</p>';
            } else {
                wrap.style.display = 'none';
                selectedSurcharge = 0;
                selectedColour = null;
            }
        });

        // Intercept colour effects for this popup
        this._fontPopupColourCallback = (effects) => {
            const grid = popup.querySelector('#fwFontPopupColourGrid');
            if (!grid) return;
            grid.innerHTML = '';
            effects.forEach(eff => {
                const sw = document.createElement('button');
                sw.className = 'variant-btn';
                if (eff.imageUrl) {
                    sw.innerHTML = `<div class="variant-swatch"><img src="${eff.imageUrl}" alt="${eff.colourName}" loading="lazy"></div><span class="variant-label">${eff.colourName}</span>`;
                } else if (eff.hex) {
                    sw.innerHTML = `<div class="variant-swatch" style="background:${eff.hex};border-radius:var(--radius-md);"></div><span class="variant-label">${eff.colourName}</span>`;
                } else {
                    sw.innerHTML = `<div class="variant-swatch" style="background:var(--bg-input);"></div><span class="variant-label">${eff.colourName}</span>`;
                }
                // Restore active state
                if (selectedColour?.name === eff.colourName) sw.classList.add('active');
                sw.addEventListener('click', () => {
                    grid.querySelectorAll('.variant-btn').forEach(s => s.classList.remove('active'));
                    sw.classList.add('active');
                    selectedColour = { name: eff.colourName, price: eff.price || 0, imageUrl: eff.imageUrl || null, hex: eff.hex || null };
                    this._applyFontPreviewColour(popup, selectedColour);
                    const prev = popup.querySelector('#fwFontPopupColourPreview');
                    if (prev) { prev.style.display = 'block'; prev.textContent = `Selected: ${eff.colourName}`; }
                });
                grid.appendChild(sw);
            });
        };

        const close = () => {
            this._fontPopupColourCallback = null;
            popup.classList.remove('visible');
            setTimeout(() => popup.remove(), 200);
        };

        popup.querySelector('.assignment-popup-overlay').addEventListener('click', close);
        popup.querySelector('#closeFwFontPopup').addEventListener('click', close);

        popup.querySelector('#saveFwFontPopup').addEventListener('click', () => {
            c.name.font            = selectedFont;
            c.name.text            = line1Input.value.trim();
            c.name.text2           = line2Input.value.trim();
            c.name.colourEffect    = selectedColour;
            c.name.effectSurcharge = selectedSurcharge;

            // Update summary label under button
            const summary = document.getElementById('fwNameSummary');
            if (summary) {
                const parts = [selectedFont?.fontName, c.name.text || null, c.name.text2 || null].filter(Boolean);
                const label = parts.join(' — ');
                summary.textContent = label;
                summary.style.display = label ? 'block' : 'none';
            }
            orderState.recalculate();
            OrderSummaryUI.update();
            close();
        });
    },

    _bindBoxingSwitches(subType) {
        this._bindSwitches();
        const fs=document.getElementById('backTextFont');
        if(fs) fs.addEventListener('change',()=>{const o=fs.selectedOptions[0]; if(o&&o.value){orderState.customisation.backText.font={fontName:o.value,price:parseFloat(o.dataset.price)||0};} else {orderState.customisation.backText.font=null;} orderState.recalculate(); OrderSummaryUI.update();});
        const ti=document.getElementById('backTextType');
        if(ti) ti.addEventListener('input',()=>{orderState.customisation.backText.text=ti.value;});
        const es=document.getElementById('backTextEffect');
        if(es) es.addEventListener('change',()=>{const v=es.value; if(v){Messaging.requestColourEffects(v); document.getElementById('colourEffectSwatches').style.display='block';} else {document.getElementById('colourEffectSwatches').style.display='none';}});
        if(this.optionsData){orderState.customisation.frontLogo.price=this.optionsData.frontLogoPrice||0; orderState.customisation.backLogo.price=this.optionsData.backLogoPrice||0;}
    },

    _bindFightwearSwitches() {
        this._bindSwitches();
        const c = orderState.customisation;

        // Font dropdown
        // Font popup button
        const fwfBtn = document.getElementById('openFwFontPopupBtn');
        if (fwfBtn) fwfBtn.addEventListener('click', () => this._showFightwearFontPopup());

        // Per-position sponsor checkboxes — reveal upload button on check
        this.body.querySelectorAll('[data-fwsponsor]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (!c.fwSponsors) c.fwSponsors = { enabled: false, positions: [], uploads: {} };
                const code = cb.dataset.fwsponsor;
                // Show/hide inline upload button
                const row = cb.closest('.fw-sponsor-row');
                const uploadBtn = row ? row.querySelector('.upload-btn-sm') : null;
                if (uploadBtn) uploadBtn.style.display = cb.checked ? 'inline-flex' : 'none';
                if (cb.checked) {
                    if (!c.fwSponsors.positions.includes(code)) c.fwSponsors.positions.push(code);
                } else {
                    c.fwSponsors.positions = c.fwSponsors.positions.filter(p => p !== code);
                }
            });
        });

        // Upload buttons for individual sponsor positions
        this.body.querySelectorAll('.upload-btn-sm[data-upload-field]').forEach(btn => {
            btn.addEventListener('click', () => Messaging.requestUpload(btn.dataset.uploadField, btn.dataset.uploadField));
        });
    },

    _bindFootballTrainingSwitches() {
        this._bindSwitches();
        const c = orderState.customisation;

        // Edit Initials button
        const eib = document.getElementById('editInitialsBtn');
        if (eib) eib.addEventListener('click', () => this._showInitialsPopup());

        // Render breakdown if sizes exist
        this._renderInitialsBreakdown();

        // Verve Logo Colour picker toggle
        const vcb = document.getElementById('verveColourPickerBtn');
        if (vcb) vcb.addEventListener('click', () => {
            const vp = document.getElementById('verveColourPopup');
            const ip = document.getElementById('initialsColourPopup');
            if (vp) vp.style.display = vp.style.display === 'none' ? 'block' : 'none';
            if (ip) ip.style.display = 'none';
        });

        // Numbers/Initial Colour picker toggle
        const icb = document.getElementById('initialsColourPickerBtn');
        if (icb) icb.addEventListener('click', () => {
            const ip = document.getElementById('initialsColourPopup');
            const vp = document.getElementById('verveColourPopup');
            if (ip) ip.style.display = ip.style.display === 'none' ? 'block' : 'none';
            if (vp) vp.style.display = 'none';
        });
    },

    _bindGuaranteePopup() {
        const btn = document.getElementById('guaranteeBtn');
        const popup = document.getElementById('guaranteePopup');
        const overlay = document.getElementById('guaranteeOverlay');
        const close = document.getElementById('guaranteeClose');
        if (!btn || !popup) return;
        const open = () => popup.style.display = 'flex';
        const shut = () => popup.style.display = 'none';
        btn.addEventListener('click', open);
        if (overlay) overlay.addEventListener('click', shut);
        if (close) close.addEventListener('click', shut);
    },

    _updateSectionHeader() {
        const custType = orderState.customisation.type;
        if (custType) {
            const label = custType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            this.el.querySelector('.section-header').innerHTML = `
                <span class="section-number">5</span>
                <span class="section-title">Customisation</span>
                <span class="section-value">${label}</span>
            `;
        }
    }
};
