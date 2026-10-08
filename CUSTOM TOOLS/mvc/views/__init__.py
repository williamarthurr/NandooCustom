"""View package with lazy imports for optional Tkinter dependencies."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .dashboard_view import DashboardView

__all__ = ["DashboardView"]


def __getattr__(name: str):
    if name == "DashboardView":
        from .dashboard_view import DashboardView

        return DashboardView
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
