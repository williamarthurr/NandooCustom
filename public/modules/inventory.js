// ==========================================
// MODUL 4: INVENTORY & LAPORAN STOK
// ==========================================

let inventoryBarangOptions = null;

async function handleInventoryFilterChange() {
    const filter = document.getElementById('inventoryFilter').value;
    const input = document.getElementById('inventorySearchValue');
    const select = document.getElementById('inventoryBarangSelect');
    const isBarangFilter = filter === 'nama_barang';
    const isAllFilter = filter === 'semua';
    document.getElementById('inventorySearchField').classList.toggle('hidden', isAllFilter);
    document.getElementById('btnInventorySearch').textContent =
        isAllFilter ? 'Tampilkan Semua Stok' : 'Cari Stok';

    input.classList.toggle('hidden', isBarangFilter || isAllFilter);
    input.required = !isBarangFilter && !isAllFilter;
    select.classList.toggle('hidden', !isBarangFilter);
    select.required = isBarangFilter;
    input.value = '';
    select.value = '';
    showInventoryMessage('');

    if (!isBarangFilter || inventoryBarangOptions) return;

    select.replaceChildren(new Option('Memuat daftar barang...', ''));
    try {
        const res = await fetch(`${API_URL}/barang`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal memuat daftar barang.');
        if (!Array.isArray(result.data)) throw new Error('Format daftar barang tidak valid.');

        inventoryBarangOptions = result.data;
        select.replaceChildren(new Option('-- Pilih nama barang --', ''));
        const names = new Map();
        inventoryBarangOptions.forEach(item => {
            if (item.nama_barang && !names.has(item.nama_barang)) {
                names.set(item.nama_barang, item.kode_barang);
            }
        });
        names.forEach((code, name) => {
            select.add(new Option(`${name} (${code})`, name));
        });
        if (!names.size) select.replaceChildren(new Option('Belum ada data barang', ''));
    } catch (err) {
        console.error('Gagal memuat pilihan nama barang:', err);
        inventoryBarangOptions = null;
        select.replaceChildren(new Option('-- Gagal memuat, pilih ulang kriteria --', ''));
        showInventoryMessage(err.message);
    }
}

async function fetchInventory(event) {
    if (event) event.preventDefault();
    const filter = document.getElementById('inventoryFilter').value;
    const isAllFilter = filter === 'semua';
    const value = isAllFilter ? '' : (filter === 'nama_barang'
        ? document.getElementById('inventoryBarangSelect').value
        : document.getElementById('inventorySearchValue').value).trim();
    const tbody = document.getElementById('tblInventory');
    if (!tbody) return;

    if (!filter || (!isAllFilter && !value)) {
        if (!filter) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'p-4 text-center text-gray-400';
            cell.textContent = 'Pilih kriteria dan masukkan kata kunci untuk mencari stok.';
            tbody.replaceChildren(row);
            row.appendChild(cell);
            showInventoryMessage('');
            return;
        }
        showInventoryMessage('Pilih kriteria dan masukkan kata kunci pencarian.');
        return;
    }

    const button = document.getElementById('btnInventorySearch');
    if (button) button.disabled = true;
    try {
        const params = new URLSearchParams({ filter });
        if (value) params.set('value', value);
        const res = await fetch(`${API_URL}/inventory?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mencari stok inventory.');
        if (!Array.isArray(result.data)) throw new Error('Format data inventory tidak valid.');

        tbody.replaceChildren();
        if (!result.data.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'p-4 text-center text-gray-400';
            cell.textContent = 'Tidak ditemukan barang untuk kriteria tersebut.';
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            result.data.forEach(item => {
                const row = document.createElement('tr');
                const stock = Number(item.stok) || 0;
                [
                    item.no_stok_in || '-',
                    item.kode_barang,
                    item.nama_barang,
                    stock,
                    stock < 5 ? 'Stok Kritis' : 'Aman'
                ].forEach((val, index) => {
                    const cell = document.createElement('td');
                    cell.className = index === 2 ? 'p-3 font-medium' : 'p-3';
                    cell.textContent = val ?? '-';
                    if (index === 3) cell.classList.add('font-bold');
                    if (index === 4) {
                        const badge = document.createElement('span');
                        badge.className = `rounded px-2 py-0.5 text-xs font-semibold ${stock < 5 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`;
                        badge.textContent = val;
                        cell.replaceChildren(badge);
                    }
                    row.appendChild(cell);
                });
                tbody.appendChild(row);
            });
        }
        if (Array.isArray(result.unallocated) && result.unallocated.length) {
            const products = result.unallocated
                .map(item => `${item.nama_barang} (${item.jumlah_penjualan} transaksi)`)
                .join(', ');
            showInventoryMessage(
                `Perhatian: penjualan lama belum dialokasikan ke nomor Stok In: ${products}. Edit transaksi tersebut agar sisa stok per batch akurat.`
            );
        } else {
            showInventoryMessage(`${result.data.length} baris stok ditemukan.`, true);
        }
    } catch (err) {
        console.error('Gagal mencari inventory:', err);
        showInventoryMessage(err.message);
    } finally {
        if (button) button.disabled = false;
    }
}

function showInventoryMessage(message, success = false) {
    const element = document.getElementById('inventoryMessage');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}

async function fetchInventoryLegacy() {
    try {
        const res = await fetch(`${API_URL}/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        const result = await res.json();
        const items = result.data || result || [];
        const tbody = document.getElementById('tblInventory');
        if (!tbody) return;
        tbody.innerHTML = items.map(i => `
            <tr class="hover:bg-gray-50">
                <td class="p-3">${i.id}</td>
                <td class="p-3 font-medium">${i.nama_barang || i.nama}</td>
                <td class="p-3 font-bold">${i.stok ?? 0}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-xs font-semibold ${(i.stok ?? 0) < 5 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">
                        ${(i.stok ?? 0) < 5 ? 'Stok Kritis' : 'Aman'}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Gagal load inventory:", err);
    }
}
