import React, { useState } from 'react';
import { 
  X, 
  Monitor, 
  Download, 
  CheckCircle, 
  ExternalLink, 
  FolderArchive, 
  Play, 
  Info,
  Check
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface StandaloneExeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StandaloneExeModal: React.FC<StandaloneExeModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [downloadStarted, setDownloadStarted] = useState<string | null>(null);

  if (!isOpen) return null;

  const directAppUrl = 'https://ais-pre-czuygllmulq2dkfssk4mo5-985372917081.europe-west2.run.app';

  const triggerDownload = (url: string, filename: string) => {
    setDownloadStarted(filename);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadStarted(null);
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Download className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">تحميل تطبيق Aosol المكتبي لويندوز</h2>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                  جاهز للتشغيل
                </span>
              </div>
              <p className="text-xs text-slate-400">تطبيق Python محلي لإدارة الأصول، يعمل دون اتصال بالإنترنت</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice for non-technical user */}
        <div className="bg-sky-950/40 border-b border-sky-800/40 px-6 py-3 flex items-start gap-2.5 text-xs text-sky-200">
          <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            التطبيق المكتبي يحفظ قاعدة البيانات محليًا على Windows ولا يحتاج إلى تثبيت Python. اختر تنزيل EXE أو حزمة ZIP التي تتضمن البصمة وتعليمات التشغيل.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Option 1: Direct EXE (Hero) */}
          <div className="relative rounded-2xl bg-gradient-to-b from-emerald-950/40 to-slate-900 p-5 border-2 border-emerald-500/60 shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-black">
                  <Play className="h-5 w-5 fill-slate-950" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    الخيار ١: تطبيق Aosol المكتبي (Aosol.exe)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    البرنامج الفعلي لإدارة الأصول ببايثون، وليس مشغّلًا للمتصفح. تُحفظ البيانات محليًا في مجلد حساب Windows.
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-1 font-bold border border-emerald-500/30">
                موصى به
              </span>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>طريقة الاستخدام السهلة (٣ خطوات فقط):</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 pr-1 leading-relaxed">
                <li>اضغط زر تحميل <strong>Aosol.exe</strong>.</li>
                <li>افتح مجلد التنزيلات (Downloads) في جهاز الكمبيوتر الخاص بك.</li>
                <li>تحقق من بصمة SHA-256 إن أردت، ثم شغّل الملف. لا تتجاوز تحذير الحماية تلقائيًا.</li>
              </ol>
            </div>

            <button
              onClick={() => triggerDownload('/Aosol.exe', 'Aosol.exe')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white px-5 py-3 text-xs font-bold transition shadow-lg shadow-emerald-950/50"
            >
              {downloadStarted === 'Aosol.exe' ? (
                <>
                  <Check className="h-4 w-4 text-emerald-200" />
                  <span>تم بدء التنزيل بنجاح! تفقد مجلد التحميلات (Downloads)</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>تحميل تطبيق Aosol الآن (Aosol.exe)</span>
                </>
              )}
            </button>
          </div>

          {/* Option 2: Standalone desktop app package */}
          <div className="rounded-2xl bg-slate-800/60 p-5 border border-slate-700/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <FolderArchive className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    الخيار ٢: حزمة Aosol لويندوز (ZIP)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تضم ملف التطبيق وتعليمات التشغيل وملف بصمة SHA-256 للتحقق من تطابق التنزيل.
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] rounded bg-slate-800 text-slate-300 px-2 py-0.5 border border-slate-700">
                التطبيق المكتبي
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              فك ضغط ZIP إلى مجلد، ثم استخدم Aosol.exe. تبقى قاعدة بياناتك في مجلد بيانات حساب Windows ولا تُحفظ داخل ZIP.
            </p>

            <button
              onClick={() => triggerDownload('/Aosol-Windows-x64.zip', 'Aosol-Windows-x64.zip')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-sky-300 border border-slate-600 px-5 py-2.5 text-xs font-bold transition shadow-sm"
            >
              {downloadStarted === 'Aosol-Windows-x64.zip' ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>جاري تنزيل الحزمة المضغوطة...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 text-sky-400" />
                  <span>تنزيل حزمة Aosol (Aosol-Windows-x64.zip)</span>
                </>
              )}
            </button>
          </div>

          {/* Option 3: Fullscreen Browser Window with Direct Browser Install */}
          <div className="rounded-2xl bg-slate-800/40 p-4 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-amber-400" />
                الخيار ٣: فتح البرنامج في نافذة كاملة للتثبيت من المتصفح
              </span>
              <span className="text-[10px] rounded bg-amber-500/10 text-amber-300 px-2 py-0.5 border border-amber-500/20">
                تثبيت PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              لأنك تشاهد البرنامج حالياً داخل منصة الذكاء الاصطناعي (إطار مدمج)، قد لا يظهر زر تثبيت الويندوز التلقائي. عند فتح الرابط المباشر في نافذة خارجية، سيظهر لك فوراً زر <strong>"تثبيت التطبيق" (Install)</strong> في شريط عنوان متصفح Chrome أو Edge لإضافته إلى سطح المكتب وقائمة Start.
            </p>
            <a
              href={directAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-4 py-2 text-xs font-semibold transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>فتح الرابط المباشر في نافذة جديدة للتثبيت</span>
            </a>
          </div>

          {/* Honest download security notice */}
          <div className="rounded-2xl bg-amber-950/40 border border-amber-600/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Info className="h-5 w-5 text-amber-400" />
                ملاحظة التوقيع والفحص:
              </span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                غير موقّع
              </span>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              ملف <strong>Aosol.exe</strong> غير موقّع بشهادة ناشر Authenticode، ولم يُجرَ عليه فحص مستقل بمضاد فيروسات Windows؛ لذلك قد يعرض SmartScreen أو مضاد الفيروسات تحذيرًا. لا يمكن ضمان خلوّه 100%، ولا تتجاوز تحذير الحماية تلقائيًا.
            </p>
            <div className="pt-2 border-t border-amber-800/40 text-[10px] text-slate-300 font-mono-numbers break-all">
              SHA-256 لـ Aosol.exe: 1b4f49954368aaac754d77e5f23400ad9e32ab641ce84c4bc0b3e473eefc0b30
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-6 py-3.5">
          <p className="text-[11px] text-slate-400">
            إذا واجهت أي استفسار، جميع بياناتك محفوظة محلياً ويمكنك استيرادها وتصديرها إكسل في أي وقت.
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
