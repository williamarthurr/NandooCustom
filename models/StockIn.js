const db = require('../config/db');

class StockIn {
    static async getAll() {
        const [rows] = await db.query(
            `SELECT s.NoStokIn AS no_stok_in,
                    DATE_FORMAT(s.Tanggal, '%Y-%m-%d') AS tanggal,
                    s.Status AS status,
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM detailpenjualan sold
                        WHERE sold.NoStokIn = s.NoStokIn
                    ) OR EXISTS (
                        SELECT 1
                        FROM detailstokin source
                        JOIN detailpenjualan sold
                          ON sold.KodeBarang = source.KodeBarang
                         AND sold.NoStokIn IS NULL
                        JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                        WHERE source.NoStokIn = s.NoStokIn
                          AND sale.Tanggal >= s.Tanggal
                    ) THEN 0 ELSE 1 END AS can_edit,
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM detailpenjualan sold
                        JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                        WHERE sold.NoStokIn = s.NoStokIn
                          AND sale.Status = 'Confirmed'
                    ) OR EXISTS (
                        SELECT 1
                        FROM detailstokin source
                        JOIN detailpenjualan sold
                          ON sold.KodeBarang = source.KodeBarang
                         AND sold.NoStokIn IS NULL
                        JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                        WHERE source.NoStokIn = s.NoStokIn
                          AND sale.Status = 'Confirmed'
                          AND sale.Tanggal >= s.Tanggal
                    ) THEN 0 ELSE 1 END AS can_revert
             FROM stokin s
             ORDER BY s.Tanggal DESC, s.NoStokIn DESC`
        );
        return rows;
    }

    static async findById(noStokIn) {
        const [headers] = await db.query(
            `SELECT s.NoStokIn AS no_stok_in,
                    DATE_FORMAT(s.Tanggal, '%Y-%m-%d') AS tanggal,
                    s.KodeSupplier AS kode_supplier, supplier.NamaSupplier AS nama_supplier,
                    s.GrandTotal AS grand_total,
                    s.Status AS status,
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM detailpenjualan sold
                        WHERE sold.NoStokIn = s.NoStokIn
                    ) OR EXISTS (
                        SELECT 1
                        FROM detailstokin source
                        JOIN detailpenjualan sold
                          ON sold.KodeBarang = source.KodeBarang
                         AND sold.NoStokIn IS NULL
                        JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                        WHERE source.NoStokIn = s.NoStokIn
                          AND sale.Tanggal >= s.Tanggal
                    ) THEN 0 ELSE 1 END AS can_edit,
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM detailpenjualan sold
                        JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                        WHERE sold.NoStokIn = s.NoStokIn
                          AND sale.Status = 'Confirmed'
                    ) OR EXISTS (
                        SELECT 1
                        FROM detailstokin source
                        JOIN detailpenjualan sold
                          ON sold.KodeBarang = source.KodeBarang
                         AND sold.NoStokIn IS NULL
                        JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                        WHERE source.NoStokIn = s.NoStokIn
                          AND sale.Status = 'Confirmed'
                          AND sale.Tanggal >= s.Tanggal
                    ) THEN 0 ELSE 1 END AS can_revert
             FROM stokin s
             LEFT JOIN mastersupplier supplier ON supplier.KodeSupplier = s.KodeSupplier
             WHERE s.NoStokIn = ?`,
            [noStokIn]
        );
        if (!headers.length) return null;

        const [details] = await db.query(
            `SELECT d.KodeBarang AS kode_barang, barang.NamaBarang AS nama_barang,
                    barang.Satuan AS satuan, d.Qty AS qty,
                    d.SatuanHarga AS satuan_harga, d.Subtotal AS subtotal
             FROM detailstokin d
             LEFT JOIN masterbarang barang ON barang.KodeBarang = d.KodeBarang
             WHERE d.NoStokIn = ?
             ORDER BY d.IDDetail`,
            [noStokIn]
        );
        return { ...headers[0], details };
    }

