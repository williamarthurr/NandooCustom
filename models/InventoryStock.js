const db = require('../config/db');

const filterTypes = new Set(['semua', 'no_stok_in', 'no_penjualan', 'nama_barang']);

class InventoryStock {
    static isValidFilterType(filterType) {
        return filterTypes.has(filterType);
    }

    static async search(filterType, value) {
        if (!this.isValidFilterType(filterType)) {
            throw new Error('Jenis filter inventory tidak valid.');
        }

        if (filterType === 'semua' || filterType === 'no_stok_in') {
            return this.searchByStockIn(filterType === 'no_stok_in' ? value : null);
        }

        let where;
        let params;
        if (filterType === 'no_penjualan') {
            where = `barang.KodeBarang IN (
                SELECT detail.KodeBarang
                FROM detailpenjualan detail
                WHERE detail.NoPenjualan = ?
            )`;
            params = [value];
        } else {
            where = 'barang.NamaBarang = ?';
            params = [value];
        }

        const [rows] = await db.query(
            `SELECT barang.KodeBarang AS kode_barang,
                    barang.NamaBarang AS nama_barang,
                    barang.Satuan AS satuan,
                    NULL AS no_stok_in,
                    COALESCE(inventory.StokCurrent, 0) AS stok
             FROM masterbarang barang
             LEFT JOIN inventorystock inventory ON inventory.KodeBarang = barang.KodeBarang
             WHERE ${where}
             ORDER BY barang.NamaBarang, barang.KodeBarang`,
            params
        );
        return rows;
    }

    static async searchByStockIn(noStokIn) {
        const params = [];
        let where = "WHERE stockin.Status = 'Confirmed'";
        if (noStokIn !== null) {
            where += ' AND source.NoStokIn = ?';
            params.push(noStokIn);
        }
        const [rows] = await db.query(
            `SELECT source.NoStokIn AS no_stok_in,
                    stockin.Tanggal AS tanggal,
                    source.KodeBarang AS kode_barang,
                    barang.NamaBarang AS nama_barang,
                    barang.Satuan AS satuan,
                    source.qty_masuk,
                    COALESCE(sold.qty_keluar, 0) AS qty_keluar,
                    source.qty_masuk - COALESCE(sold.qty_keluar, 0) AS stok
             FROM (
                 SELECT NoStokIn, KodeBarang, SUM(Qty) AS qty_masuk
                 FROM detailstokin
                 GROUP BY NoStokIn, KodeBarang
             ) source
             JOIN stokin stockin ON stockin.NoStokIn = source.NoStokIn
             JOIN masterbarang barang ON barang.KodeBarang = source.KodeBarang
             LEFT JOIN (
                 SELECT detail.NoStokIn, detail.KodeBarang, SUM(detail.Qty) AS qty_keluar
                 FROM detailpenjualan detail
                 JOIN penjualan sale ON sale.NoPenjualan = detail.NoPenjualan
                 WHERE detail.NoStokIn IS NOT NULL
                   AND sale.Status = 'Confirmed'
                 GROUP BY detail.NoStokIn, detail.KodeBarang
             ) sold ON sold.NoStokIn = source.NoStokIn
                   AND sold.KodeBarang = source.KodeBarang
             ${where}
             ORDER BY stockin.Tanggal DESC, source.NoStokIn DESC,
                      barang.NamaBarang, barang.KodeBarang`,
            params
        );
        return rows;
    }

    static async getUnallocatedSales() {
        const [rows] = await db.query(
            `SELECT detail.KodeBarang AS kode_barang,
                    barang.NamaBarang AS nama_barang,
                    SUM(detail.Qty) AS qty,
                    COUNT(DISTINCT detail.NoPenjualan) AS jumlah_penjualan
             FROM detailpenjualan detail
             JOIN penjualan sale ON sale.NoPenjualan = detail.NoPenjualan
             JOIN masterbarang barang ON barang.KodeBarang = detail.KodeBarang
             WHERE detail.NoStokIn IS NULL
               AND sale.Status = 'Confirmed'
             GROUP BY detail.KodeBarang, barang.NamaBarang
             ORDER BY barang.NamaBarang, detail.KodeBarang`
        );
        return rows;
    }
}

module.exports = InventoryStock;
