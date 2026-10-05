const db = require('../config/db');

class Sales {
    static async getAll() {
        const [rows] = await db.query(
            `SELECT NoPenjualan AS no_penjualan, Tanggal AS tanggal, Status AS status
             FROM penjualan
             ORDER BY Tanggal DESC, NoPenjualan DESC`
        );
        return rows;
    }

    static async findById(noPenjualan) {
        const [headers] = await db.query(
            `SELECT p.NoPenjualan AS no_penjualan, p.Tanggal AS tanggal, p.Status AS status,
                    p.KodePelanggan AS kode_pelanggan, pelanggan.NamaPelanggan AS nama_pelanggan,
                    p.GrandTotal AS grand_total
             FROM penjualan p
             LEFT JOIN masterpelanggan pelanggan ON pelanggan.KodePelanggan = p.KodePelanggan
             WHERE p.NoPenjualan = ?`,
            [noPenjualan]
        );
        if (!headers.length) return null;

        const [details] = await db.query(
            `SELECT d.KodeBarang AS kode_barang, d.NoStokIn AS no_stok_in,
                    barang.NamaBarang AS nama_barang,
                    barang.Satuan AS satuan, d.Qty AS qty,
                    d.SatuanHarga AS satuan_harga, d.Subtotal AS subtotal
             FROM detailpenjualan d
             LEFT JOIN masterbarang barang ON barang.KodeBarang = d.KodeBarang
             WHERE d.NoPenjualan = ?
             ORDER BY d.IDDetail`,
            [noPenjualan]
        );
        return { ...headers[0], details };
    }

    static async create({ no_penjualan, tanggal, kode_pelanggan, items }) {
        return this.save(null, { no_penjualan, tanggal, kode_pelanggan, items });
    }

    static async update(noPenjualan, { tanggal, kode_pelanggan, items }) {
        return this.save(noPenjualan, { tanggal, kode_pelanggan, items });
    }

    static async delete(noPenjualan) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [sales] = await connection.query(
                'SELECT NoPenjualan, Status AS status FROM penjualan WHERE NoPenjualan = ? FOR UPDATE',
                [noPenjualan]
            );
            if (!sales.length) {
                const error = new Error('Penjualan tidak ditemukan.');
                error.statusCode = 404;
                throw error;
            }

