import React, { useState, useRef } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  HardDrive, 
  FileSpreadsheet, 
  RotateCcw, 
  Trash2, 
  CheckCircle, 
  AlertTriangle,
  Building,
  Save,
  ShieldCheck
} from 'lucide-react';
import { Asset, AssetCategory, CompanySettings, DatabaseBackup } from '../types/asset';
import { 
  exportLocalBackup, 
  getStoredAssets, 
  getStoredCategories, 
  getStoredSettings, 
  INITIAL_SAMPLE_ASSETS, 
  restoreBackupData, 
  saveStoredAssets, 
  saveStoredSettings 
} from '../utils/storage';
import { exportAssetsToExcel } from '../utils/excel';
import { formatNumber } from '../utils/formatters';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  currency: string;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
  currency,
}) => {
  const [settings, setSettings] = useState<CompanySettings>(getStoredSettings());
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const assets = getStoredAssets();
  const categories = getStoredCategories();

  const handleDownloadBackup = () => {
    exportLocalBackup();
    setStatusMsg({
      type: 'success',
      text: 'تم تنزيل النسخة الاحتياطية بنجاح وحفظها كملف .json على جهازك.',
    });
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const parsed = JSON.parse(raw) as DatabaseBackup;
        const res = restoreBackupData(parsed);
        if (res.success) {
          setStatusMsg({ type: 'success', text: res.message });
          onDataChanged();
        } else {
          setStatusMsg({ type: 'error', text: res.message });
        }
      } catch (err) {
        setStatusMsg({ type: 'error', text: 'الملف غير صالح أو ليس بتنسيق JSON صحيح.' });
      }
    };
    reader.readAsText(file);
  };

  const handleResetSample = () => {
    if (window.confirm('هل أنت متأكد من إعادة ضبط البيانات إلى النماذج الافتراضية؟ سيتم استبدال البيانات الحالية.')) {
      saveStoredAssets(INITIAL_SAMPLE_ASSETS);
      setStatusMsg({ type: 'success', text: 'تمت استعادة البيانات التجريبية بنجاح.' });
      onDataChanged();
    }
  };

  const handleClearAll = () => {
    if (window.confirm('تحذير: هل أنت متأكد من مسح جميع الأصول وتفريغ قاعدة البيانات؟ لا يمكن التراجع إلا إذا كان لديك نسخة احتياطية.')) {
      saveStoredAssets([]);
      setStatusMsg({ type: 'success', text: 'تم تفريغ قاعدة بيانات الأصول.' });
      onDataChanged();
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSettings(settings);
    setStatusMsg({ type: 'success', text: 'تم حفظ إعدادات المؤسسة والعملة بنجاح.' });
    onDataChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">إدارة النسخ الاحتياطية المحلية والإعدادات</h2>
              <p className="text-xs text-slate-400">حفظ واسترجاع بيانات الأصول محلياً بدون الحاجة لأي اتصال بالإنترنت</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/50 border border-rose-800 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {statusMsg.text}
            </div>
          )}

          {/* Backup & Restore Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Download Backup */}
            <div className="rounded-xl bg-slate-800/80 p-5 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Download className="h-4 w-4" />
                حفظ نسخة احتياطية محلية (JSON)
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                تنزيل ملف كامل يحتوي على جميع الأصول ({assets.length} أصل) والإعدادات وتاريخ الاستبعادات لحفظها على فلاش ميموري أو القرص الصلب.
              </p>
              <button
                onClick={handleDownloadBackup}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white py-2.5 text-xs font-bold transition shadow-sm"
              >
                <Download className="h-4 w-4" />
                تنزيل النسخة الاحتياطية الآن
              </button>
            </div>

            {/* 2. Restore Backup */}
            <div className="rounded-xl bg-slate-800/80 p-5 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Upload className="h-4 w-4" />
                استرجاع نسخة احتياطية سابقة
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                رفع ملف نسخة احتياطية بصيغة (.json) لاستعادة كافة البيانات إلى البرنامج بدون فقدان أي بيانات.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 py-2.5 text-xs font-bold transition shadow-sm"
              >
                <Upload className="h-4 w-4" />
                اختيار ملف النسخة واسترجاعها
              </button>
            </div>
          </div>

          {/* Standalone Desktop Program Box */}
          <div className="rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-800 p-4 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-white flex items-center gap-2">
                <Download className="h-4 w-4 text-emerald-400" />
                نسخة برنامج الكمبيوتر المكتبي المستقل (FixedAssetsManager.exe)
              </div>
              <p className="text-[11px] text-slate-300">
                ملف تنفيذي مخصص لويندوز (120 KB) جاهز للتشغيل مباشرة بنقرة مزدوجة دون أي خبرة تقنية.
              </p>
            </div>
            <a
              href="/FixedAssetsManager.exe"
              download="FixedAssetsManager.exe"
              className="shrink-0 flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold transition shadow-md"
            >
              <Download className="h-4 w-4" />
              تحميل ملف EXE الآن
            </a>
          </div>

          {/* Quick Database Reset Actions */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-400">
              إجراءات الصيانة وقاعدة البيانات المحلية:
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetSample}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-sky-400" />
                استعادة النماذج التجريبية
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs transition"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                مسح وتفريغ الأصول
              </button>
            </div>
          </div>

          {/* Company Settings Form */}
          <form onSubmit={handleSaveSettings} className="space-y-4 pt-4 border-t border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Building className="h-4 w-4 text-sky-400" />
                إعدادات المنشأة والتقارير والعملة:
              </span>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition"
              >
                <Save className="h-3.5 w-3.5" />
                حفظ الإعدادات
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">اسم الشركة / المؤسسة:</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">العملة المعتمدة:</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="ريال يمني">ريال يمني (YER)</option>
                  <option value="ر.س">ريال سعودي (SAR)</option>
                  <option value="$">دولار أمريكي (USD)</option>
                  <option value="د.إ">درهم إماراتي (AED)</option>
                  <option value="ج.م">جنيه مصري (EGP)</option>
                  <option value="د.ك">دينار كويتي (KWD)</option>
                  <option value="ر.ق">ريال قطري (QAR)</option>
                  <option value="ر.ع">ريال عماني (OMR)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">السجل التجاري:</label>
                <input
                  type="text"
                  value={settings.commercialReg}
                  onChange={(e) => setSettings({ ...settings, commercialReg: e.target.value })}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">الرقم الضريبي:</label>
                <input
                  type="text"
                  value={settings.taxNumber}
                  onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 bg-slate-950/90 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
