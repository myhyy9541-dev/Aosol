import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from aosol_config import configured_backup_directory, configured_data_directory, save_app_preferences


class ConfiguredPathTests(unittest.TestCase):
    def test_selected_data_and_backup_directories_are_used(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            config_home = root / "config"
            data_home = root / "default-data"
            selected_data = root / "chosen-data"
            selected_backups = root / "chosen-backups"
            with patch.dict("os.environ", {"XDG_CONFIG_HOME": str(config_home), "XDG_DATA_HOME": str(data_home)}):
                save_app_preferences({"data_directory": str(selected_data), "backup_directory": str(selected_backups)})
                self.assertEqual(configured_data_directory(), selected_data)
                self.assertTrue(selected_data.is_dir())
                self.assertEqual(configured_backup_directory(), selected_backups)

    def test_backup_folder_defaults_under_selected_data_folder(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.dict("os.environ", {"XDG_CONFIG_HOME": str(root / "config"), "XDG_DATA_HOME": str(root / "default-data")}):
                selected_data = root / "chosen-data"
                save_app_preferences({"data_directory": str(selected_data)})
                self.assertEqual(configured_backup_directory(), selected_data / "backups")


if __name__ == "__main__":
    unittest.main()
