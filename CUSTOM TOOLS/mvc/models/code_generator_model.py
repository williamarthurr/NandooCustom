"""Model facade for QR code and barcode generation."""

from mvc.models.code_generator_operations import generate_code_image


class CodeGeneratorModel:
    """Application-facing API for generating QR and Code 128 images."""

    @staticmethod
    def generate(
        content: str,
        code_type: str,
        foreground: str = "#000000",
        background: str = "#FFFFFF",
        qr_box_size: int = 10,
        qr_border: int = 4,
    ) -> bytes:
        return generate_code_image(
            content=content,
            code_type=code_type,
            foreground=foreground,
            background=background,
            qr_box_size=qr_box_size,
            qr_border=qr_border,
        )
