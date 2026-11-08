"""Local application preferences and safe backup/path helpers for Aosol."""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

APP_NAME = "Aosol"


def config_directory() -> Path:
    if sys.platform == "win32":
        root = Path(os.environ.get("APPDATA", Path.home()))
        return root / APP_NAME
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / APP_NAME.lower()


def preferences_path() -> Path:
    return config_directory() / "preferences.json"


def default_data_directory() -> Path:
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", Path.home())) / APP_NAME
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / APP_NAME.lower()


def load_app_preferences(path: str | Path | None = None) -> dict[str, Any]:
    source = Path(path) if path else preferences_path()
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_app_preferences(values: dict[str, Any], path: str | Path | None = None) -> Path:
    destination = Path(path) if path else preferences_path()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path = destination.with_name(destination.name + ".tmp")
    payload = json.dumps(values, ensure_ascii=False, indent=2)
    with temp_path.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp_path, destination)
    return destination


def configured_data_directory() -> Path:
    preferences = load_app_preferences()
    selected = str(preferences.get("data_directory") or "").strip()
    path = Path(selected).expanduser() if selected else default_data_directory()
    path.mkdir(parents=True, exist_ok=True)
    return path


def configured_backup_directory() -> Path:
    preferences = load_app_preferences()
    selected = str(preferences.get("backup_directory") or "").strip()
    path = Path(selected).expanduser() if selected else configured_data_directory() / "backups"
    return path


def prepare_writable_directory(directory: str | Path) -> Path:
    path = Path(directory).expanduser()
    path.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=".aosol-write-test-", dir=path, delete=True):
        pass
    return path.resolve()


def copy_database_to_directory(connection: sqlite3.Connection, directory: str | Path) -> Path:
    """Copy an open SQLite database consistently, refusing to overwrite an existing DB."""
    target_dir = prepare_writable_directory(directory)
    target = target_dir / "aosol.db"
    if target.exists():
        raise FileExistsError(f"يوجد ملف قاعدة بيانات بالفعل في المسار المحدد: {target}")
    source_row = connection.execute("PRAGMA database_list").fetchone()
    source_db = Path(source_row[2]).resolve() if source_row and source_row[2] else None
    source_attachments = source_db.parent / "attachments" if source_db else None
    target_attachments = target_dir / "attachments"
    staged_attachments = target_dir / f".attachments-copy-{uuid.uuid4().hex}"
    if source_attachments and source_attachments.is_dir() and target_attachments.exists():
        raise FileExistsError(f"يوجد مجلد مرفقات بالفعل في المسار المحدد: {target_attachments}")
    destination: sqlite3.Connection | None = None
    attachments_installed = False
    try:
        connection.commit()
        if source_attachments and source_attachments.is_dir():
            if source_attachments.is_symlink():
                raise ValueError("مجلد المرفقات الأصلي يجب ألا يكون رابطًا رمزيًا.")
            shutil.copytree(source_attachments, staged_attachments, ignore=shutil.ignore_patterns(".staging"), symlinks=True)
        destination = sqlite3.connect(target)
        connection.backup(destination)
        destination.commit()
        check = destination.execute("PRAGMA integrity_check").fetchone()
        if not check or check[0] != "ok":
            raise sqlite3.DatabaseError("تعذر التحقق من سلامة نسخة قاعدة البيانات المنقولة")
        if staged_attachments.exists():
            os.replace(staged_attachments, target_attachments)
            attachments_installed = True
    except Exception:
        if destination is not None:
            destination.close()
        try:
            target.unlink(missing_ok=True)
        except OSError:
            pass
        shutil.rmtree(staged_attachments, ignore_errors=True)
        if attachments_installed:
            shutil.rmtree(target_attachments, ignore_errors=True)
        raise
    finally:
        if destination is not None:
            try:
                destination.close()
            except sqlite3.Error:
                pass
    return target


def write_backup_snapshot(data: dict[str, Any], directory: str | Path, *, automatic: bool = True, keep: int = 30) -> Path:
    folder = prepare_writable_directory(directory)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prefix = "Aosol_auto_" if automatic else "Aosol_backup_"
    destination = folder / f"{prefix}{stamp}.json"
    temp_path = folder / f".{destination.name}.tmp"
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    try:
        with temp_path.open("w", encoding="utf-8", newline="\n") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, destination)
    finally:
        temp_path.unlink(missing_ok=True)
    if automatic and keep > 0:
        copies = sorted(folder.glob("Aosol_auto_*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
        for old in copies[keep:]:
            try:
                old.unlink()
            except OSError:
                pass
    return destination
