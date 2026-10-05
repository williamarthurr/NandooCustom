const StockIn = require('../models/StockIn');

function validateItems(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
        return { error: 'Tambahkan minimal satu barang (maksimal 100 baris).' };
    }

    const cleanItems = [];
    for (const item of items) {
        if (!item || typeof item.kode_barang !== 'string' || !item.kode_barang.trim() ||
            item.kode_barang.trim().length > 50) {
            return { error: 'Kode barang tidak valid.' };
        }
        const qty = Number(item.qty);
        const satuan_harga = Number(item.satuan_harga);
        if (!Number.isSafeInteger(qty) || qty < 1) {
            return { error: 'Qty barang harus bilangan bulat minimal 1.' };
        }
        if (!Number.isFinite(satuan_harga) || satuan_harga < 0 || satuan_harga > 9999999999.99) {
            return { error: 'Harga satuan harus berupa angka nol atau lebih.' };
        }
        if (Math.abs(satuan_harga * 100 - Math.round(satuan_harga * 100)) > 0.000001) {
            return { error: 'Harga satuan maksimal dua angka di belakang koma.' };
        }
        cleanItems.push({ kode_barang: item.kode_barang.trim(), qty, satuan_harga });
    }

    const grandTotalCents = cleanItems.reduce(
        (total, item) => total + item.qty * Math.round(item.satuan_harga * 100),
        0
    );
    if (!Number.isSafeInteger(grandTotalCents) || grandTotalCents > 999999999999) {
        return { error: 'Grand total melebihi batas maksimum transaksi.' };
    }
    return { items: cleanItems };
}

function validateHeader(tanggal, kode_supplier) {
    if (typeof tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        return 'Tanggal stok in tidak valid.';
    }
    const [year, month, day] = tanggal.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day) {
        return 'Tanggal stok in tidak valid.';
    }
    if (kode_supplier != null && (typeof kode_supplier !== 'string' || kode_supplier.length > 50)) {
        return 'Supplier tidak valid.';
    }
    return null;
}

exports.getAllStokIn = async (req, res) => {
    try {
        const data = await StockIn.getAll();
        res.json({ status: 'Success', data });
    } catch (err) {
        console.error('Gagal mengambil daftar stok in:', err);
        res.status(500).json({ error: 'Gagal mengambil daftar stok in.' });
    }
};

exports.getStokInById = async (req, res) => {
    if (!req.params.noStokIn.trim()) {
        return res.status(400).json({ error: 'Nomor stok in tidak valid.' });
    }

    try {
        const stokIn = await StockIn.findById(req.params.noStokIn);
        if (!stokIn) {
            return res.status(404).json({ error: 'Stok in tidak ditemukan.' });
        }
        res.json({ status: 'Success', data: stokIn });
    } catch (err) {
        console.error('Gagal mengambil detail stok in:', err);
        res.status(500).json({ error: 'Gagal mengambil detail stok in.' });
    }
};

exports.getAvailableStokIn = async (req, res) => {
    const { kodeBarang } = req.params;
    const excludeSale = req.query.exclude_sale;
    if (!kodeBarang.trim() || kodeBarang.length > 50) {
        return res.status(400).json({ error: 'Kode barang tidak valid.' });
    }
    if (excludeSale !== undefined &&
        (typeof excludeSale !== 'string' || !excludeSale.trim() || excludeSale.length > 50)) {
        return res.status(400).json({ error: 'Nomor penjualan tidak valid.' });
    }

    try {
        const data = await StockIn.getAvailableByProduct(kodeBarang, excludeSale || null);
        res.json({ status: 'Success', data });
    } catch (err) {
        console.error('Gagal mengambil batch stok yang tersedia:', err);
        res.status(500).json({ error: 'Gagal mengambil batch stok yang tersedia.' });
    }
};

exports.createStokIn = async (req, res) => {
    const { no_stok_in, tanggal, kode_supplier, items } = req.body || {};
    if (typeof no_stok_in !== 'string' || !no_stok_in.trim() || no_stok_in.trim().length > 50) {
        return res.status(400).json({ error: 'Nomor stok in wajib diisi (maksimal 50 karakter).' });
    }
    const headerError = validateHeader(tanggal, kode_supplier);
    if (headerError) return res.status(400).json({ error: headerError });
    const validated = validateItems(items);
    if (validated.error) return res.status(400).json({ error: validated.error });

    try {
        const created = await StockIn.create({
            no_stok_in: no_stok_in.trim(),
            tanggal,
            kode_supplier: kode_supplier?.trim() || null,
            items: validated.items
        });
        res.status(201).json({ status: 'Success', data: created });
    } catch (err) {
        if (err.statusCode === 400) {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Nomor stok in sudah digunakan.' });
        }
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ error: 'Supplier atau barang tidak ditemukan.' });
        }
        console.error('Gagal membuat transaksi stok in:', err);
        res.status(500).json({ error: 'Gagal membuat transaksi stok in.' });
    }
};

exports.updateStokIn = async (req, res) => {
    const { tanggal, kode_supplier, items } = req.body || {};
    const headerError = validateHeader(tanggal, kode_supplier);
    if (headerError) return res.status(400).json({ error: headerError });
    const validated = validateItems(items);
    if (validated.error) return res.status(400).json({ error: validated.error });
    if (!req.params.noStokIn.trim() || req.params.noStokIn.length > 50) {
        return res.status(400).json({ error: 'Nomor stok in tidak valid.' });
    }

    try {
        const data = await StockIn.update(req.params.noStokIn, {
            tanggal,
            kode_supplier: kode_supplier?.trim() || null,
            items: validated.items
        });
        res.json({ status: 'Success', data });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ error: 'Supplier atau barang tidak ditemukan.' });
        }
        console.error('Gagal mengubah transaksi stok in:', err);
        res.status(500).json({ error: 'Gagal mengubah transaksi stok in.' });
    }
};

exports.setStokInStatus = async (req, res) => {
    const noStokIn = req.params.noStokIn;
    const { status } = req.body || {};
    if (!noStokIn.trim() || noStokIn.length > 50) {
        return res.status(400).json({ error: 'Nomor stok in tidak valid.' });
    }
    if (!['Pending', 'Confirmed'].includes(status)) {
        return res.status(400).json({ error: 'Status stok in tidak valid.' });
    }

    try {
        const data = await StockIn.setStatus(noStokIn, status);
        res.json({ status: 'Success', data });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        console.error('Gagal mengubah status stok in:', err);
        res.status(500).json({ error: 'Gagal mengubah status stok in.' });
    }
};

exports.deleteStokIn = async (req, res) => {
    if (!req.params.noStokIn.trim() || req.params.noStokIn.length > 50) {
        return res.status(400).json({ error: 'Nomor stok in tidak valid.' });
    }
    try {
        const data = await StockIn.delete(req.params.noStokIn);
        res.json({ status: 'Success', data });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
        console.error('Gagal menghapus transaksi stok in:', err);
        res.status(500).json({ error: 'Gagal menghapus transaksi stok in.' });
    }
};