// ==========================================
// MODUL 1: MASTER DATA (User, Barang, Supplier, Pelanggan)
// ==========================================

let selectedMasterUserId = null;
let masterUserInitialValues = null;
let activeMasterCreateEntity = null;
const selectedMasterData = { barang: null, supplier: null, pelanggan: null };

const masterDataConfigs = {
    barang: {
        title: 'Barang',
        key: 'kode_barang',
        api: 'barang',
        fields: [
            { name: 'kode_barang', label: 'Kode Barang', required: true, maxLength: 50 },
            { name: 'nama_barang', label: 'Nama Barang', required: true, maxLength: 100 },
            { name: 'satuan', label: 'Satuan', required: true, maxLength: 20 },
            { name: 'satuan_harga', label: 'Harga Satuan', type: 'number', required: true, min: '0', step: '0.01' }
        ]
    },
    supplier: {
        title: 'Supplier',
        key: 'kode_supplier',
        api: 'supplier',
        fields: [
            { name: 'kode_supplier', label: 'Kode Supplier', required: true, maxLength: 50 },
            { name: 'nama_supplier', label: 'Nama Supplier', required: true, maxLength: 100 },
            { name: 'no_telp', label: 'No. Telepon', type: 'tel', maxLength: 20 },
            { name: 'alamat', label: 'Alamat', type: 'textarea', wide: true }
        ]
    },
    pelanggan: {
        title: 'Pelanggan',
        key: 'kode_pelanggan',
        api: 'pelanggan',
        fields: [
            { name: 'kode_pelanggan', label: 'Kode Pelanggan', required: true, maxLength: 50 },
            { name: 'nama_pelanggan', label: 'Nama Pelanggan', required: true, maxLength: 100 },
            { name: 'alamat', label: 'Alamat', type: 'textarea', wide: true }
        ]
    }
};

// ------------------------------------------
// MASTER USER
// ------------------------------------------

