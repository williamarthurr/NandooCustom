"""Model facade for PDF to Word conversion operations."""

from typing import Dict, List, Optional, Tuple, Union
from mvc.models.pdf_to_word_operations import (
    convert_batch_memory,
    convert_pdf_to_word_file,
    convert_pdf_to_word_memory,
    create_zip,
    open_folder,
    parse_page_range,
)


class PdfToWordModel:
    """Application-facing API for neat PDF to Word (.docx) conversions."""

    @staticmethod
    def convert_file(
        pdf_path: str,
        docx_path: Optional[str] = None,
        pages_spec: Optional[str] = None,
        delete_hyphen: bool = True,
    ) -> str:
        return convert_pdf_to_word_file(
            pdf_path=pdf_path,
            docx_path=docx_path,
            pages_spec=pages_spec,
            delete_hyphen=delete_hyphen,
        )

    @staticmethod
    def convert_memory(
        pdf_bytes: bytes,
        pages_spec: Optional[str] = None,
        delete_hyphen: bool = True,
    ) -> bytes:
        return convert_pdf_to_word_memory(
            pdf_bytes=pdf_bytes,
            pages_spec=pages_spec,
            delete_hyphen=delete_hyphen,
        )

    @staticmethod
    def convert_batch_memory(
        files: Union[Dict[str, bytes], List[Tuple[str, bytes]]],
        pages_spec: Optional[str] = None,
        delete_hyphen: bool = True,
    ) -> Tuple[Dict[str, bytes], List[dict]]:
        return convert_batch_memory(
            files=files,
            pages_spec=pages_spec,
            delete_hyphen=delete_hyphen,
        )

    @staticmethod
    def create_zip(results: Dict[str, bytes]) -> bytes:
        return create_zip(results)

    @staticmethod
    def open_folder(folder_path: str):
        return open_folder(folder_path)

    @staticmethod
    def parse_page_range(page_str: Optional[str]) -> Optional[List[int]]:
        return parse_page_range(page_str)


__all__ = ["PdfToWordModel"]
