window.isDashboardLoaderActive = true;

const dashboardModules = [
    'master-data.html',
    'sales.html',
    'stock-in.html',
    'inventory.html'
];

const dashboardScripts = [
    '/dashboard.js',
    '/modules/master-data.js',
    '/modules/sales.js',
    '/modules/stock-in.js',
    '/modules/inventory.js'
];

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Gagal memuat skrip: ' + src));
        document.body.appendChild(script);
    });
}

async function loadDashboard() {
    const container = document.getElementById('moduleContent');
    const errorMessage = document.getElementById('moduleLoadError');

    try {
        const responses = await Promise.all(dashboardModules.map(async filename => {
            const response = await fetch('/modules/' + filename);
            if (!response.ok) {
                throw new Error('Gagal memuat modul ' + filename + ' (' + response.status + ').');
            }
            return response.text();
        }));

        container.innerHTML = responses.join('\n');

        // Muat modul-modul skrip secara berurutan
        for (const scriptSrc of dashboardScripts) {
            await loadScript(scriptSrc);
        }

        // Jalankan inisialisasi dashboard setelah seluruh modul siap
        if (typeof initializeDashboard === 'function') {
            initializeDashboard();
        }
    } catch (error) {
        showModuleLoadError(error);
    }

    function showModuleLoadError(error) {
        console.error('Gagal menyiapkan dashboard:', error);
        container.classList.add('hidden');
        errorMessage.textContent = 'Dashboard gagal dimuat. Muat ulang halaman atau hubungi administrator.';
        errorMessage.classList.remove('hidden');
    }
}

loadDashboard();
