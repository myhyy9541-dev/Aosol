"""Professional Arabic RTL Excel templates, exports and validated imports."""
from __future__ import annotations

import csv
import re
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

from aosol_core import CATEGORIES, METHODS, STATUSES, money, safe_spreadsheet_text, valuation
from aosol_reports import build_asset_report, period_ranges, report_view

NAVY = "13233A"
NAVY_2 = "1F3656"
TEAL = "13A89E"
GOLD = "D6AD60"
INK = "1B2A41"
MUTED = "718096"
PALE_BLUE = "EAF2F8"
PALE_TEAL = "E6F6F4"
PALE_GOLD = "FFF6DD"
PALE_RED = "FDECEC"
PALE_GREEN = "E8F5E9"
WHITE = "FFFFFF"
BORDER = "D8E1EA"

# Stable Arabic import schema. The technical field keys are stored in comments.
TEMPLATE_COLUMNS = [
    ("code", "رمز الأصل *", "text"),
    ("accountCode", "رمز الحساب", "text"),
    ("name", "اسم الأصل *", "text"),
    ("category", "فئة الأصل *", "category"),
    ("purchaseDate", "تاريخ الشراء YYYY-MM-DD *", "date"),
    ("inServiceDate", "تاريخ بدء الخدمة YYYY-MM-DD *", "date"),
    ("purchaseCost", "تكلفة الشراء *", "money"),
    ("additionalCosts", "التكاليف الإضافية", "money"),
    ("salvageValue", "القيمة التخريدية", "money"),
    ("usefulLifeYears", "العمر الإنتاجي (سنوات) *", "number"),
    ("depreciationMethod", "طريقة الإهلاك *", "method"),
    ("startDepreciationRule", "قاعدة بدء الإهلاك", "rule"),
    ("status", "حالة الأصل", "status"),
    ("disposalDate", "تاريخ الاستبعاد", "optional_date"),
    ("disposalType", "نوع الاستبعاد", "disposal_type"),
    ("salePrice", "متحصلات البيع", "money"),
    ("disposalCosts", "تكاليف الاستبعاد", "money"),
    ("bookValueAtDisposal", "القيمة الدفترية عند الاستبعاد", "money"),
    ("accumulatedAtDisposal", "مجمع الإهلاك عند الاستبعاد", "money"),
    ("buyerName", "المشتري / الجهة المستلمة", "text"),
    ("disposalReason", "سبب الاستبعاد", "text"),
    ("totalEstimatedUnits", "الوحدات المقدرة", "number"),
    ("producedUnitsToDate", "الوحدات المنتجة حتى الآن", "number"),
    ("department", "الإدارة", "text"),
    ("location", "الموقع", "text"),
    ("custodian", "العهدة / المسؤول", "text"),
    ("serialNumber", "الرقم التسلسلي", "text"),
    ("supplier", "المورد", "text"),
    ("invoiceNumber", "رقم الفاتورة", "text"),
    ("notes", "ملاحظات", "text"),
]

ALIASES: dict[str, str] = {}
for key, header, _kind in TEMPLATE_COLUMNS:
    ALIASES[header] = key
    ALIASES[header.replace(" *", "")] = key
    ALIASES[key] = key
ALIASES.update({
    "الكود": "code", "رمز الأصل": "code", "كود الأصل": "code", "asset code": "code", "code": "code",
    "اسم الأصل": "name", "الاسم": "name", "asset name": "name", "name": "name",
    "الفئة": "category", "التصنيف": "category", "category": "category",
    "تاريخ الشراء": "purchaseDate", "purchase date": "purchaseDate", "تاريخ التشغيل": "inServiceDate", "تاريخ بدء التشغيل": "inServiceDate", "تاريخ الخدمة": "inServiceDate", "in service date": "inServiceDate",
    "التكلفة": "purchaseCost", "التكلفة التاريخية": "purchaseCost", "التكلفة الإجمالية": "purchaseCost", "purchase cost": "purchaseCost", "cost": "purchaseCost",
    "مصروفات إضافية": "additionalCosts", "تكاليف إضافية": "additionalCosts", "additional costs": "additionalCosts",
    "قيمة الخردة": "salvageValue", "الخردة": "salvageValue", "salvage value": "salvageValue",
    "العمر الإنتاجي": "usefulLifeYears", "العمر": "usefulLifeYears", "useful life years": "usefulLifeYears",
    "الطريقة": "depreciationMethod", "depreciation method": "depreciationMethod",
    "قاعدة بدء الإهلاك": "startDepreciationRule", "سياسة بدء الإهلاك": "startDepreciationRule",
    "الحالة": "status", "status": "status", "الإدارة": "department", "القسم": "department", "department": "department",
    "الموقع": "location", "location": "location", "العهدة": "custodian", "المسؤول": "custodian", "custodian": "custodian",
    "الرقم التسلسلي": "serialNumber", "serial number": "serialNumber", "المورد": "supplier", "supplier": "supplier",
    "رقم الفاتورة": "invoiceNumber", "invoice number": "invoiceNumber", "ملاحظات": "notes", "notes": "notes",
    "الوحدات المقدرة": "totalEstimatedUnits", "total estimated units": "totalEstimatedUnits",
    "الوحدات المنتجة": "producedUnitsToDate", "produced units to date": "producedUnitsToDate",
    "متحصلات البيع": "salePrice", "سعر البيع": "salePrice", "sale price": "salePrice",
    "تكاليف الاستبعاد": "disposalCosts", "disposal costs": "disposalCosts",
    "القيمة الدفترية عند الاستبعاد": "bookValueAtDisposal", "disposal book value": "bookValueAtDisposal",
    "مجمع الإهلاك عند الاستبعاد": "accumulatedAtDisposal", "accumulated at disposal": "accumulatedAtDisposal",
    "نوع الاستبعاد": "disposalType", "disposal type": "disposalType",
    "تاريخ الاستبعاد": "disposalDate", "disposal date": "disposalDate",
    "المشتري / الجهة المستلمة": "buyerName", "اسم المشتري": "buyerName", "buyer name": "buyerName",
    "سبب الاستبعاد": "disposalReason", "reason": "disposalReason",
})

RULE_LABELS = {
    "mid_month_15": "منتصف الشهر (١–١٥)",
    "next_month": "الشهر التالي",
    "same_month": "الشهر نفسه",
}
DISPOSAL_TYPES = {"sale": "بيع", "scrap": "تخريد", "donation": "تبرع", "loss": "فقد / تلف"}


def _openpyxl():
    from openpyxl import Workbook, load_workbook
    from openpyxl.chart import BarChart, Reference
    from openpyxl.formatting.rule import ColorScaleRule, DataBarRule
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.worksheet.datavalidation import DataValidation
    return Workbook, load_workbook, BarChart, Reference, ColorScaleRule, DataBarRule, Alignment, Border, Font, PatternFill, Side, DataValidation


def _normalise_header(value: Any) -> str:
    text = str(value or "").strip().casefold()
    text = text.replace("ـ", "")
    text = re.sub(r"[\u064b-\u065f\u0670]", "", text)
    text = text.replace("*", "").replace("＊", "")
    text = re.sub(r"\s+", " ", text)
    return text


def _canonical_fields(headers: list[Any]) -> dict[int, str]:
    aliases = {_normalise_header(key): value for key, value in ALIASES.items()}
    result: dict[int, str] = {}
    for index, header in enumerate(headers):
        canonical = aliases.get(_normalise_header(header))
        if canonical:
            result[index] = canonical
    return result


def _translate_digits(text: str) -> str:
    table = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    return text.translate(table).replace("٬", ",").replace("٫", ".")


