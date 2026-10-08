"""Controller for the Tkinter desktop application."""

import tkinter as tk

from mvc.views.dashboard_view import DashboardView
from ui_merge_all import PageMergeAllPDF
from ui_merge_pdf import PageMergePDF
from ui_pdf_to_word import PagePdfToWord
from ui_code_generator import PageCodeGenerator
from ui_monitoring_absensi import PageMonitoringAbsensi


class DesktopController:
    """Owns desktop navigation and coordinates the Tkinter views."""

    def __init__(self, root):
        self.root = root
        self.frames = {}
        self._configure_window()
        self._build_views()
        self.show_frame("DashboardView")

    def _configure_window(self):
        self.root.title("CUSTOM - Multi Utility Desktop")
        self.root.state("zoomed")
        self.root.resizable(True, True)
        self.root.minsize(650, 480)

    def _build_views(self):
        container = tk.Frame(self.root)
        container.pack(side="top", fill="both", expand=True)
        container.grid_rowconfigure(0, weight=1)
        container.grid_columnconfigure(0, weight=1)

        view_classes = (
            DashboardView,
            PageMergePDF,
            PageMergeAllPDF,
            PagePdfToWord,
            PageCodeGenerator,
            PageMonitoringAbsensi,
        )
        for view_class in view_classes:
            frame = view_class(parent=container, controller=self)
            self.frames[view_class.__name__] = frame
            frame.grid(row=0, column=0, sticky="nsew")

    def show_frame(self, frame_name):
        if frame_name == "DashboardMenu":
            frame_name = "DashboardView"
        self.frames[frame_name].tkraise()
