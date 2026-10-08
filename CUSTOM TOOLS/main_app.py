import tkinter as tk
from mvc.controllers.desktop_controller import DesktopController
from mvc.views.dashboard_view import DashboardView

DashboardMenu = DashboardView


class MainApplication(tk.Tk):
    def __init__(self):
        super().__init__()
        self.desktop_controller = DesktopController(self)
        self.frames = self.desktop_controller.frames

    def show_frame(self, page_name):
        if page_name == "DashboardMenu":
            page_name = "DashboardView"
        self.desktop_controller.show_frame(page_name)


if __name__ == "__main__":
    app = MainApplication()
    app.mainloop()