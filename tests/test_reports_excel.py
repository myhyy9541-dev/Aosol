import csv
import tempfile
import unittest
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

from aosol_core import AssetStore, valuation
from aosol_excel import TEMPLATE_COLUMNS, export_assets_workbook, export_import_template, export_report_csv, export_report_workbook, parse_import_file
from aosol_reports import build_asset_report, report_view


def sample(**updates):
    asset = {
        "id": "asset-1", "code": "AST-001", "name": "أصل اختباري", "category": "المباني والإنشاءات",
        "purchaseDate": "2024-01-01", "inServiceDate": "2024-01-01", "purchaseCost": 12000,
        "additionalCosts": 0, "salvageValue": 2000, "usefulLifeYears": 5,
        "depreciationMethod": "straight_line", "startDepreciationRule": "mid_month_15",
        "status": "active", "department": "الإدارة العامة", "location": "المقر", "custodian": "مسؤول",
    }
    asset.update(updates)
    return asset


class PeriodReportTests(unittest.TestCase):
    def test_monthly_valuation_accrues_month_by_month(self):
        asset = sample()
        jan = valuation(asset, date(2024, 1, 31))
        dec = valuation(asset, date(2024, 12, 31))
        self.assertAlmostEqual(jan["accumulatedDepreciation"], 2000 / 12, places=2)
        self.assertAlmostEqual(dec["accumulatedDepreciation"], 2000, places=2)

    def test_period_report_reconciles_straight_line_movement(self):
        report = build_asset_report([sample()], date(2025, 1, 1), date(2025, 12, 31))
        row = report["details"][0]
        self.assertAlmostEqual(row["openingBookValue"], 10000, places=2)
        self.assertAlmostEqual(row["periodExpense"], 2000, places=2)
        self.assertAlmostEqual(row["endingBookValue"], 8000, places=2)
        self.assertEqual(report["totals"]["assetCount"], 1)
        self.assertEqual(report["categories"][0]["group"], "المباني والإنشاءات")

    def test_historical_disposal_is_reported_at_disposal_date(self):
        asset = sample()
        at_disposal = valuation(asset, date(2025, 6, 30))
        asset["status"] = "disposed"
        asset["disposal"] = {
            "disposalDate": "2025-06-30", "bookValueAtDisposal": at_disposal["netBookValue"],
            "accumulatedAtDisposal": at_disposal["accumulatedDepreciation"], "salePrice": 9500,
            "disposalCosts": 100, "gainLoss": 9500 - 100 - at_disposal["netBookValue"], "disposalType": "sale",
        }
        report = build_asset_report([asset], date(2025, 1, 1), date(2025, 12, 31))
        self.assertEqual(report["totals"]["disposedCount"], 1)
        self.assertAlmostEqual(report["details"][0]["periodExpense"], 1000, places=2)
        self.assertAlmostEqual(report["details"][0]["endingBookValue"], 0, places=2)
        self.assertAlmostEqual(report["disposals"][0]["bookValue"], at_disposal["netBookValue"], places=2)
        self.assertEqual(report_view(report, "الاستبعادات")[0][0], "تاريخ الاستبعاد")

    def test_units_of_production_report_discloses_missing_period_history(self):
        asset = sample(depreciationMethod="units_of_production", totalEstimatedUnits=1000, producedUnitsToDate=200)
        report = build_asset_report([asset], date(2025, 1, 1), date(2025, 12, 31))
        self.assertEqual(report["details"][0]["periodExpense"], 0)
        self.assertTrue(report["notes"])
        self.assertEqual(report["totals"]["unitMethodCount"], 1)


