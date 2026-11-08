import base64
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from aosol_config import copy_database_to_directory
from aosol_core import AssetStore
from aosol_documents import (
    MAX_ATTACHMENT_BYTES,
    attachment_path,
    build_document_archive,
    inspect_source_file,
    safe_relative_attachment_path,
    validate_attachment_records,
)

TEST_SIGNATURES = {
    ".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff",
    ".png": b"\x89PNG\r\n\x1a\n", ".webp": b"RIFF\x00\x00\x00\x00WEBP",
    ".gif": b"GIF89a", ".bmp": b"BM", ".tif": b"II*\x00",
    ".tiff": b"MM\x00*", ".pdf": b"%PDF-1.7\n",
}


def valid_bytes(extension, suffix=b"test"):
    return TEST_SIGNATURES[extension] + suffix


def sample_asset(**changes):
    asset = {
        "id": "asset-doc-test", "code": "AST-DOC", "name": "أصل اختبار",
        "category": "المباني والإنشاءات", "purchaseDate": "2024-01-01",
        "inServiceDate": "2024-01-01", "purchaseCost": 1000,
        "usefulLifeYears": 5, "depreciationMethod": "straight_line",
        "startDepreciationRule": "mid_month_15", "status": "active",
    }
    asset.update(changes)
    return asset


