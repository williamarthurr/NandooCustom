const Sales = require('../models/Sales');

function validateSalePayload(body) {
    const { tanggal, kode_pelanggan, items } = body || {};
    if (typeof tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return { error: 'Tanggal penjualan tidak valid.' };
    }
    const [year, month, day] = tanggal.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day) {
        return { error: 'Tanggal penjualan tidak valid.' };
    }
    if (kode_pelanggan != null &&
        (typeof kode_pelanggan !== 'string' || kode_pelanggan.length > 50)) {
        return { error: 'Pelanggan tidak valid.' };
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
        return { error: 'Tambahkan minimal satu barang (maksimal 100 baris).' };
    }

    const cleanItems = [];
    for (const item of items) {
        if (!item || typeof item.kode_barang !== 'string' || !item.kode_barang.trim() ||
            item.kode_barang.trim().length > 50) {
            return { error: 'Kode barang tidak valid.' };
        }
        if (typeof item.no_stok_in !== 'string' || !item.no_stok_in.trim() ||
            item.no_stok_in.trim().length > 50) {
            return { error: 'Pilih nomor stok in untuk setiap barang.' };
        }
        const qty = Number(item.qty);
        if (!Number.isSafeInteger(qty) || qty < 1) {
            return { error: 'Qty barang harus bilangan bulat minimal 1.' };
        }
        cleanItems.push({
            kode_barang: item.kode_barang.trim(),
            no_stok_in: item.no_stok_in.trim(),
            qty
        });
    }
    return {
        tanggal,
        kode_pelanggan: kode_pelanggan?.trim() || null,
        items: cleanItems
    };
}

exports.getAllPenjualan = async (req, res) => {
    try {
        res.json({ status: 'Success', data: await Sales.getAll() });
    } catch (err) {
        console.error('Gagal mengambil daftar penjualan:', err);
        res.status(500).json({ error: 'Gagal mengambil daftar penjualan.' });
    }
};

exports.getPenjualanById = async (req, res) => {
    if (!req.params.noPenjualan.trim()) {
        return res.status(400).json({ error: 'Nomor penjualan tidak valid.' });
    }
    try {
        const sale = await Sales.findById(req.params.noPenjualan);
        if (!sale) return res.status(404).json({ error: 'Penjualan tidak ditemukan.' });
        res.json({ status: 'Success', data: sale });
    } catch (err) {
        console.error('Gagal mengambil detail penjualan:', err);
        res.status(500).json({ error: 'Gagal mengambil detail penjualan.' });
    }
};

exports.createPenjualan = async (req, res) => {
    const { no_penjualan } = req.body || {};
    if (typeof no_penjualan !== 'string' || !no_penjualan.trim() || no_penjualan.trim().length > 50) {
        return res.status(400).json({ error: 'Nomor penjualan wajib diisi (maksimal 50 karakter).' });
    }
    const validated = validateSalePayload(req.body);
    if (validated.error) return res.status(400).json({ error: validated.error });

    try {
        const created = await Sales.create({
            no_penjualan: no_penjualan.trim(),
            ...validated
        });
        res.status(201).json({ status: 'Success', data: created });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Nomor penjualan sudah digunakan.' });
        }
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ error: 'Pelanggan atau barang tidak ditemukan.' });
        }
        console.error('Gagal membuat transaksi penjualan:', err);
        res.status(500).json({ error: 'Gagal membuat transaksi penjualan.' });
    }
};

exports.updatePenjualan = async (req, res) => {
    if (!req.params.noPenjualan.trim() || req.params.noPenjualan.length > 50) {
        return res.status(400).json({ error: 'Nomor penjualan tidak valid.' });
    }
    const validated = validateSalePayload(req.body);
    if (validated.error) return res.status(400).json({ error: validated.error });

    try {
        const data = await Sales.update(req.params.noPenjualan, validated);
        res.json({ status: 'Success', data });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ error: 'Pelanggan atau barang tidak ditemukan.' });
        }
        console.error('Gagal mengubah transaksi penjualan:', err);
        res.status(500).json({ error: 'Gagal mengubah transaksi penjualan.' });
    }
};

exports.setPenjualanStatus = async (req, res) => {
    const noPenjualan = req.params.noPenjualan;
    const { status } = req.body || {};
    if (!noPenjualan.trim() || noPenjualan.length > 50) {
        return res.status(400).json({ error: 'Nomor penjualan tidak valid.' });
    }
    if (!['Pending', 'Confirmed'].includes(status)) {
        return res.status(400).json({ error: 'Status penjualan tidak valid.' });
    }

    try {
        const data = await Sales.setStatus(noPenjualan, status);
        res.json({ status: 'Success', data });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        console.error('Gagal mengubah status penjualan:', err);
        res.status(500).json({ error: 'Gagal mengubah status penjualan.' });
    }
};

exports.deletePenjualan = async (req, res) => {
    if (!req.params.noPenjualan.trim() || req.params.noPenjualan.length > 50) {
        return res.status(400).json({ error: 'Nomor penjualan tidak valid.' });
    }
    try {
        const data = await Sales.delete(req.params.noPenjualan);
        res.json({ status: 'Success', data });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        console.error('Gagal menghapus transaksi penjualan:', err);
        res.status(500).json({ error: 'Gagal menghapus transaksi penjualan.' });
    }
};