def _parse_number(value: Any, *, default: float | None = None) -> float | None:
    if value is None or str(value).strip() == "":
        return default
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        result = float(value)
    else:
        text = _translate_digits(str(value)).strip().replace(" ", "")
        if text.count(",") == 1 and "." not in text and len(text.rsplit(",", 1)[-1]) in (1, 2):
            text = text.replace(",", ".")
        else:
            text = text.replace(",", "")
        try:
            result = float(text)
        except ValueError as exc:
            raise ValueError("قيمة رقمية غير صالحة") from exc
    if result != result or result in (float("inf"), float("-inf")):
        raise ValueError("القيمة الرقمية يجب أن تكون محدودة")
    return result


def _parse_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        from openpyxl.utils.datetime import from_excel
        converted = from_excel(value)
        if isinstance(converted, datetime):
            return converted.date().isoformat()
        if isinstance(converted, date):
            return converted.isoformat()
    text = _translate_digits(str(value or "").strip())
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError("تاريخ غير صالح؛ استخدم YYYY-MM-DD")


def _style_title(sheet: Any, title: str, subtitle: str, last_col: int) -> None:
    _Workbook, _load, _chart, _ref, _scale, _bars, Alignment, _Border, Font, PatternFill, _Side, _DV = _openpyxl()
    from openpyxl.utils import get_column_letter
    end = get_column_letter(max(2, last_col))
    sheet.sheet_view.rightToLeft = True
    sheet.sheet_view.showGridLines = False
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.page_margins.left = 0.25
    sheet.page_margins.right = 0.25
    sheet.page_margins.top = 0.45
    sheet.page_margins.bottom = 0.45
    sheet.column_dimensions["A"].width = 3
    sheet.merge_cells(f"B2:{end}2")
    sheet["B2"] = title
    sheet["B2"].font = Font(name="Arial", size=18, bold=True, color=WHITE)
    sheet["B2"].fill = PatternFill("solid", fgColor=NAVY)
    sheet["B2"].alignment = Alignment(horizontal="right", vertical="center")
    for cells in sheet[f"B2:{end}2"]:
        for cell in cells:
            cell.fill = PatternFill("solid", fgColor=NAVY)
    sheet.row_dimensions[2].height = 36
    sheet.merge_cells(f"B3:{end}3")
    sheet["B3"] = subtitle
    sheet["B3"].font = Font(name="Arial", size=10, color=MUTED, italic=True)
    sheet["B3"].alignment = Alignment(horizontal="right", vertical="center")
    sheet.row_dimensions[3].height = 23
    sheet.freeze_panes = "A6"


def _write_data_table(sheet: Any, headers: list[str], rows: list[list[Any]], *, header_row: int = 5, currency_columns: set[int] | None = None, percent_columns: set[int] | None = None, total_row: list[Any] | None = None) -> None:
    _Workbook, _load, _chart, _ref, _scale, _bars, Alignment, Border, Font, PatternFill, Side, _DV = _openpyxl()
    from openpyxl.utils import get_column_letter
    thin = Side(style="hair", color=BORDER)
    currency_columns = currency_columns or set()
    percent_columns = percent_columns or set()
    for col, header in enumerate(headers, 1):
        cell = sheet.cell(header_row, col, header)
        cell.fill = PatternFill("solid", fgColor=NAVY_2)
        cell.font = Font(name="Arial", size=10, bold=True, color=WHITE)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(bottom=Side(style="medium", color=TEAL))
    sheet.row_dimensions[header_row].height = 32
    for row_idx, values in enumerate(rows, header_row + 1):
        for col, value in enumerate(values, 1):
            cell = sheet.cell(row_idx, col, value)
            if isinstance(value, str):
                cell.data_type = "s"
            cell.font = Font(name="Arial", size=9, color=INK)
            fill = WHITE if (row_idx - header_row) % 2 else "F3F7FA"
            if isinstance(value, (int, float)) and not isinstance(value, bool) and col in currency_columns:
                fill = PALE_GOLD if (row_idx - header_row) % 2 else "FFF9EA"
                cell.number_format = '#,##0.00;[Red](#,##0.00);-'
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif col in percent_columns:
                cell.number_format = '0.0%'
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
            cell.fill = PatternFill("solid", fgColor=fill)
            cell.border = Border(bottom=thin)
            if isinstance(value, (int, float)) and col not in currency_columns:
                cell.number_format = '#,##0.##'
            if isinstance(value, str) and ("خسارة" in value or value.startswith("-") or value.startswith("(") ):
                cell.font = Font(name="Arial", size=9, color="B42318")
        sheet.row_dimensions[row_idx].height = 23
    if total_row:
        row_idx = header_row + 1 + len(rows)
        for col, value in enumerate(total_row, 1):
            cell = sheet.cell(row_idx, col, value)
            if isinstance(value, str):
                cell.data_type = "s"
            cell.fill = PatternFill("solid", fgColor=PALE_TEAL)
            cell.font = Font(name="Arial", bold=True, color=NAVY)
            cell.alignment = Alignment(horizontal="right", vertical="center")
            if col in currency_columns:
                cell.number_format = '#,##0.00;[Red](#,##0.00);-'
        sheet.row_dimensions[row_idx].height = 26
    last_row = max(header_row + 1, header_row + len(rows))
    sheet.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{last_row}"
    for col, header in enumerate(headers, 1):
        max_len = max([len(str(header))] + [min(36, len(str(row[col - 1] or ""))) for row in rows[:250]])
        sheet.column_dimensions[get_column_letter(col)].width = min(38, max(14, max_len + 3))


