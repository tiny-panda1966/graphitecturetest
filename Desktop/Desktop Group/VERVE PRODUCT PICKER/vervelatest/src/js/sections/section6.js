/**
 * section6.js — Delivery Options (Display Only)
 *
 * Shows Standard and Express delivery options with correct prices
 * based on product type and total quantity.
 *
 * NO user selection required — section auto-completes on unlock.
 * Delivery choice happens at Wix checkout (Add to Cart flow) or
 * both payment links are sent in the approval email (Approval flow).
 *
 * Delivery rules mirror shippingRates.js exactly.
 */
const Section6 = {
    el:   null,
    body: null,

    // ── Delivery rules — mirrors shippingRates.js ──────────────────
    // Each entry: { threshold, standard: {days}, express: {price, days} | null }
    RULES: {
        'football-matchday': [
            { maxQty: 19, stdDays: '14–21',  expPrice: 29.99, expDays: '10–14' },
            { maxQty: Infinity, stdDays: '14–21', expPrice: 39.99, expDays: '10–14' }
        ],
        'football-training': [
            { maxQty: 11, stdDays: '4–6',   expPrice: 9.99,  expDays: '2–3' },
            { maxQty: Infinity, stdDays: '5–10', expPrice: 14.99, expDays: '3–7' }
        ],
        'football-training-bespoke': [
            { maxQty: 24, stdDays: '4–5 weeks', expPrice: null, expDays: null },
            { maxQty: Infinity, stdDays: '4–6 weeks', expPrice: null, expDays: null }
        ],
        'boxing-activewear': [
            { maxQty: 9,  stdDays: '4–7',  expPrice: 9.99,  expDays: '2–3' },
            { maxQty: Infinity, stdDays: '6–9', expPrice: 19.99, expDays: '4–6' }
        ],
        'boxing-fightwear': [
            { maxQty: 6, stdDays: '4–5',  expPrice: 9.99,  expDays: '2–3' },
            { maxQty: Infinity, stdDays: '5–7', expPrice: 14.99, expDays: '2–4' }
        ]
    },

    init() {
        this.el   = document.getElementById('section6');
        this.body = document.getElementById('popupBody6');
    },

    activate() {
        this.render();
        // Auto-complete — no user action needed
        this._autoComplete();
    },

    /**
     * Derive delivery rule key from current orderState.
     */
    _getRuleKey() {
        const col  = (orderState.collection || '').toLowerCase();
        const type = (orderState.type || '').toLowerCase();
        if (col === 'boxing') {
            return type.includes('fight') ? 'boxing-fightwear' : 'boxing-activewear';
        }
        if (type.includes('training')) return 'football-training';
        return 'football-matchday';
    },

    /**
     * Get the active rule tier for current total quantity.
     */
    _getRule() {
        const key   = this._getRuleKey();
        const tiers = this.RULES[key] || this.RULES['football-matchday'];
        const qty   = orderState.getTotalQuantity() || 1;
        return tiers.find(t => qty <= t.maxQty) || tiers[tiers.length - 1];
    },

    /**
     * Return { stdCode, expCode, stdLabel, expLabel, stdPrice, expPrice }
     * Used by both render() and by the approval flow payload builder.
     */
    getDeliveryOptions() {
        const key  = this._getRuleKey();
        const rule = this._getRule();
        const qty  = orderState.getTotalQuantity() || 1;

        // Build human-readable labels matching shippingRates codes
        const codeMap = {
            'football-matchday':          qty <= 19 ? 'fb-match-std'      : 'fb-match-std-bulk',
            'football-training':          qty <= 11 ? 'fb-train-std'      : 'fb-train-std-bulk',
            'football-training-bespoke':  qty <= 24 ? 'fb-bespoke-std'    : 'fb-bespoke-std-bulk',
            'boxing-activewear':          qty <= 9  ? 'box-act-std'       : 'box-act-std-bulk',
            'boxing-fightwear':           qty <= 6  ? 'box-fight-std'     : 'box-fight-std-bulk'
        };
        const expCodeMap = {
            'football-matchday':          qty <= 19 ? 'fb-match-exp'      : 'fb-match-exp-bulk',
            'football-training':          qty <= 11 ? 'fb-train-exp'      : 'fb-train-exp-bulk',
            'football-training-bespoke':  null,
            'boxing-activewear':          qty <= 9  ? 'box-act-exp'       : 'box-act-exp-bulk',
            'boxing-fightwear':           qty <= 6  ? 'box-fight-exp'     : 'box-fight-exp-bulk'
        };

        return {
            stdCode:  codeMap[key]    || 'std',
            expCode:  expCodeMap[key] || null,
            stdPrice: 0,
            expPrice: rule.expPrice,
            stdDays:  rule.stdDays,
            expDays:  rule.expDays,
            stdLabel: `Standard Delivery — Free (${rule.stdDays} days)`,
            expLabel: rule.expPrice
                ? `Express Delivery — ${Helpers.formatPrice(rule.expPrice)} (${rule.expDays} days)`
                : null
        };
    },

    render() {
        const opts = this.getDeliveryOptions();
        const isTrainingBespoke = this._getRuleKey() === 'football-training-bespoke';

        let html = `
            <div class="delivery-info-header" style="margin-bottom:14px;padding:10px 12px;background:rgba(var(--accent-rgb),0.06);border-radius:var(--radius-md);border-left:3px solid var(--accent);">
                <p style="margin:0;font-size:12px;color:var(--text-secondary);line-height:1.5;">
                    Delivery method is selected at checkout. Both options are shown below for your reference.
                </p>
            </div>
            <div class="delivery-options">
                <div class="delivery-card delivery-card--info">
                    <div class="delivery-card-top">
                        <div class="delivery-card-info">
                            <div class="delivery-card-title">STANDARD</div>
                            <div class="delivery-card-price free">FREE</div>
                        </div>
                    </div>
                    <div class="delivery-card-detail">
                        <span class="delivery-days">${opts.stdDays} Days</span>
                    </div>
                </div>
        `;

        if (opts.expLabel) {
            html += `
                <div class="delivery-card delivery-card--info">
                    <div class="delivery-card-top">
                        <div class="delivery-card-info">
                            <div class="delivery-card-title">EXPRESS</div>
                            <div class="delivery-card-price">${Helpers.formatPrice(opts.expPrice)}</div>
                        </div>
                    </div>
                    <div class="delivery-card-detail">
                        <span class="delivery-days">${opts.expDays} Days</span>
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        if (isTrainingBespoke) {
            html += `<p class="delivery-confirm-note" style="margin-top:12px;">A member of the team will be in touch to confirm your order &amp; delivery date.</p>`;
        }

        if (opts.expLabel) {
            html += `
                <p style="margin-top:10px;font-size:11px;color:var(--text-muted);text-align:center;">
                    For <strong>Submit for Approval</strong>, you will receive two payment links — one for each delivery option.
                </p>
            `;
        }

        this.body.innerHTML = html;

        // ── Cursor-following tooltip ──────────────────────────────────
        this._initTooltip();
    },

    _initTooltip() {
        // Create tooltip element once, reuse on re-renders
        let tip = document.getElementById('deliveryTooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'deliveryTooltip';
            tip.className = 'delivery-tooltip';
            tip.textContent = "You'll choose your delivery speed at checkout";
            document.body.appendChild(tip);
        }

        const show = () => { tip.style.opacity = '1'; };
        const hide = () => { tip.style.opacity = '0'; };

        const move = (e) => {
            tip.style.left = e.clientX + 'px';
            tip.style.top  = e.clientY + 'px';
        };

        // Show when hovering delivery cards area
        const cards = this.body.querySelector('.delivery-options');
        if (cards) {
            cards.addEventListener('mouseenter', show);
            cards.addEventListener('mousemove',  move);
            cards.addEventListener('mouseleave', hide);
        }

        // Hide immediately when hovering Done button
        const doneBtn = document.getElementById('popupDone6');
        if (doneBtn) {
            doneBtn.addEventListener('mouseenter', hide);
        }
    },

    _autoComplete() {
        // Mark section complete without requiring user input
        orderState.deliveryOption = 'standard'; // default for state tracking only
        orderState.deliveryPrice  = 0;          // delivery NOT added to cart total
        orderState.recalculate();
        this._updateSectionHeader();
        SectionManager.complete(6);
        OrderSummaryUI.update();
    },

    _updateSectionHeader() {
        if (!this.el) return;
        const opts = this.getDeliveryOptions();
        this.el.querySelector('.section-header').innerHTML = `
            <span class="section-number">6</span>
            <span class="section-title">Delivery</span>
            <span class="section-value">Standard FREE${opts.expLabel ? ` / Express ${Helpers.formatPrice(opts.expPrice)}` : ''}</span>
        `;
    },

    _addBusinessDays(startDate, days) {
        const result = new Date(startDate);
        result.setDate(result.getDate() + days);
        return result;
    },

    _formatDate(date) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const day = date.getDate();
        return `${day}${this._ordinalSuffix(day)} ${months[date.getMonth()]}`;
    },

    _ordinalSuffix(n) {
        const s = ['th','st','nd','rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }
};
