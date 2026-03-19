/**
 * uploadButton.js — Upload delegation
 * All file uploads are handled by Wix via postMessage.
 * This component manages upload state indicators.
 */
const UploadButton = {
    /** Mark an upload field as having a file */
    markComplete(field) {
        const btn = document.querySelector(`[data-upload-field="${field}"]`);
        if (btn) {
            btn.classList.add('has-file');
            btn.title = 'File uploaded';
        }
    },

    /** Clear upload state for a field */
    clearField(field) {
        const btn = document.querySelector(`[data-upload-field="${field}"]`);
        if (btn) {
            btn.classList.remove('has-file');
            btn.title = '';
        }
    }
};
