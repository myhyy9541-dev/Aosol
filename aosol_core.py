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

from aosol_config import configured_data_directory

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


def normalize_categories(values: Any) -> list[str]:
    if not isinstance(values, (list, tuple)):
        raise ValueError("قائمة التصنيفات غير صالحة.")
    result: list[str] = []
    seen: set[str] = set()
    for raw in values:
        name = str(raw or "").strip()
        if not name:
            continue
        if len(name) > 80:
            raise ValueError("يجب ألا يتجاوز اسم التصنيف 80 حرفًا.")
        if any(ord(char) < 32 for char in name) or name.lstrip().startswith(("=", "+", "-", "@")):
            raise ValueError("اسم التصنيف يحتوي على صيغة أو أحرف غير مسموح بها.")
        folded = name.casefold()
        if folded not in seen:
            result.append(name)
            seen.add(folded)
    if not result:
        raise ValueError("يجب أن تحتوي قائمة التصنيفات على تصنيف واحد على الأقل.")
    return result


def safe_spreadsheet_text(value: Any) -> Any:
    """Prefix formula-like text so spreadsheet programs treat CSV values as text."""
    if isinstance(value, str):
        first = value.lstrip(" \t\r\n\x00\ufeff")
        if first.startswith(("=", "+", "-", "@")):
            return "'" + value
    return value


