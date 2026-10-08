"""Core PDF to Word (.docx) conversion operations with high-fidelity layout preservation."""

import io
import os
import subprocess
import sys
import zipfile
from typing import Dict, List, Optional, Tuple, Union

from pdf2docx import Converter


def parse_page_range(page_str: Optional[str]) -> Optional[List[int]]:
    """Parse page string like '1-3, 5, 7-10' into 0-based page index list.
    
    If empty or None, returns None (meaning all pages).
    """
    if not page_str or not page_str.strip():
        return None

    cleaned = page_str.strip()
    if cleaned.lower() in ("all", "semua", "*"):
        return None

    pages = set()
    parts = cleaned.split(",")
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            bounds = part.split("-")
            if len(bounds) == 2:
                try:
                    start = int(bounds[0].strip())
                    end = int(bounds[1].strip())
                    if start <= end:
                        for p in range(start, end + 1):
                            if p >= 1:
                                pages.add(p - 1)
                except ValueError:
                    continue
        else:
            try:
                p = int(part)
                if p >= 1:
                    pages.add(p - 1)
            except ValueError:
                continue

    if not pages:
        return None
    return sorted(list(pages))


def get_default_converter_settings(
    delete_hyphen: bool = True,
    parse_lattice_table: bool = True,
    parse_stream_table: bool = True,
    list_not_table: bool = True,
) -> dict:
    """Generate settings tuned for clean, tidy, and editable DOCX output."""
    return {
        "debug": False,
        "ignore_page_error": True,
        "multi_processing": False,
        "parse_lattice_table": parse_lattice_table,
        "parse_stream_table": parse_stream_table,
        "list_not_table": list_not_table,
        "delete_end_line_hyphen": delete_hyphen,
        "connected_border_tolerance": 0.5,
        "max_line_spacing_ratio": 1.5,
        "line_overlap_threshold": 0.9,
    }


def convert_pdf_to_word_file(
    pdf_path: str,
    docx_path: Optional[str] = None,
    pages_spec: Optional[str] = None,
    delete_hyphen: bool = True,
) -> str:
    """Convert a physical PDF file into a neatly formatted Word (.docx) file."""
    if not pdf_path or not os.path.exists(pdf_path):
        raise FileNotFoundError(f"File PDF tidak ditemukan: {pdf_path}")

    if not docx_path:
        base, _ = os.path.splitext(pdf_path)
        docx_path = f"{base}.docx"

    output_dir = os.path.dirname(docx_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    page_list = parse_page_range(pages_spec)
    settings = get_default_converter_settings(delete_hyphen=delete_hyphen)

    cv = Converter(pdf_path)
    try:
        if page_list is None:
            cv.convert(docx_path, **settings)
        else:
            cv.convert(docx_path, pages=page_list, **settings)
    finally:
        cv.close()

    return docx_path


def convert_pdf_to_word_memory(
    pdf_bytes: bytes,
    pages_spec: Optional[str] = None,
    delete_hyphen: bool = True,
) -> bytes:
    """Convert in-memory PDF bytes into a neatly formatted Word (.docx) bytes."""
    if not pdf_bytes:
        raise ValueError("Data PDF kosong!")

    page_list = parse_page_range(pages_spec)
    settings = get_default_converter_settings(delete_hyphen=delete_hyphen)

    cv = Converter(stream=pdf_bytes)
    out_stream = io.BytesIO()
    try:
        if page_list is None:
            cv.convert(out_stream, **settings)
        else:
            cv.convert(out_stream, pages=page_list, **settings)
    finally:
        cv.close()

    return out_stream.getvalue()


def convert_batch_memory(
    files: Union[Dict[str, bytes], List[Tuple[str, bytes]]],
    pages_spec: Optional[str] = None,
    delete_hyphen: bool = True,
) -> Tuple[Dict[str, bytes], List[dict]]:
    """Convert multiple PDF files to DOCX in-memory."""
    if isinstance(files, dict):
        file_items = list(files.items())
    else:
        file_items = list(files)

    if not file_items:
        raise ValueError("Daftar file PDF tidak boleh kosong!")

    results: Dict[str, bytes] = {}
    report: List[dict] = []

    for name, pdf_data in file_items:
        if not name.lower().endswith(".pdf"):
            continue

        base_name = os.path.splitext(name)[0]
        docx_name = f"{base_name}.docx"

        try:
            docx_bytes = convert_pdf_to_word_memory(
                pdf_bytes=pdf_data,
                pages_spec=pages_spec,
                delete_hyphen=delete_hyphen,
            )
            results[docx_name] = docx_bytes
            report.append({
                "source": name,
                "output": docx_name,
                "status": "success",
                "size_kb": round(len(docx_bytes) / 1024, 1),
                "error": None,
            })
        except Exception as e:
            report.append({
                "source": name,
                "output": docx_name,
                "status": "error",
                "size_kb": 0,
                "error": str(e),
            })

    return results, report


def create_zip(results: Dict[str, bytes]) -> bytes:
    """Pack converted DOCX files into a ZIP archive."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for file_name, file_bytes in results.items():
            archive.writestr(file_name, file_bytes)
    return zip_buffer.getvalue()


def open_folder(folder_path: str):
    """Open folder in native OS file explorer."""
    if not folder_path:
        raise ValueError("Harap tentukan path folder terlebih dahulu!")

    folder_path = os.path.normpath(folder_path)
    os.makedirs(folder_path, exist_ok=True)
    if os.name == "nt":
        os.startfile(folder_path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", folder_path])
    else:
        subprocess.Popen(["xdg-open", folder_path])
