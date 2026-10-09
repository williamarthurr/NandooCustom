import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { dispatchApi } from "./api.mjs";
import { ApiCoordinator } from "./index.mjs";

class SqliteStatement {
    constructor(db, sql, values = []) {
        this.database = db;
        this.sql = sql;
        this.values = values;
    }

    bind(...values) {
        return new SqliteStatement(this.database, this.sql, values);
    }

    async first() {
        return this.database.prepare(this.sql).get(...this.values) ?? null;
    }

    async all() {
        return { results: this.database.prepare(this.sql).all(...this.values) };
    }

    async run() {
        const result = this.database.prepare(this.sql).run(...this.values);
        return {
            success: true,
            meta: {
                changes: Number(result.changes),
                last_row_id: Number(result.lastInsertRowid)
            }
        };
    }
}

class SqliteD1 {
    constructor(database) {
        this.database = database;
    }

    prepare(sql) {
        return new SqliteStatement(this.database, sql);
    }

    async batch(statements) {
        this.database.exec("BEGIN IMMEDIATE");
        try {
            const results = [];
            for (const statement of statements) results.push(await statement.run());
            this.database.exec("COMMIT");
            return results;
        } catch (error) {
            this.database.exec("ROLLBACK");
            throw error;
        }
    }
}

async function createHarness() {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(await readFile(new URL("../migrations/0001_initial_schema.sql", import.meta.url), "utf8"));
    const db = new SqliteD1(database);
    const password = await bcrypt.hash("admin-password", 4);
    await db.prepare(
        "INSERT INTO users (nama, username, password, role) VALUES (?, ?, ?, ?)"
    ).bind("Admin", "admin", password, "admin").run();
    const env = { DB: db, JWT_SECRET: "test-secret-that-is-only-used-in-tests" };
    const loginResponse = await dispatchApi(new Request("https://local.test/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin-password" })
    }), env);
    assert.equal(loginResponse.status, 200);
    const { token } = await loginResponse.json();
    return {
        db,
        env,
        token,
        request(path, method = "GET", body) {
            return dispatchApi(new Request(`https://local.test/api/${path}`, {
                method,
                headers: {
                    authorization: `Bearer ${token}`,
                    ...(body === undefined ? {} : { "content-type": "application/json" })
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            }), env);
        }
    };
}

test("D1 API supports login, master data, stock batches, sales, and inventory transitions", async () => {
    const app = await createHarness();

    const unauthenticated = await dispatchApi(
        new Request("https://local.test/api/barang"),
        app.env
    );
    assert.equal(unauthenticated.status, 401);

    let response = await app.request("supplier", "POST", {
        kode_supplier: "SUP-1",
        nama_supplier: "Supplier Test"
    });
    assert.equal(response.status, 201);

    response = await app.request("pelanggan", "POST", {
        kode_pelanggan: "CUS-1",
        nama_pelanggan: "Customer Test"
    });
    assert.equal(response.status, 201);

    response = await app.request("barang", "POST", {
        kode_barang: "ITEM-1",
        nama_barang: "Item Test",
        satuan: "pcs",
        satuan_harga: 2.5
    });
    assert.equal(response.status, 201);

    response = await app.request("stokin", "POST", {
        no_stok_in: "IN-1",
        tanggal: "2026-10-01",
        kode_supplier: "SUP-1",
        items: [{ kode_barang: "ITEM-1", qty: 10, satuan_harga: 2 }]
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).data.grand_total, 20);

    response = await app.request("stokin/IN-1/status", "PATCH", { status: "Confirmed" });
    assert.equal(response.status, 200);
    assert.equal(
        (await app.db.prepare("SELECT StokCurrent FROM inventorystock WHERE KodeBarang = ?")
            .bind("ITEM-1").first()).StokCurrent,
        10
    );

    response = await app.request("penjualan", "POST", {
        no_penjualan: "SALE-1",
        tanggal: "2026-10-02",
        kode_pelanggan: "CUS-1",
        items: [{ kode_barang: "ITEM-1", no_stok_in: "IN-1", qty: 3 }]
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).data.grand_total, 7.5);

    response = await app.request("penjualan/SALE-1/status", "PATCH", { status: "Confirmed" });
    assert.equal(response.status, 200);
    assert.equal(
        (await app.db.prepare("SELECT StokCurrent FROM inventorystock WHERE KodeBarang = ?")
            .bind("ITEM-1").first()).StokCurrent,
        7
    );

    response = await app.request("inventory?filter=semua");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data[0].stok, 7);

    response = await app.request("penjualan/SALE-1/status", "PATCH", { status: "Pending" });
    assert.equal(response.status, 200);
    assert.equal(
        (await app.db.prepare("SELECT StokCurrent FROM inventorystock WHERE KodeBarang = ?")
            .bind("ITEM-1").first()).StokCurrent,
        10
    );

    response = await app.request("penjualan/SALE-1/status", "PATCH", { status: "Confirmed" });
    assert.equal(response.status, 200);
    response = await app.request("penjualan/SALE-1", "DELETE");
    assert.equal(response.status, 200);
    assert.equal(
        (await app.db.prepare("SELECT StokCurrent FROM inventorystock WHERE KodeBarang = ?")
            .bind("ITEM-1").first()).StokCurrent,
        10
    );

    response = await app.request("stokin/IN-1", "GET");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.details.length, 1);

    response = await app.request("stokin/IN-1/status", "PATCH", { status: "Pending" });
    assert.equal(response.status, 200);
    assert.equal(
        (await app.db.prepare("SELECT StokCurrent FROM inventorystock WHERE KodeBarang = ?")
            .bind("ITEM-1").first()).StokCurrent,
        0
    );
});

