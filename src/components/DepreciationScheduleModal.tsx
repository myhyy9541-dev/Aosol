import React, { useState } from 'react';
import { X, FileSpreadsheet, Printer, Calendar, Clock, DollarSign, TrendingDown, Layers, CheckCircle, Building } from 'lucide-react';
import { Asset, DepreciationScheduleRow } from '../types/asset';
import { calculateSchedule, getAssetDepreciationInputMode, getCurrentAssetValuation, getEquivalentUsefulLifeYears, getTotalCost } from '../utils/depreciation';
import { exportScheduleToExcel } from '../utils/excel';
import { formatCurrency, formatDate, formatNumber, formatPercent, getMethodLabel, getStartRuleLabel } from '../utils/formatters';

interface DepreciationScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  currency: string;
}

export const DepreciationScheduleModal: React.FC<DepreciationScheduleModalProps> = ({
  isOpen,
  onClose,
  asset,
  currency,
}) => {
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [selectedYearForMonthly, setSelectedYearForMonthly] = useState<number>(1);

  if (!isOpen || !asset) return null;

  const totalCost = getTotalCost(asset);
  const valuation = getCurrentAssetValuation(asset);
  const schedule = calculateSchedule(asset);
  const methodInfo = getMethodLabel(asset.depreciationMethod);
  const ruleInfo = getStartRuleLabel(asset.startDepreciationRule);

  // Generate monthly breakdown for the chosen year
  const activeYearRow = schedule.find((s) => s.year === selectedYearForMonthly) || schedule[0];
  const monthlyExpense = activeYearRow ? activeYearRow.depreciationExpense / 12 : 0;
  
  const startInService = asset.inServiceDate ? new Date(asset.inServiceDate) : new Date(asset.purchaseDate || new Date());
  const yearStart = startInService.getFullYear() + (selectedYearForMonthly - 1);

  const months = [
    'يناير (Jan)', 'فبراير (Feb)', 'مارس (Mar)', 'أبريل (Apr)', 'مايو (May)', 'يونيو (Jun)',
    'يوليو (Jul)', 'أغسطس (Aug)', 'سبتمبر (Sep)', 'أكتوبر (Oct)', 'نوفمبر (Nov)', 'ديسمبر (Dec)'
  ];

  const handlePrint = () => {
    const existingStyle = document.getElementById('dynamic-schedule-print');
    if (existingStyle) existingStyle.remove();

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-schedule-print';
    styleEl.innerHTML = `
      @media print {
        @page {
          size: A4 landscape !important;
          margin: 8mm 6mm !important;
        }
        html, body, #root, .printable-schedule {
          direction: rtl !important;
          text-align: right !important;
        }
        table, th, td {
          direction: rtl !important;
          text-align: right !important;
        }
        .font-mono-numbers {
          direction: ltr !important;
          unicode-bidi: embed !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
  };

  return (
    <div dir="rtl" className="printable-schedule fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl my-6 overflow-hidden print:max-w-full print:bg-white print:text-black print:border-none print:shadow-none print:my-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">جدول ومصفوفة إهلاك الأصل</h2>
                <span className="font-mono-numbers text-xs bg-sky-950 px-2 py-0.5 rounded text-sky-400 border border-sky-800">
                  {asset.code}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 text-xs text-emerald-300 font-medium">
                  <Building className="h-3 w-3 text-emerald-400" />
                  {asset.department || 'الإدارة العامة'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-semibold">{asset.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportScheduleToExcel(asset, currency)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-950 border border-emerald-700/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 transition"
              title="تصدير جدول الإهلاك لهذا الأصل إلى ملف إكسل"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              تصدير إكسل
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              title="طباعة جدول الإهلاك أو حفظه كـ PDF"
            >
              <Printer className="h-4 w-4" />
              طباعة / PDF
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Asset Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
              <span className="text-slate-400">التكلفة التاريخية:</span>
              <div className="text-sm font-bold text-white font-mono-numbers mt-1">
                {formatNumber(totalCost)} {currency}
              </div>
            </div>

            <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
              <span className="text-slate-400">قيمة الخردة / النفاية:</span>
              <div className="text-sm font-bold text-slate-300 font-mono-numbers mt-1">
                {formatNumber(asset.salvageValue)} {currency}
              </div>
            </div>

            <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
              <span className="text-slate-400">أساس الإهلاك:</span>
              <div className="text-sm font-bold text-slate-200 font-mono-numbers mt-1">
                {asset.depreciationMethod === 'straight_line' && getAssetDepreciationInputMode(asset) === 'rate' ? (
                  <>
                    <div className="text-sky-400">{asset.annualDepreciationRate}% سنوياً من الأساس القابل للإهلاك</div>
                    <div className="mt-1 text-[10px] text-slate-400">العمر المكافئ: {getEquivalentUsefulLifeYears(asset)} سنوات</div>
                  </>
                ) : `${getEquivalentUsefulLifeYears(asset)} سنوات`}
              </div>
            </div>

            <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
              <span className="text-slate-400">مجمع الإهلاك حتى اليوم:</span>
              <div className="text-sm font-bold text-amber-400 font-mono-numbers mt-1">
                {formatNumber(valuation.accumulatedDepreciation)} {currency}
              </div>
            </div>

            <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
              <span className="text-slate-400">صافي القيمة الدفترية الحالية:</span>
              <div className="text-sm font-bold text-emerald-400 font-mono-numbers mt-1">
                {formatNumber(valuation.netBookValue)} {currency}
              </div>
            </div>
          </div>

          {/* Method, Start Rule, and Progress Bar */}
          <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400">طريقة الإهلاك:</span>
                <span className="font-bold text-sky-400 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-800/60">
                  {methodInfo.ar}
                </span>
                <span className="text-slate-400 mr-2">سياسة بدء الإهلاك:</span>
                <span className="font-semibold text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-800/60">
                  {ruleInfo.label}
                </span>
              </div>
              <div className="text-slate-400">
                نسبة الإهلاك المحققة:{' '}
                <strong className="text-amber-400 font-mono-numbers">{formatPercent(valuation.depreciatedPercent)}</strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              ℹ️ {ruleInfo.desc}
            </p>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-600 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, valuation.depreciatedPercent)}%` }}
                title={`مجمع الإهلاك: ${formatPercent(valuation.depreciatedPercent)}`}
              />
              <div
                className="bg-emerald-600 h-full transition-all duration-500"
                style={{ width: `${Math.max(0, 100 - valuation.depreciatedPercent)}%` }}
                title={`صافي القيمة الدفترية المتبقية: ${formatPercent(100 - valuation.depreciatedPercent)}`}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span>تاريخ بدء الخدمة: <strong className="text-slate-300 font-mono-numbers">{formatDate(asset.inServiceDate || asset.purchaseDate)}</strong></span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span> مجمع الإهلاك</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> صافي القيمة المتبقية</span>
              </span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('annual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'annual'
                    ? 'bg-sky-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                الجدول السنوي الشامل ({schedule.length} سنوات)
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'monthly'
                    ? 'bg-sky-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                التوزيع الشهري التفصيلي (12 شهر)
              </button>
            </div>

            {viewMode === 'monthly' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">اختر السنة:</span>
                <select
                  value={selectedYearForMonthly}
                  onChange={(e) => setSelectedYearForMonthly(Number(e.target.value))}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-200"
                >
                  {schedule.map((s) => (
                    <option key={s.year} value={s.year}>
                      {s.periodLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* View Mode: Annual Schedule Table */}
          {viewMode === 'annual' ? (
            <div className="overflow-hidden rounded-xl bg-slate-950/60 border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">الفترة / السنة</th>
                    <th className="px-4 py-3 font-semibold">القيمة الدفترية أول المدة</th>
                    <th className="px-4 py-3 font-semibold">نسبة الإهلاك</th>
                    <th className="px-4 py-3 font-semibold text-amber-400">مصروف إهلاك الفترة</th>
                    <th className="px-4 py-3 font-semibold">مجمع الإهلاك حتى نهاية الفترة</th>
                    <th className="px-4 py-3 font-semibold text-emerald-400">صافي القيمة الدفترية آخر المدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {schedule.map((row) => (
                    <tr key={row.year} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-semibold text-slate-200 whitespace-nowrap">
                        {row.periodLabel}
                      </td>
                      <td className="px-4 py-3 font-mono-numbers text-slate-300">
                        {formatNumber(row.beginningBookValue)} {currency}
                      </td>
                      <td className="px-4 py-3 font-mono-numbers text-slate-400">
                        {row.ratePercent ? formatPercent(row.ratePercent) : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono-numbers font-bold text-amber-400">
                        {formatNumber(row.depreciationExpense)} {currency}
                      </td>
                      <td className="px-4 py-3 font-mono-numbers text-slate-200">
                        {formatNumber(row.accumulatedDepreciation)} {currency}
                      </td>
                      <td className="px-4 py-3 font-mono-numbers font-bold text-emerald-400">
                        {formatNumber(row.endingBookValue)} {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 border-t border-slate-800 font-semibold text-slate-200">
                  <tr>
                    <td className="px-4 py-3">المجموع الكلي:</td>
                    <td className="px-4 py-3 font-mono-numbers text-slate-400">-</td>
                    <td className="px-4 py-3 font-mono-numbers text-slate-400">-</td>
                    <td className="px-4 py-3 font-mono-numbers text-amber-400">
                      {formatNumber(schedule.reduce((acc, r) => acc + r.depreciationExpense, 0))} {currency}
                    </td>
                    <td className="px-4 py-3 font-mono-numbers text-slate-300">
                      {formatNumber(schedule[schedule.length - 1]?.accumulatedDepreciation || 0)} {currency}
                    </td>
                    <td className="px-4 py-3 font-mono-numbers text-emerald-400">
                      {formatNumber(schedule[schedule.length - 1]?.endingBookValue || 0)} {currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            /* View Mode: Monthly Breakdown */
            <div className="overflow-hidden rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="bg-slate-900 px-4 py-2 text-xs text-slate-300 flex items-center justify-between">
                <span>توزيع إهلاك شهور السنة {selectedYearForMonthly} ({yearStart})</span>
                <span className="font-mono-numbers text-amber-400">
                  القسط السنوي: {formatNumber(activeYearRow?.depreciationExpense || 0)} {currency}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
                {months.map((mName, idx) => {
                  const mAcc = (activeYearRow?.beginningBookValue || 0) - monthlyExpense * (idx + 1);
                  return (
                    <div key={idx} className="rounded-xl bg-slate-900 p-3 border border-slate-800 space-y-1">
                      <div className="text-[11px] font-bold text-sky-400">{mName}</div>
                      <div className="text-xs text-slate-400">
                        مصروف الشهر:{' '}
                        <span className="font-bold text-amber-400 font-mono-numbers">
                          {formatNumber(monthlyExpense)} {currency}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers pt-1 border-t border-slate-800">
                        القيمة الدفترية نهاية الشهر: {formatNumber(Math.max(asset.salvageValue, mAcc))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-6 py-3">
          <div className="text-[11px] text-slate-400">
            * يتم الالتزام بحد قيمة الخردة {formatNumber(asset.salvageValue)} {currency} بحيث لا ينخفض صافي القيمة الدفترية عنها.
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
