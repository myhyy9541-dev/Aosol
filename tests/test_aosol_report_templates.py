import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from aosol_report_templates import (
    decode_report_templates,
    encode_report_templates,
    period_bounds,
    remove_report_template,
    upsert_report_template,
)
from aosol_core import AssetStore


class ReportPeriodHelperTests(unittest.TestCase):
    def test_month_bounds_include_leap_day(self):
        self.assertEqual(period_bounds("monthly", 2024, 2), (date(2024, 2, 1), date(2024, 2, 29)))
        self.assertEqual(period_bounds("monthly", 2025, 2), (date(2025, 2, 1), date(2025, 2, 28)))

    def test_month_and_year_end_dates(self):
        self.assertEqual(period_bounds("monthly", 2026, 4), (date(2026, 4, 1), date(2026, 4, 30)))
        self.assertEqual(period_bounds("yearly", 2024), (date(2024, 1, 1), date(2024, 12, 31)))

    def test_invalid_quick_period_is_rejected(self):
        for args in (("monthly", 2024, 0), ("monthly", 2024, 13), ("yearly", 0, None), ("custom", 2024, None)):
            with self.subTest(args=args), self.assertRaises(ValueError):
                period_bounds(*args)


class SavedReportTemplateTests(unittest.TestCase):
    def template(self):
        return {
            "granularity": "شهري",
            "orientation": "portrait",
            "sections": {
                "include_overall": True,
                "include_periods": False,
                "include_details": True,
                "include_accounts": False,
                "include_categories": True,
                "include_departments": False,
            },
            "include_detail_total": False,
            "columns": ["code", "name", "periodExpense"],
            "date_mode": "monthly",
            "year": 2024,
            "month": 2,
            "from_date": "2024-02-01",
            "to_date": "2024-02-29",
        }

    def test_named_template_round_trip_and_delete(self):
        allowed = {"code", "name", "periodExpense"}
        raw = upsert_report_template(None, "إقفال فبراير", self.template(), allowed)
        restored = decode_report_templates(raw, allowed)
        self.assertEqual(restored["إقفال فبراير"], self.template())
        self.assertEqual(decode_report_templates(encode_report_templates(restored, allowed), allowed), restored)
        without = decode_report_templates(remove_report_template(raw, "إقفال فبراير", allowed), allowed)
        self.assertEqual(without, {})

    def test_malformed_storage_and_invalid_entries_are_ignored(self):
        self.assertEqual(decode_report_templates("not-json"), {})
        malformed = {
            "bad-date": {**self.template(), "to_date": "yesterday"},
            "bad-flag": {**self.template(), "sections": {"include_overall": "false"}},
            "bad-range": {**self.template(), "from_date": "2024-03-01"},
            "valid": self.template(),
        }
        restored = decode_report_templates(json.dumps(malformed), {"code", "name"})
        self.assertEqual(list(restored), ["valid"])
        self.assertEqual(restored["valid"]["columns"], ["code", "name"])

    def test_missing_template_json_is_an_empty_catalog_and_bad_name_is_rejected(self):
        self.assertEqual(decode_report_templates(None), {})
        with self.assertRaises(ValueError):
            upsert_report_template("{}", "   ", self.template())

    def test_report_templates_are_included_in_backup_and_restored(self):
        raw = upsert_report_template(None, "تقرير الإدارة", self.template())
        with tempfile.TemporaryDirectory() as folder:
            source = AssetStore(Path(folder) / "source.db")
            source.set_setting("report_templates", raw)
            backup = source.backup_data()
            source.close()
            target = AssetStore(Path(folder) / "target.db")
            target.restore(backup, replace=True)
            self.assertEqual(target.get_setting("report_templates"), raw)
            target.close()


if __name__ == "__main__":
    unittest.main()
