/**
 * section3.js — Colour / Variant Selection
 * Displays mediaGallery images as selectable colour swatches.
 * ParsesfileName to derive display labels.
 */
const Section3 = {
    el: null,
    body: null,
    variants: [],  // Array of { fileName, displayName, imageUrl }

    init() {
        this.el = document.getElementById('section3');
        this.body = document.getElementById('section3Body');

        // Listen for converted image URLs from Wix
        Messaging.on('IMAGE_URLS', (data) => this.onImagesReceived(data.images || []));
        Messaging.on('PRODUCT_DATA', (data) => this.onProductData(data.product));
    },

    onProductData(product) {
        if (!product) return;
        orderState.productData = product;

        // If Wix sends pre-converted URLs in IMAGE_URLS, we wait for that.
        // But if the product data already has renderable URLs, use them.
        // The widget should send IMAGE_URLS separately after conversion.
    },

    onImagesReceived(images) {
        this.variants = images.map(img => ({
            fileName: img.fileName,
            displayName: Helpers.parseVariantName(img.fileName),
            imageUrl: img.displayUrl || img.url
        }));
        this.render();
    },

    render() {
        if (!this.variants.length) {
            this.body.innerHTML = '<p class="text-sm text-muted">Select a product to see colour options.</p>';
            return;
        }

        let html = '<div class="variant-grid">';
        this.variants.forEach((v, i) => {
            const active = orderState.variant && orderState.variant.fileName === v.fileName ? ' active' : '';
            html += `
                <button class="variant-btn${active}" data-index="${i}">
                    <div class="variant-swatch">
                        <img src="${v.imageUrl}" alt="${v.displayName}" loading="lazy">
                    </div>
                    <span class="variant-label" title="${v.displayName}">${v.displayName}</span>
                </button>
            `;
        });
        html += '</div>';

        this.body.innerHTML = html;

        // Bind clicks
        this.body.querySelectorAll('.variant-btn').forEach(btn => {
            btn.addEventListener('click', () => this.select(parseInt(btn.dataset.index)));
        });
    },

    select(index) {
        const variant = this.variants[index];
        if (!variant) return;

        // Update UI
        this.body.querySelectorAll('.variant-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
        });

        // Only reset sections 4+ if the variant actually changed
        if (!orderState.variant || orderState.variant.fileName !== variant.fileName) {
            orderState.resetFrom(4);
        }
        orderState.variant = { ...variant };

        // Update left pane image
        LeftPane.setImage(variant.imageUrl);

        // Update section header
        this.el.querySelector('.section-header').innerHTML = `
            <span class="section-number">3</span>
            <span class="section-title">Select Colour</span>
            <span class="section-value">${variant.displayName}</span>
        `;

        // Mark section 3 complete but DON'T auto-open section 4
        // User stays on colour selection until they click section 4 header
        SectionManager.complete(3);
        SectionManager.unlockBase(4);

        Messaging.selectionChanged(3, 'variant', variant.fileName);
    }
};
