import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const json = (body, status = 200) => Response.json(body, { status });
const success = (data, status = 200) => json({ status: "Success", data }, status);
const badRequest = (message) => { throw new HttpError(400, message); };
const notFound = (message) => { throw new HttpError(404, message); };
const conflict = (message) => { throw new HttpError(409, message); };

function requiredText(value, label, max = 50) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
        badRequest(`${label} tidak valid.`);
    }
    return value.trim();
}

function validateDate(value, label) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        badRequest(`${label} tidak valid.`);
    }
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day) {
        badRequest(`${label} tidak valid.`);
    }
    return value;
}

function requireRole(user, role, message) {
    if (String(user?.role || "").toLowerCase() !== role) {
        throw new HttpError(403, message);
    }
}

async function readJson(request) {
    try {
        const raw = await request.arrayBuffer();
        if (raw.byteLength > 100 * 1024) badRequest("Ukuran data melebihi batas 100 KB.");
        const body = JSON.parse(new TextDecoder().decode(raw));
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            badRequest("Data tidak valid.");
        }
        return body;
    } catch (error) {
        if (error instanceof HttpError) throw error;
        badRequest("Format JSON tidak valid.");
    }
}

function decodeParam(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        badRequest("Parameter URL tidak valid.");
    }
}

async function authenticate(request, env) {
    const token = request.headers.get("authorization")?.split(/\s+/)[1];
    if (!token) throw new HttpError(401, "Akses ditolak, token tidak ditemukan!");
    if (!env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured.");
        throw new HttpError(503, "Autentikasi belum dikonfigurasi.");
    }
    try {
        return jwt.verify(token, env.JWT_SECRET);
    } catch {
        throw new HttpError(403, "Token tidak valid atau expired!");
    }
}

function statement(db, sql, ...values) {
    return db.prepare(sql).bind(...values);
}

async function all(db, sql, ...values) {
    const result = await statement(db, sql, ...values).all();
    return result.results;
}

async function first(db, sql, ...values) {
    return statement(db, sql, ...values).first();
}

async function batch(db, statements) {
    if (statements.length) await db.batch(statements);
}

function insertMany(db, sqlPrefix, rows, sqlSuffix = "") {
    if (!rows.length) return null;
    const placeholders = rows.map((row) => `(${row.map(() => "?").join(", ")})`).join(", ");
    return statement(db, `${sqlPrefix} VALUES ${placeholders}${sqlSuffix}`, ...rows.flat());
}

function duplicateOrForeignKey(error, duplicateMessage, foreignMessage) {
    const message = String(error?.message || "");
    if (/UNIQUE constraint failed|PRIMARY KEY/i.test(message)) {
        throw new HttpError(409, duplicateMessage);
    }
    if (/FOREIGN KEY constraint failed/i.test(message)) {
        throw new HttpError(400, foreignMessage);
    }
    throw error;
}

async function login(request, env) {
    const { username, password } = await readJson(request);
    if (!username || !password) badRequest("Username dan password wajib diisi!");
    if (!env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured.");
        throw new HttpError(503, "Autentikasi belum dikonfigurasi.");
    }
    const user = await first(
        env.DB,
        "SELECT * FROM users WHERE username = ? AND status = 'active'",
        username
    );
    if (!user) throw new HttpError(401, "Username atau password salah!");

    let matches = false;
    const isBcryptHash = /^\$2[ab]\$/.test(user.password);
    if (isBcryptHash) {
        matches = await bcrypt.compare(password, user.password);
    } else {
        matches = password === user.password;
    }
    if (!matches) throw new HttpError(401, "Username atau password salah!");

    await statement(
        env.DB,
        `UPDATE users
         SET last_login = CURRENT_TIMESTAMP, password = COALESCE(?, password)
         WHERE id = ?`,
        isBcryptHash ? null : await bcrypt.hash(password, 10),
        user.id
    ).run();
    const payload = { id: user.id, username: user.username, role: user.role, nama: user.nama };
    return json({
        status: "Success",
        message: "Login Berhasil!",
        token: jwt.sign(payload, env.JWT_SECRET, { expiresIn: "12h" }),
        user: payload
    });
}

