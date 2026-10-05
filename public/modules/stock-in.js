// ==========================================
// MODUL 3: STOK MASUK (Stock In)
// ==========================================

let editingStockInNumber = null;

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
            cell.colSpan = 2;
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
                dateCell.textContent = formatStockInDate(item.tanggal);
                row.append(numberCell, dateCell);
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
    document.getElementById('stockInCreateTitle').textContent =
        editingStockInNumber ? 'Edit Stok In' : 'Tambah Stok In';
    document.getElementById('btnSaveStockIn').textContent =
        editingStockInNumber ? 'Simpan Perubahan' : 'Simpan Stok In';
    document.getElementById('newStockInNumber').readOnly = Boolean(editingStockInNumber);
    document.getElementById('stockInCreateMessage').classList.add('hidden');
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
        document.body.classList.add('overflow-hidden');
        if (!stockIn) addStockInItemRow();
        document.getElementById('newStockInNumber').focus();
    } catch (err) {
        console.error('Gagal membuka form stok in:', err);
        showStockInMessage(err.message);
    }
}

function closeStockInCreate() {
    const modal = document.getElementById('stockInCreateModal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    const form = document.getElementById('formStockInCreate');
    if (form) form.reset();
    editingStockInNumber = null;
    document.getElementById('newStockInNumber').readOnly = false;
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
    removeButton.className = 'rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100';
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
        const wasEditing = Boolean(editingStockInNumber);
        closeStockInCreate();
        await fetchStockIn();
        showStockInMessage(
            wasEditing ? 'Transaksi stok in berhasil diperbarui.' : 'Transaksi stok in berhasil ditambahkan.',
            true
        );
    } catch (err) {
        console.error('Gagal menyimpan stok in:', err);
        message.textContent = err.message;
        message.classList.remove('hidden');
    } finally {
        button.disabled = false;
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
        document.getElementById('stockInDetailTitle').textContent = `Detail Stok In`;
        document.getElementById('stockInDetailSubtitle').textContent = formatStockInDate(stockIn.tanggal);
        document.getElementById('stockInDetailNumber').textContent = stockIn.no_stok_in;
        document.getElementById('stockInDetailSupplier').textContent =
            stockIn.nama_supplier || stockIn.kode_supplier || '-';
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
        const actions = document.getElementById('stockInDetailActions');
        actions.classList.toggle('hidden', !canEdit);
        const lockMessage = document.getElementById('stockInDetailLockMessage');
        lockMessage.textContent = canEdit
            ? ''
            : 'Stok in ini tidak dapat diedit atau dihapus karena sudah terkait dengan penjualan.';
        lockMessage.classList.toggle('hidden', canEdit);
        document.getElementById('btnEditStockIn').onclick = () => editStockIn(noStokIn);
        document.getElementById('btnDeleteStockIn').onclick = () => deleteStockIn(noStokIn);
        document.getElementById('stockInDetailModal').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        showStockInMessage('');
    } catch (err) {
        console.error('Gagal load detail stok in:', err);
        showStockInMessage(err.message);
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
    if (!window.confirm(`Hapus stok in ${noStokIn}? Stok barang akan dikurangi.`)) return;
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
    document.body.classList.remove('overflow-hidden');
}

function showStockInMessage(message, success = false) {
    const element = document.getElementById('stockInMessage');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}
