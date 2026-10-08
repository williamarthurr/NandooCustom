import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./src/operations.js", import.meta.url), "utf8");
const {
    attendanceRows,
    fileSortKey,
    groupPdfsByEmployee,
    makeOutputName,
    parsePageRange,
    summarizeAttendance,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("groups PDFs by employee and follows configured keyword order", () => {
    const files = [
        { name: "Payslip_98765P_Maret.pdf" },
        { name: "98765P_part-2.pdf" },
        { name: "98765P_part-1.pdf" },
        { name: "single_54321.pdf" },
    ];
    const result = groupPdfsByEmployee(files, "part-1, part-2, Maret", "_merged");
    assert.deepEqual(result.pairs.map((pair) => pair.outputName), ["98765P_merged.pdf"]);
    assert.deepEqual(result.pairs[0].files.map((file) => file.name), [
        "98765P_part-1.pdf",
        "98765P_part-2.pdf",
        "Payslip_98765P_Maret.pdf",
    ]);
    assert.deepEqual(result.unpaired, ["single_54321.pdf"]);
});

test("sanitizes output names and supports NIK placeholders", () => {
    assert.equal(makeOutputName("12345", "_SLIP_GAJI.pdf"), "12345_SLIP_GAJI.pdf");
    assert.equal(makeOutputName("12345", "{NIK}: slip"), "12345 slip.pdf");
    assert.equal(fileSortKey("April_12345_10.pdf", []), 10);
    assert.equal(fileSortKey("1001_part-2.pdf", ["1", "2"]), 1);
});

test("parses page ranges to sorted zero-based page indexes", () => {
    assert.deepEqual(parsePageRange("1-3, 5, 7-8"), [0, 1, 2, 4, 6, 7]);
    assert.equal(parsePageRange("semua"), null);
    assert.equal(parsePageRange("n/a"), null);
});

test("summarizes attendance categories and calculates scores", () => {
    const rows = [
        ["1234P(ARI)", "", "", "", "", "", "", "", "", "", "SAKIT SURAT DOKTER"],
        ["1234P(ARI)", "", "", "", "", "", "", "", "", "", "ALPHA"],
        ["56789(SITI)", "", "", "", "", "", "", "", "", "", "IJIN TERLAMBAT MASUK KERJA"],
    ];
    const records = summarizeAttendance(rows);
    assert.deepEqual(records[0], {
        nik: "1234P",
        name: "ARI",
        absences: 2,
        discipline: 0,
        descriptions: ["SD", "ALPHA"],
    });
    assert.deepEqual(attendanceRows(records), [
        ["1234P", "ARI", 2, 2, null, 4, "SD, ALPHA"],
        ["56789", "SITI", null, 4, 1, 3, "TERLAMBAT"],
    ]);
});

test("rejects names shared by different employee IDs", () => {
    assert.throws(
        () => summarizeAttendance([
            ["1234(ARI)", "", "", "", "", "", "", "", "", "", "ALPHA"],
            ["5678(ARI)", "", "", "", "", "", "", "", "", "", "ALPHA"],
        ]),
        /NIK berbeda/,
    );
});
