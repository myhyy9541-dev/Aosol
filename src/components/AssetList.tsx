import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  Tag, 
  Eye, 
  Edit3, 
  Trash2, 
  TrendingDown, 
  CheckCircle, 
  AlertCircle,
  Building,
  ArrowUpDown,
  MoreVertical,
  Layers,
  MapPin,
  UserCheck,
  Download
} from 'lucide-react';
import { Asset, AssetCategory, DepreciationMethod, AssetStatus } from '../types/asset';
import { getAssetDepreciationInputMode, getCurrentAssetValuation, getEquivalentUsefulLifeYears, getTotalCost } from '../utils/depreciation';
import { formatCurrency, formatDate, formatNumber, formatPercent, getMethodLabel, getStartRuleLabel, getStatusBadge } from '../utils/formatters';
import { downloadExcelTemplate } from '../utils/excel';

interface AssetListProps {
  assets: Asset[];
  categories: AssetCategory[];
  currency: string;
  onAddNew: () => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onViewSchedule: (asset: Asset) => void;
  onDispose: (asset: Asset) => void;
  onExportExcel: (filteredAssets: Asset[]) => void;
  onPrintReport: (filteredAssets: Asset[]) => void;
}

export const AssetList: React.FC<AssetListProps> = ({
  assets,
  categories,
  currency,
  onAddNew,
  onEdit,
  onDelete,
  onViewSchedule,
  onDispose,
  onExportExcel,
  onPrintReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'cost_desc' | 'nbv_desc' | 'code' | 'name'>('date_desc');

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Extract all unique departments present
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.department) set.add(a.department.trim());
    });
    return Array.from(set);
  }, [assets]);

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Search
      const search = searchTerm.trim().toLowerCase();
      const matchSearch =
        !search ||
        asset.name.toLowerCase().includes(search) ||
        asset.code.toLowerCase().includes(search) ||
        (asset.department && asset.department.toLowerCase().includes(search)) ||
        (asset.location && asset.location.toLowerCase().includes(search)) ||
        (asset.custodian && asset.custodian.toLowerCase().includes(search)) ||
        (asset.serialNumber && asset.serialNumber.toLowerCase().includes(search));

      // Category
      const matchCat = selectedCategory === 'all' || asset.category === selectedCategory;

      // Department
      const matchDept = selectedDepartment === 'all' || asset.department === selectedDepartment;

      // Method
      const matchMethod = selectedMethod === 'all' || asset.depreciationMethod === selectedMethod;

      // Status
      let matchStatus = true;
      if (selectedStatus === 'active') matchStatus = asset.status === 'active';
      else if (selectedStatus === 'disposed') matchStatus = asset.status === 'disposed';
      else if (selectedStatus === 'fully') {
        const val = getCurrentAssetValuation(asset);
        matchStatus = val.isFullyDepreciated && asset.status !== 'disposed';
      }

      return matchSearch && matchCat && matchDept && matchMethod && matchStatus;
    }).sort((a, b) => {
      if (sortBy === 'cost_desc') return getTotalCost(b) - getTotalCost(a);
      if (sortBy === 'nbv_desc') {
        return getCurrentAssetValuation(b).netBookValue - getCurrentAssetValuation(a).netBookValue;
      }
      if (sortBy === 'code') return a.code.localeCompare(b.code);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      // default: date desc
      return new Date(b.inServiceDate || b.purchaseDate).getTime() - new Date(a.inServiceDate || a.purchaseDate).getTime();
    });
  }, [assets, searchTerm, selectedCategory, selectedDepartment, selectedMethod, selectedStatus, sortBy]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl bg-slate-800/80 p-4 border border-slate-700/70 shadow-md">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="البحث بالاسم، الكود، الإدارة/القسم، الموقع، أو اسم المسؤول..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl bg-slate-900/90 pr-10 pl-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 border border-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                مسح
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onAddNew}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-900/40 hover:from-sky-400 hover:to-blue-500 transition"
            >
              <Plus className="h-4 w-4" />
              إضافة أصل جديد
            </button>

            <button
              onClick={() => onExportExcel(filteredAssets)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-900/40 border border-emerald-700/60 px-3.5 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-800/50 transition"
              title="تصدير الأصول المفلترة إلى ملف إكسل"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              تصدير إكسل ({filteredAssets.length})
            </button>

            <button
              onClick={() => onPrintReport(filteredAssets)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-700/50 border border-slate-600 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              title="طباعة سجل الأصول أو الحفظ كـ PDF"
            >
              <Printer className="h-4 w-4 text-slate-300" />
              طباعة / PDF
            </button>

            <button
              onClick={() => downloadExcelTemplate('with_sample')}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="تحميل نموذج إكسل معتمد مطابق للتطبيق لتعبئة الأصول"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              نموذج إكسل
            </button>
          </div>
        </div>

        {/* Filter Pills / Selects - 5 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-slate-700/50 text-xs">
          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">الإدارة / القسم:</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">كافة الإدارات ({assets.length})</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">الفئة والتصنيف:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">جميع الفئات ({assets.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Method Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">طريقة الإهلاك:</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">جميع طرق الإهلاك</option>
              <option value="straight_line">القسط الثابت</option>
              <option value="double_declining">القسط المتناقص المضاعف 200%</option>
              <option value="declining_150">القسط المتناقص 150%</option>
              <option value="sum_of_years">مجموع أرقام السنين</option>
              <option value="units_of_production">وحدات الإنتاج والنشاط</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">حالة الأصل:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشط قيد الاستخدام</option>
              <option value="fully">مُهلك بالكامل (قيمة دفترية = خردة)</option>
              <option value="disposed">مستبعد / مباع / مخرّد</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">الترتيب حسب:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="date_desc">تاريخ التشغيل (الأحدث)</option>
              <option value="cost_desc">التكلفة الرأسمالية (الأعلى)</option>
              <option value="nbv_desc">صافي القيمة الدفترية (الأعلى)</option>
              <option value="code">كود الأصل</option>
              <option value="name">اسم الأصل أبجدياً</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="overflow-hidden rounded-2xl bg-slate-800/80 border border-slate-700/70 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-3.5 py-3.5 font-semibold">كود الأصل</th>
                <th className="px-3.5 py-3.5 font-semibold">اسم الأصل</th>
                <th className="px-3.5 py-3.5 font-semibold text-emerald-400">الإدارة / القسم</th>
                <th className="px-3.5 py-3.5 font-semibold text-sky-400">تصنيف الأصل</th>
                <th className="px-3.5 py-3.5 font-semibold">تاريخ التشغيل والعمر</th>
                <th className="px-3.5 py-3.5 font-semibold">طريقة وسياسة الإهلاك</th>
                <th className="px-3.5 py-3.5 font-semibold">التكلفة التاريخية</th>
                <th className="px-3.5 py-3.5 font-semibold">مجمع الإهلاك</th>
                <th className="px-3.5 py-3.5 font-semibold">صافي القيمة الدفترية</th>
                <th className="px-3.5 py-3.5 font-semibold">الحالة</th>
                <th className="px-3.5 py-3.5 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-slate-500" />
                      <p className="text-sm font-medium text-slate-300">لا توجد أصول مطابقة لمعايير البحث والفلترة</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedDepartment('all');
                          setSelectedCategory('all');
                          setSelectedMethod('all');
                          setSelectedStatus('all');
                        }}
                        className="text-xs text-sky-400 underline hover:text-sky-300 mt-1"
                      >
                        إعادة ضبط جميع الفلاتر
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const totalCost = getTotalCost(asset);
                  const valuation = getCurrentAssetValuation(asset);
                  const methodInfo = getMethodLabel(asset.depreciationMethod);
                  const statusInfo = getStatusBadge(asset.status);
                  const catName = catMap.get(asset.category) || asset.category;

                  return (
                    <tr 
                      key={asset.id} 
                      className={`hover:bg-slate-750/50 transition-colors ${
                        asset.status === 'disposed' ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Code */}
                      <td className="px-3.5 py-3 font-mono-numbers font-semibold text-sky-400 whitespace-nowrap">
                        {asset.code}
                      </td>

                      {/* Name & Details */}
                      <td className="px-3.5 py-3">
                        <div className="font-semibold text-slate-100">{asset.name}</div>
                        {asset.custodian && (
                          <div className="flex items-center gap-0.5 text-[11px] text-slate-400 mt-0.5">
                            <UserCheck className="h-3 w-3 text-slate-500 inline ml-0.5" />
                            العهدة: {asset.custodian}
                          </div>
                        )}
                      </td>

                      {/* Department */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 px-2 py-1 text-[11px] font-medium text-emerald-300">
                          <Building className="h-3 w-3 text-emerald-400" />
                          {asset.department || 'الإدارة العامة'}
                        </span>
                      </td>

                      {/* Dedicated Category / Classification Cell */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-sky-950/70 border border-sky-800/60 px-2 py-1 text-[11px] font-semibold text-sky-300">
                          <Tag className="h-3 w-3 text-sky-400" />
                          {catName}
                        </span>
                      </td>

                      {/* In-service date and Life */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono-numbers text-slate-200">
                          {formatDate(asset.inServiceDate || asset.purchaseDate)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-numbers mt-0.5">
                          {asset.depreciationMethod === 'straight_line' && getAssetDepreciationInputMode(asset) === 'rate' ? (
                            <>
                              <span className="block text-sky-400">المعدل السنوي: {asset.annualDepreciationRate}%</span>
                              <span className="block">العمر المكافئ: {getEquivalentUsefulLifeYears(asset)} سنوات</span>
                            </>
                          ) : `العمر: ${getEquivalentUsefulLifeYears(asset)} سنوات`}
                        </div>
                      </td>

                      {/* Method & 15-Day Rule */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-block rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700">
                          {methodInfo.short}
                        </span>
                        <div className="mt-1">
                          {asset.startDepreciationRule === 'mid_month_15' ? (
                            <span 
                              className="inline-flex items-center gap-1 rounded bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 text-[10px] text-amber-300 font-semibold"
                              title="قاعدة 15 من الشهر (قبل 15: إهلاك نفس الشهر، بعد 15: إهلاك الشهر التالي)"
                            >
                              ⚖️ قاعدة 15 يوم
                            </span>
                          ) : asset.startDepreciationRule === 'next_month' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-950/70 border border-purple-800/60 px-1.5 py-0.5 text-[10px] text-purple-300">
                              الشهر التالي
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-950/70 border border-blue-800/60 px-1.5 py-0.5 text-[10px] text-blue-300">
                              نفس الشهر
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Cost */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono-numbers font-semibold text-slate-100">
                        {formatNumber(totalCost)} {currency}
                      </td>

                      {/* Accumulated Depreciation */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono-numbers font-medium text-amber-400">
                          {formatNumber(valuation.accumulatedDepreciation)} {currency}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                          نسبة: {formatPercent(valuation.depreciatedPercent)}
                        </div>
                      </td>

                      {/* Net Book Value */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono-numbers font-bold text-emerald-400 text-sm">
                          {formatNumber(valuation.netBookValue)} {currency}
                        </div>
                        {asset.salvageValue > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono-numbers">
                            خردة: {formatNumber(asset.salvageValue)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${statusInfo.bg} ${statusInfo.textClass} ${statusInfo.border}`}
                        >
                          {statusInfo.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Schedule Modal */}
                          <button
                            onClick={() => onViewSchedule(asset)}
                            className="rounded-lg bg-sky-950/60 border border-sky-800/50 p-1.5 text-sky-400 hover:bg-sky-900/70 hover:text-white transition"
                            title="عرض جدول الإهلاك السنوي والشهري"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => onEdit(asset)}
                            className="rounded-lg bg-slate-700/60 border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition"
                            title="تعديل بيانات الأصل"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          {/* Dispose / Sell / Scrap */}
                          {asset.status !== 'disposed' && (
                            <button
                              onClick={() => onDispose(asset)}
                              className="rounded-lg bg-amber-950/60 border border-amber-800/50 p-1.5 text-amber-400 hover:bg-amber-900/70 hover:text-white transition"
                              title="استبعاد أو بيع أو تخريد الأصل وحساب الأرباح/الخسائر"
                            >
                              <TrendingDown className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => onDelete(asset.id)}
                            className="rounded-lg bg-rose-950/60 border border-rose-800/50 p-1.5 text-rose-400 hover:bg-rose-900/70 hover:text-white transition"
                            title="حذف الأصل نهائياً"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        {filteredAssets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between border-t border-slate-700 bg-slate-900/90 px-4 py-3 text-xs text-slate-400">
            <div>
              عرض <span className="font-semibold text-slate-200 font-mono-numbers">{filteredAssets.length}</span> من أصل{' '}
              <span className="font-semibold text-slate-200 font-mono-numbers">{assets.length}</span> أصل مسجل
            </div>

            <div className="flex items-center gap-4 text-xs font-mono-numbers">
              <span>
                إجمالي التكلفة المعروضة:{' '}
                <strong className="text-slate-100">
                  {formatNumber(filteredAssets.reduce((sum, a) => sum + getTotalCost(a), 0))} {currency}
                </strong>
              </span>
              <span>
                صافي القيمة الدفترية المعروضة:{' '}
                <strong className="text-emerald-400">
                  {formatNumber(filteredAssets.reduce((sum, a) => sum + getCurrentAssetValuation(a).netBookValue, 0))} {currency}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