            const [details] = await connection.query(
                `SELECT KodeBarang AS kode_barang, SUM(Qty) AS qty
                 FROM detailpenjualan
                 WHERE NoPenjualan = ?
                 GROUP BY KodeBarang`,
                [noPenjualan]
            );
            const quantities = new Map(details.map(item => [
                item.kode_barang,
                Number(item.qty)
            ]));
            const codes = [...quantities.keys()].sort();
            const productState = new Map();
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
                    error.statusCode = 409;
                    throw error;
                }
                productState.set(code, {
                    ...products[0],
                    has_stock: Boolean(products[0].stock_row),
                    stok: Number(products[0].stok)
                });
            }

            if (sales[0].status === 'Confirmed') {
                await this.applyInventoryChange(
                    connection,
                    noPenjualan,
                    quantities,
                    1,
                    `Penghapusan Penjualan ${noPenjualan}`
                );
            }

            await connection.query(
                'DELETE FROM detailpenjualan WHERE NoPenjualan = ?',
                [noPenjualan]
            );
            await connection.query(
                'DELETE FROM penjualan WHERE NoPenjualan = ?',
                [noPenjualan]
            );
            await connection.commit();
            return { no_penjualan: noPenjualan };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async setStatus(noPenjualan, status) {
        if (!['Pending', 'Confirmed'].includes(status)) {
            const error = new Error('Status penjualan tidak valid.');
            error.statusCode = 400;
            throw error;
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [sales] = await connection.query(
                `SELECT Status AS status, DATE_FORMAT(Tanggal, '%Y-%m-%d') AS tanggal
                 FROM penjualan
                 WHERE NoPenjualan = ?
                 FOR UPDATE`,
                [noPenjualan]
            );
            if (!sales.length) {
                const error = new Error('Penjualan tidak ditemukan.');
                error.statusCode = 404;
                throw error;
            }

            const currentStatus = sales[0].status;
            if (currentStatus === status) {
                await connection.commit();
                return { no_penjualan: noPenjualan, status };
            }

            const [details] = await connection.query(
                `SELECT KodeBarang AS kode_barang, NoStokIn AS no_stok_in, Qty AS qty
                 FROM detailpenjualan
                 WHERE NoPenjualan = ?
                 ORDER BY IDDetail
                 FOR UPDATE`,
                [noPenjualan]
            );
            if (!details.length) {
                const error = new Error('Tambahkan minimal satu barang sebelum mengonfirmasi penjualan.');
                error.statusCode = 409;
                throw error;
            }
            const items = details.map(item => ({ ...item, qty: Number(item.qty) }));
            const quantities = this.sumByCode(items);

            if (status === 'Pending') {
                await this.applyInventoryChange(
                    connection,
                    noPenjualan,
                    quantities,
                    1,
                    `Penjualan ${noPenjualan} dikembalikan ke Pending`
                );
            } else {
                const batchNumbers = [...new Set(items.map(item => item.no_stok_in))].sort();
                for (const noStokIn of batchNumbers) {
                    const [batches] = await connection.query(
                        `SELECT Status AS status,
                                DATE_FORMAT(Tanggal, '%Y-%m-%d') AS tanggal
                         FROM stokin
                         WHERE NoStokIn = ?
                         FOR UPDATE`,
                        [noStokIn]
                    );
                    if (!batches.length || batches[0].status !== 'Confirmed') {
                        const error = new Error(`Stok in ${noStokIn} belum dikonfirmasi.`);
                        error.statusCode = 409;
                        throw error;
                    }
                    if (sales[0].tanggal < batches[0].tanggal) {
                        const error = new Error(
                            `Tanggal penjualan tidak boleh lebih awal dari stok in ${noStokIn}.`
                        );
                        error.statusCode = 409;
                        throw error;
                    }
                }

                const batchQuantities = this.sumByBatch(items);
                for (const [key, qty] of batchQuantities) {
                    const [noStokIn, code] = key.split('\u0000');
                    const available = await this.getBatchAvailability(
                        connection,
                        noStokIn,
                        code,
                        noPenjualan
                    );
                    if (available < qty) {
                        const error = new Error(
                            `Stok barang ${code} pada stok in ${noStokIn} tidak cukup. Tersedia ${available}.`
                        );
                        error.statusCode = 409;
                        throw error;
                    }
                }

                const productState = await this.lockProductStocks(connection, [...quantities.keys()].sort());
                for (const [code, qty] of quantities) {
                    const product = productState.get(code);
                    if (product.stok < qty) {
                        const error = new Error(
                            `Stok ${product.nama_barang} tidak cukup. Tersedia ${product.stok}.`
                        );
                        error.statusCode = 409;
                        throw error;
                    }
                }
                await this.applyInventoryChange(
                    connection,
                    noPenjualan,
                    quantities,
                    -1,
                    `Konfirmasi Penjualan ${noPenjualan}`,
                    productState
                );
            }

            await connection.query(
                'UPDATE penjualan SET Status = ?, is_synced = 0 WHERE NoPenjualan = ?',
                [status, noPenjualan]
            );
            await connection.commit();
            return { no_penjualan: noPenjualan, status };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async lockProductStocks(connection, codes) {
        const productState = new Map();
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
                error.statusCode = 409;
                throw error;
            }
            productState.set(code, {
                ...products[0],
                has_stock: Boolean(products[0].stock_row),
                stok: Number(products[0].stok)
            });
        }
        return productState;
    }

    static async applyInventoryChange(connection, noPenjualan, quantities, direction, reason, lockedProducts = null) {
        const codes = [...quantities.keys()].sort();
        const productState = lockedProducts || await this.lockProductStocks(connection, codes);

        for (const code of codes) {
            const product = productState.get(code);
            const qty = quantities.get(code);
            const closingStock = product.stok + direction * qty;
            if (closingStock < 0) {
                const error = new Error(`Stok ${product.nama_barang} tidak cukup.`);
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
                 VALUES (?, 'penjualan', ?, ?, ?, ?, ?, ?)`,
                [
                    code,
                    noPenjualan,
                    direction > 0 ? qty : 0,
                    direction < 0 ? qty : 0,
                    product.stok,
                    closingStock,
                    reason
                ]
            );
            product.stok = closingStock;
        }
    }

    static async save(existingNumber, { no_penjualan, tanggal, kode_pelanggan, items }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            if (existingNumber) {
                const [sales] = await connection.query(
                    'SELECT NoPenjualan, Status AS status FROM penjualan WHERE NoPenjualan = ? FOR UPDATE',
                    [existingNumber]
                );
                if (!sales.length) {
                    const error = new Error('Penjualan tidak ditemukan.');
                    error.statusCode = 404;
                    throw error;
                }
                if (sales[0].status !== 'Pending') {
                    const error = new Error('Ubah status penjualan menjadi Pending sebelum mengedit.');
                    error.statusCode = 409;
                    throw error;
                }
            }

            const batchNumbers = [...new Set(items.map(item => item.no_stok_in))].sort();
            for (const noStokIn of batchNumbers) {
                const [batches] = await connection.query(
                    `SELECT NoStokIn, Status AS status,
                            DATE_FORMAT(Tanggal, '%Y-%m-%d') AS tanggal
                     FROM stokin
                     WHERE NoStokIn = ?
                     FOR UPDATE`,
                    [noStokIn]
                );
                if (!batches.length) {
                    const error = new Error(`Nomor stok in ${noStokIn} tidak ditemukan.`);
                    error.statusCode = 400;
                    throw error;
                }
                if (batches[0].status !== 'Confirmed') {
                    const error = new Error(`Stok in ${noStokIn} belum dikonfirmasi.`);
                    error.statusCode = 409;
                    throw error;
                }
                if (tanggal < batches[0].tanggal) {
                    const error = new Error(
                        `Tanggal penjualan tidak boleh lebih awal dari stok in ${noStokIn}.`
                    );
                    error.statusCode = 400;
                    throw error;
                }
            }

            const codes = [...new Set(items.map(item => item.kode_barang))].sort();
            const productState = new Map();
            for (const code of codes) {
                const [products] = await connection.query(
                    `SELECT barang.NamaBarang AS nama_barang, barang.SatuanHarga AS satuan_harga,
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
                productState.set(code, {
                    ...products[0],
                    has_stock: Boolean(products[0].stock_row),
                    stok: Number(products[0].stok),
                    satuan_harga: Number(products[0].satuan_harga)
                });
            }

            const quantityByBatch = this.sumByBatch(items);

            for (const [key, qty] of quantityByBatch) {
                const [noStokIn, code] = key.split('\u0000');
                const available = await this.getBatchAvailability(
                    connection,
                    noStokIn,
                    code,
                    existingNumber
                );
                if (available < qty) {
                    const product = productState.get(code);
                    const error = new Error(
                        `Stok ${product.nama_barang} pada nomor stok in ${noStokIn} tidak cukup. Tersedia ${available}.`
                    );
                    error.statusCode = 409;
                    throw error;
                }
            }

            let grandTotalCents = 0;
            const normalizedItems = items.map(item => {
                const product = productState.get(item.kode_barang);
                const satuanHargaCents = Math.round(product.satuan_harga * 100);
                const subtotalCents = item.qty * satuanHargaCents;
                grandTotalCents += subtotalCents;
                return {
                    ...item,
                    satuan_harga: satuanHargaCents / 100,
                    subtotal: subtotalCents / 100
                };
            });
            if (!Number.isSafeInteger(grandTotalCents) || grandTotalCents > 999999999999) {
                const error = new Error('Grand total melebihi batas maksimum transaksi.');
                error.statusCode = 400;
                throw error;
            }
            const grandTotal = grandTotalCents / 100;

            if (existingNumber) {
                await connection.query(
                    `UPDATE penjualan
                     SET Tanggal = ?, KodePelanggan = ?, GrandTotal = ?, Status = 'Pending', is_synced = 0
                     WHERE NoPenjualan = ?`,
                    [tanggal, kode_pelanggan, grandTotal, existingNumber]
                );
                await connection.query(
                    'DELETE FROM detailpenjualan WHERE NoPenjualan = ?',
                    [existingNumber]
                );
            } else {
                await connection.query(
                    `INSERT INTO penjualan (NoPenjualan, Tanggal, KodePelanggan, GrandTotal, Status, is_synced)
                     VALUES (?, ?, ?, ?, 'Pending', 0)`,
                    [no_penjualan, tanggal, kode_pelanggan, grandTotal]
                );
            }

            const saleNumber = existingNumber || no_penjualan;
            for (const item of normalizedItems) {
                await connection.query(
                    `INSERT INTO detailpenjualan
                        (NoPenjualan, KodeBarang, NoStokIn, Qty, SatuanHarga, Subtotal)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        saleNumber,
                        item.kode_barang,
                        item.no_stok_in,
                        item.qty,
                        item.satuan_harga,
                        item.subtotal
                    ]
                );
            }

            await connection.commit();
            return { no_penjualan: saleNumber, grand_total: grandTotal, status: 'Pending' };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static sumByCode(items) {
        const quantities = new Map();
        items.forEach(item => {
            quantities.set(
                item.kode_barang,
                (quantities.get(item.kode_barang) || 0) + item.qty
            );
        });
        return quantities;
    }

    static sumByBatch(items) {
        const quantities = new Map();
        items.forEach(item => {
            const key = `${item.no_stok_in}\u0000${item.kode_barang}`;
            quantities.set(key, (quantities.get(key) || 0) + item.qty);
        });
        return quantities;
    }

    static async getBatchAvailability(connection, noStokIn, kodeBarang, excludeSale) {
        const [rows] = await connection.query(
            `SELECT COALESCE(SUM(source.Qty), 0) - COALESCE((
                 SELECT SUM(sold.Qty)
                 FROM detailpenjualan sold
                 WHERE sold.NoStokIn = source.NoStokIn
                   AND sold.KodeBarang = source.KodeBarang
                   AND sold.NoPenjualan IN (
                       SELECT NoPenjualan FROM penjualan WHERE Status = 'Confirmed'
                   )
                   AND (? IS NULL OR sold.NoPenjualan <> ?)
             ), 0) AS available
             FROM detailstokin source
             WHERE source.NoStokIn = ? AND source.KodeBarang = ?
             GROUP BY source.NoStokIn, source.KodeBarang`,
            [excludeSale, excludeSale, noStokIn, kodeBarang]
        );
        return rows.length ? Number(rows[0].available) : 0;
    }
}

module.exports = Sales;
