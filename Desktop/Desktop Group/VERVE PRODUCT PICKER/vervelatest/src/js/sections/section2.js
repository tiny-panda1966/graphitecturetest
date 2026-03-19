/**
 * section2.js — Type & Product Title picker
 * Two-step: subcategory tabs → product card grid
 * For Training Wear: adds a 2.1 In-Stock / Bespoke sub-picker before products
 */
const Section2 = {
    el: null,
    body: null,
    subcategories: [],
    products: [],

    // Training sub-type config
    TRAINING_TYPES: {
        instock: {
            label:      'In-Stock',
            turnaround: '3/7 day turnaround',
            products:   ['Pro-X Rainjacket', 'Pro-X Training T-shirt', 'Pro-X Full Zip', 'Pro-X Pants', 'Stadium Jacket', 'Pro-X Training Shorts']
        },
        bespoke: {
            label:      'Bespoke',
            turnaround: '4 week turnaround',
            products:   ['Pro-X 1/4Zip']
        }
    },

    init() {
        this.el   = document.getElementById('section2');
        this.body = document.getElementById('section2Body');

        Messaging.on('PRODUCTS_LIST', (data) => this.onProductsReceived(data.products || []));
    },

    setSubcategories(subs) {
        this.subcategories = subs;
        this.products = [];
        this.render();
    },

    isTrainingWear() {
        return orderState.type === 'Training Wear';
    },

    render() {
        if (!this.subcategories.length) {
            this.body.innerHTML = '<p class="text-sm text-muted">Select a sport first.</p>';
            return;
        }

        // Type tabs
        let html = `<div class="tab-row" id="typeTabs">`;
        this.subcategories.forEach(sub => {
            const active = orderState.type === sub ? ' active' : '';
            html += `<button class="tab-btn${active}" data-type="${sub}">${sub.replace(/\s+\d{4}$/, '')}</button>`;
        });
        html += `</div>`;

        // Training Wear gets the 2.1 sub-picker; others get products directly
        if (this.isTrainingWear()) {
            html += this._renderTrainingSubPicker();
        } else {
            html += `<div class="product-cards" id="productCards"></div>`;
        }

        this.body.innerHTML = html;

        // Bind type tabs
        this.body.querySelectorAll('#typeTabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectType(btn.dataset.type));
        });

        if (this.isTrainingWear()) {
            this._bindTrainingSubPicker();
        } else if (orderState.type && this.products.length) {
            this.renderProducts();
        }
    },

    _renderTrainingSubPicker() {
        const sel = orderState.trainingType;
        return `
        <div class="training-subpicker" id="trainingSubPicker">
            <div class="training-type-row">
                ${Object.entries(this.TRAINING_TYPES).map(([key, cfg]) => `
                <button class="training-type-btn${sel === key ? ' active' : ''}" data-training="${key}">
                    <span class="training-type-label">${cfg.label}</span>
                    <span class="training-type-turnaround">${cfg.turnaround}</span>
                </button>`).join('')}
            </div>
            <div class="product-cards" id="productCards"></div>
        </div>`;
    },

    _bindTrainingSubPicker() {
        this.body.querySelectorAll('.training-type-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectTrainingType(btn.dataset.training));
        });
        // If already selected, show products
        if (orderState.trainingType && this.products.length) {
            this.renderProducts();
        }
    },

    selectType(type) {
        orderState.resetFrom(3);
        orderState.type = type;
        orderState.trainingType = null;
        this.products = [];

        // Always re-render so Training sub-picker appears/disappears correctly
        this.render();

        if (type !== 'Training Wear') {
            const cards = document.getElementById('productCards');
            if (cards) cards.innerHTML = '<p class="text-sm text-muted">Loading products...</p>';
            Messaging.requestProducts(orderState.collection, type);
        }

        Messaging.selectionChanged(2, 'type', type);
    },

    selectTrainingType(trainingType) {
        orderState.resetFrom(3);
        orderState.trainingType = trainingType;
        this.products = [];

        // Update button states
        this.body.querySelectorAll('.training-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.training === trainingType);
        });

        // Show loading, then request products
        const cards = document.getElementById('productCards');
        if (cards) cards.innerHTML = '<p class="text-sm text-muted">Loading products...</p>';

        // Pass trainingType as a sub-filter so Wix can filter by it
        Messaging.requestProducts(orderState.collection, orderState.type, trainingType);
        Messaging.selectionChanged(2, 'trainingType', trainingType);
    },

    onProductsReceived(products) {
        // If Training Wear, filter client-side by the known product names for the selected sub-type
        if (this.isTrainingWear() && orderState.trainingType) {
            const allowed = this.TRAINING_TYPES[orderState.trainingType]?.products || [];
            products = products.filter(p => allowed.some(name => p.title.includes(name)));
        }
        this.products = products;
        this.renderProducts();
    },

    renderProducts() {
        const container = document.getElementById('productCards');
        if (!container) return;

        if (!this.products.length) {
            container.innerHTML = '<p class="text-sm text-muted">No products found.</p>';
            return;
        }

        container.innerHTML = this.products.map(p => {
            const isFrosted = !!p.ribbon;
            const activeClass = orderState.productId === p._id ? ' active' : '';
            const frostedClass = isFrosted ? ' product-card--frosted' : '';
            return `
            <div class="product-card${activeClass}${frostedClass}" data-id="${p._id}" ${isFrosted ? 'data-disabled="true"' : ''}>
                ${p.leadeImage
                    ? `<img class="product-card-img" src="${p.leadeImage}" alt="${p.title}">`
                    : '<div class="product-card-img" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:10px;">No image</div>'
                }
                <div class="product-card-title">${p.title}</div>
                ${isFrosted ? `
                <div class="product-card-frost"></div>
                <div class="product-card-ribbon">${p.ribbon}</div>
                ` : ''}
            </div>`;
        }).join('');

        container.querySelectorAll('.product-card').forEach(card => {
            if (card.dataset.disabled) return;
            card.addEventListener('click', () => this.selectProduct(card.dataset.id));
        });
    },

    selectProduct(productId) {
        const product = this.products.find(p => p._id === productId);
        if (!product) return;

        document.querySelectorAll('.product-card').forEach(c => {
            c.classList.toggle('active', c.dataset.id === productId);
        });

        orderState.resetFrom(3);
        orderState.productId    = productId;
        orderState.productTitle = product.title;

        // Build header value — include training sub-type label if applicable
        let headerVal = product.title;
        if (this.isTrainingWear() && orderState.trainingType) {
            headerVal = `${this.TRAINING_TYPES[orderState.trainingType].label} — ${product.title}`;
        }

        this.el.querySelector('.section-header').innerHTML = `
            <span class="section-number">2</span>
            <span class="section-title">Choose Product</span>
            <span class="section-value">${headerVal}</span>
        `;

        if (product.leadeImage) LeftPane.setImage(product.leadeImage);

        Messaging.requestProductData(productId);
        Messaging.selectionChanged(2, 'product', productId);

        SectionManager.complete(2);
        SectionManager.unlock(3);
    }
};


