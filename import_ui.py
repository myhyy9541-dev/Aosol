from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, ttk
from typing import Any, Callable
from ui_components import ScrollableFrame

NAVY = "#12213a"
TEAL = "#13a89e"
BG = "#f3f6fa"
WHITE = "#ffffff"
BORDER = "#e2e8f0"


class ImportPreviewDialog(tk.Toplevel):
    def __init__(self, parent: tk.Misc, batch: dict[str, Any], on_import: Callable[[list[dict[str, Any]]], None]):
        super().__init__(parent)
        self.batch = batch
        self.on_import = on_import
        self.title("معاينة استيراد الأصول")
        screen_width, screen_height = self.winfo_screenwidth(), self.winfo_screenheight()
        width = min(1000, max(760, screen_width - 48))
        height = min(650, max(480, screen_height - 96))
        self.geometry(f"{width}x{height}")
        self.minsize(min(width, 760), min(height, 480))
        self.configure(bg=BG)
        self.transient(parent)

        header = tk.Frame(self, bg=NAVY, height=78)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(header, text="معاينة الاستيراد والتحقق", bg=NAVY, fg=WHITE, font=("Tahoma", 15, "bold"), anchor="e").pack(side="right", padx=22, pady=19)
        self.page_scroll = ScrollableFrame(self, background=BG)
        self.page_scroll.pack(fill="both", expand=True, padx=10, pady=(0, 6))
        page = self.page_scroll.content
        summary = tk.Frame(page, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        summary.pack(fill="x", padx=15, pady=12)
        summary_text = f"الأوراق: {batch.get('sheet', '')}    •    صفوف البيانات: {batch.get('rowsScanned', 0)}    •    صالح للاستيراد: {batch.get('validCount', 0)}    •    مرفوض / مكرر: {batch.get('issueCount', 0)}"
        tk.Label(summary, text=summary_text, bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), anchor="e").pack(fill="x", padx=13, pady=11)
        if batch.get("duplicateCount"):
            tk.Label(summary, text=f"الأكواد المكررة: {batch['duplicateCount']} — تم استبعادها من القائمة الصالحة ولن تُستبدل البيانات الموجودة.", bg=WHITE, fg="#a75a18", font=("Tahoma", 9), anchor="e").pack(fill="x", padx=13, pady=(0, 10))

        table = tk.Frame(page, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        table.pack(fill="both", expand=True, padx=15, pady=(0, 10))
        columns = ("row", "code", "name", "result", "reason")
        self.tree = ttk.Treeview(table, columns=columns, show="headings")
        for col, heading, width in [("row", "الصف", 65), ("code", "رمز الأصل", 130), ("name", "اسم الأصل", 220), ("result", "النتيجة", 120), ("reason", "التفاصيل", 430)]:
            self.tree.heading(col, text=heading, anchor="e")
            self.tree.column(col, width=width, minwidth=60, anchor="e", stretch=(col in ("name", "reason")))
        self.tree.tag_configure("valid", foreground="#26734d")
        self.tree.tag_configure("invalid", foreground="#a3322a", background="#fff5f4")
        vs = ttk.Scrollbar(table, orient="vertical", command=self.tree.yview)
        hs = ttk.Scrollbar(table, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vs.set, xscrollcommand=hs.set)
        self.tree.pack(side="top", fill="both", expand=True, padx=(8, 0), pady=(8, 0))
        vs.pack(side="right", fill="y", padx=(0, 8), pady=8)
        hs.pack(side="bottom", fill="x", padx=8, pady=(0, 8))

        for asset in batch.get("assets", []):
            self.tree.insert("", "end", values=(asset.get("sourceRow", "—"), asset.get("code", ""), asset.get("name", ""), "جاهز للاستيراد", "لا توجد أخطاء"), tags=("valid",))
        for issue in batch.get("issues", []):
            self.tree.insert("", "end", values=(issue.get("row", ""), issue.get("code", ""), issue.get("name", ""), "مرفوض", issue.get("reason", "")), tags=("invalid",))

        footer = tk.Frame(self, bg=BG)
        footer.pack(fill="x", padx=15, pady=(0, 14))
        self._button(footer, "إلغاء", self.destroy).pack(side="left", padx=5)
        button = self._button(footer, f"استيراد {batch.get('validCount', 0)} أصل صالح", self.confirm, primary=True)
        button.pack(side="left", padx=5)
        if not batch.get("assets"):
            button.configure(state="disabled")
        tk.Label(footer, text="لن تُحفظ أي تغييرات قبل تأكيدك. الصفوف الصالحة فقط هي التي ستُضاف.", bg=BG, fg="#718096", font=("Tahoma", 9), anchor="e").pack(side="right", padx=8)

    @staticmethod
    def _button(parent: tk.Widget, text: str, command: Callable[[], None], primary: bool = False) -> tk.Button:
        return tk.Button(parent, text=text, command=command, bg=TEAL if primary else WHITE, fg=WHITE if primary else NAVY,
                         activebackground="#0e8d84" if primary else "#edf3f8", activeforeground=WHITE if primary else NAVY,
                         font=("Tahoma", 9, "bold"), relief="flat", bd=0, padx=14, pady=9, cursor="hand2",
                         highlightthickness=0 if primary else 1, highlightbackground=BORDER)

    def confirm(self) -> None:
        assets = self.batch.get("assets", [])
        if not assets:
            return
        if not messagebox.askyesno("تأكيد الاستيراد", f"سيتم إضافة {len(assets)} أصل إلى السجل المحلي. هل تريد المتابعة؟", parent=self):
            return
        self.on_import(assets)
        self.destroy()
