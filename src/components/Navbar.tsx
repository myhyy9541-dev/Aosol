import React, { useState } from 'react';
import { 
  Building2, 
  Download, 
  Upload, 
  HardDrive, 
  FileSpreadsheet, 
  Calculator, 
  FileText, 
  Layers, 
  CheckCircle2, 
  WifiOff, 
  Monitor, 
  HelpCircle,
  TrendingDown,
  Coins,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getLastBackupTimestamp, SUPPORTED_CURRENCIES } from '../utils/storage';

interface NavbarProps {
  activeTab: 'assets' | 'calculator' | 'reports' | 'disposals' | 'backup';
  setActiveTab: (tab: 'assets' | 'calculator' | 'reports' | 'disposals' | 'backup') => void;
  onOpenImport: () => void;
  onOpenBackup: () => void;
  onOpenExeInfo: () => void;
  onExportAllExcel: () => void;
  assetsCount: number;
  currency: string;
  onChangeCurrency: (currency: string) => void;
  onLoadDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenImport,
  onOpenBackup,
  onOpenExeInfo,
  onExportAllExcel,
  assetsCount,
  currency,
  onChangeCurrency,
  onLoadDemo,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const lastBackup = getLastBackupTimestamp();
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
      {/* Top Banner: Status, Quick Currency & Demo */}
      <div className="border-b border-slate-800/60 bg-slate-950/70 px-4 py-1.5 text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-400 border border-emerald-500/20">
              <WifiOff className="h-3 w-3" />
              يعمل 100% بدون إنترنت (تخزين محلي آمن)
            </span>

            {/* Quick Demo Mode Loader */}
            <button
              onClick={onLoadDemo}
              className="flex items-center gap-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/30 transition shadow-sm"
              title="إعادة تحميل النسخة التجريبية بالعملة اليمنية والأصول النموذجية"
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
              النسخة التجريبية (Demo Data)
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Currency Selector */}
            <div className="relative">
              <button
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 border border-slate-700 transition"
              >
                <Coins className="h-3 w-3 text-sky-400" />
                العملة: {currency}
              </button>

              {showCurrencyDropdown && (
                <div className="absolute left-0 mt-1 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-xl py-1 z-50 text-right">
                  <div className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-slate-800 font-semibold">
                    اختر العملة المعتمدة للنظام:
                  </div>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        onChangeCurrency(c.symbol);
                        setShowCurrencyDropdown(false);
                      }}
                      className={`w-full text-right px-3 py-1.5 text-xs hover:bg-slate-800 flex items-center justify-between ${
                        currency === c.symbol ? 'text-sky-400 font-bold bg-sky-950/40' : 'text-slate-300'
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="text-[11px] font-mono-numbers text-slate-400">{c.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* EXE Launcher Guide */}
            <button
              onClick={onOpenExeInfo}
              className="flex items-center gap-1.5 text-xs font-bold text-white transition-all px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 shadow-md shadow-emerald-950/40"
              title="تحميل البرنامج للكمبيوتر بصيغة EXE جاهز للتشغيل"
            >
              <Download className="h-3.5 w-3.5 text-emerald-100" />
              <span>تحميل البرنامج (ملف EXE جاهز)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('assets')}>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-md shadow-sky-900/30 ring-1 ring-sky-400/30">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">نظام الأصول الثابتة والإهلاك</h1>
              <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-sky-300 uppercase tracking-wider">
                V1.1 PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">حساب الأصول وإهلاكها بالفترات والشهور والسنوات لكافة التصنيفات</p>
          </div>
        </div>

        {/* Primary Tabs */}
        <nav className="hidden lg:flex items-center gap-1 rounded-xl bg-slate-800/70 p-1 border border-slate-700/60">
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'assets'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            سجل وتصنيف الأصول
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'reports'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4" />
            التقارير (شهري/سنوي/من-إلى)
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'calculator'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Calculator className="h-4 w-4" />
            حاسبة مقارنة الطرق
          </button>

          <button
            onClick={() => setActiveTab('disposals')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'disposals'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            الاستبعادات والمبيعات
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'backup'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            النسخ والإعدادات
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* PWA Install */}
          {isInstallable && !isInstalled && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-all animate-pulse"
              title="تثبيت البرنامج كبرنامج مستقل على سطح المكتب"
            >
              <Monitor className="h-3.5 w-3.5" />
              تثبيت للكمبيوتر
            </button>
          )}

          {/* Excel Export */}
          <button
            onClick={onExportAllExcel}
            className="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700/50 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/60 transition"
            title="تصدير جميع الأصول إلى ملف إكسل"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            تصدير إكسل
          </button>

          {/* Excel Import */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 transition"
            title="استيراد أصول من ملف إكسل أو CSV"
          >
            <Upload className="h-3.5 w-3.5 text-sky-400" />
            استيراد
          </button>

          {/* Backup */}
          <button
            onClick={onOpenBackup}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/70 transition"
            title="إدارة النسخ الاحتياطية المحلية"
          >
            <HardDrive className="h-3.5 w-3.5 text-amber-400" />
            نسخ محلي
          </button>
        </div>
      </div>

      {/* Mobile Nav Tabs */}
      <div className="flex lg:hidden overflow-x-auto border-t border-slate-800 px-2 py-2 gap-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
            activeTab === 'assets' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          سجل الأصول
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
            activeTab === 'reports' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          التقارير (شهري/سنوي)
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
            activeTab === 'calculator' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          حاسبة الطرق
        </button>
        <button
          onClick={() => setActiveTab('disposals')}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
            activeTab === 'disposals' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          الاستبعادات
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
            activeTab === 'backup' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <HardDrive className="h-3.5 w-3.5" />
          النسخ والإعدادات
        </button>
      </div>
    </header>
  );
};