def export_import_template(path: str | Path) -> None:
    """Export an import-ready blank template with a dedicated instruction sheet."""
    Workbook, _load, _chart, _ref, _scale, _bars, Alignment, Border, Font, PatternFill, Side, DataValidation = _openpyxl()
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "قالب الأصول"
    sheet.sheet_view.rightToLeft = True
    sheet.sheet_view.showGridLines = False
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:{__import__('openpyxl').utils.get_column_letter(len(TEMPLATE_COLUMNS))}501"
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.tabColor = TEAL
    sheet.column_dimensions["A"].width = 20
    thin = Side(style="thin", color=BORDER)
    for col, (field, header, kind) in enumerate(TEMPLATE_COLUMNS, 1):
        cell = sheet.cell(1, col, header)
        cell.comment = __import__("openpyxl").comments.Comment(f"حقل Aosol: {field} | النوع: {kind}", "Aosol")
        cell.fill = PatternFill("solid", fgColor=(NAVY if "*" in header else NAVY_2))
        cell.font = Font(name="Arial", size=9, bold=True, color=WHITE)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(bottom=Side(style="medium", color=TEAL))
        width = 23 if kind == "text" else 25 if kind in ("category", "method", "rule", "status") else 20
        if field in ("name", "notes", "location"):
            width = 32
        sheet.column_dimensions[__import__("openpyxl").utils.get_column_letter(col)].width = width
    sheet.row_dimensions[1].height = 42
    for row in range(2, 502):
        for col in range(1, len(TEMPLATE_COLUMNS) + 1):
            cell = sheet.cell(row, col)
            cell.fill = PatternFill("solid", fgColor=("FFFDE7" if row % 2 else "FFF9D9"))
            cell.font = Font(name="Arial", size=9, color=INK)
            cell.alignment = Alignment(horizontal="right", vertical="center")
            cell.border = Border(bottom=Side(style="hair", color="E7E2C8"))
        for col, (field, _header, kind) in enumerate(TEMPLATE_COLUMNS, 1):
            cell = sheet.cell(row, col)
            if kind == "date":
                cell.number_format = "yyyy-mm-dd"
            elif kind in ("money", "number"):
                cell.number_format = "#,##0.00"
    columns = {field: index for index, (field, _header, _kind) in enumerate(TEMPLATE_COLUMNS, 1)}
    category_values = ",".join(CATEGORIES)
    method_values = ",".join(METHODS.values())
    rule_values = ",".join(RULE_LABELS.values())
    status_values = ",".join(STATUSES.values())
    disposal_type_values = ",".join(DISPOSAL_TYPES.values())
    for field, values in (("category", category_values), ("depreciationMethod", method_values), ("startDepreciationRule", rule_values), ("status", status_values), ("disposalType", disposal_type_values)):
        dv = DataValidation(type="list", formula1=f'"{values}"', allow_blank=True)
        dv.errorTitle = "قيمة غير معتمدة"
        dv.error = "اختر قيمة من القائمة المنسدلة في الخلية."
        dv.promptTitle = "اختيار من القائمة"
        dv.prompt = "اختر قيمة مطابقة لقيم Aosol."
        dv.showErrorMessage = True
        dv.showInputMessage = True
        sheet.add_data_validation(dv)
        letter = __import__("openpyxl").utils.get_column_letter(columns[field])
        dv.add(f"{letter}2:{letter}501")
    for field in ("purchaseDate", "inServiceDate", "disposalDate"):
        dv = DataValidation(type="date", operator="between", formula1="DATE(1900,1,1)", formula2="DATE(2199,12,31)", allow_blank=(field == "disposalDate"))
        dv.error = "أدخل تاريخًا صالحًا بصيغة YYYY-MM-DD."
        dv.showErrorMessage = True
        sheet.add_data_validation(dv)
        letter = __import__("openpyxl").utils.get_column_letter(columns[field])
        dv.add(f"{letter}2:{letter}501")
    for field in ("purchaseCost", "additionalCosts", "salvageValue", "usefulLifeYears", "totalEstimatedUnits", "producedUnitsToDate", "salePrice", "disposalCosts", "bookValueAtDisposal", "accumulatedAtDisposal"):
        dv = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=(field != "purchaseCost"))
        dv.error = "أدخل رقمًا غير سالب."
        dv.showErrorMessage = True
        sheet.add_data_validation(dv)
        letter = __import__("openpyxl").utils.get_column_letter(columns[field])
        dv.add(f"{letter}2:{letter}501")
    instructions = workbook.create_sheet("دليل الاستخدام")
    instructions.sheet_view.rightToLeft = True
    instructions.sheet_view.showGridLines = False
    instructions.sheet_properties.tabColor = GOLD
    instructions.column_dimensions["A"].width = 3
    instructions.column_dimensions["B"].width = 34
    instructions.column_dimensions["C"].width = 88
    instructions.merge_cells("B2:C2")
    instructions["B2"] = "دليل قالب استيراد أصول Aosol"
    instructions["B2"].fill = PatternFill("solid", fgColor=NAVY)
    instructions["B2"].font = Font(name="Arial", size=17, bold=True, color=WHITE)
    instructions["B2"].alignment = Alignment(horizontal="right", vertical="center")
    instructions.row_dimensions[2].height = 36
    guide = [
        ("طريقة الاستخدام", "أدخل كل أصل في صف مستقل بورقة «قالب الأصول»، ثم احفظ الملف بصيغة .xlsx واستورده من تطبيق Aosol."),
        ("الحقول المطلوبة", "الحقول التي تنتهي بعلامة * مطلوبة. لا تغيّر أسماء الأعمدة ولا تحذف ورقة قالب الأصول."),
        ("التواريخ", "استخدم صيغة YYYY-MM-DD (مثال 2026-01-31). يقبل الاستيراد أيضًا خلايا Excel المعرفة كتاريخ."),
        ("القيم المنسدلة", "اختر الفئة وطريقة الإهلاك وقاعدة البدء والحالة من القوائم. لا تدخل قيمة خارج القائمة."),
        ("المبالغ والأعمار", "أدخل أرقامًا غير سالبة من دون كتابة رمز العملة. تكلفة الشراء يجب أن تكون أكبر من صفر، والعمر سنة أو أكثر."),
        ("الوحدات", "املأ الوحدات المقدرة والمنتجة عند اختيار طريقة وحدات الإنتاج. لا يحتسب التقرير مصروف فترة دقيقًا دون سجل وحدات مؤرخ."),
        ("التكرارات والأخطاء", "يفحص التطبيق رمز الأصل في الملف وقاعدة البيانات. تظهر معاينة وأسباب الصفوف المرفوضة قبل حفظ أي أصل."),
        ("تفاصيل الاستبعاد", "إذا اخترت حالة «مستبعد»، أكمل تاريخ الاستبعاد والقيمة الدفترية ومجمع الإهلاك ونوع الاستبعاد."),
        ("الخصوصية والنسخ", "الاستيراد محلي إلى قاعدة SQLite على هذا الجهاز. احتفظ بنسخة احتياطية قبل العمليات الكبيرة."),
        ("العملة", "الأرقام تستورد كقيم خام؛ العملة هي العملة الحالية المحددة في إعدادات Aosol."),
    ]
    for row, (label, detail) in enumerate(guide, 4):
        instructions.cell(row, 2, label).fill = PatternFill("solid", fgColor=PALE_BLUE)
        instructions.cell(row, 2).font = Font(name="Arial", bold=True, color=NAVY)
        instructions.cell(row, 3, detail).font = Font(name="Arial", color=INK)
        instructions.cell(row, 2).alignment = Alignment(horizontal="right", vertical="center")
        instructions.cell(row, 3).alignment = Alignment(horizontal="right", vertical="center", wrap_text=True)
        instructions.row_dimensions[row].height = 38
    workbook.properties.title = "قالب استيراد الأصول - Aosol"
    workbook.properties.creator = "Aosol"
    workbook.save(path)