    static async getAvailableByProduct(kodeBarang, excludeSale = null) {
        const [rows] = await db.query(
            `SELECT s.NoStokIn AS no_stok_in,
                    DATE_FORMAT(s.Tanggal, '%Y-%m-%d') AS tanggal,
                    source.KodeBarang AS kode_barang,
                    source.qty - COALESCE(sold.qty, 0) AS available
             FROM stokin s
             JOIN (
                 SELECT NoStokIn, KodeBarang, SUM(Qty) AS qty
                 FROM detailstokin
                 WHERE KodeBarang = ?
                 GROUP BY NoStokIn, KodeBarang
             ) source ON source.NoStokIn = s.NoStokIn
             LEFT JOIN (
                 SELECT NoStokIn, KodeBarang, SUM(Qty) AS qty
                 FROM detailpenjualan
                 WHERE NoStokIn IS NOT NULL
                   AND NoPenjualan IN (
                       SELECT NoPenjualan FROM penjualan WHERE Status = 'Confirmed'
                   )
                   AND (? IS NULL OR NoPenjualan <> ?)
                 GROUP BY NoStokIn, KodeBarang
             ) sold ON sold.NoStokIn = source.NoStokIn
                   AND sold.KodeBarang = source.KodeBarang
             WHERE source.KodeBarang = ?
               AND s.Status = 'Confirmed'
               AND source.qty - COALESCE(sold.qty, 0) > 0
             ORDER BY s.Tanggal, s.NoStokIn`,
            [kodeBarang, excludeSale, excludeSale, kodeBarang]
        );
        return rows;
    }

