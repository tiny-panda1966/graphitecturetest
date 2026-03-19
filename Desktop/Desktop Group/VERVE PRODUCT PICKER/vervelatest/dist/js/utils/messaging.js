/**
 * messaging.js — postMessage communication layer
 * Handles all Wix ↔ iFrame messaging with typed events.
 */
const Messaging = {
    _handlers: {},

    /** Initialise the message listener */
    init() {
        window.onmessage = (event) => {
            if (!event.data || !event.data.type) return;
            console.log('[MSG IN]', event.data.type, event.data);
            this._dispatch(event.data);
        };
    },

    /** Send a message to the Wix parent (widget code) */
    send(type, payload = {}) {
        const msg = { ...payload, type };
        console.log('[MSG OUT]', type, msg);
        window.parent.postMessage(msg, '*');
    },

    /** Register a handler for a message type */
    on(type, handler) {
        if (!this._handlers[type]) this._handlers[type] = [];
        this._handlers[type].push(handler);
    },

    /** Remove a handler */
    off(type, handler) {
        if (!this._handlers[type]) return;
        this._handlers[type] = this._handlers[type].filter(h => h !== handler);
    },

    /** Dispatch incoming message to registered handlers */
    _dispatch(data) {
        const handlers = this._handlers[data.type];
        if (handlers) {
            handlers.forEach(h => h(data));
        } else {
            console.warn('[MSG] No handler for:', data.type);
        }
    },

    // ─── Convenience send methods ────────────────────────────

    requestProducts(collection, productType) {
        this.send('REQUEST_PRODUCTS', { collection, productType });
    },

    requestProductData(productId) {
        this.send('REQUEST_PRODUCT_DATA', { productId });
    },

    requestCustomisation(collection, productType) {
        this.send('REQUEST_CUSTOMISATION', { collection, productType });
    },

    requestColourEffects(effectName) {
        this.send('REQUEST_COLOUR_EFFECTS', { effectName });
    },

    requestUpload(field, label) {
        this.send('UPLOAD_REQUEST', { field, label });
    },

    sendOrderComplete(orderObject) {
        this.send('ORDER_COMPLETE', { orderObject });
    },

    requestSocks() {
        this.send('REQUEST_SOCKS', {});
    },

    selectionChanged(section, key, value) {
        this.send('SELECTION_CHANGED', { section, key, value });
    }
};
