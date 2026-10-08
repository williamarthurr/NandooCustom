import io
import os
import tkinter as tk
from tkinter import colorchooser, filedialog, messagebox, ttk

from PIL import Image, ImageTk

from mvc.models import CodeGeneratorModel


class PageCodeGenerator(tk.Frame):
    """Tkinter view for generating QR codes and Code 128 barcodes."""

    def __init__(self, parent, controller):
        super().__init__(parent)
        self.controller = controller
        self.generated_bytes = None
        self.preview_image = None
        self.foreground = "#000000"
        self.background = "#FFFFFF"
        self.setup_ui()

    def setup_ui(self):
        header = tk.Frame(self)
        header.pack(fill="x", padx=15, pady=12)
        ttk.Button(
            header,
            text="< Kembali",
            command=lambda: self.controller.show_frame("DashboardMenu"),
        ).pack(side="left")
        tk.Label(
            header,
            text="QR / Barcode Generator",
            font=("Segoe UI", 12, "bold"),
        ).pack(side="left", padx=15)

        content = tk.Frame(self, padx=25, pady=10)
        content.pack(fill="both", expand=True)

        tk.Label(content, text="Jenis kode:").grid(row=0, column=0, sticky="w", pady=5)
        self.code_type = tk.StringVar(value="QR Code")
        self.code_type_box = ttk.Combobox(
            content,
            textvariable=self.code_type,
            values=["QR Code", "Barcode (Code 128)"],
            state="readonly",
            width=24,
        )
        self.code_type_box.grid(row=0, column=1, sticky="w", pady=5)

        tk.Label(content, text="Konten:").grid(row=1, column=0, sticky="nw", pady=5)
        self.content_text = tk.Text(content, height=5, wrap="word")
        self.content_text.grid(row=1, column=1, sticky="ew", pady=5)
        self.content_text.bind("<<Modified>>", self._on_content_modified)

        color_row = tk.Frame(content)
        color_row.grid(row=2, column=1, sticky="w", pady=8)
        ttk.Button(color_row, text="Warna kode...", command=self._choose_foreground).pack(
            side="left", padx=(0, 8)
        )
        self.foreground_swatch = tk.Label(
            color_row, text=self.foreground, bg=self.foreground, width=10
        )
        self.foreground_swatch.pack(side="left", padx=(0, 16))
        ttk.Button(color_row, text="Warna latar...", command=self._choose_background).pack(
            side="left", padx=(0, 8)
        )
        self.background_swatch = tk.Label(
            color_row, text=self.background, bg=self.background, width=10
        )
        self.background_swatch.pack(side="left")

        self.qr_options = tk.Frame(content)
        self.qr_options.grid(row=3, column=1, sticky="w", pady=5)
        tk.Label(self.qr_options, text="Ukuran kotak QR:").pack(side="left")
        self.qr_box_size = tk.IntVar(value=10)
        self.qr_box_size_spinbox = ttk.Spinbox(
            self.qr_options,
            from_=1,
            to=40,
            textvariable=self.qr_box_size,
            width=5,
        )
        self.qr_box_size_spinbox.pack(side="left", padx=(5, 14))
        tk.Label(self.qr_options, text="Lebar border:").pack(side="left")
        self.qr_border = tk.IntVar(value=4)
        self.qr_border_spinbox = ttk.Spinbox(
            self.qr_options,
            from_=0,
            to=20,
            textvariable=self.qr_border,
            width=5,
        )
        self.qr_border_spinbox.pack(side="left", padx=5)
        for spinbox in (self.qr_box_size_spinbox, self.qr_border_spinbox):
            spinbox.bind("<KeyRelease>", self._on_qr_option_changed)
            spinbox.bind("<<Increment>>", self._on_qr_option_changed)
            spinbox.bind("<<Decrement>>", self._on_qr_option_changed)
        self.code_type_box.bind("<<ComboboxSelected>>", self._on_type_changed)

        self.preview = tk.Label(content, text="Pratinjau hasil akan tampil di sini")
        self.preview.grid(row=4, column=0, columnspan=2, sticky="nsew", pady=12)

        action_row = tk.Frame(content)
        action_row.grid(row=5, column=0, columnspan=2, sticky="w", pady=8)
        ttk.Button(
            action_row,
            text="Buat QR / Barcode",
            command=self._generate,
        ).pack(side="left", padx=(0, 8))
        self.save_button = ttk.Button(
            action_row,
            text="Simpan PNG...",
            command=self._save,
            state="disabled",
        )
        self.save_button.pack(side="left")

        self.status = tk.Label(content, text="Pilih jenis kode lalu masukkan konten.")
        self.status.grid(row=6, column=0, columnspan=2, sticky="w")
        content.columnconfigure(1, weight=1)
        content.rowconfigure(4, weight=1)

    def _on_type_changed(self, event):
        if event.widget is self.code_type_box:
            if self.code_type.get() == "QR Code":
                self.qr_options.grid()
            else:
                self.qr_options.grid_remove()
            self._invalidate_result()

    def _on_content_modified(self, event):
        if event.widget is self.content_text and self.content_text.edit_modified():
            self.content_text.edit_modified(False)
            self._invalidate_result()

    def _on_qr_option_changed(self, event):
        if event.widget in (self.qr_box_size_spinbox, self.qr_border_spinbox):
            self._invalidate_result()

    def _invalidate_result(self):
        if self.generated_bytes is None:
            return
        self.generated_bytes = None
        self.save_button.config(state="disabled")
        self.preview.config(image="", text="Pengaturan berubah. Buat ulang kode untuk melihat hasil.")

    def _choose_foreground(self):
        color = colorchooser.askcolor(
            color=self.foreground, title="Pilih warna QR/barcode"
        )[1]
        if color:
            self.foreground = color
            self.foreground_swatch.config(text=color, bg=color)
            self._invalidate_result()

    def _choose_background(self):
        color = colorchooser.askcolor(
            color=self.background, title="Pilih warna latar"
        )[1]
        if color:
            self.background = color
            self.background_swatch.config(text=color, bg=color)
            self._invalidate_result()

    def _generate(self):
        content = self.content_text.get("1.0", "end-1c")
        try:
            self.generated_bytes = CodeGeneratorModel.generate(
                content=content,
                code_type=self.code_type.get(),
                foreground=self.foreground,
                background=self.background,
                qr_box_size=self.qr_box_size.get(),
                qr_border=self.qr_border.get(),
            )
            with Image.open(io.BytesIO(self.generated_bytes)) as image:
                preview_image = image.copy()
            preview_image.thumbnail((720, 420))
            self.preview_image = ImageTk.PhotoImage(preview_image)
            self.preview.config(image=self.preview_image, text="")
            self.save_button.config(state="normal")
            self.status.config(text="Kode berhasil dibuat.", fg="#188038")
        except Exception as exc:
            self.generated_bytes = None
            self.save_button.config(state="disabled")
            self.status.config(text=f"Gagal membuat kode: {exc}", fg="#c5221f")
            messagebox.showerror("Gagal membuat QR / barcode", str(exc))

    def _save(self):
        if not self.generated_bytes:
            return
        path = filedialog.asksaveasfilename(
            title="Simpan QR / barcode",
            initialfile="qr_barcode.png",
            defaultextension=".png",
            filetypes=[("PNG image", "*.png")],
        )
        if not path:
            return
        try:
            with open(path, "wb") as image_file:
                image_file.write(self.generated_bytes)
        except OSError as exc:
            messagebox.showerror("Gagal menyimpan gambar", str(exc))
            return
        self.status.config(text=f"Gambar tersimpan: {os.path.basename(path)}", fg="#188038")
