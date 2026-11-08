from __future__ import annotations

import tkinter as tk
from datetime import date
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk
from typing import Any

from aosol_core import CATEGORIES, STATUSES
from aosol_excel import CUSTOM_DETAIL_FIELDS, export_custom_period_workbook, export_report_csv, export_report_workbook
from aosol_reports import build_asset_report, report_view
from aosol_report_templates import (
    DATE_MODES, SECTION_KEYS, TEMPLATE_SETTING_KEY, decode_report_templates,
    period_bounds, remove_report_template,
    upsert_report_template,
)
from ui_components import ScrollableFrame

NAVY = "#12213a"
TEAL = "#13a89e"
GOLD = "#d6ad60"
INK = "#18263b"
MUTED = "#718096"
BG = "#f3f6fa"
WHITE = "#ffffff"
BORDER = "#e2e8f0"
MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]


def _quick_period_controls(parent: tk.Widget, mode_var: tk.StringVar, month_var: tk.StringVar,
                           year_var: tk.StringVar, apply: Any) -> None:
    """Add compact Arabic month/year selectors to a report form."""
    box = tk.Frame(parent, bg=WHITE)
    box.pack(side="right", padx=6, pady=4)
    tk.Label(box, text="اختيار سريع للفترة", bg=WHITE, fg=MUTED, font=("Tahoma", 8)).pack(anchor="e")
    controls = tk.Frame(box, bg=WHITE)
    controls.pack(anchor="e")
    modes = {"شهري": "monthly", "سنوي": "yearly", "مخصص": "custom"}
    reverse = {value: key for key, value in modes.items()}
    shown_mode = tk.StringVar(value=reverse.get(mode_var.get(), "مخصص"))
    mode = ttk.Combobox(controls, textvariable=shown_mode, values=list(modes), state="readonly", width=8, justify="right")
    mode.pack(side="right", padx=2, ipady=2)
    mode.bind("<<ComboboxSelected>>", lambda _event: mode_var.set(modes.get(shown_mode.get(), "custom")))
    mode_var.trace_add("write", lambda *_: shown_mode.set(reverse.get(mode_var.get(), "مخصص")))
    shown_month = tk.StringVar(value=MONTH_NAMES[int(month_var.get()) - 1] if month_var.get().isdigit() and 1 <= int(month_var.get()) <= 12 else MONTH_NAMES[0])
    month = ttk.Combobox(controls, textvariable=shown_month, values=MONTH_NAMES, state="readonly", width=9, justify="right")
    month.pack(side="right", padx=2, ipady=2)
    month.bind("<<ComboboxSelected>>", lambda _event: month_var.set(str(MONTH_NAMES.index(shown_month.get()) + 1)))
    month_var.trace_add("write", lambda *_: shown_month.set(MONTH_NAMES[int(month_var.get()) - 1] if month_var.get().isdigit() and 1 <= int(month_var.get()) <= 12 else MONTH_NAMES[0]))
    years = [str(value) for value in range(1900, date.today().year + 11)]
    year = ttk.Combobox(controls, textvariable=year_var, values=years, state="normal", width=6, justify="right")
    year.pack(side="right", padx=2, ipady=2)
    tk.Button(controls, text="تطبيق", command=apply, bg=WHITE, fg=NAVY, font=("Tahoma", 8, "bold"),
              relief="flat", bd=0, padx=7, pady=3, highlightthickness=1, highlightbackground=BORDER).pack(side="right", padx=2)
    tk.Label(box, text="الشهر / السنة", bg=WHITE, fg=MUTED, font=("Tahoma", 7)).pack(anchor="e")


