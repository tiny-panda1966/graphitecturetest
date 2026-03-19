/**
 * section51.js — Additional Items: Match Day Kit Socks
 * Sub-section of Section 5, only shown for football-matchday.
 *
 * Appears as a rolled-up section card (like all other sections).
 * User can click back into it at any time after first selection.
 *
 * Flow:
 *   1. Section card revealed (unlocked) after Section 5 Done (matchday only)
 *   2. Popup opens automatically
 *   3. 4 type cards: No Sock / Footless / Academy / Fundamental
 *   4. "No Sock" → marks disabled, closes, proceeds to delivery
 *   5. Sock type selection → updates left pane, reveals colour gallery
 *   6. Variant picked → stored in state, Done closes + proceeds to delivery
 *   7. Header click on complete card → reopens popup to change selection
 */
const Section51 = {
    baseEl: null,   // The rolled-up section card in the base layer
    popup: null,    // The popup panel
    body: null,     // popup body
    socksData: [],  // Cached from Wix DB

    init() {
        this.baseEl = document.getElementById('section51base');
        this.popup  = document.getElementById('popupSection51');
        this.body   = document.getElementById('popupBody51');

        document.getElementById('popupClose51')?.addEventListener('click', () => this.close(false));
        document.getElementById('popupDone51')?.addEventListener('click',  () => this.close(true));

        // Header click on base card — reopen popup
        document.getElementById('section51Header')?.addEventListener('click', () => {
            if (!this.baseEl?.classList.contains('locked')) {
                this._openPopup();
            }
        });

        Messaging.on('SOCKS_DATA', (data) => this.onSocksData(data));
    },

    /** Called by app.js after Section 5 Done (matchday only) */
    activate() {
        // Reveal and unlock the base card
        if (this.baseEl) {
            this.baseEl.style.display = '';
            this.baseEl.classList.remove('locked');
        }
        this._openPopup();
    },

    _openPopup() {
        if (this.popup) this.popup.style.display = 'flex';

        if (this.socksData.length) {
            this.render();
        } else {
            this.body.innerHTML = '<p class="text-sm text-muted">Loading sock options...</p>';
            Messaging.requestSocks();
        }
    },

    onSocksData(data) {
        this.socksData = data.socks || data.items || data || [];
        // Debug — log first item's first gallery entry so we can confirm field names
        if (this.socksData.length && this.socksData[0].mediaGallery?.length) {
            console.log('[Section51] mediaGallery sample:', JSON.stringify(this.socksData[0].mediaGallery[0], null, 2));
        }
        this.render();
    },

    render() {
        const socks   = this.socksData;
        const current = orderState.customisation.socks;

        // ── Type cards ──
        // "No Sock" first — active if explicitly declined
        const noSockActive = (current.enabled === false && current.sockType === null && current._chosen) ? 'active' : '';
        let typeCards = `
            <div class="sock-type-card ${noSockActive}" data-socktype="none">
                <div class="sock-type-icon">✕</div>
                <div class="sock-type-label">No Sock</div>
            </div>`;

        socks.forEach(s => {
            const active = current.sockType?._id === s._id ? 'active' : '';
            const img    = s.leadeImage
                ? `<img src="${s.leadeImage}" alt="${s.title}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm);">`
                : `<div style="width:100%;height:100%;background:var(--bg-input);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted);">${s.title}</div>`;
            typeCards += `
            <div class="sock-type-card ${active}" data-socktype="${s._id}">
                <div class="sock-type-img">${img}</div>
                <div class="sock-type-label">${s.title}</div>
            </div>`;
        });

        // ── Variant gallery — only if a type is selected ──
        let variantSection = '';
        if (current.enabled && current.sockType) {
            const sockItem = socks.find(s => s._id === current.sockType._id);
            const variants = sockItem?.mediaGallery || [];
            variantSection = this._renderVariantGallery(variants, current.sockVariant, sockItem);
        }

        this.body.innerHTML = `
            <div class="sub-option-label" style="margin-bottom:10px;">Match Day Kit Socks</div>
            <div class="sock-type-row">${typeCards}</div>
            <div id="sockVariantSection">${variantSection}</div>
        `;

        this._bindEvents();
    },

    _renderVariantGallery(variants, selected, sockItem) {
        if (!variants.length) {
            return '<p class="text-sm text-muted" style="margin-top:12px;">No colour options available.</p>';
        }
        let cards = '';
        variants.forEach((v, i) => {
            // Use name as-is from DB — no normalisation
            const displayName = v.title || v.fileName || v.displayName || `Option ${i + 1}`;
            const imageUrl    = v.displayUrl || v.src || v.imageUrl || v.url || '';
            const variantPrice = sockItem?.price?.variants?.find(p => p.colourName === displayName)?.price
                ?? sockItem?.price?.basePrice ?? 0;
            const priceLabel  = variantPrice ? ` — £${variantPrice.toFixed(2)}` : '';
            const active      = selected?.fileName === (v.fileName || v.title) ? 'active' : '';
            cards += `
                <button class="variant-btn ${active}" data-variantindex="${i}">
                    ${imageUrl
                        ? `<div class="variant-swatch"><img src="${imageUrl}" alt="${displayName}" loading="lazy"></div>`
                        : `<div class="variant-swatch" style="background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text-muted);">${displayName}</div>`
                    }
                    <span class="variant-label">${displayName}${priceLabel}</span>
                </button>`;
        });

        // Confirmation line if a variant is already selected
        const confirmHtml = selected
            ? `<div class="sock-selection-confirm">
                   ✓ ${sockItem?.title || ''} — ${selected.displayName} — £${(selected.price || 0).toFixed(2)}
               </div>`
            : `<div class="sock-selection-confirm" id="sockConfirm" style="display:none;"></div>`;

        return `
            <div class="sub-option-label" style="margin-top:16px;margin-bottom:10px;">Choose a Sock</div>
            <div class="variant-grid">${cards}</div>
            ${confirmHtml}
        `;
    },

    _parseName(fileName) {
        return fileName
            .replace(/\.[^.]+$/, '')           // strip extension
            .replace(/^.*?\s-\s/, '')          // strip "Footless Socks - " prefix style
            .replace(/_/g, ' / ')              // White_Red → White / Red
            .trim();
    },

    _bindEvents() {
        const socks = this.socksData;

        this.body.querySelectorAll('.sock-type-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.socktype;

                if (id === 'none') {
                    orderState.customisation.socks = {
                        enabled: false, sockType: null, sockVariant: null, price: 0, _chosen: true
                    };
                    orderState.recalculate();
                    OrderSummaryUI.update();
                    this.close(true);
                    return;
                }

                const sockItem = socks.find(s => s._id === id);
                if (!sockItem) return;

                // Highlight selected card
                this.body.querySelectorAll('.sock-type-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                // Update state
                orderState.customisation.socks = {
                    enabled: true,
                    sockType: {
                        _id:        sockItem._id,
                        title:      sockItem.title,
                        leadeImage: sockItem.leadeImage || null,
                        price:      sockItem.price || null
                    },
                    sockVariant: null,
                    price:       sockItem.price?.basePrice || 0,
                    _chosen:     true
                };

                // Update left pane
                if (sockItem.leadeImage) LeftPane.setImage(sockItem.leadeImage);

                // Render variant gallery
                const variants = sockItem.mediaGallery || [];
                document.getElementById('sockVariantSection').innerHTML =
                    this._renderVariantGallery(variants, null, sockItem);
                this._bindVariantClicks(variants, sockItem);

                orderState.recalculate();
                OrderSummaryUI.update();
            });
        });

        // Bind any pre-rendered variants (restoring state on reopen)
        if (orderState.customisation.socks.enabled && orderState.customisation.socks.sockType) {
            const sockItem = socks.find(s => s._id === orderState.customisation.socks.sockType._id);
            if (sockItem) this._bindVariantClicks(sockItem.mediaGallery || [], sockItem);
        }
    },

    _bindVariantClicks(variants, sockItem) {
        this.body.querySelectorAll('[data-variantindex]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.body.querySelectorAll('[data-variantindex]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const i           = parseInt(btn.dataset.variantindex);
                const v           = variants[i];
                // Use name as-is — no normalisation
                const displayName = v.title || v.fileName || v.displayName || `Option ${i + 1}`;
                const imageUrl    = v.displayUrl || v.src || v.imageUrl || v.url || '';

                // Match price from price object
                const variantPrice = sockItem?.price?.variants?.find(
                    p => p.colourName === displayName
                )?.price ?? sockItem?.price?.basePrice ?? 0;

                orderState.customisation.socks.sockVariant = {
                    fileName:    v.fileName || v.title || `option-${i}`,
                    displayName,
                    imageUrl,
                    price:       variantPrice
                };
                orderState.customisation.socks.price = variantPrice;

                if (imageUrl) LeftPane.setImage(imageUrl);

                // Update confirmation line
                const confirm = this.body.querySelector('.sock-selection-confirm');
                if (confirm) {
                    confirm.style.display = '';
                    confirm.textContent = `✓ ${sockItem?.title || ''} — ${displayName} — £${variantPrice.toFixed(2)}`;
                }

                orderState.recalculate();
                OrderSummaryUI.update();
            });
        });
    },

    /** Close popup. If proceed=true, mark complete and open delivery. */
    close(proceed) {
        if (this.popup) this.popup.style.display = 'none';

        // Always update the section card header to reflect current selection
        this._updateSectionHeader();

        // Mark the card as complete + collapsed
        if (this.baseEl) {
            this.baseEl.classList.add('complete', 'collapsed');
        }

        if (proceed) {
            SectionManager.unlockBase(6);
            setTimeout(() => {
                PopupManager.open(6);
                Section6.activate();
            }, 300);
        }

        OrderSummaryUI.update();
    },

    _updateSectionHeader() {
        const header = document.getElementById('section51Header');
        if (!header) return;

        const socks = orderState.customisation.socks;
        let valueLabel = '';

        if (!socks._chosen) {
            valueLabel = '';
        } else if (!socks.enabled) {
            valueLabel = 'No Sock';
        } else if (socks.sockType) {
            const variant = socks.sockVariant?.displayName ? ` — ${socks.sockVariant.displayName}` : '';
            valueLabel = `${socks.sockType.title}${variant}`;
        }

        header.innerHTML = `
            <span class="section-number">5.1</span>
            <span class="section-title">Additional Items</span>
            ${valueLabel ? `<span class="section-value">${valueLabel}</span>` : ''}
        `;
    },

    /** Reset — called when user goes back to change section 5 or earlier */
    reset() {
        orderState.customisation.socks = {
            enabled: false, sockType: null, sockVariant: null, price: 0, _chosen: false
        };
        if (this.baseEl) {
            this.baseEl.style.display  = 'none';
            this.baseEl.classList.add('locked');
            this.baseEl.classList.remove('complete', 'collapsed');
        }
        if (this.popup) this.popup.style.display = 'none';
        this._updateSectionHeader();
    }
};
