import assert from "node:assert/strict";
import { test } from "node:test";
import { convertMysqlDump, parseArguments } from "./import-mysql-dump.mjs";

test("converts explicit-column inserts with escaped strings, NULLs, numbers, and multiple tuples", () => {
    const dump = `
        -- mysqldump comment
        SET NAMES utf8mb4;
        CREATE TABLE \`items\` (\`id\` int, \`name\` text, \`note\` text, \`active\` int);
        INSERT INTO \`items\` (\`id\`, \`name\`, \`note\`, \`active\`) VALUES
            (1, 'O\\'Brien', 'line\\nnext', NULL),
            (2, 'double ''quote''', 'back\\\\slash', -1.25e2);
        ALTER TABLE \`items\` ADD PRIMARY KEY (\`id\`);
    `;
    const result = convertMysqlDump(dump);

    assert.equal(result.sql,
        `INSERT INTO "items" ("id", "name", "note", "active") VALUES (1, 'O''Brien', 'line\nnext', NULL), (2, 'double ''quote''', 'back\\slash', -1.25e2);\n`);
    assert.deepEqual([...result.counts], [["items", 2]]);
});

test("ignores schema statements and supports omitted columns and qualified table names", () => {
    const result = convertMysqlDump(`
        /*!40101 SET @OLD_SQL_MODE=@@SQL_MODE */;
        CREATE DATABASE \`source_db\`;
        INSERT INTO \`source_db\`.\`plain_table\` VALUES (NULL), (0);
    `);

    assert.equal(result.sql, `INSERT INTO "plain_table" VALUES (NULL), (0);\n`);
    assert.deepEqual([...result.counts], [["plain_table", 2]]);
});

test("orders inserts by D1 foreign-key dependencies", () => {
    const result = convertMysqlDump(`
        INSERT INTO detailpenjualan (NoPenjualan) VALUES ('SALE-1');
        INSERT INTO penjualan (NoPenjualan) VALUES ('SALE-1');
        INSERT INTO masterbarang (KodeBarang) VALUES ('ITEM-1');
        INSERT INTO detailstokin (NoStokIn) VALUES ('IN-1');
        INSERT INTO stokin (NoStokIn) VALUES ('IN-1');
    `);

    assert.deepEqual(
        [...result.sql.matchAll(/INSERT INTO "([^"]+)"/g)].map((match) => match[1]),
        ["masterbarang", "stokin", "penjualan", "detailstokin", "detailpenjualan"]
    );
});

test("maps implicit MySQL insert values to source schema columns", () => {
    const result = convertMysqlDump(`
        CREATE TABLE \`stockin\` (
            \`NoStokIn\` varchar(50) NOT NULL,
            \`Tanggal\` date NOT NULL,
            \`KodeSupplier\` varchar(50) DEFAULT NULL,
            \`GrandTotal\` decimal(12, 2) NOT NULL,
            \`is_synced\` tinyint DEFAULT 0
        );
        INSERT INTO \`stockin\` VALUES ('IN-1', '2026-10-01', NULL, 20.00, 0);
    `);

    assert.equal(
        result.sql,
        `INSERT INTO "stockin" ("NoStokIn", "Tanggal", "KodeSupplier", "GrandTotal", "is_synced") VALUES ('IN-1', '2026-10-01', NULL, 20.00, 0);\n`
    );
});

test("keeps semicolons and comment markers inside quoted values", () => {
    const result = convertMysqlDump("INSERT INTO t (v) VALUES ('a; -- not a comment /* text */'), ('# still data');");

    assert.equal(result.sql, `INSERT INTO "t" ("v") VALUES ('a; -- not a comment /* text */'), ('# still data');\n`);
    assert.deepEqual([...result.counts], [["t", 2]]);
});

test("converts MySQL NUL escapes into SQLite-compatible expressions", () => {
    const result = convertMysqlDump("INSERT INTO t (v) VALUES ('left\\0right'), ('\\0'), ('end\\0');");

    assert.equal(result.sql,
        `INSERT INTO "t" ("v") VALUES ('left' || char(0) || 'right'), (char(0)), ('end' || char(0));\n`);
});

test("rejects unsupported value expressions without exposing source values", () => {
    assert.throws(
        () => convertMysqlDump("INSERT INTO t (v) VALUES ('private-value', NOW());"),
        { message: "Unsupported or malformed INSERT statement 1." }
    );
});

test("requires explicit absolute input and output paths", () => {
    assert.deepEqual(parseArguments([
        "--input", "C:\\data\\dump.sql",
        "--output", "C:\\data\\converted.sql"
    ]), {
        input: "C:\\data\\dump.sql",
        output: "C:\\data\\converted.sql"
    });
    assert.throws(() => parseArguments(["--input", "dump.sql", "--output", "out.sql"]));
    assert.throws(() => parseArguments(["--input", "C:\\same.sql", "--output", "C:\\same.sql"]));
});