async function usersRoute(request, env, segments, user) {
    const method = request.method;
    const id = segments[1] ? Number(decodeParam(segments[1])) : null;
    if (id !== null && (!Number.isSafeInteger(id) || id < 1)) badRequest("ID user tidak valid.");

    if (method === "GET" && id === null) {
        return success(await all(env.DB, "SELECT id, username, nama, role FROM users ORDER BY id"));
    }
    if (method === "GET" && id !== null) {
        const found = await first(
            env.DB,
            "SELECT id, username, no_telp, role FROM users WHERE id = ?",
            id
        );
        if (!found) notFound("User tidak ditemukan.");
        return success(found);
    }
    if (method === "POST" && id === null) {
        requireRole(user, "admin", "Hanya admin yang dapat menambahkan user.");
        const body = await readJson(request);
        const username = requiredText(body.username, "Username");
        const nama = requiredText(body.nama, "Nama", 100);
        if (!["admin", "staff", "gudang"].includes(body.role)) {
            badRequest("Role harus admin, staff, atau gudang.");
        }
        if (typeof body.password !== "string" || !body.password) badRequest("Password wajib diisi.");
        if (new TextEncoder().encode(body.password).length > 72) badRequest("Password maksimal 72 byte.");
        if (body.no_telp != null && typeof body.no_telp !== "string") badRequest("Nomor telepon tidak valid.");
        if (body.no_telp && body.no_telp.trim().length > 20) badRequest("Nomor telepon maksimal 20 karakter.");
        try {
            const hashedPassword = await bcrypt.hash(body.password, 10);
            const result = await statement(
                env.DB,
                "INSERT INTO users (username, nama, role, no_telp, password, status) VALUES (?, ?, ?, ?, ?, 'active')",
                username, nama, body.role, body.no_telp?.trim() || null, hashedPassword
            ).run();
            const created = await first(
                env.DB,
                "SELECT id, username, no_telp, role FROM users WHERE id = ?",
                result.meta.last_row_id
            );
            return success(created, 201);
        } catch (error) {
            duplicateOrForeignKey(error, "Username sudah digunakan.", "Data user tidak valid.");
        }
    }
    if (method === "PUT" && id !== null) {
        const body = await readJson(request);
        const isAdmin = String(user?.role || "").toLowerCase() === "admin";
        if (body.role !== undefined && !isAdmin) {
            throw new HttpError(403, "Hanya admin yang dapat mengubah role user.");
        }
        if (body.role !== undefined && !["admin", "staff", "gudang"].includes(body.role)) {
            badRequest("Role harus admin, staff, atau gudang.");
        }
        const username = requiredText(body.username, "Username");
        if (body.no_telp != null && typeof body.no_telp !== "string") badRequest("Nomor telepon tidak valid.");
        if (body.no_telp && body.no_telp.trim().length > 20) badRequest("Nomor telepon maksimal 20 karakter.");
        if (body.password != null && typeof body.password !== "string") badRequest("Password tidak valid.");
        if (body.password && new TextEncoder().encode(body.password).length > 72) {
            badRequest("Password maksimal 72 byte.");
        }
        const existing = await first(env.DB, "SELECT id FROM users WHERE id = ?", id);
        if (!existing) notFound("User tidak ditemukan.");
        try {
            const hashedPassword = body.password ? await bcrypt.hash(body.password, 10) : null;
            await statement(
                env.DB,
                `UPDATE users
                 SET username = ?, no_telp = ?, password = COALESCE(?, password),
                     role = COALESCE(?, role), updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                username, body.no_telp?.trim() || null, hashedPassword, isAdmin ? body.role ?? null : null, id
            ).run();
            return success(await first(
                env.DB,
                "SELECT id, username, no_telp, role FROM users WHERE id = ?",
                id
            ));
        } catch (error) {
            duplicateOrForeignKey(error, "Username sudah digunakan.", "Data user tidak valid.");
        }
    }
    if (method === "DELETE" && id !== null) {
        try {
            const result = await statement(env.DB, "DELETE FROM users WHERE id = ?", id).run();
            if (!result.meta.changes) notFound("User tidak ditemukan.");
            return json({ status: "Success", message: "User berhasil dihapus." });
        } catch (error) {
            if (error instanceof HttpError) throw error;
            if (/FOREIGN KEY constraint failed/i.test(String(error?.message))) {
                conflict("User masih terkait dengan data lain dan tidak dapat dihapus.");
            }
            throw error;
        }
    }
    throw new HttpError(404, "Endpoint tidak ditemukan.");
}

const masterConfig = {
    barang: {
        table: "masterbarang",
        key: "KodeBarang",
        id: "KodeBarang",
        select: "masterbarang.KodeBarang AS id, masterbarang.KodeBarang AS kode_barang, masterbarang.NamaBarang AS nama_barang, masterbarang.Satuan AS satuan, masterbarang.SatuanHarga AS satuan_harga, masterbarang.SatuanHarga AS harga, masterbarang.SatuanHarga AS harga_jual, COALESCE(inventory.StokCurrent, 0) AS stok",
        join: "LEFT JOIN inventorystock inventory ON inventory.KodeBarang = masterbarang.KodeBarang",
        fields: {
            kode_barang: { column: "KodeBarang", required: true, max: 50 },
            nama_barang: { column: "NamaBarang", required: true, max: 100 },
            satuan: { column: "Satuan", required: true, max: 20 },
            satuan_harga: { column: "SatuanHarga", required: true, numeric: true }
        }
    },
    supplier: {
        table: "mastersupplier",
        key: "KodeSupplier",
        id: "KodeSupplier",
        select: "KodeSupplier AS id, KodeSupplier AS kode_supplier, NamaSupplier AS nama_supplier, NoTelephone AS no_telp, Alamat AS alamat",
        fields: {
            kode_supplier: { column: "KodeSupplier", required: true, max: 50 },
            nama_supplier: { column: "NamaSupplier", required: true, max: 100 },
            no_telp: { column: "NoTelephone", max: 20 },
            alamat: { column: "Alamat" }
        }
    },
    pelanggan: {
        table: "masterpelanggan",
        key: "KodePelanggan",
        id: "KodePelanggan",
        select: "KodePelanggan AS id, KodePelanggan AS kode_pelanggan, NamaPelanggan AS nama_pelanggan, Alamat AS alamat",
        fields: {
            kode_pelanggan: { column: "KodePelanggan", required: true, max: 50 },
            nama_pelanggan: { column: "NamaPelanggan", required: true, max: 100 },
            alamat: { column: "Alamat" }
        }
    }
};

function validateMaster(config, body, isCreate) {
    if (!body || typeof body !== "object" || Array.isArray(body)) badRequest("Data tidak valid.");
    const values = [];
    const columns = [];
    for (const [field, options] of Object.entries(config.fields)) {
        if (!isCreate && field === Object.keys(config.fields)[0]) continue;
        const value = body[field];
        if (value == null || value === "") {
            if (options.required) badRequest(`${field} wajib diisi.`);
            columns.push(options.column);
            values.push(null);
            continue;
        }
        if (options.numeric) {
            const number = Number(value);
            if (!Number.isFinite(number) || number < 0 || number > 9999999999.99) {
                badRequest("Harga satuan harus berupa angka nol atau lebih.");
            }
            columns.push(options.column);
            values.push(number);
            continue;
        }
        if (typeof value !== "string") badRequest(`${field} tidak valid.`);
        const text = value.trim();
        if (!text && options.required) badRequest(`${field} wajib diisi.`);
        if (options.max && text.length > options.max) badRequest(`${field} maksimal ${options.max} karakter.`);
        columns.push(options.column);
        values.push(text || null);
    }
    return { columns, values };
}

async function masterRoute(request, env, segments, user, entity) {
    const config = masterConfig[entity];
    if (!config) throw new HttpError(404, "Endpoint tidak ditemukan.");
    const method = request.method;
    const id = segments[1] ? decodeParam(segments[1]) : null;
    const baseTable = config.table === "masterbarang" ? "masterbarang" : config.table;

    if (method === "GET" && id === null) {
        const rows = await all(
            env.DB,
            `SELECT ${config.select} FROM ${baseTable} ${config.join || ""} ORDER BY ${config.table === "masterbarang" ? "masterbarang" : config.table}.${config.key}`
        );
        return success(rows);
    }
    if (method === "GET" && id !== null) {
        const row = await first(
            env.DB,
            `SELECT ${config.select} FROM ${baseTable} ${config.join || ""} WHERE ${config.table}.${config.key} = ?`,
            id
        );
        if (!row) notFound(`${entity} tidak ditemukan.`);
        return success(row);
    }
    if (["POST", "PUT", "DELETE"].includes(method)) {
        requireRole(user, "admin", "Hanya admin yang dapat mengelola master data.");
    }
    if (method === "POST" && id === null) {
        const { columns, values } = validateMaster(config, await readJson(request), true);
        try {
            await statement(
                env.DB,
                `INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
                ...values
            ).run();
            const created = await first(
                env.DB,
                `SELECT ${config.select} FROM ${baseTable} ${config.join || ""} WHERE ${config.table}.${config.key} = ?`,
                values[0]
            );
            return success(created, 201);
        } catch (error) {
            duplicateOrForeignKey(error, `Kode ${entity} sudah digunakan.`, "Data tidak valid.");
        }
    }
    if (method === "PUT" && id !== null) {
        const { columns, values } = validateMaster(config, await readJson(request), false);
        const existing = await first(env.DB, `SELECT 1 AS found FROM ${config.table} WHERE ${config.key} = ?`, id);
        if (!existing) notFound(`${entity} tidak ditemukan.`);
        try {
            if (columns.length) {
                await statement(
                    env.DB,
                    `UPDATE ${config.table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE ${config.key} = ?`,
                    ...values, id
                ).run();
            }
            return success(await first(
                env.DB,
                `SELECT ${config.select} FROM ${baseTable} ${config.join || ""} WHERE ${config.table}.${config.key} = ?`,
                id
            ));
        } catch (error) {
            duplicateOrForeignKey(error, `Kode ${entity} sudah digunakan.`, "Data tidak valid.");
        }
    }
    if (method === "DELETE" && id !== null) {
        try {
            const result = await statement(env.DB, `DELETE FROM ${config.table} WHERE ${config.key} = ?`, id).run();
            if (!result.meta.changes) notFound(`${entity} tidak ditemukan.`);
            return json({ status: "Success", message: `${entity} berhasil dihapus.` });
        } catch (error) {
            if (error instanceof HttpError) throw error;
            if (/FOREIGN KEY constraint failed/i.test(String(error?.message))) {
                conflict(`${entity} masih dipakai transaksi sehingga tidak dapat dihapus.`);
            }
            throw error;
        }
    }
    throw new HttpError(404, "Endpoint tidak ditemukan.");
}

