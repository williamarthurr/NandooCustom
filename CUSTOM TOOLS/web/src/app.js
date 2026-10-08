import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
    attendanceRows,
    groupPdfsByEmployee,
    parsePageRange,
    summarizeAttendance,
} from "./operations.js";
import "./styles.css";

const tools = [
    { id: "attendance", icon: "▤", label: "Monitoring Absensi" },
    { id: "merge-id", icon: "▧", label: "Penggabung PDF (by NIK)" },
    { id: "merge-all", icon: "▱", label: "Penggabung PDF (by All)" },
    { id: "pdf-word", icon: "▣", label: "Konversi PDF ke Word" },
    { id: "codes", icon: "▦", label: "QR / Barcode Generator" },
];

const appRoot = document.querySelector("#app");
appRoot.innerHTML = `
    <div class="utility-layout">
        <aside class="sidebar">
            <a class="brand" href="/" aria-label="Kembali ke pilih aplikasi">
                <span><strong>Custom</strong><small>UTILITY SUITE</small></span>
            </a>
            <p class="sidebar-label">APLIKASI</p>
            <nav id="toolNavigation" class="tool-navigation" aria-label="Custom Utility"></nav>
            <div class="sidebar-bottom">
                <a class="back-link" href="/">← Pilih aplikasi</a>
            </div>
        </aside>
        <div class="content-shell">
            <header class="topbar">
                <div><span class="topbar-kicker">NANDOAPP / UTILITIES</span><strong id="topbarTitle">Custom Utility</strong></div>
            </header>
            <main id="toolView" class="tool-view"></main>
            <footer class="support-footer">
                <div class="support-card">
                    <strong>Tech Support</strong>
                    <a href="tel:+6281388183368">WA: 0813-8818-3368</a>
                    <a href="mailto:itfernandoo@gmail.com">email: itfernandoo@gmail.com</a>
                </div>
            </footer>
        </div>
    </div>
`;

const navigation = document.querySelector("#toolNavigation");
const toolView = document.querySelector("#toolView");
let activeTool = location.hash.slice(1) || "attendance";
let mergeAllFiles = [];
let mergeAllOrder = [];
let qrPreviewBlob = null;

for (const tool of tools) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-nav-button";
    button.dataset.tool = tool.id;
    button.innerHTML = `<span class="nav-icon" aria-hidden="true">${tool.icon}</span><span>${tool.label}</span>`;
    button.addEventListener("click", () => {
        activeTool = tool.id;
        history.replaceState(null, "", `#${tool.id}`);
        renderTool();
    });
    navigation.append(button);
}

function enableFileDrop(input, onChange) {
    const dropZone = document.querySelector(`label[for="${input.id}"]`);
    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragging");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
    dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropZone.classList.remove("is-dragging");
        if (!event.dataTransfer.files.length) return;
        input.files = event.dataTransfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    if (onChange) input.addEventListener("change", onChange);
}

function heading(title, description) {
    return `
        <section class="page-heading">
            <div><p class="section-kicker">CUSTOM UTILITY</p><h1>${title}</h1><p>${description}</p></div>
        </section>
    `;
}

function panel(title, description, content, extraClass = "") {
    return `
        <section class="panel ${extraClass}">
            <div class="panel-heading"><div><h2>${title}</h2><p>${description}</p></div></div>
            ${content}
        </section>
    `;
}

function renderTool() {
    if (!tools.some((tool) => tool.id === activeTool)) activeTool = "attendance";
    const currentTool = tools.find((tool) => tool.id === activeTool);
    document.querySelector("#topbarTitle").textContent = currentTool.label;
    for (const button of navigation.querySelectorAll("[data-tool]")) {
        const selected = button.dataset.tool === activeTool;
        button.classList.toggle("is-active", selected);
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    }

    const viewRenderers = {
        attendance: renderAttendance,
        "merge-id": renderMergeById,
        "merge-all": renderMergeAll,
        "pdf-word": renderPdfToWord,
        codes: renderCodes,
    };
    toolView.innerHTML = viewRenderers[activeTool]();
    bindToolEvents();
}