class ReportsDialog(tk.Toplevel):
    REPORT_KINDS = ["حركة الأصول للفترة", "الإهلاك للفترة", "حسب الحساب", "حسب التصنيف", "حسب الإدارة", "الاستبعادات"]

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
        self.period_mode_var = tk.StringVar(value="custom")
        self.period_month_var = tk.StringVar(value=str(date.today().month))
        self.period_year_var = tk.StringVar(value=str(date.today().year))
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
        quick_row = tk.Frame(filters, bg=WHITE)
        quick_row.pack(fill="x", padx=12, pady=(2, 5))
        _quick_period_controls(quick_row, self.period_mode_var, self.period_month_var, self.period_year_var, self._apply_quick_period)
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
        self._button(row2, "Excel مخصص للفترة", self.custom_export).pack(side="left", padx=5, pady=5)
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

    def _apply_quick_period(self) -> None:
        try:
            mode = self.period_mode_var.get()
            if mode in DATE_MODES and mode != "custom":
                start, end = period_bounds(mode, int(self.period_year_var.get()), int(self.period_month_var.get()) if mode == "monthly" else None)
                self.from_var.set(start.isoformat())
                self.to_var.set(end.isoformat())
            self.generate()
        except (TypeError, ValueError) as exc:
            messagebox.showerror("فترة غير صالحة", str(exc), parent=self)

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

    def custom_export(self) -> None:
        if not self.report:
            return
        CustomExcelDialog(self, self.assets, self.report, self.company, self.currency, {
            "category": self.category_var.get(), "department": self.department_var.get(),
            "status": self.status_var.get(), "query": self.query_var.get(),
        })


