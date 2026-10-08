"""Backward-compatible exports for the MVC all-files model."""

from mvc.models.pdf_all_operations import (
    merge_files as gabung_pdf_all_files,
    merge_memory as gabung_pdf_all_memory,
    open_folder as buka_folder,
)

__all__ = ["gabung_pdf_all_files", "gabung_pdf_all_memory", "buka_folder"]