function filePicker(id, accept, label, multiple = true) {
    return `
        <label class="drop-zone" for="${id}">
            <span class="drop-icon" aria-hidden="true">↑</span>
            <span><strong>${label}</strong><small>atau klik untuk memilih dari perangkat</small></span>
            <input id="${id}" type="file" accept="${accept}" ${multiple ? "multiple" : ""}>
        </label>
        <div id="${id}List" class="file-list" aria-live="polite"></div>
    `;
}

function actionButton(id, label, icon = "→") {
    return `<button id="${id}" class="primary-button" type="button"><span>${icon}</span>${label}</button>`;
}

function resultArea(id = "result") {
    return `<div id="${id}" class="result-area" aria-live="polite"></div>`;
}

function renderAttendance() {
    return `
        ${heading("Monitoring Absensi", "Rangkum absensi dan kedisiplinan karyawan dari file Leave / Trip Report Excel.")}
        ${panel(
            "Pilih laporan Excel",
            "Mendukung format .xls dan .xlsx; data dibaca langsung dari browser.",
            `${filePicker("attendanceFile", ".xls,.xlsx", "Tarik file Excel ke sini")}
            <div class="action-row">${actionButton("processAttendance", "Proses laporan")}</div>
            ${resultArea()}`,
        )}
    `;
}

function renderMergeById() {
    return `
        ${heading("Penggabung PDF by NIK", "Kelompokkan dokumen berdasarkan NIK, atur urutan nama file, lalu unduh hasilnya sebagai ZIP.")}
        ${panel(
            "Pilih dokumen PDF",
            "Setiap kelompok NIK perlu memiliki minimal dua dokumen.",
            `${filePicker("mergeIdFiles", ".pdf", "Tarik beberapa file PDF ke sini")}
            <div class="form-grid">
                <label class="field"><span>Urutan kata kunci</span><input id="mergeKeywords" type="text" value="1, 2, Oktober, November"><small>Kata kunci di kiri diprioritaskan lebih dahulu.</small></label>
                <label class="field"><span>Nama file lanjutan</span><input id="mergeSuffix" type="text" value="_merged"><small>NIK otomatis ditambahkan jika nama tidak diawali NIK.</small></label>
            </div>
            <div class="action-row">${actionButton("mergeById", "Kelompokkan dan gabungkan PDF")}</div>
            ${resultArea()}`,
        )}
    `;
}

function renderMergeAll() {
    mergeAllFiles = [];
    mergeAllOrder = [];
    return `
        ${heading("Penggabung PDF by All", "Gabungkan PDF dalam urutan yang kamu tentukan. Susunan dan seluruh proses tetap di browser.")}
        ${panel(
            "Pilih dokumen PDF",
            "Gunakan tombol panah atau seret kartu untuk mengubah urutan halaman.",
            `${filePicker("mergeAllFiles", ".pdf", "Tarik beberapa file PDF ke sini")}
            <div id="mergeAllOrder" class="sortable-list"></div>
            <label class="field output-name"><span>Nama file hasil</span><input id="mergeAllName" type="text" value="Dokumen_Gabungan.pdf"></label>
            <div class="action-row">${actionButton("mergeAll", "Gabungkan PDF")}</div>
            ${resultArea()}`,
        )}
    `;
}

function renderPdfToWord() {
    return `
        ${heading("Konversi PDF ke Word", "Ekstrak teks PDF dan buat dokumen .docx yang dapat diedit, tanpa mengunggah dokumen.")}
        <div class="notice notice-info"><strong>Catatan format:</strong> versi browser ini menyalin teks dan urutan bacanya. Tata letak, gambar, dan tabel dari PDF tidak dipertahankan.</div>
        ${panel(
            "Pilih dokumen PDF",
            "Kamu dapat mengonversi satu atau beberapa file sekaligus.",
            `${filePicker("pdfWordFiles", ".pdf", "Tarik beberapa file PDF ke sini")}
            <div class="form-grid">
                <label class="field"><span>Rentang halaman (opsional)</span><input id="pdfPages" type="text" placeholder="Contoh: 1-3, 5"><small>Kosongkan untuk mengonversi semua halaman.</small></label>
                <label class="check-field"><input id="removeHyphens" type="checkbox" checked><span><strong>Satukan kata terpenggal</strong><small>Gabungkan kata yang terpotong tanda hubung di akhir baris.</small></span></label>
            </div>
            <div class="action-row">${actionButton("convertPdfWord", "Konversi ke Word")}</div>
            ${resultArea()}`,
        )}
    `;
}