class CustomExcelDialog(tk.Toplevel):
    DEFAULT_COLUMNS = {
        "code", "accountCode", "name", "category", "department", "totalCost",
        "openingBookValue", "additions", "periodExpense", "disposalBookValue",
        "gainLoss", "endingBookValue", "inputBasisLabel", "annualDepreciationRate",
    }

    def __init__(self, parent: ReportsDialog, assets: list[dict[str, Any]], report: dict[str, Any], company: str, currency: str, filters: dict[str, str]):
        super().__init__(parent)
        self.parent, self.assets, self.report = parent, assets, report
        self.company, self.currency, self.filters = company, currency, filters
        self.store = getattr(getattr(parent, "parent", None), "store", None)
        self.template_columns = {key for key, _label in CUSTOM_DETAIL_FIELDS}
        self.title("Aosol | إعداد تقرير Excel مخصص")
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        width, height = min(1000, max(760, sw - 40)), min(850, max(520, sh - 70))
        self.geometry(f"{width}x{height}")
        self.minsize(min(width, 700), min(height, 500))
        self.configure(bg=BG)
        self.transient(parent)
        self.grab_set()

        self.from_var = tk.StringVar(value=report["fromDate"])
        self.to_var = tk.StringVar(value=report["toDate"])
        current_end = date.fromisoformat(report["toDate"])
        self.period_mode_var = tk.StringVar(value=parent.period_mode_var.get())
        self.period_month_var = tk.StringVar(value=parent.period_month_var.get() or str(current_end.month))
        self.period_year_var = tk.StringVar(value=parent.period_year_var.get() or str(current_end.year))
        self.granularity_var = tk.StringVar(value="شهري")
        self.orientation_var = tk.StringVar(value="landscape")
        self.total_var = tk.BooleanVar(value=True)
        self.section_vars = {
            "include_overall": tk.BooleanVar(value=True),
            "include_periods": tk.BooleanVar(value=True),
            "include_details": tk.BooleanVar(value=True),
            "include_accounts": tk.BooleanVar(value=True),
            "include_categories": tk.BooleanVar(value=True),
            "include_departments": tk.BooleanVar(value=True),
        }
        self.column_vars = {key: tk.BooleanVar(value=key in self.DEFAULT_COLUMNS) for key, _label in CUSTOM_DETAIL_FIELDS}
        self.template_var = tk.StringVar()
        category, department, query = filters.get("category", "الكل"), filters.get("department", "الكل"), filters.get("query", "").strip().casefold()
        self.rows = [
            asset for asset in assets
            if (category == "الكل" or asset.get("category", "") == category)
            and (department == "الكل" or asset.get("department", "") == department)
            and (not query or any(query in str(asset.get(key, "") or "").casefold() for key in ("code", "name", "department", "location", "custodian", "serialNumber")))
        ]
        self._layout()

    def _button(self, parent: tk.Widget, text: str, command: Any, primary: bool = False) -> tk.Button:
        return tk.Button(parent, text=text, command=command, bg=TEAL if primary else WHITE, fg=WHITE if primary else NAVY,
                         activebackground="#0e8d84" if primary else "#edf3f8", activeforeground=WHITE if primary else NAVY,
                         font=("Tahoma", 9, "bold"), relief="flat", bd=0, padx=13, pady=8, cursor="hand2",
                         highlightthickness=0 if primary else 1, highlightbackground=BORDER)

    def _layout(self) -> None:
        header = tk.Frame(self, bg=NAVY, height=66)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(header, text="تخصيص تقرير Excel", bg=NAVY, fg=WHITE, font=("Tahoma", 15, "bold"), anchor="e").pack(side="right", padx=20, pady=17)
        self.page_scroll = ScrollableFrame(self, background=BG)
        self.page_scroll.pack(fill="both", expand=True, padx=12, pady=8)
        page = self.page_scroll.content

        templates = tk.LabelFrame(page, text="قوالب التقارير المحفوظة", bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), padx=12, pady=8)
        templates.pack(fill="x", padx=8, pady=(5, 7))
        self.template_combo = ttk.Combobox(templates, textvariable=self.template_var, state="readonly", width=32, justify="right")
        self.template_combo.pack(side="right", padx=5, ipady=3)
        self._button(templates, "تطبيق القالب", self.apply_template).pack(side="right", padx=3)
        self._button(templates, "حفظ كقالب", self.save_template).pack(side="right", padx=3)
        self._button(templates, "حذف القالب", self.delete_template).pack(side="right", padx=3)
        self._refresh_templates()

        period = tk.LabelFrame(page, text="الفترة والتخطيط", bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), padx=12, pady=10)
        period.pack(fill="x", padx=8, pady=(5, 9))
        self._form_field(period, "نوع التقرير", self.granularity_var, ["شهري", "سنوي", "الفترة كاملة", "مخصص"], 15)
        self._form_field(period, "من تاريخ (YYYY-MM-DD)", self.from_var, None, 18)
        self._form_field(period, "إلى تاريخ (YYYY-MM-DD)", self.to_var, None, 18)
        self._form_field(period, "اتجاه ورقة A4", self.orientation_var, ["landscape", "portrait"], 14, labels={"landscape": "أفقي", "portrait": "عمودي"})
        quick_period = tk.Frame(period, bg=WHITE)
        quick_period.pack(fill="x", side="bottom", pady=(6, 1))
        _quick_period_controls(quick_period, self.period_mode_var, self.period_month_var, self.period_year_var, self.apply_quick_period)

        scope = tk.LabelFrame(page, text="الصفوف / الأصول المشمولة — اختر سجلًا أو أكثر", bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), padx=12, pady=8)
        scope.pack(fill="x", padx=8, pady=8)
        tk.Label(scope, text="القائمة تتبع مرشحات الفئة والإدارة والبحث الحالية؛ الحالة والفترة يعاد تطبيقهما عند التصدير. رمز الحساب اختياري، وتظهر الأصول بلا رمز ضمن (غير محدد).", bg=WHITE, fg=MUTED, font=("Tahoma", 8), anchor="e", justify="right", wraplength=850).pack(fill="x", pady=(0, 6))
        list_wrap = tk.Frame(scope, bg=WHITE)
        list_wrap.pack(fill="x")
        self.asset_list = tk.Listbox(list_wrap, selectmode=tk.EXTENDED, height=7, exportselection=False, justify="right", font=("Tahoma", 9), relief="solid", bd=1, selectbackground="#d9f2f0", selectforeground=NAVY)
        scroll = ttk.Scrollbar(list_wrap, orient="vertical", command=self.asset_list.yview)
        self.asset_list.configure(yscrollcommand=scroll.set)
        self.asset_list.pack(side="right", fill="x", expand=True)
        scroll.pack(side="left", fill="y")
        self.asset_codes: list[str] = []
        for row in self.rows:
            code = str(row.get("code", ""))
            self.asset_codes.append(code)
            self.asset_list.insert("end", f"{code}  |  {row.get('name', '')}")
        if self.asset_codes:
            self.asset_list.selection_set(0, "end")
        row_buttons = tk.Frame(scope, bg=WHITE)
        row_buttons.pack(fill="x", pady=(6, 0))
        self._button(row_buttons, "تحديد كل الأصول", lambda: self.asset_list.selection_set(0, "end")).pack(side="right", padx=3)
        self._button(row_buttons, "إلغاء التحديد", lambda: self.asset_list.selection_clear(0, "end")).pack(side="right", padx=3)

        sections = tk.LabelFrame(page, text="الأوراق / الإجماليات التي ستظهر في المصنف", bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), padx=12, pady=8)
        sections.pack(fill="x", padx=8, pady=8)
        section_labels = [
            ("include_overall", "الإجماليات العامة"), ("include_periods", "ملخص شهري / سنوي"),
            ("include_details", "تفاصيل الأصول والأعمدة المختارة"), ("include_accounts", "إجماليات حسب رمز الحساب"),
            ("include_categories", "إجماليات حسب التصنيف"), ("include_departments", "إجماليات حسب الإدارة"),
        ]
        for index, (key, label) in enumerate(section_labels):
            cb = tk.Checkbutton(sections, text=label, variable=self.section_vars[key], bg=WHITE, fg=INK, activebackground=WHITE, font=("Tahoma", 9), anchor="e", justify="right")
            cb.grid(row=index // 3, column=2 - index % 3, sticky="e", padx=12, pady=5)
        for column in range(3):
            sections.columnconfigure(column, weight=1)
        tk.Checkbutton(sections, text="إضافة صف الإجمالي العام أسفل الجداول (وإجمالي الحركات للفترات)", variable=self.total_var, bg=WHITE, fg=INK, activebackground=WHITE, font=("Tahoma", 9), anchor="e", justify="right").grid(row=2, column=0, columnspan=3, sticky="e", padx=12, pady=(6, 2))

        columns = tk.LabelFrame(page, text="الأعمدة المختارة لورقة تفاصيل الأصول", bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), padx=12, pady=8)
        columns.pack(fill="x", padx=8, pady=8)
        col_actions = tk.Frame(columns, bg=WHITE)
        col_actions.pack(fill="x", pady=(0, 4))
        self._button(col_actions, "تحديد الكل", lambda: [variable.set(True) for variable in self.column_vars.values()]).pack(side="right", padx=3)
        self._button(col_actions, "إلغاء الكل", lambda: [variable.set(False) for variable in self.column_vars.values()]).pack(side="right", padx=3)
        column_grid = tk.Frame(columns, bg=WHITE)
        column_grid.pack(fill="x")
        for index, (key, label) in enumerate(CUSTOM_DETAIL_FIELDS):
            cb = tk.Checkbutton(column_grid, text=label, variable=self.column_vars[key], bg=WHITE, fg=INK, activebackground=WHITE, font=("Tahoma", 9), anchor="e", justify="right")
            cb.grid(row=1 + index // 4, column=3 - index % 4, sticky="e", padx=8, pady=3)
        for column in range(4):
            column_grid.columnconfigure(column, weight=1)
        tk.Label(page, text="الإجماليات حسب الحساب تستخدم رمز الحساب الاختياري في سجل الأصل؛ إذا لم يُدخل رمز فسيظهر تحت «غير محدد». يظل تفصيل الحساب مطابقًا للأصول المحددة والمرشحات الحالية.", bg=BG, fg=MUTED, font=("Tahoma", 9), anchor="e", justify="right", wraplength=900).pack(fill="x", padx=15, pady=(4, 12))

        footer = tk.Frame(self, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        footer.pack(fill="x", side="bottom")
        self._button(footer, "إنشاء ملف Excel", self.export, primary=True).pack(side="left", padx=12, pady=9)
        self._button(footer, "إغلاق", self.destroy).pack(side="left", padx=4, pady=9)

    def _stored_templates(self) -> dict[str, dict[str, Any]]:
        if self.store is None:
            return {}
        try:
            return decode_report_templates(self.store.get_setting(TEMPLATE_SETTING_KEY), self.template_columns)
        except Exception:
            return {}

    def _refresh_templates(self, selected: str | None = None) -> None:
        names = sorted(self._stored_templates(), key=str.casefold)
        self.template_combo.configure(values=names)
        if selected in names:
            self.template_var.set(selected or "")
        elif self.template_var.get() not in names:
            self.template_var.set(names[0] if names else "")

    def _capture_template(self) -> dict[str, Any]:
        start = date.fromisoformat(self.from_var.get().strip())
        end = date.fromisoformat(self.to_var.get().strip())
        if start > end:
            raise ValueError("تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.")
        mode = self.period_mode_var.get()
        return {
            "granularity": self.granularity_var.get(),
            "orientation": self.orientation_var.get(),
            "sections": {key: variable.get() for key, variable in self.section_vars.items()},
            "include_detail_total": self.total_var.get(),
            "columns": [key for key, variable in self.column_vars.items() if variable.get()],
            "date_mode": mode,
            "year": int(self.period_year_var.get()),
            "month": int(self.period_month_var.get()) if mode == "monthly" else None,
            "from_date": start.isoformat(),
            "to_date": end.isoformat(),
        }

    def save_template(self) -> None:
        if self.store is None:
            messagebox.showerror("تعذر حفظ القالب", "تخزين إعدادات التطبيق غير متاح.", parent=self)
            return
        name = simpledialog.askstring("حفظ قالب", "اسم القالب:", parent=self)
        if name is None:
            return
        name = name.strip()
        existing = self._stored_templates()
        if name in existing and not messagebox.askyesno("استبدال القالب", f"القالب «{name}» موجود. هل تريد استبداله؟", parent=self):
            return
        try:
            raw = self.store.get_setting(TEMPLATE_SETTING_KEY)
            updated = upsert_report_template(raw, name, self._capture_template(), self.template_columns)
            self.store.set_setting(TEMPLATE_SETTING_KEY, updated)
            self._refresh_templates(name)
            messagebox.showinfo("تم الحفظ", f"تم حفظ القالب «{name}».", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر حفظ القالب", str(exc), parent=self)

    def apply_template(self) -> None:
        name = self.template_var.get()
        template = self._stored_templates().get(name)
        if template is None:
            messagebox.showerror("تعذر تطبيق القالب", "اختر قالبًا صالحًا أولًا.", parent=self)
            return
        try:
            self.granularity_var.set(template["granularity"])
            self.orientation_var.set(template["orientation"])
            self.total_var.set(template["include_detail_total"])
            for key in SECTION_KEYS:
                self.section_vars[key].set(template["sections"][key])
            chosen = set(template["columns"])
            for key, variable in self.column_vars.items():
                variable.set(key in chosen)
            self.period_mode_var.set(template["date_mode"])
            self.period_year_var.set(str(template["year"]))
            if template["month"] is not None:
                self.period_month_var.set(str(template["month"]))
            if template["date_mode"] in ("monthly", "yearly"):
                start, end = period_bounds(template["date_mode"], template["year"], template["month"])
                self.from_var.set(start.isoformat())
                self.to_var.set(end.isoformat())
            else:
                self.from_var.set(template["from_date"])
                self.to_var.set(template["to_date"])
        except (KeyError, TypeError, ValueError) as exc:
            messagebox.showerror("تعذر تطبيق القالب", f"إعدادات القالب غير صالحة: {exc}", parent=self)

    def delete_template(self) -> None:
        name = self.template_var.get()
        if not name or name not in self._stored_templates():
            messagebox.showerror("تعذر حذف القالب", "اختر قالبًا صالحًا أولًا.", parent=self)
            return
        if not messagebox.askyesno("حذف القالب", f"هل تريد حذف القالب «{name}»؟", parent=self):
            return
        try:
            raw = self.store.get_setting(TEMPLATE_SETTING_KEY)
            self.store.set_setting(TEMPLATE_SETTING_KEY, remove_report_template(raw, name, self.template_columns))
            self.template_var.set("")
            self._refresh_templates()
        except Exception as exc:
            messagebox.showerror("تعذر حذف القالب", str(exc), parent=self)

    def apply_quick_period(self) -> None:
        try:
            mode = self.period_mode_var.get()
            if mode in ("monthly", "yearly"):
                start, end = period_bounds(mode, int(self.period_year_var.get()), int(self.period_month_var.get()) if mode == "monthly" else None)
                self.from_var.set(start.isoformat())
                self.to_var.set(end.isoformat())
        except (TypeError, ValueError) as exc:
            messagebox.showerror("فترة غير صالحة", str(exc), parent=self)

    def _form_field(self, parent: tk.Widget, label: str, variable: tk.StringVar, values: list[str] | None, width: int, labels: dict[str, str] | None = None) -> None:
        box = tk.Frame(parent, bg=WHITE)
        box.pack(side="right", padx=6, pady=4)
        tk.Label(box, text=label, bg=WHITE, fg=MUTED, font=("Tahoma", 8)).pack(anchor="e")
        if values:
            display_values = [labels.get(value, value) for value in values] if labels else values
            reverse = {display: actual for actual, display in zip(values, display_values)}
            shown = tk.StringVar(value=labels.get(variable.get(), variable.get()) if labels else variable.get())
            combo = ttk.Combobox(box, textvariable=shown, values=display_values, state="readonly", width=width, justify="right")
            combo.pack(ipady=3)
            combo.bind("<<ComboboxSelected>>", lambda _e, v=variable, s=shown, r=reverse: v.set(r.get(s.get(), s.get())))
        else:
            tk.Entry(box, textvariable=variable, justify="right", width=width, font=("Tahoma", 9), relief="solid", bd=1).pack(ipady=4)

    def export(self) -> None:
        try:
            start, end = date.fromisoformat(self.from_var.get().strip()), date.fromisoformat(self.to_var.get().strip())
            if start > end:
                raise ValueError("تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.")
            selected_indices = self.asset_list.curselection()
            if not selected_indices:
                raise ValueError("حدد أصلًا واحدًا على الأقل.")
            selected_codes = {self.asset_codes[index] for index in selected_indices}
            chosen_columns = [key for key, _label in CUSTOM_DETAIL_FIELDS if self.column_vars[key].get()]
            options = {key: variable.get() for key, variable in self.section_vars.items()}
            if not any(options.values()):
                raise ValueError("حدد ورقة واحدة على الأقل.")
            if options["include_details"] and not chosen_columns:
                raise ValueError("حدد عمودًا واحدًا على الأقل لتفاصيل الأصول.")
        except Exception as exc:
            messagebox.showerror("راجع إعدادات التقرير", str(exc), parent=self)
            return
        mode_label = self.granularity_var.get().replace(" ", "_")
        path = filedialog.asksaveasfilename(parent=self, title="حفظ تقرير Excel المخصص", defaultextension=".xlsx", initialfile=f"تقرير_{mode_label}_{start.isoformat()}_{end.isoformat()}.xlsx", filetypes=[("Excel Workbook", "*.xlsx")])
        if not path:
            return
        orientation = self.orientation_var.get()
        orientation = "landscape" if orientation == "أفقي" else "portrait" if orientation == "عمودي" else orientation
        try:
            export_custom_period_workbook(
                path, self.assets, self.company, self.currency, start, end,
                granularity="الفترة كاملة" if self.granularity_var.get() == "مخصص" else self.granularity_var.get(), selected_codes=selected_codes,
                columns=chosen_columns, include_detail_total=self.total_var.get(),
                orientation=orientation, filters=self.filters, **options,
            )
            messagebox.showinfo("اكتمل التصدير", f"تم إنشاء تقرير Excel بنجاح:\n{path}", parent=self)
            self.destroy()
        except Exception as exc:
            messagebox.showerror("تعذر إنشاء التقرير", str(exc), parent=self)