async function fetchMasterUser() {
    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil daftar user.');
        if (!Array.isArray(result.data)) throw new Error('Format data user tidak valid.');

        const tbody = document.getElementById('tblMasterUser');
        if (!tbody) return;
        tbody.replaceChildren();
        if (!result.data.length) {
            clearMasterUserDetail();
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="4" class="p-4 text-center text-gray-400">Belum ada user.</td>';
            tbody.appendChild(row);
            return;
        }

        result.data.forEach(masterUser => {
            const row = document.createElement('tr');
            row.className = 'cursor-pointer hover:bg-indigo-50';
            row.addEventListener('click', () => loadMasterUserDetail(masterUser.id));
            [masterUser.id, masterUser.username, masterUser.nama || '-', masterUser.role || '-'].forEach(value => {
                const cell = document.createElement('td');
                cell.className = 'p-3';
                cell.textContent = value;
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });
        if (selectedMasterUserId && !result.data.some(item => String(item.id) === String(selectedMasterUserId))) {
            clearMasterUserDetail();
        }
        showMasterUserMessage('');
    } catch (err) {
        console.error('Gagal load users:', err);
        showMasterUserMessage(err.message);
    }
}

async function loadMasterUserDetail(id) {
    try {
        closeCreateMasterUser();
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal mengambil detail user.');

        const masterUser = result.data;
        selectedMasterUserId = masterUser.id;
        document.getElementById('masterUserUsername').value = masterUser.username || '';
        document.getElementById('masterUserPhone').value = masterUser.no_telp || '';
        document.getElementById('masterUserRole').value = masterUser.role || 'staff';
        document.getElementById('masterUserRole').disabled = String(user.role || '').toLowerCase() !== 'admin';
        document.getElementById('masterUserPassword').value = '';
        masterUserInitialValues = {
            username: masterUser.username || '',
            no_telp: masterUser.no_telp || '',
            role: masterUser.role || 'staff'
        };
        document.getElementById('masterUserDetail').classList.remove('hidden');
        updateMasterUserSaveButton();
        showMasterUserMessage('');
    } catch (err) {
        console.error('Gagal load detail user:', err);
        showMasterUserMessage(err.message);
    }
}

function openCreateMasterUser() {
    clearMasterUserDetail();
    document.getElementById('masterUserCreate').classList.remove('hidden');
    document.getElementById('formCreateMasterUser').reset();
    document.getElementById('newMasterUserRole').value = 'staff';
    document.body.classList.add('overflow-hidden');
    document.getElementById('newMasterUserName').focus();
    showMasterUserMessage('');
}

function closeCreateMasterUser() {
    const modal = document.getElementById('masterUserCreate');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    const form = document.getElementById('formCreateMasterUser');
    if (form) form.reset();
    const btnAdd = document.getElementById('btnAddMasterUser');
    if (btnAdd) btnAdd.focus();
}

async function createMasterUser(event) {
    event.preventDefault();
    const button = document.getElementById('btnCreateMasterUser');
    button.disabled = true;

    try {
        const payload = {
            nama: document.getElementById('newMasterUserName').value.trim(),
            username: document.getElementById('newMasterUserUsername').value.trim(),
            role: document.getElementById('newMasterUserRole').value,
            no_telp: document.getElementById('newMasterUserPhone').value.trim() || null,
            password: document.getElementById('newMasterUserPassword').value
        };
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menambahkan user.');

        closeCreateMasterUser();
        document.getElementById('formCreateMasterUser').reset();
        await fetchMasterUser();
        showMasterUserMessage('User baru berhasil ditambahkan.', true);
    } catch (err) {
        console.error('Gagal menambahkan user:', err);
        showMasterUserMessage(err.message);
    } finally {
        button.disabled = false;
    }
}

function updateMasterUserSaveButton() {
    if (!masterUserInitialValues) return;
    const username = document.getElementById('masterUserUsername').value.trim();
    const no_telp = document.getElementById('masterUserPhone').value.trim();
    const password = document.getElementById('masterUserPassword').value;
    const role = document.getElementById('masterUserRole').value;
    const hasChanges = username !== masterUserInitialValues.username ||
        no_telp !== masterUserInitialValues.no_telp || password.length > 0 ||
        (String(user.role || '').toLowerCase() === 'admin' && role !== masterUserInitialValues.role);
    document.getElementById('btnSaveMasterUser').classList.toggle('hidden', !hasChanges);
}

async function saveMasterUser() {
    const button = document.getElementById('btnSaveMasterUser');
    button.disabled = true;
    try {
        const password = document.getElementById('masterUserPassword').value;
        const payload = {
            username: document.getElementById('masterUserUsername').value.trim(),
            no_telp: document.getElementById('masterUserPhone').value.trim() || null
        };
        if (password) payload.password = password;
        if (String(user.role || '').toLowerCase() === 'admin') {
            payload.role = document.getElementById('masterUserRole').value;
        }

        const res = await fetch(`${API_URL}/users/${encodeURIComponent(selectedMasterUserId)}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menyimpan perubahan user.');

        await fetchMasterUser();
        await loadMasterUserDetail(selectedMasterUserId);
        showMasterUserMessage('Perubahan user berhasil disimpan.', true);
    } catch (err) {
        console.error('Gagal menyimpan user:', err);
        showMasterUserMessage(err.message);
    } finally {
        button.disabled = false;
    }
}

async function deleteMasterUser() {
    if (!selectedMasterUserId || !window.confirm(translateAppText('Hapus user ini secara permanen?'))) return;

    try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(selectedMasterUserId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Gagal menghapus user.');

        clearMasterUserDetail();
        await fetchMasterUser();
        showMasterUserMessage('User berhasil dihapus.', true);
    } catch (err) {
        console.error('Gagal menghapus user:', err);
        showMasterUserMessage(err.message);
    }
}

function clearMasterUserDetail() {
    selectedMasterUserId = null;
    masterUserInitialValues = null;
    const detail = document.getElementById('masterUserDetail');
    if (detail) detail.classList.add('hidden');
    const pwd = document.getElementById('masterUserPassword');
    if (pwd) pwd.value = '';
    const btn = document.getElementById('btnSaveMasterUser');
    if (btn) btn.classList.add('hidden');
}

function showMasterUserMessage(message, success = false) {
    const element = document.getElementById('masterUserMessage');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}

// ------------------------------------------
// MASTER DATA (Barang, Supplier, Pelanggan)
// ------------------------------------------

async function fetchMasterBarang() {
    await fetchMasterData('barang');
}

async function fetchMasterSupplier() {
    await fetchMasterData('supplier');
}

async function fetchMasterPelanggan() {
    await fetchMasterData('pelanggan');
}

async function fetchMasterData(entity) {
    const config = masterDataConfigs[entity];
    const prefix = `master${config.title}`;
    try {
        const res = await fetch(`${API_URL}/${config.api}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Gagal mengambil data ${config.title.toLowerCase()}.`);
        if (!Array.isArray(result.data)) throw new Error(`Format data ${config.title.toLowerCase()} tidak valid.`);

        const records = result.data;
        const tbody = document.getElementById(`tblMaster${config.title}`);
        if (!tbody) return;
        tbody.replaceChildren();
        if (!records.length) {
            clearMasterDataDetail(entity);
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = entity === 'pelanggan' ? 3 : 4;
            cell.className = 'p-4 text-center text-gray-400';
            cell.textContent = `Belum ada data ${config.title.toLowerCase()}.`;
            row.appendChild(cell);
            tbody.appendChild(row);
        } else {
            records.forEach(record => {
                const row = document.createElement('tr');
                row.className = 'cursor-pointer hover:bg-indigo-50';
                row.addEventListener('click', () => loadMasterRecord(entity, record[config.key]));
                const values = entity === 'barang'
                    ? [record.kode_barang, record.nama_barang, record.satuan, `Rp ${Number(record.satuan_harga || 0).toLocaleString('id-ID')}`]
                    : entity === 'supplier'
                        ? [record.kode_supplier, record.nama_supplier, record.no_telp || '-', record.alamat || '-']
                        : [record.kode_pelanggan, record.nama_pelanggan, record.alamat || '-'];
                values.forEach((value, index) => {
                    const cell = document.createElement('td');
                    cell.className = index === 0 ? 'p-3 font-mono text-xs' : 'p-3';
                    cell.textContent = value ?? '-';
                    row.appendChild(cell);
                });
                tbody.appendChild(row);
            });
            const selected = selectedMasterData[entity];
            if (selected && !records.some(record => String(record[config.key]) === String(selected.id))) {
                clearMasterDataDetail(entity);
            }
        }

        if (entity === 'barang') {
            globalBarang = records;
            const selectBarang = document.getElementById('stokInBarangId');
            if (selectBarang) {
                selectBarang.replaceChildren(new Option('-- Pilih Barang --', ''));
                globalBarang.forEach(item => {
                    selectBarang.add(new Option(`${item.nama_barang} (${item.kode_barang})`, item.kode_barang));
                });
            }
        }
        showMasterDataMessage(entity, '');
    } catch (err) {
        console.error(`Gagal load ${config.title.toLowerCase()}:`, err);
        showMasterDataMessage(entity, err.message);
    }
}

function buildMasterDataFields(container, entity, values = {}, creating = false) {
    const config = masterDataConfigs[entity];
    container.replaceChildren();
    config.fields.forEach(field => {
        const label = document.createElement('label');
        label.className = `block text-sm font-medium text-gray-700${field.wide ? ' sm:col-span-2' : ''}`;
        label.append(document.createTextNode(field.label));
        const control = field.type === 'textarea'
            ? document.createElement('textarea')
            : document.createElement('input');
        if (control instanceof HTMLInputElement) {
            control.type = field.type || 'text';
            if (field.step) control.step = field.step;
            if (field.min != null) control.min = field.min;
            if (field.maxLength) control.maxLength = field.maxLength;
        } else {
            control.rows = 3;
        }
        control.id = `masterDataField-${entity}-${field.name}`;
        control.dataset.field = field.name;
        control.required = Boolean(creating && field.required);
        control.value = values[field.name] ?? '';
        control.readOnly = !creating && field.name === config.key;
        control.className = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500' +
            (control.readOnly ? ' bg-gray-100 text-gray-500' : '');
        if (!creating) {
            control.addEventListener('input', () => updateMasterDataSaveButton(entity));
        }
        label.appendChild(control);
        container.appendChild(label);
    });
}

async function loadMasterRecord(entity, id) {
    const config = masterDataConfigs[entity];
    const prefix = `master${config.title}`;
    try {
        const res = await fetch(`${API_URL}/${config.api}/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Gagal mengambil detail ${config.title.toLowerCase()}.`);
        const record = result.data;
        selectedMasterData[entity] = {
            id: record[config.key],
            initialValues: { ...record }
        };
        buildMasterDataFields(document.getElementById(`${prefix}Fields`), entity, record);
        document.getElementById(`${prefix}Detail`).classList.remove('hidden');
        updateMasterDataSaveButton(entity);
        showMasterDataMessage(entity, '');
    } catch (err) {
        console.error(`Gagal load detail ${config.title.toLowerCase()}:`, err);
        showMasterDataMessage(entity, err.message);
    }
}

function getMasterDataPayload(entity, creating) {
    const config = masterDataConfigs[entity];
    const payload = {};
    config.fields.forEach(field => {
        if (!creating && field.name === config.key) return;
        const control = document.getElementById(`masterDataField-${entity}-${field.name}`);
        payload[field.name] = field.type === 'number'
            ? (control.value === '' ? '' : Number(control.value))
            : control.value.trim();
    });
    return payload;
}

function updateMasterDataSaveButton(entity) {
    const selected = selectedMasterData[entity];
    if (!selected) return;
    const config = masterDataConfigs[entity];
    const fields = config.fields.filter(field => field.name !== config.key);
    const changed = fields.some(field => {
        const control = document.getElementById(`masterDataField-${entity}-${field.name}`);
        if (field.type === 'number') {
            return Number(control.value) !== Number(selected.initialValues[field.name]);
        }
        return control.value.trim() !== String(selected.initialValues[field.name] ?? '').trim();
    });
    document.getElementById(`btnSaveMaster${config.title}`).classList.toggle('hidden', !changed);
}

async function saveMasterRecord(entity) {
    const config = masterDataConfigs[entity];
    const selected = selectedMasterData[entity];
    if (!selected) return;
    const button = document.getElementById(`btnSaveMaster${config.title}`);
    button.disabled = true;
    try {
        const res = await fetch(`${API_URL}/${config.api}/${encodeURIComponent(selected.id)}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(getMasterDataPayload(entity, false))
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Gagal menyimpan ${config.title.toLowerCase()}.`);
        await fetchMasterData(entity);
        await loadMasterRecord(entity, selected.id);
        showMasterDataMessage(entity, `${config.title} berhasil disimpan.`, true);
    } catch (err) {
        console.error(`Gagal menyimpan ${config.title.toLowerCase()}:`, err);
        showMasterDataMessage(entity, err.message);
    } finally {
        button.disabled = false;
    }
}

async function deleteMasterRecord(entity) {
    const config = masterDataConfigs[entity];
    const selected = selectedMasterData[entity];
    if (!selected || !window.confirm(translateAppText(`Hapus ${config.title.toLowerCase()} ini secara permanen?`))) return;
    try {
        const res = await fetch(`${API_URL}/${config.api}/${encodeURIComponent(selected.id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Gagal menghapus ${config.title.toLowerCase()}.`);
        clearMasterDataDetail(entity);
        await fetchMasterData(entity);
        showMasterDataMessage(entity, `${config.title} berhasil dihapus.`, true);
    } catch (err) {
        console.error(`Gagal menghapus ${config.title.toLowerCase()}:`, err);
        showMasterDataMessage(entity, err.message);
    }
}

function clearMasterDataDetail(entity) {
    const config = masterDataConfigs[entity];
    selectedMasterData[entity] = null;
    const detail = document.getElementById(`master${config.title}Detail`);
    if (detail) detail.classList.add('hidden');
    const btn = document.getElementById(`btnSaveMaster${config.title}`);
    if (btn) btn.classList.add('hidden');
}

function showMasterDataMessage(entity, message, success = false) {
    const element = document.getElementById(`master${masterDataConfigs[entity].title}Message`);
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('hidden', !message);
    element.classList.toggle('text-green-700', success);
    element.classList.toggle('text-red-600', Boolean(message) && !success);
}

function openMasterCreate(entity) {
    closeCreateMasterUser();
    activeMasterCreateEntity = entity;
    const config = masterDataConfigs[entity];
    document.getElementById('masterDataCreateTitle').textContent = `Tambah ${config.title} Baru`;
    buildMasterDataFields(document.getElementById('masterDataCreateFields'), entity, {}, true);
    document.getElementById('masterDataCreateMessage').textContent = '';
    document.getElementById('masterDataCreateMessage').classList.add('hidden');
    document.getElementById('masterDataCreate').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    document.getElementById(`masterDataField-${entity}-${config.key}`).focus();
    showMasterDataMessage(entity, '');
}

function closeMasterCreate() {
    const modal = document.getElementById('masterDataCreate');
    if (!modal || modal.classList.contains('hidden')) return;
    const entity = activeMasterCreateEntity;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    const form = document.getElementById('formMasterDataCreate');
    if (form) form.reset();
    activeMasterCreateEntity = null;
    if (entity) {
        const btn = document.getElementById(`btnAddMaster${masterDataConfigs[entity].title}`);
        if (btn) btn.focus();
    }
}

async function createMasterRecord(event) {
    event.preventDefault();
    const entity = activeMasterCreateEntity;
    if (!entity) return;
    const config = masterDataConfigs[entity];
    const button = document.getElementById('btnCreateMasterRecord');
    button.disabled = true;
    try {
        const res = await fetch(`${API_URL}/${config.api}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(getMasterDataPayload(entity, true))
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || `Gagal menambahkan ${config.title.toLowerCase()}.`);
        closeMasterCreate();
        await fetchMasterData(entity);
        showMasterDataMessage(entity, `${config.title} berhasil ditambahkan.`, true);
    } catch (err) {
        console.error(`Gagal menambahkan ${config.title.toLowerCase()}:`, err);
        const message = document.getElementById('masterDataCreateMessage');
        message.textContent = err.message;
        message.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
}

// Event Listeners Master User Form
['masterUserUsername', 'masterUserPhone', 'masterUserPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateMasterUserSaveButton);
});
const roleSelect = document.getElementById('masterUserRole');
if (roleSelect) roleSelect.addEventListener('change', updateMasterUserSaveButton);
