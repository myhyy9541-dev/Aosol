"""Aosol Fixed Assets Manager - portable Python core."""
from __future__ import annotations

import csv
import json
import os
import sqlite3
import sys
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

APP_NAME = "Aosol"
METHODS = {
    "straight_line": "القسط الثابت",
    "double_declining": "القسط المتناقص المضاعف (200%)",
    "declining_150": "القسط المتناقص (150%)",
    "sum_of_years": "مجموع أرقام السنين",
    "units_of_production": "وحدات الإنتاج",
}
STATUSES = {"active": "نشط", "fully_depreciated": "مستهلك بالكامل", "under_maintenance": "تحت الصيانة", "idle": "متوقف", "disposed": "مستبعد"}
CATEGORIES = [
    "المباني والإنشاءات", "الآلات وخطوط الإنتاج والمولدات", "المركبات ووسائل النقل",
    "منظومات الطاقة والكهرباء", "أجهزة الكمبيوتر والتقنية", "الأثاث والتجهيزات المكتبية", "المعدات الثقيلة والحفارات",
]


def data_directory() -> Path:
    if sys.platform == "win32":
        root = Path(os.environ.get("APPDATA", Path.home()))
        path = root / APP_NAME
    elif sys.platform == "darwin":
        path = Path.home() / "Library" / "Application Support" / APP_NAME
    else:
        path = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / APP_NAME.lower()
    path.mkdir(parents=True, exist_ok=True)
    return path


def money(value: Any) -> float:
    try:
        return max(0.0, float(value or 0))
    except (TypeError, ValueError):
        return 0.0


def effective_start(asset: dict[str, Any]) -> date:
    raw = asset.get("inServiceDate") or asset.get("purchaseDate") or date.today().isoformat()
    start = date.fromisoformat(raw[:10])
    rule = asset.get("startDepreciationRule", "mid_month_15")
    if rule == "next_month" or (rule == "mid_month_15" and start.day > 15):
        year, month = start.year, start.month + 1
        if month == 13:
            year, month = year + 1, 1
        return date(year, month, 1)
    return date(start.year, start.month, 1)


def depreciation_schedule(asset: dict[str, Any]) -> list[dict[str, float | int | str]]:
    cost = money(asset.get("purchaseCost")) + money(asset.get("additionalCosts"))
    salvage = min(money(asset.get("salvageValue")), cost)
    base = max(0.0, cost - salvage)
    life = max(1, int(money(asset.get("usefulLifeYears")) or 1))
    start = effective_start(asset)
    first_ratio = max(1, 12 - start.month + 1) / 12
    method = asset.get("depreciationMethod", "straight_line")
    rows: list[dict[str, float | int | str]] = []
    book, accumulated = cost, 0.0

    if base <= 0:
        return [{"year": 1, "period": f"السنة 1 ({start.year})", "beginning": cost, "expense": 0.0, "accumulated": 0.0, "ending": cost}]

    if method == "straight_line":
        annual = base / life
        remaining = base
        periods = life + (1 if first_ratio < 1 else 0)
        for i in range(periods):
            beginning = book
            if i == 0 and first_ratio < 1:
                expense = annual * first_ratio
            elif i == periods - 1 and first_ratio < 1:
                expense = remaining
            else:
                expense = annual
            expense = min(max(0.0, expense), remaining, max(0.0, beginning - salvage))
            accumulated += expense
            book -= expense
            remaining -= expense
            rows.append({"year": i + 1, "period": f"السنة {i + 1} ({start.year + i})", "beginning": beginning, "expense": expense, "accumulated": accumulated, "ending": book})
            if remaining <= 0.01:
                break
    elif method in ("double_declining", "declining_150"):
        rate = (2.0 if method == "double_declining" else 1.5) / life
        periods = life + (1 if first_ratio < 1 else 0)
        for i in range(periods):
            beginning = book
            expense = beginning * rate * (first_ratio if i == 0 and first_ratio < 1 else 1)
            expense = min(max(0.0, expense), max(0.0, beginning - salvage))
            if i == periods - 1:
                expense = max(expense, beginning - salvage)
            accumulated += expense
            book = max(salvage, beginning - expense)
            rows.append({"year": i + 1, "period": f"السنة {i + 1} ({start.year + i})", "beginning": beginning, "expense": expense, "accumulated": accumulated, "ending": book})
            if book <= salvage + 0.01:
                break
    elif method == "sum_of_years":
        syd = life * (life + 1) / 2
        remaining = base
        for i in range(life):
            beginning = book
            expense = min(base * (life - i) / syd, remaining, max(0.0, beginning - salvage))
            accumulated += expense
            book -= expense
            remaining -= expense
            rows.append({"year": i + 1, "period": f"السنة {i + 1} ({start.year + i})", "beginning": beginning, "expense": expense, "accumulated": accumulated, "ending": book})
    else:  # Units of production
        units = max(1.0, money(asset.get("totalEstimatedUnits")) or 10000.0)
        annual_units = units / life
        units_left, unit_rate = units, base / units
        for i in range(life):
            beginning = book
            produced = min(units_left, round(annual_units))
            expense = min(produced * unit_rate, max(0.0, beginning - salvage))
            accumulated += expense
            book -= expense
            units_left -= produced
            rows.append({"year": i + 1, "period": f"السنة {i + 1} ({start.year + i})", "beginning": beginning, "expense": expense, "accumulated": accumulated, "ending": book})
    return rows


