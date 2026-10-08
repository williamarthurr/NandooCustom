"""Model facade for attendance monitoring."""

from mvc.models.attendance_operations import (
    AttendanceRecord,
    create_attendance_workbook,
    summarize_attendance,
)


class AttendanceModel:
    """Expose attendance parsing and workbook generation to app controllers."""

    @staticmethod
    def process_report(filename: str, file_bytes: bytes) -> tuple[list[AttendanceRecord], bytes]:
        records = summarize_attendance(filename, file_bytes)
        return records, create_attendance_workbook(records)
