from __future__ import annotations

import tkinter as tk
from datetime import date
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any

from aosol_core import CATEGORIES, STATUSES
from aosol_excel import export_report_csv, export_report_workbook
from aosol_reports import build_asset_report, report_view
from ui_components import ScrollableFrame

NAVY = "#12213a"
TEAL = "#13a89e"
GOLD = "#d6ad60"
INK = "#18263b"
MUTED = "#718096"
BG = "#f3f6fa"
WHITE = "#ffffff"
BORDER = "#e2e8f0"


class ReportsDialog(tk.Toplevel):
    REPORT_KINDS = ["حركة الأصول للفترة", "الإهلاك للفترة", "حسب التصنيف", "حسب الإدارة", "الاستبعادات"]

    def __init__(self, parent: tk.Misc, assets: list[dict[str, Any]], company: str, currency: str):
        super().__init__(parent)
        self.parent = parent
        self.assets = assets
        self.company = company
        self.currency = currency
        self.title("Aosol | مركز التقارير")
        screen_width, screen_height = self.winfo_screenwidth(), self.winfo_screenheight()
        width, height = min(1280, max(900, screen_width - 48)), min(800, max(480, screen_height - 96))
        self.geometry(f"{width}x{height}")
        self.minsize(min(width, 900), min(height, 480))
        self.configure(bg=BG)
        self.transient(parent)
        self.from_var = tk.StringVar(value=date.today().replace(month=1, day=1).isoformat())
        self.to_var = tk.StringVar(value=date.today().isoformat())
        self.kind_var = tk.StringVar(value=self.REPORT_KINDS[0])
        self.category_var = tk.StringVar(value="الكل")
        self.department_var = tk.StringVar(value="الكل")
        self.status_var = tk.StringVar(value="الكل")
        self.query_var = tk.StringVar()
        self.report: dict[str, Any] | None = None
        self._layout()
        self.generate()

    def _button(self, parent: tk.Widget, text: str, command: Any, primary: bool = False) -> tk.Button:
        return tk.Button(parent, text=text, command=command, bg=TEAL if primary else WHITE, fg=WHITE if primary else NAVY,
                         activebackground="#0e8d84" if primary else "#edf3f8", activeforeground=WHITE if primary else NAVY,
                         font=("Tahoma", 9, "bold"), relief="flat", bd=0, padx=14, pady=8, cursor="hand2",
                         highlightthickness=0 if primary else 1, highlightbackground=BORDER)

    def _layout(self) -> None:
        header = tk.Frame(self, bg=NAVY, height=78)
        header.pack(fill="x")
        header.pack_propagate(False)
        title = tk.Frame(header, bg=NAVY)
        title.pack(side="right", padx=24, pady=12)
        tk.Label(title, text="مركز التقارير والإهلاك", bg=NAVY, fg=WHITE, font=("Tahoma", 16, "bold"), anchor="e").pack(anchor="e")
        tk.Label(title, text=f"{self.company}  •  العملة: {self.currency}", bg=NAVY, fg="#c5d2e2", font=("Tahoma", 9), anchor="e").pack(anchor="e", pady=(3, 0))
        self._button(header, "إغلاق", self.destroy).pack(side="left", padx=18, pady=20)

        self.page_scroll = ScrollableFrame(self, background=BG)
        self.page_scroll.pack(fill="both", expand=True, padx=12, pady=(8, 12))
        page = self.page_scroll.content
        filters = tk.Frame(page, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        filters.pack(fill="x", padx=16, pady=(14, 10))
        row1 = tk.Frame(filters, bg=WHITE)
        row1.pack(fill="x", padx=12, pady=(10, 5))
        self._field(row1, "نوع التقرير", self.kind_var, values=self.REPORT_KINDS, width=23)
        self._field(row1, "من تاريخ", self.from_var, width=13)
        self._field(row1, "إلى تاريخ", self.to_var, width=13)
        self._field(row1, "الفئة", self.category_var, values=["الكل", *CATEGORIES], width=26)
        row2 = tk.Frame(filters, bg=WHITE)
        row2.pack(fill="x", padx=12, pady=(4, 10))
        departments = sorted({str(a.get("department", "")).strip() for a in self.assets if str(a.get("department", "")).strip()})
        self._field(row2, "الإدارة", self.department_var, values=["الكل", *departments], width=24)
        self._field(row2, "الحالة", self.status_var, values=["الكل", *STATUSES.values()], width=20)
        search_box = tk.Frame(row2, bg=WHITE)
        search_box.pack(side="right", padx=7)
        tk.Label(search_box, text="بحث", bg=WHITE, fg=MUTED, font=("Tahoma", 8)).pack(anchor="e")
        search_entry = tk.Entry(search_box, textvariable=self.query_var, justify="right", width=25, font=("Tahoma", 9), relief="solid", bd=1, highlightthickness=1, highlightbackground=BORDER)
        search_entry.pack(ipady=4)
        search_entry.bind("<Return>", lambda _event: self.generate())
        self._button(row2, "تحديث التقرير", self.generate, primary=True).pack(side="left", padx=5, pady=5)
        self._button(row2, "تصدير Excel / CSV", self.export).pack(side="left", padx=5, pady=5)

        self.kpi_frame = tk.Frame(page, bg=BG)
        self.kpi_frame.pack(fill="x", padx=16, pady=(2, 8))
        self.note_label = tk.Label(page, text="", bg=BG, fg="#805b10", font=("Tahoma", 9), anchor="e", justify="right", wraplength=1180)
        self.note_label.pack(fill="x", padx=18, pady=(0, 5))
        table_panel = tk.Frame(page, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        table_panel.pack(fill="both", expand=True, padx=16, pady=(0, 14))
        self.table_title = tk.Label(table_panel, text="", bg=WHITE, fg=NAVY, font=("Tahoma", 12, "bold"), anchor="e")
        self.table_title.pack(fill="x", padx=14, pady=(11, 5))
        self.tree = ttk.Treeview(table_panel, show="headings", selectmode="browse")
        self.tree.tag_configure("odd", background="#f7f9fc")
        self.tree.tag_configure("negative", foreground="#b42318")
        vs = ttk.Scrollbar(table_panel, orient="vertical", command=self.tree.yview)
        hs = ttk.Scrollbar(table_panel, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vs.set, xscrollcommand=hs.set)
        self.tree.pack(side="top", fill="both", expand=True, padx=(10, 0), pady=(3, 0))
        hs.pack(side="bottom", fill="x", padx=10, pady=(0, 8))
        vs.place(relx=0.99, rely=0.10, relheight=0.80, anchor="ne")

    def _field(self, parent: tk.Widget, label: str, variable: tk.StringVar, *, values: list[str] | None = None, width: int = 18) -> None:
        box = tk.Frame(parent, bg=WHITE)
        box.pack(side="right", padx=6)
        tk.Label(box, text=label, bg=WHITE, fg=MUTED, font=("Tahoma", 8)).pack(anchor="e")
        if values is None:
            widget: tk.Widget = tk.Entry(box, textvariable=variable, justify="right", width=width, font=("Tahoma", 9), relief="solid", bd=1, highlightthickness=1, highlightbackground=BORDER)
            widget.pack(ipady=4)
            widget.bind("<Return>", lambda _event: self.generate())
        else:
            widget = ttk.Combobox(box, textvariable=variable, values=values, state="readonly", width=width, justify="right", font=("Tahoma", 9))
            widget.pack(ipady=3)
            widget.bind("<<ComboboxSelected>>", lambda _event: self.generate())

    def generate(self) -> None:
        try:
            start = date.fromisoformat(self.from_var.get().strip())
            end = date.fromisoformat(self.to_var.get().strip())
            self.report = build_asset_report(
                self.assets, start, end,
                category=self.category_var.get(), department=self.department_var.get(),
                status=self.status_var.get(), query=self.query_var.get(),
            )
        except Exception as exc:
            messagebox.showerror("تعذر إنشاء التقرير", f"تحقق من التاريخ والفلاتر.\n{exc}", parent=self)
            return
        self._render_kpis()
        headers, rows, view_title = report_view(self.report, self.kind_var.get())
        self.table_title.config(text=f"{view_title}  |  {self.report['fromDate']} — {self.report['toDate']}  |  {len(rows)} سجل")
        self.tree.delete(*self.tree.get_children())
        self.tree.configure(columns=[f"c{i}" for i in range(len(headers))])
        for index, (column, heading) in enumerate(zip(self.tree["columns"], headers)):
            self.tree.heading(column, text=heading, anchor="e")
            width = max(105, min(230, len(heading) * 12))
            if len(headers) > 10:
                width = max(100, min(190, len(heading) * 11))
            self.tree.column(column, width=width, minwidth=85, anchor="e", stretch=True)
        for row_index, values in enumerate(rows):
            tag = "odd" if row_index % 2 else ""
            if any(isinstance(value, (int, float)) and value < 0 for value in values):
                tag = "negative"
            display = [f"{value:,.2f}" if isinstance(value, float) else value for value in values]
            self.tree.insert("", "end", values=display, tags=(tag,) if tag else ())
        if self.report["notes"]:
            self.note_label.config(text="تنبيه محاسبي: " + " | ".join(self.report["notes"]))
        else:
            self.note_label.config(text="تُحتسب حركة الإهلاك من رصيد مجمع الإهلاك بين تاريخي البداية والنهاية وفق قاعدة بدء الإهلاك المسجلة.")

    def _render_kpis(self) -> None:
        for child in self.kpi_frame.winfo_children():
            child.destroy()
        assert self.report is not None
        totals = self.report["totals"]
        items = [
            ("الأصول", f"{totals['assetCount']:,}", TEAL),
            ("الإضافات", f"{totals['additions']:,.2f}", "#4c78a8"),
            ("إهلاك الفترة", f"{totals['periodExpense']:,.2f}", GOLD),
            ("صافي القيمة الدفترية", f"{totals['endingBookValue']:,.2f}", "#46a17d"),
            ("ربح / (خسارة) الاستبعاد", f"{totals['gainLoss']:,.2f}", "#d17c52"),
        ]
        for title, value, accent in items:
            card = tk.Frame(self.kpi_frame, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
            card.pack(side="right", fill="both", expand=True, padx=(0, 8))
            tk.Frame(card, bg=accent, width=4).pack(side="right", fill="y")
            body = tk.Frame(card, bg=WHITE)
            body.pack(fill="both", expand=True, padx=11, pady=8)
            tk.Label(body, text=title, bg=WHITE, fg=MUTED, font=("Tahoma", 8, "bold"), anchor="e").pack(fill="x")
            tk.Label(body, text=value, bg=WHITE, fg=NAVY, font=("Tahoma", 13, "bold"), anchor="e").pack(fill="x", pady=(3, 0))

    def export(self) -> None:
        if not self.report:
            return
        path = filedialog.asksaveasfilename(parent=self, title="تصدير التقرير", defaultextension=".xlsx", initialfile=f"تقرير_{self.kind_var.get().replace(' ', '_')}_{self.report['toDate']}.xlsx", filetypes=[("Excel", "*.xlsx"), ("CSV", "*.csv")])
        if not path:
            return
        try:
            if Path(path).suffix.lower() == ".csv":
                export_report_csv(path, self.report, self.kind_var.get())
            else:
                export_report_workbook(path, self.report, self.company, self.currency, self.kind_var.get())
            messagebox.showinfo("تم التصدير", f"تم حفظ التقرير:\n{path}", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر التصدير", str(exc), parent=self)