    static async create({ no_stok_in, tanggal, kode_supplier, items }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const grandTotalCents = items.reduce(
                (total, item) => total + item.qty * Math.round(item.satuan_harga * 100),
                0
            );
            const grandTotal = grandTotalCents / 100;
            await connection.query(
                `INSERT INTO stokin (NoStokIn, Tanggal, KodeSupplier, GrandTotal, Status, is_synced)
                 VALUES (?, ?, ?, ?, 'Pending', 0)`,
                [no_stok_in, tanggal, kode_supplier, grandTotal]
            );

            for (const item of items) {
                const [products] = await connection.query(
                    'SELECT KodeBarang FROM masterbarang WHERE KodeBarang = ?',
                    [item.kode_barang]
                );
                if (!products.length) {
                    const error = new Error(`Barang ${item.kode_barang} tidak ditemukan.`);
                    error.statusCode = 400;
                    throw error;
                }

                const subtotal = item.qty * Math.round(item.satuan_harga * 100) / 100;
                await connection.query(
                    `INSERT INTO detailstokin (NoStokIn, KodeBarang, Qty, SatuanHarga, Subtotal)
                     VALUES (?, ?, ?, ?, ?)`,
                    [no_stok_in, item.kode_barang, item.qty, item.satuan_harga, subtotal]
                );

            }

            await connection.commit();
            return { no_stok_in, grand_total: grandTotal, status: 'Pending' };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async update(noStokIn, { tanggal, kode_supplier, items }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [headers] = await connection.query(
                'SELECT NoStokIn, Status AS status FROM stokin WHERE NoStokIn = ? FOR UPDATE',
                [noStokIn]
            );
            if (!headers.length) {
                const error = new Error('Stok in tidak ditemukan.');
                error.statusCode = 404;
                throw error;
            }
            if (headers[0].status !== 'Pending') {
                const error = new Error('Ubah status stok in menjadi Pending sebelum mengedit.');
                error.statusCode = 409;
                throw error;
            }
            await this.assertNoSales(connection, noStokIn);

            for (const item of items) {
                const [products] = await connection.query(
                    'SELECT KodeBarang FROM masterbarang WHERE KodeBarang = ?',
                    [item.kode_barang]
                );
                if (!products.length) {
                    const error = new Error(`Barang ${item.kode_barang} tidak ditemukan.`);
                    error.statusCode = 400;
                    throw error;
                }
            }

            const grandTotalCents = items.reduce(
                (total, item) => total + item.qty * Math.round(item.satuan_harga * 100),
                0
            );
            if (!Number.isSafeInteger(grandTotalCents) || grandTotalCents > 999999999999) {
                const error = new Error('Grand total melebihi batas maksimum transaksi.');
                error.statusCode = 400;
                throw error;
            }
            const grandTotal = grandTotalCents / 100;

            await connection.query(
                `UPDATE stokin
                 SET Tanggal = ?, KodeSupplier = ?, GrandTotal = ?, is_synced = 0
                 WHERE NoStokIn = ?`,
                [tanggal, kode_supplier, grandTotal, noStokIn]
            );
            await connection.query('DELETE FROM detailstokin WHERE NoStokIn = ?', [noStokIn]);

            for (const item of items) {
                const subtotal = item.qty * Math.round(item.satuan_harga * 100) / 100;
                await connection.query(
                    `INSERT INTO detailstokin (NoStokIn, KodeBarang, Qty, SatuanHarga, Subtotal)
                     VALUES (?, ?, ?, ?, ?)`,
                    [noStokIn, item.kode_barang, item.qty, item.satuan_harga, subtotal]
                );
            }

            await connection.commit();
            return { no_stok_in: noStokIn, grand_total: grandTotal, status: 'Pending' };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async delete(noStokIn) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [headers] = await connection.query(
                'SELECT NoStokIn, Status AS status FROM stokin WHERE NoStokIn = ? FOR UPDATE',
                [noStokIn]
            );
            if (!headers.length) {
                const error = new Error('Stok in tidak ditemukan.');
                error.statusCode = 404;
                throw error;
            }
            await this.assertNoSales(connection, noStokIn);

            if (headers[0].status === 'Confirmed') {
                const quantities = await this.getQuantities(connection, noStokIn);
                await this.applyInventoryChange(
                    connection,
                    noStokIn,
                    quantities,
                    -1,
                    `Penghapusan Stok In ${noStokIn}`
                );
            }

            await connection.query('DELETE FROM detailstokin WHERE NoStokIn = ?', [noStokIn]);
            await connection.query('DELETE FROM stokin WHERE NoStokIn = ?', [noStokIn]);
            await connection.commit();
            return { no_stok_in: noStokIn };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async setStatus(noStokIn, status) {
        if (!['Pending', 'Confirmed'].includes(status)) {
            const error = new Error('Status stok in tidak valid.');
            error.statusCode = 400;
            throw error;
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [headers] = await connection.query(
                'SELECT Status AS status FROM stokin WHERE NoStokIn = ? FOR UPDATE',
                [noStokIn]
            );
            if (!headers.length) {
                const error = new Error('Stok in tidak ditemukan.');
                error.statusCode = 404;
                throw error;
            }
            const currentStatus = headers[0].status;
            if (currentStatus === status) {
                await connection.commit();
                return { no_stok_in: noStokIn, status };
            }

            if (status === 'Pending') {
                await this.assertNoConfirmedSales(connection, noStokIn);
                const quantities = await this.getQuantities(connection, noStokIn);
                await this.applyInventoryChange(
                    connection,
                    noStokIn,
                    quantities,
                    -1,
                    `Stok In ${noStokIn} dikembalikan ke Pending`
                );
            } else {
                const quantities = await this.getQuantities(connection, noStokIn);
                await this.applyInventoryChange(
                    connection,
                    noStokIn,
                    quantities,
                    1,
                    `Konfirmasi Stok In ${noStokIn}`
                );
            }

            await connection.query(
                'UPDATE stokin SET Status = ?, is_synced = 0 WHERE NoStokIn = ?',
                [status, noStokIn]
            );
            await connection.commit();
            return { no_stok_in: noStokIn, status };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async getQuantities(connection, noStokIn) {
        const [rows] = await connection.query(
            `SELECT KodeBarang AS kode_barang, SUM(Qty) AS qty
             FROM detailstokin
             WHERE NoStokIn = ?
             GROUP BY KodeBarang`,
            [noStokIn]
        );
        return new Map(rows.map(item => [item.kode_barang, Number(item.qty)]));
    }

    static async applyInventoryChange(connection, noStokIn, quantities, direction, reason) {
        const codes = [...quantities.keys()].sort();
        const productState = await this.lockProductStocks(connection, codes);

        for (const code of codes) {
            const product = productState.get(code);
            const qty = quantities.get(code);
            const closingStock = product.stok + direction * qty;
            if (closingStock < 0) {
                const error = new Error(
                    `Stok ${product.nama_barang} sudah terpakai; transaksi tidak dapat dikembalikan ke Pending.`
                );
                error.statusCode = 409;
                throw error;
            }
            if (product.has_stock) {
                await connection.query(
                    'UPDATE inventorystock SET StokCurrent = ? WHERE KodeBarang = ?',
                    [closingStock, code]
                );
            } else {
                await connection.query(
                    'INSERT INTO inventorystock (KodeBarang, StokCurrent) VALUES (?, ?)',
                    [code, closingStock]
                );
            }
            await connection.query(
                `INSERT INTO inventorylog
                    (KodeBarang, JenisTransaksi, NoReferensi, QtyMasuk, QtyKeluar, StokAwal, StokAkhir, Keterangan)
                 VALUES (?, 'Stokin', ?, ?, ?, ?, ?, ?)`,
                [
                    code,
                    noStokIn,
                    direction > 0 ? qty : 0,
                    direction < 0 ? qty : 0,
                    product.stok,
                    closingStock,
                    reason
                ]
            );
        }
    }

    static async assertNoConfirmedSales(connection, noStokIn) {
        const [rows] = await connection.query(
            `SELECT EXISTS (
                 SELECT 1
                 FROM detailpenjualan sold
                 JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                 WHERE sold.NoStokIn = ?
                   AND sale.Status = 'Confirmed'
             ) OR EXISTS (
                 SELECT 1
                 FROM detailstokin source
                 JOIN detailpenjualan sold
                   ON sold.KodeBarang = source.KodeBarang
                  AND sold.NoStokIn IS NULL
                 JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                 JOIN stokin stockin ON stockin.NoStokIn = source.NoStokIn
                 WHERE source.NoStokIn = ?
                   AND sale.Status = 'Confirmed'
                   AND sale.Tanggal >= stockin.Tanggal
             ) AS has_sales`,
            [noStokIn, noStokIn]
        );
        if (rows[0].has_sales) {
            const error = new Error('Stok in tidak bisa diubah atau dihapus karena sudah ada penjualan.');
            error.statusCode = 409;
            throw error;
        }
    }

    static async assertNoSales(connection, noStokIn) {
        const [rows] = await connection.query(
            `SELECT EXISTS (
                 SELECT 1
                 FROM detailpenjualan sold
                 WHERE sold.NoStokIn = ?
             ) OR EXISTS (
                 SELECT 1
                 FROM detailstokin source
                 JOIN detailpenjualan sold
                   ON sold.KodeBarang = source.KodeBarang
                  AND sold.NoStokIn IS NULL
                 JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                 JOIN stokin stockin ON stockin.NoStokIn = source.NoStokIn
                 WHERE source.NoStokIn = ?
                   AND sale.Tanggal >= stockin.Tanggal
             ) AS has_sales`,
            [noStokIn, noStokIn]
        );
        if (rows[0].has_sales) {
            const error = new Error('Stok in tidak bisa diubah atau dihapus karena dipakai dalam penjualan.');
            error.statusCode = 409;
            throw error;
        }
    }

    static async lockProductStocks(connection, codes) {
        const state = new Map();
        for (const code of codes) {
            const [products] = await connection.query(
                `SELECT barang.NamaBarang AS nama_barang,
                        inventory.KodeBarang AS stock_row,
                        COALESCE(inventory.StokCurrent, 0) AS stok
                 FROM masterbarang barang
                 LEFT JOIN inventorystock inventory ON inventory.KodeBarang = barang.KodeBarang
                 WHERE barang.KodeBarang = ?
                 FOR UPDATE`,
                [code]
            );
            if (!products.length) {
                const error = new Error(`Barang ${code} tidak ditemukan.`);
                error.statusCode = 400;
                throw error;
            }
            state.set(code, {
                ...products[0],
                has_stock: Boolean(products[0].stock_row),
                stok: Number(products[0].stok)
            });
        }
        return state;
    }
}

module.exports = StockIn;
