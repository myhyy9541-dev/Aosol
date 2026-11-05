import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

from aosol_config import copy_database_to_directory, load_app_preferences, save_app_preferences, write_backup_snapshot
from aosol_core import AssetStore
from aosol_excel import export_custom_period_workbook
from aosol_reports import build_asset_report, period_ranges


def asset(code="AST-001", account="1500", department="الإدارة العامة", purchase="2024-01-01"):
    return {
        "id": code, "code": code, "accountCode": account, "name": f"أصل {code}",
        "category": "المباني والإنشاءات", "purchaseDate": purchase, "inServiceDate": purchase,
        "purchaseCost": 12000, "additionalCosts": 0, "salvageValue": 2000,
        "usefulLifeYears": 5, "depreciationMethod": "straight_line",
        "startDepreciationRule": "same_month", "status": "active", "department": department,
    }


class CustomPeriodReportTests(unittest.TestCase):
    def test_month_and_year_ranges_are_inclusive_and_respect_partial_edges(self):
        monthly = period_ranges(date(2024, 11, 15), date(2025, 2, 10), "شهري")
        self.assertEqual([row[0] for row in monthly], ["2024-11", "2024-12", "2025-01", "2025-02"])
        self.assertEqual(monthly[0][1:], (date(2024, 11, 15), date(2024, 11, 30)))
        self.assertEqual(monthly[-1][1:], (date(2025, 2, 1), date(2025, 2, 10)))
        yearly = period_ranges(date(2024, 11, 15), date(2026, 2, 10), "سنوي")
        self.assertEqual([row[0] for row in yearly], ["2024", "2025", "2026"])
        self.assertEqual(yearly[0][1], date(2024, 11, 15))
        self.assertEqual(yearly[-1][2], date(2026, 2, 10))

    def test_report_groups_by_account_and_preserves_account_code(self):
        report = build_asset_report(
            [asset("AST-001", "1500"), asset("AST-002", "1500", "إدارة المبيعات"), asset("AST-003", "1600")],
            date(2025, 1, 1), date(2025, 12, 31),
        )
        groups = {row["group"]: row for row in report["accounts"]}
        self.assertEqual(groups["1500"]["assetCount"], 2)
        self.assertEqual(groups["1600"]["assetCount"], 1)
        self.assertEqual(report["details"][0]["accountCode"], "1500")

    def test_custom_workbook_obeys_selected_rows_columns_totals_and_page_setup(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "custom.xlsx"
            export_custom_period_workbook(
                path, [asset("AST-001", "1500"), asset("AST-002", "1600")],
                "شركة الاختبار", "ريال يمني", date(2025, 1, 1), date(2025, 3, 31),
                granularity="شهري", selected_codes={"AST-001"},
                columns=["code", "accountCode", "totalCost", "periodExpense"],
                orientation="portrait",
            )
            workbook = load_workbook(path, data_only=False)
            self.assertEqual(workbook.sheetnames, ["الملخص العام", "ملخص الفترات", "تفاصيل الأصول", "حسب الحساب", "حسب التصنيف", "حسب الإدارة"])
            for sheet in workbook.worksheets:
                self.assertTrue(sheet.sheet_view.rightToLeft)
                self.assertEqual(sheet.page_setup.paperSize, 9)
                self.assertEqual(sheet.page_setup.orientation, "portrait")
            detail = workbook["تفاصيل الأصول"]
            self.assertEqual([detail.cell(5, col).value for col in range(1, 5)], ["رمز الأصل", "رمز الحساب", "التكلفة الإجمالية", "إهلاك الفترة"])
            self.assertEqual(detail.cell(6, 1).value, "AST-001")
            self.assertEqual(detail.cell(7, 1).value, "الإجمالي العام")
            self.assertEqual(workbook["ملخص الفترات"].max_row, 11)
            account = workbook["حسب الحساب"]
            self.assertEqual(account.cell(6, 1).value, "1500")
            self.assertEqual(account.cell(7, 1).value, "الإجمالي العام")

    def test_periodic_summary_can_be_created_without_optional_sheets(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "periods.xlsx"
            export_custom_period_workbook(
                path, [asset()], "شركة", "ريال", date(2025, 1, 1), date(2025, 2, 28),
                granularity="شهري", include_overall=False, include_details=False,
                include_accounts=False, include_categories=False, include_departments=False,
            )
            workbook = load_workbook(path)
            self.assertEqual(workbook.sheetnames, ["ملخص الفترات"])
            sheet = workbook["ملخص الفترات"]
            self.assertEqual(sheet.cell(6, 1).value, "2025-01")
            self.assertEqual(sheet.cell(7, 1).value, "2025-02")


class LocalPreferencesAndBackupTests(unittest.TestCase):
    def test_preferences_are_saved_atomically_and_loaded(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "prefs.json"
            saved = {"data_directory": "D:/AosolData", "auto_backup_enabled": True, "auto_backup_interval_days": 14}
            save_app_preferences(saved, path)
            self.assertEqual(load_app_preferences(path), saved)
            self.assertFalse(path.with_name(path.name + ".tmp").exists())

    def test_database_copy_is_consistent_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = AssetStore(root / "source" / "aosol.db")
            source.save(asset())
            target_db = copy_database_to_directory(source.conn, root / "target")
            copied = AssetStore(target_db)
            self.assertEqual([item["code"] for item in copied.all()], ["AST-001"])
            with self.assertRaises(FileExistsError):
                copy_database_to_directory(source.conn, root / "target")
            copied.close()
            source.close()

    def test_automatic_backup_snapshot_is_readable(self):
        with tempfile.TemporaryDirectory() as folder:
            path = write_backup_snapshot({"app": "Aosol", "assets": [asset()]}, folder, automatic=True)
            self.assertTrue(path.name.startswith("Aosol_auto_"))
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["assets"][0]["code"], "AST-001")


if __name__ == "__main__":
    unittest.main()
