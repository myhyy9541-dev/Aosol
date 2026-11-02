import React, { useState } from 'react';
import { X, TrendingDown, DollarSign, AlertTriangle, CheckCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Asset, AssetDisposal } from '../types/asset';
import { calculateDisposalGainLoss, getCurrentAssetValuation, getTotalCost } from '../utils/depreciation';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';

interface DisposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onConfirmDisposal: (assetId: string, disposal: AssetDisposal) => void;
  currency: string;
}

export const DisposalModal: React.FC<DisposalModalProps> = ({
  isOpen,
  onClose,
  asset,
  onConfirmDisposal,
  currency,
}) => {
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [disposalType, setDisposalType] = useState<'sale' | 'scrap' | 'donation' | 'loss'>('sale');
  const [salePrice, setSalePrice] = useState<number | string>(0);
  const [disposalCosts, setDisposalCosts] = useState<number | string>(0);
  const [buyerName, setBuyerName] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen || !asset) return null;

  const totalCost = getTotalCost(asset);
  const valuation = getCurrentAssetValuation(asset, new Date(disposalDate));
  const currentNBV = valuation.netBookValue;
  const currentAcc = valuation.accumulatedDepreciation;

  const numSale = Number(salePrice) || 0;
  const numCosts = Number(disposalCosts) || 0;
  const gainLossCalc = calculateDisposalGainLoss(totalCost, currentAcc, numSale, numCosts);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const disposalRecord: AssetDisposal = {
      disposalDate,
      disposalType,
      salePrice: numSale,
      disposalCosts: numCosts,
      bookValueAtDisposal: currentNBV,
      accumulatedAtDisposal: currentAcc,
      gainLoss: gainLossCalc.gainLoss,
      buyerName: buyerName.trim() || undefined,
      reason: reason.trim() || undefined,
    };

    onConfirmDisposal(asset.id, disposalRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">استبعاد / بيع / تخريد الأصل</h2>
              <p className="text-xs text-slate-400 font-mono-numbers">{asset.code} - {asset.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Asset Current Status Box */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-950/60 p-4 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">التكلفة التاريخية:</span>
              <div className="text-sm font-bold text-white font-mono-numbers mt-0.5">
                {formatNumber(totalCost)} {currency}
              </div>
            </div>
            <div>
              <span className="text-slate-400">مجمع الإهلاك حتى تاريخه:</span>
              <div className="text-sm font-bold text-amber-400 font-mono-numbers mt-0.5">
                {formatNumber(currentAcc)} {currency}
              </div>
            </div>
            <div>
              <span className="text-slate-400">صافي القيمة الدفترية الحالية:</span>
              <div className="text-sm font-bold text-emerald-400 font-mono-numbers mt-0.5">
                {formatNumber(currentNBV)} {currency}
              </div>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Disposal Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                تاريخ الاستبعاد / البيع: <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={disposalDate}
                onChange={(e) => setDisposalDate(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Disposal Type */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">طريقة ونوع الاستبعاد:</label>
              <select
                value={disposalType}
                onChange={(e) => setDisposalType(e.target.value as any)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="sale">بيع نقدي / لأجل (Sale)</option>
                <option value="scrap">تخريد وبيع كخردة (Scrap)</option>
                <option value="loss">إتلاف أو فقدان أو حادث (Loss / Write-off)</option>
                <option value="donation">تبرع أو تنازل (Donation)</option>
              </select>
            </div>

            {/* Sale Price */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                سعر البيع المقبوض ({currency}):
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Disposal Costs */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                مصروفات البيع والنقل والرسوم ({currency}):
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={disposalCosts}
                onChange={(e) => setDisposalCosts(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Buyer Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">اسم المشتري / الجهة المستلمة:</label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                placeholder="اسم العميل أو شركة الخردة"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">سبب الاستبعاد أو ملاحظات:</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                placeholder="انتهاء الجدوى، استبدال بجديد، تلف غير اقتصادي إصلاحه..."
              />
            </div>
          </div>

          {/* Capital Gain / Loss Calculation Card */}
          <div
            className={`rounded-xl p-4 border transition-all ${
              gainLossCalc.isGain
                ? 'bg-emerald-950/40 border-emerald-800/60'
                : 'bg-rose-950/40 border-rose-800/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {gainLossCalc.isGain ? (
                  <ArrowUpRight className="h-6 w-6 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-6 w-6 text-rose-400" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {gainLossCalc.isGain
                      ? 'أرباح رأسمالية من الاستبعاد (Capital Gain)'
                      : 'خسائر رأسمالية من الاستبعاد (Capital Loss)'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    صافي المتحصلات ({formatNumber(gainLossCalc.netProceeds)}) - صافي القيمة الدفترية ({formatNumber(currentNBV)})
                  </div>
                </div>
              </div>

              <div
                className={`text-xl font-extrabold font-mono-numbers ${
                  gainLossCalc.isGain ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {gainLossCalc.gainLoss > 0 ? '+' : ''}
                {formatNumber(gainLossCalc.gainLoss)} {currency}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-900/30 hover:from-amber-400 hover:to-amber-500 transition"
            >
              تأكيد استبعاد الأصل وترحيل الأرباح/الخسائر
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