function renderCodes() {
    qrPreviewBlob = null;
    return `
        ${heading("QR / Barcode Generator", "Buat QR Code atau barcode Code 128 dan simpan gambarnya sebagai PNG.")}
        ${panel(
            "Atur kode",
            "Teks dan pengaturan hanya diproses di browser.",
            `<div class="form-grid">
                <label class="field"><span>Jenis kode</span><select id="codeType"><option>QR Code</option><option>Barcode (Code 128)</option></select></label>
                <label class="field"><span>Konten</span><textarea id="codeContent" rows="3" placeholder="Masukkan teks atau tautan"></textarea></label>
                <label class="field color-field"><span>Warna kode</span><input id="codeForeground" type="color" value="#000000"></label>
                <label class="field color-field"><span>Warna latar</span><input id="codeBackground" type="color" value="#FFFFFF"></label>
                <label id="qrOptions" class="field qr-options"><span>Ukuran kotak QR (1–40)</span><input id="qrBoxSize" type="number" min="1" max="40" value="10"></label>
                <label id="qrBorderField" class="field qr-options"><span>Lebar border (0–20)</span><input id="qrBorder" type="number" min="0" max="20" value="4"></label>
            </div>
            <div class="action-row">${actionButton("generateCode", "Buat pratinjau kode")}</div>
            <div id="codePreview" class="code-preview"><p>Pratinjau kode akan tampil di sini.</p></div>
            <div id="codeDownload" class="action-row"></div>
            ${resultArea()}`,
        )}
    `;
}

function bindToolEvents() {
    const bindings = {
        attendance: bindAttendance,
        "merge-id": bindMergeById,
        "merge-all": bindMergeAll,
        "pdf-word": bindPdfToWord,
        codes: bindCodes,
    };
    bindings[activeTool]();
}

function renderFileList(container, files) {
    container.replaceChildren();
    for (const file of files) {
        const item = document.createElement("div");
        item.className = "file-item";
        const fileName = document.createElement("span");
        fileName.className = "file-name";
        fileName.textContent = file.name;
        const fileSize = document.createElement("small");
        fileSize.textContent = formatSize(file.size);
        item.append(fileName, fileSize);
        container.append(item);
    }
}

function formatSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function showMessage(container, message, type = "error") {
    const notice = document.createElement("div");
    notice.className = `notice notice-${type}`;
    notice.textContent = message;
    container.replaceChildren(notice);
}

function showTable(container, headers, rows) {
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const value of headers) {
        const cell = document.createElement("th");
        cell.textContent = value;
        headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const row of rows) {
        const tableRow = document.createElement("tr");
        for (const value of row) {
            const cell = document.createElement("td");
            cell.textContent = value == null ? "—" : String(value);
            tableRow.append(cell);
        }
        body.append(tableRow);
    }
    table.append(head, body);
    wrapper.append(table);
    container.append(wrapper);
}

