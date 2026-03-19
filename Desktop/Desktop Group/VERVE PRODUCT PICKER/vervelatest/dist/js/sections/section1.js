/**
 * section1.js — Collection Picker (Football / Boxing)
 * Renders the sport selector and handles subcategory mapping.
 * Subcategories and images loaded dynamically from Wix selection DB via INIT_DATA.
 */
const Section1 = {
    el: null,
    body: null,

    // Populated by INIT_DATA from Wix
    // Format: { Football: { item1: "Match Day Kits 2026", item2: "Training Wear", image: "url" }, Boxing: { ... } }
    selections: {},

    init() {
        this.el = document.getElementById('section1');
        this.body = document.getElementById('section1Body');

        // Listen for INIT_DATA from Wix widget
        Messaging.on('INIT_DATA', (data) => {
            this.selections = data.selections || {};
            console.log('Selections loaded:', JSON.stringify(this.selections));
            // Debug: log image URLs for each collection
            Object.keys(this.selections).forEach(col => {
                console.log(`[S1] ${col} image:`, this.selections[col].image || 'NONE');
            });
            this.render(); // Re-render with DB images
        });

        this.render();
    },

    /** Get subcategories array for a collection */
    getSubcategories(collection) {
        const sel = this.selections[collection];
        if (!sel) return [];
        return [sel.item1, sel.item2].filter(Boolean);
    },

    /** Build icon HTML — hardcoded CDN URLs load instantly, DB image overrides if present */
    _ICONS: {
        Football: 'https://static.wixstatic.com/media/65ccc7_43d63d3ff681409db151d660b8b38b5a~mv2.png',
        Boxing:   'https://static.wixstatic.com/media/65ccc7_364ed0ea2e87433cb4e094c860f3c96b~mv2.png',
    },

    _iconHtml(collection) {
        const sel = this.selections[collection];
        // DB image takes priority once loaded, otherwise use hardcoded CDN URL
        const src = (sel && sel.image) ? sel.image : (this._ICONS[collection] || '');
        if (src) {
            return `<img src="${src}" alt="${collection}" style="width:100%;height:100%;object-fit:contain;">`;
        }
        // Last-resort SVG fallback (should never be needed)
        if (collection === 'Football') {
            return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="20"/><path d="M24 4L24 14M24 34L24 44"/><path d="M4 24L14 24M34 24L44 24"/><circle cx="24" cy="24" r="8" fill="none"/></svg>`;
        }
        return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20C12 12 20 8 28 12L36 16L36 28C36 36 28 40 20 36L12 32Z"/><path d="M20 24L28 24"/></svg>`;
    },

    render() {
        const collections = Object.keys(this.selections);
        // Force Football first, Boxing second, then any others
        const preferred = ['Football', 'Boxing'];
        const sorted = preferred.filter(c => collections.includes(c))
            .concat(collections.filter(c => !preferred.includes(c)));
        const items = sorted.length ? sorted : ['Football', 'Boxing'];

        this.body.innerHTML = `
            <div class="selector-grid">
                ${items.map(col => `
                    <button class="selector-btn${orderState.collection === col ? ' active' : ''}" data-collection="${col}">
                        <div class="selector-btn-icon">
                            ${this._iconHtml(col)}
                        </div>
                        <span class="selector-btn-label">${col.toUpperCase()}</span>
                    </button>
                `).join('')}
            </div>
        `;

        // Bind click handlers
        this.body.querySelectorAll('.selector-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const col = btn.dataset.collection;
                RestoreManager.guardChange(col, () => this.select(col));
            });
        });
    },

    select(collection) {
        // Update UI
        this.body.querySelectorAll('.selector-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.collection === collection);
        });

        // Update state (cascade reset from section 2 down)
        orderState.resetFrom(2);
        orderState.collection = collection;

        // Switch background image for selected sport
        LeftPane.setBg(collection);

        // Set sport-specific accent colour
        document.getElementById('appContainer').dataset.sport = collection.toLowerCase();

        // Update section header value
        this.el.querySelector('.section-header').innerHTML = `
            <span class="section-number">1</span>
            <span class="section-title">Select Your Sport</span>
            <span class="section-value">${collection}</span>
        `;

        // Mark complete, unlock section 2
        SectionManager.complete(1);
        SectionManager.unlock(2);

        // Tell Section 2 what subcategories are available
        Section2.setSubcategories(this.getSubcategories(collection));

        // Notify Wix
        Messaging.selectionChanged(1, 'collection', collection);
    }
};
