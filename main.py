from __future__ import annotations

import json
import sqlite3
import tkinter as tk
from datetime import date, datetime
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any, Callable

from aosol_config import (
    configured_backup_directory, copy_database_to_directory, load_app_preferences,
    prepare_writable_directory, save_app_preferences, write_backup_snapshot,
)
from aosol_core import (
    APP_NAME, METHODS, STATUSES, AssetStore, demo_assets,
    depreciation_schedule, export_csv, money, valuation,
)
from aosol_excel import DISPOSAL_TYPES, export_assets_workbook, export_import_template, parse_import_file
from import_ui import ImportPreviewDialog
from reports_ui import ReportsDialog
from ui_components import ScrollableFrame

NAVY = "#12213a"
NAVY_DARK = "#0d1829"
TEAL = "#13a89e"
GOLD = "#d6ad60"
INK = "#18263b"
MUTED = "#718096"
BG = "#f3f6fa"
WHITE = "#ffffff"
BORDER = "#e2e8f0"


def fmt(value: float, decimals: int = 0) -> str:
    return f"{value:,.{decimals}f}"


class AosolApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Aosol | إدارة الأصول الثابتة")
        screen_width, screen_height = self.winfo_screenwidth(), self.winfo_screenheight()
        width, height = min(1360, max(900, screen_width - 40)), min(840, max(500, screen_height - 72))
        self.geometry(f"{width}x{height}")
        self.minsize(min(width, 900), min(height, 560))
        self.configure(bg=BG)
        self.store = AssetStore()
        self.categories = self.store.get_categories()
        self.assets: list[dict[str, Any]] = []
        self.currency = self.store.get_setting("currency") or "ريال يمني"
        self.company = self.store.get_setting("company_name") or "شركة سبأ للتجارة والاستثمار المحدودة"
        self.commercial_reg = self.store.get_setting("commercial_reg") or ""
        self.tax_number = self.store.get_setting("tax_number") or ""
        self.search_var = tk.StringVar()
        self.status_var = tk.StringVar(value="الكل")
        self.category_filter_var = tk.StringVar(value="الكل")
        self.method_filter_var = tk.StringVar(value="الكل")
        self.department_filter_var = tk.StringVar(value="الكل")
        self._sort_reverse: dict[str, bool] = {}
        self._setup_style()
        self._build_layout()
        self.refresh()
        self.protocol("WM_DELETE_WINDOW", self.on_close)
        self.after(2500, self._auto_backup_tick)

    def _setup_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Treeview", font=("Tahoma", 10), rowheight=38, background=WHITE, fieldbackground=WHITE, foreground=INK, borderwidth=0)
        style.configure("Treeview.Heading", font=("Tahoma", 10, "bold"), background="#edf2f7", foreground=NAVY, relief="flat", padding=(8, 12))
        style.map("Treeview", background=[("selected", "#d9f2f0")], foreground=[("selected", NAVY)])
        style.configure("TCombobox", font=("Tahoma", 10), padding=7)
        style.configure("Vertical.TScrollbar", background="#d5dee8", troughcolor=BG, borderwidth=0, arrowsize=12)

    def _build_layout(self) -> None:
        header = tk.Frame(self, bg=NAVY, height=86)
        header.pack(fill="x")
        header.pack_propagate(False)
        right = tk.Frame(header, bg=NAVY)
        right.pack(side="right", padx=30, pady=16)
        tk.Label(right, text="AOSOL", bg=NAVY, fg=GOLD, font=("Arial", 22, "bold")).pack(side="right", padx=(0, 14))
        title_box = tk.Frame(right, bg=NAVY)
        title_box.pack(side="right")
        tk.Label(title_box, text="إدارة الأصول الثابتة", bg=NAVY, fg=WHITE, font=("Tahoma", 17, "bold"), anchor="e").pack(anchor="e")
        tk.Label(title_box, text="منظومة مالية مكتبية آمنة • تعمل دون اتصال بالإنترنت", bg=NAVY, fg="#b9c7d9", font=("Tahoma", 9), anchor="e").pack(anchor="e", pady=(3, 0))
        header_actions = tk.Frame(header, bg=NAVY)
        header_actions.pack(side="left", padx=24, pady=21)
        self._button(header_actions, "نسخة احتياطية", self.backup, kind="ghost").pack(side="left", padx=5)
        self._button(header_actions, "قالب Excel", self.export_template, kind="ghost").pack(side="left", padx=5)
        self._button(header_actions, "تصدير Excel", self.export_excel, kind="ghost").pack(side="left", padx=5)
        self._button(header_actions, "+ إضافة أصل", self.add_asset, kind="primary").pack(side="left", padx=5)

        nav = tk.Frame(self, bg=WHITE, height=48, highlightbackground=BORDER, highlightthickness=1)
        nav.pack(fill="x")
        nav.pack_propagate(False)
        for label, callback, selected in [
            ("لوحة الأصول", self.focus_assets, True), ("التقارير والإهلاك", self.open_reports, False),
            ("التصنيفات", self.manage_categories, False), ("النسخ والاستعادة", self.backup, False), ("الإعدادات", self.settings, False),
        ]:
            color = TEAL if selected else MUTED
            tk.Button(nav, text=label, command=callback, bg=WHITE, fg=color, activebackground="#f4f8fb", activeforeground=TEAL, font=("Tahoma", 10, "bold" if selected else "normal"), relief="flat", padx=18, pady=12, cursor="hand2", bd=0).pack(side="right", padx=4)
        self._button(nav, "تعديل الأصل", self.edit_asset).pack(side="left", padx=10, pady=5)
        self.content_scroll = ScrollableFrame(self, background=BG)
        self.content_scroll.pack(fill="both", expand=True, padx=28, pady=(20, 14))
        self.content = self.content_scroll.content
        footer = tk.Frame(self, bg=NAVY_DARK, height=32)
        footer.pack(fill="x", side="bottom")
        footer.pack_propagate(False)
        self.footer_label = tk.Label(footer, text="", bg=NAVY_DARK, fg="#c2ccda", font=("Tahoma", 9), anchor="e")
        self.footer_label.pack(side="right", padx=25, pady=7)
        tk.Label(footer, text="Aosol Desktop 1.0  |  Python", bg=NAVY_DARK, fg="#93a4bb", font=("Arial", 9)).pack(side="left", padx=25, pady=7)

    def _button(self, parent: tk.Widget, text: str, command: Callable[[], None], kind: str = "normal", width: int | None = None) -> tk.Button:
        if kind == "primary":
            bg, fg, active = TEAL, WHITE, "#0e8d84"
        elif kind == "danger":
            bg, fg, active = "#fff1f0", "#bd3e36", "#ffe2df"
        elif kind == "ghost":
            bg, fg, active = NAVY, WHITE, "#263b5b"
        else:
            bg, fg, active = WHITE, NAVY, "#edf3f8"
        return tk.Button(parent, text=text, command=command, bg=bg, fg=fg, activebackground=active, activeforeground=fg, font=("Tahoma", 10, "bold"), relief="flat", bd=0, padx=15, pady=9, cursor="hand2", width=width, highlightthickness=1 if kind == "normal" else 0, highlightbackground=BORDER)

    def _card(self, parent: tk.Widget, title: str, value: str, caption: str, accent: str) -> tk.Frame:
        card = tk.Frame(parent, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        card.pack(side="right", fill="both", expand=True, padx=(0, 12))
        band = tk.Frame(card, bg=accent, width=4)
        band.pack(side="right", fill="y")
        body = tk.Frame(card, bg=WHITE)
        body.pack(fill="both", expand=True, padx=16, pady=13)
        tk.Label(body, text=title, bg=WHITE, fg=MUTED, font=("Tahoma", 9, "bold"), anchor="e").pack(fill="x")
        tk.Label(body, text=value, bg=WHITE, fg=NAVY, font=("Tahoma", 18, "bold"), anchor="e").pack(fill="x", pady=(5, 2))
        tk.Label(body, text=caption, bg=WHITE, fg="#91a0b2", font=("Tahoma", 8), anchor="e").pack(fill="x")
        return card

    def refresh(self) -> None:
        self.assets = self.store.all()
        self.categories = self.store.get_categories()
        if self.category_filter_var.get() not in ("الكل", *self.categories):
            self.category_filter_var.set("الكل")
        for child in self.content.winfo_children():
            child.destroy()
        active = [a for a in self.assets if a.get("status") != "disposed"]
        total = sum(valuation(a)["totalCost"] for a in active)
        accum = sum(valuation(a)["accumulatedDepreciation"] for a in active)
        book = sum(valuation(a)["netBookValue"] for a in active)
        disposed = sum(a.get("status") == "disposed" for a in self.assets)
        cards = tk.Frame(self.content, bg=BG)
        cards.pack(fill="x", pady=(0, 18))
        self._card(cards, "عدد الأصول المسجلة", fmt(len(self.assets)), f"منها {disposed} أصل مستبعد", TEAL)
        self._card(cards, "إجمالي التكلفة التاريخية", fmt(total), self.currency, "#4c78a8")
        self._card(cards, "مجمع الإهلاك", fmt(accum), self.currency, GOLD)
        self._card(cards, "صافي القيمة الدفترية", fmt(book), self.currency, "#46a17d")

        panel = tk.Frame(self.content, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        panel.pack(fill="both", expand=True)
        title_row = tk.Frame(panel, bg=WHITE)
        title_row.pack(fill="x", padx=18, pady=(16, 12))
        tk.Label(title_row, text="سجل الأصول الثابتة", bg=WHITE, fg=NAVY, font=("Tahoma", 14, "bold"), anchor="e").pack(side="right")
        tk.Label(title_row, text="إدارة البيانات المالية ومتابعة الإهلاك", bg=WHITE, fg=MUTED, font=("Tahoma", 9), anchor="e").pack(side="right", padx=14)
        controls = tk.Frame(panel, bg=WHITE)
        controls.pack(fill="x", padx=18, pady=(0, 12))
        departments = sorted({str(a.get("department", "")).strip() for a in self.assets if str(a.get("department", "")).strip()})
        self.status_combo = ttk.Combobox(controls, textvariable=self.status_var, state="readonly", values=["الكل", *STATUSES.values()], width=14, justify="right")
        self.status_combo.pack(side="left", padx=(0, 7))
        self.status_combo.bind("<<ComboboxSelected>>", lambda _e: self.populate())
        self.category_combo = ttk.Combobox(controls, textvariable=self.category_filter_var, state="readonly", values=["الكل", *self.categories], width=22, justify="right")
        self.category_combo.pack(side="left", padx=(0, 7))
        self.category_combo.bind("<<ComboboxSelected>>", lambda _e: self.populate())
        self.method_combo = ttk.Combobox(controls, textvariable=self.method_filter_var, state="readonly", values=["الكل", *METHODS.values()], width=22, justify="right")
        self.method_combo.pack(side="left", padx=(0, 7))
        self.method_combo.bind("<<ComboboxSelected>>", lambda _e: self.populate())
        self.department_combo = ttk.Combobox(controls, textvariable=self.department_filter_var, state="readonly", values=["الكل", *departments], width=16, justify="right")
        self.department_combo.pack(side="left", padx=(0, 7))
        self.department_combo.bind("<<ComboboxSelected>>", lambda _e: self.populate())
        search = tk.Entry(controls, textvariable=self.search_var, font=("Tahoma", 10), justify="right", relief="flat", bg="#f5f7fa", fg=INK, insertbackground=INK, highlightthickness=1, highlightbackground=BORDER, highlightcolor=TEAL)
        search.pack(side="right", fill="x", expand=True, ipady=9, padx=(10, 0))
        search.insert(0, "")
        search.bind("<KeyRelease>", lambda _e: self.populate())
        tk.Label(controls, text="بحث بالاسم أو الكود أو الموقع أو الرقم التسلسلي", bg=WHITE, fg=MUTED, font=("Tahoma", 8)).pack(side="right", padx=(0, 10))

        table_wrap = tk.Frame(panel, bg=WHITE)
        table_wrap.pack(fill="both", expand=True, padx=18, pady=(0, 12))
        cols = ("code", "name", "category", "department", "service", "cost", "accum", "book", "method", "status")
        self.tree = ttk.Treeview(table_wrap, columns=cols, show="headings", selectmode="browse")
        headings = [("code", "رمز الأصل", 110), ("name", "اسم الأصل", 220), ("category", "التصنيف", 160), ("department", "الإدارة", 150), ("service", "تاريخ التشغيل", 110), ("cost", "التكلفة الإجمالية", 130), ("accum", "مجمع الإهلاك", 130), ("book", "صافي القيمة الدفترية", 145), ("method", "طريقة الإهلاك", 155), ("status", "الحالة", 100)]
        for col, label, width in headings:
            self.tree.heading(col, text=label, anchor="e", command=lambda current=col: self._sort_by(current))
            self.tree.column(col, width=width, anchor="e", stretch=(col in ("name", "department")))
        self.tree.tag_configure("odd", background="#f8fafc")
        self.tree.tag_configure("disposed", foreground="#98a2b3")
        scrollbar = ttk.Scrollbar(table_wrap, orient="vertical", command=self.tree.yview)
        hscrollbar = ttk.Scrollbar(table_wrap, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=scrollbar.set, xscrollcommand=hscrollbar.set)
        self.tree.pack(side="right", fill="both", expand=True)
        scrollbar.pack(side="left", fill="y")
        hscrollbar.pack(side="bottom", fill="x")
        self.tree.bind("<Double-1>", lambda _e: self.edit_asset())
        self.tree.bind("<Return>", lambda _e: self.edit_asset())

        actions = tk.Frame(panel, bg="#f8fafc")
        actions.pack(fill="x", padx=18, pady=(0, 16))
        self._button(actions, "تعديل الأصل", self.edit_asset).pack(side="right", padx=(0, 8), pady=9)
        self._button(actions, "مركز التقارير", self.open_reports).pack(side="right", padx=8, pady=9)
        self._button(actions, "جدول الإهلاك", self.report).pack(side="right", padx=8, pady=9)
        self._button(actions, "استبعاد / بيع", self.dispose_asset).pack(side="right", padx=8, pady=9)
        self._button(actions, "استيراد", self.import_file).pack(side="left", padx=8, pady=9)
        self._button(actions, "بيانات تجريبية", self.load_demo).pack(side="left", padx=8, pady=9)
        self._button(actions, "حذف", self.delete_asset, kind="danger").pack(side="left", padx=8, pady=9)
        self.populate()
        self.footer_label.config(text=f"{self.company}   •   العملة: {self.currency}   •   قاعدة البيانات محلية على هذا الجهاز")

    def populate(self) -> None:
        if not hasattr(self, "tree"):
            return
        self.tree.delete(*self.tree.get_children())
        query = self.search_var.get().strip().casefold()
        selected_status = self.status_var.get()
        selected_category = self.category_filter_var.get()
        selected_method = self.method_filter_var.get()
        selected_department = self.department_filter_var.get()
        for index, asset in enumerate(self.assets):
            search_values = (asset.get("name"), asset.get("code"), asset.get("accountCode"), asset.get("location"), asset.get("department"), asset.get("custodian"), asset.get("serialNumber"), asset.get("supplier"))
            if query and not any(query in str(value or "").casefold() for value in search_values):
                continue
            val = valuation(asset)
            state = asset.get("status", "active")
            if state not in ("disposed", "under_maintenance", "idle") and val["netBookValue"] <= money(asset.get("salvageValue")) + 0.01:
                state = "fully_depreciated"
            if selected_status != "الكل" and STATUSES.get(state, "نشط") != selected_status:
                continue
            if selected_category != "الكل" and asset.get("category", "") != selected_category:
                continue
            if selected_method != "الكل" and METHODS.get(asset.get("depreciationMethod"), "") != selected_method:
                continue
            if selected_department != "الكل" and asset.get("department", "") != selected_department:
                continue
            tags = ("disposed",) if state == "disposed" else (("odd",) if index % 2 else ())
            values = (asset.get("code", ""), asset.get("name", ""), asset.get("category", ""), asset.get("department", ""), asset.get("inServiceDate", ""), fmt(val["totalCost"]), fmt(val["accumulatedDepreciation"]), fmt(val["netBookValue"]), METHODS.get(asset.get("depreciationMethod"), ""), STATUSES.get(state, "نشط"))
            self.tree.insert("", "end", iid=asset["id"], values=values, tags=tags)

    def _sort_by(self, column: str) -> None:
        if not hasattr(self, "tree"):
            return
        reverse = self._sort_reverse.get(column, False)
        children = list(self.tree.get_children(""))
        def sort_key(item: str) -> Any:
            value = self.tree.set(item, column)
            if column in ("cost", "accum", "book"):
                try:
                    return float(value.replace(",", ""))
                except ValueError:
                    return 0.0
            if column == "service":
                try:
                    return date.fromisoformat(value[:10])
                except ValueError:
                    return date.min
            return str(value).casefold()
        for index, item in enumerate(sorted(children, key=sort_key, reverse=reverse)):
            self.tree.move(item, "", index)
        self._sort_reverse[column] = not reverse

    def visible_assets(self) -> list[dict[str, Any]]:
        visible_ids = set(self.tree.get_children()) if hasattr(self, "tree") else set()
        return [asset for asset in self.assets if asset.get("id") in visible_ids]

    def selected_asset(self) -> dict[str, Any] | None:
        selected = self.tree.selection() if hasattr(self, "tree") else ()
        if not selected:
            messagebox.showinfo("Aosol", "حدد أصلًا من السجل أولاً.", parent=self)
            return None
        return next((a for a in self.assets if a["id"] == selected[0]), None)

    def focus_assets(self) -> None:
        self.search_var.set("")
        self.status_var.set("الكل")
        self.category_filter_var.set("الكل")
        self.method_filter_var.set("الكل")
        self.department_filter_var.set("الكل")
        self.refresh()

    def add_asset(self) -> None:
        AssetDialog(self, None, self.save_asset, self.currency)

    def edit_asset(self) -> None:
        asset = self.selected_asset()
        if asset:
            AssetDialog(self, asset, self.save_asset, self.currency)

    def save_asset(self, asset: dict[str, Any]) -> None:
        try:
            self.store.save(asset)
            self.refresh()
            messagebox.showinfo("تم الحفظ", "تم حفظ بيانات الأصل بنجاح.", parent=self)
        except sqlite3.IntegrityError as exc:
            messagebox.showerror("تعذر الحفظ", str(exc), parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر الحفظ", f"تحقق من رمز الأصل والحقول المدخلة.\n{exc}", parent=self)

    def delete_asset(self) -> None:
        asset = self.selected_asset()
        if asset and messagebox.askyesno("تأكيد الحذف", f"هل تريد حذف الأصل «{asset['name']}» نهائيًا؟", parent=self):
            self.store.delete(asset["id"])
            self.refresh()

    def dispose_asset(self) -> None:
        asset = self.selected_asset()
        if not asset:
            return
        if asset.get("status") == "disposed":
            if messagebox.askyesno("استعادة الأصل", "هذا الأصل مستبعد. هل تريد استعادته إلى الأصول النشطة؟", parent=self):
                asset["status"] = "active"
                asset.pop("disposal", None)
                self.store.save(asset)
                self.refresh()
            return
        val = valuation(asset)
        dialog = tk.Toplevel(self)
        dialog.title("تسجيل استبعاد الأصل")
        dialog.configure(bg=WHITE)
        screen_height = dialog.winfo_screenheight()
        dialog.geometry(f"560x{min(650, max(500, screen_height - 100))}")
        dialog.minsize(480, 500)
        dialog.transient(self)
        dialog.grab_set()
        form_scroll = ScrollableFrame(dialog, background=WHITE)
        form_scroll.pack(fill="both", expand=True, padx=12, pady=(12, 4))
        form = form_scroll.content
        tk.Label(form, text="تسجيل بيع أو استبعاد الأصل", bg=WHITE, fg=NAVY, font=("Tahoma", 14, "bold")).pack(anchor="e", padx=22, pady=(12, 10))
        tk.Label(form, text=f"القيمة الدفترية الحالية: {fmt(val['netBookValue'])} {self.currency}", bg=WHITE, fg=MUTED, font=("Tahoma", 10)).pack(anchor="e", padx=22, pady=5)
        price_var, cost_var, date_var = tk.StringVar(value="0"), tk.StringVar(value="0"), tk.StringVar(value=date.today().isoformat())
        buyer_var, reason_var = tk.StringVar(), tk.StringVar()
        type_labels = {label: code for code, label in DISPOSAL_TYPES.items()}
        type_var = tk.StringVar(value=DISPOSAL_TYPES["sale"])
        type_row = tk.Frame(form, bg=WHITE)
        type_row.pack(fill="x", padx=22, pady=7)
        tk.Label(type_row, text="نوع الاستبعاد", bg=WHITE, fg=INK, font=("Tahoma", 9), width=24, anchor="e").pack(side="right")
        type_combo = ttk.Combobox(type_row, textvariable=type_var, values=list(type_labels), state="readonly", justify="right", font=("Tahoma", 10))
        type_combo.pack(side="left", fill="x", expand=True, ipady=4)
        fields = [("تاريخ الاستبعاد (YYYY-MM-DD)", date_var), ("متحصلات / قيمة الاسترداد", price_var), ("تكاليف الاستبعاد", cost_var), ("المشتري / الجهة المستلمة", buyer_var), ("سبب الاستبعاد", reason_var)]
        for label, var in fields:
            row = tk.Frame(form, bg=WHITE)
            row.pack(fill="x", padx=22, pady=7)
            tk.Label(row, text=label, bg=WHITE, fg=INK, font=("Tahoma", 9), width=24, anchor="e").pack(side="right")
            tk.Entry(row, textvariable=var, justify="right", font=("Tahoma", 10), relief="solid", bd=1).pack(side="left", fill="x", expand=True, ipady=5)
        def confirm() -> None:
            try:
                disposal_day = date.fromisoformat(date_var.get())
                purchase_day = date.fromisoformat(str(asset.get("purchaseDate", disposal_day.isoformat()))[:10])
                if disposal_day < purchase_day:
                    raise ValueError("تاريخ الاستبعاد يسبق تاريخ الشراء.")
                disposal_date = disposal_day.isoformat()
                price, costs = money(price_var.get().replace(",", "")), money(cost_var.get().replace(",", ""))
            except Exception:
                messagebox.showerror("بيانات غير صحيحة", "تحقق من التاريخ والمبالغ.", parent=dialog)
                return
            disposal_value = valuation(asset, disposal_day)
            gain_loss = price - costs - disposal_value["netBookValue"]
            asset["status"] = "disposed"
            asset["disposal"] = {"disposalDate": disposal_date, "salePrice": price, "disposalCosts": costs, "bookValueAtDisposal": disposal_value["netBookValue"], "accumulatedAtDisposal": disposal_value["accumulatedDepreciation"], "gainLoss": gain_loss, "disposalType": type_labels.get(type_var.get(), "sale"), "buyerName": buyer_var.get().strip(), "reason": reason_var.get().strip()}
            self.store.save(asset)
            dialog.destroy()
            self.refresh()
            messagebox.showinfo("تم الاستبعاد", f"الربح / (الخسارة): {fmt(gain_loss)} {self.currency}", parent=self)
        self._button(dialog, "تأكيد الاستبعاد", confirm, kind="primary").pack(side="left", padx=22, pady=12)

    def open_reports(self) -> None:
        if not self.assets:
            messagebox.showinfo("التقارير", "لا توجد أصول لعرضها بعد.", parent=self)
            return
        ReportsDialog(self, self.assets, self.company, self.currency)

    def manage_categories(self) -> None:
        CategoryManagerDialog(self, self.store)

    def report(self) -> None:
        asset = self.selected_asset() if hasattr(self, "tree") and self.tree.selection() else None
        if not asset:
            assets = [a for a in self.assets if a.get("status") != "disposed"]
            if not assets:
                messagebox.showinfo("جدول الإهلاك", "لا توجد أصول نشطة لعرض جدول الإهلاك.", parent=self)
                return
            asset = assets[0]
        schedule = depreciation_schedule(asset)
        dialog = tk.Toplevel(self)
        dialog.title("جدول الإهلاك السنوي")
        dialog.geometry("850x570")
        dialog.configure(bg=BG)
        dialog.transient(self)
        val = valuation(asset)
        top = tk.Frame(dialog, bg=NAVY)
        top.pack(fill="x")
        tk.Label(top, text=f"جدول الإهلاك  |  {asset['name']}", bg=NAVY, fg=WHITE, font=("Tahoma", 14, "bold"), anchor="e").pack(fill="x", padx=20, pady=(14, 5))
        tk.Label(top, text=f"{asset['code']}     •     {METHODS.get(asset.get('depreciationMethod'), '')}     •     صافي القيمة: {fmt(val['netBookValue'])} {self.currency}", bg=NAVY, fg="#c9d5e4", font=("Tahoma", 9), anchor="e").pack(fill="x", padx=20, pady=(0, 14))
        frame = tk.Frame(dialog, bg=WHITE)
        frame.pack(fill="both", expand=True, padx=18, pady=18)
        cols = ("period", "beginning", "expense", "accumulated", "ending")
        tree = ttk.Treeview(frame, columns=cols, show="headings")
        for col, label, width in [("period", "الفترة", 170), ("beginning", "القيمة أول المدة", 150), ("expense", "مصروف الإهلاك", 150), ("accumulated", "مجمع الإهلاك", 150), ("ending", "القيمة آخر المدة", 160)]:
            tree.heading(col, text=label, anchor="e")
            tree.column(col, width=width, anchor="e")
        vs = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        hs = ttk.Scrollbar(frame, orient="horizontal", command=tree.xview)
        tree.configure(yscrollcommand=vs.set, xscrollcommand=hs.set)
        for row in schedule:
            tree.insert("", "end", values=(row["period"], fmt(float(row["beginning"])), fmt(float(row["expense"])), fmt(float(row["accumulated"])), fmt(float(row["ending"]))))
        tree.pack(side="top", fill="both", expand=True)
        vs.pack(side="right", fill="y")
        hs.pack(side="bottom", fill="x")
        self._button(dialog, "إغلاق", dialog.destroy).pack(side="left", padx=18, pady=(0, 16))

    def export_excel(self) -> None:
        if not self.assets:
            messagebox.showinfo("التصدير", "لا توجد بيانات لتصديرها.", parent=self)
            return
        filtered_assets = self.visible_assets()
        export_filtered = messagebox.askyesnocancel(
            "نطاق التصدير",
            f"نعم: تصدير النتائج الظاهرة بعد البحث والمرشحات ({len(filtered_assets)} أصل).\nلا: تصدير جميع الأصول ({len(self.assets)} أصل).",
            parent=self,
        )
        if export_filtered is None:
            return
        assets_to_export = filtered_assets if export_filtered else self.assets
        if not assets_to_export:
            messagebox.showinfo("التصدير", "لا توجد أصول ظاهرة بعد تطبيق المرشحات.", parent=self)
            return
        path = filedialog.asksaveasfilename(parent=self, title="تصدير سجل الأصول", defaultextension=".xlsx", initialfile=f"سجل_الأصول_{date.today().isoformat()}.xlsx", filetypes=[("Excel", "*.xlsx"), ("CSV", "*.csv")])
        if not path:
            return
        try:
            if Path(path).suffix.lower() == ".csv":
                export_csv(path, assets_to_export)
            else:
                export_assets_workbook(path, assets_to_export, self.company, self.currency)
            messagebox.showinfo("تم التصدير", f"تم حفظ سجل الأصول بنجاح:\n{path}", parent=self)
        except ImportError:
            messagebox.showerror("مكتبة ناقصة", "مكتبة openpyxl غير مثبّتة. أعد تثبيت التطبيق أو استخدم CSV.", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر التصدير", str(exc), parent=self)

    def export_template(self) -> None:
        path = filedialog.asksaveasfilename(parent=self, title="حفظ قالب استيراد الأصول", defaultextension=".xlsx", initialfile="قالب_استيراد_أصول_Aosol.xlsx", filetypes=[("Excel Workbook", "*.xlsx")])
        if not path:
            return
        try:
            export_import_template(path, self.categories)
            messagebox.showinfo("تم إنشاء القالب", f"املأ ورقة «قالب الأصول» ثم اختر استيراد من التطبيق.\n\n{path}", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر إنشاء القالب", str(exc), parent=self)

    def _auto_backup_tick(self) -> None:
        try:
            preferences = load_app_preferences()
            if preferences.get("auto_backup_enabled"):
                interval_days = max(1, int(preferences.get("auto_backup_interval_days", 7)))
                last_raw = str(preferences.get("last_auto_backup_at") or "")
                try:
                    last = datetime.fromisoformat(last_raw)
                    due = (datetime.now() - last).total_seconds() >= interval_days * 86400
                except ValueError:
                    due = True
                if due:
                    directory = preferences.get("backup_directory") or str(configured_backup_directory())
                    backup_path = write_backup_snapshot(self.store.backup_data(), directory, automatic=True)
                    preferences["last_auto_backup_at"] = datetime.now().isoformat(timespec="seconds")
                    preferences["last_auto_backup_path"] = str(backup_path)
                    save_app_preferences(preferences)
                    self.footer_label.config(text=f"تم إنشاء النسخة الدورية: {backup_path}")
        except Exception as exc:
            if hasattr(self, "footer_label"):
                self.footer_label.config(text=f"تعذر إنشاء النسخة الدورية: {exc}")
        try:
            self.after(60_000, self._auto_backup_tick)
        except tk.TclError:
            pass

    def backup(self) -> None:
        backup_directory = str(prepare_writable_directory(configured_backup_directory()))
        choice = messagebox.askyesnocancel("النسخ الاحتياطي", "هل تريد إنشاء نسخة احتياطية؟\n\nنعم: حفظ نسخة JSON\nلا: استعادة نسخة من ملف JSON", parent=self)
        if choice is None:
            return
        if choice:
            path = filedialog.asksaveasfilename(parent=self, title="حفظ نسخة احتياطية", initialdir=backup_directory, defaultextension=".json", initialfile=f"Aosol_backup_{date.today().isoformat()}.json", filetypes=[("نسخة Aosol", "*.json")])
            if not path:
                return
            Path(path).write_text(json.dumps(self.store.backup_data(), ensure_ascii=False, indent=2), encoding="utf-8")
            messagebox.showinfo("تم النسخ", f"حُفظت النسخة الاحتياطية في:\n{path}", parent=self)
        else:
            path = filedialog.askopenfilename(parent=self, title="استعادة النسخة الاحتياطية", initialdir=backup_directory, filetypes=[("نسخة Aosol", "*.json")])
            if not path:
                return
            try:
                data = json.loads(Path(path).read_text(encoding="utf-8"))
                replace = messagebox.askyesno("طريقة الاستعادة", "هل تريد استبدال السجل الحالي؟\nاختر لا لدمج الأصول الجديدة دون تكرار الأكواد.", parent=self)
                count = self.store.restore(data, replace=replace)
                self.currency = self.store.get_setting("currency") or self.currency
                self.company = self.store.get_setting("company_name") or self.company
                self.commercial_reg = self.store.get_setting("commercial_reg") or ""
                self.tax_number = self.store.get_setting("tax_number") or ""
                self.refresh()
                messagebox.showinfo("اكتملت الاستعادة", f"تم استيراد {count} أصل.", parent=self)
            except Exception as exc:
                messagebox.showerror("تعذر الاستعادة", str(exc), parent=self)

    def import_file(self) -> None:
        path = filedialog.askopenfilename(parent=self, title="استيراد الأصول من قالب Aosol أو CSV", filetypes=[("ملفات البيانات", "*.json *.xlsx *.xlsm *.csv"), ("Excel", "*.xlsx *.xlsm"), ("CSV", "*.csv"), ("نسخة احتياطية", "*.json")])
        if not path:
            return
        try:
            suffix = Path(path).suffix.lower()
            if suffix == ".json":
                data = json.loads(Path(path).read_text(encoding="utf-8"))
                count = self.store.restore(data, replace=False)
                self.refresh()
                messagebox.showinfo("اكتملت الاستعادة", f"تم استيراد {count} أصل من النسخة الاحتياطية.", parent=self)
                return
            existing_codes = {str(asset.get("code", "")).strip() for asset in self.assets}
            batch = parse_import_file(path, existing_codes, self.categories)
            if batch["rowsScanned"] == 0:
                messagebox.showinfo("لا توجد صفوف", "لم أجد بيانات أصول تحت صف العناوين. املأ ورقة «قالب الأصول» ثم أعد المحاولة.", parent=self)
                return
            ImportPreviewDialog(self, batch, self._commit_import)
        except Exception as exc:
            messagebox.showerror("تعذر الاستيراد", f"تحقق من تنسيق الملف.\n{exc}", parent=self)

    def _commit_import(self, assets: list[dict[str, Any]]) -> None:
        try:
            self.store.save_many(assets)
            self.refresh()
            messagebox.showinfo("اكتمل الاستيراد", f"تمت إضافة {len(assets)} أصل إلى قاعدة البيانات المحلية.", parent=self)
        except sqlite3.IntegrityError as exc:
            messagebox.showerror("تعذر إتمام الاستيراد", f"لم يُحفظ أي أصل لأن رمزًا مكررًا ظهر أثناء العملية.\n{exc}", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر إتمام الاستيراد", f"لم يُحفظ أي أصل؛ تراجعت العملية لحماية قاعدة البيانات.\n{exc}", parent=self)

    def settings(self) -> None:
        dialog = tk.Toplevel(self)
        dialog.title("إعدادات المنشأة والتخزين")
        screen_width, screen_height = dialog.winfo_screenwidth(), dialog.winfo_screenheight()
        width, height = min(760, max(560, screen_width - 40)), min(760, max(500, screen_height - 80))
        dialog.geometry(f"{width}x{height}")
        dialog.minsize(min(width, 540), min(height, 480))
        dialog.configure(bg=WHITE)
        dialog.transient(self)
        dialog.grab_set()
        form_scroll = ScrollableFrame(dialog, background=WHITE)
        form_scroll.pack(fill="both", expand=True, padx=14, pady=(12, 4))
        form = form_scroll.content
        tk.Label(form, text="إعدادات المنشأة والتخزين والنسخ", bg=WHITE, fg=NAVY, font=("Tahoma", 15, "bold")).pack(anchor="e", padx=20, pady=(12, 16))
        company_var = tk.StringVar(value=self.company)
        reg_var = tk.StringVar(value=self.commercial_reg)
        tax_var = tk.StringVar(value=self.tax_number)
        currency_var = tk.StringVar(value=self.currency)
        preferences = load_app_preferences()
        data_directory_var = tk.StringVar(value=str(self.store.path.parent))
        backup_directory_var = tk.StringVar(value=str(preferences.get("backup_directory") or configured_backup_directory()))
        auto_backup_var = tk.BooleanVar(value=bool(preferences.get("auto_backup_enabled", False)))
        backup_days_var = tk.StringVar(value=str(preferences.get("auto_backup_interval_days", 7)))
        fields = [("اسم المنشأة", company_var), ("السجل التجاري", reg_var), ("الرقم الضريبي", tax_var)]
        for label, var in fields:
            row = tk.Frame(form, bg=WHITE)
            row.pack(fill="x", padx=20, pady=9)
            tk.Label(row, text=label, bg=WHITE, fg=INK, font=("Tahoma", 10), width=17, anchor="e").pack(side="right")
            tk.Entry(row, textvariable=var, justify="right", font=("Tahoma", 10), relief="solid", bd=1).pack(side="left", fill="x", expand=True, ipady=6)
        currency_row = tk.Frame(form, bg=WHITE)
        currency_row.pack(fill="x", padx=20, pady=9)
        tk.Label(currency_row, text="العملة", bg=WHITE, fg=INK, font=("Tahoma", 10), width=17, anchor="e").pack(side="right")
        currencies = ["ريال يمني", "ريال سعودي", "دولار أمريكي", "درهم إماراتي", "جنيه مصري", "دينار كويتي", "ريال قطري", "ريال عماني"]
        ttk.Combobox(currency_row, textvariable=currency_var, values=currencies, justify="right", font=("Tahoma", 10)).pack(side="left", fill="x", expand=True, ipady=5)

        category_row = tk.Frame(form, bg="#f5f8fb", highlightbackground=BORDER, highlightthickness=1)
        category_row.pack(fill="x", padx=20, pady=(12, 4))
        category_text = tk.Frame(category_row, bg="#f5f8fb")
        category_text.pack(side="right", fill="x", expand=True, padx=12, pady=9)
        tk.Label(category_text, text="تصنيفات الأصول", bg="#f5f8fb", fg=NAVY, font=("Tahoma", 10, "bold"), anchor="e").pack(fill="x")
        tk.Label(category_text, text=f"{len(self.categories)} تصنيفًا • يمكنك إضافة تصنيف أو تعديل الاسم وتحديث الأصول المرتبطة به.", bg="#f5f8fb", fg=MUTED, font=("Tahoma", 8), anchor="e").pack(fill="x", pady=(3, 0))
        self._button(category_row, "إدارة التصنيفات", self.manage_categories, kind="primary").pack(side="left", padx=12, pady=9)

        tk.Label(form, text="موقع البيانات والنسخ الاحتياطية", bg=WHITE, fg=NAVY, font=("Tahoma", 11, "bold")).pack(anchor="e", padx=20, pady=(16, 6))

        def directory_row(label: str, variable: tk.StringVar) -> None:
            row = tk.Frame(form, bg=WHITE)
            row.pack(fill="x", padx=20, pady=6)
            tk.Label(row, text=label, bg=WHITE, fg=INK, font=("Tahoma", 9), width=20, anchor="e").pack(side="right", padx=(0, 8))
            entry = tk.Entry(row, textvariable=variable, justify="left", font=("Tahoma", 9), relief="solid", bd=1)
            entry.pack(side="right", fill="x", expand=True, ipady=5)
            def browse() -> None:
                chosen = filedialog.askdirectory(parent=dialog, title=f"اختر {label}", initialdir=variable.get() or str(Path.home()), mustexist=True)
                if chosen:
                    variable.set(chosen)
            tk.Button(row, text="استعراض…", command=browse, bg="#edf3f8", fg=NAVY, relief="flat", font=("Tahoma", 9, "bold"), padx=10, pady=5).pack(side="left", padx=(8, 0))

        directory_row("مجلد قاعدة البيانات", data_directory_var)
        tk.Label(form, text="عند تغيير المجلد تُنسخ قاعدة البيانات الحالية إلى الوجهة الجديدة، وتبقى النسخة الأصلية دون حذف.", bg=WHITE, fg=MUTED, font=("Tahoma", 8), anchor="e", justify="right", wraplength=650).pack(fill="x", padx=28, pady=(0, 4))
        directory_row("مجلد النسخ الاحتياطية", backup_directory_var)

        backup_panel = tk.LabelFrame(form, text="النسخ الاحتياطي الدوري", bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), padx=12, pady=8)
        backup_panel.pack(fill="x", padx=20, pady=(12, 10))
        tk.Checkbutton(backup_panel, text="تفعيل النسخ الاحتياطي التلقائي", variable=auto_backup_var, bg=WHITE, fg=INK, activebackground=WHITE, font=("Tahoma", 9, "bold"), anchor="e").pack(side="right", padx=8)
        tk.Label(backup_panel, text="كل", bg=WHITE, fg=INK, font=("Tahoma", 9)).pack(side="right", padx=(8, 3))
        tk.Spinbox(backup_panel, from_=1, to=3650, textvariable=backup_days_var, width=7, justify="center", font=("Tahoma", 10)).pack(side="right", padx=3, ipady=3)
        tk.Label(backup_panel, text="يوم", bg=WHITE, fg=INK, font=("Tahoma", 9)).pack(side="right", padx=3)
        tk.Label(form, text="يُنشئ التطبيق نسخة JSON عند استحقاق المدة: عند فتح البرنامج ثم كل دقيقة أثناء تشغيله. يحتفظ بآخر 30 نسخة تلقائية.", bg=WHITE, fg=MUTED, font=("Tahoma", 8), anchor="e", justify="right", wraplength=650).pack(fill="x", padx=24, pady=(0, 8))

        def save() -> None:
            new_store: AssetStore | None = None
            try:
                data_dir = Path(data_directory_var.get().strip()).expanduser().resolve()
                backup_dir = prepare_writable_directory(backup_directory_var.get().strip())
                interval_days = int(backup_days_var.get().strip())
                if not 1 <= interval_days <= 3650:
                    raise ValueError("فاصل النسخ يجب أن يكون بين يوم واحد و3650 يومًا.")
                current_dir = self.store.path.parent.resolve()
                if data_dir != current_dir:
                    new_db = copy_database_to_directory(self.store.conn, data_dir)
                    new_store = AssetStore(new_db)
                    if len(new_store.all()) != len(self.store.all()):
                        raise RuntimeError("لم تتطابق سجلات قاعدة البيانات بعد النسخ؛ بقيت القاعدة الأصلية كما هي.")
                target_store = new_store or self.store
                new_company = company_var.get().strip() or self.company
                new_reg = reg_var.get().strip()
                new_tax = tax_var.get().strip()
                new_currency = currency_var.get().strip() or self.currency
                target_store.set_setting("company_name", new_company)
                target_store.set_setting("commercial_reg", new_reg)
                target_store.set_setting("tax_number", new_tax)
                target_store.set_setting("currency", new_currency)
                updated_preferences = dict(preferences)
                old_backup_dir = str(preferences.get("backup_directory") or configured_backup_directory())
                updated_preferences.update({
                    "data_directory": str(data_dir), "backup_directory": str(backup_dir),
                    "auto_backup_enabled": bool(auto_backup_var.get()),
                    "auto_backup_interval_days": interval_days,
                })
                if auto_backup_var.get() and not preferences.get("auto_backup_enabled"):
                    updated_preferences["last_auto_backup_at"] = ""
                if Path(old_backup_dir).expanduser().resolve() != backup_dir:
                    updated_preferences["last_auto_backup_at"] = ""
                save_app_preferences(updated_preferences)
                if new_store:
                    old_store = self.store
                    self.store = new_store
                    new_store = None
                    old_store.close()
                self.company, self.commercial_reg, self.tax_number, self.currency = new_company, new_reg, new_tax, new_currency
                dialog.destroy()
                self.refresh()
                messagebox.showinfo("تم حفظ الإعدادات", "حُفظت إعدادات التخزين والنسخ الاحتياطية بنجاح.", parent=self)
            except Exception as exc:
                if new_store:
                    new_store.close()
                messagebox.showerror("تعذر حفظ الإعدادات", str(exc), parent=dialog)
        self._button(dialog, "حفظ الإعدادات", save, kind="primary").pack(side="left", padx=24, pady=18)

    def load_demo(self) -> None:
        if self.assets:
            messagebox.showwarning("بيانات تجريبية", "أضف البيانات التجريبية إلى قاعدة فارغة فقط لحماية سجلك الحالي.", parent=self)
            return
        if messagebox.askyesno("تحميل بيانات تجريبية", "إضافة خمسة أصول نموذجية للاختبار؟", parent=self):
            for asset in demo_assets():
                self.store.save(asset)
            self.refresh()

    def on_close(self) -> None:
        self.store.close()
        self.destroy()


class AssetDialog(tk.Toplevel):
    def __init__(self, parent: AosolApp, asset: dict[str, Any] | None, on_save: Callable[[dict[str, Any]], None], currency: str):
        super().__init__(parent)
        self.parent, self.original, self.on_save, self.currency = parent, asset, on_save, currency
        self.title("تعديل بيانات الأصل" if asset else "إضافة أصل جديد")
        screen_width, screen_height = self.winfo_screenwidth(), self.winfo_screenheight()
        width = min(900, max(680, screen_width - 48))
        height = min(770, max(520, screen_height - 96))
        self.geometry(f"{width}x{height}")
        self.minsize(min(width, 680), min(height, 520))
        self.configure(bg=BG)
        self.transient(parent)
        self.grab_set()
        header = tk.Frame(self, bg=NAVY)
        header.pack(fill="x")
        tk.Label(header, text="تعديل بيانات الأصل" if asset else "إضافة أصل ثابت جديد", bg=NAVY, fg=WHITE, font=("Tahoma", 15, "bold"), anchor="e").pack(fill="x", padx=24, pady=(16, 4))
        tk.Label(header, text="أدخل بيانات الأصل المالية والتشغيلية لحساب قيمته وإهلاكه تلقائيًا.", bg=NAVY, fg="#bdcadd", font=("Tahoma", 9), anchor="e").pack(fill="x", padx=24, pady=(0, 15))
        body = tk.Frame(self, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        body.pack(fill="both", expand=True, padx=18, pady=(12, 8))
        form_scroll = ScrollableFrame(body, background=WHITE)
        form_scroll.pack(fill="both", expand=True, padx=6, pady=6)
        form = form_scroll.content
        form.configure(padx=18, pady=14)
        defaults: dict[str, Any] = asset or {"code": f"AST-{datetime.now().strftime('%H%M%S')}", "accountCode": "", "name": "", "category": parent.categories[0], "purchaseDate": date.today().isoformat(), "inServiceDate": date.today().isoformat(), "purchaseCost": "", "additionalCosts": 0, "salvageValue": 0, "usefulLifeYears": 5, "depreciationMethod": "straight_line", "startDepreciationRule": "mid_month_15", "status": "active", "department": "", "location": "", "custodian": "", "serialNumber": "", "supplier": "", "invoiceNumber": "", "notes": "", "totalEstimatedUnits": 10000, "producedUnitsToDate": 0}
        self.vars: dict[str, tk.Variable] = {}
        fields = [
            ("code", "رمز الأصل *", "entry"), ("accountCode", "رمز الحساب المحاسبي", "entry"), ("name", "اسم الأصل *", "entry"), ("category", "التصنيف", "category"), ("purchaseDate", "تاريخ الشراء", "entry"),
            ("inServiceDate", "تاريخ بدء التشغيل", "entry"), ("purchaseCost", f"تكلفة الشراء ({currency}) *", "entry"), ("additionalCosts", "تكاليف إضافية", "entry"), ("salvageValue", "القيمة التخريدية", "entry"),
            ("usefulLifeYears", "العمر الإنتاجي (سنة)", "entry"), ("depreciationMethod", "طريقة الإهلاك", "method"), ("startDepreciationRule", "بداية الإهلاك", "rule"), ("status", "حالة الأصل", "status"),
            ("department", "الإدارة / القسم", "entry"), ("location", "الموقع", "entry"), ("custodian", "المسؤول / العهدة", "entry"), ("supplier", "المورد", "entry"),
            ("invoiceNumber", "رقم الفاتورة", "entry"), ("serialNumber", "الرقم التسلسلي", "entry"), ("totalEstimatedUnits", "إجمالي الوحدات المقدرة", "entry"), ("producedUnitsToDate", "الوحدات المنتجة حتى الآن", "entry"),
        ]
        for idx, (key, label, kind) in enumerate(fields):
            row, col = divmod(idx, 2)
            cell = tk.Frame(form, bg=WHITE)
            cell.grid(row=row, column=1 - col, sticky="ew", padx=9, pady=7)
            tk.Label(cell, text=label, bg=WHITE, fg=INK, font=("Tahoma", 9, "bold"), anchor="e").pack(fill="x", pady=(0, 4))
            variable = tk.StringVar(value=str(defaults.get(key, "")))
            self.vars[key] = variable
            if kind == "category":
                control: tk.Widget = ttk.Combobox(cell, textvariable=variable, values=parent.categories, state="readonly", justify="right", font=("Tahoma", 9))
            elif kind == "method":
                control = ttk.Combobox(cell, textvariable=variable, values=list(METHODS.values()), state="readonly", justify="right", font=("Tahoma", 9))
                reverse = {v: k for k, v in METHODS.items()}
                variable.set(METHODS.get(str(defaults.get(key)), str(defaults.get(key))))
            elif kind == "status":
                control = ttk.Combobox(cell, textvariable=variable, values=list(STATUSES.values()), state="readonly", justify="right", font=("Tahoma", 9))
                variable.set(STATUSES.get(str(defaults.get(key)), str(defaults.get(key))))
            elif kind == "rule":
                values = {"منتصف الشهر (١–١٥)": "mid_month_15", "الشهر التالي": "next_month", "الشهر نفسه": "same_month"}
                control = ttk.Combobox(cell, textvariable=variable, values=list(values), state="readonly", justify="right", font=("Tahoma", 9))
                variable.set(next((label for label, code in values.items() if code == defaults.get(key)), "منتصف الشهر (١–١٥)"))
            else:
                control = tk.Entry(cell, textvariable=variable, justify="right", font=("Tahoma", 10), relief="solid", bd=1, bg="#fbfcfe", fg=INK, insertbackground=INK)
            control.pack(fill="x", ipady=5)
            form.columnconfigure(0, weight=1)
            form.columnconfigure(1, weight=1)
        notes_cell = tk.Frame(form, bg=WHITE)
        notes_cell.grid(row=(len(fields) + 1) // 2, column=0, columnspan=2, sticky="ew", padx=9, pady=7)
        tk.Label(notes_cell, text="ملاحظات", bg=WHITE, fg=INK, font=("Tahoma", 9, "bold"), anchor="e").pack(fill="x", pady=(0, 4))
        self.notes = tk.Text(notes_cell, height=3, wrap="word", font=("Tahoma", 9), relief="solid", bd=1, bg="#fbfcfe")
        self.notes.pack(fill="x")
        self.notes.insert("1.0", str(defaults.get("notes", "")))
        footer = tk.Frame(self, bg=BG)
        footer.pack(fill="x", padx=18, pady=(0, 16))
        tk.Label(footer, text="* الحقول الإلزامية   •   التواريخ بصيغة YYYY-MM-DD", bg=BG, fg=MUTED, font=("Tahoma", 9)).pack(side="right", pady=10)
        parent._button(footer, "حفظ التعديلات" if asset else "حفظ الأصل", self.submit, kind="primary").pack(side="left", padx=6)
        parent._button(footer, "إلغاء", self.destroy).pack(side="left", padx=6)
        self.bind("<Escape>", lambda _e: self.destroy())

    def submit(self) -> None:
        try:
            v = {key: var.get().strip() for key, var in self.vars.items()}
            for key in ("purchaseDate", "inServiceDate"):
                date.fromisoformat(v[key])
            purchase_cost = money(v["purchaseCost"].replace(",", ""))
            if not v["name"] or not v["code"] or purchase_cost <= 0:
                raise ValueError("رمز الأصل والاسم وتكلفة شراء موجبة مطلوبة.")
            if money(v["usefulLifeYears"]) < 1:
                raise ValueError("يجب أن يكون العمر الإنتاجي سنة واحدة على الأقل.")
            method_key = next((k for k, label in METHODS.items() if label == v["depreciationMethod"]), "straight_line")
            status_key = next((k for k, label in STATUSES.items() if label == v["status"]), "active")
            rule_map = {"منتصف الشهر (١–١٥)": "mid_month_15", "الشهر التالي": "next_month", "الشهر نفسه": "same_month"}
            result = dict(self.original or {})
            result.update({
                "id": (self.original or {}).get("id", __import__("uuid").uuid4().hex), "code": v["code"], "accountCode": v["accountCode"], "name": v["name"], "category": v["category"],
                "purchaseDate": v["purchaseDate"], "inServiceDate": v["inServiceDate"], "purchaseCost": purchase_cost,
                "additionalCosts": money(v["additionalCosts"].replace(",", "")), "salvageValue": money(v["salvageValue"].replace(",", "")),
                "usefulLifeYears": int(money(v["usefulLifeYears"])), "depreciationMethod": method_key,
                "startDepreciationRule": rule_map.get(v["startDepreciationRule"], "mid_month_15"), "status": status_key,
                "department": v["department"], "location": v["location"], "custodian": v["custodian"], "supplier": v["supplier"],
                "invoiceNumber": v["invoiceNumber"], "serialNumber": v["serialNumber"], "totalEstimatedUnits": money(v["totalEstimatedUnits"]),
                "producedUnitsToDate": money(v["producedUnitsToDate"]), "notes": self.notes.get("1.0", "end").strip(),
                "createdAt": (self.original or {}).get("createdAt", datetime.now().isoformat(timespec="seconds")),
            })
            self.on_save(result)
            self.destroy()
        except Exception as exc:
            messagebox.showerror("تحقق من البيانات", str(exc), parent=self)


class CategoryManagerDialog(tk.Toplevel):
    def __init__(self, parent: AosolApp, store: AssetStore):
        super().__init__(parent)
        self.parent, self.store = parent, store
        self.selected_category: str | None = None
        self.title("إدارة تصنيفات الأصول")
        screen_height = self.winfo_screenheight()
        self.geometry(f"560x{min(620, max(480, screen_height - 100))}")
        self.minsize(480, 460)
        self.configure(bg=BG)
        self.transient(parent)
        self.grab_set()

        header = tk.Frame(self, bg=NAVY)
        header.pack(fill="x")
        tk.Label(header, text="إدارة تصنيفات الأصول", bg=NAVY, fg=WHITE, font=("Tahoma", 15, "bold"), anchor="e").pack(fill="x", padx=22, pady=(15, 4))
        tk.Label(header, text="أضف تصنيفًا جديدًا أو أعد تسمية تصنيف. إعادة التسمية تحدّث الأصول المرتبطة به تلقائيًا.", bg=NAVY, fg="#bdcadd", font=("Tahoma", 9), anchor="e", justify="right", wraplength=510).pack(fill="x", padx=22, pady=(0, 14))

        body = tk.Frame(self, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        body.pack(fill="both", expand=True, padx=16, pady=14)
        tk.Label(body, text="التصنيفات الحالية", bg=WHITE, fg=NAVY, font=("Tahoma", 10, "bold"), anchor="e").pack(fill="x", padx=14, pady=(13, 7))
        list_frame = tk.Frame(body, bg=WHITE)
        list_frame.pack(fill="both", expand=True, padx=14)
        self.listbox = tk.Listbox(list_frame, font=("Tahoma", 10), activestyle="none", selectmode="browse", exportselection=False, justify="right", relief="solid", bd=1, bg="#fbfcfe", fg=INK, selectbackground="#d9f2f0", selectforeground=NAVY)
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        self.listbox.configure(yscrollcommand=scrollbar.set)
        self.listbox.pack(side="right", fill="both", expand=True)
        scrollbar.pack(side="left", fill="y")
        self.listbox.bind("<<ListboxSelect>>", self._on_select)

        self.name_var = tk.StringVar()
        row = tk.Frame(body, bg=WHITE)
        row.pack(fill="x", padx=14, pady=(12, 4))
        tk.Label(row, text="اسم التصنيف", bg=WHITE, fg=INK, font=("Tahoma", 9, "bold"), anchor="e").pack(fill="x", pady=(0, 4))
        self.name_entry = tk.Entry(row, textvariable=self.name_var, justify="right", font=("Tahoma", 10), relief="solid", bd=1, bg="#fbfcfe", fg=INK, insertbackground=INK)
        self.name_entry.pack(fill="x", ipady=6)
        tk.Label(body, text="الاسم حتى 80 حرفًا؛ لا تكرر اسمًا موجودًا. لا يمكن حذف تصنيف مرتبط بأصل.", bg=WHITE, fg=MUTED, font=("Tahoma", 8), anchor="e", justify="right", wraplength=500).pack(fill="x", padx=14, pady=(2, 8))

        actions = tk.Frame(body, bg=WHITE)
        actions.pack(fill="x", padx=14, pady=(0, 14))
        parent._button(actions, "إضافة", self._add, kind="primary").pack(side="right", padx=(0, 7))
        parent._button(actions, "حفظ التعديل", self._rename).pack(side="right", padx=7)
        parent._button(actions, "حذف غير المستخدم", self._delete, kind="danger").pack(side="left", padx=7)
        parent._button(self, "إغلاق", self.destroy).pack(side="left", padx=18, pady=(0, 14))
        self._reload()

    def _reload(self, select: str | None = None) -> None:
        self.categories = self.store.get_categories()
        self.listbox.delete(0, tk.END)
        for category in self.categories:
            self.listbox.insert(tk.END, category)
        self.selected_category = None
        if select in self.categories:
            index = self.categories.index(select)
            self.listbox.selection_set(index)
            self.listbox.see(index)
            self.selected_category = select
            self.name_var.set(select)
        else:
            self.name_var.set("")

    def _on_select(self, _event: tk.Event | None = None) -> None:
        selection = self.listbox.curselection()
        self.selected_category = self.categories[selection[0]] if selection else None
        if self.selected_category:
            self.name_var.set(self.selected_category)

    def _add(self) -> None:
        try:
            name = self.name_var.get().strip()
            self.store.add_category(name)
            self.parent.refresh()
            self._reload(name)
            messagebox.showinfo("تمت الإضافة", f"أُضيف التصنيف «{name}» بنجاح.", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر إضافة التصنيف", str(exc), parent=self)

    def _rename(self) -> None:
        old = self.selected_category
        if not old:
            messagebox.showinfo("تعديل التصنيف", "حدد تصنيفًا من القائمة أولًا.", parent=self)
            return
        new = self.name_var.get().strip()
        affected = sum(asset.get("category") == old for asset in self.store.all())
        if affected and not messagebox.askyesno("تأكيد تعديل التصنيف", f"سيتم تغيير اسم التصنيف وتحديث {affected} أصل مرتبط به. هل تريد المتابعة؟", parent=self):
            return
        try:
            updated = self.store.rename_category(old, new)
            self.parent.refresh()
            self._reload(new)
            messagebox.showinfo("تم التعديل", f"تم تحديث اسم التصنيف بنجاح، وتحديث {updated} أصل.", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر تعديل التصنيف", str(exc), parent=self)

    def _delete(self) -> None:
        name = self.selected_category
        if not name:
            messagebox.showinfo("حذف التصنيف", "حدد تصنيفًا من القائمة أولًا.", parent=self)
            return
        if not messagebox.askyesno("تأكيد الحذف", f"حذف التصنيف «{name}»؟ لا يمكن حذف تصنيف مرتبط بأصل.", parent=self):
            return
        try:
            self.store.delete_category(name)
            self.parent.refresh()
            self._reload()
            messagebox.showinfo("تم الحذف", f"تم حذف التصنيف «{name}».", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر حذف التصنيف", str(exc), parent=self)


if __name__ == "__main__":
    app = AosolApp()
    app.mainloop()
