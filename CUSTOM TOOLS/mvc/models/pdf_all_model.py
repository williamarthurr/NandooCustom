"""PDF merge model for ordered all-file workflows."""

from mvc.models.pdf_all_operations import merge_files, merge_memory, open_folder


class PdfAllMergeModel:
    """Application-facing API for merging an ordered list of PDF files."""

    @staticmethod
    def merge_files(file_paths, output_path):
        return merge_files(file_paths, output_path)

    @staticmethod
    def merge_memory(file_tuples):
        return merge_memory(file_tuples)

    @staticmethod
    def open_folder(folder_path):
        return open_folder(folder_path)


__all__ = ["PdfAllMergeModel"]
