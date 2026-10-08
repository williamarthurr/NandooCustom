"""Tkinter view for the Monitoring Absensi module."""

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from mvc.models import AttendanceModel


class PageMonitoringAbsensi(tk.Frame):
    """Load an attendance report, preview the summary, and save it as Excel."""

    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        self.output_bytes = None
        self.output_name = "Monitoring_Absensi.xlsx"
        self._build()

    def _build(self):
        header = tk.Frame(self)
        header.pack(fill="x", padx=15, pady=12)
        ttk.Button(
            header,
            text="< Kembali",
            command=lambda: self.controller.show_frame("DashboardMenu"),
        ).pack(side="left")
        tk.Label(
            header,
            text="Monitoring Absensi",
            font=("Segoe UI", 12, "bold"),
        ).pack(side="left", padx=15)

        content = tk.Frame(self, padx=25, pady=10)
        content.pack(fill="both", expand=True)
        ttk.Button(
            content,
            text="Pilih Laporan (.xls / .xlsx)",
            command=self._process_file,
        ).pack(anchor="w", pady=(0, 10))

        table_frame = tk.Frame(content)
        table_frame.pack(fill="both", expand=True)
        self.table = ttk.Treeview(
            table_frame,
            columns=(
                "nik",
                "name",
                "absences",
                "absence_score",
                "discipline",
                "discipline_score",
                "descriptions",
            ),
            show="headings",
        )
        column_labels = {
            "nik": "NIK",
            "name": "NAMA",
            "absences": "ABSENSI",
            "absence_score": "SKOR",
            "discipline": "KEDISIPLINAN",
            "discipline_score": "SKOR",
            "descriptions": "KETERANGAN",
        }
        for column, label in column_labels.items():
            self.table.heading(column, text=label)
            self.table.column(column, width=130, anchor="center")
        self.table.column("name", width=210, anchor="w")
        self.table.column("descriptions", width=260, anchor="w")
        horizontal_scroll = ttk.Scrollbar(
            table_frame, orient="horizontal", command=self.table.xview
        )
        vertical_scroll = ttk.Scrollbar(
            table_frame, orient="vertical", command=self.table.yview
        )
        self.table.configure(
            xscrollcommand=horizontal_scroll.set,
            yscrollcommand=vertical_scroll.set,
        )
        self.table.grid(row=0, column=0, sticky="nsew")
        vertical_scroll.grid(row=0, column=1, sticky="ns")
        horizontal_scroll.grid(row=1, column=0, sticky="ew")
        table_frame.rowconfigure(0, weight=1)
        table_frame.columnconfigure(0, weight=1)

        footer = tk.Frame(content)
        footer.pack(fill="x", pady=(10, 0))
        self.status = tk.Label(footer, text="Pilih laporan absensi untuk mulai.")
        self.status.pack(side="left")
        self.save_button = ttk.Button(
            footer,
            text="Simpan Hasil...",
            command=self._save_file,
            state="disabled",
        )
        self.save_button.pack(side="right")

    def _process_file(self):
        path = filedialog.askopenfilename(
            title="Pilih Laporan Absensi",
            filetypes=[("Excel", "*.xls *.xlsx")],
        )
        if not path:
            return

        try:
            with open(path, "rb") as source:
                records, self.output_bytes = AttendanceModel.process_report(
                    path, source.read()
                )
        except (OSError, ValueError) as exc:
            self.output_bytes = None
            self.save_button.configure(state="disabled")
            messagebox.showerror("Gagal memproses laporan", str(exc))
            return

        for item in self.table.get_children():
            self.table.delete(item)
        for record in records:
            row = record.as_row()
            self.table.insert(
                "",
                "end",
                values=(
                    row["NIK"],
                    row["NAMA"],
                    row["ABSENSI"] or "",
                    row["SKOR ABSENSI"],
                    row["KEDISIPLINAN"] or "",
                    row["SKOR KEDISIPLINAN"],
                    row["KETERANGAN"],
                ),
            )
        self.output_name = "Monitoring_Absensi.xlsx"
        self.status.configure(text=f"Berhasil: {len(records)} karyawan.")
        self.save_button.configure(state="normal")

    def _save_file(self):
        if self.output_bytes is None:
            return
        path = filedialog.asksaveasfilename(
            title="Simpan Hasil Monitoring Absensi",
            defaultextension=".xlsx",
            initialfile=self.output_name,
            filetypes=[("Excel Workbook", "*.xlsx")],
        )
        if not path:
            return
        try:
            with open(path, "wb") as output:
                output.write(self.output_bytes)
        except OSError as exc:
            messagebox.showerror("Gagal menyimpan hasil", str(exc))
            return
        self.status.configure(text=f"Hasil disimpan: {path}")
