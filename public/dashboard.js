// ==========================================
// CORE DASHBOARD & ROUTING CONTROLLER
// ==========================================

var API_URL = '/api';
var token = localStorage.getItem('token');
var user = JSON.parse(localStorage.getItem('user') || '{}');
var globalBarang = [];

// Helper Format Tanggal Bersama
function formatStockInDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '-');
    const locale = window.getAppLanguage?.() === 'en' ? 'en-US' : 'id-ID';
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
}

// Inisialisasi Dashboard Utama
function initializeDashboard() {
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    applyDashboardLanguage();
    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl) {
        userRoleEl.textContent = user.role || 'User';
    }

    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    const masterContainer = document.getElementById('masterContainer');
    if (masterContainer) masterContainer.classList.toggle('hidden', !isAdmin);

    if (!isAdmin) {
        const btnAddMasterUser = document.getElementById('btnAddMasterUser');
        if (btnAddMasterUser) btnAddMasterUser.classList.add('hidden');
    }

    initDropdownLogic();

    // Mendeteksi tab yang dipilih dari URL query parameter ?tab=
    const urlParams = new URLSearchParams(window.location.search);
    const currentTab = urlParams.get('tab');
    if (currentTab) switchTab(currentTab);
}

function applyDashboardLanguage() {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        const greeting = window.getAppLanguage?.() === 'en' ? 'Hi' : 'Selamat Datang';
        userNameEl.textContent = `${greeting}, ${user.nama || user.username || 'User'}`;
    }
    document.querySelectorAll('[data-date-value]').forEach(element => {
        element.textContent = formatStockInDate(element.dataset.dateValue);
    });
    const tab = new URLSearchParams(window.location.search).get('tab');
    const englishTitles = {
        pos: 'Sales - nandoApp',
        stokin: 'Stock In - nandoApp',
        inventory: 'Inventory - nandoApp',
        'master-user': 'Users - nandoApp',
        'master-barang': 'Products - nandoApp',
        'master-supplier': 'Suppliers - nandoApp',
        'master-pelanggan': 'Customers - nandoApp'
    };
    const indonesianTitles = {
        pos: 'Penjualan - nandoApp',
        stokin: 'Stok In - nandoApp',
        inventory: 'Inventory - nandoApp',
        'master-user': 'Master User - nandoApp',
        'master-barang': 'Master Barang - nandoApp',
        'master-supplier': 'Master Supplier - nandoApp',
        'master-pelanggan': 'Master Pelanggan - nandoApp'
    };
    const titles = window.getAppLanguage?.() === 'en' ? englishTitles : indonesianTitles;
    if (tab && titles[tab]) document.title = titles[tab];
}

window.applyDashboardLanguage = applyDashboardLanguage;

// Event listener Logout
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        const language = localStorage.getItem('app-language');
        localStorage.clear();
        if (language) localStorage.setItem('app-language', language);
        window.location.href = '/login.html';
    });
}

// Menangani aksi klik & toggle dropdown secara presisi
function initDropdownLogic() {
    const masterBtn = document.getElementById('tab-master');
    const dropdownMenu = document.getElementById('masterDropdownMenu');

    if (masterBtn && dropdownMenu) {
        masterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        // Tutup dropdown menu saat salah satu link diklik
        dropdownMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                dropdownMenu.classList.remove('show');
            });
        });
    }

    window.addEventListener('click', (e) => {
        const container = document.getElementById('masterContainer');
        if (container && !container.contains(e.target)) {
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        }
    });
}

// Pindah sub-modul master ke tab baru
function selectSubMaster(subName) {
    window.open(`dashboard.html?tab=master-${subName}`, '_blank');
}

