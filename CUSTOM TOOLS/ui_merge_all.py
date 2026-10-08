import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from mvc.models import PdfAllMergeModel

class PageMergeAllPDF(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        self.files_list = []  # Menyimpan full path file-file PDF yang dipilih
        self.drag_start_index = None
        self.setup_ui()

    def setup_ui(self):
        # 1. Header + Tombol Kembali
        header_frame = tk.Frame(self)
        header_frame.pack(fill="x", padx=15, pady=12)

        btn_back = ttk.Button(header_frame, text="< Kembali", command=lambda: self.controller.show_frame("DashboardMenu"))
        btn_back.pack(side="left")

        lbl_title = tk.Label(header_frame, text="Penggabung PDF (by All)", font=("Segoe UI", 12, "bold"))
        lbl_title.pack(side="left", padx=15)

        # 2. Main Container
        container = tk.Frame(self, padx=25, pady=5)
        container.pack(fill="both", expand=True)

        # Toolbar Tombol Tambah File
        toolbar_frame = tk.Frame(container)
        toolbar_frame.pack(fill="x", pady=(0, 6))

        btn_add_files = ttk.Button(toolbar_frame, text="➕ Tambah File PDF...", command=self.tambah_file_pdf)
        btn_add_files.pack(side="left", padx=(0, 8))

        btn_add_folder = ttk.Button(toolbar_frame, text="📁 Tambah Semua dari Folder...", command=self.tambah_dari_folder)
        btn_add_folder.pack(side="left", padx=(0, 8))

        btn_clear = ttk.Button(toolbar_frame, text="🗑️ Bersihkan Daftar", command=self.bersihkan_daftar)
        btn_clear.pack(side="left")

        # Petunjuk Drag & Drop
        lbl_hint = tk.Label(
            container,
            text="💡 Petunjuk Urutan: Klik & seret (DRAG) nama file ke atas/bawah untuk mengubah urutan halaman.",
            font=("Segoe UI", 8, "italic"),
            fg="#0066cc"
        )
        lbl_hint.pack(anchor="w", pady=(0, 6))

        # Area Listbox & Tombol Sort
        list_container = tk.Frame(container)
        list_container.pack(fill="both", expand=True, pady=(0, 10))

        # Listbox + Scrollbar
        list_subframe = tk.Frame(list_container)
        list_subframe.pack(side="left", fill="both", expand=True)

        self.scrollbar = ttk.Scrollbar(list_subframe, orient="vertical")
        self.listbox = tk.Listbox(
            list_subframe,
            font=("Segoe UI", 9),
            selectmode=tk.SINGLE,
            yscrollcommand=self.scrollbar.set,
            relief="solid",
            bd=1,
            activestyle="none"
        )
        self.scrollbar.config(command=self.listbox.yview)
        self.scrollbar.pack(side="right", fill="y")
        self.listbox.pack(side="left", fill="both", expand=True)

        # Event Binding untuk Drag and Drop Reordering
        self.listbox.bind('<Button-1>', self.on_drag_start)
        self.listbox.bind('<B1-Motion>', self.on_drag_motion)

        # Tombol Naik / Turun / Hapus di sebelah listbox
        sort_btn_frame = tk.Frame(list_container, padx=8)
        sort_btn_frame.pack(side="right", fill="y", anchor="n")

        btn_up = ttk.Button(sort_btn_frame, text="🔼 Naikkan", width=12, command=self.pindah_naik)
        btn_up.pack(pady=4)

        btn_down = ttk.Button(sort_btn_frame, text="🔽 Turunkan", width=12, command=self.pindah_turun)
        btn_down.pack(pady=4)

        btn_delete_one = ttk.Button(sort_btn_frame, text="❌ Hapus Item", width=12, command=self.hapus_item_terpilih)
        btn_delete_one.pack(pady=(12, 4))

        self.lbl_total_files = tk.Label(sort_btn_frame, text="Total: 0 file", font=("Segoe UI", 8, "bold"), fg="gray")
        self.lbl_total_files.pack(pady=(10, 0))

        # 3. Form Pengaturan Output
        output_frame = tk.Frame(container)
        output_frame.pack(fill="x", pady=6)

        output_frame.columnconfigure(0, weight=0)
        output_frame.columnconfigure(1, weight=1)
        output_frame.columnconfigure(2, weight=0)

        # Folder Tujuan
        lbl_tujuan = tk.Label(output_frame, text="Folder Simpan:", font=("Segoe UI", 9))
        lbl_tujuan.grid(row=0, column=0, sticky="w", pady=5, padx=(0, 10))
        self.entry_tujuan = ttk.Entry(output_frame)
        self.entry_tujuan.grid(row=0, column=1, sticky="ew", pady=5)
        btn_tujuan = ttk.Button(output_frame, text="Cari...", command=self.pilih_folder_tujuan)
        btn_tujuan.grid(row=0, column=2, padx=(8, 0), pady=5)

        # Nama File Output
        lbl_nama = tk.Label(output_frame, text="Nama File Hasil:", font=("Segoe UI", 9))
        lbl_nama.grid(row=1, column=0, sticky="w", pady=5, padx=(0, 10))
        self.entry_nama_output = ttk.Entry(output_frame)
        self.entry_nama_output.insert(0, "Dokumen_Gabungan.pdf")
        self.entry_nama_output.grid(row=1, column=1, sticky="ew", pady=5)

        # 4. Tombol Aksi
        btn_action_frame = tk.Frame(container)
        btn_action_frame.pack(anchor="w", pady=(10, 15))

        self.btn_proses = tk.Button(
            btn_action_frame, text="🚀 GABUNGKAN SEMUA PDF", bg="#28a745", fg="white",
            font=("Segoe UI", 10, "bold"), relief="flat", padx=16, pady=7,
            cursor="hand2", command=self.jalankan_proses
        )
        self.btn_proses.pack(side="left", padx=(0, 10))

        self.btn_buka_folder = tk.Button(
            btn_action_frame, text="📂 BUKA FOLDER HASIL", bg="#007bff", fg="white",
            font=("Segoe UI", 10, "bold"), relief="flat", padx=16, pady=7,
            cursor="hand2", command=self.buka_folder_hasil
        )

    # --- LOGIKA DRAG & DROP REORDERING ---
    def on_drag_start(self, event):
        self.drag_start_index = self.listbox.nearest(event.y)

    def on_drag_motion(self, event):
        target_index = self.listbox.nearest(event.y)
        if self.drag_start_index is not None and target_index != self.drag_start_index:
            if 0 <= target_index < len(self.files_list):
                # Pindahkan file di list Python
                item = self.files_list.pop(self.drag_start_index)
                self.files_list.insert(target_index, item)
                self.drag_start_index = target_index
                self.refresh_listbox(select_index=target_index)

    # --- METODE PEMBANTU LISTBOX ---
    def refresh_listbox(self, select_index=None):
        self.listbox.delete(0, tk.END)
        for i, filepath in enumerate(self.files_list, 1):
            filename = os.path.basename(filepath)
            self.listbox.insert(tk.END, f"  {i}.  {filename}  ({filepath})")
        
        self.lbl_total_files.config(text=f"Total: {len(self.files_list)} file")
        if select_index is not None and 0 <= select_index < len(self.files_list):
            self.listbox.selection_set(select_index)
            self.listbox.activate(select_index)

    def tambah_file_pdf(self):
        files = filedialog.askopenfilenames(
            title="Pilih File PDF untuk Digabungkan",
            filetypes=[("File PDF", "*.pdf")]
        )
        if files:
            self.btn_buka_folder.pack_forget()
            for f in files:
                if f not in self.files_list:
                    self.files_list.append(f)
            
            # Default folder simpan mengikuti folder file pertama jika belum terisi
            if not self.entry_tujuan.get() and self.files_list:
                first_dir = os.path.dirname(self.files_list[0])
                self.entry_tujuan.delete(0, tk.END)
                self.entry_tujuan.insert(0, os.path.join(first_dir, "HASIL_MERGE_ALL"))

            self.refresh_listbox()

    def tambah_dari_folder(self):
        folder = filedialog.askdirectory(title="Pilih Folder yang Berisi File PDF")
        if folder:
            self.btn_buka_folder.pack_forget()
            pdf_files = [
                os.path.join(folder, f) for f in os.listdir(folder)
                if f.lower().endswith('.pdf') and not f.endswith('_merged.pdf')
            ]
            for f in sorted(pdf_files):
                if f not in self.files_list:
                    self.files_list.append(f)

            if not self.entry_tujuan.get():
                self.entry_tujuan.delete(0, tk.END)
                self.entry_tujuan.insert(0, os.path.join(folder, "HASIL_MERGE_ALL"))

            self.refresh_listbox()

    def bersihkan_daftar(self):
        self.files_list.clear()
        self.refresh_listbox()
        self.btn_buka_folder.pack_forget()

    def hapus_item_terpilih(self):
        selected = self.listbox.curselection()
        if selected:
            idx = selected[0]
            self.files_list.pop(idx)
            new_idx = min(idx, len(self.files_list) - 1) if self.files_list else None
            self.refresh_listbox(select_index=new_idx)

    def pindah_naik(self):
        selected = self.listbox.curselection()
        if selected and selected[0] > 0:
            idx = selected[0]
            self.files_list[idx - 1], self.files_list[idx] = self.files_list[idx], self.files_list[idx - 1]
            self.refresh_listbox(select_index=idx - 1)

    def pindah_turun(self):
        selected = self.listbox.curselection()
        if selected and selected[0] < len(self.files_list) - 1:
            idx = selected[0]
            self.files_list[idx + 1], self.files_list[idx] = self.files_list[idx], self.files_list[idx + 1]
            self.refresh_listbox(select_index=idx + 1)

    def pilih_folder_tujuan(self):
        folder = filedialog.askdirectory(title="Pilih Folder Penyimpanan Hasil")
        if folder:
            self.entry_tujuan.delete(0, tk.END)
            self.entry_tujuan.insert(0, folder)

    def jalankan_proses(self):
        if len(self.files_list) < 2:
            messagebox.showwarning("Peringatan", "Harap pilih minimal 2 file PDF untuk digabungkan!")
            return

        folder_tujuan = self.entry_tujuan.get().strip()
        if not folder_tujuan:
            messagebox.showwarning("Peringatan", "Harap tentukan folder penyimpanan hasil!")
            return

        nama_output = self.entry_nama_output.get().strip()
        if not nama_output:
            nama_output = "Dokumen_Gabungan.pdf"
        if not nama_output.lower().endswith('.pdf'):
            nama_output += ".pdf"

        output_path = os.path.join(folder_tujuan, nama_output)

        try:
            PdfAllMergeModel.merge_files(self.files_list, output_path)
            self.btn_buka_folder.pack(side="left")
            jawab = messagebox.askyesno(
                "Berhasil",
                f"Selesai!\nBerhasil menggabungkan {len(self.files_list)} file menjadi:\n{nama_output}\n\nBuka folder hasil sekarang?"
            )
            if jawab:
                self.buka_folder_hasil()
        except Exception as e:
            messagebox.showerror("Error", f"Gagal menggabungkan PDF: {e}")

    def buka_folder_hasil(self):
        folder = self.entry_tujuan.get().strip()
        try:
            PdfAllMergeModel.open_folder(folder)
        except Exception as e:
            messagebox.showerror("Error", f"Gagal membuka folder: {e}")