def data_directory() -> Path:
    return configured_data_directory()


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
        try:
            disposal_date = date.fromisoformat(str(d.get("disposalDate", ""))[:10])
        except ValueError:
            disposal_date = as_of
        if as_of >= disposal_date:
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
    schedule = depreciation_schedule(asset)
    accumulated = 0.0
    current_expense = 0.0
    for index, row in enumerate(schedule):
        year = start.year + index
        period_start = start if index == 0 else date(year, 1, 1)
        if as_of < period_start:
            break
        period_months = 12 - period_start.month + 1
        if as_of.year > year or (as_of.year == year and as_of.month == 12):
            fraction = 1.0
        elif as_of.year == year:
            elapsed_months = max(0, as_of.month - period_start.month + 1)
            fraction = min(1.0, elapsed_months / period_months)
        else:
            fraction = 0.0
        expense = float(row["expense"])
        accumulated += expense * fraction
        if as_of.year == year:
            current_expense = expense
            break
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
        for key in ("commercial_reg", "tax_number"):
            if self.get_setting(key) is None:
                self.set_setting(key, "")
        if self.get_setting("categories") is None:
            self.set_setting("categories", json.dumps(CATEGORIES, ensure_ascii=False))

    def get_categories(self) -> list[str]:
        raw = self.get_setting("categories")
        if raw is None:
            return list(CATEGORIES)
        try:
            return normalize_categories(json.loads(raw))
        except (ValueError, json.JSONDecodeError):
            return list(CATEGORIES)

    def set_categories(self, categories: list[str]) -> list[str]:
        normalized = normalize_categories(categories)
        self.set_setting("categories", json.dumps(normalized, ensure_ascii=False))
        return normalized

    def add_category(self, name: str) -> list[str]:
        clean_name = normalize_categories([name])[0]
        categories = self.get_categories()
        if any(item.casefold() == clean_name.casefold() for item in categories):
            raise ValueError("هذا التصنيف موجود بالفعل.")
        categories.append(clean_name)
        return self.set_categories(categories)

    def rename_category(self, old_name: str, new_name: str) -> int:
        old = str(old_name or "").strip()
        new = normalize_categories([new_name])[0]
        categories = self.get_categories()
        if old not in categories:
            raise ValueError("التصنيف المراد تعديله غير موجود.")
        if any(item.casefold() == new.casefold() and item != old for item in categories):
            raise ValueError("يوجد تصنيف آخر بهذا الاسم.")
        updated_categories = [new if item == old else item for item in categories]
        affected = 0
        try:
            self.conn.execute("BEGIN IMMEDIATE")
            rows = self.conn.execute("SELECT id, payload FROM assets").fetchall()
            for row in rows:
                payload = json.loads(row["payload"])
                if payload.get("category") == old:
                    payload["category"] = new
                    payload["updatedAt"] = datetime.now().isoformat(timespec="seconds")
                    self.conn.execute("UPDATE assets SET payload=?, updated_at=? WHERE id=?", (json.dumps(payload, ensure_ascii=False), payload["updatedAt"], row["id"]))
                    affected += 1
            self.conn.execute("INSERT INTO settings(key,value) VALUES('categories',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(updated_categories, ensure_ascii=False),))
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
        return affected

    def delete_category(self, name: str) -> list[str]:
        categories = self.get_categories()
        if name not in categories:
            raise ValueError("التصنيف غير موجود.")
        if len(categories) <= 1:
            raise ValueError("يجب الإبقاء على تصنيف واحد على الأقل.")
        used_by = [asset.get("code", "") for asset in self.all() if asset.get("category") == name]
        if used_by:
            raise ValueError(f"لا يمكن حذف هذا التصنيف لأنه مرتبط بـ {len(used_by)} أصل. غيّر تصنيف الأصول أولًا.")
        return self.set_categories([item for item in categories if item != name])

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

    def save_many(self, assets: list[dict[str, Any]]) -> None:
        """Save a batch atomically; a single duplicate code rolls back the batch."""
        try:
            self.conn.execute("BEGIN IMMEDIATE")
            for asset in assets:
                payload = dict(asset)
                payload.setdefault("id", str(uuid.uuid4()))
                payload["updatedAt"] = datetime.now().isoformat(timespec="seconds")
                payload["code"] = str(payload.get("code", "")).strip()
                payload["name"] = str(payload.get("name", "")).strip()
                if not payload["code"] or not payload["name"]:
                    raise ValueError("رمز الأصل واسمه مطلوبان")
                self.conn.execute(
                    "INSERT INTO assets(id,code,name,payload,updated_at) VALUES(?,?,?,?,?)",
                    (payload["id"], payload["code"], payload["name"], json.dumps(payload, ensure_ascii=False), payload["updatedAt"]),
                )
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

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
        return {"app": APP_NAME, "version": "1.2", "exportDate": datetime.now().isoformat(timespec="seconds"), "settings": {"companyName": self.get_setting("company_name"), "currency": self.get_setting("currency"), "commercialReg": self.get_setting("commercial_reg"), "taxNumber": self.get_setting("tax_number")}, "categories": self.get_categories(), "assets": self.all()}

    def restore(self, data: dict[str, Any], replace: bool = False) -> int:
        assets = data.get("assets") if isinstance(data, dict) else None
        if not isinstance(assets, list):
            raise ValueError("ملف النسخة الاحتياطية غير صالح")
        settings = data.get("settings", {}) if isinstance(data.get("settings", {}), dict) else {}
        backup_categories = data.get("categories") if isinstance(data.get("categories"), list) else None
        if backup_categories is not None:
            backup_categories = normalize_categories(backup_categories)
        imported = 0
        try:
            self.conn.execute("BEGIN IMMEDIATE")
            if replace:
                self.conn.execute("DELETE FROM assets")
            for item in assets:
                if not isinstance(item, dict) or not item.get("code") or not item.get("name"):
                    continue
                code = str(item["code"]).strip()
                existing = self.conn.execute("SELECT id FROM assets WHERE code=?", (code,)).fetchone()
                if existing and not replace:
                    continue
                payload = dict(item)
                payload.setdefault("id", str(uuid.uuid4()))
                payload["code"], payload["name"] = code, str(payload["name"]).strip()
                payload["updatedAt"] = datetime.now().isoformat(timespec="seconds")
                self.conn.execute(
                    "INSERT INTO assets(id,code,name,payload,updated_at) VALUES(?,?,?,?,?)",
                    (payload["id"], code, payload["name"], json.dumps(payload, ensure_ascii=False), payload["updatedAt"]),
                )
                imported += 1
            for key, value in (("company_name", settings.get("companyName")), ("currency", settings.get("currency")), ("commercial_reg", settings.get("commercialReg")), ("tax_number", settings.get("taxNumber"))):
                if value:
                    self.conn.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
            restored_categories = list(backup_categories if replace and backup_categories is not None else self.get_categories())
            known_categories = {category.casefold() for category in restored_categories}
            for item in assets:
                if isinstance(item, dict) and str(item.get("category") or "").strip():
                    category = normalize_categories([item["category"]])[0]
                    if category.casefold() not in known_categories:
                        restored_categories.append(category)
                        known_categories.add(category.casefold())
            self.conn.execute("INSERT INTO settings(key,value) VALUES('categories',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(normalize_categories(restored_categories), ensure_ascii=False),))
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise
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
            writer.writerow({field: safe_spreadsheet_text(asset.get(field)) for field in fields})


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
        for cell in sheet[sheet.max_row]:
            if isinstance(cell.value, str):
                cell.data_type = "s"
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
