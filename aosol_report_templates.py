"""Pure helpers for report date ranges and saved custom-report templates."""
from __future__ import annotations

import calendar
import json
from datetime import date
from typing import Any, Mapping


TEMPLATE_SETTING_KEY = "report_templates"
GRANULARITIES = ("شهري", "سنوي", "الفترة كاملة", "مخصص")
ORIENTATIONS = ("landscape", "portrait")
DATE_MODES = ("monthly", "yearly", "custom")
SECTION_KEYS = (
    "include_overall", "include_periods", "include_details", "include_accounts",
    "include_categories", "include_departments",
)


def period_bounds(mode: str, year: int, month: int | None = None) -> tuple[date, date]:
    """Return inclusive calendar boundaries for a month or year."""
    if isinstance(year, bool) or not isinstance(year, int) or not 1 <= year <= 9999:
        raise ValueError("السنة يجب أن تكون بين 1 و9999.")
    if mode == "monthly":
        if isinstance(month, bool) or not isinstance(month, int) or not 1 <= month <= 12:
            raise ValueError("الشهر يجب أن يكون بين 1 و12.")
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, 1), date(year, month, last_day)
    if mode == "yearly":
        return date(year, 1, 1), date(year, 12, 31)
    raise ValueError("نوع الفترة السريعة غير معروف.")


def validate_report_template(value: Any, valid_columns: set[str] | None = None) -> dict[str, Any] | None:
    """Validate and normalize one saved template; return None for unsafe data."""
    if not isinstance(value, Mapping):
        return None
    granularity = value.get("granularity", "شهري")
    orientation = value.get("orientation", "landscape")
    date_mode = value.get("date_mode", "custom")
    if granularity not in GRANULARITIES or orientation not in ORIENTATIONS or date_mode not in DATE_MODES:
        return None

    sections_raw = value.get("sections", {})
    if not isinstance(sections_raw, Mapping):
        return None
    if any(key in sections_raw and not isinstance(sections_raw[key], bool) for key in SECTION_KEYS):
        return None
    sections = {key: sections_raw.get(key, False) for key in SECTION_KEYS}
    total = value.get("include_detail_total", True)
    if not isinstance(total, bool):
        return None

    columns_raw = value.get("columns", [])
    if not isinstance(columns_raw, (list, tuple)) or any(not isinstance(key, str) for key in columns_raw):
        return None
    columns = list(dict.fromkeys(columns_raw))
    if valid_columns is not None:
        columns = [key for key in columns if key in valid_columns]

    year = value.get("year")
    month = value.get("month")
    try:
        start_raw, end_raw = value.get("from_date"), value.get("to_date")
        start = date.fromisoformat(start_raw) if isinstance(start_raw, str) else None
        end = date.fromisoformat(end_raw) if isinstance(end_raw, str) else None
    except (TypeError, ValueError):
        return None
    if start is None or end is None or start > end:
        return None
    if isinstance(year, bool) or not isinstance(year, int) or not 1 <= year <= 9999:
        return None
    if month is not None and (isinstance(month, bool) or not isinstance(month, int) or not 1 <= month <= 12):
        return None
    if date_mode == "monthly" and month is None:
        return None
    return {
        "granularity": granularity,
        "orientation": orientation,
        "sections": sections,
        "include_detail_total": total,
        "columns": columns,
        "date_mode": date_mode,
        "year": year,
        "month": month,
        "from_date": start.isoformat(),
        "to_date": end.isoformat(),
    }


def decode_report_templates(raw: str | None, valid_columns: set[str] | None = None) -> dict[str, dict[str, Any]]:
    """Parse stored JSON defensively, skipping malformed names and templates."""
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for name, item in parsed.items():
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
            continue
        clean = validate_report_template(item, valid_columns)
        if clean is not None:
            result[name.strip()] = clean
    return result


def encode_report_templates(templates: Mapping[str, Any], valid_columns: set[str] | None = None) -> str:
    """Serialize only valid named templates as stable Unicode JSON."""
    clean: dict[str, dict[str, Any]] = {}
    for name, item in templates.items():
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
            continue
        normalized = validate_report_template(item, valid_columns)
        if normalized is not None:
            clean[name.strip()] = normalized
    return json.dumps(clean, ensure_ascii=False, sort_keys=True)


def upsert_report_template(
    raw: str | None, name: str, template: Mapping[str, Any], valid_columns: set[str] | None = None,
) -> str:
    """Return updated JSON containing the named template."""
    clean_name = name.strip() if isinstance(name, str) else ""
    if not clean_name or len(clean_name) > 80:
        raise ValueError("أدخل اسمًا من حرف إلى 80 حرفًا للقالب.")
    normalized = validate_report_template(template, valid_columns)
    if normalized is None:
        raise ValueError("إعدادات القالب غير صالحة.")
    templates = decode_report_templates(raw, valid_columns)
    templates[clean_name] = normalized
    return encode_report_templates(templates, valid_columns)


def remove_report_template(raw: str | None, name: str, valid_columns: set[str] | None = None) -> str:
    """Return updated JSON without the named template."""
    templates = decode_report_templates(raw, valid_columns)
    templates.pop(name, None)
    return encode_report_templates(templates, valid_columns)
