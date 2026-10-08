"""Core PDF operations for ordered file merging."""

import io
import os
import subprocess
import sys

from pypdf import PdfWriter


def merge_files(file_paths, output_path):
    if not file_paths:
        raise ValueError("Daftar file PDF tidak boleh kosong!")
    if len(file_paths) < 2:
        raise ValueError("Pilih setidaknya 2 file PDF untuk digabungkan!")

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    merger = PdfWriter()
    for file_path in file_paths:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File tidak ditemukan: {file_path}")
        merger.append(file_path)
    merger.write(output_path)
    merger.close()
    return output_path


def merge_memory(file_tuples):
    if not file_tuples:
        raise ValueError("Daftar file PDF tidak boleh kosong!")
    if len(file_tuples) < 2:
        raise ValueError("Upload setidaknya 2 file PDF untuk digabungkan!")

    merger = PdfWriter()
    for _, file_bytes in file_tuples:
        merger.append(io.BytesIO(file_bytes))
    output = io.BytesIO()
    merger.write(output)
    merger.close()
    return output.getvalue()


def open_folder(folder_path):
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
