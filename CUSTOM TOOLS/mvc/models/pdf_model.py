"""PDF merge model for ID-based grouping workflows."""

from mvc.models.pdf_operations import (
    count_pdfs,
    create_zip,
    make_output_name,
    merge_folder,
    merge_memory,
    open_folder,
)


class PdfMergeModel:
    """Application-facing API for ID-based PDF merging."""

    @staticmethod
    def count_pdfs(folder_path):
        return count_pdfs(folder_path)

    @staticmethod
    def merge_folder(folder_path, output_folder, keywords, suffix="_merged"):
        return merge_folder(folder_path, output_folder, keywords, suffix)

    @staticmethod
    def merge_memory(files, keywords, suffix="_merged"):
        return merge_memory(files, keywords, suffix)

    @staticmethod
    def make_output_name(employee_id, suffix="_merged"):
        return make_output_name(employee_id, suffix)

    @staticmethod
    def create_zip(results):
        return create_zip(results)

    @staticmethod
    def open_folder(folder_path):
        return open_folder(folder_path)


__all__ = ["PdfMergeModel"]
