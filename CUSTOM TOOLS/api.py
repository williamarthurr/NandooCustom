import uuid
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from mvc.controllers import WebController


class UploadedPdfFile:
    def __init__(self, upload_file: UploadFile):
        self.name = upload_file.filename
        self._bytes = upload_file.file.read()

    def getvalue(self):
        return self._bytes


app = FastAPI(
    title="Custom Tools PDF API",
    version="1.0.0",
    description="Minimal API for merging PDF files and converting PDF to neatly formatted Word documents.",
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "custom-tools-pdf-api"}


@app.post("/merge-by-id")
async def merge_by_id(
    files: List[UploadFile] = File(...),
    keywords: str = Form("1, 2, Oktober, November"),
    suffix: str = Form("_merged"),
):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Minimal 2 file PDF dibutuhkan.")

    invalid_files = [file.filename for file in files if not file.filename or not file.filename.lower().endswith(".pdf")]
    if invalid_files:
        raise HTTPException(status_code=400, detail=f"File harus berformat PDF: {invalid_files}")

    try:
        adapted_files = [UploadedPdfFile(file) for file in files]
        results, report, unpaired = WebController.merge_by_id(adapted_files, keywords, suffix)
    except Exception as exc:  # pragma: no cover - defensive guard
        raise HTTPException(status_code=500, detail=f"Gagal memproses PDF: {exc}") from exc

    if not results:
        return {
            "status": "success",
            "merged_count": 0,
            "report": [],
            "unpaired": unpaired,
            "message": "Tidak ada file PDF yang memiliki pasangan ID/NIK yang sama.",
        }

    zip_bytes = WebController.create_zip(results)
    content_disposition = f'attachment; filename="hasil_merge_{uuid.uuid4().hex}.zip"'
    return Response(content=zip_bytes, media_type="application/zip", headers={"Content-Disposition": content_disposition})


@app.post("/merge-all")
async def merge_all(
    files: List[UploadFile] = File(...),
    output_name: str = Form("Dokumen_Gabungan.pdf"),
):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Minimal 2 file PDF dibutuhkan.")

    invalid_files = [file.filename for file in files if not file.filename or not file.filename.lower().endswith(".pdf")]
    if invalid_files:
        raise HTTPException(status_code=400, detail=f"File harus berformat PDF: {invalid_files}")

    try:
        adapted_files = [UploadedPdfFile(file) for file in files]
        merged = WebController.merge_all(adapted_files)
    except Exception as exc:  # pragma: no cover - defensive guard
        raise HTTPException(status_code=500, detail=f"Gagal menggabungkan semua PDF: {exc}") from exc

    file_name = output_name if output_name.lower().endswith(".pdf") else f"{output_name}.pdf"
    return Response(
        content=merged,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@app.post("/pdf-to-word")
async def pdf_to_word(
    files: List[UploadFile] = File(...),
    pages: Optional[str] = Form(None),
    delete_hyphen: bool = Form(True),
):
    if not files:
        raise HTTPException(status_code=400, detail="Minimal 1 file PDF dibutuhkan.")

    invalid_files = [file.filename for file in files if not file.filename or not file.filename.lower().endswith(".pdf")]
    if invalid_files:
        raise HTTPException(status_code=400, detail=f"File harus berformat PDF: {invalid_files}")

    try:
        adapted_files = [UploadedPdfFile(file) for file in files]
        results, report = WebController.convert_batch_pdf_to_word(
            files=adapted_files,
            pages_spec=pages,
            delete_hyphen=delete_hyphen,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal mengonversi PDF ke Word: {exc}") from exc

    if not results:
        failed_errors = [item.get("error") for item in report if item.get("error")]
        raise HTTPException(status_code=500, detail=f"Gagal mengonversi file: {failed_errors}")

    if len(results) == 1:
        docx_name, docx_bytes = next(iter(results.items()))
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{docx_name}"'},
        )

    zip_bytes = WebController.create_zip(results)
    content_disposition = f'attachment; filename="hasil_word_{uuid.uuid4().hex}.zip"'
    return Response(content=zip_bytes, media_type="application/zip", headers={"Content-Disposition": content_disposition})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)

