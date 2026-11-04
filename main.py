from __future__ import annotations

import json
import sqlite3
import tkinter as tk
from datetime import date, datetime
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any, Callable

from aosol_core import (
    APP_NAME, CATEGORIES, METHODS, STATUSES, AssetStore, demo_assets,
    depreciation_schedule, export_csv, export_xlsx, money, valuation,
)

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
        self.geometry("1360x840")
        self.minsize(1080, 680)
        self.configure(bg=BG)
        self.store = AssetStore()
        self.assets: list[dict[str, Any]] = []
        self.currency = self.store.get_setting("currency") or "ريال يمني"
        self.company = self.store.get_setting("company_name") or "شركة سبأ للتجارة والاستثمار المحدودة"
        self.search_var = tk.StringVar()
        self.status_var = tk.StringVar(value="الكل")
        self._setup_style()
        self._build_layout()
        self.refresh()
        self.protocol("WM_DELETE_WINDOW", self.on_close)

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
        self._button(header_actions, "تصدير Excel", self.export_excel, kind="ghost").pack(side="left", padx=5)
        self._button(header_actions, "+ إضافة أصل", self.add_asset, kind="primary").pack(side="left", padx=5)

        nav = tk.Frame(self, bg=WHITE, height=48, highlightbackground=BORDER, highlightthickness=1)
        nav.pack(fill="x")
        nav.pack_propagate(False)
        for label, callback, selected in [
            ("لوحة الأصول", self.focus_assets, True), ("التقارير والإهلاك", self.report, False),
            ("النسخ والاستعادة", self.backup, False), ("الإعدادات", self.settings, False),
        ]:
            color = TEAL if selected else MUTED
            tk.Button(nav, text=label, command=callback, bg=WHITE, fg=color, activebackground="#f4f8fb", activeforeground=TEAL, font=("Tahoma", 10, "bold" if selected else "normal"), relief="flat", padx=18, pady=12, cursor="hand2", bd=0).pack(side="right", padx=4)
        self.content = tk.Frame(self, bg=BG)
        self.content.pack(fill="both", expand=True, padx=28, pady=(20, 14))
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
        search = tk.Entry(controls, textvariable=self.search_var, font=("Tahoma", 10), justify="right", relief="flat", bg="#f5f7fa", fg=INK, insertbackground=INK, highlightthickness=1, highlightbackground=BORDER, highlightcolor=TEAL)
        search.pack(side="right", fill="x", expand=True, ipady=9, padx=(10, 0))
        search.insert(0, "")
        search.bind("<KeyRelease>", lambda _e: self.populate())
        tk.Label(controls, text="بحث بالاسم أو الكود", bg=WHITE, fg=MUTED, font=("Tahoma", 9)).pack(side="right", padx=(0, 10))
        combo = ttk.Combobox(controls, textvariable=self.status_var, state="readonly", values=["الكل", *STATUSES.values()], width=17, justify="right")
        combo.pack(side="left", padx=(0, 8))
        combo.bind("<<ComboboxSelected>>", lambda _e: self.populate())
        tk.Label(controls, text="الحالة", bg=WHITE, fg=MUTED, font=("Tahoma", 9)).pack(side="left", padx=(0, 8))

        table_wrap = tk.Frame(panel, bg=WHITE)
        table_wrap.pack(fill="both", expand=True, padx=18, pady=(0, 12))
        cols = ("code", "name", "category", "cost", "book", "method", "status")
        self.tree = ttk.Treeview(table_wrap, columns=cols, show="headings", selectmode="browse")
        headings = [("code", "رمز الأصل", 120), ("name", "اسم الأصل", 250), ("category", "التصنيف", 180), ("cost", "التكلفة الإجمالية", 135), ("book", "صافي القيمة الدفترية", 145), ("method", "طريقة الإهلاك", 160), ("status", "الحالة", 100)]
        for col, label, width in headings:
            self.tree.heading(col, text=label, anchor="e")
            self.tree.column(col, width=width, anchor="e", stretch=(col == "name"))
        self.tree.tag_configure("odd", background="#f8fafc")
        self.tree.tag_configure("disposed", foreground="#98a2b3")
        scrollbar = ttk.Scrollbar(table_wrap, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side="right", fill="both", expand=True)
        scrollbar.pack(side="left", fill="y")
        self.tree.bind("<Double-1>", lambda _e: self.edit_asset())
        self.tree.bind("<Return>", lambda _e: self.edit_asset())

        actions = tk.Frame(panel, bg="#f8fafc")
        actions.pack(fill="x", padx=18, pady=(0, 16))
        self._button(actions, "تعديل الأصل", self.edit_asset).pack(side="right", padx=(0, 8), pady=9)
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
        for index, asset in enumerate(self.assets):
            if query and query not in str(asset.get("name", "")).casefold() and query not in str(asset.get("code", "")).casefold():
                continue
            if selected_status != "الكل" and STATUSES.get(asset.get("status", "active"), "نشط") != selected_status:
                continue
            val = valuation(asset)
            tags = ("disposed",) if asset.get("status") == "disposed" else (("odd",) if index % 2 else ())
            values = (asset.get("code", ""), asset.get("name", ""), asset.get("category", ""), fmt(val["totalCost"]), fmt(val["netBookValue"]), METHODS.get(asset.get("depreciationMethod"), ""), STATUSES.get(asset.get("status", "active"), "نشط"))
            self.tree.insert("", "end", iid=asset["id"], values=values, tags=tags)

    def selected_asset(self) -> dict[str, Any] | None:
        selected = self.tree.selection() if hasattr(self, "tree") else ()
        if not selected:
            messagebox.showinfo("Aosol", "حدد أصلًا من السجل أولاً.", parent=self)
            return None
        return next((a for a in self.assets if a["id"] == selected[0]), None)

    def focus_assets(self) -> None:
        self.search_var.set("")
        self.status_var.set("الكل")
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
        dialog.geometry("440x340")
        dialog.transient(self)
        dialog.grab_set()
        tk.Label(dialog, text="تسجيل بيع أو استبعاد الأصل", bg=WHITE, fg=NAVY, font=("Tahoma", 14, "bold")).pack(anchor="e", padx=22, pady=(20, 14))
        tk.Label(dialog, text=f"القيمة الدفترية الحالية: {fmt(val['netBookValue'])} {self.currency}", bg=WHITE, fg=MUTED, font=("Tahoma", 10)).pack(anchor="e", padx=22, pady=5)
        price_var, cost_var, date_var = tk.StringVar(value="0"), tk.StringVar(value="0"), tk.StringVar(value=date.today().isoformat())
        fields = [("تاريخ الاستبعاد (YYYY-MM-DD)", date_var), ("متحصلات البيع", price_var), ("تكاليف الاستبعاد", cost_var)]
        for label, var in fields:
            row = tk.Frame(dialog, bg=WHITE)
            row.pack(fill="x", padx=22, pady=7)
            tk.Label(row, text=label, bg=WHITE, fg=INK, font=("Tahoma", 9), width=24, anchor="e").pack(side="right")
            tk.Entry(row, textvariable=var, justify="right", font=("Tahoma", 10), relief="solid", bd=1).pack(side="left", fill="x", expand=True, ipady=5)
        def confirm() -> None:
            try:
                disposal_date = date.fromisoformat(date_var.get()).isoformat()
                price, costs = money(price_var.get()), money(cost_var.get())
            except Exception:
                messagebox.showerror("بيانات غير صحيحة", "تحقق من التاريخ والمبالغ.", parent=dialog)
                return
            gain_loss = price - costs - val["netBookValue"]
            asset["status"] = "disposed"
            asset["disposal"] = {"disposalDate": disposal_date, "salePrice": price, "disposalCosts": costs, "bookValueAtDisposal": val["netBookValue"], "accumulatedAtDisposal": val["accumulatedDepreciation"], "gainLoss": gain_loss, "disposalType": "sale"}
            self.store.save(asset)
            dialog.destroy()
            self.refresh()
            messagebox.showinfo("تم الاستبعاد", f"الربح / (الخسارة): {fmt(gain_loss)} {self.currency}", parent=self)
        self._button(dialog, "تأكيد الاستبعاد", confirm, kind="primary").pack(side="left", padx=22, pady=18)

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
        for row in schedule:
            tree.insert("", "end", values=(row["period"], fmt(float(row["beginning"])), fmt(float(row["expense"])), fmt(float(row["accumulated"])), fmt(float(row["ending"]))))
        tree.pack(fill="both", expand=True)
        self._button(dialog, "إغلاق", dialog.destroy).pack(side="left", padx=18, pady=(0, 16))

    def export_excel(self) -> None:
        if not self.assets:
            messagebox.showinfo("التصدير", "لا توجد بيانات لتصديرها.", parent=self)
            return
        path = filedialog.asksaveasfilename(parent=self, title="تصدير سجل الأصول", defaultextension=".xlsx", initialfile=f"سجل_الأصول_{date.today().isoformat()}.xlsx", filetypes=[("Excel", "*.xlsx"), ("CSV", "*.csv")])
        if not path:
            return
        try:
            if Path(path).suffix.lower() == ".csv":
                export_csv(path, self.assets)
            else:
                export_xlsx(path, self.assets, self.currency)
            messagebox.showinfo("تم التصدير", f"تم حفظ سجل الأصول بنجاح:\n{path}", parent=self)
        except ImportError:
            messagebox.showerror("مكتبة ناقصة", "مكتبة openpyxl غير مثبّتة. أعد تثبيت التطبيق أو استخدم CSV.", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر التصدير", str(exc), parent=self)

    def backup(self) -> None:
        choice = messagebox.askyesnocancel("النسخ الاحتياطي", "هل تريد إنشاء نسخة احتياطية؟\n\nنعم: حفظ نسخة JSON\nلا: استعادة نسخة من ملف JSON", parent=self)
        if choice is None:
            return
        if choice:
            path = filedialog.asksaveasfilename(parent=self, title="حفظ نسخة احتياطية", defaultextension=".json", initialfile=f"Aosol_backup_{date.today().isoformat()}.json", filetypes=[("نسخة Aosol", "*.json")])
            if not path:
                return
            Path(path).write_text(json.dumps(self.store.backup_data(), ensure_ascii=False, indent=2), encoding="utf-8")
            messagebox.showinfo("تم النسخ", f"حُفظت النسخة الاحتياطية في:\n{path}", parent=self)
        else:
            path = filedialog.askopenfilename(parent=self, title="استعادة النسخة الاحتياطية", filetypes=[("نسخة Aosol", "*.json")])
            if not path:
                return
            try:
                data = json.loads(Path(path).read_text(encoding="utf-8"))
                replace = messagebox.askyesno("طريقة الاستعادة", "هل تريد استبدال السجل الحالي؟\nاختر لا لدمج الأصول الجديدة دون تكرار الأكواد.", parent=self)
                count = self.store.restore(data, replace=replace)
                self.currency = self.store.get_setting("currency") or self.currency
                self.company = self.store.get_setting("company_name") or self.company
                self.refresh()
                messagebox.showinfo("اكتملت الاستعادة", f"تم استيراد {count} أصل.", parent=self)
            except Exception as exc:
                messagebox.showerror("تعذر الاستعادة", str(exc), parent=self)

    def import_file(self) -> None:
        path = filedialog.askopenfilename(parent=self, title="استيراد الأصول", filetypes=[("ملفات البيانات", "*.json *.xlsx *.csv"), ("JSON", "*.json"), ("Excel", "*.xlsx"), ("CSV", "*.csv")])
        if not path:
            return
        try:
            suffix = Path(path).suffix.lower()
            if suffix == ".json":
                data = json.loads(Path(path).read_text(encoding="utf-8"))
                count = self.store.restore(data, replace=False)
            elif suffix == ".csv":
                import csv
                with open(path, newline="", encoding="utf-8-sig") as stream:
                    imported = list(csv.DictReader(stream))
                count = self._import_rows(imported)
            else:
                from openpyxl import load_workbook
                sheet = load_workbook(path, data_only=True, read_only=True).active
                rows = list(sheet.iter_rows(values_only=True))
                headers = [str(x or "").strip() for x in rows[0]] if rows else []
                imported = [dict(zip(headers, row)) for row in rows[1:]]
                count = self._import_rows(imported)
            self.refresh()
            messagebox.showinfo("اكتمل الاستيراد", f"تم استيراد {count} أصل.", parent=self)
        except Exception as exc:
            messagebox.showerror("تعذر الاستيراد", f"تحقق من تنسيق الملف.\n{exc}", parent=self)

    def _import_rows(self, rows: list[dict[str, Any]]) -> int:
        aliases = {"رمز الأصل": "code", "الكود": "code", "اسم الأصل": "name", "الفئة": "category", "تاريخ الشراء": "purchaseDate", "تاريخ التشغيل": "inServiceDate", "التكلفة": "purchaseCost", "التكلفة الإجمالية": "purchaseCost", "قيمة الخردة": "salvageValue", "القيمة التخريدية": "salvageValue", "العمر": "usefulLifeYears", "العمر (سنة)": "usefulLifeYears", "طريقة الإهلاك": "depreciationMethod", "الإدارة": "department", "الموقع": "location", "العهدة": "custodian"}
        count = 0
        existing = {a.get("code") for a in self.assets}
        for row in rows:
            item = {aliases.get(str(k), str(k)): v for k, v in row.items() if k is not None}
            if not item.get("code") or not item.get("name") or str(item["code"]) in existing:
                continue
            item.setdefault("id", __import__("uuid").uuid4().hex)
            item.setdefault("purchaseDate", date.today().isoformat())
            item.setdefault("inServiceDate", item["purchaseDate"])
            item.setdefault("additionalCosts", 0)
            item.setdefault("salvageValue", 0)
            item.setdefault("usefulLifeYears", 5)
            item.setdefault("depreciationMethod", "straight_line")
            item.setdefault("startDepreciationRule", "mid_month_15")
            item.setdefault("status", "active")
            item.setdefault("category", CATEGORIES[0])
            item.setdefault("createdAt", datetime.now().isoformat())
            for key in ("purchaseCost", "additionalCosts", "salvageValue", "usefulLifeYears"):
                item[key] = money(item.get(key))
            method_label = str(item.get("depreciationMethod", ""))
            item["depreciationMethod"] = next((code for code, label in METHODS.items() if label == method_label), method_label if method_label in METHODS else "straight_line")
            self.store.save(item)
            existing.add(str(item["code"]))
            count += 1
        return count

    def settings(self) -> None:
        dialog = tk.Toplevel(self)
        dialog.title("إعدادات المنشأة")
        dialog.geometry("510x320")
        dialog.configure(bg=WHITE)
        dialog.transient(self)
        dialog.grab_set()
        tk.Label(dialog, text="إعدادات المنشأة والتقارير", bg=WHITE, fg=NAVY, font=("Tahoma", 15, "bold")).pack(anchor="e", padx=24, pady=(22, 16))
        company_var = tk.StringVar(value=self.company)
        currency_var = tk.StringVar(value=self.currency)
        for label, var in [("اسم المنشأة", company_var), ("العملة", currency_var)]:
            row = tk.Frame(dialog, bg=WHITE)
            row.pack(fill="x", padx=24, pady=9)
            tk.Label(row, text=label, bg=WHITE, fg=INK, font=("Tahoma", 10), width=15, anchor="e").pack(side="right")
            tk.Entry(row, textvariable=var, justify="right", font=("Tahoma", 10), relief="solid", bd=1).pack(side="left", fill="x", expand=True, ipady=6)
        def save() -> None:
            self.company = company_var.get().strip() or self.company
            self.currency = currency_var.get().strip() or self.currency
            self.store.set_setting("company_name", self.company)
            self.store.set_setting("currency", self.currency)
            dialog.destroy()
            self.refresh()
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
        self.geometry("900x770")
        self.minsize(780, 650)
        self.configure(bg=BG)
        self.transient(parent)
        self.grab_set()
        header = tk.Frame(self, bg=NAVY)
        header.pack(fill="x")
        tk.Label(header, text="تعديل بيانات الأصل" if asset else "إضافة أصل ثابت جديد", bg=NAVY, fg=WHITE, font=("Tahoma", 15, "bold"), anchor="e").pack(fill="x", padx=24, pady=(16, 4))
        tk.Label(header, text="أدخل بيانات الأصل المالية والتشغيلية لحساب قيمته وإهلاكه تلقائيًا.", bg=NAVY, fg="#bdcadd", font=("Tahoma", 9), anchor="e").pack(fill="x", padx=24, pady=(0, 15))
        body = tk.Frame(self, bg=WHITE, highlightbackground=BORDER, highlightthickness=1)
        body.pack(fill="both", expand=True, padx=18, pady=16)
        form = tk.Frame(body, bg=WHITE)
        form.pack(fill="both", expand=True, padx=18, pady=14)
        defaults: dict[str, Any] = asset or {"code": f"AST-{datetime.now().strftime('%H%M%S')}", "name": "", "category": CATEGORIES[0], "purchaseDate": date.today().isoformat(), "inServiceDate": date.today().isoformat(), "purchaseCost": "", "additionalCosts": 0, "salvageValue": 0, "usefulLifeYears": 5, "depreciationMethod": "straight_line", "startDepreciationRule": "mid_month_15", "status": "active", "department": "", "location": "", "custodian": "", "serialNumber": "", "supplier": "", "invoiceNumber": "", "notes": "", "totalEstimatedUnits": 10000, "producedUnitsToDate": 0}
        self.vars: dict[str, tk.Variable] = {}
        fields = [
            ("code", "رمز الأصل *", "entry"), ("name", "اسم الأصل *", "entry"), ("category", "التصنيف", "category"), ("purchaseDate", "تاريخ الشراء", "entry"),
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
                control: tk.Widget = ttk.Combobox(cell, textvariable=variable, values=CATEGORIES, state="readonly", justify="right", font=("Tahoma", 9))
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
        notes_cell.grid(row=10, column=0, columnspan=2, sticky="ew", padx=9, pady=7)
        tk.Label(notes_cell, text="ملاحظات", bg=WHITE, fg=INK, font=("Tahoma", 9, "bold"), anchor="e").pack(fill="x", pady=(0, 4))
        self.notes = tk.Text(notes_cell, height=3, wrap="word", font=("Tahoma", 9), relief="solid", bd=1, bg="#fbfcfe")
        self.notes.pack(fill="x")
        self.notes.insert("1.0", str(defaults.get("notes", "")))
        footer = tk.Frame(self, bg=BG)
        footer.pack(fill="x", padx=18, pady=(0, 16))
        tk.Label(footer, text="* الحقول الإلزامية   •   التواريخ بصيغة YYYY-MM-DD", bg=BG, fg=MUTED, font=("Tahoma", 9)).pack(side="right", pady=10)
        parent._button(footer, "حفظ الأصل", self.submit, kind="primary").pack(side="left", padx=6)
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
                "id": (self.original or {}).get("id", __import__("uuid").uuid4().hex), "code": v["code"], "name": v["name"], "category": v["category"],
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


if __name__ == "__main__":
    app = AosolApp()
    app.mainloop()
