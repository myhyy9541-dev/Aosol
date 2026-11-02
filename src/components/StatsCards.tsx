import React from 'react';
import { Landmark, TrendingDown, DollarSign, Wallet, ShieldCheck, AlertCircle } from 'lucide-react';
import { Asset } from '../types/asset';
import { getCurrentAssetValuation, getTotalCost } from '../utils/depreciation';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

interface StatsCardsProps {
  assets: Asset[];
  currency?: string;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ assets, currency = 'ر.س' }) => {
  let totalCost = 0;
  let totalAccumulated = 0;
  let totalNetBookValue = 0;
  let currentYearExpense = 0;

  let activeCount = 0;
  let fullyDepreciatedCount = 0;
  let disposedCount = 0;

  assets.forEach((asset) => {
    const cost = getTotalCost(asset);
    const valuation = getCurrentAssetValuation(asset);

    if (asset.status === 'disposed') {
      disposedCount++;
    } else {
      totalCost += cost;
      totalAccumulated += valuation.accumulatedDepreciation;
      totalNetBookValue += valuation.netBookValue;
      currentYearExpense += valuation.currentYearExpense;

      if (valuation.isFullyDepreciated) {
        fullyDepreciatedCount++;
      } else {
        activeCount++;
      }
    }
  });

  const overallDepreciationRatio = totalCost > 0 ? (totalAccumulated / totalCost) * 100 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Capitalized Cost */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 border border-slate-700/70 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">إجمالي التكلفة الرأسمالية</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Landmark className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold text-white tracking-tight font-mono-numbers">
            {formatNumber(totalCost)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>العملة: {currency}</span>
            <span className="text-slate-300 font-medium font-mono-numbers">{assets.length - disposedCount} أصل قيد الاستخدام</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-sky-500/5 pointer-events-none" />
      </div>

      {/* 2. Total Accumulated Depreciation */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 border border-slate-700/70 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">إجمالي مجمع الإهلاك حتى اليوم</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold text-amber-400 tracking-tight font-mono-numbers">
            {formatNumber(totalAccumulated)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>نسبة الاستهلاك: <strong className="text-amber-300 font-mono-numbers">{formatPercent(overallDepreciationRatio)}</strong></span>
            <span>{currency}</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-amber-500/5 pointer-events-none" />
      </div>

      {/* 3. Net Book Value */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 border border-slate-700/70 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">صافي القيمة الدفترية (NBV)</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold text-emerald-400 tracking-tight font-mono-numbers">
            {formatNumber(totalNetBookValue)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>القيمة المتبقية بالدفاتر</span>
            <span className="text-emerald-300 font-mono-numbers">{formatPercent(100 - overallDepreciationRatio)}</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-emerald-500/5 pointer-events-none" />
      </div>

      {/* 4. Current Year Depreciation Expense */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 border border-slate-700/70 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">مصروف إهلاك السنة الحالية</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold text-purple-300 tracking-tight font-mono-numbers">
            {formatNumber(currentYearExpense)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>محمل على قائمة الدخل</span>
            <span className="text-purple-300 font-mono-numbers">{currency} / سنة</span>
          </div>
        </div>
        <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-purple-500/5 pointer-events-none" />
      </div>
    </div>
  );
};
