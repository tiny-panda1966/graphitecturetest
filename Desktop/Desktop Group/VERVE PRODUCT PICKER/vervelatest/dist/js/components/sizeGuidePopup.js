/**
 * sizeGuidePopup.js — Size Guide Modal
 * Displays a full measurement table with dynamic columns.
 */
const SizeGuidePopup = {
    show(sizeGuide) {
        if (!sizeGuide || !sizeGuide.length) return;

        const sizeKey = Helpers.getSizeKey(sizeGuide[0]);
        if (!sizeKey) return;

        const columns = Helpers.getMeasurementColumns(sizeGuide[0]);

        let tableHtml = `<table class="size-table"><thead><tr>`;
        tableHtml += `<th>Size</th><th>Price</th>`;
        columns.forEach(col => { tableHtml += `<th>${col.label}</th>`; });
        tableHtml += `</tr></thead><tbody>`;

        sizeGuide.forEach(entry => {
            const isSelected = orderState.size === entry[sizeKey];
            tableHtml += `<tr class="${isSelected ? 'selected' : ''}">`;
            tableHtml += `<td>${entry[sizeKey]}</td>`;
            tableHtml += `<td>${Helpers.formatPrice(entry.price)}</td>`;
            columns.forEach(col => {
                tableHtml += `<td>${entry[col.key] || '—'}</td>`;
            });
            tableHtml += `</tr>`;
        });

        tableHtml += `</tbody></table>`;

        const overlay = document.getElementById('modalOverlay');
        const content = document.getElementById('modalContent');

        content.innerHTML = `
            <div class="modal-header">
                <div class="modal-title">${orderState.productTitle || 'Size Guide'}</div>
                <button class="modal-close" id="modalClose">✕</button>
            </div>
            <div class="modal-body">${tableHtml}</div>
        `;

        overlay.classList.add('visible');

        document.getElementById('modalClose').addEventListener('click', () => this.hide());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hide();
        });
    },

    hide() {
        document.getElementById('modalOverlay').classList.remove('visible');
    }
};
