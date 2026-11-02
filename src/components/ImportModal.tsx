import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, ArrowRight, Layers } from 'lucide-react';
import { Asset, AssetCategory } from '../types/asset';
import { downloadExcelTemplate, parseExcelImport } from '../utils/excel';
import { formatNumber } from '../utils/formatters';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedAssets: Asset[], mode: 'append' | 'replace') => void;
  categories: AssetCategory[];
  currency: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  categories,
  currency,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedAssets, setParsedAssets] = useState<Asset[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [totalRead, setTotalRead] = useState(0);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setErrors([]);
    setParsedAssets([]);

    try {
      const result = await parseExcelImport(selectedFile, categories);
      setTotalRead(result.totalRead);
      setErrors(result.errors);
      setParsedAssets(result.assets);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setErrors([`حدث خطأ غير متوقع: ${errorMsg}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = () => {
    if (parsedAssets.length === 0) return;
    onImportComplete(parsedAssets, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">استيراد الأصول الثابتة من إكسل</h2>
              <p className="text-xs text-slate-400">يدعم ملفات .xlsx و .xls و .csv مع المطابقة التلقائية للأعمدة</p>
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
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Download Template Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-5 border border-emerald-500/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    نموذج إكسل المعتمد لإدراج الأصول من الكمبيوتر
                    <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                      مطابق 100% للتطبيق
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    يحتوي النموذج على جميع عناوين وأعمدة التطبيق (الاسم، التصنيف، الإدارة، تكلفة الشراء، الخردة، سياسة 15 يوم، إلخ) بتنسيق ملون ومن اليمين لليسار.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => downloadExcelTemplate('with_sample')}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold transition shadow-md shadow-emerald-950/50"
                title="تصدير نموذج يحتوي على 4 أصول نموذجية مع تبويب دليل الخيارات المعتمدة"
              >
                <Download className="h-4 w-4" />
                <span>تحميل النموذج مع أمثلة استرشادية ودليل الخيارات (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadExcelTemplate('blank')}
                className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 px-4 py-2.5 text-xs font-bold transition"
                title="تصدير نموذج فارغ تماماً بالعناوين الرسمية فقط"
              >
                <Download className="h-4 w-4 text-emerald-400" />
                <span>تحميل نموذج فارغ جاهز للتعبئة (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl p-8 text-center bg-slate-950/40 hover:bg-slate-950/60 transition"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <Upload className="h-6 w-6 text-sky-400" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {file ? `الملف المحدد: ${file.name}` : 'اسحب وأفلت ملف الإكسل هنا، أو انقر للاختيار من الكمبيوتر'}
              </p>
              <p className="text-[11px] text-slate-400">يدعم صيغ Excel (.xlsx, .xls) وملفات القيم المفصولة (.csv)</p>
            </div>
          </div>

          {/* Loading status */}
          {loading && (
            <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-800/50 text-xs text-sky-300 text-center flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping"></span>
              جاري فحص وقراءة بيانات ملف الإكسل ومطابقة الأعمدة...
            </div>
          )}

          {/* Warnings & Errors */}
          {errors.length > 0 && (
            <div className="rounded-xl bg-amber-950/30 border border-amber-800/50 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <AlertCircle className="h-4 w-4" />
                تنبيهات وملاحظات القراءة ({errors.length}):
              </div>
              <ul className="text-[11px] text-amber-300/80 list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview of Parsed Assets */}
          {parsedAssets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  تم التعرف بنجاح على ({parsedAssets.length}) أصل جاهز للاستيراد:
                </span>
                <span className="text-slate-400 font-mono-numbers">
                  إجمالي التكلفة: {formatNumber(parsedAssets.reduce((s, a) => s + a.purchaseCost, 0))} {currency}
                </span>
              </div>

              {/* Import Mode Selector */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                <span className="text-slate-300 font-medium">طريقة الحفظ:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="mode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="accent-sky-500"
                  />
                  إضافة ودمج مع الأصول الحالية (مستحسن)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="mode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-sky-500"
                  />
                  استبدال ومسح الأصول الحالية
                </label>
              </div>

              {/* Table Preview */}
              <div className="overflow-hidden rounded-xl bg-slate-950/70 border border-slate-800 max-h-48 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">الكود</th>
                      <th className="px-3 py-2">اسم الأصل</th>
                      <th className="px-3 py-2">التكلفة</th>
                      <th className="px-3 py-2">العمر</th>
                      <th className="px-3 py-2">طريقة الإهلاك</th>
                      <th className="px-3 py-2">القسم / الموقع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {parsedAssets.slice(0, 10).map((a, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono-numbers text-sky-400">{a.code}</td>
                        <td className="px-3 py-2 text-slate-200">{a.name}</td>
                        <td className="px-3 py-2 font-mono-numbers text-white">{formatNumber(a.purchaseCost)}</td>
                        <td className="px-3 py-2 font-mono-numbers text-slate-300">{a.usefulLifeYears} س</td>
                        <td className="px-3 py-2 text-slate-400">{a.depreciationMethod}</td>
                        <td className="px-3 py-2 text-slate-400">{a.department || a.location || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedAssets.length > 10 && (
                  <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-900 border-t border-slate-800">
                    والمزيد ({parsedAssets.length - 10} أصل إضافي)...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/90 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={parsedAssets.length === 0}
            onClick={handleConfirm}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:pointer-events-none transition"
          >
            <CheckCircle className="h-4 w-4" />
            استيراد ({parsedAssets.length}) أصل إلى النظام
          </button>
        </div>
      </div>
    </div>
  );
};
