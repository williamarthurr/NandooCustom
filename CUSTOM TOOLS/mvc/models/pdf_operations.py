"""Core PDF operations for ID-based merging."""

import io
import os
import re
import subprocess
import sys
import zipfile

from pypdf import PdfWriter


def count_pdfs(folder_path):
    if not folder_path or not os.path.exists(folder_path):
        return 0
    return len(
        [
            name
            for name in os.listdir(folder_path)
            if name.lower().endswith(".pdf") and not name.endswith("_merged.pdf")
        ]
    )


def make_output_name(employee_id, suffix="_merged"):
    if not suffix or not str(suffix).strip():
        suffix = "_merged"

    text = str(suffix).strip()
    if text.lower().endswith(".pdf"):
        text = text[:-4].rstrip()
    text = re.sub(r'[\\/*?:"<>|]', "", text)

    if "{nik}" in text.lower():
        name = re.sub(r"\{nik\}", employee_id, text, flags=re.IGNORECASE)
    elif text and not text.startswith(("_", "-", " ", ".")):
        name = f"{employee_id}_{text}"
    else:
        name = f"{employee_id}{text}"
    return f"{name}.pdf"


def _keywords(raw_keywords):
    return [item.strip().lower() for item in raw_keywords.split(",") if item.strip()]


def _extract_groups(file_names):
    groups = {}
    for file_name in file_names:
        if not file_name.lower().endswith(".pdf") or file_name.endswith("_merged.pdf"):
            continue
        match = re.search(r"\b([a-zA-Z]*\d{4,}[a-zA-Z0-9]*)\b", file_name)
        if match:
            employee_id = match.group(1).upper()
            groups.setdefault(employee_id, []).append(file_name)
    return groups


def _sort_key(file_name, keywords):
    lower_name = file_name.lower()
    for index, keyword in enumerate(keywords):
        if keyword in lower_name:
            return index
    match = re.search(r"(\d+)(?:\.pdf)?$", file_name)
    return int(match.group(1)) if match else 999


def merge_folder(source_folder, target_folder, raw_keywords, suffix="_merged"):
    if not source_folder or not target_folder:
        raise ValueError("Harap pilih folder sumber dan folder tujuan!")

    os.makedirs(target_folder, exist_ok=True)
    keywords = _keywords(raw_keywords)
    groups = _extract_groups(os.listdir(source_folder))
    total = 0

    for employee_id, files in groups.items():
        if len(files) < 2:
            continue
        files.sort(key=lambda name: _sort_key(name, keywords))
        merger = PdfWriter()
        for file_name in files:
            merger.append(os.path.join(source_folder, file_name))
        output_path = os.path.join(target_folder, make_output_name(employee_id, suffix))
        merger.write(output_path)
        merger.close()
        total += 1
    return total


def merge_memory(files, raw_keywords, suffix="_merged"):
    keywords = _keywords(raw_keywords)
    groups = {}
    for file_name, file_bytes in files.items():
        if not file_name.lower().endswith(".pdf") or file_name.endswith("_merged.pdf"):
            continue
        match = re.search(r"\b([a-zA-Z]*\d{4,}[a-zA-Z0-9]*)\b", file_name)
        if match:
            employee_id = match.group(1).upper()
            groups.setdefault(employee_id, []).append((file_name, file_bytes))

    results = {}
    report = []
    unpaired = []
    for employee_id, file_items in groups.items():
        if len(file_items) < 2:
            unpaired.extend(name for name, _ in file_items)
            continue

        file_items.sort(key=lambda item: _sort_key(item[0], keywords))
        merger = PdfWriter()
        for _, file_bytes in file_items:
            merger.append(io.BytesIO(file_bytes))
        output = io.BytesIO()
        merger.write(output)
        merger.close()

        output_name = make_output_name(employee_id, suffix)
        pdf_bytes = output.getvalue()
        results[output_name] = pdf_bytes
        report.append(
            {
                "nik": employee_id,
                "output": output_name,
                "count": len(file_items),
                "files": [name for name, _ in file_items],
                "size_kb": round(len(pdf_bytes) / 1024, 1),
            }
        )
    return results, report, unpaired


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


def create_zip(results):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for file_name, file_bytes in results.items():
            archive.writestr(file_name, file_bytes)
    return zip_buffer.getvalue()
