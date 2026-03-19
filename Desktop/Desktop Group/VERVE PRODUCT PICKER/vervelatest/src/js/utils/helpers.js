/**
 * helpers.js — Utility functions
 */
const Helpers = {
    /** Format number as GBP price */
    formatPrice(amount) {
        return '£' + Number(amount).toFixed(2);
    },

    /**
     * Parse a mediaGallery fileName to extract the colour/variant display name.
     * E.g. "Division 2.0 - Blue_White.png" → "Blue / White"
     *      "Pro-X T-Shirt - Black.png" → "Black"
     *      "Burgundy.png" → "Burgundy"
     */
    parseVariantName(fileName) {
        if (!fileName) return '';
        // Strip extension
        let name = fileName.replace(/\.\w+$/, '');
        // If it contains " - ", take everything after the last " - "
        const dashIdx = name.lastIndexOf(' - ');
        if (dashIdx !== -1) {
            name = name.substring(dashIdx + 3).trim();
        }
        // Replace underscores with " / "
        name = name.replace(/_/g, ' / ');
        // Clean up extra spaces
        return name.replace(/\s+/g, ' ').trim();
    },

    /**
     * Determine the size key name from a sizeGuide entry.
     * Products use different keys: "size", "sizeUk", "sizeUK", or "color" for colour-only items.
     */
    getSizeKey(sizeGuideEntry) {
        if (!sizeGuideEntry) return null;
        for (const key of ['size', 'sizeUk', 'sizeUK']) {
            if (key in sizeGuideEntry) return key;
        }
        if ('color' in sizeGuideEntry) return 'color'; // Bobble hat etc.
        return null;
    },

    /**
     * Get measurement columns from a sizeGuide entry (everything except size, price, priceGroup).
     * Returns array of { key, label } objects.
     */
    getMeasurementColumns(sizeGuideEntry) {
        if (!sizeGuideEntry) return [];
        const exclude = ['size', 'sizeUk', 'sizeUK', 'price', 'priceGroup', 'color', 'hex'];
        return Object.keys(sizeGuideEntry)
            .filter(k => !exclude.includes(k))
            .map(k => ({
                key: k,
                label: k
                    .replace(/([A-Z])/g, ' $1')     // camelCase → spaces
                    .replace(/Cm$/, ' (cm)')          // Cm suffix → (cm)
                    .replace(/^./, s => s.toUpperCase()) // capitalize
                    .trim()
            }));
    },

    /**
     * Parse a newProducts sizeGuide text string into an array of size labels.
     * Splits on ',' and '&', trims whitespace, removes empty tokens.
     * e.g. "Small, Medium, Large, XL & 2XL" → ["Small","Medium","Large","XL","2XL"]
     */
    parseSizeGuide(text) {
        if (!text) return [];
        return text.split(/[,&]/).map(s => s.trim()).filter(Boolean);
    },

    /**
     * Detect priceGroup ('adult' | 'junior') from sizeGuide text.
     * Rules: explicit 'Adult'/'Junior' text → use that.
     * Else: contains 'Yr' → junior. Otherwise → adult.
     */
    detectSizeGroup(text) {
        if (!text) return 'adult';
        if (/adult/i.test(text)) return 'adult';
        if (/junior/i.test(text)) return 'junior';
        if (/yr/i.test(text)) return 'junior';
        return 'adult';
    },

    /**
     * Parse all salePrice* fields from a product DB row into a sorted tiers array.
     * e.g. { salePrice1To8: 25, salePrice9To23: 22, salePrice300: 18 }
     * → [{ min:1, max:8, price:25 }, { min:9, max:23, price:22 }, { min:300, max:Infinity, price:18 }]
     */
    parsePriceTiers(item) {
        const tiers = [];
        Object.keys(item).forEach(key => {
            if (!key.startsWith('salePrice')) return;
            const rest = key.replace('salePrice', '');
            const rangeMatch = rest.match(/^(\d+)To(\d+)$/i);
            if (rangeMatch) {
                tiers.push({ min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]), price: parseFloat(item[key]) || 0 });
            } else {
                const singleMatch = rest.match(/^(\d+)$/);
                if (singleMatch) {
                    tiers.push({ min: parseInt(singleMatch[1]), max: Infinity, price: parseFloat(item[key]) || 0 });
                }
            }
        });
        return tiers.sort((a, b) => a.min - b.min);
    },

    /**
     * Find the active price tier for a given total quantity.
     * Returns the tier's unit price, or the first tier's price if none match.
     */
    getTierPrice(tiers, qty) {
        if (!tiers || !tiers.length) return 0;
        const active = tiers.slice().reverse().find(t => qty >= t.min);
        return active ? active.price : tiers[0].price;
    },

    /** Simple debounce */
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    /** Generate a short unique ID */
    uid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
};