class ExcelImportExportTests(unittest.TestCase):
    def _write_template_row(self, sheet, row_number, values):
        for col, (key, _header, _kind) in enumerate(TEMPLATE_COLUMNS, start=1):
            sheet.cell(row_number, col, values.get(key))

    def _valid_values(self, **updates):
        values = {
            "code": "AST-NEW", "accountCode": "1500", "name": "أصل مستورد", "category": "المباني والإنشاءات",
            "purchaseDate": "2024-01-01", "inServiceDate": "2024-01-01", "purchaseCost": 12000,
            "additionalCosts": 100, "salvageValue": 2000, "usefulLifeYears": 5,
            "depreciationMethod": "القسط الثابت", "startDepreciationRule": "منتصف الشهر (١–١٥)", "status": "نشط",
            "department": "الإدارة العامة", "location": "المقر", "custodian": "مسؤول",
        }
        values.update(updates)
        return values

    def test_template_is_rtl_validated_and_importable_with_row_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "template.xlsx"
            export_import_template(path)
            workbook = load_workbook(path)
            sheet = workbook["قالب الأصول"]
            self.assertTrue(sheet.sheet_view.rightToLeft)
            self.assertGreaterEqual(len(sheet.data_validations.dataValidation), 10)
            self._write_template_row(sheet, 2, self._valid_values())
            self._write_template_row(sheet, 3, self._valid_values(name="مكرر"))
            self._write_template_row(sheet, 4, self._valid_values(code="AST-BAD", purchaseCost=-2))
            workbook.save(path)

            batch = parse_import_file(path)
            self.assertEqual(batch["validCount"], 1)
            self.assertEqual(batch["issueCount"], 2)
            self.assertEqual(batch["duplicateCount"], 1)
            self.assertEqual(batch["assets"][0]["purchaseCost"], 12000)
            self.assertEqual(batch["assets"][0]["department"], "الإدارة العامة")
            self.assertEqual(batch["assets"][0]["accountCode"], "1500")

    def test_disposed_asset_import_restores_disposal_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "template.xlsx"
            export_import_template(path)
            workbook = load_workbook(path)
            self._write_template_row(workbook["قالب الأصول"], 2, self._valid_values(
                status="مستبعد", disposalDate="2025-06-30", disposalType="بيع", salePrice=9000,
                disposalCosts=100, bookValueAtDisposal=8500, accumulatedAtDisposal=3600, buyerName="شركة",
            ))
            workbook.save(path)
            batch = parse_import_file(path)
            self.assertEqual(batch["validCount"], 1, batch["issues"])
            self.assertEqual(batch["assets"][0]["disposal"]["disposalDate"], "2025-06-30")
            self.assertAlmostEqual(batch["assets"][0]["disposal"]["gainLoss"], 400)

    def test_asset_and_period_workbooks_have_rtl_summaries_and_details(self):
        asset = sample()
        report = build_asset_report([asset], date(2025, 1, 1), date(2025, 12, 31))
        with tempfile.TemporaryDirectory() as directory:
            register_path = Path(directory) / "register.xlsx"
            report_path = Path(directory) / "report.xlsx"
            export_assets_workbook(register_path, [asset], "شركة الاختبار", "ريال يمني")
            export_report_workbook(report_path, report, "شركة الاختبار", "ريال يمني")
            register = load_workbook(register_path)
            period = load_workbook(report_path)
            self.assertEqual(len(register.sheetnames), 6)
            self.assertTrue(all(register[s].sheet_view.rightToLeft for s in register.sheetnames))
            self.assertIn("ملخص الفئات", register.sheetnames)
            self.assertEqual(len(period.sheetnames), 6)
            self.assertTrue(all(period[s].sheet_view.rightToLeft for s in period.sheetnames))
            self.assertEqual(period["التفاصيل"].cell(6, 3).value, "أصل اختباري")
            self.assertTrue(period["الملخص التنفيذي"]._charts)

    def test_formula_like_asset_text_is_plain_text_in_all_report_exports(self):
        payload = '=HYPERLINK("https://example.invalid", "open")'
        asset = sample(name=payload, category="@SUM(1,1)")
        report = build_asset_report([asset], date(2025, 1, 1), date(2025, 12, 31))
        with tempfile.TemporaryDirectory() as directory:
            register_path = Path(directory) / "register.xlsx"
            period_path = Path(directory) / "report.xlsx"
            csv_path = Path(directory) / "report.csv"
            export_assets_workbook(register_path, [asset], "شركة الاختبار", "ريال يمني")
            export_report_workbook(period_path, report, "شركة الاختبار", "ريال يمني")
            export_report_csv(csv_path, report, "حركة الأصول للفترة")

            register = load_workbook(register_path, data_only=False)
            details = register["سجل الأصول"]
            self.assertEqual(details["C6"].value, payload)
            self.assertEqual(details["C6"].data_type, "s")
            self.assertEqual(details["C6"].data_type, "s")
            self.assertEqual(register["نظرة عامة"]["B20"].value, "@SUM(1,1)")
            self.assertEqual(register["نظرة عامة"]["B20"].data_type, "s")

            period = load_workbook(period_path, data_only=False)
            self.assertEqual(period["التفاصيل"]["C6"].value, payload)
            self.assertEqual(period["التفاصيل"]["C6"].data_type, "s")
            with csv_path.open(encoding="utf-8-sig", newline="") as stream:
                rows = list(csv.reader(stream))
            self.assertEqual(rows[1][2], "'" + payload)

    def test_save_many_rolls_back_every_asset_on_duplicate_code(self):
        with tempfile.TemporaryDirectory() as directory:
            store = AssetStore(Path(directory) / "store.db")
            store.save(sample())
            with self.assertRaises(Exception):
                store.save_many([sample(id="new-id", code="AST-002"), sample(id="dup-id", code="AST-001")])
            self.assertEqual({item["code"] for item in store.all()}, {"AST-001"})
            store.close()

    def test_backup_restore_preserves_company_legal_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            source = AssetStore(Path(directory) / "source.db")
            source.set_setting("company_name", "شركة اختبار")
            source.set_setting("commercial_reg", "CR-2048")
            source.set_setting("tax_number", "TAX-9911")
            source.set_setting("currency", "ريال سعودي")
            backup = source.backup_data()
            target = AssetStore(Path(directory) / "target.db")
            target.restore(backup, replace=True)
            self.assertEqual(target.get_setting("company_name"), "شركة اختبار")
            self.assertEqual(target.get_setting("commercial_reg"), "CR-2048")
            self.assertEqual(target.get_setting("tax_number"), "TAX-9911")
            self.assertEqual(target.get_setting("currency"), "ريال سعودي")
            source.close()
            target.close()


if __name__ == "__main__":
    unittest.main()
