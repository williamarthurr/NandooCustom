// ==========================================
// MODUL 2: PENJUALAN (Sales)
// ==========================================

let editingSaleNumber = null;
let editingSaleStatus = null;

async function fetchSales() {
    try {
        const res = await fetch(`${API_URL}/penjualan`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil daftar penjualan.');
        if (!Array.isArray(result.data)) throw new Error('Format daftar penjualan tidak valid.');

        const tbody = document.getElementById('tblSales');
        if (!tbody) return;
        tbody.replaceChildren();
        if (!result.data.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.className = 'p-4 text-center text-gray-400';
            cell.textContent = 'Belum ada transaksi penjualan.';
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            result.data.forEach(sale => {
                const row = document.createElement('tr');
                row.className = 'cursor-pointer hover:bg-indigo-50';
                row.addEventListener('click', () => showSalesDetail(sale.no_penjualan));
                const numberCell = document.createElement('td');
                numberCell.className = 'p-3 font-mono text-xs font-semibold text-indigo-700';
                numberCell.textContent = sale.no_penjualan;
                const dateCell = document.createElement('td');
                dateCell.className = 'p-3';
                dateCell.textContent = formatStockInDate(sale.tanggal);
                const statusCell = document.createElement('td');
                statusCell.className = 'p-3';
                const statusBadge = document.createElement('span');
                statusBadge.className = sale.status === 'Confirmed'
                    ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
                    : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700';
                statusBadge.textContent = sale.status === 'Confirmed' ? 'Dikonfirmasi' : 'Pending';
                statusCell.appendChild(statusBadge);
                row.append(numberCell, dateCell, statusCell);
                tbody.appendChild(row);
            });
        }
        showSalesMessage('');
    } catch (err) {
        console.error('Gagal load daftar penjualan:', err);
        showSalesMessage(err.message);
    }
}

async function showSalesDetail(noPenjualan) {
    try {
        const res = await fetch(`${API_URL}/penjualan/${encodeURIComponent(noPenjualan)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil detail penjualan.');

        const sale = result.data;
        const detailMessage = document.getElementById('salesDetailMessage');
        detailMessage.textContent = '';
        detailMessage.classList.add('hidden');
        document.getElementById('salesDetailSubtitle').textContent = formatStockInDate(sale.tanggal);
        document.getElementById('salesDetailNumber').textContent = sale.no_penjualan;
        document.getElementById('salesDetailCustomer').textContent =
            sale.nama_pelanggan || sale.kode_pelanggan || '-';
        const isPending = sale.status === 'Pending';
        const statusElement = document.getElementById('salesDetailStatus');
        statusElement.textContent = isPending ? 'Pending' : 'Dikonfirmasi';
        statusElement.className = `mt-1 font-semibold ${isPending ? 'text-amber-700' : 'text-green-700'}`;
        document.getElementById('salesDetailTotal').textContent =
            `Rp ${Number(sale.grand_total || 0).toLocaleString('id-ID')}`;

        const tbody = document.getElementById('tblSalesDetails');
        if (!tbody) return;
        tbody.replaceChildren();
        if (!Array.isArray(sale.details) || !sale.details.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.className = 'p-4 text-center text-gray-400';
            cell.textContent = 'Tidak ada rincian barang.';
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            sale.details.forEach(detail => {
                const row = document.createElement('tr');
                [
                    detail.kode_barang,
                    detail.nama_barang || '-',
                    detail.no_stok_in || 'Belum ditentukan',
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
        document.getElementById('btnEditSale').classList.toggle('hidden', !isPending);
        document.getElementById('btnDeleteSale').classList.toggle('hidden', !isPending);
        const statusButton = document.getElementById('btnToggleSaleStatus');
        statusButton.textContent = isPending ? 'Konfirmasi Penjualan' : 'Pending';
        statusButton.className = isPending
            ? 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
            : 'rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50';
        document.getElementById('btnEditSale').onclick = () => editSale(noPenjualan);
        document.getElementById('btnDeleteSale').onclick = () => deleteSale(noPenjualan);
        statusButton.onclick = () => setSaleStatus(noPenjualan, isPending ? 'Confirmed' : 'Pending');
        document.getElementById('salesDetailModal').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        showSalesMessage('');
    } catch (err) {
        console.error('Gagal load detail penjualan:', err);
        showSalesMessage(err.message);
    }
}

async function setSaleStatus(noPenjualan, status) {
    const action = status === 'Confirmed' ? 'mengonfirmasi' : 'mengembalikan ke Pending';
    if (!window.confirm(`Yakin ${action} penjualan ${noPenjualan}?`)) return;
    try {
        const res = await fetch(`${API_URL}/penjualan/${encodeURIComponent(noPenjualan)}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengubah status penjualan.');
        await fetchSales();
        await showSalesDetail(noPenjualan);
        showSalesMessage(
            `Penjualan ${noPenjualan} berhasil diubah menjadi ${status}.`,
            true
        );
    } catch (err) {
        console.error('Gagal mengubah status penjualan:', err);
        const detailMessage = document.getElementById('salesDetailMessage');
        detailMessage.textContent = err.message;
        detailMessage.classList.remove('hidden');
    }
}

async function deleteSale(noPenjualan) {
    if (!window.confirm(`Hapus penjualan ${noPenjualan}?`)) return;
    try {
        const res = await fetch(`${API_URL}/penjualan/${encodeURIComponent(noPenjualan)}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menghapus penjualan.');
        closeSalesDetail();
        await fetchSales();
        showSalesMessage(`Draft penjualan ${noPenjualan} berhasil dihapus.`, true);
    } catch (err) {
        console.error('Gagal menghapus penjualan:', err);
        showSalesMessage(err.message);
    }
}

async function editSale(noPenjualan) {
    try {
        const res = await fetch(`${API_URL}/penjualan/${encodeURIComponent(noPenjualan)}`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil detail penjualan.');
        closeSalesDetail();
        await openSalesCreate(result.data);
    } catch (err) {
        console.error('Gagal membuka edit penjualan:', err);
        showSalesMessage(err.message);
    }
}

function closeSalesDetail() {
    const modal = document.getElementById('salesDetailModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

function showSalesMessage(message, success = false) {
    const element = document.getElementById('salesMessage');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}

async function openSalesCreate(sale = null) {
    const form = document.getElementById('formSalesCreate');
    if (form) form.reset();
    editingSaleNumber = sale?.no_penjualan || null;
    editingSaleStatus = sale?.status || null;
    document.getElementById('salesCreateTitle').textContent =
        editingSaleNumber ? 'Edit Penjualan' : 'Tambah Penjualan';
    document.getElementById('btnSaveSale').textContent =
        editingSaleNumber ? 'Simpan Perubahan' : 'Simpan Penjualan';
    document.getElementById('newSalesNumber').readOnly = Boolean(editingSaleNumber);
    document.getElementById('salesCreateMessage').classList.add('hidden');
    document.getElementById('salesCreateStatus').classList.add('hidden');
    const today = new Date();
    document.getElementById('newSalesDate').value = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
    document.getElementById('salesCreateItems').replaceChildren();
    document.getElementById('newSalesTotal').textContent = 'Rp 0';
    try {
        const [customerResponse, productResponse] = await Promise.all([
            fetch(`${API_URL}/pelanggan`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/barang`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const [customerResult, productResult] = await Promise.all([
            customerResponse.json(),
            productResponse.json()
        ]);
        if (!customerResponse.ok) throw new Error(customerResult.error || 'Gagal mengambil daftar pelanggan.');
        if (!productResponse.ok) throw new Error(productResult.error || 'Gagal mengambil daftar barang.');
        if (!Array.isArray(customerResult.data) || !Array.isArray(productResult.data)) {
            throw new Error('Format data pelanggan atau barang tidak valid.');
        }

        const customerSelect = document.getElementById('newSalesCustomer');
        customerSelect.replaceChildren(new Option('Tanpa pelanggan', ''));
        customerResult.data.forEach(customer => customerSelect.add(new Option(
            `${customer.nama_pelanggan} (${customer.kode_pelanggan})`,
            customer.kode_pelanggan
        )));
        globalBarang = productResult.data;
        if (!globalBarang.length) throw new Error('Tambahkan master barang terlebih dahulu sebelum membuat penjualan.');

        if (sale) {
            document.getElementById('newSalesNumber').value = sale.no_penjualan;
            document.getElementById('newSalesDate').value = String(sale.tanggal).slice(0, 10);
            document.getElementById('newSalesCustomer').value = sale.kode_pelanggan || '';
        }
        document.getElementById('salesCreateModal').classList.remove('hidden');
        document.getElementById('salesCreateModal').scrollTop = 0;
        document.getElementById('formSalesCreate').scrollTop = 0;
        const mainContent = document.getElementById('moduleContent').closest('main');
        mainContent.classList.remove('z-10');
        mainContent.classList.add('z-50');
        document.body.classList.add('overflow-hidden');
        if (sale) {
            for (const detail of sale.details) await addSalesItemRow(detail);
        } else {
            await addSalesItemRow();
        }
        updateSalesCreateState();
        document.getElementById('newSalesNumber').focus({ preventScroll: true });
    } catch (err) {
        console.error('Gagal membuka form penjualan:', err);
        showSalesMessage(err.message);
    }
}

function closeSalesCreate() {
    const modal = document.getElementById('salesCreateModal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    const mainContent = document.getElementById('moduleContent').closest('main');
    mainContent.classList.remove('z-50');
    mainContent.classList.add('z-10');
    document.body.classList.remove('overflow-hidden');
    const form = document.getElementById('formSalesCreate');
    if (form) form.reset();
    editingSaleNumber = null;
    editingSaleStatus = null;
    document.getElementById('newSalesNumber').readOnly = false;
    document.getElementById('btnSaveSale').classList.remove('hidden');
    document.getElementById('btnDeleteSaleCreate').classList.add('hidden');
    document.getElementById('btnToggleSaleCreateStatus').classList.add('hidden');
    document.getElementById('salesCreateStatus').classList.add('hidden');
}

async function addSalesItemRow(initialItem = null) {
    const tbody = document.getElementById('salesCreateItems');
    if (!tbody) return;
    const row = document.createElement('tr');
    row.className = 'sales-create-row';

    const productCell = document.createElement('td');
    productCell.className = 'p-2';
    const productSelect = document.createElement('select');
    productSelect.className = 'sales-product w-full min-w-48 rounded-lg border border-gray-300 px-2 py-2 text-sm';
    productSelect.required = true;
    productSelect.add(new Option('-- Pilih barang --', ''));
    globalBarang.forEach(product => productSelect.add(new Option(
        `${product.nama_barang} (${product.kode_barang})`,
        product.kode_barang
    )));
    productCell.appendChild(productSelect);

    const stockInCell = document.createElement('td');
    stockInCell.className = 'p-2';
    const stockInSelect = document.createElement('select');
    stockInSelect.className = 'sales-stockin w-full min-w-48 rounded-lg border border-gray-300 px-2 py-2 text-sm';
    stockInSelect.required = true;
    stockInSelect.add(new Option('-- Pilih nomor stok in --', ''));
    stockInCell.appendChild(stockInSelect);

    const stockCell = document.createElement('td');
    stockCell.className = 'sales-stock whitespace-nowrap p-2 text-sm text-gray-600';
    stockCell.textContent = '-';

    const qtyCell = document.createElement('td');
    qtyCell.className = 'p-2';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.step = '1';
    qtyInput.value = '1';
    qtyInput.required = true;
    qtyInput.className = 'sales-qty w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm';
    qtyCell.appendChild(qtyInput);

    const priceCell = document.createElement('td');
    priceCell.className = 'sales-price whitespace-nowrap p-2 text-sm';
    priceCell.textContent = '-';

    const subtotalCell = document.createElement('td');
    subtotalCell.className = 'sales-subtotal whitespace-nowrap p-2 text-sm font-medium';
    subtotalCell.textContent = 'Rp 0';

    const actionCell = document.createElement('td');
    actionCell.className = 'p-2';
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'sales-remove rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100';
    removeButton.textContent = 'Hapus';
    removeButton.addEventListener('click', () => {
        row.remove();
        updateSalesCreateTotal();
    });
    actionCell.appendChild(removeButton);

    productSelect.addEventListener('change', () => handleSalesProductChange(row));
    stockInSelect.addEventListener('change', () => {
        const option = stockInSelect.selectedOptions[0];
        qtyInput.max = option?.dataset.available || '';
        updateSalesCreateTotal();
    });
    qtyInput.addEventListener('input', updateSalesCreateTotal);
    row.append(productCell, stockInCell, stockCell, qtyCell, priceCell, subtotalCell, actionCell);
    tbody.appendChild(row);
    if (initialItem) {
        productSelect.value = initialItem.kode_barang;
        await handleSalesProductChange(row, initialItem.no_stok_in);
        qtyInput.value = initialItem.qty;
    }
    updateSalesCreateTotal();
}

async function handleSalesProductChange(row, selectedStockIn = '') {
    const code = row.querySelector('.sales-product').value;
    const message = document.getElementById('salesCreateMessage');
    message.classList.add('hidden');
    const stockSelect = row.querySelector('.sales-stockin');
    const stockCell = row.querySelector('.sales-stock');
    const priceCell = row.querySelector('.sales-price');
    const qtyInput = row.querySelector('.sales-qty');
    const product = globalBarang.find(item => item.kode_barang === code);
    stockCell.textContent = product ? `${product.stok ?? 0} ${product.satuan || ''}`.trim() : '-';
    priceCell.textContent = product
        ? `Rp ${Number(product.satuan_harga || 0).toLocaleString('id-ID')}`
        : '-';
    qtyInput.max = '';
    stockSelect.replaceChildren(new Option(
        product ? 'Memuat nomor stok in...' : '-- Pilih barang dahulu --',
        ''
    ));
    updateSalesCreateTotal();
    if (!product) return;

    try {
        const params = editingSaleNumber
            ? `?exclude_sale=${encodeURIComponent(editingSaleNumber)}`
            : '';
        const res = await fetch(
            `${API_URL}/stokin/available/${encodeURIComponent(code)}${params}`,
            { headers: { Authorization: 'Bearer ' + token } }
        );
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil pilihan nomor stok in.');
        if (!Array.isArray(result.data)) throw new Error('Format pilihan nomor stok in tidak valid.');
        if (row.querySelector('.sales-product').value !== code) return;

        stockSelect.replaceChildren(new Option(
            result.data.length ? '-- Pilih nomor stok in --' : 'Tidak ada stok masuk tersisa',
            ''
        ));
        result.data.forEach(batch => {
            const option = new Option(
                `${batch.no_stok_in} (${batch.tanggal}, tersedia ${batch.available})`,
                batch.no_stok_in
            );
            option.dataset.available = batch.available;
            stockSelect.add(option);
        });
        if (selectedStockIn) stockSelect.value = selectedStockIn;
        const selected = stockSelect.selectedOptions[0];
        qtyInput.max = selected?.dataset.available || '';
    } catch (err) {
        console.error('Gagal memuat batch stok untuk penjualan:', err);
        stockSelect.replaceChildren(new Option('-- Gagal memuat nomor stok in --', ''));
        document.getElementById('salesCreateMessage').textContent = err.message;
        document.getElementById('salesCreateMessage').classList.remove('hidden');
    }
}

function updateSalesCreateTotal() {
    let grandTotal = 0;
    document.querySelectorAll('.sales-create-row').forEach(row => {
        const product = globalBarang.find(item =>
            item.kode_barang === row.querySelector('.sales-product').value
        );
        const qty = Number(row.querySelector('.sales-qty').value) || 0;
        const subtotal = product ? qty * Number(product.satuan_harga || 0) : 0;
        grandTotal += subtotal;
        row.querySelector('.sales-subtotal').textContent =
            `Rp ${subtotal.toLocaleString('id-ID')}`;
    });
    const totalEl = document.getElementById('newSalesTotal');
    if (totalEl) {
        totalEl.textContent = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    }
}

async function saveSale(event) {
    event.preventDefault();
    const rows = Array.from(document.querySelectorAll('.sales-create-row'));
    const message = document.getElementById('salesCreateMessage');
    if (!rows.length) {
        message.textContent = 'Tambahkan minimal satu barang.';
        message.classList.remove('hidden');
        return;
    }

    const button = document.getElementById('btnSaveSale');
    button.disabled = true;
    message.classList.add('hidden');
    try {
        const payload = {
            no_penjualan: document.getElementById('newSalesNumber').value.trim(),
            tanggal: document.getElementById('newSalesDate').value,
            kode_pelanggan: document.getElementById('newSalesCustomer').value || null,
            items: rows.map(row => ({
                kode_barang: row.querySelector('.sales-product').value,
                no_stok_in: row.querySelector('.sales-stockin').value,
                qty: Number(row.querySelector('.sales-qty').value)
            }))
        };
        const res = await fetch(
            editingSaleNumber
                ? `${API_URL}/penjualan/${encodeURIComponent(editingSaleNumber)}`
                : `${API_URL}/penjualan`,
            {
            method: editingSaleNumber ? 'PUT' : 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menyimpan penjualan.');
        editingSaleNumber = result.data.no_penjualan;
        editingSaleStatus = 'Pending';
        updateSalesCreateState();
        await fetchSales();
        showSalesCreateMessage('');
    } catch (err) {
        console.error('Gagal menyimpan penjualan:', err);
        message.textContent = err.message;
        message.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
}

function updateSalesCreateState() {
    const isSaved = Boolean(editingSaleNumber);
    const isPending = editingSaleStatus === 'Pending';
    const isEditable = !isSaved || isPending;
    const saveButton = document.getElementById('btnSaveSale');
    const deleteButton = document.getElementById('btnDeleteSaleCreate');
    const statusButton = document.getElementById('btnToggleSaleCreateStatus');
    const statusMessage = document.getElementById('salesCreateStatus');
    const form = document.getElementById('formSalesCreate');

    document.getElementById('newSalesNumber').readOnly = isSaved;
    form.querySelectorAll('input, select').forEach(input => {
        if (input.id !== 'newSalesNumber') input.disabled = !isEditable;
    });
    document.getElementById('btnAddSalesItem').disabled = !isEditable;
    form.querySelectorAll('.sales-remove').forEach(button => {
        button.disabled = !isEditable;
    });
    saveButton.textContent = isSaved ? 'Simpan Perubahan' : 'Simpan Penjualan';
    saveButton.classList.toggle('hidden', isSaved && !isEditable);
    deleteButton.classList.toggle('hidden', !isSaved || !isPending);
    statusButton.textContent = isPending ? 'Konfirmasi Penjualan' : 'Pending';
    statusButton.className = isPending
        ? 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
        : 'rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50';
    statusButton.classList.toggle('hidden', !isSaved);
    statusMessage.textContent = !isSaved
        ? ''
        : isPending
            ? 'Status: Pending'
            : 'Status: Dikonfirmasi — stok sudah dikurangi.';
    statusMessage.className = `text-sm font-semibold ${isPending ? 'text-amber-700' : 'text-green-700'}`;
    statusMessage.classList.toggle('hidden', !isSaved);
    statusButton.onclick = () => setSaleCreateStatus(isPending ? 'Confirmed' : 'Pending');
    deleteButton.onclick = () => deleteSaleCreateDraft();
}

function showSalesCreateMessage(message, success = false) {
    const element = document.getElementById('salesCreateMessage');
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}

async function setSaleCreateStatus(status) {
    const action = status === 'Confirmed' ? 'mengonfirmasi' : 'mengembalikan ke Pending';
    if (!window.confirm(`Yakin ${action} penjualan ${editingSaleNumber}?`)) return;
    const statusButton = document.getElementById('btnToggleSaleCreateStatus');
    statusButton.disabled = true;
    try {
        const res = await fetch(`${API_URL}/penjualan/${encodeURIComponent(editingSaleNumber)}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengubah status penjualan.');
        editingSaleStatus = result.data.status;
        updateSalesCreateState();
        await fetchSales();
        showSalesCreateMessage(`Penjualan berhasil diubah menjadi ${status}.`, true);
    } catch (err) {
        console.error('Gagal mengubah status penjualan:', err);
        showSalesCreateMessage(err.message);
    } finally {
        statusButton.disabled = false;
    }
}

async function deleteSaleCreateDraft() {
    if (!window.confirm(`Hapus draft penjualan ${editingSaleNumber}?`)) return;
    try {
        const res = await fetch(`${API_URL}/penjualan/${encodeURIComponent(editingSaleNumber)}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + token }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menghapus draft penjualan.');
        const number = editingSaleNumber;
        closeSalesCreate();
        await fetchSales();
        showSalesMessage(`Draft penjualan ${number} berhasil dihapus.`, true);
    } catch (err) {
        console.error('Gagal menghapus draft penjualan:', err);
        showSalesCreateMessage(err.message);
    }
}
