# CUSTOM Tools Architecture

The project follows a small MVC structure shared by the desktop and web entry points.

## Structure

```text
mvc/
  models/
    pdf_operations.py         # Core ID-based PDF operations
    pdf_all_operations.py     # Core ordered PDF operations
    pdf_to_word_operations.py # Core PDF to Word (.docx) conversion operations
    code_generator_operations.py # QR and Code 128 barcode image generation
    attendance_operations.py # Attendance report parsing and workbook generation
    pdf_model.py              # ID-based model facade
    pdf_all_model.py          # Ordered PDF model facade
    pdf_to_word_model.py      # PDF to Word conversion facade
    code_generator_model.py  # QR and barcode generator facade
    attendance_model.py     # Attendance report facade
  controllers/
    desktop_controller.py     # Tkinter navigation and registered view lifecycle
    web_controller.py         # Streamlit input-to-model coordination
  views/
    dashboard_view.py         # Tkinter dashboard
    web_guide.py              # Streamlit guide dialog
```

## Entry Points

- `main_app.py` starts the desktop application.
- `app_web.py` starts the Streamlit application.
- `api.py` exposes FastAPI endpoints for PDF merging and Word conversion.
- `ui_merge_pdf.py`, `ui_merge_all.py`, `ui_pdf_to_word.py`, `ui_code_generator.py`, and `ui_monitoring_absensi.py` are desktop views kept as stable import points.
- `pdf_logic.py` and `pdf_all_logic.py` are compatibility adapters for older imports.

The desktop controller registers every view used by the dashboard before navigation is available.

## Responsibilities

- **Models** validate input and perform PDF/file operations.
- **Controllers** coordinate user input, model calls, and navigation/state transitions.
- **Views** render Tkinter or Streamlit UI and delegate operations to controllers/models.
- **Monitoring Absensi** accepts `.xls`/`.xlsx` attendance reports in both interfaces and exports the deduplicated category summary as `.xlsx`.
- **Streamlit startup** loads feature models on demand so unused PDF and Excel dependencies do not delay the initial page.