def parse_import_file(path: str | Path, existing_codes: set[str] | list[str] | tuple[str, ...] = ()) -> dict[str, Any]:
    """Read an Aosol template / recognized CSV and validate every non-empty row."""
    path = Path(path)
    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            values = list(csv.reader(stream))
        sheets = [("CSV", values)]
    elif path.suffix.lower() in (".xlsx", ".xlsm"):
        _Workbook, load_workbook, *_rest = _openpyxl()
        book = load_workbook(path, data_only=True, read_only=True)
        chosen = book["قالب الأصول"] if "قالب الأصول" in book.sheetnames else None
        sheets = []
        if chosen:
            sheets.append((chosen.title, list(chosen.iter_rows(values_only=True))))
        else:
            for sheet in book.worksheets:
                sheets.append((sheet.title, list(sheet.iter_rows(max_row=12, values_only=True))))
        book.close()
    else:
        raise ValueError("صيغة الاستيراد المدعومة هي .xlsx أو .xlsm أو .csv")

    selected_name = ""
    selected_rows: list[Any] = []
    field_map: dict[int, str] = {}
    for sheet_name, rows in sheets:
        for row_index, row in enumerate(rows[:12]):
            mapped = _canonical_fields(list(row))
            required = {"code", "name", "purchaseCost"}
            if required.issubset(set(mapped.values())):
                selected_name, selected_rows, field_map = sheet_name, rows, mapped
                header_index = row_index
                break
        if selected_rows:
            break
    if not selected_rows:
        raise ValueError("لم أجد صف عناوين معروفًا. استخدم قالب Aosol عبر زر «قالب Excel» دون تغيير أسماء الأعمدة.")

    existing = {str(code).strip().casefold() for code in existing_codes}
    seen: set[str] = set()
    accepted: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    duplicate_count = 0
    rows_scanned = 0
    cat_by_norm = {_normalise_header(name): name for name in CATEGORIES}
    cat_by_norm.update({_normalise_header(key): label for label, key in (("المباني والإنشاءات", "buildings"), ("الآلات وخطوط الإنتاج والمولدات", "machinery"), ("المركبات ووسائل النقل", "vehicles"), ("منظومات الطاقة والكهرباء", "solar_energy"), ("منظومات الطاقة الشمسية والكهرباء", "solar_energy"), ("أجهزة الكمبيوتر والتقنية", "computers"), ("أجهزة الكمبيوتر والتقنية والشبكات", "computers"), ("الأثاث والتجهيزات المكتبية", "furniture"), ("المعدات الثقيلة والحفارات", "heavy_equipment"))})
    method_by_norm = {_normalise_header(label): key for key, label in METHODS.items()}
    method_by_norm.update({_normalise_header(key): key for key in METHODS})
    status_by_norm = {_normalise_header(label): key for key, label in STATUSES.items()}
    status_by_norm.update({_normalise_header(key): key for key in STATUSES})
    rule_by_norm = {_normalise_header(label): key for key, label in RULE_LABELS.items()}
    rule_by_norm.update({_normalise_header(key): key for key in RULE_LABELS})

    for row_number, values in enumerate(selected_rows[header_index + 1:], header_index + 2):
        values = list(values or [])
        if not any(value is not None and str(value).strip() for value in values):
            continue
        rows_scanned += 1
        raw: dict[str, Any] = {field: (values[index] if index < len(values) else None) for index, field in field_map.items()}
        code = str(raw.get("code") or "").strip()
        name = str(raw.get("name") or "").strip()
        problems: list[str] = []
        if not code:
            problems.append("رمز الأصل مطلوب")
        if not name:
            problems.append("اسم الأصل مطلوب")
        normalized_code = code.casefold()
        is_duplicate = bool(normalized_code and (normalized_code in existing or normalized_code in seen))
        if is_duplicate:
            duplicate_count += 1
            problems.append("رمز الأصل مكرر في قاعدة البيانات أو الملف")
        if normalized_code:
            seen.add(normalized_code)

        parsed: dict[str, Any] = {"id": str(uuid.uuid4()), "code": code, "name": name}
        for field in ("purchaseDate", "inServiceDate"):
            try:
                parsed[field] = _parse_date(raw.get(field))
            except ValueError as exc:
                field_title = next((label.replace(" *", "") for code_key, label, _kind in TEMPLATE_COLUMNS if code_key == field), field)
                problems.append(f"{field_title}: {exc}")
        if parsed.get("purchaseDate") and parsed.get("inServiceDate") and parsed["inServiceDate"] < parsed["purchaseDate"]:
            problems.append("تاريخ بدء الخدمة يسبق تاريخ الشراء")

        numeric_fields = ("purchaseCost", "additionalCosts", "salvageValue", "usefulLifeYears", "totalEstimatedUnits", "producedUnitsToDate", "salePrice", "disposalCosts", "bookValueAtDisposal", "accumulatedAtDisposal")
        for field in numeric_fields:
            value = raw.get(field)
            required = field in ("purchaseCost", "usefulLifeYears")
            try:
                number = _parse_number(value, default=None if required else 0.0)
                if number is None:
                    raise ValueError("الحقل مطلوب")
                if number < 0:
                    raise ValueError("القيمة لا تقبل السالب")
                if field == "purchaseCost" and number <= 0:
                    raise ValueError("يجب أن تكون تكلفة الشراء أكبر من صفر")
                if field == "usefulLifeYears" and (number < 1 or not number.is_integer()):
                    raise ValueError("أدخل عمرًا صحيحًا لا يقل عن سنة")
                if field == "producedUnitsToDate" and raw.get("totalEstimatedUnits") not in (None, ""):
                    estimated = _parse_number(raw.get("totalEstimatedUnits"), default=0.0) or 0.0
                    if number > estimated:
                        raise ValueError("الوحدات المنتجة تتجاوز إجمالي الوحدات المقدرة")
                parsed[field] = int(number) if field == "usefulLifeYears" else number
            except ValueError as exc:
                field_title = next((label.replace(" *", "") for code_key, label, _kind in TEMPLATE_COLUMNS if code_key == field), field)
                problems.append(f"{field_title}: {exc}")
        total_cost = float(parsed.get("purchaseCost", 0) or 0) + float(parsed.get("additionalCosts", 0) or 0)
        if float(parsed.get("salvageValue", 0) or 0) > total_cost > 0:
            problems.append("القيمة التخريدية تتجاوز التكلفة الرأسمالية")

        category_raw = str(raw.get("category") or "").strip()
        category = cat_by_norm.get(_normalise_header(category_raw))
        if not category:
            problems.append("الفئة مطلوبة ويجب اختيارها من القالب")
        else:
            parsed["category"] = category
        method_raw = str(raw.get("depreciationMethod") or "").strip()
        method = method_by_norm.get(_normalise_header(method_raw))
        if not method:
            problems.append("طريقة الإهلاك مطلوبة ويجب اختيارها من القالب")
        else:
            parsed["depreciationMethod"] = method
        rule_raw = str(raw.get("startDepreciationRule") or "mid_month_15").strip()
        parsed["startDepreciationRule"] = rule_by_norm.get(_normalise_header(rule_raw), "mid_month_15")
        status_raw = str(raw.get("status") or "نشط").strip()
        parsed["status"] = status_by_norm.get(_normalise_header(status_raw), "active")
        if raw.get("startDepreciationRule") and _normalise_header(rule_raw) not in rule_by_norm:
            problems.append("قاعدة بدء الإهلاك غير معروفة")
        if raw.get("status") and _normalise_header(status_raw) not in status_by_norm:
            problems.append("حالة الأصل غير معروفة")

        for field, _header, kind in TEMPLATE_COLUMNS:
            if kind == "text" and field not in ("code", "name"):
                parsed[field] = str(raw.get(field) or "").strip()
        for field in ("disposalDate", "buyerName", "disposalReason"):
            if field in ("buyerName", "disposalReason"):
                parsed[field] = str(raw.get(field) or "").strip()
        if raw.get("disposalDate") not in (None, ""):
            try:
                parsed["disposalDate"] = _parse_date(raw.get("disposalDate"))
            except ValueError as exc:
                problems.append(f"تاريخ الاستبعاد: {exc}")
        if parsed["status"] == "disposed":
            disposal_type_map = {_normalise_header(label): key for key, label in DISPOSAL_TYPES.items()}
            disposal_type_map.update({_normalise_header(key): key for key in DISPOSAL_TYPES})
            disposal_type_raw = str(raw.get("disposalType") or "بيع").strip()
            disposal_type = disposal_type_map.get(_normalise_header(disposal_type_raw))
            if not parsed.get("disposalDate"):
                problems.append("تاريخ الاستبعاد مطلوب للأصل المستبعد")
            if not disposal_type:
                problems.append("نوع الاستبعاد غير معروف")
            if raw.get("bookValueAtDisposal") in (None, "") or raw.get("accumulatedAtDisposal") in (None, ""):
                problems.append("القيمة الدفترية ومجمع الإهلاك مطلوبان للأصل المستبعد")
            if parsed.get("disposalDate") and disposal_type and raw.get("bookValueAtDisposal") not in (None, "") and raw.get("accumulatedAtDisposal") not in (None, ""):
                sale_price = float(parsed.get("salePrice", 0) or 0)
                disposal_costs = float(parsed.get("disposalCosts", 0) or 0)
                book_value = float(parsed.get("bookValueAtDisposal", 0) or 0)
                accumulated_at = float(parsed.get("accumulatedAtDisposal", 0) or 0)
                parsed["disposal"] = {"disposalDate": parsed["disposalDate"], "disposalType": disposal_type, "salePrice": sale_price, "disposalCosts": disposal_costs, "bookValueAtDisposal": book_value, "accumulatedAtDisposal": accumulated_at, "gainLoss": sale_price - disposal_costs - book_value, "buyerName": parsed.get("buyerName", ""), "reason": parsed.get("disposalReason", "")}
        elif parsed.get("disposalDate"):
            problems.append("لا يمكن إدخال تاريخ استبعاد لحالة أصل غير مستبعد")
        parsed.setdefault("additionalCosts", 0.0)
        parsed.setdefault("salvageValue", 0.0)
        parsed.setdefault("totalEstimatedUnits", 0.0)
        parsed.setdefault("producedUnitsToDate", 0.0)
        parsed.setdefault("department", "")
        parsed.setdefault("location", "")
        parsed.setdefault("custodian", "")
        parsed.setdefault("status", "active")
        parsed["createdAt"] = datetime.now().isoformat(timespec="seconds")
        parsed["updatedAt"] = parsed["createdAt"]
        parsed["sourceRow"] = row_number
        if problems:
            issues.append({"row": row_number, "code": code, "name": name, "reason": "؛ ".join(problems), "duplicate": is_duplicate})
        else:
            parsed.pop("sourceRow", None)
            accepted.append(parsed)

    return {"sheet": selected_name, "assets": accepted, "issues": issues, "duplicateCount": duplicate_count, "rowsScanned": rows_scanned, "validCount": len(accepted), "issueCount": len(issues)}