function downloadBlob(blob, fileName) {
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function safeFileName(value, fallback, extension) {
    let name = String(value || "").trim().replace(/[\\/:*?"<>|]/g, "_");
    if (!name) name = fallback;
    if (!name.toLowerCase().endsWith(extension)) name += extension;
    return name;
}

function setBusy(button, busy, label) {
    button.disabled = busy;
    button.dataset.originalMarkup ||= button.innerHTML;
    button.innerHTML = busy ? label : button.dataset.originalMarkup;
}

function bindAttendance() {
    const input = document.querySelector("#attendanceFile");
    enableFileDrop(input, () => renderFileList(document.querySelector("#attendanceFileList"), input.files));
    document.querySelector("#processAttendance").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const result = document.querySelector("#result");
        const file = input.files[0];
        if (!file) return showMessage(result, "Pilih laporan Excel terlebih dahulu.");
        if (!/\.(xls|xlsx)$/i.test(file.name)) return showMessage(result, "Format file tidak didukung. Gunakan .xls atau .xlsx.");

        setBusy(button, true, "Membaca laporan...");
        try {
            const XLSX = await import("xlsx-js-style");
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) throw new Error("File Excel tidak memiliki sheet.");
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
                header: 1,
                defval: "",
                raw: true,
            });
            const records = summarizeAttendance(rows);
            const resultRows = attendanceRows(records);
            showMessage(result, `Berhasil merangkum ${records.length} karyawan.`, "success");
            showTable(result, ["NIK", "NAMA", "ABSENSI", "SKOR ABSENSI", "KEDISIPLINAN", "SKOR KEDISIPLINAN", "KETERANGAN"], resultRows);

            const header = ["NIK", "NAMA", "ABSENSI", "SKOR", "KEDISIPLINAN", "SKOR", "KETERANGAN"];
            const sheet = XLSX.utils.aoa_to_sheet([header, ...resultRows]);
            sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
            sheet["!autofilter"] = { ref: `A1:G${resultRows.length + 1}` };
            sheet["!cols"] = [14, 28, 13, 16, 18, 22, 38].map((wch) => ({ wch }));
            for (let column = 0; column < header.length; column++) {
                const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
                cell.s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { patternType: "solid", fgColor: { rgb: "4472C4" } },
                };
            }
            const output = XLSX.write(
                { SheetNames: ["Monitoring Absensi"], Sheets: { "Monitoring Absensi": sheet } },
                { bookType: "xlsx", type: "array", cellStyles: true },
            );
            const download = document.createElement("button");
            download.type = "button";
            download.className = "secondary-button";
            download.textContent = "Unduh hasil Excel";
            download.addEventListener("click", () => downloadBlob(
                new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                "Monitoring_Absensi.xlsx",
            ));
            result.append(download);
        } catch (error) {
            showMessage(result, `Gagal memproses laporan: ${error.message}`);
        } finally {
            setBusy(button, false);
        }
    });
}

function bindMergeById() {
    const input = document.querySelector("#mergeIdFiles");
    enableFileDrop(input, () => renderFileList(document.querySelector("#mergeIdFilesList"), input.files));
    document.querySelector("#mergeById").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const result = document.querySelector("#result");
        const files = [...input.files];
        if (files.length < 2) return showMessage(result, "Pilih setidaknya dua file PDF.");
        if (files.some((file) => !file.name.toLowerCase().endsWith(".pdf"))) return showMessage(result, "Semua file harus berformat PDF.");

        setBusy(button, true, "Menggabungkan file...");
        result.replaceChildren();
        try {
            const [{ PDFDocument }, JSZip] = await Promise.all([
                import("pdf-lib"),
                import("jszip").then((module) => module.default),
            ]);
            const { pairs, unpaired } = groupPdfsByEmployee(
                files,
                document.querySelector("#mergeKeywords").value,
                document.querySelector("#mergeSuffix").value,
            );
            if (!pairs.length) {
                showMessage(result, "Tidak ditemukan kelompok NIK dengan minimal dua file.", "warning");
                if (unpaired.length) appendNameList(result, "File tanpa pasangan", unpaired);
                return;
            }

            const zip = new JSZip();
            for (const pair of pairs) {
                const merged = await PDFDocument.create();
                for (const file of pair.files) {
                    const source = await PDFDocument.load(await file.arrayBuffer());
                    const pages = await merged.copyPages(source, source.getPageIndices());
                    pages.forEach((page) => merged.addPage(page));
                }
                zip.file(pair.outputName, await merged.save());
            }
            const blob = await zip.generateAsync({ type: "blob" });
            downloadBlob(blob, "HASIL_MERGE_PDF.zip");
            showMessage(result, `Selesai. ${pairs.length} kelompok PDF berhasil dibuat.`, "success");
            appendNameList(result, "File hasil", pairs.map((pair) => pair.outputName));
            if (unpaired.length) appendNameList(result, "File tanpa pasangan", unpaired);
        } catch (error) {
            showMessage(result, `Gagal menggabungkan PDF: ${error.message}`);
        } finally {
            setBusy(button, false);
        }
    });
}

function appendNameList(container, title, names) {
    const section = document.createElement("div");
    section.className = "name-list";
    const headingNode = document.createElement("strong");
    headingNode.textContent = title;
    const list = document.createElement("ul");
    for (const name of names) {
        const item = document.createElement("li");
        item.textContent = name;
        list.append(item);
    }
    section.append(headingNode, list);
    container.append(section);
}