async function getUnallocatedSales(db) {
    return all(
        db,
        `SELECT detail.KodeBarang AS kode_barang, barang.NamaBarang AS nama_barang,
                SUM(detail.Qty) AS qty, COUNT(DISTINCT detail.NoPenjualan) AS jumlah_penjualan
         FROM detailpenjualan detail
         JOIN penjualan sale ON sale.NoPenjualan = detail.NoPenjualan
         JOIN masterbarang barang ON barang.KodeBarang = detail.KodeBarang
         WHERE detail.NoStokIn IS NULL AND sale.Status = 'Confirmed'
         GROUP BY detail.KodeBarang, barang.NamaBarang
         ORDER BY barang.NamaBarang, detail.KodeBarang`
    );
}

async function searchInventory(db, filter, value) {
    if (filter === "semua" || filter === "no_stok_in") {
        const filterClause = filter === "no_stok_in" ? "AND source.NoStokIn = ?" : "";
        return all(
            db,
            `SELECT source.NoStokIn AS no_stok_in, stockin.Tanggal AS tanggal,
                    source.KodeBarang AS kode_barang, barang.NamaBarang AS nama_barang,
                    barang.Satuan AS satuan, source.qty_masuk,
                    COALESCE(sold.qty_keluar, 0) AS qty_keluar,
                    source.qty_masuk - COALESCE(sold.qty_keluar, 0) AS stok
             FROM (
                 SELECT NoStokIn, KodeBarang, SUM(Qty) AS qty_masuk
                 FROM detailstokin GROUP BY NoStokIn, KodeBarang
             ) source
             JOIN stokin stockin ON stockin.NoStokIn = source.NoStokIn
             JOIN masterbarang barang ON barang.KodeBarang = source.KodeBarang
             LEFT JOIN (
                 SELECT detail.NoStokIn, detail.KodeBarang, SUM(detail.Qty) AS qty_keluar
                 FROM detailpenjualan detail
                 JOIN penjualan sale ON sale.NoPenjualan = detail.NoPenjualan
                 WHERE detail.NoStokIn IS NOT NULL AND sale.Status = 'Confirmed'
                 GROUP BY detail.NoStokIn, detail.KodeBarang
             ) sold ON sold.NoStokIn = source.NoStokIn AND sold.KodeBarang = source.KodeBarang
             WHERE stockin.Status = 'Confirmed' ${filterClause}
             ORDER BY stockin.Tanggal DESC, source.NoStokIn DESC, barang.NamaBarang, barang.KodeBarang`,
            ...(filterClause ? [value] : [])
        );
    }
    const where = filter === "no_penjualan"
        ? `barang.KodeBarang IN (
               SELECT detail.KodeBarang FROM detailpenjualan detail WHERE detail.NoPenjualan = ?
           )`
        : "barang.NamaBarang = ?";
    return all(
        db,
        `SELECT barang.KodeBarang AS kode_barang, barang.NamaBarang AS nama_barang,
                barang.Satuan AS satuan, NULL AS no_stok_in,
                COALESCE(inventory.StokCurrent, 0) AS stok
         FROM masterbarang barang
         LEFT JOIN inventorystock inventory ON inventory.KodeBarang = barang.KodeBarang
         WHERE ${where}
         ORDER BY barang.NamaBarang, barang.KodeBarang`,
        value
    );
}

async function inventoryRoute(request, env) {
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter");
    const value = url.searchParams.get("value");
    if (!["semua", "no_stok_in", "no_penjualan", "nama_barang"].includes(filter)) {
        badRequest("Pilih semua stok, No. Stok In, No. Penjualan, atau Nama Barang.");
    }
    if (filter !== "semua" && !value?.trim()) badRequest("Masukkan kata kunci pencarian inventory.");
    if (value && value.trim().length > 100) badRequest("Kata kunci maksimal 100 karakter.");
    const data = await searchInventory(env.DB, filter, value?.trim() || "");
    const unallocated = filter === "semua" || filter === "no_stok_in"
        ? await getUnallocatedSales(env.DB)
        : [];
    return json({ status: "Success", data, unallocated });
}

