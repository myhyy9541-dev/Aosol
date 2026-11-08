import csv
import tempfile
import unittest
from datetime import date
from pathlib import Path

from aosol_core import AssetStore, depreciation_schedule, effective_start, export_csv, export_xlsx, valuation


def sample(method="straight_line"):
    return {
        "id": "test-asset", "code": "AST-TEST", "name": "أصل للاختبار", "category": "المباني والإنشاءات",
        "purchaseDate": "2024-01-01", "inServiceDate": "2024-01-01", "purchaseCost": 12000,
        "additionalCosts": 0, "salvageValue": 2000, "usefulLifeYears": 5,
        "depreciationMethod": method, "startDepreciationRule": "mid_month_15", "status": "active",
    }


class DepreciationTests(unittest.TestCase):
    def test_straight_line_total_matches_depreciable_base(self):
        asset = sample()
        schedule = depreciation_schedule(asset)
        self.assertEqual(len(schedule), 5)
        self.assertAlmostEqual(sum(row["expense"] for row in schedule), 10000, places=2)
        self.assertAlmostEqual(schedule[-1]["ending"], 2000, places=2)

    def test_rate_schedule_uses_capitalized_cost_basis_partial_first_year_and_final_settlement(self):
        asset = sample()
        asset.update(purchaseCost=12000, additionalCosts=3000, salvageValue=2000,
                     usefulLifeYears=5, depreciationInputMode="rate", annualDepreciationRate=20,
                     inServiceDate="2024-02-01")
        schedule = depreciation_schedule(asset)
        self.assertAlmostEqual(schedule[0]["beginning"] - schedule[0]["ending"], 13000 * 0.2 * 11 / 12, places=6)
        self.assertEqual(len(schedule), 6)
        self.assertAlmostEqual(13000 * 0.2, 2600, places=2)
        self.assertAlmostEqual(schedule[1]["expense"], 2600, places=6)
        self.assertAlmostEqual(sum(row["expense"] for row in schedule), 13000, places=6)
        self.assertAlmostEqual(schedule[-1]["expense"], 13000 - sum(row["expense"] for row in schedule[:-1]), places=6)
        self.assertAlmostEqual(schedule[-1]["ending"], 2000, places=6)
        self.assertTrue(all(row["ending"] >= 2000 for row in schedule))
        self.assertTrue(all(row["accumulated"] <= 13000 for row in schedule))

    def test_invalid_rate_is_rejected_by_schedule(self):
        for rate in (0.09, 100.01, float("inf"), float("nan")):
            asset = sample()
            asset.update(depreciationInputMode="rate", annualDepreciationRate=rate)
            with self.assertRaises(ValueError):
                depreciation_schedule(asset)

    def test_legacy_asset_without_new_fields_keeps_exact_year_schedule(self):
        legacy = sample()
        explicit_years = dict(legacy, depreciationInputMode="years")
        self.assertEqual(depreciation_schedule(legacy), depreciation_schedule(explicit_years))

    def test_half_month_rule_rolls_late_service_date_forward(self):
        asset = sample()
        asset["inServiceDate"] = "2024-01-16"
        self.assertEqual(effective_start(asset), date(2024, 2, 1))
        asset["inServiceDate"] = "2024-01-15"
        self.assertEqual(effective_start(asset), date(2024, 1, 1))

    def test_accelerated_methods_never_fall_below_salvage(self):
        for method in ("double_declining", "declining_150"):
            asset = sample(method)
            values = [float(row["ending"]) for row in depreciation_schedule(asset)]
            self.assertTrue(all(value >= 2000 - 0.01 for value in values))
            self.assertAlmostEqual(values[-1], 2000, places=2)

    def test_disposed_valuation_uses_saved_disposal_values(self):
        asset = sample()
        asset["status"] = "disposed"
        asset["disposal"] = {"bookValueAtDisposal": 3500, "accumulatedAtDisposal": 8500}
        result = valuation(asset, date(2026, 1, 1))
        self.assertEqual(result["netBookValue"], 3500)
        self.assertEqual(result["accumulatedDepreciation"], 8500)


