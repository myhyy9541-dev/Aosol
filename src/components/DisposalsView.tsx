import React from 'react';
import { TrendingDown, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Printer, ShieldAlert } from 'lucide-react';
import { Asset } from '../types/asset';
import { getTotalCost } from '../utils/depreciation';
import { exportDisposalsReportToExcel } from '../utils/excel';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface DisposalsViewProps {
  assets: Asset[];
  currency: string;
  onRestoreAsset: (assetId: string) => void;
}

export const DisposalsView: React.FC<DisposalsViewProps> = ({ assets, currency, onRestoreAsset }) => {
  const disposedAssets = assets.filter((a) => a.status === 'disposed' && a.disposal);

  let totalSalesProceeds = 0;
  let totalDisposalCosts = 0;
  let totalNetGainLoss = 0;
  let totalOriginalCost = 0;

  disposedAssets.forEach((a) => {
    const d = a.disposal!;
    totalSalesProceeds += d.salePrice || 0;
    totalDisposalCosts += d.disposalCosts || 0;
    totalNetGainLoss += d.gainLoss || 0;
    totalOriginalCost += getTotalCost(a);
  });

  const handleExportExcel = () => {
    exportDisposalsReportToExcel(disposedAssets, currency, 'سجل استبعاد وبيع الأصول الثابتة');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-slate-800/80 p-5 border border-slate-700/70 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-400" />
            سجل استبعاد وتخريد وبيع الأصول الثابتة
          </h2>
          <p className="text-xs text-slate-400">
            تتبع عمليات بيع وتخريد الأصول وحساب الأرباح والخسائر الرأسمالية المحاسبية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold transition shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            تصدير الاستبعادات إلى إكسل
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 px-3.5 py-2 text-xs font-semibold transition"
          >
            <Printer className="h-4 w-4" />
            طباعة / PDF
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-800/80 p-4 border border-slate-700">
          <span className="text-xs text-slate-400 font-semibold">عدد الأصول المستبعدة</span>
          <div className="text-2xl font-black text-white font-mono-numbers mt-1">{disposedAssets.length} أصل</div>
        </div>

        <div className="rounded-2xl bg-slate-800/80 p-4 border border-slate-700">
          <span className="text-xs text-slate-400 font-semibold">إجمالي حصيلة البيع المقبوضة</span>
          <div className="text-2xl font-black text-white font-mono-numbers mt-1">
            {formatNumber(totalSalesProceeds)} {currency}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-800/80 p-4 border border-slate-700">
          <span className="text-xs text-slate-400 font-semibold">مصروفات ورسوم البيع</span>
          <div className="text-2xl font-black text-amber-400 font-mono-numbers mt-1">
            {formatNumber(totalDisposalCosts)} {currency}
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 border ${
            totalNetGainLoss >= 0 ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-rose-950/40 border-rose-800/60'
          }`}
        >
          <span className="text-xs text-slate-300 font-semibold">صافي الأرباح / الخسائر الرأسمالية</span>
          <div
            className={`text-2xl font-black font-mono-numbers mt-1 ${
              totalNetGainLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalNetGainLoss > 0 ? '+' : ''}
            {formatNumber(totalNetGainLoss)} {currency}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-slate-800/80 border border-slate-700 shadow-lg">
        {disposedAssets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <ShieldAlert className="h-10 w-10 text-slate-500 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">لا توجد أصول مستبعدة أو مباعة حالياً</div>
            <p className="text-xs text-slate-500">
              يمكنك استبعاد أو بيع أي أصل من زر الإجراءات في سجل الأصول.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">كود الأصل</th>
                  <th className="p-3.5">اسم الأصل</th>
                  <th className="p-3.5">تاريخ الاستبعاد</th>
                  <th className="p-3.5">نوع الاستبعاد</th>
                  <th className="p-3.5">سعر البيع</th>
                  <th className="p-3.5">القيمة الدفترية وقت البيع</th>
                  <th className="p-3.5">أرباح / خسائر رأسمالية</th>
                  <th className="p-3.5">المشتري / الملاحظات</th>
                  <th className="p-3.5 text-center">إلغاء الاستبعاد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {disposedAssets.map((asset) => {
                  const d = asset.disposal!;
                  const isGain = d.gainLoss >= 0;
                  return (
                    <tr key={asset.id} className="hover:bg-slate-750">
                      <td className="p-3.5 font-mono-numbers text-sky-400 font-semibold">{asset.code}</td>
                      <td className="p-3.5 font-medium text-slate-100">{asset.name}</td>
                      <td className="p-3.5 font-mono-numbers text-slate-300">{d.disposalDate}</td>
                      <td className="p-3.5">
                        <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-700">
                          {d.disposalType === 'sale' ? 'بيع نقدي' : d.disposalType === 'scrap' ? 'تخريد' : d.disposalType}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono-numbers text-white font-semibold">
                        {formatNumber(d.salePrice)} {currency}
                      </td>
                      <td className="p-3.5 font-mono-numbers text-slate-300">
                        {formatNumber(d.bookValueAtDisposal)} {currency}
                      </td>
                      <td className="p-3.5 font-mono-numbers font-bold">
                        <span
                          className={`flex items-center gap-1 ${
                            isGain ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isGain ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {d.gainLoss > 0 ? '+' : ''}
                          {formatNumber(d.gainLoss)} {currency}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <div>{d.buyerName || '-'}</div>
                        {d.reason && <div className="text-[10px] text-slate-400">{d.reason}</div>}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => onRestoreAsset(asset.id)}
                          className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition"
                          title="إعادة تنشيط الأصل وإلغاء الاستبعاد"
                        >
                          استعادة الأصل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