function validateItems(items, { stockIn = false } = {}) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
        badRequest("Tambahkan minimal satu barang (maksimal 100 baris).");
    }
    const normalized = [];
    for (const item of items) {
        const code = requiredText(item?.kode_barang, "Kode barang");
        const qty = Number(item?.qty);
        if (!Number.isSafeInteger(qty) || qty < 1) badRequest("Qty barang harus bilangan bulat minimal 1.");
        if (stockIn) {
            const price = Number(item?.satuan_harga);
            if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) {
                badRequest("Harga satuan harus berupa angka nol atau lebih.");
            }
            if (Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
                badRequest("Harga satuan maksimal dua angka di belakang koma.");
            }
            normalized.push({ kode_barang: code, qty, satuan_harga: price });
        } else {
            normalized.push({
                kode_barang: code,
                no_stok_in: requiredText(item?.no_stok_in, "Nomor stok in"),
                qty
            });
        }
    }
    const totalCents = normalized.reduce(
        (sum, item) => sum + item.qty * Math.round((item.satuan_harga || 0) * 100),
        0
    );
    if (!Number.isSafeInteger(totalCents) || totalCents > 999999999999) {
        badRequest("Grand total melebihi batas maksimum transaksi.");
    }
    return normalized;
}

function quantitiesBy(items, keyFn) {
    const totals = new Map();
    for (const item of items) {
        const key = keyFn(item);
        totals.set(key, (totals.get(key) || 0) + item.qty);
    }
    return totals;
}

async function getProductStates(db, codes) {
    const products = new Map();
    for (const code of [...new Set(codes)].sort()) {
        const product = await first(
            db,
            `SELECT barang.KodeBarang AS kode_barang, barang.NamaBarang AS nama_barang,
                    barang.SatuanHarga AS satuan_harga, inventory.KodeBarang AS stock_row,
                    COALESCE(inventory.StokCurrent, 0) AS stok
             FROM masterbarang barang
             LEFT JOIN inventorystock inventory ON inventory.KodeBarang = barang.KodeBarang
             WHERE barang.KodeBarang = ?`,
            code
        );
        if (!product) conflict(`Barang ${code} tidak ditemukan.`);
        products.set(code, {
            ...product,
            has_stock: product.stock_row != null,
            stok: Number(product.stok),
            satuan_harga: Number(product.satuan_harga)
        });
    }
    return products;
}

function inventoryStatements(db, quantities, products, direction, transactionType, reference, reason) {
    const stockRows = [];
    const logRows = [];
    for (const [code, qty] of [...quantities].sort(([a], [b]) => a.localeCompare(b))) {
        const product = products.get(code);
        const closing = product.stok + direction * qty;
        if (closing < 0) conflict(`Stok ${product.nama_barang} tidak cukup.`);
        stockRows.push([code, closing]);
        logRows.push([
            code, transactionType, reference,
            direction > 0 ? qty : 0, direction < 0 ? qty : 0,
            product.stok, closing, reason
        ]);
        product.stok = closing;
    }
    const statements = [];
    const stocks = insertMany(
        db,
        "INSERT INTO inventorystock (KodeBarang, StokCurrent)",
        stockRows,
        ` ON CONFLICT(KodeBarang) DO UPDATE SET
              StokCurrent = excluded.StokCurrent,
              LastUpdated = CURRENT_TIMESTAMP`
    );
    if (stocks) statements.push(stocks);
    const logs = insertMany(
        db,
        `INSERT INTO inventorylog
         (KodeBarang, JenisTransaksi, NoReferensi, QtyMasuk, QtyKeluar, StokAwal, StokAkhir, Keterangan)`,
        logRows
    );
    if (logs) statements.push(logs);
    return statements;
}

async function batchAvailability(db, batchNo, code, excludeSale = null) {
    const row = await first(
        db,
        `SELECT COALESCE(SUM(source.Qty), 0) - COALESCE((
             SELECT SUM(sold.Qty)
             FROM detailpenjualan sold
             JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
             WHERE sold.NoStokIn = source.NoStokIn
               AND sold.KodeBarang = source.KodeBarang
               AND sale.Status = 'Confirmed'
               AND (? IS NULL OR sold.NoPenjualan <> ?)
         ), 0) AS available
         FROM detailstokin source
         WHERE source.NoStokIn = ? AND source.KodeBarang = ?
         GROUP BY source.NoStokIn, source.KodeBarang`,
        excludeSale, excludeSale, batchNo, code
    );
    return Number(row?.available || 0);
}

