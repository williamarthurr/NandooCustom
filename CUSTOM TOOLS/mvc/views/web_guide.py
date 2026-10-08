"""Streamlit guide dialog view."""

import streamlit as st


GUIDES = {
    "📄 Penggabung PDF (by NIK)": {
        "title": "💡 Panduan: Penggabung PDF (by NIK)",
        "body": """
**Cara Penggunaan:**
1. 📤 **Upload** semua file PDF — sistem otomatis mengelompokkan berdasarkan **NIK / ID Karyawan**.
2. ✏️ Isi **Urutan Kata Kunci** (dipisahkan koma) untuk menentukan urutan halaman. Misal: `1, 2` atau `Maret, April`.
3. ✏️ Isi **Nama File Lanjutan** untuk penamaan file hasil. NIK otomatis di depan. Misal: `_SLIP_GAJI` → hasil: `12345_SLIP_GAJI.pdf`.
4. 🚀 Klik **GABUNGKAN PDF** — proses otomatis berjalan.
5. 📦 Klik **DOWNLOAD SEMUA (.ZIP)** untuk mengunduh semua hasil sekaligus.
""",
    },
    "📑 Penggabung PDF (by All)": {
        "title": "💡 Panduan: Penggabung PDF (by All)",
        "body": """
**Cara Penggunaan:**
1. 📤 **Upload** file-file PDF yang ingin digabungkan menjadi **1 file tunggal**.
2. ✋ **Klik & Seret (DRAG)** kartu file ke atas atau ke bawah untuk menentukan urutan halaman. File paling atas = halaman 1.
3. ✏️ Isi **Nama File PDF Hasil Gabungan**.
4. 🚀 Klik **GABUNGKAN SEMUA PDF** — semua file digabung sesuai urutan drag.
5. ⬇️ Klik tombol **DOWNLOAD** untuk mengunduh file hasil.
""",
    },
    "📝 Konversi PDF ke Word": {
        "title": "💡 Panduan: Konversi PDF ke Word (.docx)",
        "body": """
**Keunggulan Konversi Rapi:**
- 📐 **Format Asli Terjaga**: Paragraf, judul, jenis font, spasi baris, dan margin direkonstruksi dengan alami.
- 📊 **Tabel Presisi**: Garis batas (lattice/border) maupun tabel selaras (stream) dikonversi menjadi tabel Word asli yang mudah diedit.
- 🔤 **Tanpa Textbox Berantakan**: Teks mengalir sebagai paragraf Word alami, bukan kotak-kotak terpisah.
- 📦 **Mendukung Konversi Massal**: Konversi satu atau banyak file sekaligus, unduh per file atau file .ZIP.

**Cara Penggunaan:**
1. 📤 **Upload** 1 atau beberapa file PDF.
2. ⚙️ Tentukan **Pengaturan Halaman** (Semua Halaman atau ketik nomor halaman, misal: `1-5`).
3. 🚀 Klik **KONVERSI KE WORD (.DOCX)**.
4. ⬇️ Unduh file Word per dokumen atau unduh **SEMUA HASIL (.ZIP)**.
""",
    },
}


@st.dialog("CUSTOM TOOLS", width="large")
def show_guide(menu_key: str):
    """Render the selected module guide as a modal view."""
    guide = GUIDES.get(menu_key)
    if not guide:
        return
    st.markdown(
        """
        <style>
        @keyframes customGuideFadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        [role="dialog"] {
            animation: customGuideFadeIn 350ms ease-out both;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.markdown(f"### {guide['title']}")
    st.markdown(guide["body"])
    if st.button("✖ Tutup panduan", key="btn_close_popup", use_container_width=True):
        st.session_state["popup_dismissed"] = True
        st.rerun()