class AttachmentValidationTests(unittest.TestCase):
    def test_extension_allowlist_and_two_file_limit(self):
        for ext in ("jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "pdf"):
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / f"valid.{ext}"
                path.write_bytes(valid_bytes(path.suffix.lower()))
                self.assertEqual(inspect_source_file(path)[1], path.name)
        with tempfile.TemporaryDirectory() as folder:
            bad = Path(folder) / "executable.exe"
            bad.write_bytes(b"no")
            with self.assertRaises(ValueError):
                inspect_source_file(bad)
        valid = {"path": f"attachments/{'a' * 32}.pdf", "name": "valid.pdf"}
        self.assertEqual(len(validate_attachment_records([valid, valid])), 2)
        with self.assertRaises(ValueError):
            validate_attachment_records([valid, valid, valid])

    def test_content_signature_must_match_the_allowlisted_extension(self):
        with tempfile.TemporaryDirectory() as folder:
            disguised = Path(folder) / "document.png"
            disguised.write_bytes(b"%PDF-1.7\nnot-a-png")
            with self.assertRaisesRegex(ValueError, "محتوى الملف"):
                inspect_source_file(disguised)

    def test_safe_relative_paths_reject_traversal_and_unexpected_names(self):
        for path in (
            "../attachments/file.pdf", "attachments/../file.pdf", "/attachments/file.pdf",
            "attachments/../../outside.pdf", "attachments/not-generated.pdf",
            "attachments/" + "b" * 32 + ".exe", "attachments\\" + "c" * 32 + ".pdf",
        ):
            with self.subTest(path=path), self.assertRaises(ValueError):
                safe_relative_attachment_path(path)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            outside = root.parent / f"{root.name}-outside.pdf"
            outside.write_bytes(b"outside")
            try:
                (root / "attachments").symlink_to(outside.parent, target_is_directory=True)
                with self.assertRaises(ValueError):
                    attachment_path(root, f"attachments/{'d' * 32}.pdf")
            finally:
                outside.unlink(missing_ok=True)

    def test_per_file_size_limit_is_checked_before_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            large = Path(folder) / "large.pdf"
            with large.open("wb") as stream:
                stream.truncate(MAX_ATTACHMENT_BYTES + 1)
            with self.assertRaisesRegex(ValueError, "20"):
                inspect_source_file(large)


class DocumentArchiveTests(unittest.TestCase):
    def test_archive_manifest_html_escaping_and_original_contents(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            store = AssetStore(root / "source.db")
            image = root / "photo.png"
            pdf = root / "invoice.pdf"
            image_bytes, pdf_bytes = valid_bytes(".png", b"PNG-ORIGINAL"), valid_bytes(".pdf", b"PDF-ORIGINAL")
            image.write_bytes(image_bytes)
            pdf.write_bytes(pdf_bytes)
            asset = sample_asset(name='Asset <script>alert("x")</script>', notes='<img src=x onerror=alert(1)>')
            store.save_with_attachments(asset, [str(image), str(pdf)])
            saved = store.all()[0]
            archive_path = root / "report.zip"
            build_document_archive(archive_path, saved, root)
            with zipfile.ZipFile(archive_path) as archive:
                html_text = archive.read("index.html").decode("utf-8")
                manifest = json.loads(archive.read("manifest.json"))
                self.assertIn('dir="rtl"', html_text)
                self.assertIn("&lt;script&gt;", html_text)
                self.assertNotIn("<script>alert", html_text)
                self.assertNotIn("<img src=x onerror=alert", html_text)
                self.assertIn("<object", html_text)
                self.assertIn("<img", html_text)
                self.assertEqual(len(manifest["assets"]), 1)
                self.assertEqual(len(manifest["assets"][0]["documents"]), 2)
                archived = {entry: archive.read(entry) for entry in archive.namelist() if entry.startswith("files/")}
                self.assertCountEqual(archived.values(), [image_bytes, pdf_bytes])
            store.close()

    def test_archive_includes_each_asset_with_its_own_documents(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            store = AssetStore(root / "source.db")
            first_doc = root / "first.png"
            second_doc = root / "second.pdf"
            first_bytes = valid_bytes(".png", b"first-image")
            second_bytes = valid_bytes(".pdf", b"second-pdf")
            first_doc.write_bytes(first_bytes)
            second_doc.write_bytes(second_bytes)
            store.save_with_attachments(sample_asset(), [str(first_doc)])
            store.save_with_attachments(sample_asset(id="asset-two", code="AST-TWO", name="أصل ثان"), [str(second_doc)])
            archive_path = root / "all-assets.zip"
            build_document_archive(archive_path, store.all(), root)
            with zipfile.ZipFile(archive_path) as archive:
                html_text = archive.read("index.html").decode("utf-8")
                manifest = json.loads(archive.read("manifest.json"))
                self.assertEqual(len(manifest["assets"]), 2)
                self.assertIn("AST-DOC", html_text)
                self.assertIn("AST-TWO", html_text)
                archived = [archive.read(path) for path in archive.namelist() if path.startswith("files/")]
                self.assertCountEqual(archived, [first_bytes, second_bytes])
            store.close()


class BackupRestoreAttachmentTests(unittest.TestCase):
    def test_backup_restore_portable_and_file_paths_regenerated(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = AssetStore(root / "source" / "aosol.db")
            source_image = root / "evidence.jpg"
            source_bytes = valid_bytes(".jpg", b"portable image bytes")
            source_image.write_bytes(source_bytes)
            source.save_with_attachments(sample_asset(), [str(source_image)])
            backup = source.backup_data()
            stored_path = backup["assets"][0]["attachments"][0]["path"]
            self.assertEqual(base64.b64decode(backup["attachmentFiles"][stored_path]), source_bytes)
            source.close()

            target = AssetStore(root / "destination" / "aosol.db")
            self.assertEqual(target.restore(backup, replace=True), 1)
            restored = target.all()[0]
            self.assertNotEqual(restored["attachments"][0]["path"], stored_path)
            restored_path = attachment_path(target.path.parent, restored["attachments"][0]["path"])
            self.assertEqual(restored_path.read_bytes(), source_bytes)
            target.close()

    def test_legacy_backup_without_attachment_fields_remains_importable(self):
        with tempfile.TemporaryDirectory() as folder:
            target = AssetStore(Path(folder) / "legacy.db")
            legacy = {"app": "Aosol", "assets": [sample_asset()]}
            self.assertEqual(target.restore(legacy, replace=True), 1)
            self.assertEqual(target.all()[0].get("attachments", []), [])
            target.close()

    def test_backup_with_dangling_attachment_is_rejected_instead_of_silently_dropping_it(self):
        with tempfile.TemporaryDirectory() as folder:
            target = AssetStore(Path(folder) / "target.db")
            record = {"path": f"attachments/{'e' * 32}.png", "name": "lost.png"}
            backup = {"assets": [sample_asset(attachments=[record])], "attachmentFiles": {}}
            with self.assertRaisesRegex(ValueError, "غير موجود"):
                target.restore(backup, replace=True)
            self.assertEqual(target.all(), [])
            target.close()

    def test_restore_rejects_invalid_base64_and_traversal_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            target = AssetStore(Path(folder) / "target.db")
            record = {"path": f"attachments/{'f' * 32}.png", "name": "proof.png"}
            invalid_base64 = {"assets": [sample_asset(attachments=[record])], "attachmentFiles": {record["path"]: "not base64!"}}
            with self.assertRaisesRegex(ValueError, "ترميز"):
                target.restore(invalid_base64, replace=True)
            traversal = {"assets": [sample_asset()], "attachmentFiles": {"../outside.png": base64.b64encode(b"x").decode("ascii")}}
            with self.assertRaisesRegex(ValueError, "مسار"):
                target.restore(traversal, replace=True)
            self.assertEqual(target.all(), [])
            target.close()

    def test_remove_and_delete_clean_only_unreferenced_files_after_save(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            store = AssetStore(root / "aosol.db")
            image = root / "proof.png"
            image.write_bytes(valid_bytes(".png", b"proof"))
            store.save_with_attachments(sample_asset(), [str(image)])
            record = store.all()[0]["attachments"][0]
            saved_path = attachment_path(root, record["path"])
            self.assertTrue(saved_path.exists())
            updated = store.all()[0]
            updated["attachments"] = []
            store.save(updated)
            self.assertFalse(saved_path.exists())
            image.write_bytes(valid_bytes(".png", b"proof2"))
            asset = sample_asset(id="delete-me", code="AST-DELETE")
            store.save_with_attachments(asset, [str(image)])
            deleted_record = next(item for item in store.all() if item["id"] == "delete-me")["attachments"][0]
            deleted_path = attachment_path(root, deleted_record["path"])
            store.delete("delete-me")
            self.assertFalse(deleted_path.exists())
            store.close()

    def test_failed_duplicate_asset_save_leaves_no_permanent_attachment(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            store = AssetStore(root / "aosol.db")
            store.save(sample_asset())
            other = root / "other.pdf"
            other.write_bytes(valid_bytes(".pdf", b"file"))
            with self.assertRaises(Exception):
                store.save_with_attachments(sample_asset(id="duplicate-id", name="Second"), [str(other)])
            self.assertEqual(list((root / "attachments").glob("*.pdf")) if (root / "attachments").exists() else [], [])
            store.close()

    def test_database_directory_copy_preserves_attachment_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = AssetStore(root / "source" / "aosol.db")
            image = root / "copy.png"
            image.write_bytes(valid_bytes(".png", b"copy me"))
            source.save_with_attachments(sample_asset(), [str(image)])
            relative = source.all()[0]["attachments"][0]["path"]
            source_file = attachment_path(source.path.parent, relative)
            target_db = copy_database_to_directory(source.conn, root / "target")
            target_file = attachment_path(target_db.parent, relative)
            self.assertEqual(target_file.read_bytes(), source_file.read_bytes())
            source.close()


if __name__ == "__main__":
    unittest.main()