async function salesRoute(request, env, segments) {
    const method = request.method;
    const noPenjualan = segments[1] ? decodeParam(segments[1]) : null;
    const isStatus = segments[2] === "status";
    if (method === "GET" && noPenjualan === null) {
        return success(await all(
            env.DB,
            "SELECT NoPenjualan AS no_penjualan, Tanggal AS tanggal, Status AS status FROM penjualan ORDER BY Tanggal DESC, NoPenjualan DESC"
        ));
    }
    if (method === "GET" && noPenjualan !== null && !isStatus) {
        const header = await first(
            env.DB,
            `SELECT p.NoPenjualan AS no_penjualan, p.Tanggal AS tanggal, p.Status AS status,
                    p.KodePelanggan AS kode_pelanggan, pelanggan.NamaPelanggan AS nama_pelanggan,
                    p.GrandTotal AS grand_total
             FROM penjualan p
             LEFT JOIN masterpelanggan pelanggan ON pelanggan.KodePelanggan = p.KodePelanggan
             WHERE p.NoPenjualan = ?`,
            noPenjualan
        );
        if (!header) notFound("Penjualan tidak ditemukan.");
        const details = await all(
            env.DB,
            `SELECT d.KodeBarang AS kode_barang, d.NoStokIn AS no_stok_in,
                    barang.NamaBarang AS nama_barang, barang.Satuan AS satuan,
                    d.Qty AS qty, d.SatuanHarga AS satuan_harga, d.Subtotal AS subtotal
             FROM detailpenjualan d
             LEFT JOIN masterbarang barang ON barang.KodeBarang = d.KodeBarang
             WHERE d.NoPenjualan = ? ORDER BY d.IDDetail`,
            noPenjualan
        );
        return success({ ...header, details });
    }
    if (method === "POST" && noPenjualan === null) {
        const body = await readJson(request);
        const saleNo = requiredText(body.no_penjualan, "Nomor penjualan");
        const date = validateDate(body.tanggal, "Tanggal penjualan");
        if (body.kode_pelanggan != null &&
            (typeof body.kode_pelanggan !== "string" || body.kode_pelanggan.length > 50)) {
            badRequest("Pelanggan tidak valid.");
        }
        const items = validateItems(body.items);
        await getConfirmedBatches(env.DB, items, date);
        const products = await getProductStates(env.DB, items.map((item) => item.kode_barang));
        const batchTotals = quantitiesBy(items, (item) => `${item.no_stok_in}\u0000${item.kode_barang}`);
        for (const [key, qty] of batchTotals) {
            const [batchNo, code] = key.split("\u0000");
            if ((await batchAvailability(env.DB, batchNo, code)) < qty) {
                conflict(`Stok barang ${code} pada stok in ${batchNo} tidak cukup.`);
            }
        }
        const { normalizedItems, grandTotal } = priceSaleItems(items, products);
        const writes = [statement(
            env.DB,
            `INSERT INTO penjualan (NoPenjualan, Tanggal, KodePelanggan, GrandTotal, Status, is_synced)
             VALUES (?, ?, ?, ?, 'Pending', 0)`,
            saleNo, date, body.kode_pelanggan?.trim() || null, grandTotal
        )];
        const details = insertMany(
            env.DB,
            `INSERT INTO detailpenjualan
             (NoPenjualan, KodeBarang, NoStokIn, Qty, SatuanHarga, Subtotal)`,
            normalizedItems.map((item) => [
                saleNo, item.kode_barang, item.no_stok_in, item.qty, item.satuan_harga, item.subtotal
            ])
        );
        if (details) writes.push(details);
        try {
            await batch(env.DB, writes);
        } catch (error) {
            duplicateOrForeignKey(error, "Nomor penjualan sudah digunakan.", "Pelanggan atau barang tidak ditemukan.");
        }
        return success({ no_penjualan: saleNo, grand_total: grandTotal, status: "Pending" }, 201);
    }
    if (method === "PUT" && noPenjualan !== null && !isStatus) {
        const saleNo = requiredText(noPenjualan, "Nomor penjualan");
        const body = await readJson(request);
        const date = validateDate(body.tanggal, "Tanggal penjualan");
        if (body.kode_pelanggan != null &&
            (typeof body.kode_pelanggan !== "string" || body.kode_pelanggan.length > 50)) {
            badRequest("Pelanggan tidak valid.");
        }
        const items = validateItems(body.items);
        const existing = await first(env.DB, "SELECT Status FROM penjualan WHERE NoPenjualan = ?", saleNo);
        if (!existing) notFound("Penjualan tidak ditemukan.");
        if (existing.Status !== "Pending") conflict("Ubah status penjualan menjadi Pending sebelum mengedit.");
        await getConfirmedBatches(env.DB, items, date);
        const products = await getProductStates(env.DB, items.map((item) => item.kode_barang));
        const batchTotals = quantitiesBy(items, (item) => `${item.no_stok_in}\u0000${item.kode_barang}`);
        for (const [key, qty] of batchTotals) {
            const [batchNo, code] = key.split("\u0000");
            if ((await batchAvailability(env.DB, batchNo, code, saleNo)) < qty) {
                conflict(`Stok barang ${code} pada stok in ${batchNo} tidak cukup.`);
            }
        }
        const { normalizedItems, grandTotal } = priceSaleItems(items, products);
        const writes = [
            statement(
                env.DB,
                "UPDATE penjualan SET Tanggal = ?, KodePelanggan = ?, GrandTotal = ?, Status = 'Pending', is_synced = 0 WHERE NoPenjualan = ?",
                date, body.kode_pelanggan?.trim() || null, grandTotal, saleNo
            ),
            statement(env.DB, "DELETE FROM detailpenjualan WHERE NoPenjualan = ?", saleNo)
        ];
        const details = insertMany(
            env.DB,
            `INSERT INTO detailpenjualan
             (NoPenjualan, KodeBarang, NoStokIn, Qty, SatuanHarga, Subtotal)`,
            normalizedItems.map((item) => [
                saleNo, item.kode_barang, item.no_stok_in, item.qty, item.satuan_harga, item.subtotal
            ])
        );
        if (details) writes.push(details);
        try {
            await batch(env.DB, writes);
        } catch (error) {
            duplicateOrForeignKey(error, "Nomor penjualan sudah digunakan.", "Pelanggan atau barang tidak ditemukan.");
        }
        return success({ no_penjualan: saleNo, grand_total: grandTotal, status: "Pending" });
    }
    if (method === "PATCH" && noPenjualan !== null && isStatus) {
        return setSaleStatus(request, env, requiredText(noPenjualan, "Nomor penjualan"));
    }
    if (method === "DELETE" && noPenjualan !== null) {
        const saleNo = requiredText(noPenjualan, "Nomor penjualan");
        const sale = await first(env.DB, "SELECT Status FROM penjualan WHERE NoPenjualan = ?", saleNo);
        if (!sale) notFound("Penjualan tidak ditemukan.");
        const rows = await all(
            env.DB,
            "SELECT KodeBarang AS kode_barang, SUM(Qty) AS qty FROM detailpenjualan WHERE NoPenjualan = ? GROUP BY KodeBarang",
            saleNo
        );
        const quantities = new Map(rows.map((item) => [item.kode_barang, Number(item.qty)]));
        const products = sale.Status === "Confirmed"
            ? await getProductStates(env.DB, quantities.keys())
            : new Map();
        const writes = sale.Status === "Confirmed"
            ? inventoryStatements(env.DB, quantities, products, 1, "penjualan", saleNo, `Penghapusan Penjualan ${saleNo}`)
            : [];
        writes.push(
            statement(env.DB, "DELETE FROM detailpenjualan WHERE NoPenjualan = ?", saleNo),
            statement(env.DB, "DELETE FROM penjualan WHERE NoPenjualan = ?", saleNo)
        );
        await batch(env.DB, writes);
        return success({ no_penjualan: saleNo });
    }
    throw new HttpError(404, "Endpoint tidak ditemukan.");
}

async function getConfirmedBatches(db, items, saleDate) {
    const batches = new Map();
    for (const batchNo of new Set(items.map((item) => item.no_stok_in))) {
        const row = await first(
            db,
            "SELECT NoStokIn, Status AS status, Tanggal AS tanggal FROM stokin WHERE NoStokIn = ?",
            batchNo
        );
        if (!row) badRequest(`Nomor stok in ${batchNo} tidak ditemukan.`);
        if (row.status !== "Confirmed") conflict(`Stok in ${batchNo} belum dikonfirmasi.`);
        if (saleDate < row.tanggal) badRequest(`Tanggal penjualan tidak boleh lebih awal dari stok in ${batchNo}.`);
        batches.set(batchNo, row);
    }
    return batches;
}

