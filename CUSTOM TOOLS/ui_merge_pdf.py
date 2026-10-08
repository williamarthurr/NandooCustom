import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from mvc.models import PdfMergeModel

class PageMergePDF(tk.Frame):
    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        self.setup_ui()

    def setup_ui(self):
        # Header + Tombol Kembali
        header_frame = tk.Frame(self)
        header_frame.pack(fill="x", padx=15, pady=12)

        btn_back = ttk.Button(header_frame, text="< Kembali", command=lambda: self.controller.show_frame("DashboardMenu"))
        btn_back.pack(side="left")

        lbl_title = tk.Label(header_frame, text="Penggabung PDF", font=("Segoe UI", 12, "bold"))
        lbl_title.pack(side="left", padx=15)

        # Content Container (Responsive saat maximize & minimize)
        container = tk.Frame(self, padx=25, pady=5)
        container.pack(fill="x", anchor="n")

        # Form Frame
        form_frame = tk.Frame(container)
        form_frame.pack(fill="x", expand=True)

        # Konfigurasi kolom responsive: Kolom input (1) mengisi sisa ruang
        form_frame.columnconfigure(0, weight=0)
        form_frame.columnconfigure(1, weight=1)
        form_frame.columnconfigure(2, weight=0)

        # 1. Folder Asal
        lbl_sumber = tk.Label(form_frame, text="Folder PDF Asal:", font=("Segoe UI", 9))
        lbl_sumber.grid(row=0, column=0, sticky="w", pady=6, padx=(0, 10))
        self.entry_sumber = ttk.Entry(form_frame)
        self.entry_sumber.grid(row=0, column=1, sticky="ew", pady=6)
        btn_sumber = ttk.Button(form_frame, text="Cari...", command=self.pilih_folder_sumber)
        btn_sumber.grid(row=0, column=2, padx=(8, 0), pady=6)

        self.lbl_count = tk.Label(form_frame, text="", font=("Segoe UI", 8, "bold"))
        self.lbl_count.grid(row=1, column=1, sticky="w", pady=(0, 4))

        # 2. Folder Tujuan
        lbl_tujuan = tk.Label(form_frame, text="Folder Hasil:", font=("Segoe UI", 9))
        lbl_tujuan.grid(row=2, column=0, sticky="w", pady=6, padx=(0, 10))
        self.entry_tujuan = ttk.Entry(form_frame)
        self.entry_tujuan.grid(row=2, column=1, sticky="ew", pady=6)
        btn_tujuan = ttk.Button(form_frame, text="Cari...", command=self.pilih_folder_tujuan)
        btn_tujuan.grid(row=2, column=2, padx=(8, 0), pady=6)

        # 3. Urutan Kata Kunci
        lbl_keyword = tk.Label(form_frame, text="Urutan Kata Kunci:", font=("Segoe UI", 9))
        lbl_keyword.grid(row=3, column=0, sticky="w", pady=6, padx=(0, 10))
        self.entry_keyword = ttk.Entry(form_frame)
        self.entry_keyword.insert(0, "1, 2, Oktober, November")
        self.entry_keyword.grid(row=3, column=1, padx=5, pady=5)
        self.entry_keyword.grid(row=3, column=1, sticky="ew", pady=6)

        lbl_info = tk.Label(form_frame, text="*Contoh: 1, 2, atau Maret, April", font=("Segoe UI", 8, "italic"), fg="gray")
        lbl_info.grid(row=4, column=1, sticky="w", pady=(0, 4))

        # 4. Penamaan Lanjutan File Hasil
        lbl_nama = tk.Label(form_frame, text="Nama File Lanjutan:", font=("Segoe UI", 9))
        lbl_nama.grid(row=5, column=0, sticky="w", pady=6, padx=(0, 10))
        self.entry_nama_file = ttk.Entry(form_frame)
        self.entry_nama_file.insert(0, "_merged")
        self.entry_nama_file.grid(row=5, column=1, padx=5, pady=5)
        self.entry_nama_file.grid(row=5, column=1, sticky="ew", pady=6)

        lbl_nama_info = tk.Label(
            form_frame,
            text="*NIK otomatis di depan. Contoh: _SLIP_GAJI atau - PKWT (Hasil: [NIK]_SLIP_GAJI.pdf)",
            font=("Segoe UI", 8, "italic"),
            fg="gray"
        )
        lbl_nama_info.grid(row=6, column=1, sticky="w", pady=(0, 8))

        # Tombol Aksi (Tepat di bawah field nama lanjutan)
        btn_action_frame = tk.Frame(form_frame)
        btn_action_frame.grid(row=7, column=1, sticky="w", pady=(10, 15))

        # Tombol Proses
        self.btn_proses = tk.Button(
            btn_action_frame, text="GABUNGKAN PDF", bg="#28a745", fg="white", 
            font=("Segoe UI", 10, "bold"), relief="flat", padx=16, pady=7, 
            cursor="hand2",
            command=self.jalankan_proses
        )
        self.btn_proses.pack(side="left", padx=(0, 10))

        # Tombol Buka Folder Hasil (Awalnya tersembunyi)
        self.btn_buka_folder = tk.Button(
            btn_action_frame, text="📂 BUKA FOLDER HASIL", bg="#007bff", fg="white",
            font=("Segoe UI", 10, "bold"), relief="flat", padx=16, pady=7,
            cursor="hand2",
            command=self.buka_folder_hasil
        )

    def pilih_folder_sumber(self):
        folder = filedialog.askdirectory(title="Pilih Folder Tempat File PDF Berada")
        if folder:
            self.btn_buka_folder.pack_forget()
            self.entry_sumber.delete(0, tk.END)
            self.entry_sumber.insert(0, folder)
            pdf_count = PdfMergeModel.count_pdfs(folder)
            self.lbl_count.config(text=f"Terdeteksi: {pdf_count} file PDF", fg="#28a745" if pdf_count > 0 else "red")

            if not self.entry_tujuan.get():
                self.entry_tujuan.delete(0, tk.END)
                self.entry_tujuan.insert(0, os.path.join(folder, "HASIL_MERGE"))

    def pilih_folder_tujuan(self):
        folder = filedialog.askdirectory(title="Pilih Folder Hasil Merge")
        if folder:
            self.btn_buka_folder.pack_forget()
            self.entry_tujuan.delete(0, tk.END)
            self.entry_tujuan.insert(0, folder)

    def jalankan_proses(self):
        try:
            total = PdfMergeModel.merge_folder(
                self.entry_sumber.get(), 
                self.entry_tujuan.get(), 
                self.entry_keyword.get(),
                self.entry_nama_file.get()
            )
            if total > 0:
                self.btn_buka_folder.pack(pady=5)
                self.btn_buka_folder.pack(side="left")
                jawab = messagebox.askyesno(
                    "Berhasil", 
                    f"Selesai!\nBerhasil menggabungkan {total} pasang file PDF.\n\nApakah Anda ingin langsung membuka folder hasil merge?"
                )
                if jawab:
                    self.buka_folder_hasil()
            else:
                self.btn_buka_folder.pack_forget()
                messagebox.showwarning("Informasi", "Tidak ditemukan file PDF dengan pasangan 4-digit ID yang sama.")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def buka_folder_hasil(self):
        folder = self.entry_tujuan.get()
        try:
            PdfMergeModel.open_folder(folder)
        except Exception as e:
            messagebox.showerror("Error", f"Gagal membuka folder: {e}")