def valuation(asset: dict[str, Any], as_of: date | None = None) -> dict[str, float]:
    as_of = as_of or date.today()
    cost = money(asset.get("purchaseCost")) + money(asset.get("additionalCosts"))
    salvage = min(money(asset.get("salvageValue")), cost)
    if asset.get("status") == "disposed" and asset.get("disposal"):
        d = asset["disposal"]
        return {"totalCost": cost, "accumulatedDepreciation": money(d.get("accumulatedAtDisposal")), "netBookValue": money(d.get("bookValueAtDisposal")), "currentYearExpense": 0.0}
    if asset.get("depreciationMethod") == "units_of_production" and asset.get("producedUnitsToDate") is not None:
        total_units = max(1.0, money(asset.get("totalEstimatedUnits")) or 10000.0)
        accumulated = min(cost - salvage, money(asset.get("producedUnitsToDate")) * (cost - salvage) / total_units)
        annual = (cost - salvage) / max(1, money(asset.get("usefulLifeYears")) or 1)
        return {"totalCost": cost, "accumulatedDepreciation": accumulated, "netBookValue": max(salvage, cost - accumulated), "currentYearExpense": annual}
    try:
        start_date = date.fromisoformat((asset.get("inServiceDate") or asset.get("purchaseDate"))[:10])
    except (TypeError, ValueError):
        start_date = as_of
    if start_date > as_of:
        return {"totalCost": cost, "accumulatedDepreciation": 0.0, "netBookValue": cost, "currentYearExpense": 0.0}
    start = effective_start(asset)
    if as_of < start:
        return {"totalCost": cost, "accumulatedDepreciation": 0.0, "netBookValue": cost, "currentYearExpense": 0.0}
    months = (as_of.year - start.year) * 12 + as_of.month - start.month + 1
    years_elapsed = max(0.0, months / 12.0)
    schedule = depreciation_schedule(asset)
    full = int(years_elapsed)
    fraction = years_elapsed - full
    accumulated = sum(float(r["expense"]) for r in schedule[:min(full, len(schedule))])
    current_expense = 0.0
    if full < len(schedule):
        current_expense = float(schedule[full]["expense"])
        accumulated += current_expense * fraction
    accumulated = min(max(0.0, accumulated), max(0.0, cost - salvage))
    return {"totalCost": cost, "accumulatedDepreciation": accumulated, "netBookValue": max(salvage, cost - accumulated), "currentYearExpense": current_expense}


class AssetStore:
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path) if path else data_directory() / "aosol.db"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)")
        self.conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        self.conn.commit()
        if self.get_setting("company_name") is None:
            self.set_setting("company_name", "شركة سبأ للتجارة والاستثمار المحدودة")
        if self.get_setting("currency") is None:
            self.set_setting("currency", "ريال يمني")

    def close(self) -> None:
        self.conn.close()

    def all(self) -> list[dict[str, Any]]:
        return [json.loads(row["payload"]) for row in self.conn.execute("SELECT payload FROM assets ORDER BY name COLLATE NOCASE")]

    def save(self, asset: dict[str, Any]) -> None:
        payload = dict(asset)
        payload.setdefault("id", str(uuid.uuid4()))
        payload["updatedAt"] = datetime.now().isoformat(timespec="seconds")
        code = str(payload.get("code", "")).strip()
        name = str(payload.get("name", "")).strip()
        if not code or not name:
            raise ValueError("رمز الأصل واسمه مطلوبان")
        payload["code"], payload["name"] = code, name
        self.conn.execute("INSERT INTO assets(id,code,name,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,payload=excluded.payload,updated_at=excluded.updated_at", (payload["id"], code, name, json.dumps(payload, ensure_ascii=False), payload["updatedAt"]))
        self.conn.commit()

    def delete(self, asset_id: str) -> None:
        self.conn.execute("DELETE FROM assets WHERE id=?", (asset_id,))
        self.conn.commit()

    def get_setting(self, key: str) -> str | None:
        row = self.conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row[0] if row else None

    def set_setting(self, key: str, value: str) -> None:
        self.conn.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
        self.conn.commit()

    def backup_data(self) -> dict[str, Any]:
        return {"app": APP_NAME, "version": "1.0", "exportDate": datetime.now().isoformat(timespec="seconds"), "settings": {"companyName": self.get_setting("company_name"), "currency": self.get_setting("currency")}, "assets": self.all()}

    def restore(self, data: dict[str, Any], replace: bool = False) -> int:
        assets = data.get("assets") if isinstance(data, dict) else None
        if not isinstance(assets, list):
            raise ValueError("ملف النسخة الاحتياطية غير صالح")
        if replace:
            self.conn.execute("DELETE FROM assets")
        imported = 0
        for item in assets:
            if not isinstance(item, dict) or not item.get("code") or not item.get("name"):
                continue
            existing = self.conn.execute("SELECT id FROM assets WHERE code=?", (str(item["code"]),)).fetchone()
            if existing and not replace:
                continue
            self.save(item)
            imported += 1
        settings = data.get("settings", {})
        if settings.get("companyName"):
            self.set_setting("company_name", str(settings["companyName"]))
        if settings.get("currency"):
            self.set_setting("currency", str(settings["currency"]))
        return imported


