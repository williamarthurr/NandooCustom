const EMPLOYEE_PATTERN = /^\s*(\d{4,}[PG]?)\s*\((.+)\)\s*$/i;
const EMPLOYEE_ID_IN_FILENAME = /(?:^|[^a-zA-Z0-9])([a-zA-Z]*\d{4,}[a-zA-Z0-9]*)(?=$|[^a-zA-Z0-9])/;

export function makeOutputName(employeeId, suffix = "_merged") {
    let text = String(suffix || "_merged").trim();
    if (!text) text = "_merged";
    if (text.toLowerCase().endsWith(".pdf")) text = text.slice(0, -4).trimEnd();
    text = text.replace(/[\\/*?:"<>|]/g, "");
    if (/\{nik\}/i.test(text)) {
        text = text.replace(/\{nik\}/gi, employeeId);
    } else if (text && !/^[_\-. ]/.test(text)) {
        text = `${employeeId}_${text}`;
    } else {
        text = `${employeeId}${text}`;
    }
    return `${text}.pdf`;
}

export function fileSortKey(fileName, keywords) {
    const lowerName = fileName.toLowerCase();
    const keywordIndex = keywords.findIndex((keyword) => {
        if (/^\d+$/.test(keyword)) {
            return new RegExp(`(?:^|[^a-z0-9])${keyword}(?=$|[^a-z0-9])`, "i").test(lowerName);
        }
        return lowerName.includes(keyword);
    });
    if (keywordIndex !== -1) return keywordIndex;
    const trailingNumber = fileName.match(/(\d+)(?:\.pdf)?$/i);
    return trailingNumber ? Number(trailingNumber[1]) : 999;
}

export function groupPdfsByEmployee(files, rawKeywords, suffix) {
    const keywords = String(rawKeywords || "")
        .split(",")
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean);
    const groups = new Map();
    const unpaired = [];

    for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith("_merged.pdf")) {
            continue;
        }
        const match = file.name.match(EMPLOYEE_ID_IN_FILENAME);
        if (!match) continue;
        const employeeId = match[1].toUpperCase();
        const group = groups.get(employeeId) || [];
        group.push(file);
        groups.set(employeeId, group);
    }

    const pairs = [];
    for (const [employeeId, group] of groups) {
        if (group.length < 2) {
            unpaired.push(...group.map((file) => file.name));
            continue;
        }
        group.sort((left, right) => fileSortKey(left.name, keywords) - fileSortKey(right.name, keywords));
        pairs.push({
            employeeId,
            outputName: makeOutputName(employeeId, suffix),
            files: group,
        });
    }
    return { pairs, unpaired };
}

export function parsePageRange(pageSpec) {
    if (!pageSpec || !pageSpec.trim() || ["all", "semua", "*"].includes(pageSpec.trim().toLowerCase())) {
        return null;
    }
    const pages = new Set();
    for (const part of pageSpec.split(",")) {
        const range = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);
            if (start <= end) {
                for (let page = start; page <= end; page++) {
                    if (page >= 1) pages.add(page - 1);
                }
            }
            continue;
        }
        const page = Number(part.trim());
        if (/^\d+$/.test(part.trim()) && page >= 1) pages.add(page - 1);
    }
    return pages.size ? [...pages].sort((left, right) => left - right) : null;
}

function normalizeName(name) {
    return name.toLocaleLowerCase().trim().replace(/\s+/g, " ");
}

export function summarizeAttendance(rows) {
    const records = new Map();
    const names = new Map();

    for (const row of rows) {
        const employeeCell = String(row?.[0] ?? "").trim();
        const match = employeeCell.match(EMPLOYEE_PATTERN);
        if (!match) continue;

        const nik = match[1].toUpperCase();
        const name = match[2].trim();
        if (!name) throw new Error(`Baris dengan NIK ${nik} tidak memiliki nama karyawan.`);
        const description = String(row?.[10] ?? "").trim().toUpperCase();
        if (!description) continue;

        let category;
        let code;
        if (description.includes("SAKIT SURAT DOKTER")) {
            category = "absence";
            code = "SD";
        } else if (description.includes("ALPHA")) {
            category = "absence";
            code = "ALPHA";
        } else if (description.includes("IJIN")) {
            category = "discipline";
            if (description.includes("TERLAMBAT")) code = "TERLAMBAT";
            else if (description.includes("SETENGAH HARI")) code = "SETENGAH HARI";
            else if (description.includes("MENINGGALKAN")) code = "MENINGGALKAN";
            else code = description.replace(/^IJIN\s*/, "").trim();
        } else {
            continue;
        }

        const normalizedName = normalizeName(name);
        const previousNik = names.get(normalizedName);
        if (previousNik && previousNik !== nik) {
            throw new Error(`Nama karyawan ${name} ditemukan dengan NIK berbeda (${previousNik} dan ${nik}); periksa data sumber.`);
        }
        names.set(normalizedName, nik);

        let record = records.get(nik);
        if (!record) {
            record = { nik, name, absences: 0, discipline: 0, descriptions: [] };
            records.set(nik, record);
        } else if (normalizeName(record.name) !== normalizedName) {
            throw new Error(`NIK ${nik} ditemukan dengan nama berbeda (${record.name} dan ${name}); periksa data sumber.`);
        }

        if (category === "absence") record.absences++;
        else record.discipline++;
        record.descriptions.push(code);
    }

    if (!records.size) {
        throw new Error("Tidak ditemukan baris karyawan dengan NIK dan keterangan absensi/izin yang dikenali.");
    }
    return [...records.values()];
}

export function attendanceRows(records) {
    return records.map((record) => [
        record.nik,
        record.name,
        record.absences || null,
        4 - record.absences,
        record.discipline || null,
        4 - record.discipline,
        record.descriptions.join(", "),
    ]);
}
