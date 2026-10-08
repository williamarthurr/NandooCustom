"""Backward-compatible exports for the MVC PDF model."""

from mvc.models.pdf_operations import (
    count_pdfs as hitung_pdf,
    create_zip as buat_zip_bytes,
    make_output_name as buat_nama_file,
    merge_folder as proses_merge_pdf,
    merge_memory as proses_merge_pdf_memory,
    open_folder as buka_folder,
)

buka_folder_hasil = buka_folder

__all__ = [
    "hitung_pdf",
    "buat_nama_file",
    "proses_merge_pdf",
    "proses_merge_pdf_memory",
    "buka_folder",
    "buka_folder_hasil",
    "buat_zip_bytes",
]
