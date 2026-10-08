"""Model package with lazy imports for feature-specific dependencies."""

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .attendance_model import AttendanceModel
    from .code_generator_model import CodeGeneratorModel
    from .pdf_all_model import PdfAllMergeModel
    from .pdf_model import PdfMergeModel
    from .pdf_to_word_model import PdfToWordModel

__all__ = [
    "PdfMergeModel",
    "PdfAllMergeModel",
    "PdfToWordModel",
    "CodeGeneratorModel",
    "AttendanceModel",
]


def __getattr__(name: str) -> Any:
    if name == "PdfMergeModel":
        from .pdf_model import PdfMergeModel

        return PdfMergeModel
    if name == "PdfAllMergeModel":
        from .pdf_all_model import PdfAllMergeModel

        return PdfAllMergeModel
    if name == "PdfToWordModel":
        from .pdf_to_word_model import PdfToWordModel

        return PdfToWordModel
    if name == "CodeGeneratorModel":
        from .code_generator_model import CodeGeneratorModel

        return CodeGeneratorModel
    if name == "AttendanceModel":
        from .attendance_model import AttendanceModel

        return AttendanceModel
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
