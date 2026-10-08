"""Controller package with lazy imports for optional desktop dependencies."""

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .desktop_controller import DesktopController
    from .web_controller import WebController

__all__ = ["DesktopController", "WebController"]


def __getattr__(name: str) -> Any:
    if name == "DesktopController":
        from .desktop_controller import DesktopController

        return DesktopController
    if name == "WebController":
        from .web_controller import WebController

        return WebController
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