function priceSaleItems(items, products) {
    let totalCents = 0;
    const normalizedItems = items.map((item) => {
        const product = products.get(item.kode_barang);
        const priceCents = Math.round(product.satuan_harga * 100);
        const subtotalCents = item.qty * priceCents;
        totalCents += subtotalCents;
        return {
            ...item,
            satuan_harga: priceCents / 100,
            subtotal: subtotalCents / 100
        };
    });
    if (!Number.isSafeInteger(totalCents) || totalCents > 999999999999) {
        badRequest("Grand total melebihi batas maksimum transaksi.");
    }
    return { normalizedItems, grandTotal: totalCents / 100 };
}

async function setSaleStatus(request, env, saleNo) {
    const body = await readJson(request);
    if (!["Pending", "Confirmed"].includes(body.status)) badRequest("Status penjualan tidak valid.");
    const sale = await first(
        env.DB,
        "SELECT Status AS status, Tanggal AS tanggal FROM penjualan WHERE NoPenjualan = ?",
        saleNo
    );
    if (!sale) notFound("Penjualan tidak ditemukan.");
    if (sale.status === body.status) return success({ no_penjualan: saleNo, status: body.status });
    const items = await all(
        env.DB,
        "SELECT KodeBarang AS kode_barang, NoStokIn AS no_stok_in, Qty AS qty FROM detailpenjualan WHERE NoPenjualan = ? ORDER BY IDDetail",
        saleNo
    );
    if (!items.length) conflict("Tambahkan minimal satu barang sebelum mengonfirmasi penjualan.");
    const normalizedItems = items.map((item) => ({ ...item, qty: Number(item.qty) }));
    const quantities = quantitiesBy(normalizedItems, (item) => item.kode_barang);
    const products = await getProductStates(env.DB, quantities.keys());
    let direction;
    let reason;
    if (body.status === "Pending") {
        direction = 1;
        reason = `Penjualan ${saleNo} dikembalikan ke Pending`;
    } else {
        const batchNos = [...new Set(normalizedItems.map((item) => item.no_stok_in))];
        for (const batchNo of batchNos) {
            const stockIn = await first(
                env.DB,
                "SELECT Status AS status, Tanggal AS tanggal FROM stokin WHERE NoStokIn = ?",
                batchNo
            );
            if (!stockIn || stockIn.status !== "Confirmed") conflict(`Stok in ${batchNo} belum dikonfirmasi.`);
            if (sale.tanggal < stockIn.tanggal) {
                conflict(`Tanggal penjualan tidak boleh lebih awal dari stok in ${batchNo}.`);
            }
        }
        const byBatch = quantitiesBy(
            normalizedItems,
            (item) => `${item.no_stok_in}\u0000${item.kode_barang}`
        );
        for (const [key, qty] of byBatch) {
            const [batchNo, code] = key.split("\u0000");
            const available = await batchAvailability(env.DB, batchNo, code, saleNo);
            if (available < qty) conflict(`Stok barang ${code} pada stok in ${batchNo} tidak cukup. Tersedia ${available}.`);
        }
        for (const [code, qty] of quantities) {
            if (products.get(code).stok < qty) {
                conflict(`Stok ${products.get(code).nama_barang} tidak cukup. Tersedia ${products.get(code).stok}.`);
            }
        }
        direction = -1;
        reason = `Konfirmasi Penjualan ${saleNo}`;
    }
    const writes = inventoryStatements(env.DB, quantities, products, direction, "penjualan", saleNo, reason);
    writes.push(statement(
        env.DB,
        "UPDATE penjualan SET Status = ?, is_synced = 0 WHERE NoPenjualan = ?",
        body.status, saleNo
    ));
    await batch(env.DB, writes);
    return success({ no_penjualan: saleNo, status: body.status });
}

async function stockInRoute(request, env, segments) {
    const method = request.method;
    const stockNo = segments[1] === "available" ? null : segments[1] ? decodeParam(segments[1]) : null;
    if (method === "GET" && stockNo === null && segments[1] === undefined) {
        return success(await listStockIn(env.DB));
    }
    if (method === "GET" && segments[1] === "available" && segments[2]) {
        const code = decodeParam(segments[2]);
        if (!code.trim() || code.length > 50) badRequest("Kode barang tidak valid.");
        const exclude = new URL(request.url).searchParams.get("exclude_sale");
        if (exclude !== null && (!exclude.trim() || exclude.length > 50)) badRequest("Nomor penjualan tidak valid.");
        return success(await all(
            env.DB,
            `SELECT s.NoStokIn AS no_stok_in, s.Tanggal AS tanggal,
                    source.KodeBarang AS kode_barang,
                    source.qty - COALESCE(sold.qty, 0) AS available
             FROM stokin s
             JOIN (
                 SELECT NoStokIn, KodeBarang, SUM(Qty) AS qty
                 FROM detailstokin WHERE KodeBarang = ? GROUP BY NoStokIn, KodeBarang
             ) source ON source.NoStokIn = s.NoStokIn
             LEFT JOIN (
                 SELECT NoStokIn, KodeBarang, SUM(Qty) AS qty
                 FROM detailpenjualan
                 WHERE NoStokIn IS NOT NULL
                   AND NoPenjualan IN (SELECT NoPenjualan FROM penjualan WHERE Status = 'Confirmed')
                   AND (? IS NULL OR NoPenjualan <> ?)
                 GROUP BY NoStokIn, KodeBarang
             ) sold ON sold.NoStokIn = source.NoStokIn AND sold.KodeBarang = source.KodeBarang
             WHERE source.KodeBarang = ? AND s.Status = 'Confirmed'
               AND source.qty - COALESCE(sold.qty, 0) > 0
             ORDER BY s.Tanggal, s.NoStokIn`,
            code, exclude, exclude, code
        ));
    }
    if (method === "GET" && stockNo !== null && segments.length === 2) {
        const result = await stockInDetail(env.DB, stockNo);
        if (!result) notFound("Stok in tidak ditemukan.");
        return success(result);
    }
    if (method === "POST" && stockNo === null) return createStockIn(request, env);
    if (method === "PUT" && stockNo !== null) return updateStockIn(request, env, stockNo);
    if (method === "DELETE" && stockNo !== null) return deleteStockIn(env.DB, stockNo);
    if (method === "PATCH" && stockNo !== null && segments[2] === "status") {
        return setStockInStatus(request, env, stockNo);
    }
    throw new HttpError(404, "Endpoint tidak ditemukan.");
}

