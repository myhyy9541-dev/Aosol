import React, { useState, useMemo } from 'react';
import { Calculator, Sparkles, TrendingDown, Layers, HelpCircle, ArrowRight, BarChart3 } from 'lucide-react';
import { calculateSchedule } from '../utils/depreciation';
import { Asset } from '../types/asset';
import { formatNumber, formatPercent } from '../utils/formatters';

interface DepreciationCalculatorWidgetProps {
  currency: string;
}

export const DepreciationCalculatorWidget: React.FC<DepreciationCalculatorWidgetProps> = ({ currency }) => {
  const [cost, setCost] = useState<number>(100000);
  const [salvage, setSalvage] = useState<number>(10000);
  const [lifeYears, setLifeYears] = useState<number>(5);

  const mockAssetBase = useMemo<Omit<Asset, 'depreciationMethod'>>(() => ({
    id: 'sim',
    code: 'SIM-01',
    name: 'أصل افتراضي للمقارنة',
    category: 'machinery',
    purchaseDate: '2024-01-01',
    inServiceDate: '2024-01-01',
    purchaseCost: Number(cost) || 0,
    additionalCosts: 0,
    salvageValue: Number(salvage) || 0,
    usefulLifeYears: Math.max(1, Number(lifeYears) || 1),
    status: 'active',
    startDepreciationRule: 'mid_month_15',
    location: '',
    department: '',
    custodian: '',
    createdAt: '',
    updatedAt: '',
  }), [cost, salvage, lifeYears]);

  const scheduleStraight = useMemo(() => {
    return calculateSchedule({ ...mockAssetBase, depreciationMethod: 'straight_line' });
  }, [mockAssetBase]);

  const scheduleDDB = useMemo(() => {
    return calculateSchedule({ ...mockAssetBase, depreciationMethod: 'double_declining' });
  }, [mockAssetBase]);

  const schedule150 = useMemo(() => {
    return calculateSchedule({ ...mockAssetBase, depreciationMethod: 'declining_150' });
  }, [mockAssetBase]);

  const scheduleSYD = useMemo(() => {
    return calculateSchedule({ ...mockAssetBase, depreciationMethod: 'sum_of_years' });
  }, [mockAssetBase]);

  const maxExpense = useMemo(() => {
    const all = [
      ...scheduleStraight.map((s) => s.depreciationExpense),
      ...scheduleDDB.map((s) => s.depreciationExpense),
      ...schedule150.map((s) => s.depreciationExpense),
      ...scheduleSYD.map((s) => s.depreciationExpense),
    ];
    return Math.max(...all, 1);
  }, [scheduleStraight, scheduleDDB, schedule150, scheduleSYD]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-slate-800/80 p-5 border border-slate-700/70 shadow-md">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Calculator className="h-5 w-5 text-sky-400" />
          حاسبة ومقارنة طرق الإهلاك المحاسبية جنباً إلى جنب
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          أدخل تكلفة الأصل والعمر الإنتاجي لمقارنة أثر كل طريقة على قائمة الدخل وصافي القيمة الدفترية عبر السنوات
        </p>

        {/* Input Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700/60 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              تكلفة الأصل الإجمالية ({currency}):
            </label>
            <input
              type="number"
              min="1"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              قيمة الخردة / النفاية ({currency}):
            </label>
            <input
              type="number"
              min="0"
              value={salvage}
              onChange={(e) => setSalvage(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              العمر الإنتاجي (بالسنوات):
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={lifeYears}
              onChange={(e) => setLifeYears(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Methods Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl bg-slate-800/80 p-4 border border-sky-500/40 shadow">
          <div className="text-[11px] font-bold text-sky-400">القسط الثابت (Straight-Line)</div>
          <div className="text-lg font-black text-white font-mono-numbers mt-1">
            {formatNumber(scheduleStraight[0]?.depreciationExpense || 0)} {currency}/سنة
          </div>
          <p className="text-[11px] text-slate-400 mt-1">قسط متساوي ثابت يوزع العبء بانتظام على كل سنة.</p>
        </div>

        <div className="rounded-xl bg-slate-800/80 p-4 border border-amber-500/40 shadow">
          <div className="text-[11px] font-bold text-amber-400">القسط المتناقص المضاعف 200%</div>
          <div className="text-lg font-black text-amber-400 font-mono-numbers mt-1">
            {formatNumber(scheduleDDB[0]?.depreciationExpense || 0)} {currency} (سنة ١)
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تحميل أعلى قسط في السنة الأولى ثم يتناقص تدريجياً.</p>
        </div>

        <div className="rounded-xl bg-slate-800/80 p-4 border border-purple-500/40 shadow">
          <div className="text-[11px] font-bold text-purple-400">القسط المتناقص 150%</div>
          <div className="text-lg font-black text-purple-300 font-mono-numbers mt-1">
            {formatNumber(schedule150[0]?.depreciationExpense || 0)} {currency} (سنة ١)
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تسارع معتدل مناسب للأصول ذات التدهور الفني المتوسط.</p>
        </div>

        <div className="rounded-xl bg-slate-800/80 p-4 border border-emerald-500/40 shadow">
          <div className="text-[11px] font-bold text-emerald-400">مجموع أرقام السنين (SYD)</div>
          <div className="text-lg font-black text-emerald-400 font-mono-numbers mt-1">
            {formatNumber(scheduleSYD[0]?.depreciationExpense || 0)} {currency} (سنة ١)
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تناقص تدريجي ناعم بحسب كسر السنوات المتبقية.</p>
        </div>
      </div>

      {/* Side-by-Side Comparison Table */}
      <div className="overflow-hidden rounded-2xl bg-slate-800/80 border border-slate-700 shadow-lg">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            مقارنة مصروف الإهلاك السنوي بين الطرق الأربعة
          </span>
          <span className="text-xs text-slate-400 font-mono-numbers">
            القيمة الخاضعة للإهلاك: {formatNumber(Math.max(0, cost - salvage))} {currency}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/70 text-slate-300 border-b border-slate-700">
              <tr>
                <th className="p-3">السنة</th>
                <th className="p-3 text-sky-400">القسط الثابت</th>
                <th className="p-3 text-amber-400">المتناقص المضاعف 200%</th>
                <th className="p-3 text-purple-300">المتناقص 150%</th>
                <th className="p-3 text-emerald-400">مجموع أرقام السنين SYD</th>
                <th className="p-3">مخطط المقارنة النسبي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {Array.from({ length: Math.max(1, lifeYears) }).map((_, i) => {
                const yearNum = i + 1;
                const sl = scheduleStraight[i]?.depreciationExpense || 0;
                const ddb = scheduleDDB[i]?.depreciationExpense || 0;
                const p150 = schedule150[i]?.depreciationExpense || 0;
                const syd = scheduleSYD[i]?.depreciationExpense || 0;

                return (
                  <tr key={yearNum} className="hover:bg-slate-750">
                    <td className="p-3 font-bold text-white font-mono-numbers">السنة {yearNum}</td>
                    <td className="p-3 font-mono-numbers text-sky-300 font-semibold">{formatNumber(sl)}</td>
                    <td className="p-3 font-mono-numbers text-amber-400 font-semibold">{formatNumber(ddb)}</td>
                    <td className="p-3 font-mono-numbers text-purple-300 font-semibold">{formatNumber(p150)}</td>
                    <td className="p-3 font-mono-numbers text-emerald-400 font-semibold">{formatNumber(syd)}</td>
                    <td className="p-3 w-48">
                      <div className="flex flex-col gap-1">
                        <div className="h-1.5 bg-sky-500 rounded" style={{ width: `${(sl / maxExpense) * 100}%` }} title="القسط الثابت" />
                        <div className="h-1.5 bg-amber-500 rounded" style={{ width: `${(ddb / maxExpense) * 100}%` }} title="المتناقص 200%" />
                        <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${(syd / maxExpense) * 100}%` }} title="مجموع السنين" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
