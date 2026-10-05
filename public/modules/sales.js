// ==========================================
// MODUL 2: PENJUALAN (Sales)
// ==========================================

let editingSaleNumber = null;
let editingSaleStatus = null;
let currentSalesReport = null;
let salesReportZoom = 1;
let salesReportMainZIndex = '';

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
                dateCell.dataset.dateValue = sale.tanggal;
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
        currentSalesReport = sale;
        const detailMessage = document.getElementById('salesDetailMessage');
        detailMessage.textContent = '';
        detailMessage.classList.add('hidden');
        const subtitle = document.getElementById('salesDetailSubtitle');
        subtitle.dataset.dateValue = sale.tanggal;
        subtitle.textContent = formatStockInDate(sale.tanggal);
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

function openSalesReport() {
    if (!currentSalesReport) {
        showSalesMessage('Data laporan penjualan tidak tersedia.');
        return;
    }

    const modal = document.getElementById('salesReportModal');
    const main = modal.closest('main');
    if (main) {
        salesReportMainZIndex = main.style.zIndex;
        main.style.zIndex = '1000';
    }
    document.getElementById('salesReportFrame').srcdoc = buildSalesReportPreview(currentSalesReport);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    salesReportZoom = 1;
}

function closeSalesReport() {
    const modal = document.getElementById('salesReportModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    const main = modal.closest('main');
    if (main) main.style.zIndex = salesReportMainZIndex;
    if (document.getElementById('salesDetailModal').classList.contains('hidden')) {
        document.body.classList.remove('overflow-hidden');
    }
}

function printSalesReport() {
    const frame = document.getElementById('salesReportFrame');
    if (!frame.contentWindow) {
        showSalesMessage('Preview laporan belum siap dicetak.');
        return;
    }
    frame.contentWindow.focus();
    frame.contentWindow.print();
}

function zoomSalesReport(change) {
    salesReportZoom = Math.min(1.5, Math.max(0.6, salesReportZoom + change));
    applySalesReportZoom();
}

function resetSalesReportZoom() {
    salesReportZoom = 1;
    applySalesReportZoom();
}

function applySalesReportZoom() {
    const frame = document.getElementById('salesReportFrame');
    const report = frame.contentDocument?.body;
    if (report) report.style.zoom = String(salesReportZoom);
}

function emailSalesReport() {
    if (!currentSalesReport) {
        showSalesMessage('Data laporan penjualan tidak tersedia.');
        return;
    }

    const sale = currentSalesReport;
    const items = (Array.isArray(sale.details) ? sale.details : []).map(detail =>
        `- ${detail.kode_barang} | ${detail.nama_barang || '-'} | ${detail.qty} ${detail.satuan || ''} | Rp ${Number(detail.subtotal || 0).toLocaleString('id-ID')}`
    );
    const body = [
        `Laporan Penjualan ${sale.no_penjualan}`,
        `Tanggal: ${formatStockInDate(sale.tanggal)}`,
        `Pelanggan: ${sale.nama_pelanggan || sale.kode_pelanggan || '-'}`,
        `Status: ${sale.status}`,
        '',
        'Rincian barang:',
        ...items,
        '',
        `Grand Total: Rp ${Number(sale.grand_total || 0).toLocaleString('id-ID')}`,
        '',
        'Barang yang diterima sudah sesuai dengan nota.',
        '',
        'Penerima: ____________________'
    ].join('\n');
    const subject = `Laporan Penjualan ${sale.no_penjualan}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function downloadSalesReportXls() {
    if (!currentSalesReport) {
        showSalesMessage('Data laporan penjualan tidak tersedia.');
        return;
    }

    const sale = currentSalesReport;
    const rows = [
        salesSpreadsheetRow([translateAppText('Laporan Penjualan').toUpperCase()], 'Title'),
        salesSpreadsheetRow([
            translateAppText('No. Penjualan'),
            sale.no_penjualan,
            translateAppText('Tanggal'),
            formatStockInDate(sale.tanggal)
        ]),
        salesSpreadsheetRow([
            translateAppText('Pelanggan'),
            sale.nama_pelanggan || sale.kode_pelanggan || '-',
            translateAppText('Status'),
            translateAppText(sale.status === 'Pending' ? 'Pending' : 'Dikonfirmasi')
        ]),
        salesSpreadsheetRow(['']),
        salesSpreadsheetRow([
            translateAppText('Kode Barang'),
            translateAppText('Nama Barang'),
            translateAppText('No. Stok In'),
            translateAppText('Qty'),
            translateAppText('Harga Satuan'),
            translateAppText('Subtotal')
        ], 'Header')
    ];

    (Array.isArray(sale.details) ? sale.details : []).forEach(detail => {
        rows.push(salesSpreadsheetRow([
            detail.kode_barang,
            detail.nama_barang || '-',
            detail.no_stok_in || 'Belum ditentukan',
            Number(detail.qty || 0),
            Number(detail.satuan_harga || 0),
            Number(detail.subtotal || 0)
        ], 'Detail'));
    });
    rows.push(salesSpreadsheetRow([
        '', '', '', '', translateAppText('Grand Total'), Number(sale.grand_total || 0)
    ], 'Total'));
    rows.push(salesSpreadsheetRow([translateAppText('Barang yang diterima sudah sesuai dengan nota.')]));
    rows.push(salesSpreadsheetRow([
        translateAppText('Penerima'),
        '',
        '',
        '',
        '',
        sale.nama_pelanggan || ''
    ]));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Styles>
        <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16"/></Style>
        <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#4338CA" ss:Pattern="Solid"/></Style>
        <Style ss:ID="Number"><NumberFormat ss:Format="#,##0"/></Style>
        <Style ss:ID="Currency"><NumberFormat ss:Format="&quot;Rp&quot; #,##0"/></Style>
        <Style ss:ID="Total"><Font ss:Bold="1"/><NumberFormat ss:Format="&quot;Rp&quot; #,##0"/></Style>
    </Styles>
    <Worksheet ss:Name="Penjualan"><Table>${rows.join('')}</Table></Worksheet>
</Workbook>`;
    const blob = new Blob([`\uFEFF${xml}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeNumber = String(sale.no_penjualan || 'penjualan')
        .replace(/[<>:"/\\|?*]+/g, '_')
        .replace(/^\.+|\.+$/g, '') || 'penjualan';
    link.href = url;
    link.download = `Laporan-Penjualan-${safeNumber}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildSalesReportPreview(sale) {
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
    const details = Array.isArray(sale.details) ? sale.details : [];
    const rows = details.map(detail => `
        <tr>
            <td>${escapeHtml(detail.kode_barang)}</td>
            <td>${escapeHtml(detail.nama_barang || '-')}</td>
            <td>${escapeHtml(detail.no_stok_in || 'Belum ditentukan')}</td>
            <td>${escapeHtml(`${detail.qty} ${detail.satuan || ''}`.trim())}</td>
            <td class="number">Rp ${Number(detail.satuan_harga || 0).toLocaleString('id-ID')}</td>
            <td class="number">Rp ${Number(detail.subtotal || 0).toLocaleString('id-ID')}</td>
        </tr>`).join('');
    const status = sale.status === 'Pending' ? 'Pending' : 'Dikonfirmasi';

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laporan Penjualan ${escapeHtml(sale.no_penjualan)}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; padding: 8px; background: #303030; color: #1f2937; font: 14px Arial, sans-serif; }
        article { display: flex; width: min(100%, 210mm); min-height: 297mm; flex-direction: column; margin: 0 auto 8px; padding: 24mm; background: #fff; box-shadow: 0 2px 5px #0005; }
        h1 { margin: 0 0 6px; font-size: 24px; }
        .subtitle { margin: 0 0 28px; color: #6b7280; }
        .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 24px; }
        .label { display: block; margin-bottom: 5px; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .value { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        th { background: #f9fafb; color: #4b5563; font-size: 10px; text-transform: uppercase; }
        .number { text-align: right; white-space: nowrap; }
        tfoot td { border-top: 2px solid #d1d5db; border-bottom: 0; font-weight: 700; }
        .receipt-confirmation { margin-top: 12px; break-inside: avoid; }
        .receipt-note { margin: 0 0 12px; font-size: 14px; line-height: 1.4; }
        .signature { width: 42%; margin-left: auto; text-align: center; }
        .signature-space { height: 18mm; }
        .signature-name { min-height: 24px; border-bottom: 1px solid #374151; }
        .signature-label { margin-top: 7px; }
        @media (max-width: 640px) { body { padding: 8px 0; } article { width: 100%; min-height: 100vh; padding: 24px 16px; } .meta { grid-template-columns: 1fr; gap: 12px; } .signature { width: 65%; } }
        @media print {
            @page { size: A4; margin: 16mm; }
            body { min-height: 0; padding: 0; background: #fff; }
            article { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; }
            .receipt-confirmation { break-inside: avoid; margin-top: 10px; }
        }
    </style>
</head>
<body>
    <article>
        <h1>${escapeHtml(translateAppText('Laporan Penjualan'))}</h1>
        <p class="subtitle">${escapeHtml(translateAppText('Rincian transaksi penjualan'))}</p>
        <section class="meta">
            <div><span class="label">${escapeHtml(translateAppText('No. Penjualan'))}</span><span class="value">${escapeHtml(sale.no_penjualan)}</span></div>
            <div><span class="label">${escapeHtml(translateAppText('Tanggal'))}</span><span class="value">${escapeHtml(formatStockInDate(sale.tanggal))}</span></div>
            <div><span class="label">${escapeHtml(translateAppText('Pelanggan'))}</span><span class="value">${escapeHtml(sale.nama_pelanggan || sale.kode_pelanggan || '-')}</span></div>
            <div><span class="label">${escapeHtml(translateAppText('Status'))}</span><span class="value">${escapeHtml(translateAppText(status))}</span></div>
        </section>
        <table>
            <thead><tr><th>${escapeHtml(translateAppText('Kode Barang'))}</th><th>${escapeHtml(translateAppText('Nama Barang'))}</th><th>${escapeHtml(translateAppText('No. Stok In'))}</th><th>${escapeHtml(translateAppText('Qty'))}</th><th class="number">${escapeHtml(translateAppText('Harga Satuan'))}</th><th class="number">${escapeHtml(translateAppText('Subtotal'))}</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6">${escapeHtml(translateAppText('Tidak ada rincian barang.'))}</td></tr>`}</tbody>
            <tfoot><tr><td colspan="5" class="number">${escapeHtml(translateAppText('Grand Total'))}</td><td class="number">Rp ${Number(sale.grand_total || 0).toLocaleString('id-ID')}</td></tr></tfoot>
        </table>
        <section class="receipt-confirmation">
            <p class="receipt-note">${escapeHtml(translateAppText('Barang yang diterima sudah sesuai dengan nota.'))}</p>
            <div class="signature">
                <div>${escapeHtml(translateAppText('Penerima'))}</div>
                <div class="signature-space"></div>
                <div class="signature-name"></div>
                <div class="signature-label">${escapeHtml(sale.nama_pelanggan || '')}</div>
            </div>
        </section>
    </article>
</body>
</html>`;
}

function salesSpreadsheetRow(values, style = '') {
    return `<Row>${values.map((value, index) => {
        const isNumeric = typeof value === 'number' && Number.isFinite(value);
        const type = isNumeric ? 'Number' : 'String';
        const styleId = style === 'Header'
            ? ' ss:StyleID="Header"'
            : style === 'Title'
                ? ' ss:StyleID="Title"'
                : style === 'Total' && index === 5
                    ? ' ss:StyleID="Total"'
                    : style === 'Detail' && (index === 4 || index === 5)
                        ? ' ss:StyleID="Currency"'
                        : style === 'Detail' && index === 3
                            ? ' ss:StyleID="Number"'
                            : '';
        return `<Cell${styleId}><Data ss:Type="${type}">${escapeSalesSpreadsheetValue(value)}</Data></Cell>`;
    }).join('')}</Row>`;
}

function escapeSalesSpreadsheetValue(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async function setSaleStatus(noPenjualan, status) {
    const action = status === 'Confirmed' ? 'mengonfirmasi' : 'mengembalikan ke Pending';
    if (!window.confirm(translateAppText(`Yakin ${action} penjualan ${noPenjualan}?`))) return;
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
    if (!window.confirm(translateAppText(`Hapus penjualan ${noPenjualan}?`))) return;
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
    closeSalesReport();
    currentSalesReport = null;
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
    if (!window.confirm(translateAppText(`Yakin ${action} penjualan ${editingSaleNumber}?`))) return;
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
    if (!window.confirm(translateAppText(`Hapus draft penjualan ${editingSaleNumber}?`))) return;
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