def export_assets_workbook(path: str | Path, assets: list[dict[str, Any]], company: str, currency: str) -> None:
    Workbook, _load, BarChart, Reference, ColorScaleRule, DataBarRule, Alignment, _Border, Font, PatternFill, _Side, _DV = _openpyxl()
    from openpyxl.utils import get_column_letter
    from aosol_reports import build_asset_report
    now = date.today()
    report = build_asset_report(assets, date(now.year, 1, 1), now)
    workbook = Workbook()
    overview = workbook.active
    overview.title = "نظرة عامة"
    overview.sheet_properties.tabColor = TEAL
    _style_title(overview, "لوحة ملخص الأصول الثابتة", f"{company}  |  تاريخ الاستخراج: {datetime.now():%Y-%m-%d %H:%M}  |  العملة: {currency}", 9)
    totals = report["totals"]
    cards = [("عدد الأصول في التقرير", totals["assetCount"], PALE_BLUE), ("إضافات الفترة", totals["additions"], PALE_TEAL), ("إهلاك الفترة", totals["periodExpense"], PALE_GOLD), ("صافي القيمة آخر المدة", totals["endingBookValue"], PALE_GREEN)]
    for index, (label, value, fill) in enumerate(cards):
        col = 2 + index * 2
        overview.merge_cells(start_row=5, start_column=col, end_row=5, end_column=col + 1)
        overview.merge_cells(start_row=6, start_column=col, end_row=7, end_column=col + 1)
        label_cell, value_cell = overview.cell(5, col), overview.cell(6, col)
        label_cell.value = label
        value_cell.value = value
        label_cell.fill = value_cell.fill = PatternFill("solid", fgColor=fill)
        label_cell.font = Font(name="Arial", size=10, bold=True, color=NAVY)
        value_cell.font = Font(name="Arial", size=16, bold=True, color=TEAL if index == 3 else NAVY)
        label_cell.alignment = Alignment(horizontal="center", vertical="center")
        value_cell.alignment = Alignment(horizontal="center", vertical="center")
        value_cell.number_format = '#,##0.00;[Red](#,##0.00);-'
        for c in (col, col + 1):
            overview.column_dimensions[get_column_letter(c)].width = 21
    overview.merge_cells("B9:I9")
    overview["B9"] = f"نطاق المؤشرات: 01-01-{now.year} إلى {now.isoformat()} | يشمل الأصول المسجلة حتى تاريخ التقرير"
    overview["B9"].font = Font(name="Arial", size=9, color=MUTED, italic=True)
    overview["B9"].alignment = Alignment(horizontal="right")
    overview["B11"] = "روابط الأوراق"
    overview["B11"].font = Font(name="Arial", size=12, bold=True, color=NAVY)
    for row, sheet_name in enumerate(["سجل الأصول", "ملخص الحسابات", "ملخص الفئات", "ملخص الإدارات", "جدول الإهلاك"], 12):
        cell = overview.cell(row, 2, sheet_name)
        cell.hyperlink = f"#'{sheet_name}'!A1"
        cell.font = Font(name="Arial", size=10, color=TEAL, underline="single")
        cell.alignment = Alignment(horizontal="right")
    overview["D11"] = "مؤشرات التقرير"
    overview["D11"].font = Font(name="Arial", size=12, bold=True, color=NAVY)
    insights = [
        f"رصيد أول المدة: {totals['openingBookValue']:,.2f} {currency}",
        f"قيمة الأصول المستبعدة: {totals['disposalBookValue']:,.2f} {currency}",
        f"صافي متحصلات الاستبعاد: {totals['proceeds'] - totals['disposalCosts']:,.2f} {currency}",
        f"الربح / (الخسارة) من الاستبعاد: {totals['gainLoss']:,.2f} {currency}",
    ]
    for row, text in enumerate(insights, 12):
        overview.merge_cells(start_row=row, start_column=4, end_row=row, end_column=9)
        overview.cell(row, 4, text).font = Font(name="Arial", size=10, color=INK)
        overview.cell(row, 4).alignment = Alignment(horizontal="right")
    if report["categories"]:
        cat_start = 18
        overview.cell(cat_start, 2, "أعلى الفئات حسب صافي القيمة الدفترية").font = Font(name="Arial", size=11, bold=True, color=NAVY)
        overview.cell(cat_start + 1, 2, "الفئة").font = Font(name="Arial", bold=True, color=WHITE)
        overview.cell(cat_start + 1, 2).fill = PatternFill("solid", fgColor=NAVY_2)
        overview.cell(cat_start + 1, 3, "صافي القيمة").font = Font(name="Arial", bold=True, color=WHITE)
        overview.cell(cat_start + 1, 3).fill = PatternFill("solid", fgColor=NAVY_2)
        for i, group in enumerate(report["categories"][:8], cat_start + 2):
            group_cell = overview.cell(i, 2, group["group"])
            group_cell.data_type = "s"
            overview.cell(i, 3, group["endingBookValue"])
            overview.cell(i, 3).number_format = '#,##0.00'
        chart = BarChart()
        chart.type = "bar"
        chart.style = 10
        chart.title = "صافي القيمة الدفترية حسب الفئة"
        chart.y_axis.title = "الفئة"
        chart.x_axis.title = currency
        data = Reference(overview, min_col=3, min_row=cat_start + 1, max_row=cat_start + 1 + min(8, len(report["categories"])))
        categories = Reference(overview, min_col=2, min_row=cat_start + 2, max_row=cat_start + 1 + min(8, len(report["categories"])))
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(categories)
        chart.height, chart.width = 8, 15
        if chart.series:
            chart.series[0].graphicalProperties.solidFill = TEAL
        overview.add_chart(chart, "E18")

    # Detailed register
    sheet = workbook.create_sheet("سجل الأصول")
    sheet.sheet_properties.tabColor = NAVY_2
    _style_title(sheet, "سجل الأصول الثابتة", f"{company}  |  العملة: {currency}  |  تقرير حتى {now.isoformat()}", 22)
    headers = ["رمز الأصل", "رمز الحساب", "اسم الأصل", "الفئة", "تاريخ الشراء", "تاريخ بدء الخدمة", "تكلفة الشراء", "تكاليف إضافية", "التكلفة الرأسمالية", "القيمة التخريدية", "العمر الإنتاجي", "طريقة الإهلاك", "قاعدة البدء", "الحالة", "الإدارة", "الموقع", "العهدة", "الرقم التسلسلي", "المورد", "رقم الفاتورة", "مجمع الإهلاك", "صافي القيمة الدفترية", "ملاحظات"]
    rows = []
    for asset in sorted(assets, key=lambda item: (str(item.get("category", "")), str(item.get("name", "")))):
        val = valuation(asset)
        rows.append([asset.get("code"), asset.get("accountCode"), asset.get("name"), asset.get("category"), asset.get("purchaseDate"), asset.get("inServiceDate"), money(asset.get("purchaseCost")), money(asset.get("additionalCosts")), val["totalCost"], money(asset.get("salvageValue")), asset.get("usefulLifeYears"), METHODS.get(asset.get("depreciationMethod"), asset.get("depreciationMethod")), RULE_LABELS.get(asset.get("startDepreciationRule"), "منتصف الشهر (١–١٥)"), STATUSES.get(asset.get("status"), "نشط"), asset.get("department"), asset.get("location"), asset.get("custodian"), asset.get("serialNumber"), asset.get("supplier"), asset.get("invoiceNumber"), val["accumulatedDepreciation"], val["netBookValue"], asset.get("notes")])
    _write_data_table(sheet, headers, rows, header_row=5, currency_columns={7, 8, 9, 10, 21, 22})
    sheet.freeze_panes = "A6"
    if rows:
        sheet.conditional_formatting.add(f"U6:U{5 + len(rows)}", DataBarRule(start_type="min", end_type="max", color=TEAL))

    # Group summaries
    for title, groups, tab_color in (("ملخص الحسابات", report["accounts"], "4C78A8"), ("ملخص الفئات", report["categories"], GOLD), ("ملخص الإدارات", report["departments"], TEAL)):
        grouped = workbook.create_sheet(title)
        grouped.sheet_properties.tabColor = tab_color
        _style_title(grouped, title, f"{company}  |  من 01-01-{now.year} إلى {now.isoformat()}  |  العملة: {currency}", 9)
        headers = ["رمز الحساب / الفئة / الإدارة", "عدد الأصول", "التكلفة الإجمالية", "رصيد أول المدة", "الإضافات", "إهلاك الفترة", "قيمة الاستبعادات", "الربح / (الخسارة)", "صافي القيمة آخر المدة"]
        rows = [[g["group"], g["assetCount"], g["totalCost"], g["openingBookValue"], g["additions"], g["periodExpense"], g["disposalBookValue"], g["gainLoss"], g["endingBookValue"]] for g in groups]
        totals_row = ["الإجمالي", sum(g["assetCount"] for g in groups)] + [sum(float(g[key]) for g in groups) for key in ("totalCost", "openingBookValue", "additions", "periodExpense", "disposalBookValue", "gainLoss", "endingBookValue")]
        _write_data_table(grouped, headers, rows, header_row=5, currency_columns=set(range(3, 10)), total_row=totals_row)
        if rows:
            grouped.conditional_formatting.add(f"F6:F{5 + len(rows)}", DataBarRule(start_type="min", end_type="max", color=GOLD))

    # Annual schedule, including valuation at the moment of export.
    schedule_sheet = workbook.create_sheet("جدول الإهلاك")
    schedule_sheet.sheet_properties.tabColor = "6B86A5"
    _style_title(schedule_sheet, "الجداول السنوية للإهلاك", f"{company}  |  جداول تقديرية بحسب بيانات العمر والطريقة في سجل الأصول  |  العملة: {currency}", 9)
    schedule_headers = ["رمز الأصل", "اسم الأصل", "الفئة", "السنة / الفترة", "القيمة أول المدة", "مصروف الإهلاك", "مجمع الإهلاك", "القيمة آخر المدة", "طريقة الإهلاك"]
    schedule_rows: list[list[Any]] = []
    from aosol_core import depreciation_schedule
    for asset in assets:
        for row in depreciation_schedule(asset):
            schedule_rows.append([asset.get("code"), asset.get("name"), asset.get("category"), row["period"], row["beginning"], row["expense"], row["accumulated"], row["ending"], METHODS.get(asset.get("depreciationMethod"), "")])
    _write_data_table(schedule_sheet, schedule_headers, schedule_rows, header_row=5, currency_columns={5, 6, 7, 8})
    schedule_sheet.freeze_panes = "A6"
    workbook.properties.title = "سجل الأصول الثابتة - Aosol"
    workbook.properties.creator = "Aosol"
    workbook.save(path)


