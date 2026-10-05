// ==========================================
// MODUL 3: STOK MASUK (Stock In)
// ==========================================

let editingStockInNumber = null;
let editingStockInStatus = null;
let editingStockInCanEdit = false;
let editingStockInCanRevert = false;
let currentStockInReport = null;
let stockInReportZoom = 1;
let stockInReportMainZIndex = '';

async function fetchStockIn() {
    try {
        const res = await fetch(`${API_URL}/stokin`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil daftar stok in.');
        if (!Array.isArray(result.data)) throw new Error('Format daftar stok in tidak valid.');

        const tbody = document.getElementById('tblStockIn');
        if (!tbody) return;
        tbody.replaceChildren();
        if (!result.data.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.className = 'p-4 text-center text-gray-400';
            cell.textContent = 'Belum ada transaksi stok in.';
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            result.data.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'cursor-pointer hover:bg-indigo-50';
                row.addEventListener('click', () => showStockInDetail(item.no_stok_in));
                const numberCell = document.createElement('td');
                numberCell.className = 'p-3 font-mono text-xs font-semibold text-indigo-700';
                numberCell.textContent = item.no_stok_in;
                const dateCell = document.createElement('td');
                dateCell.className = 'p-3';
                dateCell.dataset.dateValue = item.tanggal;
                dateCell.textContent = formatStockInDate(item.tanggal);
                const statusCell = document.createElement('td');
                statusCell.className = 'p-3';
                const statusBadge = document.createElement('span');
                statusBadge.className = item.status === 'Confirmed'
                    ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
                    : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700';
                statusBadge.textContent = item.status === 'Confirmed' ? 'Dikonfirmasi' : 'Pending';
                statusCell.appendChild(statusBadge);
                row.append(numberCell, dateCell, statusCell);
                tbody.appendChild(row);
            });
        }
        showStockInMessage('');
    } catch (err) {
        console.error('Gagal load daftar stok in:', err);
        showStockInMessage(err.message);
    }
}