async function listStockIn(db) {
    return all(
        db,
        `SELECT s.NoStokIn AS no_stok_in, s.Tanggal AS tanggal, s.Status AS status,
             CASE WHEN EXISTS (
                 SELECT 1 FROM detailpenjualan sold WHERE sold.NoStokIn = s.NoStokIn
             ) OR EXISTS (
                 SELECT 1
                 FROM detailstokin source
                 JOIN detailpenjualan sold ON sold.KodeBarang = source.KodeBarang AND sold.NoStokIn IS NULL
                 JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                 WHERE source.NoStokIn = s.NoStokIn AND sale.Tanggal >= s.Tanggal
             ) THEN 0 ELSE 1 END AS can_edit,
             CASE WHEN EXISTS (
                 SELECT 1 FROM detailpenjualan sold
                 JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                 WHERE sold.NoStokIn = s.NoStokIn AND sale.Status = 'Confirmed'
             ) OR EXISTS (
                 SELECT 1
                 FROM detailstokin source
                 JOIN detailpenjualan sold ON sold.KodeBarang = source.KodeBarang AND sold.NoStokIn IS NULL
                 JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                 WHERE source.NoStokIn = s.NoStokIn
                   AND sale.Status = 'Confirmed' AND sale.Tanggal >= s.Tanggal
             ) THEN 0 ELSE 1 END AS can_revert
         FROM stokin s ORDER BY s.Tanggal DESC, s.NoStokIn DESC`
    );
}

async function stockInDetail(db, stockNo) {
    const header = await first(
        db,
        `SELECT s.NoStokIn AS no_stok_in, s.Tanggal AS tanggal,
                s.KodeSupplier AS kode_supplier, supplier.NamaSupplier AS nama_supplier,
                s.GrandTotal AS grand_total, s.Status AS status,
                CASE WHEN EXISTS (
                    SELECT 1 FROM detailpenjualan sold WHERE sold.NoStokIn = s.NoStokIn
                ) OR EXISTS (
                    SELECT 1
                    FROM detailstokin source
                    JOIN detailpenjualan sold ON sold.KodeBarang = source.KodeBarang AND sold.NoStokIn IS NULL
                    JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                    WHERE source.NoStokIn = s.NoStokIn AND sale.Tanggal >= s.Tanggal
                ) THEN 0 ELSE 1 END AS can_edit,
                CASE WHEN EXISTS (
                    SELECT 1 FROM detailpenjualan sold
                    JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                    WHERE sold.NoStokIn = s.NoStokIn AND sale.Status = 'Confirmed'
                ) OR EXISTS (
                    SELECT 1
                    FROM detailstokin source
                    JOIN detailpenjualan sold ON sold.KodeBarang = source.KodeBarang AND sold.NoStokIn IS NULL
                    JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
                    WHERE source.NoStokIn = s.NoStokIn
                      AND sale.Status = 'Confirmed' AND sale.Tanggal >= s.Tanggal
                ) THEN 0 ELSE 1 END AS can_revert
         FROM stokin s
         LEFT JOIN mastersupplier supplier ON supplier.KodeSupplier = s.KodeSupplier
         WHERE s.NoStokIn = ?`,
        stockNo
    );
    if (!header) return null;
    const details = await all(
        db,
        `SELECT d.KodeBarang AS kode_barang, barang.NamaBarang AS nama_barang,
                barang.Satuan AS satuan, d.Qty AS qty,
                d.SatuanHarga AS satuan_harga, d.Subtotal AS subtotal
         FROM detailstokin d
         LEFT JOIN masterbarang barang ON barang.KodeBarang = d.KodeBarang
         WHERE d.NoStokIn = ? ORDER BY d.IDDetail`,
        stockNo
    );
    return { ...header, details };
}

function stockHeader(body) {
    const date = validateDate(body.tanggal, "Tanggal stok in");
    if (body.kode_supplier != null &&
        (typeof body.kode_supplier !== "string" || body.kode_supplier.length > 50)) {
        badRequest("Supplier tidak valid.");
    }
    return { date, supplier: body.kode_supplier?.trim() || null };
}

async function createStockIn(request, env) {
    const body = await readJson(request);
    const stockNo = requiredText(body.no_stok_in, "Nomor stok in");
    const { date, supplier } = stockHeader(body);
    const items = validateItems(body.items, { stockIn: true });
    const products = await getProductStates(env.DB, items.map((item) => item.kode_barang));
    const cents = items.reduce((sum, item) => sum + item.qty * Math.round(item.satuan_harga * 100), 0);
    const total = cents / 100;
    const writes = [statement(
        env.DB,
        "INSERT INTO stokin (NoStokIn, Tanggal, KodeSupplier, GrandTotal, Status, is_synced) VALUES (?, ?, ?, ?, 'Pending', 0)",
        stockNo, date, supplier, total
    )];
    const details = insertMany(
        env.DB,
        "INSERT INTO detailstokin (NoStokIn, KodeBarang, Qty, SatuanHarga, Subtotal)",
        items.map((item) => [
            stockNo, item.kode_barang, item.qty, item.satuan_harga,
            item.qty * Math.round(item.satuan_harga * 100) / 100
        ])
    );
    if (details) writes.push(details);
    try {
        await batch(env.DB, writes);
    } catch (error) {
        duplicateOrForeignKey(error, "Nomor stok in sudah digunakan.", "Supplier atau barang tidak ditemukan.");
    }
    return success({ no_stok_in: stockNo, grand_total: total, status: "Pending" }, 201);
}

