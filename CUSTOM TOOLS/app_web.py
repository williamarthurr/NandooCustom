import os
import datetime
import hashlib
import streamlit as st
import streamlit.components.v1 as components
from mvc.controllers import WebController
from mvc.views.web_guide import show_guide

# --- 1. KOMPONEN CUSTOM DRAG & DROP ---
_component_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drag_drop_component")
drag_drop_sortable = components.declare_component("drag_drop_sortable", path=_component_path)

# --- 2. KONFIGURASI HALAMAN ---
st.set_page_config(
    page_title="CUSTOM TOOLS",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- 3. SIDEBAR BRANDING & NAVIGASI ---
with st.sidebar:
    st.title("CUSTOM")
    st.markdown("")
    st.caption("CUSTOM TOOLS")
    st.divider()

    st.markdown("#### **MENU:**")
    menu = st.radio(
        "Navigasi",
        options=[
            "📊 Monitoring Absensi",
            "📄 Penggabung PDF (by NIK)",
            "📑 Penggabung PDF (by All)",
            "📝 Konversi PDF ke Word",
            "🔳 QR / Barcode Generator",
            "🔒 Tool Lain (Segera Hadir)"
        ],
        label_visibility="collapsed"
    )
    st.markdown(
        """
        <div style="
            position: fixed;
            bottom: 1rem;
            left: 0.75rem;
            width: min(14.5rem, calc(100vw - 1.5rem));
            max-height: calc(100vh - 2rem);
            box-sizing: border-box;
            padding: 0.75rem;
            overflow-y: auto;
            overflow-wrap: anywhere;
            color: inherit;
            z-index: 100;
            line-height: 1.6;
        ">
            <strong>Tech Support</strong>
            <div>
            WhatsApp:
            <a href="https://wa.me/6281388183368" target="_blank">0813-8818-3368</a>
            </div>
            <div>
            Email:
            <a href="mailto:itfernandoo@gmail.com">itfernandoo@gmail.com</a>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

# --- KONTEN UTAMA: MONITORING ABSENSI ---
if menu == "📊 Monitoring Absensi":
    st.title("📊 Monitoring Absensi")
    st.markdown(
        "Unggah laporan **Leave / Trip Report** format Excel untuk merangkum absensi "
        "dan kedisiplinan per karyawan."
    )
    st.caption(
        "SAKIT SURAT DOKTER dan ALPHA dihitung sebagai absensi. Keterangan IJIN "
        "dihitung sebagai kedisiplinan. Setiap baris laporan dihitung sebagai satu kejadian."
    )
    st.divider()

    attendance_file = st.file_uploader(
        "Unggah laporan absensi (.xls atau .xlsx)",
        type=["xls", "xlsx"],
        key="attendance_report",
    )
    attendance_digest = (
        hashlib.sha256(attendance_file.getvalue()).hexdigest()
        if attendance_file is not None
        else None
    )
    if st.button("Proses Monitoring Absensi", type="primary", key="btn_attendance"):
        if attendance_file is None:
            st.error("Silakan unggah file laporan absensi terlebih dahulu.")
        else:
            try:
                records, workbook_bytes = WebController.process_attendance_report(
                    attendance_file.name,
                    attendance_file.getvalue(),
                )
                st.session_state["attendance_result"] = {
                    "filename": attendance_file.name,
                    "digest": attendance_digest,
                    "rows": [record.as_row() for record in records],
                    "workbook": workbook_bytes,
                }
            except (OSError, ValueError) as exc:
                st.session_state.pop("attendance_result", None)
                st.error(f"Gagal memproses laporan: {exc}")

    result = st.session_state.get("attendance_result")
    if (
        result
        and attendance_file
        and result["filename"] == attendance_file.name
        and result["digest"] == attendance_digest
    ):
        st.success(f"Berhasil merangkum {len(result['rows'])} karyawan.")
        st.dataframe(
            result["rows"],
            column_config={
                "SKOR ABSENSI": st.column_config.NumberColumn("SKOR"),
                "SKOR KEDISIPLINAN": st.column_config.NumberColumn("SKOR"),
            },
            use_container_width=True,
            hide_index=True,
        )
        st.download_button(
            "⬇️ Download Hasil Excel",
            data=result["workbook"],
            file_name="Monitoring_Absensi.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
            key="download_attendance",
        )

# Tracking popup per menu (reset saat ganti menu)
if "popup_last_menu" not in st.session_state:
    st.session_state["popup_last_menu"] = None
    st.session_state["popup_dismissed"] = False
if st.session_state["popup_last_menu"] != menu:
    st.session_state["popup_last_menu"] = menu
    st.session_state["popup_dismissed"] = False

# --- 4. KONTEN UTAMA: PENGGABUNG PDF (BY NIK) ---
if menu == "📄 Penggabung PDF (by NIK)":
    if not st.session_state.get("popup_dismissed"):
        show_guide("📄 Penggabung PDF (by NIK)")
    st.title("📄 Penggabung PDF Otomatis (by NIK)")
    st.markdown(
        "Mengelompokkan file PDF berdasarkan **NIK / ID Karyawan** dan mengurutkan halaman "
        "berdasarkan **kata kunci** yang ditentukan."
    )
    st.divider()

    st.subheader("1. Upload File PDF")
    uploaded_files = st.file_uploader(
        "Pilih atau seret (drag & drop) file-file PDF ke area di bawah ini:",
        type=["pdf"],
        accept_multiple_files=True,
        help="Anda dapat memilih banyak file sekaligus (Ctrl + A lalu seret ke sini)",
        key="uploader_nik"
    )

    if uploaded_files:
        st.info(f"📁 Terdeteksi **{len(uploaded_files)}** file PDF siap diproses.")

    st.subheader("2. Pengaturan Penggabungan")
    col1, col2 = st.columns(2)

    with col1:
        kata_kunci = st.text_input(
            "Urutan Kata Kunci (Dipisahkan Koma):",
            value="1, 2, Oktober, November",
            help="Kata kunci di sebelah kiri akan menjadi halaman lebih depan. Contoh: 1, 2 atau Maret, April",
            key="kw_nik"
        )
        st.caption("*Contoh: `1, 2` atau `Maret, April`")

    with col2:
        penamaan_lanjutan = st.text_input(
            "Nama File Lanjutan (Setelah NIK):",
            value="_merged",
            help="NIK otomatis di depan. Contoh: jika diisi _SLIP_GAJI, maka hasil: NIK_SLIP_GAJI.pdf",
            key="nama_nik"
        )
        st.caption("*NIK otomatis di depan. Contoh: `_SLIP_GAJI` atau `- PKWT` (Hasil: `[NIK]_SLIP_GAJI.pdf`)")

    st.write("")
    tombol_proses = st.button("🚀 GABUNGKAN PDF", type="primary", use_container_width=True, key="btn_nik")

    if "hasil_merge" not in st.session_state:
        st.session_state["hasil_merge"] = None
        st.session_state["laporan"] = None
        st.session_state["unpaired"] = None

    if tombol_proses:
        if not uploaded_files:
            st.error("⚠️ Harap upload setidaknya 2 file PDF terlebih dahulu!")
        else:
            with st.spinner("Sedang memproses dan menggabungkan file PDF..."):
                hasil_dict, laporan, unpaired = WebController.merge_by_id(
                    uploaded_files, kata_kunci, penamaan_lanjutan
                )

                st.session_state["hasil_merge"] = hasil_dict
                st.session_state["laporan"] = laporan
                st.session_state["unpaired"] = unpaired

    if st.session_state["hasil_merge"] is not None:
        hasil_dict = st.session_state["hasil_merge"]
        laporan = st.session_state["laporan"]
        unpaired = st.session_state["unpaired"]

        st.divider()
        if hasil_dict:
            st.success(f"🎉 **Selesai!** Berhasil menggabungkan **{len(hasil_dict)} pasang** file PDF.")

            zip_bytes = WebController.create_zip(hasil_dict)
            waktu_sekarang = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            nama_zip = f"HASIL_MERGE_PDF_{waktu_sekarang}.zip"

            st.download_button(
                label=f"📦 DOWNLOAD SEMUA HASIL ({len(hasil_dict)} FILE - .ZIP)",
                data=zip_bytes,
                file_name=nama_zip,
                mime="application/zip",
                type="primary",
                use_container_width=True
            )

            st.write("")
            tab_hasil, tab_unpaired = st.tabs(["📋 Rincian File yang Berhasil Digabung", "⚠️ File Tanpa Pasangan"])

            with tab_hasil:
                for item in laporan:
                    with st.expander(f"📄 **{item['output']}** (NIK: `{item['nik']}`) — {item['size_kb']} KB"):
                        st.write(f"**Jumlah file asal:** {item['count']}")
                        st.write("**File asal yang digabung:**")
                        for f in item["files"]:
                            st.write(f"- {f}")
                        
                        st.download_button(
                            label=f"⬇️ Download {item['output']}",
                            data=hasil_dict[item['output']],
                            file_name=item['output'],
                            mime="application/pdf",
                            key=f"dl_{item['output']}"
                        )

            with tab_unpaired:
                if unpaired:
                    st.warning(
                        f"Ditemukan **{len(unpaired)}** file yang tidak memiliki pasangan NIK yang sama:"
                    )
                    for f in unpaired:
                        st.write(f"- `{f}`")
                else:
                    st.info("Semua file PDF yang diupload memiliki pasangan NIK dan berhasil digabungkan.")
        else:
            st.warning("⚠️ Tidak ditemukan file PDF dengan pasangan 4-digit ID/NIK yang sama.")
            if unpaired:
                st.write("**File yang terdeteksi:**")
                for f in unpaired:
                    st.write(f"- `{f}`")


# --- 5. KONTEN UTAMA: PENGGABUNG PDF (BY ALL) DENGAN DRAG & DROP ---
elif menu == "📑 Penggabung PDF (by All)":
    if not st.session_state.get("popup_dismissed"):
        show_guide("📑 Penggabung PDF (by All)")
    st.title("📑 Penggabung PDF (by All)")
    st.markdown(
        "Menggabungkan seluruh file PDF yang dipilih menjadi **1 file dokumen utuh**. "
        "Anda dapat **mengklik dan menyeret (DRAG)** posisi file di bawah untuk menentukan halaman mana yang pertama, kedua, dan seterusnya."
    )
    st.divider()

    st.subheader("1. Upload File PDF")
    uploaded_all = st.file_uploader(
        "Upload file-file PDF yang ingin digabungkan:",
        type=["pdf"],
        accept_multiple_files=True,
        help="Pilih 2 atau lebih file PDF untuk digabungkan menjadi 1 file",
        key="uploader_all"
    )

    if uploaded_all:
        total_files = len(uploaded_all)
        st.info(f"📁 Terdeteksi **{total_files}** file PDF.")

        # Inisialisasi daftar urutan index jika belum ada atau jumlah file berubah
        if "order_indices" not in st.session_state or len(st.session_state["order_indices"]) != total_files:
            st.session_state["order_indices"] = list(range(total_files))

        current_indices = st.session_state["order_indices"]

        st.subheader("2. Atur Urutan Halaman (Klik & Seret / Drag)")
        st.markdown(
            "💡 **Petunjuk:** Klik dan **seret (DRAG)** kartu file ke atas atau ke bawah untuk menukar urutan. "
            "File pada posisi paling atas (**#1**) akan menjadi halaman depan."
        )

        items_for_sort = [
            {
                "index": idx,
                "name": uploaded_all[idx].name,
                "size": round(len(uploaded_all[idx].getvalue()) / 1024, 1)
            }
            for idx in current_indices
        ]

        # Komponen Interaktif HTML5 Drag & Drop
        new_order = drag_drop_sortable(
            items=items_for_sort,
            default=current_indices,
            key=f"drag_sorter_key_{total_files}"
        )

        # Update urutan jika ada hasil drag yang valid
        if new_order and isinstance(new_order, list) and len(new_order) == total_files:
            st.session_state["order_indices"] = new_order

        active_indices = st.session_state["order_indices"]

        st.divider()
        st.subheader("3. Nama File Hasil & Gabungkan")

        col1, col2 = st.columns([3, 2])
        with col1:
            nama_file_gabungan = st.text_input(
                "Nama File PDF Hasil Gabungan:",
                value="Dokumen_Gabungan.pdf",
                help="Nama file PDF yang akan diunduh",
                key="nama_output_all"
            )
            if not nama_file_gabungan.lower().endswith(".pdf"):
                nama_file_gabungan += ".pdf"

        with col2:
            st.write("")
            st.write("")
            btn_gabung_all = st.button(
                "🚀 GABUNGKAN SEMUA PDF",
                type="primary",
                use_container_width=True,
                key="btn_all_submit"
            )

        # Proses saat tombol ditekan
        if btn_gabung_all:
            if total_files < 2:
                st.error("⚠️ Harap upload minimal 2 file PDF untuk digabungkan!")
            else:
                with st.spinner("Sedang menggabungkan semua file PDF sesuai urutan..."):
                    try:
                        ordered_files = [uploaded_all[idx] for idx in active_indices]
                        merged_bytes = WebController.merge_all(ordered_files)
                        st.session_state["hasil_merge_all"] = merged_bytes
                    except Exception as e:
                        st.error(f"Gagal menggabungkan PDF: {e}")

        # Tampilkan Tombol Download jika hasil sudah ada
        if st.session_state.get("hasil_merge_all") is not None:
            st.success(
                f"🎉 **Selesai!** Berhasil menggabungkan **{total_files} file** menjadi `{nama_file_gabungan}`."
            )
            st.download_button(
                label=f"⬇️ DOWNLOAD {nama_file_gabungan}",
                data=st.session_state["hasil_merge_all"],
                file_name=nama_file_gabungan,
                mime="application/pdf",
                type="primary",
                use_container_width=True
            )

    else:
        st.session_state["hasil_merge_all"] = None


# --- 6. KONTEN UTAMA: KONVERSI PDF KE WORD (.DOCX RAPIH) ---
elif menu == "📝 Konversi PDF ke Word":
    if not st.session_state.get("popup_dismissed"):
        show_guide("📝 Konversi PDF ke Word")

    st.title("📝 Konversi PDF ke Word (.docx)")
    st.markdown(
        "Mengonversi file dokumen PDF menjadi dokumen **Microsoft Word (.docx)** dengan **tata letak rapi, "
        "format font terjaga, dan tabel yang dapat diedit langsung** (bukan sekadar textbox berantakan)."
    )
    st.divider()

    st.subheader("1. Upload File PDF")
    uploaded_pdf_list = st.file_uploader(
        "Pilih atau seret (drag & drop) file-file PDF ke area di bawah ini:",
        type=["pdf"],
        accept_multiple_files=True,
        help="Mendukung konversi satu file maupun banyak file sekaligus",
        key="uploader_pdf_to_word"
    )

    if uploaded_pdf_list:
        st.info(f"📁 Terdeteksi **{len(uploaded_pdf_list)}** file PDF siap dikonversi.")

    st.subheader("2. Pengaturan Kerapihan Dokumen")
    col_w1, col_w2 = st.columns(2)

    with col_w1:
        rentang_halaman = st.text_input(
            "Rentang Halaman (Opsional):",
            value="",
            placeholder="Contoh: 1-3, 5 atau kosongkan untuk Semua",
            help="Kosongkan jika ingin mengonversi seluruh halaman dokumen PDF.",
            key="pages_pdf_to_word"
        )
        st.caption("*Kosongkan untuk **Semua Halaman**, atau ketik misal: `1-5` atau `1, 3, 5-7`")

    with col_w2:
        st.write("**Opsi Rekonstruksi Layout:**")
        opt_hyphen = st.checkbox(
            "Rapihkan spasi & tanda hubung akhir baris (hyphenation)",
            value=True,
            help="Menghilangkan pemenggalan kata otomatis pada akhir baris agar teks menyatu alami.",
            key="chk_hyphen"
        )
        st.caption("✨ *Tabel garis batas, tabel teks selaras, dan daftar poin (bullet list) otomatis direkonstruksi menjadi format Word asli.*")

    st.write("")
    btn_convert_word = st.button(
        "🚀 KONVERSI KE WORD (.DOCX)",
        type="primary",
        use_container_width=True,
        key="btn_convert_pdf_to_word"
    )

    if "hasil_pdf_to_word" not in st.session_state:
        st.session_state["hasil_pdf_to_word"] = None
        st.session_state["laporan_pdf_to_word"] = None

    if btn_convert_word:
        if not uploaded_pdf_list:
            st.error("⚠️ Harap upload setidaknya 1 file PDF terlebih dahulu!")
        else:
            with st.spinner("Sedang memproses dan merekonstruksi dokumen PDF ke format Word (.docx)..."):
                try:
                    hasil_dict, laporan = WebController.convert_batch_pdf_to_word(
                        files=uploaded_pdf_list,
                        pages_spec=rentang_halaman,
                        delete_hyphen=opt_hyphen
                    )
                    st.session_state["hasil_pdf_to_word"] = hasil_dict
                    st.session_state["laporan_pdf_to_word"] = laporan
                except Exception as exc:
                    st.error(f"Gagal melakukan konversi: {exc}")

    if st.session_state.get("hasil_pdf_to_word") is not None:
        hasil_word = st.session_state["hasil_pdf_to_word"]
        laporan_word = st.session_state["laporan_pdf_to_word"]

        st.divider()
        if hasil_word:
            sukses_count = sum(1 for item in laporan_word if item.get("status") == "success")
            st.success(f"🎉 **Selesai!** Berhasil mengonversi **{sukses_count} file** menjadi dokumen Word (.docx) yang rapi.")

            # Jika lebih dari 1 file, sediakan download ZIP
            if len(hasil_word) > 1:
                zip_bytes = WebController.create_zip(hasil_word)
                waktu_sekarang = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                nama_zip = f"HASIL_CONVERT_WORD_{waktu_sekarang}.zip"

                st.download_button(
                    label=f"📦 DOWNLOAD SEMUA HASIL ({len(hasil_word)} DOKUMEN WORD - .ZIP)",
                    data=zip_bytes,
                    file_name=nama_zip,
                    mime="application/zip",
                    type="primary",
                    use_container_width=True
                )
                st.write("")

            st.subheader("📋 Daftar Dokumen Hasil Konversi")
            for item in laporan_word:
                if item.get("status") == "success":
                    out_name = item["output"]
                    with st.expander(f"📄 **{out_name}** — {item['size_kb']} KB (Sumber: `{item['source']}`)", expanded=True):
                        st.write(f"✅ Format teks, tata letak, dan tabel berhasil direkonstruksi.")
                        st.download_button(
                            label=f"⬇️ Download {out_name}",
                            data=hasil_word[out_name],
                            file_name=out_name,
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key=f"dl_word_{out_name}"
                        )
                else:
                    st.error(f"❌ Gagal mengonversi `{item['source']}`: {item.get('error')}")


# --- 7. KONTEN UTAMA: QR / BARCODE GENERATOR ---
elif menu == "🔳 QR / Barcode Generator":
    st.title("🔳 QR / Barcode Generator")
    st.markdown(
        "Buat QR code untuk teks atau URL, atau barcode **Code 128** untuk nomor produk "
        "dan teks ASCII. Hasil dapat diunduh sebagai PNG."
    )
    st.divider()

    code_type = st.selectbox(
        "Jenis kode:",
        options=["QR Code", "Barcode (Code 128)"],
        key="code_generator_type",
    )
    code_content = st.text_area(
        "Konten yang akan disimpan:",
        placeholder="Masukkan teks, URL, atau nomor produk",
        key="code_generator_content",
    )
    color_col1, color_col2 = st.columns(2)
    with color_col1:
        foreground = st.color_picker(
            "Warna kode:", value="#000000", key="code_generator_foreground"
        )
    with color_col2:
        background = st.color_picker(
            "Warna latar:", value="#FFFFFF", key="code_generator_background"
        )

    qr_box_size = 10
    qr_border = 4
    if code_type == "QR Code":
        option_col1, option_col2 = st.columns(2)
        with option_col1:
            qr_box_size = st.slider(
                "Ukuran kotak QR:",
                min_value=2,
                max_value=20,
                value=10,
                key="code_generator_box_size",
            )
        with option_col2:
            qr_border = st.slider(
                "Lebar border QR:",
                min_value=1,
                max_value=10,
                value=4,
                key="code_generator_border",
            )
        st.caption(
            "Ukuran kotak mengatur besar tiap titik QR. Lebar border mengatur ruang kosong "
            "di sekeliling kode dalam satuan modul QR; gunakan border yang cukup agar QR mudah dipindai."
        )
    else:
        st.caption(
            "Code 128 cocok untuk barcode produk, nomor seri, dan teks ASCII pendek. "
            "Pilih QR Code untuk teks Unicode."
        )

    generator_config = (
        code_content,
        code_type,
        foreground,
        background,
        qr_box_size,
        qr_border,
    )
    if st.button("Buat QR / Barcode", type="primary", key="btn_generate_code"):
        try:
            st.session_state["generated_code_image"] = WebController.generate_code(
                content=code_content,
                code_type=code_type,
                foreground=foreground,
                background=background,
                qr_box_size=qr_box_size,
                qr_border=qr_border,
            )
            st.session_state["generated_code_config"] = generator_config
        except Exception as exc:
            st.session_state["generated_code_image"] = None
            st.error(f"Gagal membuat QR / barcode: {exc}")

    generated_code = st.session_state.get("generated_code_image")
    if generated_code and st.session_state.get("generated_code_config") == generator_config:
        st.image(generated_code, caption=f"Hasil {code_type}", width=250)
        st.download_button(
            label="⬇️ Download PNG",
            data=generated_code,
            file_name="qr_code.png" if code_type == "QR Code" else "barcode_code128.png",
            mime="image/png",
            type="primary",
            key="download_generated_code",
        )


# --- 8. KONTEN UTAMA: TOOL LAIN ---
elif menu == "🔒 Tool Lain (Segera Hadir)":
    st.title("🔒 Tool Lain")
    st.info("Fitur utilitas tambahan sedang dalam tahap pengembangan dan akan segera hadir.")