async function openStockInCreate(stockIn = null) {
    const form = document.getElementById('formStockInCreate');
    if (form) form.reset();
    editingStockInNumber = stockIn?.no_stok_in || null;
    editingStockInStatus = stockIn?.status || null;
    editingStockInCanEdit = Boolean(stockIn?.can_edit);
    editingStockInCanRevert = Boolean(stockIn?.can_revert);
    document.getElementById('stockInCreateTitle').textContent =
        editingStockInNumber ? 'Edit Stok In' : 'Tambah Stok In';
    document.getElementById('btnSaveStockIn').textContent =
        editingStockInNumber ? 'Simpan Perubahan' : 'Simpan Stok In';
    document.getElementById('stockInCreateMessage').classList.add('hidden');
    document.getElementById('stockInCreateStatus').classList.add('hidden');
    const today = new Date();
    document.getElementById('newStockInDate').value = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
    document.getElementById('stockInCreateItems').replaceChildren();
    document.getElementById('newStockInTotal').textContent = 'Rp 0';
    try {
        const [supplierResponse, barangResponse] = await Promise.all([
            fetch(`${API_URL}/supplier`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/barang`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const [supplierResult, barangResult] = await Promise.all([
            supplierResponse.json(),
            barangResponse.json()
        ]);
        if (!supplierResponse.ok) throw new Error(supplierResult.error || 'Gagal mengambil daftar supplier.');
        if (!barangResponse.ok) throw new Error(barangResult.error || 'Gagal mengambil daftar barang.');
        if (!Array.isArray(supplierResult.data) || !Array.isArray(barangResult.data)) {
            throw new Error('Format data supplier atau barang tidak valid.');
        }

        const supplierSelect = document.getElementById('newStockInSupplier');
        supplierSelect.replaceChildren(new Option('Tanpa supplier', ''));
        supplierResult.data.forEach(supplier => {
            supplierSelect.add(new Option(
                `${supplier.nama_supplier} (${supplier.kode_supplier})`,
                supplier.kode_supplier
            ));
        });
        globalBarang = barangResult.data;
        if (!globalBarang.length) throw new Error('Tambahkan master barang terlebih dahulu sebelum membuat stok in.');

        if (stockIn) {
            document.getElementById('newStockInNumber').value = stockIn.no_stok_in;
            document.getElementById('newStockInDate').value = String(stockIn.tanggal).slice(0, 10);
            document.getElementById('newStockInSupplier').value = stockIn.kode_supplier || '';
            stockIn.details.forEach(detail => {
                addStockInItemRow();
                const row = document.querySelector('.stock-in-create-row:last-child');
                row.querySelector('.stock-in-product').value = detail.kode_barang;
                row.querySelector('.stock-in-qty').value = detail.qty;
                row.querySelector('.stock-in-price').value = detail.satuan_harga;
            });
            updateStockInCreateTotal();
        }

        document.getElementById('stockInCreateModal').classList.remove('hidden');
        document.getElementById('stockInCreateModal').scrollTop = 0;
        document.getElementById('formStockInCreate').scrollTop = 0;
        const mainContent = document.getElementById('moduleContent').closest('main');
        mainContent.classList.remove('z-10');
        mainContent.classList.add('z-50');
        document.body.classList.add('overflow-hidden');
        if (!stockIn) addStockInItemRow();
        updateStockInCreateState();
        document.getElementById('newStockInNumber').focus({ preventScroll: true });
    } catch (err) {
        console.error('Gagal membuka form stok in:', err);
        showStockInMessage(err.message);
    }
}

function closeStockInCreate() {
    const modal = document.getElementById('stockInCreateModal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    const mainContent = document.getElementById('moduleContent').closest('main');
    mainContent.classList.remove('z-50');
    mainContent.classList.add('z-10');
    document.body.classList.remove('overflow-hidden');
    const form = document.getElementById('formStockInCreate');
    if (form) form.reset();
    editingStockInNumber = null;
    editingStockInStatus = null;
    editingStockInCanEdit = false;
    editingStockInCanRevert = false;
    document.getElementById('newStockInNumber').readOnly = false;
    document.getElementById('btnSaveStockIn').classList.remove('hidden');
    document.getElementById('btnDeleteStockInCreate').classList.add('hidden');
    document.getElementById('btnToggleStockInCreateStatus').classList.add('hidden');
    document.getElementById('stockInCreateStatus').classList.add('hidden');
}

function addStockInItemRow() {
    const tbody = document.getElementById('stockInCreateItems');
    if (!tbody) return;
    const row = document.createElement('tr');
    row.className = 'stock-in-create-row';

    const productCell = document.createElement('td');
    productCell.className = 'p-2';
    const productSelect = document.createElement('select');
    productSelect.className = 'stock-in-product w-full min-w-48 rounded-lg border border-gray-300 px-2 py-2 text-sm';
    productSelect.required = true;
    productSelect.add(new Option('-- Pilih barang --', ''));
    globalBarang.forEach(product => {
        productSelect.add(new Option(
            `${product.nama_barang} (${product.kode_barang})`,
            product.kode_barang
        ));
    });
    productCell.appendChild(productSelect);

    const qtyCell = document.createElement('td');
    qtyCell.className = 'p-2';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.step = '1';
    qtyInput.value = '1';
    qtyInput.required = true;
    qtyInput.className = 'stock-in-qty w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm';
    qtyCell.appendChild(qtyInput);

    const priceCell = document.createElement('td');
    priceCell.className = 'p-2';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '0.01';
    priceInput.value = '0';
    priceInput.required = true;
    priceInput.className = 'stock-in-price w-32 rounded-lg border border-gray-300 px-2 py-2 text-sm';
    priceCell.appendChild(priceInput);

    const subtotalCell = document.createElement('td');
    subtotalCell.className = 'stock-in-subtotal whitespace-nowrap p-2 text-sm font-medium';
    subtotalCell.textContent = 'Rp 0';

    const actionCell = document.createElement('td');
    actionCell.className = 'p-2';
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'stock-in-remove rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100';
    removeButton.textContent = 'Hapus';
    removeButton.addEventListener('click', () => {
        row.remove();
        updateStockInCreateTotal();
    });
    actionCell.appendChild(removeButton);

    productSelect.addEventListener('change', () => {
        const product = globalBarang.find(item => item.kode_barang === productSelect.value);
        priceInput.value = product ? Number(product.satuan_harga || 0) : '0';
        updateStockInCreateTotal();
    });
    qtyInput.addEventListener('input', updateStockInCreateTotal);
    priceInput.addEventListener('input', updateStockInCreateTotal);
    row.append(productCell, qtyCell, priceCell, subtotalCell, actionCell);
    tbody.appendChild(row);
    updateStockInCreateTotal();
}

function updateStockInCreateTotal() {
    let grandTotal = 0;
    document.querySelectorAll('.stock-in-create-row').forEach(row => {
        const qty = Number(row.querySelector('.stock-in-qty').value) || 0;
        const price = Number(row.querySelector('.stock-in-price').value) || 0;
        const subtotal = qty * price;
        grandTotal += subtotal;
        row.querySelector('.stock-in-subtotal').textContent =
            `Rp ${subtotal.toLocaleString('id-ID')}`;
    });
    const totalEl = document.getElementById('newStockInTotal');
    if (totalEl) {
        totalEl.textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    }
}

async function saveStockIn(event) {
    event.preventDefault();
    const rows = Array.from(document.querySelectorAll('.stock-in-create-row'));
    if (!rows.length) {
        document.getElementById('stockInCreateMessage').textContent = 'Tambahkan minimal satu barang.';
        document.getElementById('stockInCreateMessage').classList.remove('hidden');
        return;
    }

    const button = document.getElementById('btnSaveStockIn');
    const message = document.getElementById('stockInCreateMessage');
    button.disabled = true;
    message.classList.add('hidden');
    try {
        const payload = {
            no_stok_in: document.getElementById('newStockInNumber').value.trim(),
            tanggal: document.getElementById('newStockInDate').value,
            kode_supplier: document.getElementById('newStockInSupplier').value || null,
            items: rows.map(row => ({
                kode_barang: row.querySelector('.stock-in-product').value,
                qty: Number(row.querySelector('.stock-in-qty').value),
                satuan_harga: Number(row.querySelector('.stock-in-price').value)
            }))
        };
        const res = await fetch(
            editingStockInNumber
                ? `${API_URL}/stokin/${encodeURIComponent(editingStockInNumber)}`
                : `${API_URL}/stokin`,
            {
            method: editingStockInNumber ? 'PUT' : 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menyimpan stok in.');
        editingStockInNumber = result.data.no_stok_in;
        editingStockInStatus = 'Pending';
        editingStockInCanEdit = true;
        editingStockInCanRevert = true;
        updateStockInCreateState();
        await fetchStockIn();
        showStockInCreateMessage('');
    } catch (err) {
        console.error('Gagal menyimpan stok in:', err);
        message.textContent = err.message;
        message.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
}

function updateStockInCreateState() {
    const isSaved = Boolean(editingStockInNumber);
    const isPending = editingStockInStatus === 'Pending';
    const canEdit = editingStockInCanEdit;
    const saveButton = document.getElementById('btnSaveStockIn');
    const deleteButton = document.getElementById('btnDeleteStockInCreate');
    const statusButton = document.getElementById('btnToggleStockInCreateStatus');
    const statusMessage = document.getElementById('stockInCreateStatus');
    const form = document.getElementById('formStockInCreate');
    const isEditable = !isSaved || (isPending && canEdit);

    document.getElementById('newStockInNumber').readOnly = isSaved;
    saveButton.textContent = isSaved ? 'Simpan Perubahan' : 'Simpan Stok In';
    form.querySelectorAll('input, select').forEach(input => {
        if (input.id !== 'newStockInNumber') input.disabled = !isEditable;
    });
    document.getElementById('btnAddStockInItem').disabled = !isEditable;
    form.querySelectorAll('.stock-in-remove').forEach(button => {
        button.disabled = !isEditable;
    });
    saveButton.classList.toggle('hidden', isSaved && !isEditable);
    deleteButton.classList.toggle('hidden', !isSaved || !isPending || !canEdit);
    statusButton.textContent = isPending ? 'Konfirmasi Stok In' : 'Kembalikan ke Pending';
    statusButton.className = isPending
        ? 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
        : 'rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50';
    statusButton.classList.toggle('hidden', !isSaved || (!isPending && !editingStockInCanRevert));
    statusMessage.textContent = isSaved
        ? isPending
            ? canEdit
                ? 'Status: Pending'
                : 'Draft penjualan memakai stok ini; hapus draft penjualan sebelum mengedit atau menghapus stok in.'
            : editingStockInCanRevert
                ? 'Status: Dikonfirmasi — stok sudah bertambah.'
                : 'Stok ini sudah dipakai penjualan terkonfirmasi dan tidak bisa dikembalikan ke Pending.'
        : '';
    statusMessage.className = `text-sm font-semibold ${
        isPending ? 'text-amber-700' : 'text-green-700'
    }`;
    statusMessage.classList.toggle('hidden', !isSaved);
    statusButton.onclick = () => setStockInCreateStatus(isPending ? 'Confirmed' : 'Pending');
    deleteButton.onclick = () => deleteStockInCreateDraft();
}

function showStockInCreateMessage(message, success = false) {
    const element = document.getElementById('stockInCreateMessage');
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}

async function setStockInCreateStatus(status) {
    const action = status === 'Confirmed' ? 'mengonfirmasi' : 'mengembalikan ke Pending';
    if (!window.confirm(translateAppText(`Yakin ${action} stok in ${editingStockInNumber}?`))) return;
    const statusButton = document.getElementById('btnToggleStockInCreateStatus');
    statusButton.disabled = true;
    try {
        const res = await fetch(`${API_URL}/stokin/${encodeURIComponent(editingStockInNumber)}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengubah status stok in.');

        const detailResponse = await fetch(
            `${API_URL}/stokin/${encodeURIComponent(editingStockInNumber)}`,
            { headers: { Authorization: 'Bearer ' + token } }
        );
        const detailResult = await detailResponse.json();
        if (!detailResponse.ok) throw new Error(detailResult.error || 'Gagal memuat status stok in terbaru.');
        editingStockInStatus = detailResult.data.status;
        editingStockInCanEdit = Boolean(detailResult.data.can_edit);
        editingStockInCanRevert = Boolean(detailResult.data.can_revert);
        updateStockInCreateState();
        await fetchStockIn();
        showStockInCreateMessage(`Stok in berhasil diubah menjadi ${status}.`, true);
    } catch (err) {
        console.error('Gagal mengubah status stok in:', err);
        showStockInCreateMessage(err.message);
    } finally {
        statusButton.disabled = false;
    }
}

async function deleteStockInCreateDraft() {
    if (!window.confirm(translateAppText(`Hapus draft stok in ${editingStockInNumber}?`))) return;
    try {
        const res = await fetch(`${API_URL}/stokin/${encodeURIComponent(editingStockInNumber)}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menghapus draft stok in.');
        const number = editingStockInNumber;
        closeStockInCreate();
        await fetchStockIn();
        showStockInMessage(`Draft stok in ${number} berhasil dihapus.`, true);
    } catch (err) {
        console.error('Gagal menghapus draft stok in:', err);
        showStockInCreateMessage(err.message);
    }
}

async function showStockInDetail(noStokIn) {
    try {
        const res = await fetch(`${API_URL}/stokin/${encodeURIComponent(noStokIn)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil detail stok in.');

        const stockIn = result.data;
        currentStockInReport = stockIn;
        const detailMessage = document.getElementById('stockInDetailMessage');
        detailMessage.textContent = '';
        detailMessage.classList.add('hidden');
        document.getElementById('stockInDetailTitle').textContent = `Detail Stok In`;
        const subtitle = document.getElementById('stockInDetailSubtitle');
        subtitle.dataset.dateValue = stockIn.tanggal;
        subtitle.textContent = formatStockInDate(stockIn.tanggal);
        document.getElementById('stockInDetailNumber').textContent = stockIn.no_stok_in;
        document.getElementById('stockInDetailSupplier').textContent =
            stockIn.nama_supplier || stockIn.kode_supplier || '-';
        const isPending = stockIn.status === 'Pending';
        const statusElement = document.getElementById('stockInDetailStatus');
        statusElement.textContent = isPending ? 'Pending' : 'Dikonfirmasi';
        statusElement.className = `mt-1 font-semibold ${isPending ? 'text-amber-700' : 'text-green-700'}`;
        document.getElementById('stockInDetailTotal').textContent =
            `Rp ${Number(stockIn.grand_total || 0).toLocaleString('id-ID')}`;

        const tbody = document.getElementById('tblStockInDetails');
        if (!tbody) return;
        tbody.replaceChildren();
        if (!Array.isArray(stockIn.details) || !stockIn.details.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'p-4 text-center text-gray-400';
            cell.textContent = 'Tidak ada rincian barang.';
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            stockIn.details.forEach(detail => {
                const row = document.createElement('tr');
                [
                    detail.kode_barang,
                    detail.nama_barang || '-',
                    `${detail.qty} ${detail.satuan || ''}`.trim(),
                    `Rp ${Number(detail.satuan_harga || 0).toLocaleString('id-ID')}`,
                    `Rp ${Number(detail.subtotal || 0).toLocaleString('id-ID')}`
                ].forEach(value => {
                    const cell = document.createElement('td');
                    cell.className = 'p-3';
                    cell.textContent = value ?? '-';
                    row.appendChild(cell);
                });
                tbody.appendChild(row);
            });
        }
        const canEdit = Boolean(stockIn.can_edit);
        const canRevert = Boolean(stockIn.can_revert);
        const actions = document.getElementById('stockInDetailActions');
        actions.classList.toggle('hidden', isPending ? false : !canRevert);
        document.getElementById('btnEditStockIn').classList.toggle('hidden', !isPending || !canEdit);
        document.getElementById('btnDeleteStockIn').classList.toggle('hidden', !isPending || !canEdit);
        const statusButton = document.getElementById('btnToggleStockInStatus');
        statusButton.textContent = isPending ? 'Konfirmasi Stok In' : 'Pending';
        statusButton.className = isPending
            ? 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
            : 'rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50';
        statusButton.classList.toggle('hidden', isPending ? false : !canRevert);
        const lockMessage = document.getElementById('stockInDetailLockMessage');
        lockMessage.textContent = !canRevert
            ? 'Stok in ini sudah digunakan dalam penjualan terkonfirmasi sehingga tidak dapat dikembalikan ke Pending.'
            : !canEdit
                ? 'Stok in ini digunakan dalam draft penjualan; edit atau hapus draft penjualan tersebut terlebih dahulu.'
                : '';
        lockMessage.classList.toggle('hidden', canRevert && canEdit);
        document.getElementById('btnEditStockIn').onclick = () => editStockIn(noStokIn);
        document.getElementById('btnDeleteStockIn').onclick = () => deleteStockIn(noStokIn);
        statusButton.onclick = () => setStockInStatus(noStokIn, isPending ? 'Confirmed' : 'Pending');
        document.getElementById('stockInDetailModal').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        showStockInMessage('');
    } catch (err) {
        console.error('Gagal load detail stok in:', err);
        showStockInMessage(err.message);
    }
}

function openStockInReport() {
    if (!currentStockInReport) {
        showStockInMessage('Data laporan stok in tidak tersedia.');
        return;
    }

    const frame = document.getElementById('stockInReportFrame');
    frame.srcdoc = buildStockInReportPreview(currentStockInReport);
    const modal = document.getElementById('stockInReportModal');
    const main = modal.closest('main');
    if (main) {
        stockInReportMainZIndex = main.style.zIndex;
        main.style.zIndex = '1000';
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    stockInReportZoom = 1;
}

function closeStockInReport() {
    const modal = document.getElementById('stockInReportModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    const main = modal.closest('main');
    if (main) main.style.zIndex = stockInReportMainZIndex;
    if (document.getElementById('stockInDetailModal').classList.contains('hidden')) {
        document.body.classList.remove('overflow-hidden');
    }
}

function printStockInReport() {
    const frame = document.getElementById('stockInReportFrame');
    if (!frame.contentWindow) {
        showStockInMessage('Preview laporan belum siap dicetak.');
        return;
    }
    frame.contentWindow.focus();
    frame.contentWindow.print();
}

function zoomStockInReport(change) {
    stockInReportZoom = Math.min(1.5, Math.max(0.6, stockInReportZoom + change));
    applyStockInReportZoom();
}

function resetStockInReportZoom() {
    stockInReportZoom = 1;
    applyStockInReportZoom();
}

function applyStockInReportZoom() {
    const frame = document.getElementById('stockInReportFrame');
    const report = frame.contentDocument?.body;
    if (report) report.style.zoom = String(stockInReportZoom);
}

function emailStockInReport() {
    if (!currentStockInReport) {
        showStockInMessage('Data laporan stok in tidak tersedia.');
        return;
    }

    const stockIn = currentStockInReport;
    const subject = `Laporan Stok In ${stockIn.no_stok_in}`;
    const items = (Array.isArray(stockIn.details) ? stockIn.details : []).map(detail =>
        `- ${detail.kode_barang} | ${detail.nama_barang || '-'} | ${detail.qty} ${detail.satuan || ''} | Rp ${Number(detail.subtotal || 0).toLocaleString('id-ID')}`
    );
    const body = [
        `Laporan Stok In ${stockIn.no_stok_in}`,
        `Tanggal: ${formatStockInDate(stockIn.tanggal)}`,
        `Supplier: ${stockIn.nama_supplier || stockIn.kode_supplier || '-'}`,
        `Status: ${stockIn.status}`,
        '',
        'Rincian barang:',
        ...items,
        '',
        `Grand Total: Rp ${Number(stockIn.grand_total || 0).toLocaleString('id-ID')}`
    ].join('\n');

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function downloadStockInReportXls() {
    if (!currentStockInReport) {
        showStockInMessage('Data laporan stok in tidak tersedia.');
        return;
    }

    const stockIn = currentStockInReport;
    const details = Array.isArray(stockIn.details) ? stockIn.details : [];
    const status = stockIn.status === 'Pending' ? 'Pending' : 'Dikonfirmasi';
    const rows = [
        `<Row><Cell ss:MergeAcross="4"><Data ss:Type="String">${escapeSpreadsheetValue(translateAppText('Laporan Stok In').toUpperCase())}</Data></Cell></Row>`,
        spreadsheetRow([
            translateAppText('No. Stok In'),
            stockIn.no_stok_in,
            translateAppText('Tanggal'),
            formatStockInDate(stockIn.tanggal)
        ]),
        spreadsheetRow([
            translateAppText('Supplier'),
            stockIn.nama_supplier || stockIn.kode_supplier || '-',
            translateAppText('Status'),
            translateAppText(status)
        ]),
        spreadsheetRow(['']),
        spreadsheetRow([
            translateAppText('Kode Barang'),
            translateAppText('Nama Barang'),
            translateAppText('Qty'),
            translateAppText('Harga Satuan'),
            translateAppText('Subtotal')
        ], 'Header')
    ];

    details.forEach(detail => {
        rows.push(spreadsheetRow([
            detail.kode_barang,
            detail.nama_barang || '-',
            Number(detail.qty || 0),
            Number(detail.satuan_harga || 0),
            Number(detail.subtotal || 0)
        ], 'Detail'));
    });
    rows.push(spreadsheetRow([
        '',
        '',
        '',
        translateAppText('Grand Total'),
        Number(stockIn.grand_total || 0)
    ], 'Total'));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Styles>
        <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#4338CA" ss:Pattern="Solid"/></Style>
        <Style ss:ID="Number"><NumberFormat ss:Format="#,##0"/></Style>
        <Style ss:ID="Currency"><NumberFormat ss:Format="&quot;Rp&quot; #,##0"/></Style>
        <Style ss:ID="Total"><Font ss:Bold="1"/><NumberFormat ss:Format="&quot;Rp&quot; #,##0"/></Style>
    </Styles>
    <Worksheet ss:Name="Stock In"><Table>${rows.join('')}</Table></Worksheet>
</Workbook>`;
    const blob = new Blob([`\uFEFF${xml}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeNumber = String(stockIn.no_stok_in || 'stock-in')
        .replace(/[<>:"/\\|?*]+/g, '_')
        .replace(/^\.+|\.+$/g, '') || 'stock-in';
    link.href = url;
    link.download = `Laporan-Stok-In-${safeNumber}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildStockInReportPreview(stockIn) {
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
    const details = Array.isArray(stockIn.details) ? stockIn.details : [];
    const rows = details.map(detail => `
        <tr>
            <td>${escapeHtml(detail.kode_barang)}</td>
            <td>${escapeHtml(detail.nama_barang || '-')}</td>
            <td>${escapeHtml(`${detail.qty} ${detail.satuan || ''}`.trim())}</td>
            <td class="number">Rp ${Number(detail.satuan_harga || 0).toLocaleString('id-ID')}</td>
            <td class="number">Rp ${Number(detail.subtotal || 0).toLocaleString('id-ID')}</td>
        </tr>`).join('');
    const status = stockIn.status === 'Pending' ? 'Pending' : 'Dikonfirmasi';

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laporan Stok In ${escapeHtml(stockIn.no_stok_in)}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; padding: 8px; background: #303030; color: #1f2937; font: 14px Arial, sans-serif; }
        article { width: min(100%, 210mm); min-height: 297mm; margin: 0 auto 8px; padding: 24mm; background: #fff; box-shadow: 0 2px 5px #0005; }
        h1 { margin: 0 0 6px; font-size: 24px; }
        .subtitle { margin: 0 0 28px; color: #6b7280; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 24px; }
        .label { display: block; margin-bottom: 5px; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .value { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 11px 9px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        th { background: #f9fafb; color: #4b5563; font-size: 11px; text-transform: uppercase; }
        .number { text-align: right; white-space: nowrap; }
        tfoot td { border-top: 2px solid #d1d5db; border-bottom: 0; font-weight: 700; }
        @media (max-width: 640px) { body { padding: 8px 0; } article { width: 100%; min-height: 100vh; padding: 24px 16px; } .meta { grid-template-columns: 1fr; gap: 12px; } }
        @media print {
            @page { size: A4; margin: 16mm; }
            body { min-height: 0; padding: 0; background: #fff; }
            article { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <article>
        <h1>${escapeHtml(translateAppText('Laporan Stok In'))}</h1>
        <p class="subtitle">${escapeHtml(translateAppText('Rincian transaksi barang masuk'))}</p>
        <section class="meta">
            <div><span class="label">${escapeHtml(translateAppText('No. Stok In'))}</span><span class="value">${escapeHtml(stockIn.no_stok_in)}</span></div>
            <div><span class="label">${escapeHtml(translateAppText('Tanggal'))}</span><span class="value">${escapeHtml(formatStockInDate(stockIn.tanggal))}</span></div>
            <div><span class="label">${escapeHtml(translateAppText('Supplier'))}</span><span class="value">${escapeHtml(stockIn.nama_supplier || stockIn.kode_supplier || '-')}</span></div>
            <div><span class="label">${escapeHtml(translateAppText('Status'))}</span><span class="value">${escapeHtml(translateAppText(status))}</span></div>
        </section>
        <table>
            <thead><tr><th>${escapeHtml(translateAppText('Kode Barang'))}</th><th>${escapeHtml(translateAppText('Nama Barang'))}</th><th>${escapeHtml(translateAppText('Qty'))}</th><th class="number">${escapeHtml(translateAppText('Harga Satuan'))}</th><th class="number">${escapeHtml(translateAppText('Subtotal'))}</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">${escapeHtml(translateAppText('Tidak ada rincian barang.'))}</td></tr>`}</tbody>
            <tfoot><tr><td colspan="4" class="number">${escapeHtml(translateAppText('Grand Total'))}</td><td class="number">Rp ${Number(stockIn.grand_total || 0).toLocaleString('id-ID')}</td></tr></tfoot>
        </table>
    </article>
</body>
</html>`;
}

function spreadsheetRow(values, style = '') {
    return `<Row>${values.map((value, index) => {
        const isNumeric = typeof value === 'number' && Number.isFinite(value);
        const type = isNumeric ? 'Number' : 'String';
        const styleId = style === 'Header'
            ? ' ss:StyleID="Header"'
            : style === 'Total' && index === 4
                ? ' ss:StyleID="Total"'
                : style === 'Detail' && (index === 3 || index === 4)
                    ? ' ss:StyleID="Currency"'
                    : style === 'Detail' && index === 2
                        ? ' ss:StyleID="Number"'
                        : '';
        const content = escapeSpreadsheetValue(value);
        return `<Cell${styleId}><Data ss:Type="${type}">${content}</Data></Cell>`;
    }).join('')}</Row>`;
}

function escapeSpreadsheetValue(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function setStockInStatus(noStokIn, status) {
    const action = status === 'Confirmed' ? 'mengonfirmasi' : 'mengembalikan ke Pending';
    if (!window.confirm(translateAppText(`Yakin ${action} stok in ${noStokIn}?`))) return;
    try {
        const res = await fetch(`${API_URL}/stokin/${encodeURIComponent(noStokIn)}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengubah status stok in.');
        await fetchStockIn();
        await showStockInDetail(noStokIn);
        showStockInMessage(
            `Stok in ${noStokIn} berhasil diubah menjadi ${status}.`,
            true
        );
    } catch (err) {
        console.error('Gagal mengubah status stok in:', err);
        const detailMessage = document.getElementById('stockInDetailMessage');
        detailMessage.textContent = err.message;
        detailMessage.classList.remove('hidden');
    }
}

async function editStockIn(noStokIn) {
    try {
        const res = await fetch(`${API_URL}/stokin/${encodeURIComponent(noStokIn)}`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil detail stok in.');
        if (!result.data.can_edit) {
            throw new Error('Stok in tidak dapat diedit karena sudah terkait dengan penjualan.');
        }
        closeStockInDetail();
        await openStockInCreate(result.data);
    } catch (err) {
        console.error('Gagal membuka edit stok in:', err);
        showStockInMessage(err.message);
    }
}

async function deleteStockIn(noStokIn) {
    if (!window.confirm(translateAppText(`Hapus stok in ${noStokIn}?`))) return;
    try {
        const res = await fetch(`${API_URL}/stokin/${encodeURIComponent(noStokIn)}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menghapus stok in.');
        closeStockInDetail();
        await fetchStockIn();
        showStockInMessage(`Stok in ${noStokIn} berhasil dihapus.`, true);
    } catch (err) {
        console.error('Gagal menghapus stok in:', err);
        showStockInMessage(err.message);
    }
}

function closeStockInDetail() {
    const modal = document.getElementById('stockInDetailModal');
    if (!modal) return;
    modal.classList.add('hidden');
    closeStockInReport();
    currentStockInReport = null;
    if (document.getElementById('stockInReportModal').classList.contains('hidden')) {
        document.body.classList.remove('overflow-hidden');
    }
}

function showStockInMessage(message, success = false) {
    const element = document.getElementById('stockInMessage');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}
