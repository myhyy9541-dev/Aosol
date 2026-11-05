from __future__ import annotations

import tkinter as tk
from tkinter import ttk


class ScrollableFrame(tk.Frame):
    """A reusable RTL-friendly frame with a persistent vertical scrollbar."""

    def __init__(self, parent: tk.Misc, *, background: str = "#ffffff", scrollbar_side: str = "right"):
        super().__init__(parent, bg=background)
        self.canvas = tk.Canvas(self, bg=background, highlightthickness=0, borderwidth=0)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.scrollbar.pack(side=scrollbar_side, fill="y")
        self.canvas.pack(side="left" if scrollbar_side == "right" else "right", fill="both", expand=True)
        self.content = tk.Frame(self.canvas, bg=background)
        self._window = self.canvas.create_window((0, 0), window=self.content, anchor="nw")
        self.content.bind("<Configure>", self._update_scrollregion)
        self.canvas.bind("<Configure>", self._fit_content_width)

    def _update_scrollregion(self, _event: tk.Event | None = None) -> None:
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

    def _fit_content_width(self, event: tk.Event) -> None:
        self.canvas.itemconfigure(self._window, width=max(1, event.width))
        self._update_scrollregion()


__all__ = ["ScrollableFrame"]