async function updateStockIn(request, env, stockNo) {
    requiredText(stockNo, "Nomor stok in");
    const body = await readJson(request);
    const { date, supplier } = stockHeader(body);
    const items = validateItems(body.items, { stockIn: true });
    const header = await first(env.DB, "SELECT Status AS status FROM stokin WHERE NoStokIn = ?", stockNo);
    if (!header) notFound("Stok in tidak ditemukan.");
    if (header.status !== "Pending") conflict("Ubah status stok in menjadi Pending sebelum mengedit.");
    await assertNoSales(env.DB, stockNo);
    await getProductStates(env.DB, items.map((item) => item.kode_barang));
    const cents = items.reduce((sum, item) => sum + item.qty * Math.round(item.satuan_harga * 100), 0);
    const total = cents / 100;
    const writes = [
        statement(
            env.DB,
            "UPDATE stokin SET Tanggal = ?, KodeSupplier = ?, GrandTotal = ?, is_synced = 0 WHERE NoStokIn = ?",
            date, supplier, total, stockNo
        ),
        statement(env.DB, "DELETE FROM detailstokin WHERE NoStokIn = ?", stockNo)
    ];
    const details = insertMany(
        env.DB,
        "INSERT INTO detailstokin (NoStokIn, KodeBarang, Qty, SatuanHarga, Subtotal)",
        items.map((item) => [
            stockNo, item.kode_barang, item.qty, item.satuan_harga,
            item.qty * Math.round(item.satuan_harga * 100) / 100
        ])
    );
    if (details) writes.push(details);
    try {
        await batch(env.DB, writes);
    } catch (error) {
        duplicateOrForeignKey(error, "Nomor stok in sudah digunakan.", "Supplier atau barang tidak ditemukan.");
    }
    return success({ no_stok_in: stockNo, grand_total: total, status: "Pending" });
}

async function stockQuantities(db, stockNo) {
    const rows = await all(
        db,
        "SELECT KodeBarang AS kode_barang, SUM(Qty) AS qty FROM detailstokin WHERE NoStokIn = ? GROUP BY KodeBarang",
        stockNo
    );
    return new Map(rows.map((item) => [item.kode_barang, Number(item.qty)]));
}

async function hasSales(db, stockNo, confirmedOnly) {
    const statusFilter = confirmedOnly ? "AND sale.Status = 'Confirmed'" : "";
    const row = await first(
        db,
        `SELECT EXISTS (
             SELECT 1
             FROM detailpenjualan sold
             JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
             WHERE sold.NoStokIn = ? ${statusFilter}
         ) OR EXISTS (
             SELECT 1
             FROM detailstokin source
             JOIN detailpenjualan sold ON sold.KodeBarang = source.KodeBarang AND sold.NoStokIn IS NULL
             JOIN penjualan sale ON sale.NoPenjualan = sold.NoPenjualan
             JOIN stokin stockin ON stockin.NoStokIn = source.NoStokIn
             WHERE source.NoStokIn = ? AND sale.Tanggal >= stockin.Tanggal ${statusFilter}
         ) AS has_sales`,
        stockNo, stockNo
    );
    return Boolean(row?.has_sales);
}

async function assertNoSales(db, stockNo, confirmedOnly = false) {
    if (await hasSales(db, stockNo, confirmedOnly)) {
        conflict(confirmedOnly
            ? "Stok in tidak bisa diubah atau dihapus karena sudah ada penjualan."
            : "Stok in tidak bisa diubah atau dihapus karena dipakai dalam penjualan.");
    }
}

async function deleteStockIn(db, stockNo) {
    const header = await first(db, "SELECT Status AS status FROM stokin WHERE NoStokIn = ?", stockNo);
    if (!header) notFound("Stok in tidak ditemukan.");
    await assertNoSales(db, stockNo);
    const writes = [];
    if (header.status === "Confirmed") {
        const quantities = await stockQuantities(db, stockNo);
        const products = await getProductStates(db, quantities.keys());
        writes.push(...inventoryStatements(
            db, quantities, products, -1, "Stokin", stockNo, `Penghapusan Stok In ${stockNo}`
        ));
    }
    writes.push(
        statement(db, "DELETE FROM detailstokin WHERE NoStokIn = ?", stockNo),
        statement(db, "DELETE FROM stokin WHERE NoStokIn = ?", stockNo)
    );
    await batch(db, writes);
    return success({ no_stok_in: stockNo });
}

async function setStockInStatus(request, env, stockNo) {
    const body = await readJson(request);
    if (!["Pending", "Confirmed"].includes(body.status)) badRequest("Status stok in tidak valid.");
    const header = await first(env.DB, "SELECT Status AS status FROM stokin WHERE NoStokIn = ?", stockNo);
    if (!header) notFound("Stok in tidak ditemukan.");
    if (header.status === body.status) return success({ no_stok_in: stockNo, status: body.status });
    const quantities = await stockQuantities(env.DB, stockNo);
    const products = await getProductStates(env.DB, quantities.keys());
    let direction;
    let reason;
    if (body.status === "Pending") {
        await assertNoSales(env.DB, stockNo, true);
        direction = -1;
        reason = `Stok In ${stockNo} dikembalikan ke Pending`;
    } else {
        direction = 1;
        reason = `Konfirmasi Stok In ${stockNo}`;
    }
    const writes = inventoryStatements(env.DB, quantities, products, direction, "Stokin", stockNo, reason);
    writes.push(statement(
        env.DB,
        "UPDATE stokin SET Status = ?, is_synced = 0 WHERE NoStokIn = ?",
        body.status, stockNo
    ));
    await batch(env.DB, writes);
    return success({ no_stok_in: stockNo, status: body.status });
}

async function handleApi(request, env) {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean).slice(1);
    const resource = segments[0];
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": url.origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type"
            }
        });
    }
    if (resource === "health" && request.method === "GET") {
        await first(env.DB, "SELECT 1 AS ok");
        return json({ status: "ok", database: "connected" });
    }
    if (resource === "login" && request.method === "POST") return login(request, env);
    const user = await authenticate(request, env);
    if (resource === "users") return usersRoute(request, env, segments, user);
    if (["barang", "supplier", "pelanggan"].includes(resource)) {
        return masterRoute(request, env, segments, user, resource);
    }
    if (resource === "inventory" && request.method === "GET") return inventoryRoute(request, env);
    if (resource === "penjualan") return salesRoute(request, env, segments);
    if (resource === "stokin") return stockInRoute(request, env, segments);
    throw new HttpError(404, "Endpoint tidak ditemukan.");
}

export async function dispatchApi(request, env) {
    try {
        return await handleApi(request, env);
    } catch (error) {
        if (error instanceof HttpError) return json({ error: error.message }, error.status);
        console.error("API request failed:", error);
        const message = String(error?.message || "");
        if (/UNIQUE constraint failed|PRIMARY KEY/i.test(message)) {
            return json({ error: "Data dengan kode yang sama sudah digunakan." }, 409);
        }
        if (/FOREIGN KEY constraint failed/i.test(message)) {
            return json({ error: "Data terkait tidak ditemukan atau masih digunakan." }, 409);
        }
        return json({ error: "Terjadi kesalahan pada server." }, 500);
    }
}