class StoreTests(unittest.TestCase):
    def test_database_round_trip_and_backup_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "aosol.db"
            store = AssetStore(path)
            store.save(sample())
            self.assertEqual(store.all()[0]["code"], "AST-TEST")
            backup = store.backup_data()
            store.close()
            restored = AssetStore(Path(directory) / "restored.db")
            self.assertEqual(restored.restore(backup, replace=True), 1)
            self.assertEqual(restored.all()[0]["name"], "أصل للاختبار")
            restored.close()

    def test_backup_restore_preserves_new_depreciation_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            source = AssetStore(Path(directory) / "source.db")
            rate_asset = sample()
            rate_asset.update(depreciationInputMode="rate", annualDepreciationRate=20, usefulLifeYears=5.0)
            source.save(rate_asset)
            backup = source.backup_data()
            source.close()
            target = AssetStore(Path(directory) / "target.db")
            self.assertEqual(target.restore(backup, replace=True), 1)
            restored = target.all()[0]
            self.assertEqual(restored["depreciationInputMode"], "rate")
            self.assertEqual(restored["annualDepreciationRate"], 20)
            self.assertEqual(restored["usefulLifeYears"], 5.0)
            target.close()

    def test_category_catalog_persists_renames_assets_and_guards_deletion(self):
        with tempfile.TemporaryDirectory() as directory:
            store = AssetStore(Path(directory) / "aosol.db")
            store.add_category("أجهزة طبية")
            asset = sample()
            asset.update(id="medical-1", code="AST-MED", category="أجهزة طبية")
            store.save(asset)
            with self.assertRaisesRegex(ValueError, "مرتبط"):
                store.delete_category("أجهزة طبية")
            self.assertEqual(store.rename_category("أجهزة طبية", "المعدات الطبية"), 1)
            self.assertEqual(store.all()[0]["category"], "المعدات الطبية")
            self.assertIn("المعدات الطبية", store.get_categories())
            store.add_category("تصنيف غير مستخدم")
            store.delete_category("تصنيف غير مستخدم")
            backup = store.backup_data()
            store.close()

            restored = AssetStore(Path(directory) / "restored.db")
            restored.restore(backup, replace=True)
            self.assertIn("المعدات الطبية", restored.get_categories())
            self.assertEqual(restored.all()[0]["category"], "المعدات الطبية")
            restored.close()

    def test_csv_export_contains_unicode_headers_and_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "assets.csv"
            export_csv(path, [sample()])
            with path.open(encoding="utf-8-sig", newline="") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(rows[0]["code"], "AST-TEST")
            self.assertEqual(rows[0]["name"], "أصل للاختبار")
            self.assertEqual(rows[0]["depreciationInputMode"], "years")

    def test_csv_export_neutralizes_formula_like_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "assets.csv"
            asset = sample()
            asset.update(name='=HYPERLINK("https://example.invalid", "open")', location="\t@SUM(1,1)")
            export_csv(path, [asset])
            with path.open(encoding="utf-8-sig", newline="") as stream:
                row = next(csv.DictReader(stream))
            self.assertEqual(row["name"], '\'=HYPERLINK("https://example.invalid", "open")')
            self.assertEqual(row["location"], "'\t@SUM(1,1)")

    def test_excel_export_contains_asset_and_rtl_sheet(self):
        from openpyxl import load_workbook
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "assets.xlsx"
            export_xlsx(path, [sample()], "ريال يمني")
            sheet = load_workbook(path, data_only=True).active
            self.assertTrue(sheet.sheet_view.rightToLeft)
            self.assertEqual(sheet.cell(2, 1).value, "AST-TEST")
            self.assertEqual(sheet.cell(2, 2).value, "أصل للاختبار")
            self.assertGreaterEqual(sheet.cell(2, 8).value, 2000)
            self.assertLessEqual(sheet.cell(2, 8).value, 10000)

    def test_core_xlsx_export_includes_depreciation_mode_and_rate(self):
        from openpyxl import load_workbook
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rate-assets.xlsx"
            asset = sample()
            asset.update(depreciationInputMode="rate", annualDepreciationRate=20, usefulLifeYears=5.0)
            export_xlsx(path, [asset], "ريال يمني")
            sheet = load_workbook(path, data_only=True).active
            self.assertEqual(sheet.cell(2, 10).value, "rate")
            self.assertEqual(sheet.cell(2, 11).value, 20)

    def test_excel_export_stores_formula_like_text_as_plain_text(self):
        from openpyxl import load_workbook
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "assets.xlsx"
            payload = "=HYPERLINK(\"https://example.invalid\", \"open\")"
            asset = sample()
            asset.update(name=payload, location="@SUM(1,1)")
            export_xlsx(path, [asset], "ريال يمني")
            sheet = load_workbook(path, data_only=False).active
            self.assertEqual(sheet.cell(2, 2).value, payload)
            self.assertEqual(sheet.cell(2, 2).data_type, "s")
            self.assertEqual(sheet.cell(2, 15).value, "@SUM(1,1)")
            self.assertEqual(sheet.cell(2, 15).data_type, "s")


if __name__ == "__main__":
    unittest.main()