def export_report_workbook(path: str | Path, report: dict[str, Any], company: str, currency: str, report_kind: str = "حركة الأصول للفترة") -> None:
    Workbook, _load, BarChart, Reference, _scale, DataBarRule, Alignment, _Border, Font, PatternFill, _Side, _DV = _openpyxl()
    from openpyxl.utils import get_column_letter
    workbook = Workbook()
    summary = workbook.active
    summary.title = "الملخص التنفيذي"
    summary.sheet_properties.tabColor = TEAL
    _style_title(summary, report_kind, f"{company}  |  الفترة: {report['fromDate']} إلى {report['toDate']}  |  العملة: {currency}  |  أُنشئ: {datetime.now():%Y-%m-%d %H:%M}", 8)
    metrics = [
        ("عدد الأصول", report["totals"]["assetCount"], PALE_BLUE),
        ("الإضافات", report["totals"]["additions"], PALE_TEAL),
        ("مصروف الإهلاك", report["totals"]["periodExpense"], PALE_GOLD),
        ("صافي القيمة آخر المدة", report["totals"]["endingBookValue"], PALE_GREEN),
    ]
    for i, (label, value, color) in enumerate(metrics):
        col = 2 + i * 2
        summary.merge_cells(start_row=5, start_column=col, end_row=5, end_column=col + 1)
        summary.merge_cells(start_row=6, start_column=col, end_row=7, end_column=col + 1)
        summary.cell(5, col, label)
        summary.cell(6, col, value)
        summary.cell(5, col).fill = summary.cell(6, col).fill = PatternFill("solid", fgColor=color)
        summary.cell(5, col).font = Font(name="Arial", bold=True, color=NAVY)
        summary.cell(6, col).font = Font(name="Arial", size=16, bold=True, color=TEAL)
        summary.cell(5, col).alignment = summary.cell(6, col).alignment = Alignment(horizontal="center", vertical="center")
        summary.cell(6, col).number_format = '#,##0.00;[Red](#,##0.00);-'
    total_names = [("رصيد أول المدة", "openingBookValue"), ("قيمة الاستبعادات", "disposalBookValue"), ("متحصلات البيع", "proceeds"), ("تكاليف الاستبعاد", "disposalCosts"), ("الربح / (الخسارة)", "gainLoss")]
    for i, (label, key) in enumerate(total_names, 10):
        summary.cell(i, 2, label).font = Font(name="Arial", bold=True, color=NAVY)
        summary.cell(i, 3, report["totals"][key]).font = Font(name="Arial", color=INK)
        summary.cell(i, 3).number_format = '#,##0.00;[Red](#,##0.00);-'
        summary.cell(i, 3).alignment = Alignment(horizontal="right")
    for i, sheet_name in enumerate(["التفاصيل", "حسب الحساب", "حسب الفئة", "حسب الإدارة", "الاستبعادات"], 10):
        cell = summary.cell(i, 5, sheet_name)
        cell.hyperlink = f"#'{sheet_name}'!A1"
        cell.font = Font(name="Arial", color=TEAL, underline="single")
    for row, note in enumerate(report.get("notes", []), 16):
        summary.merge_cells(start_row=row, start_column=2, end_row=row, end_column=8)
        summary.cell(row, 2, note).fill = PatternFill("solid", fgColor=PALE_GOLD)
        summary.cell(row, 2).font = Font(name="Arial", color="805B10", italic=True)
        summary.cell(row, 2).alignment = Alignment(horizontal="right", wrap_text=True)
    if report.get("categories"):
        start = 19
        summary.cell(start, 2, "مصروف الفترة بحسب الفئة").font = Font(name="Arial", bold=True, color=NAVY)
        summary.cell(start + 1, 2, "الفئة").fill = summary.cell(start + 1, 2).fill = PatternFill("solid", fgColor=NAVY_2)
        summary.cell(start + 1, 3, "مصروف الإهلاك").fill = PatternFill("solid", fgColor=NAVY_2)
        summary.cell(start + 1, 2).font = summary.cell(start + 1, 3).font = Font(name="Arial", bold=True, color=WHITE)
        for r, item in enumerate(report["categories"][:8], start + 2):
            summary.cell(r, 2, item["group"])
            summary.cell(r, 3, item["periodExpense"]).number_format = '#,##0.00'
        chart = BarChart()
        chart.type = "bar"
        chart.style = 10
        chart.title = "مصروف الإهلاك حسب الفئة"
        data = Reference(summary, min_col=3, min_row=start + 1, max_row=start + 1 + min(8, len(report["categories"])))
        cats = Reference(summary, min_col=2, min_row=start + 2, max_row=start + 1 + min(8, len(report["categories"])))
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)
        chart.height, chart.width = 8, 14
        if chart.series:
            chart.series[0].graphicalProperties.solidFill = TEAL
        summary.add_chart(chart, "E19")

    views = [
        ("التفاصيل", "حركة الأصول للفترة", report["details"], "details"),
        ("حسب الحساب", "حسب الحساب", report["accounts"], "accounts"),
        ("حسب الفئة", "حسب التصنيف", report["categories"], "categories"),
        ("حسب الإدارة", "حسب الإدارة", report["departments"], "departments"),
        ("الاستبعادات", "الاستبعادات", report["disposals"], "disposals"),
    ]
    for sheet_name, view_kind, records, key in views:
        sheet = workbook.create_sheet(sheet_name)
        sheet.sheet_properties.tabColor = GOLD if key == "disposals" else NAVY_2
        headers, _rows, view_title = report_view(report, view_kind)
        _style_title(sheet, view_title, f"{company}  |  {report['fromDate']} إلى {report['toDate']}  |  العملة: {currency}", len(headers))
        rows = report_view(report, view_kind)[1]
        currency_cols = set()
        for index, header in enumerate(headers, 1):
            if any(label in header for label in ("قيمة", "تكلفة", "رصيد", "الإضافات", "الإهلاك", "مصروف", "متحصلات", "الربح", "الخسارة")):
                currency_cols.add(index)
        _write_data_table(sheet, headers, rows, header_row=5, currency_columns=currency_cols)
        sheet.freeze_panes = "A6"
        if rows and "مصروف الإهلاك" in headers:
            col = headers.index("مصروف الإهلاك") + 1
            letter = get_column_letter(col)
            sheet.conditional_formatting.add(f"{letter}6:{letter}{5 + len(rows)}", DataBarRule(start_type="min", end_type="max", color=TEAL))
    workbook.properties.title = f"{report_kind} - Aosol"
    workbook.properties.creator = "Aosol"
    workbook.save(path)