// Aktifkan modul dan atur tampilan tab
function switchTab(modulName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active-tab');
        el.classList.add('inactive-tab');
    });

    let targetId = modulName;
    if (['user', 'barang', 'supplier', 'pelanggan'].includes(modulName)) {
        targetId = `master-${modulName}`;
    }
    if (targetId.startsWith('master-') && String(user.role || '').toLowerCase() !== 'admin') {
        targetId = 'pos';
        modulName = 'pos';
    }

    const targetSection = document.getElementById(`modul-${targetId}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // Update title tab browser agar mudah dikenali saat multitasking
    const tabTitles = window.getAppLanguage?.() === 'en' ? {
        'pos': 'Sales - nandoApp',
        'stokin': 'Stock In - nandoApp',
        'inventory': 'Inventory - nandoApp',
        'master-user': 'Users - nandoApp',
        'master-barang': 'Products - nandoApp',
        'master-supplier': 'Suppliers - nandoApp',
        'master-pelanggan': 'Customers - nandoApp'
    } : {
        'pos': 'Penjualan - nandoApp',
        'stokin': 'Stok In - nandoApp',
        'inventory': 'Inventory - nandoApp',
        'master-user': 'Master User - nandoApp',
        'master-barang': 'Master Barang - nandoApp',
        'master-supplier': 'Master Supplier - nandoApp',
        'master-pelanggan': 'Master Pelanggan - nandoApp'
    };
    if (tabTitles[targetId]) {
        document.title = tabTitles[targetId];
    }

    // Berikan highlight pada menu dropdown master jika sub-modul master aktif
    document.querySelectorAll('#masterDropdownMenu a').forEach(a => {
        if (a.getAttribute('href') && a.getAttribute('href').includes(targetId)) {
            a.classList.add('bg-indigo-50', 'text-indigo-600', 'font-semibold');
        } else {
            a.classList.remove('bg-indigo-50', 'text-indigo-600', 'font-semibold');
        }
    });

    if (targetId.startsWith('master-')) {
        const tabMaster = document.getElementById('tab-master');
        if (tabMaster) {
            tabMaster.classList.remove('inactive-tab');
            tabMaster.classList.add('active-tab');
        }

        if (targetId === 'master-user' && typeof fetchMasterUser === 'function') fetchMasterUser();
        if (targetId === 'master-barang' && typeof fetchMasterBarang === 'function') fetchMasterBarang();
        if (targetId === 'master-supplier' && typeof fetchMasterSupplier === 'function') fetchMasterSupplier();
        if (targetId === 'master-pelanggan' && typeof fetchMasterPelanggan === 'function') fetchMasterPelanggan();
    } else {
        const activeBtn = document.getElementById(`tab-${modulName}`);
        if (activeBtn) {
            activeBtn.classList.remove('inactive-tab');
            activeBtn.classList.add('active-tab');
        }

        if (targetId === 'pos' && typeof fetchSales === 'function') fetchSales();
        if (targetId === 'stokin' && typeof fetchStockIn === 'function') fetchStockIn();
        if (targetId === 'inventory' && typeof fetchInventory === 'function') fetchInventory();
    }
}

// Global Keydown Handler (Tombol Escape untuk Tutup Modal Aktif)
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    const createModal = document.getElementById('masterUserCreate');
    if (createModal && !createModal.classList.contains('hidden') && typeof closeCreateMasterUser === 'function') {
        closeCreateMasterUser();
    }
    const masterModal = document.getElementById('masterDataCreate');
    if (masterModal && !masterModal.classList.contains('hidden') && typeof closeMasterCreate === 'function') {
        closeMasterCreate();
    }
    const stockInModal = document.getElementById('stockInDetailModal');
    if (stockInModal && !stockInModal.classList.contains('hidden') && typeof closeStockInDetail === 'function') {
        closeStockInDetail();
    }
    const stockInCreateModal = document.getElementById('stockInCreateModal');
    if (stockInCreateModal && !stockInCreateModal.classList.contains('hidden') && typeof closeStockInCreate === 'function') {
        closeStockInCreate();
    }
    const salesDetailModal = document.getElementById('salesDetailModal');
    if (salesDetailModal && !salesDetailModal.classList.contains('hidden') && typeof closeSalesDetail === 'function') {
        closeSalesDetail();
    }
    const salesCreateModal = document.getElementById('salesCreateModal');
    if (salesCreateModal && !salesCreateModal.classList.contains('hidden') && typeof closeSalesCreate === 'function') {
        closeSalesCreate();
    }
});

// Fallback jika dimuat tanpa dashboard-loader.js
if (!window.isDashboardLoaderActive) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeDashboard, { once: true });
    } else {
        initializeDashboard();
    }
}
