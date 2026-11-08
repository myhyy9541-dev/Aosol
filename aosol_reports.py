"""Period and management reports for Aosol desktop."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from calendar import monthrange
from typing import Any

from aosol_core import METHODS, STATUSES, money, valuation


def _date(value: str | date | None, fallback: date) -> date:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return fallback


def _status_at(asset: dict[str, Any], as_of: date, value: dict[str, float]) -> str:
    disposal = asset.get("disposal") or {}
    disposed_on = _date(disposal.get("disposalDate"), date.max)
    if asset.get("status") == "disposed" and disposed_on <= as_of:
        return "disposed"
    status = asset.get("status", "active")
    if status in ("under_maintenance", "idle"):
        return status
    salvage = min(money(asset.get("salvageValue")), value["totalCost"])
    if value["netBookValue"] <= salvage + 0.01:
        return "fully_depreciated"
    return "active"


def period_ranges(from_date: str | date, to_date: str | date, granularity: str) -> list[tuple[str, date, date]]:
    """Split an inclusive report interval into full-range, monthly, or yearly periods."""
    start = _date(from_date, date.today())
    end = _date(to_date, date.today())
    if start > end:
        raise ValueError("تاريخ بداية التقرير يجب ألا يتجاوز تاريخ النهاية.")
    if granularity == "شهري":
        result: list[tuple[str, date, date]] = []
        cursor = date(start.year, start.month, 1)
        while cursor <= end:
            month_end = date(cursor.year, cursor.month, monthrange(cursor.year, cursor.month)[1])
            result.append((cursor.strftime("%Y-%m"), max(start, cursor), min(end, month_end)))
            cursor = date(cursor.year + (cursor.month == 12), 1 if cursor.month == 12 else cursor.month + 1, 1)
        return result
    if granularity == "سنوي":
        return [(str(year), max(start, date(year, 1, 1)), min(end, date(year, 12, 31))) for year in range(start.year, end.year + 1)]
    if granularity == "الفترة كاملة":
        return [(f"{start.isoformat()} — {end.isoformat()}", start, end)]
    raise ValueError("نوع تقسيم التقرير غير معروف")


def build_asset_report(
    assets: list[dict[str, Any]],
    from_date: str | date,
    to_date: str | date,
    *,
    category: str = "الكل",
    department: str = "الكل",
    status: str = "الكل",
    query: str = "",
) -> dict[str, Any]:
    """Build a dated movement report; production-based assets need period unit history."""
    start = _date(from_date, date.today().replace(month=1, day=1))
    end = _date(to_date, date.today())
    if start > end:
        raise ValueError("تاريخ بداية التقرير يجب ألا يتجاوز تاريخ النهاية.")
    before = start - timedelta(days=1)
    q = query.strip().casefold()
    details: list[dict[str, Any]] = []
    disposals: list[dict[str, Any]] = []

    for asset in assets:
        purchase_date = _date(asset.get("purchaseDate"), start)
        disposal = asset.get("disposal") or {}
        disposal_date = _date(disposal.get("disposalDate"), date.max) if disposal else date.max
        if purchase_date > end:
            continue
        if asset.get("status") == "disposed" and disposal_date < start:
            continue
        if category != "الكل" and asset.get("category", "") != category:
            continue
        if department != "الكل" and asset.get("department", "") != department:
            continue
        search_values = [asset.get("code"), asset.get("name"), asset.get("department"), asset.get("location"), asset.get("custodian"), asset.get("serialNumber")]
        if q and not any(q in str(value or "").casefold() for value in search_values):
            continue

        total_cost = money(asset.get("purchaseCost")) + money(asset.get("additionalCosts"))
        method_key = asset.get("depreciationMethod", "straight_line")
        input_mode = asset.get("depreciationInputMode", "years")
        is_rate_mode = method_key == "straight_line" and input_mode == "rate"
        input_basis_label = "نسبة سنوية من القيمة القابلة للإهلاك" if is_rate_mode else "العمر بالسنوات"
        if method_key == "straight_line":
            annual_rate = money(asset.get("annualDepreciationRate")) if is_rate_mode else (
                100.0 / money(asset.get("usefulLifeYears")) if money(asset.get("usefulLifeYears")) > 0 else None
            )
        else:
            annual_rate = None
        opening_valuation = valuation(asset, before) if purchase_date < start else {"totalCost": total_cost, "accumulatedDepreciation": 0.0, "netBookValue": 0.0, "currentYearExpense": 0.0}
        closing_valuation = valuation(asset, end)
        if purchase_date >= start:
            opening_book = 0.0
            opening_accumulated = 0.0
        else:
            opening_book = opening_valuation["netBookValue"]
            opening_accumulated = opening_valuation["accumulatedDepreciation"]

        is_disposal_in_period = disposal and start <= disposal_date <= end
        if asset.get("depreciationMethod") == "units_of_production":
            period_expense = 0.0
            expense_note = "لا يتوفر سجل إنتاج مؤرخ لهذه الفترة"
        else:
            period_expense = max(0.0, closing_valuation["accumulatedDepreciation"] - opening_accumulated)
            expense_note = ""
        additions = total_cost if start <= purchase_date <= end else 0.0
        disposal_book = money(disposal.get("bookValueAtDisposal")) if is_disposal_in_period else 0.0
        proceeds = money(disposal.get("salePrice")) if is_disposal_in_period else 0.0
        disposal_costs = money(disposal.get("disposalCosts")) if is_disposal_in_period else 0.0
        gain_loss = float(disposal.get("gainLoss", proceeds - disposal_costs - disposal_book)) if is_disposal_in_period else 0.0
        status_at_end = _status_at(asset, end, closing_valuation)
        if status != "الكل" and status not in (status_at_end, STATUSES.get(status_at_end)):
            continue
        ending_book = 0.0 if asset.get("status") == "disposed" and disposal_date <= end else closing_valuation["netBookValue"]
        row = {
            "id": asset.get("id", ""), "code": asset.get("code", ""), "name": asset.get("name", ""),
            "accountCode": asset.get("accountCode", ""), "category": asset.get("category", "غير مصنف"), "department": asset.get("department", "غير محدد"),
            "purchaseDate": purchase_date.isoformat(), "inServiceDate": asset.get("inServiceDate", ""),
            "totalCost": total_cost, "openingBookValue": opening_book, "additions": additions,
            "periodExpense": period_expense, "disposalBookValue": disposal_book,
            "proceeds": proceeds, "disposalCosts": disposal_costs, "gainLoss": gain_loss,
            "endingBookValue": ending_book, "accumulatedDepreciation": closing_valuation["accumulatedDepreciation"],
            "salvageValue": money(asset.get("salvageValue")), "usefulLifeYears": money(asset.get("usefulLifeYears")),
            "depreciationMethod": method_key, "depreciationInputMode": "rate" if is_rate_mode else "years",
            "inputBasisLabel": input_basis_label, "annualDepreciationRate": annual_rate,
            "depreciationMethodLabel": METHODS.get(method_key, ""),
            "methodLabel": METHODS.get(method_key, ""), "status": status_at_end,
            "statusLabel": STATUSES.get(status_at_end, status_at_end), "location": asset.get("location", ""),
            "custodian": asset.get("custodian", ""), "serialNumber": asset.get("serialNumber", ""),
            "supplier": asset.get("supplier", ""), "invoiceNumber": asset.get("invoiceNumber", ""),
            "expenseNote": expense_note,
        }
        details.append(row)
        if is_disposal_in_period:
            disposals.append({
                "code": row["code"], "name": row["name"], "category": row["category"], "department": row["department"],
                "disposalDate": disposal_date.isoformat(), "disposalType": disposal.get("disposalType", "sale"),
                "bookValue": disposal_book, "salePrice": proceeds, "disposalCosts": disposal_costs,
                "gainLoss": gain_loss, "buyerName": disposal.get("buyerName", ""), "reason": disposal.get("reason", ""),
            })

    totals = {key: sum(float(row[key]) for row in details) for key in ("openingBookValue", "additions", "periodExpense", "disposalBookValue", "proceeds", "disposalCosts", "gainLoss", "endingBookValue", "totalCost", "accumulatedDepreciation")}
    totals["assetCount"] = len(details)
    totals["disposedCount"] = len(disposals)
    totals["unitMethodCount"] = sum(row["depreciationMethod"] == "units_of_production" for row in details)
    category_groups = _group(details, "category")
    department_groups = _group(details, "department")
    account_groups = _group(details, "accountCode")
    return {
        "fromDate": start.isoformat(), "toDate": end.isoformat(), "details": details,
        "totals": totals, "categories": category_groups, "departments": department_groups, "accounts": account_groups,
        "disposals": sorted(disposals, key=lambda r: (r["disposalDate"], r["code"])),
        "filters": {"category": category, "department": department, "status": status, "query": query},
        "notes": ["إهلاك طريقة وحدات الإنتاج لا يُحسب للفترة لعدم توفر سجل إنتاج مؤرخ؛ أدخل بيانات الإنتاج السنوي قبل الاعتماد."] if totals["unitMethodCount"] else [],
    }


def _group(details: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    metrics = ("totalCost", "openingBookValue", "additions", "periodExpense", "disposalBookValue", "proceeds", "disposalCosts", "gainLoss", "endingBookValue", "accumulatedDepreciation")
    groups: dict[str, dict[str, Any]] = defaultdict(lambda: {"group": "", "assetCount": 0, **{metric: 0.0 for metric in metrics}})
    for row in details:
        label = str(row.get(key) or "غير محدد")
        entry = groups[label]
        entry["group"] = label
        entry["assetCount"] += 1
        for metric in metrics:
            entry[metric] += float(row.get(metric, 0) or 0)
    return sorted(groups.values(), key=lambda item: (-item["endingBookValue"], item["group"]))


def report_view(report: dict[str, Any], kind: str) -> tuple[list[str], list[list[Any]], str]:
    """Return column headers, rows and Arabic heading for one report view."""
    if kind == "حسب التصنيف":
        headers = ["الفئة", "عدد الأصول", "التكلفة الإجمالية", "رصيد أول المدة", "الإضافات", "إهلاك الفترة", "قيمة استبعادات", "الربح / (الخسارة)", "رصيد آخر المدة"]
        rows = [[r["group"], r["assetCount"], r["totalCost"], r["openingBookValue"], r["additions"], r["periodExpense"], r["disposalBookValue"], r["gainLoss"], r["endingBookValue"]] for r in report["categories"]]
        return headers, rows, kind
    if kind == "حسب الإدارة":
        headers = ["الإدارة", "عدد الأصول", "التكلفة الإجمالية", "رصيد أول المدة", "الإضافات", "إهلاك الفترة", "قيمة استبعادات", "الربح / (الخسارة)", "رصيد آخر المدة"]
        rows = [[r["group"], r["assetCount"], r["totalCost"], r["openingBookValue"], r["additions"], r["periodExpense"], r["disposalBookValue"], r["gainLoss"], r["endingBookValue"]] for r in report["departments"]]
        return headers, rows, kind
    if kind == "حسب الحساب":
        headers = ["رمز الحساب", "عدد الأصول", "التكلفة الإجمالية", "رصيد أول المدة", "الإضافات", "إهلاك الفترة", "قيمة استبعادات", "الربح / (الخسارة)", "رصيد آخر المدة"]
        rows = [[r["group"], r["assetCount"], r["totalCost"], r["openingBookValue"], r["additions"], r["periodExpense"], r["disposalBookValue"], r["gainLoss"], r["endingBookValue"]] for r in report["accounts"]]
        return headers, rows, kind
    if kind == "الاستبعادات":
        headers = ["تاريخ الاستبعاد", "رمز الأصل", "اسم الأصل", "الفئة", "الإدارة", "القيمة الدفترية", "متحصلات البيع", "تكاليف الاستبعاد", "الربح / (الخسارة)", "المشتري / الجهة", "السبب"]
        rows = [[r["disposalDate"], r["code"], r["name"], r["category"], r["department"], r["bookValue"], r["salePrice"], r["disposalCosts"], r["gainLoss"], r["buyerName"], r["reason"]] for r in report["disposals"]]
        return headers, rows, kind
    if kind == "الإهلاك للفترة":
        headers = ["رمز الأصل", "رمز الحساب", "اسم الأصل", "الفئة", "الإدارة", "طريقة الإهلاك", "أساس الإدخال", "المعدل السنوي من القيمة القابلة للإهلاك (%)", "رصيد أول المدة", "مصروف الإهلاك", "مجمع الإهلاك آخر المدة", "صافي القيمة آخر المدة", "ملاحظة"]
        rows = [[r["code"], r["accountCode"], r["name"], r["category"], r["department"], r["methodLabel"], r["inputBasisLabel"], r["annualDepreciationRate"], r["openingBookValue"], r["periodExpense"], r["accumulatedDepreciation"], r["endingBookValue"], r["expenseNote"]] for r in report["details"]]
        return headers, rows, kind
    headers = ["رمز الأصل", "رمز الحساب", "اسم الأصل", "الفئة", "الإدارة", "الحالة", "تاريخ الشراء", "التكلفة الإجمالية", "أساس الإهلاك", "المعدل السنوي من القيمة القابلة للإهلاك (%)", "رصيد أول المدة", "الإضافات", "مصروف الإهلاك", "قيمة الأصل المستبعد", "متحصلات البيع", "الربح / (الخسارة)", "صافي القيمة آخر المدة"]
    rows = [[r["code"], r["accountCode"], r["name"], r["category"], r["department"], r["statusLabel"], r["purchaseDate"], r["totalCost"], r["inputBasisLabel"], r["annualDepreciationRate"], r["openingBookValue"], r["additions"], r["periodExpense"], r["disposalBookValue"], r["proceeds"], r["gainLoss"], r["endingBookValue"]] for r in report["details"]]
    return headers, rows, "حركة الأصول للفترة"