def export_report_csv(path: str | Path, report: dict[str, Any], kind: str) -> None:
    headers, rows, _title = report_view(report, kind)
    with open(path, "w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.writer(stream)
        writer.writerow(headers)
        writer.writerows([[safe_spreadsheet_text(value) for value in row] for row in rows])


CUSTOM_DETAIL_FIELDS: list[tuple[str, str]] = [
    ("code", "رمز الأصل"), ("accountCode", "رمز الحساب"), ("name", "اسم الأصل"),
    ("category", "التصنيف"), ("department", "الإدارة"), ("purchaseDate", "تاريخ الشراء"),
    ("inServiceDate", "تاريخ بدء الخدمة"), ("totalCost", "التكلفة الإجمالية"),
    ("openingBookValue", "رصيد أول المدة"), ("additions", "الإضافات"),
    ("periodExpense", "إهلاك الفترة"), ("accumulatedDepreciation", "مجمع الإهلاك"),
    ("disposalBookValue", "القيمة الدفترية المستبعدة"), ("proceeds", "متحصلات الاستبعاد"),
    ("disposalCosts", "تكاليف الاستبعاد"), ("gainLoss", "الربح / (الخسارة)"),
    ("endingBookValue", "صافي القيمة آخر المدة"), ("salvageValue", "القيمة التخريدية"),
    ("usefulLifeYears", "العمر الإنتاجي (سنة)"), ("methodLabel", "طريقة الإهلاك"),
    ("statusLabel", "الحالة"), ("location", "الموقع"), ("custodian", "العهدة / المسؤول"),
    ("serialNumber", "الرقم التسلسلي"), ("supplier", "المورد"), ("invoiceNumber", "رقم الفاتورة"),
    ("expenseNote", "ملاحظة الإهلاك"),
]
CUSTOM_MONEY_FIELDS = {
    "totalCost", "openingBookValue", "additions", "periodExpense", "accumulatedDepreciation",
    "disposalBookValue", "proceeds", "disposalCosts", "gainLoss", "endingBookValue", "salvageValue",
}
GROUP_METRICS = [
    ("assetCount", "عدد الأصول"), ("totalCost", "التكلفة الإجمالية"),
    ("openingBookValue", "رصيد أول المدة"), ("additions", "الإضافات"),
    ("periodExpense", "إهلاك الفترة"), ("accumulatedDepreciation", "مجمع الإهلاك"),
    ("disposalBookValue", "القيمة الدفترية المستبعدة"), ("proceeds", "متحصلات الاستبعاد"),
    ("disposalCosts", "تكاليف الاستبعاد"), ("gainLoss", "الربح / (الخسارة)"),
    ("endingBookValue", "صافي القيمة آخر المدة"),
]


def export_custom_period_workbook(
    path: str | Path,
    assets: list[dict[str, Any]],
    company: str,
    currency: str,
    from_date: str | date,
    to_date: str | date,
    *,
    granularity: str = "شهري",
    selected_codes: set[str] | None = None,
    columns: list[str] | None = None,
    include_overall: bool = True,
    include_periods: bool = True,
    include_details: bool = True,
    include_accounts: bool = True,
    include_categories: bool = True,
    include_departments: bool = True,
    include_detail_total: bool = True,
    orientation: str = "landscape",
    filters: dict[str, str] | None = None,
) -> None:
    """Create a customizable, Arabic RTL A4 workbook for monthly/yearly/custom ranges."""
    Workbook, _load, _chart, _ref, _scale, _bars, Alignment, _Border, Font, PatternFill, _Side, _DV = _openpyxl()
    start = from_date if isinstance(from_date, date) else date.fromisoformat(str(from_date)[:10])
    end = to_date if isinstance(to_date, date) else date.fromisoformat(str(to_date)[:10])
    ranges = period_ranges(start, end, granularity)
    filters = filters or {}
    selected = set(selected_codes or ())
    scoped_assets = [asset for asset in assets if not selected or str(asset.get("code", "")) in selected]
    if not scoped_assets:
        raise ValueError("اختر أصلًا واحدًا على الأقل للتقرير.")
    chosen_columns = list(columns or [key for key, _label in CUSTOM_DETAIL_FIELDS])
    field_labels = dict(CUSTOM_DETAIL_FIELDS)
    chosen_columns = [key for key in chosen_columns if key in field_labels]
    if include_details and not chosen_columns:
        raise ValueError("اختر عمودًا واحدًا على الأقل لتفاصيل الأصول.")
    if not any((include_overall, include_periods, include_details, include_accounts, include_categories, include_departments)):
        raise ValueError("اختر قسمًا واحدًا على الأقل لإضافته إلى المصنف.")
    if orientation not in ("landscape", "portrait"):
        raise ValueError("اتجاه الصفحة غير صالح.")

    def build(period_start: date, period_end: date) -> dict[str, Any]:
        return build_asset_report(
            scoped_assets, period_start, period_end,
            category=filters.get("category", "الكل"),
            department=filters.get("department", "الكل"),
            status=filters.get("status", "الكل"),
            query=filters.get("query", ""),
        )

    overall = build(start, end)
    if not overall["details"]:
        raise ValueError("لا توجد أصول تطابق الفترة والمرشحات والصفوف التي اخترتها.")
    period_reports = [(label, pstart, pend, build(pstart, pend)) for label, pstart, pend in ranges]
    workbook = Workbook()
    workbook.remove(workbook.active)
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    subtitle = f"{company}  |  {start.isoformat()} إلى {end.isoformat()}  |  العملة: {currency}  |  أُنشئ: {generated}"

    def configure_sheet(sheet: Any, title: str, column_count: int) -> None:
        _style_title(sheet, title, subtitle, max(2, column_count))
        sheet.page_setup.orientation = orientation
        sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
        sheet.page_setup.fitToWidth = 1
        sheet.page_setup.fitToHeight = 0
        sheet.sheet_properties.pageSetUpPr.fitToPage = True
        sheet.print_title_rows = "5:5"
        sheet.sheet_view.rightToLeft = True

    if include_overall:
        sheet = workbook.create_sheet("الملخص العام")
        sheet.sheet_properties.tabColor = TEAL
        configure_sheet(sheet, "ملخص التقرير العام", 2)
        totals = overall["totals"]
        summary_fields = [
            ("عدد الأصول المشمولة", "assetCount", False), ("التكلفة الإجمالية", "totalCost", True),
            ("رصيد أول المدة", "openingBookValue", True), ("الإضافات الرأسمالية", "additions", True),
            ("مصروف الإهلاك للفترة", "periodExpense", True), ("مجمع الإهلاك آخر المدة", "accumulatedDepreciation", True),
            ("القيمة الدفترية المستبعدة", "disposalBookValue", True), ("متحصلات الاستبعاد", "proceeds", True),
            ("تكاليف الاستبعاد", "disposalCosts", True), ("الربح / (الخسارة)", "gainLoss", True),
            ("صافي القيمة آخر المدة", "endingBookValue", True),
        ]
        rows = [[label, totals[key]] for label, key, _is_money in summary_fields]
        _write_data_table(sheet, ["المؤشر", "القيمة"], rows, header_row=5, currency_columns={2})
        sheet.column_dimensions["B"].width = 34
        sheet.column_dimensions["C"].width = 24
        sheet["B18"] = f"التقسيم: {granularity}  |  تم تطبيق مرشحات الفئة والإدارة والحالة والبحث المحددة في مركز التقارير."
        sheet["B18"].font = Font(name="Arial", size=9, color=MUTED, italic=True)
        sheet["B18"].alignment = Alignment(horizontal="right", wrap_text=True)
        sheet.merge_cells("B18:C19")
        if overall.get("notes"):
            sheet.merge_cells("B21:C22")
            sheet["B21"] = "تنبيه: " + " | ".join(overall["notes"])
            sheet["B21"].fill = PatternFill("solid", fgColor=PALE_GOLD)
            sheet["B21"].alignment = Alignment(horizontal="right", wrap_text=True, vertical="center")

    if include_periods:
        sheet = workbook.create_sheet("ملخص الفترات")
        sheet.sheet_properties.tabColor = GOLD
        headers = ["الفترة", "من تاريخ", "إلى تاريخ", "عدد الأصول", "التكلفة الإجمالية", "رصيد أول المدة", "الإضافات", "إهلاك الفترة", "القيمة المستبعدة", "المتحصلات", "تكاليف الاستبعاد", "الربح / (الخسارة)", "رصيد آخر المدة"]
        configure_sheet(sheet, f"التقرير {granularity}", len(headers))
        rows = []
        for label, period_start, period_end, report in period_reports:
            t = report["totals"]
            rows.append([label, period_start.isoformat(), period_end.isoformat(), t["assetCount"], t["totalCost"], t["openingBookValue"], t["additions"], t["periodExpense"], t["disposalBookValue"], t["proceeds"], t["disposalCosts"], t["gainLoss"], t["endingBookValue"]])
        flows = {"additions": 0.0, "periodExpense": 0.0, "disposalBookValue": 0.0, "proceeds": 0.0, "disposalCosts": 0.0, "gainLoss": 0.0}
        for _label, _period_start, _period_end, report in period_reports:
            for key in flows:
                flows[key] += float(report["totals"][key])
        total_row = ["مجموع الحركات*", "", "", "", "", "", flows["additions"], flows["periodExpense"], flows["disposalBookValue"], flows["proceeds"], flows["disposalCosts"], flows["gainLoss"], ""] if include_detail_total else None
        money_cols = set(range(5, 14))
        _write_data_table(sheet, headers, rows, header_row=5, currency_columns=money_cols, total_row=total_row)
        note_row = 8 + len(rows)
        sheet.cell(note_row, 1, "* إجمالي الحركات يجمع التدفقات فقط. التكلفة الإجمالية وأرصدة أول/آخر المدة أرقام رصيدية، وليست قابلة للجمع عبر الشهور/السنوات.")
        sheet.cell(note_row, 1).font = Font(name="Arial", size=9, italic=True, color=MUTED)
        sheet.cell(note_row, 1).alignment = Alignment(horizontal="right", wrap_text=True)
        sheet.merge_cells(start_row=note_row, start_column=1, end_row=note_row, end_column=len(headers))

    if include_details:
        sheet = workbook.create_sheet("تفاصيل الأصول")
        sheet.sheet_properties.tabColor = NAVY_2
        headers = [field_labels[key] for key in chosen_columns]
        configure_sheet(sheet, "تفاصيل الأصول / الحسابات", len(headers))
        selected_rows = overall["details"]
        rows = [[row.get(key, "") for key in chosen_columns] for row in selected_rows]
        total_row = None
        if include_detail_total:
            label_index = next((index for index, key in enumerate(chosen_columns) if key not in CUSTOM_MONEY_FIELDS and key != "usefulLifeYears"), None)
            total_row = [
                sum(float(row.get(key, 0) or 0) for row in selected_rows) if key in CUSTOM_MONEY_FIELDS
                else "الإجمالي العام" if index == label_index
                else ""
                for index, key in enumerate(chosen_columns)
            ]
        currency_cols = {index for index, key in enumerate(chosen_columns, 1) if key in CUSTOM_MONEY_FIELDS}
        _write_data_table(sheet, headers, rows, header_row=5, currency_columns=currency_cols, total_row=total_row)

    def add_group_sheet(title: str, group_label: str, groups: list[dict[str, Any]], tab_color: str) -> None:
        sheet = workbook.create_sheet(title)
        sheet.sheet_properties.tabColor = tab_color
        headers = [group_label] + [label for _key, label in GROUP_METRICS]
        configure_sheet(sheet, title, len(headers))
        rows = [[group["group"]] + [group.get(key, 0) for key, _label in GROUP_METRICS] for group in groups]
        totals = overall["totals"]
        total_row = ["الإجمالي العام"] + [totals.get(key, 0) for key, _label in GROUP_METRICS] if include_detail_total else None
        _write_data_table(sheet, headers, rows, header_row=5, currency_columns=set(range(3, len(headers) + 1)), total_row=total_row)

    if include_accounts:
        add_group_sheet("حسب الحساب", "رمز الحساب", overall["accounts"], "4C78A8")
    if include_categories:
        add_group_sheet("حسب التصنيف", "التصنيف", overall["categories"], GOLD)
    if include_departments:
        add_group_sheet("حسب الإدارة", "الإدارة", overall["departments"], TEAL)

    workbook.properties.title = f"تقرير أصول {granularity} - Aosol"
    workbook.properties.subject = f"{start.isoformat()} — {end.isoformat()}"
    workbook.properties.creator = "Aosol"
    workbook.save(path)