def demo_assets() -> list[dict[str, Any]]:
    now = datetime.now().isoformat(timespec="seconds")
    examples = [
        ("AST-BLD-01", "مبنى المقر الإداري الرئيسي", "المباني والإنشاءات", "2022-01-15", "2022-02-01", 95000000, 5000000, 12000000, 25, "straight_line", "الإدارة العامة", "صنعاء - شارع حدة", "أحمد صالح اليماني"),
        ("AST-GEN-02", "مولد كهرباء ديزل 500 KVA", "الآلات وخطوط الإنتاج والمولدات", "2022-06-10", "2022-07-01", 34500000, 1500000, 2500000, 8, "double_declining", "إدارة الصيانة والتشغيل", "المجمع الصناعي", "م. طارق الحيدري"),
        ("AST-SLR-03", "منظومة طاقة شمسية هجينة 60 KW", "منظومات الطاقة والكهرباء", "2023-01-10", "2023-01-20", 18000000, 800000, 1000000, 10, "straight_line", "إدارة الخدمات الفنية والكهرباء", "المقر الرئيسي", "م. نبيل الشرجبي"),
        ("AST-VEH-04", "سيارة نقل وتوزيع تويوتا هايلكس", "المركبات ووسائل النقل", "2023-03-20", "2023-04-01", 16800000, 400000, 3000000, 5, "straight_line", "إدارة المبيعات والتوزيع", "فرع عدن", "سالم بازرعة"),
        ("AST-EQP-05", "حفار هيدروليكي للمشاريع", "المعدات الثقيلة والحفارات", "2022-04-10", "2022-05-01", 42000000, 1800000, 5000000, 6, "units_of_production", "إدارة المشاريع الهندسية", "مشروع عمران", "م. فؤاد القباطي"),
    ]
    return [{"id": str(uuid.uuid4()), "code": c, "name": n, "category": cat, "purchaseDate": pd, "inServiceDate": sd, "purchaseCost": cost, "additionalCosts": extra, "salvageValue": salvage, "usefulLifeYears": life, "depreciationMethod": method, "startDepreciationRule": "mid_month_15", "status": "active", "department": dept, "location": loc, "custodian": person, "createdAt": now, "updatedAt": now} for c, n, cat, pd, sd, cost, extra, salvage, life, method, dept, loc, person in examples]


def export_csv(path: str | Path, assets: list[dict[str, Any]]) -> None:
    fields = ["code", "name", "category", "purchaseDate", "inServiceDate", "purchaseCost", "additionalCosts", "salvageValue", "usefulLifeYears", "depreciationMethod", "department", "location", "custodian", "status", "notes"]
    with open(path, "w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for asset in assets:
            writer.writerow(asset)


def export_xlsx(path: str | Path, assets: list[dict[str, Any]], currency: str) -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "سجل الأصول"
    sheet.sheet_view.rightToLeft = True
    headers = ["الكود", "اسم الأصل", "الفئة", "تاريخ الشراء", "تاريخ التشغيل", "التكلفة الإجمالية", "الإهلاك المتراكم", "صافي القيمة الدفترية", "القيمة التخريدية", "العمر (سنة)", "طريقة الإهلاك", "الإدارة", "الموقع", "العهدة", "الحالة"]
    sheet.append(headers)
    for asset in assets:
        val = valuation(asset)
        sheet.append([asset.get("code"), asset.get("name"), asset.get("category"), asset.get("purchaseDate"), asset.get("inServiceDate"), val["totalCost"], val["accumulatedDepreciation"], val["netBookValue"], money(asset.get("salvageValue")), asset.get("usefulLifeYears"), METHODS.get(asset.get("depreciationMethod"), ""), asset.get("department"), asset.get("location"), asset.get("custodian"), STATUSES.get(asset.get("status"), "نشط")])
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    for cell in sheet[1]:
        cell.fill = PatternFill("solid", fgColor="13233A")
        cell.font = Font(name="Arial", color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")
    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.font = Font(name="Arial", color="1B2A41")
            cell.alignment = Alignment(horizontal="right", vertical="center")
        for index in (6, 7, 8, 9):
            row[index - 1].number_format = '#,##0.00'
    for idx, width in enumerate([17, 38, 32, 16, 16, 20, 20, 22, 19, 14, 30, 29, 28, 24, 19], 1):
        sheet.column_dimensions[get_column_letter(idx)].width = width
    sheet.row_dimensions[1].height = 28
    workbook.save(path)
