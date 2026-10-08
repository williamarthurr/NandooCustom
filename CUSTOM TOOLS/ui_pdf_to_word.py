import os
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from mvc.models import PdfToWordModel


class PagePdfToWord(tk.Frame):
    """Tkinter view for converting PDF files to formatted Word (.docx) documents."""

    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        self.selected_files = []
        self.is_converting = False
        self.setup_ui()

    def setup_ui(self):
        # 1. Header + Tombol Kembali
        header_frame = tk.Frame(self)
        header_frame.pack(fill="x", padx=15, pady=12)

        btn_back = ttk.Button(
            header_frame,
            text="< Kembali",
            command=lambda: self.controller.show_frame("DashboardMenu"),
        )
        btn_back.pack(side="left")

        lbl_title = tk.Label(
            header_frame,
            text="Konversi PDF ke Word (.docx)",
            font=("Segoe UI", 12, "bold"),
        )
        lbl_title.pack(side="left", padx=15)

        lbl_badge = tk.Label(
            header_frame,
            text="Layout & Tabel Rapi",
            font=("Segoe UI", 9, "bold"),
            bg="#e8f4fd",
            fg="#0066cc",
            padx=8,
            pady=2,
        )
        lbl_badge.pack(side="left")

        # 2. Main Container
        container = tk.Frame(self, padx=25, pady=5)
        container.pack(fill="both", expand=True)

        # Toolbar Pilihan File
        toolbar_frame = tk.Frame(container)
        toolbar_frame.pack(fill="x", pady=(0, 6))

        btn_add_files = ttk.Button(
            toolbar_frame,
            text="📄 Pilih File PDF...",
            command=self.pilih_file_pdf,
        )
        btn_add_files.pack(side="left", padx=(0, 8))

        btn_add_folder = ttk.Button(
            toolbar_frame,
            text="📁 Pilih dari Folder...",
            command=self.pilih_dari_folder,
        )
        btn_add_folder.pack(side="left", padx=(0, 8))

        btn_remove = ttk.Button(
            toolbar_frame,
            text="➖ Hapus Terpilih",
            command=self.hapus_terpilih,
        )
        btn_remove.pack(side="left", padx=(0, 8))

        btn_clear = ttk.Button(
            toolbar_frame,
            text="🗑️ Bersihkan Daftar",
            command=self.bersihkan_daftar,
        )
        btn_clear.pack(side="left")

        # Listbox / Tabel Daftar File PDF
        list_container = tk.Frame(container)
        list_container.pack(fill="both", expand=True, pady=(0, 8))

        cols = ("nama", "ukuran", "status")
        self.tree = ttk.Treeview(list_container, columns=cols, show="headings", height=7)
        self.tree.heading("nama", text="Nama File PDF")
        self.tree.heading("ukuran", text="Ukuran")
        self.tree.heading("status", text="Status")
        self.tree.column("nama", width=420, anchor="w")
        self.tree.column("ukuran", width=110, anchor="center")
        self.tree.column("status", width=140, anchor="center")

        scrollbar = ttk.Scrollbar(list_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # 3. Form Pengaturan & Tujuan
        form_frame = tk.Frame(container)
        form_frame.pack(fill="x", pady=(4, 6))
        form_frame.columnconfigure(0, weight=0)
        form_frame.columnconfigure(1, weight=1)
        form_frame.columnconfigure(2, weight=0)

        # Folder Tujuan
        lbl_tujuan = tk.Label(form_frame, text="Folder Hasil Word:", font=("Segoe UI", 9))
        lbl_tujuan.grid(row=0, column=0, sticky="w", pady=4, padx=(0, 10))
        self.entry_tujuan = ttk.Entry(form_frame)
        self.entry_tujuan.grid(row=0, column=1, sticky="ew", pady=4)
        btn_tujuan = ttk.Button(form_frame, text="Cari...", command=self.pilih_folder_tujuan)
        btn_tujuan.grid(row=0, column=2, padx=(8, 0), pady=4)

        # Pengaturan Halaman
        lbl_halaman = tk.Label(form_frame, text="Rentang Halaman:", font=("Segoe UI", 9))
        lbl_halaman.grid(row=1, column=0, sticky="w", pady=4, padx=(0, 10))
        self.entry_halaman = ttk.Entry(form_frame)
        self.entry_halaman.grid(row=1, column=1, sticky="ew", pady=4)
        lbl_halaman_info = tk.Label(
            form_frame,
            text="*Kosongkan untuk Semua Halaman, atau isi contoh: 1-3, 5",
            font=("Segoe UI", 8, "italic"),
            fg="gray",
        )
        lbl_halaman_info.grid(row=2, column=1, sticky="w", pady=(0, 4))

        # Checkbox Opsi Kerapihan
        self.var_hyphen = tk.BooleanVar(value=True)
        chk_hyphen = ttk.Checkbutton(
            form_frame,
            text="Rapihkan tanda hubung akhir baris (hyphenation)",
            variable=self.var_hyphen,
        )
        chk_hyphen.grid(row=3, column=1, sticky="w", pady=(2, 6))

        # Progress bar
        self.progress_bar = ttk.Progressbar(container, orient="horizontal", mode="determinate")
        self.progress_bar.pack(fill="x", pady=(2, 4))

        self.lbl_status = tk.Label(
            container,
            text="Siap untuk konversi.",
            font=("Segoe UI", 9),
            fg="#555555",
        )
        self.lbl_status.pack(anchor="w", pady=(0, 6))

        # Tombol Aksi
        btn_action_frame = tk.Frame(container)
        btn_action_frame.pack(fill="x", pady=(4, 10))

        self.btn_konversi = tk.Button(
            btn_action_frame,
            text="🚀 KONVERSI KE WORD (.DOCX)",
            bg="#6f42c1",
            fg="white",
            font=("Segoe UI", 10, "bold"),
            relief="flat",
            padx=18,
            pady=8,
            cursor="hand2",
            command=self.mulai_konversi,
        )
        self.btn_konversi.pack(side="left", padx=(0, 10))

        self.btn_buka_folder = tk.Button(
            btn_action_frame,
            text="📂 BUKA FOLDER HASIL",
            bg="#007bff",
            fg="white",
            font=("Segoe UI", 10, "bold"),
            relief="flat",
            padx=18,
            pady=8,
            cursor="hand2",
            command=self.buka_folder_hasil,
        )

    def pilih_file_pdf(self):
        files = filedialog.askopenfilenames(
            title="Pilih File PDF untuk Dikonversi ke Word",
            filetypes=[("PDF Files", "*.pdf")],
        )
        if files:
            self._tambahkan_path_file(files)

    def pilih_dari_folder(self):
        folder = filedialog.askdirectory(title="Pilih Folder Berisi File PDF")
        if folder:
            pdf_files = [
                os.path.join(folder, f)
                for f in os.listdir(folder)
                if f.lower().endswith(".pdf")
            ]
            if pdf_files:
                self._tambahkan_path_file(pdf_files)
                if not self.entry_tujuan.get():
                    self.entry_tujuan.delete(0, tk.END)
                    self.entry_tujuan.insert(0, os.path.join(folder, "HASIL_WORD"))
            else:
                messagebox.showinfo("Informasi", "Tidak ditemukan file PDF di dalam folder tersebut.")

    def _tambahkan_path_file(self, file_paths):
        for path in file_paths:
            norm_path = os.path.normpath(path)
            if norm_path not in self.selected_files:
                self.selected_files.append(norm_path)
                size_kb = round(os.path.getsize(norm_path) / 1024, 1)
                self.tree.insert(
                    "",
                    "end",
                    iid=norm_path,
                    values=(os.path.basename(norm_path), f"{size_kb} KB", "Menunggu"),
                )

        if self.selected_files and not self.entry_tujuan.get():
            first_dir = os.path.dirname(self.selected_files[0])
            self.entry_tujuan.delete(0, tk.END)
            self.entry_tujuan.insert(0, os.path.join(first_dir, "HASIL_WORD"))

        self.btn_buka_folder.pack_forget()
        self.lbl_status.config(
            text=f"Total {len(self.selected_files)} file PDF dipilih.",
            fg="#28a745",
        )

    def hapus_terpilih(self):
        selected = self.tree.selection()
        for item in selected:
            if item in self.selected_files:
                self.selected_files.remove(item)
            self.tree.delete(item)
        self.lbl_status.config(text=f"Tersisa {len(self.selected_files)} file PDF.")

    def bersihkan_daftar(self):
        self.selected_files.clear()
        for item in self.tree.get_children():
            self.tree.delete(item)
        self.progress_bar["value"] = 0
        self.lbl_status.config(text="Daftar file dibersihkan.", fg="#555555")
        self.btn_buka_folder.pack_forget()

    def pilih_folder_tujuan(self):
        folder = filedialog.askdirectory(title="Pilih Folder Hasil Word")
        if folder:
            self.entry_tujuan.delete(0, tk.END)
            self.entry_tujuan.insert(0, folder)
            self.btn_buka_folder.pack_forget()

    def buka_folder_hasil(self):
        folder = self.entry_tujuan.get().strip()
        try:
            PdfToWordModel.open_folder(folder)
        except Exception as e:
            messagebox.showerror("Gagal", f"Tidak dapat membuka folder: {e}")

    def mulai_konversi(self):
        if self.is_converting:
            return

        if not self.selected_files:
            messagebox.showwarning("Peringatan", "Harap pilih minimal 1 file PDF untuk dikonversi!")
            return

        target_folder = self.entry_tujuan.get().strip()
        if not target_folder:
            messagebox.showwarning("Peringatan", "Harap tentukan folder tujuan hasil Word!")
            return

        pages_spec = self.entry_halaman.get().strip()
        delete_hyphen = self.var_hyphen.get()

        self.is_converting = True
        self.btn_konversi.config(state="disabled", text="⏳ Sedang Mengonversi...")
        self.btn_buka_folder.pack_forget()
        self.progress_bar["value"] = 0
        self.progress_bar["maximum"] = len(self.selected_files)

        thread = threading.Thread(
            target=self._proses_konversi_worker,
            args=(list(self.selected_files), target_folder, pages_spec, delete_hyphen),
            daemon=True,
        )
        thread.start()

    def _proses_konversi_worker(self, files, target_folder, pages_spec, delete_hyphen):
        total = len(files)
        success_count = 0
        os.makedirs(target_folder, exist_ok=True)

        for index, pdf_path in enumerate(files, start=1):
            file_name = os.path.basename(pdf_path)
            docx_name = f"{os.path.splitext(file_name)[0]}.docx"
            docx_path = os.path.join(target_folder, docx_name)

            self.after(
                0,
                lambda i=index, fn=file_name: self.lbl_status.config(
                    text=f"Mengonversi [{i}/{total}]: {fn}...", fg="#0066cc"
                ),
            )

            try:
                PdfToWordModel.convert_file(
                    pdf_path=pdf_path,
                    docx_path=docx_path,
                    pages_spec=pages_spec,
                    delete_hyphen=delete_hyphen,
                )
                success_count += 1
                status_txt = "✅ Berhasil"
            except Exception as e:
                status_txt = f"❌ Gagal: {str(e)[:25]}"

            self.after(0, lambda p=pdf_path, st=status_txt: self._update_row_status(p, st))
            self.after(0, lambda i=index: self._update_progress(i))

        self.after(
            0,
            lambda: self._konversi_selesai(success_count, total, target_folder),
        )

    def _update_row_status(self, pdf_path, status_text):
        if self.tree.exists(pdf_path):
            current_vals = list(self.tree.item(pdf_path, "values"))
            if len(current_vals) >= 3:
                current_vals[2] = status_text
                self.tree.item(pdf_path, values=current_vals)

    def _update_progress(self, current_val):
        self.progress_bar["value"] = current_val

    def _konversi_selesai(self, success_count, total, target_folder):
        self.is_converting = False
        self.btn_konversi.config(state="normal", text="🚀 KONVERSI KE WORD (.DOCX)")
        self.lbl_status.config(
            text=f"Selesai! {success_count} dari {total} file berhasil dikonversi ke Word.",
            fg="#28a745" if success_count > 0 else "#dc3545",
        )
        self.btn_buka_folder.pack(side="left")
        if success_count > 0:
            messagebox.showinfo(
                "Konversi Selesai",
                f"Berhasil mengonversi {success_count} file PDF menjadi Word (.docx) di:\n{target_folder}",
            )
        else:
            messagebox.showerror("Gagal", "Tidak ada file yang berhasil dikonversi.")