function bindMergeAll() {
    const input = document.querySelector("#mergeAllFiles");
    enableFileDrop(input, () => {
        mergeAllFiles = [...input.files];
        mergeAllOrder = mergeAllFiles.map((_, index) => index);
        renderFileList(document.querySelector("#mergeAllFilesList"), mergeAllFiles);
        renderMergeAllOrder();
    });
    document.querySelector("#mergeAll").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const result = document.querySelector("#result");
        if (mergeAllFiles.length < 2) return showMessage(result, "Pilih setidaknya dua file PDF.");
        setBusy(button, true, "Menggabungkan file...");
        try {
            const { PDFDocument } = await import("pdf-lib");
            const merged = await PDFDocument.create();
            for (const index of mergeAllOrder) {
                const source = await PDFDocument.load(await mergeAllFiles[index].arrayBuffer());
                const pages = await merged.copyPages(source, source.getPageIndices());
                pages.forEach((page) => merged.addPage(page));
            }
            const bytes = await merged.save();
            const name = safeFileName(document.querySelector("#mergeAllName").value, "Dokumen_Gabungan.pdf", ".pdf");
            downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
            showMessage(result, `${mergeAllFiles.length} file berhasil digabung menjadi ${name}.`, "success");
        } catch (error) {
            showMessage(result, `Gagal menggabungkan PDF: ${error.message}`);
        } finally {
            setBusy(button, false);
        }
    });
}

function renderMergeAllOrder() {
    const container = document.querySelector("#mergeAllOrder");
    container.replaceChildren();
    mergeAllOrder.forEach((fileIndex, orderIndex) => {
        const file = mergeAllFiles[fileIndex];
        const row = document.createElement("div");
        row.className = "sortable-item";
        row.draggable = true;
        row.dataset.fileIndex = String(fileIndex);
        const position = document.createElement("span");
        position.className = "sort-position";
        position.textContent = String(orderIndex + 1).padStart(2, "0");
        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = file.name;
        const size = document.createElement("small");
        size.textContent = formatSize(file.size);
        const controls = document.createElement("span");
        controls.className = "sort-controls";
        controls.append(
            moveButton("Naikkan", "↑", orderIndex, -1),
            moveButton("Turunkan", "↓", orderIndex, 1),
        );
        row.append(position, name, size, controls);
        row.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text/plain", String(fileIndex));
            event.dataTransfer.effectAllowed = "move";
        });
        row.addEventListener("dragover", (event) => {
            event.preventDefault();
            row.classList.add("is-drag-target");
        });
        row.addEventListener("dragleave", () => row.classList.remove("is-drag-target"));
        row.addEventListener("drop", (event) => {
            event.preventDefault();
            row.classList.remove("is-drag-target");
            const sourceFile = event.dataTransfer.getData("text/plain");
            if (/^\d+$/.test(sourceFile)) reorderFiles(Number(sourceFile), fileIndex);
        });
        container.append(row);
    });
}

function moveButton(label, text, index, offset) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sort-button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.disabled = index + offset < 0 || index + offset >= mergeAllOrder.length;
    button.addEventListener("click", () => {
        const nextIndex = index + offset;
        [mergeAllOrder[index], mergeAllOrder[nextIndex]] = [mergeAllOrder[nextIndex], mergeAllOrder[index]];
        renderMergeAllOrder();
    });
    return button;
}

function reorderFiles(sourceFile, targetFile) {
    const sourceIndex = mergeAllOrder.indexOf(sourceFile);
    const targetIndex = mergeAllOrder.indexOf(targetFile);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    mergeAllOrder.splice(sourceIndex, 1);
    mergeAllOrder.splice(targetIndex, 0, sourceFile);
    renderMergeAllOrder();
}

