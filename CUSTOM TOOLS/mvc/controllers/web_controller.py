"""Controllers for Streamlit workflows."""

class WebController:
    """Coordinates web input with models."""

    @staticmethod
    def merge_by_id(files, keywords, suffix):
        from mvc.models import PdfMergeModel

        file_data = {file.name: file.getvalue() for file in files}
        return PdfMergeModel.merge_memory(file_data, keywords, suffix)

    @staticmethod
    def merge_all(files):
        from mvc.models import PdfAllMergeModel

        file_data = [(file.name, file.getvalue()) for file in files]
        return PdfAllMergeModel.merge_memory(file_data)

    @staticmethod
    def create_zip(results):
        from mvc.models import PdfMergeModel

        return PdfMergeModel.create_zip(results)

    @staticmethod
    def convert_pdf_to_word(file, pages_spec=None, delete_hyphen=True):
        from mvc.models import PdfToWordModel

        return PdfToWordModel.convert_memory(
            pdf_bytes=file.getvalue(),
            pages_spec=pages_spec,
            delete_hyphen=delete_hyphen,
        )

    @staticmethod
    def convert_batch_pdf_to_word(files, pages_spec=None, delete_hyphen=True):
        from mvc.models import PdfToWordModel

        file_tuples = [(file.name, file.getvalue()) for file in files]
        return PdfToWordModel.convert_batch_memory(
            files=file_tuples,
            pages_spec=pages_spec,
            delete_hyphen=delete_hyphen,
        )

    @staticmethod
    def generate_code(
        content: str,
        code_type: str,
        foreground: str = "#000000",
        background: str = "#FFFFFF",
        qr_box_size: int = 10,
        qr_border: int = 4,
    ) -> bytes:
        from mvc.models import CodeGeneratorModel

        return CodeGeneratorModel.generate(
            content=content,
            code_type=code_type,
            foreground=foreground,
            background=background,
            qr_box_size=qr_box_size,
            qr_border=qr_border,
        )

    @staticmethod
    def process_attendance_report(filename: str, file_bytes: bytes):
        from mvc.models import AttendanceModel

        return AttendanceModel.process_report(filename, file_bytes)
