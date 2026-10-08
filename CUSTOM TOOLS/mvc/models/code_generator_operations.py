"""QR code and Code 128 barcode image generation."""

import io

import barcode
import qrcode
from PIL import ImageColor
from barcode.writer import ImageWriter
from qrcode.constants import ERROR_CORRECT_M
from qrcode.exceptions import DataOverflowError


CODE_TYPES = ("QR Code", "Barcode (Code 128)")


def _normalize_color(color: str, field_name: str) -> str:
    try:
        red, green, blue = ImageColor.getrgb(color)[:3]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Warna {field_name} tidak valid: {color}") from exc
    return f"#{red:02X}{green:02X}{blue:02X}"


def generate_code_image(
    content: str,
    code_type: str,
    foreground: str = "#000000",
    background: str = "#FFFFFF",
    qr_box_size: int = 10,
    qr_border: int = 4,
) -> bytes:
    """Generate a QR code or Code 128 barcode as PNG bytes."""
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Konten QR/barcode tidak boleh kosong.")
    if code_type not in CODE_TYPES:
        raise ValueError(f"Jenis kode tidak didukung: {code_type}")
    if not isinstance(qr_box_size, int) or not 1 <= qr_box_size <= 40:
        raise ValueError("Ukuran kotak QR harus antara 1 dan 40.")
    if not isinstance(qr_border, int) or not 0 <= qr_border <= 20:
        raise ValueError("Lebar border QR harus antara 0 dan 20.")

    foreground_color = _normalize_color(foreground, "depan")
    background_color = _normalize_color(background, "latar")
    image_buffer = io.BytesIO()

    if code_type == "QR Code":
        qr = qrcode.QRCode(
            version=None,
            error_correction=ERROR_CORRECT_M,
            box_size=qr_box_size,
            border=qr_border,
        )
        qr.add_data(content.encode("utf-8"), optimize=0)
        try:
            qr.make(fit=True)
        except DataOverflowError as exc:
            raise ValueError("Konten terlalu panjang untuk dibuat menjadi QR code.") from exc
        qr_image = qr.make_image(
            fill_color=foreground_color,
            back_color=background_color,
        ).get_image()
        qr_image.save(image_buffer, format="PNG")
    else:
        try:
            content.encode("ascii")
        except UnicodeEncodeError as exc:
            raise ValueError(
                "Barcode Code 128 hanya mendukung karakter ASCII. Gunakan QR Code untuk teks Unicode."
            ) from exc
        try:
            code = barcode.get("code128", content, writer=ImageWriter())
            code.write(
                image_buffer,
                options={
                    "background": background_color,
                    "foreground": foreground_color,
                    "write_text": True,
                    "module_width": 0.25,
                    "module_height": 15.0,
                    "quiet_zone": 6.5,
                    "font_size": 10,
                    "text_distance": 5.0,
                },
            )
        except (UnicodeEncodeError, ValueError) as exc:
            raise ValueError(f"Konten tidak didukung untuk Barcode Code 128: {exc}") from exc
        except Exception as exc:
            raise ValueError(f"Gagal membuat barcode: {exc}") from exc

    return image_buffer.getvalue()