function bindPdfToWord() {
    const input = document.querySelector("#pdfWordFiles");
    enableFileDrop(input, () => renderFileList(document.querySelector("#pdfWordFilesList"), input.files));
    document.querySelector("#convertPdfWord").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const result = document.querySelector("#result");
        const files = [...input.files];
        if (!files.length) return showMessage(result, "Pilih setidaknya satu file PDF.");
        if (files.some((file) => !file.name.toLowerCase().endsWith(".pdf"))) return showMessage(result, "Semua file harus berformat PDF.");

        const selectedPages = parsePageRange(document.querySelector("#pdfPages").value);
        const deleteHyphens = document.querySelector("#removeHyphens").checked;
        setBusy(button, true, "Mengonversi...");
        result.replaceChildren();
        const converted = [];
        const failed = [];
        try {
            const [{ Document, PageBreak, Packer, Paragraph, TextRun }, pdfjsLib, JSZip] = await Promise.all([
                import("docx"),
                import("pdfjs-dist"),
                import("jszip").then((module) => module.default),
            ]);
            pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            for (const [index, file] of files.entries()) {
                showMessage(result, `Memproses ${index + 1} dari ${files.length}: ${file.name}`, "info");
                await new Promise((resolve) => requestAnimationFrame(resolve));
                try {
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    const loadingTask = pdfjsLib.getDocument({ data: bytes });
                    let pdf;
                    let paragraphs;
                    try {
                        pdf = await loadingTask.promise;
                        const pageIndexes = selectedPages
                            ? selectedPages.filter((pageIndex) => pageIndex < pdf.numPages)
                            : Array.from({ length: pdf.numPages }, (_, pageIndex) => pageIndex);
                        if (!pageIndexes.length) throw new Error("Rentang halaman tidak berisi halaman yang ada di PDF.");

                        paragraphs = [];
                        for (const [pageOrder, pageIndex] of pageIndexes.entries()) {
                            const page = await pdf.getPage(pageIndex + 1);
                            const textContent = await page.getTextContent();
                            const lines = groupPageTextLines(textContent.items);
                            const pageParagraphs = joinHyphenatedLines(lines, deleteHyphens);
                            if (pageOrder) paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
                            for (const line of pageParagraphs) {
                                paragraphs.push(new Paragraph({
                                    children: [new TextRun({ text: line, font: "Arial", size: 22 })],
                                    spacing: { after: 120 },
                                }));
                            }
                            page.cleanup();
                        }
                    } finally {
                        await loadingTask.destroy();
                    }
                    const document = new Document({
                        sections: [{ properties: {}, children: paragraphs }],
                    });
                    const blob = await Packer.toBlob(document);
                    converted.push({
                        name: `${file.name.replace(/\.pdf$/i, "")}.docx`,
                        blob,
                        size: blob.size,
                    });
                } catch (error) {
                    failed.push({ name: file.name, error: error.message });
                }
            }

            if (!converted.length) throw new Error(failed.map((item) => `${item.name}: ${item.error}`).join("; "));
            if (converted.length === 1) {
                downloadBlob(converted[0].blob, converted[0].name);
            } else {
                const zip = new JSZip();
                for (const document of converted) zip.file(document.name, document.blob);
                downloadBlob(await zip.generateAsync({ type: "blob" }), "HASIL_CONVERT_WORD.zip");
            }

            showMessage(result, `${converted.length} file berhasil dikonversi.`, "success");
            appendNameList(result, "Dokumen Word", converted.map((document) => `${document.name} (${formatSize(document.size)})`));
            if (failed.length) {
                showMessage(result, `${converted.length} file berhasil; ${failed.length} file gagal dikonversi.`, "warning");
                appendNameList(result, "File yang gagal", failed.map((item) => `${item.name}: ${item.error}`));
            }
        } catch (error) {
            showMessage(result, `Gagal mengonversi PDF: ${error.message}`);
        } finally {
            setBusy(button, false);
        }
    });
}

function groupPageTextLines(items) {
    const positioned = items
        .filter((item) => typeof item.str === "string" && item.str.trim())
        .map((item) => ({
            text: item.str,
            x: item.transform?.[4] ?? 0,
            y: item.transform?.[5] ?? 0,
            tolerance: Math.max(2, (item.height || 10) * 0.35),
        }))
        .sort((left, right) => right.y - left.y || left.x - right.x);

    const lines = [];
    for (const item of positioned) {
        let line = lines.at(-1);
        if (!line || Math.abs(line.y - item.y) > Math.max(line.tolerance, item.tolerance)) {
            line = { y: item.y, tolerance: item.tolerance, pieces: [] };
            lines.push(line);
        }
        line.pieces.push(item);
        line.tolerance = Math.max(line.tolerance, item.tolerance);
    }
    return lines.map((line) => line.pieces.map((piece) => piece.text).join("").replace(/\s+/g, " ").trim()).filter(Boolean);
}