test("D1 API rejects insufficient stock and prevents deleting referenced stock batches", async () => {
    const app = await createHarness();
    await app.request("barang", "POST", {
        kode_barang: "ITEM-1",
        nama_barang: "Item Test",
        satuan: "pcs",
        satuan_harga: 1
    });
    await app.request("stokin", "POST", {
        no_stok_in: "IN-1",
        tanggal: "2026-10-01",
        items: [{ kode_barang: "ITEM-1", qty: 2, satuan_harga: 1 }]
    });
    await app.request("stokin/IN-1/status", "PATCH", { status: "Confirmed" });

    let response = await app.request("penjualan", "POST", {
        no_penjualan: "SALE-1",
        tanggal: "2026-10-02",
        items: [{ kode_barang: "ITEM-1", no_stok_in: "IN-1", qty: 3 }]
    });
    assert.equal(response.status, 409);

    response = await app.request("penjualan", "POST", {
        no_penjualan: "SALE-1",
        tanggal: "2026-10-02",
        items: [{ kode_barang: "ITEM-1", no_stok_in: "IN-1", qty: 1 }]
    });
    assert.equal(response.status, 201);

    response = await app.request("stokin/IN-1", "DELETE");
    assert.equal(response.status, 409);
});

test("D1 API health route checks database availability", async () => {
    const app = await createHarness();
    const response = await app.request("health");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", database: "connected" });
});

test("user management enforces admin creation and stores hashed passwords", async () => {
    const app = await createHarness();
    const response = await app.request("users", "POST", {
        username: "staff1",
        nama: "Staff Test",
        role: "staff",
        password: "staff-password"
    });
    assert.equal(response.status, 201);
    const user = (await response.json()).data;
    assert.equal(user.username, "staff1");
    const stored = await app.db.prepare("SELECT password FROM users WHERE username = ?")
        .bind("staff1").first();
    assert.match(stored.password, /^\$2[ab]\$/);
    assert.notEqual(stored.password, "staff-password");
});

test("successful login upgrades a legacy plaintext password to bcrypt", async () => {
    const app = await createHarness();
    await app.db.prepare(
        "INSERT INTO users (nama, username, password, role) VALUES (?, ?, ?, ?)"
    ).bind("Legacy User", "legacy-user", "legacy-password", "staff").run();

    const response = await dispatchApi(new Request("https://local.test/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "legacy-user", password: "legacy-password" })
    }), app.env);

    assert.equal(response.status, 200);
    assert.ok((await response.json()).token);
    const stored = await app.db.prepare(
        "SELECT password FROM users WHERE username = ?"
    ).bind("legacy-user").first();
    assert.match(stored.password, /^\$2[ab]\$/);
    assert.notEqual(stored.password, "legacy-password");
});

test("D1 transaction writes support the maximum 100 detail rows", async () => {
    const app = await createHarness();
    await app.request("barang", "POST", {
        kode_barang: "ITEM-1",
        nama_barang: "Item Test",
        satuan: "pcs",
        satuan_harga: 1
    });
    const response = await app.request("stokin", "POST", {
        no_stok_in: "IN-100",
        tanggal: "2026-10-01",
        items: Array.from({ length: 100 }, () => ({
            kode_barang: "ITEM-1",
            qty: 1,
            satuan_harga: 1
        }))
    });
    assert.equal(response.status, 201);
    const count = await app.db.prepare(
        "SELECT COUNT(*) AS count FROM detailstokin WHERE NoStokIn = ?"
    ).bind("IN-100").first();
    assert.equal(count.count, 100);
});

test("API coordinator serializes competing stock confirmations", async () => {
    const app = await createHarness();
    await app.request("barang", "POST", {
        kode_barang: "ITEM-1",
        nama_barang: "Item Test",
        satuan: "pcs",
        satuan_harga: 1
    });
    await app.request("stokin", "POST", {
        no_stok_in: "IN-1",
        tanggal: "2026-10-01",
        items: [{ kode_barang: "ITEM-1", qty: 1, satuan_harga: 1 }]
    });
    await app.request("stokin/IN-1/status", "PATCH", { status: "Confirmed" });
    for (const saleNo of ["SALE-1", "SALE-2"]) {
        const response = await app.request("penjualan", "POST", {
            no_penjualan: saleNo,
            tanggal: "2026-10-02",
            items: [{ kode_barang: "ITEM-1", no_stok_in: "IN-1", qty: 1 }]
        });
        assert.equal(response.status, 201);
    }

    const coordinator = new ApiCoordinator({}, app.env);
    const confirm = (saleNo) => coordinator.fetch(new Request(
        `https://local.test/api/penjualan/${saleNo}/status`,
        {
            method: "PATCH",
            headers: {
                authorization: `Bearer ${app.token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({ status: "Confirmed" })
        }
    ));
    const responses = await Promise.all([confirm("SALE-1"), confirm("SALE-2")]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
    const stock = await app.db.prepare(
        "SELECT StokCurrent FROM inventorystock WHERE KodeBarang = ?"
    ).bind("ITEM-1").first();
    assert.equal(stock.StokCurrent, 0);
});