function joinHyphenatedLines(lines, deleteHyphens) {
    if (!deleteHyphens) return lines;
    const paragraphs = [];
    for (let index = 0; index < lines.length; index++) {
        let line = lines[index];
        while (line.endsWith("-") && index + 1 < lines.length) {
            line = line.slice(0, -1) + lines[++index].trimStart();
        }
        paragraphs.push(line);
    }
    return paragraphs;
}

function bindCodes() {
    const type = document.querySelector("#codeType");
    const qrOptions = document.querySelectorAll(".qr-options");
    type.addEventListener("change", () => {
        const isQr = type.value === "QR Code";
        qrOptions.forEach((option) => option.classList.toggle("is-hidden", !isQr));
        qrPreviewBlob = null;
        document.querySelector("#codePreview").replaceChildren();
        document.querySelector("#codeDownload").replaceChildren();
    });

    document.querySelector("#generateCode").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const result = document.querySelector("#result");
        const content = document.querySelector("#codeContent").value;
        const foreground = document.querySelector("#codeForeground").value;
        const background = document.querySelector("#codeBackground").value;
        const preview = document.querySelector("#codePreview");
        const downloadActions = document.querySelector("#codeDownload");
        if (!content.trim()) return showMessage(result, "Konten QR/barcode tidak boleh kosong.");

        setBusy(button, true, "Membuat kode...");
        result.replaceChildren();
        try {
            const canvas = document.createElement("canvas");
            if (type.value === "QR Code") {
                const QRCode = await import("qrcode").then((module) => module.default);
                const boxSize = Number(document.querySelector("#qrBoxSize").value);
                const border = Number(document.querySelector("#qrBorder").value);
                if (!Number.isInteger(boxSize) || boxSize < 1 || boxSize > 40) {
                    throw new Error("Ukuran kotak QR harus antara 1 dan 40.");
                }
                if (!Number.isInteger(border) || border < 0 || border > 20) {
                    throw new Error("Lebar border QR harus antara 0 dan 20.");
                }
                const qr = QRCode.create(content, { errorCorrectionLevel: "M" });
                const dimension = qr.modules.size + border * 2;
                canvas.width = dimension * boxSize;
                canvas.height = dimension * boxSize;
                const context = canvas.getContext("2d");
                context.fillStyle = background;
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = foreground;
                for (let row = 0; row < qr.modules.size; row++) {
                    for (let column = 0; column < qr.modules.size; column++) {
                        if (qr.modules.data[row * qr.modules.size + column]) {
                            context.fillRect(
                                (column + border) * boxSize,
                                (row + border) * boxSize,
                                boxSize,
                                boxSize,
                            );
                        }
                    }
                }
            } else {
                const JsBarcode = await import("jsbarcode").then((module) => module.default);
                if (!/^[\x00-\x7F]+$/.test(content)) {
                    throw new Error("Barcode Code 128 hanya mendukung karakter ASCII. Gunakan QR Code untuk teks Unicode.");
                }
                JsBarcode(canvas, content, {
                    format: "CODE128",
                    lineColor: foreground,
                    background,
                    width: 2,
                    height: 100,
                    displayValue: true,
                    margin: 20,
                });
            }

            qrPreviewBlob = await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Browser tidak dapat membuat gambar PNG.")), "image/png");
            });
            const image = document.createElement("img");
            image.alt = type.value === "QR Code" ? "Pratinjau QR Code" : "Pratinjau barcode Code 128";
            image.src = URL.createObjectURL(qrPreviewBlob);
            image.addEventListener("load", () => URL.revokeObjectURL(image.src), { once: true });
            preview.replaceChildren(image);

            const download = document.createElement("button");
            download.type = "button";
            download.className = "secondary-button";
            download.textContent = "Unduh PNG";
            download.addEventListener("click", () => downloadBlob(
                qrPreviewBlob,
                type.value === "QR Code" ? "qr_code.png" : "barcode_code128.png",
            ));
            downloadActions.replaceChildren(download);
            showMessage(result, "Kode berhasil dibuat.", "success");
        } catch (error) {
            qrPreviewBlob = null;
            preview.replaceChildren();
            downloadActions.replaceChildren();
            showMessage(result, `Gagal membuat kode: ${error.message}`);
        } finally {
            setBusy(button, false);
        }
    });

    type.dispatchEvent(new Event("change"));
}

renderTool();
