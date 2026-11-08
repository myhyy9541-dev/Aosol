import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, HelpCircle, Sparkles, Building, Check, Clock } from 'lucide-react';
import { Asset, AssetCategory, DepreciationMethod, DepreciationStartRule } from '../types/asset';
import { getEffectiveDepreciationStartDate, getTotalCost, isValidAnnualDepreciationRate } from '../utils/depreciation';
import { formatCurrency, formatNumber, formatPercent, getMethodLabel } from '../utils/formatters';
import { STANDARD_DEPARTMENTS } from '../utils/storage';

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: Asset) => void;
  categories: AssetCategory[];
  editingAsset?: Asset | null;
  currency: string;
}

export const AssetModal: React.FC<AssetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  editingAsset,
  currency,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.id || 'machinery');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [inServiceDate, setInServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDepreciationRule, setStartDepreciationRule] = useState<DepreciationStartRule>('mid_month_15');
  const [purchaseCost, setPurchaseCost] = useState<number | string>(50000);
  const [additionalCosts, setAdditionalCosts] = useState<number | string>(0);
  const [salvageValue, setSalvageValue] = useState<number | string>(2500);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number | string>(5);
  const [depreciationInputMode, setDepreciationInputMode] = useState<'years' | 'rate'>('rate');
  const [annualDepreciationRate, setAnnualDepreciationRate] = useState<number | string>(20);
  const [depreciationMethod, setDepreciationMethod] = useState<DepreciationMethod>('straight_line');
  
  // Units of production fields
  const [totalEstimatedUnits, setTotalEstimatedUnits] = useState<number | string>(10000);
  const [unitOfMeasure, setUnitOfMeasure] = useState('ساعة عمل');

  // Metadata
  const [department, setDepartment] = useState('الإدارة العامة');
  const [location, setLocation] = useState('المقر الرئيسي');
  const [custodian, setCustodian] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');

  // When editingAsset changes, populate form
  useEffect(() => {
    if (editingAsset) {
      setCode(editingAsset.code);
      setName(editingAsset.name);
      setCategory(editingAsset.category);
      setPurchaseDate(editingAsset.purchaseDate);
      setInServiceDate(editingAsset.inServiceDate || editingAsset.purchaseDate);
      setStartDepreciationRule(editingAsset.startDepreciationRule || 'mid_month_15');
      setPurchaseCost(editingAsset.purchaseCost);
      setAdditionalCosts(editingAsset.additionalCosts || 0);
      setSalvageValue(editingAsset.salvageValue || 0);
      setUsefulLifeYears(editingAsset.usefulLifeYears);
      setDepreciationInputMode(editingAsset.depreciationInputMode === 'rate' ? 'rate' : 'years');
      setAnnualDepreciationRate(editingAsset.annualDepreciationRate ?? 20);
      setDepreciationMethod(editingAsset.depreciationMethod);
      setTotalEstimatedUnits(editingAsset.totalEstimatedUnits || 10000);
      setUnitOfMeasure(editingAsset.unitOfMeasure || 'ساعة عمل');
      setDepartment(editingAsset.department || 'الإدارة العامة');
      setLocation(editingAsset.location || '');
      setCustodian(editingAsset.custodian || '');
      setSupplier(editingAsset.supplier || '');
      setInvoiceNumber(editingAsset.invoiceNumber || '');
      setSerialNumber(editingAsset.serialNumber || '');
      setNotes(editingAsset.notes || '');
    } else {
      // New asset defaults
      const randomCode = `AST-${Math.floor(1000 + Math.random() * 9000)}`;
      const defaultCategory = categories[0];
      const defaultLife = defaultCategory?.defaultLifeYears || 5;
      setCode(randomCode);
      setName('');
      setCategory(defaultCategory?.id || 'machinery');
      setPurchaseCost(5000000);
      setAdditionalCosts(0);
      setSalvageValue(250000);
      setUsefulLifeYears(defaultLife);
      setDepreciationInputMode('rate');
      setAnnualDepreciationRate(100 / defaultLife);
      setDepreciationMethod(defaultCategory?.defaultMethod || 'straight_line');
      setStartDepreciationRule('mid_month_15');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setInServiceDate(new Date().toISOString().split('T')[0]);
      setDepartment('الإدارة العامة');
      setLocation('المقر الرئيسي');
      setCustodian('');
      setSupplier('');
      setInvoiceNumber('');
      setSerialNumber('');
      setNotes('');
    }
  }, [editingAsset, isOpen]);

  // When category changes on new asset, auto-suggest defaults
  const handleCategoryChange = (newCatId: string) => {
    setCategory(newCatId);
    if (!editingAsset) {
      const cat = categories.find((c) => c.id === newCatId);
      if (cat) {
        setUsefulLifeYears(cat.defaultLifeYears);
        setAnnualDepreciationRate(cat.defaultLifeYears > 0 ? 100 / cat.defaultLifeYears : 20);
        setDepreciationMethod(cat.defaultMethod);
        const costNum = Number(purchaseCost) || 0;
        setSalvageValue(Math.round(costNum * (cat.defaultSalvagePercent / 100)));
      }
    }
  };

  const handleQuickSalvagePercent = (percent: number) => {
    const total = (Number(purchaseCost) || 0) + (Number(additionalCosts) || 0);
    setSalvageValue(Math.round(total * (percent / 100)));
  };

  // Quick calculations for preview
  const numCost = Number(purchaseCost) || 0;
  const numAdd = Number(additionalCosts) || 0;
  const totalCost = numCost + numAdd;
  const numSalvage = Math.min(Number(salvageValue) || 0, totalCost);
  const depreciableBase = Math.max(0, totalCost - numSalvage);
  const numYears = Math.max(1, Number(usefulLifeYears) || 1);
  const rateValue = Number(annualDepreciationRate);
  const isRateBasis = depreciationMethod === 'straight_line' && depreciationInputMode === 'rate';
  const rateIsValid = isValidAnnualDepreciationRate(rateValue);

  let previewAnnualExpense = 0;
  let previewMethodLabel = getMethodLabel(depreciationMethod).ar;

  if (depreciationMethod === 'straight_line') {
    previewAnnualExpense = isRateBasis
      ? (rateIsValid ? depreciableBase * rateValue / 100 : 0)
      : depreciableBase / numYears;
  } else if (depreciationMethod === 'double_declining') {
    previewAnnualExpense = totalCost * (2 / numYears);
  } else if (depreciationMethod === 'declining_150') {
    previewAnnualExpense = totalCost * (1.5 / numYears);
  } else if (depreciationMethod === 'sum_of_years') {
    const syd = (numYears * (numYears + 1)) / 2;
    previewAnnualExpense = depreciableBase * (numYears / syd);
  } else if (depreciationMethod === 'units_of_production') {
    const units = Math.max(1, Number(totalEstimatedUnits) || 1000);
    previewAnnualExpense = (depreciableBase / units) * (units / numYears);
  }

  const previewEffectiveStart = getEffectiveDepreciationStartDate({
    inServiceDate,
    purchaseDate,
    startDepreciationRule,
  } as Asset);
  const previewFirstYearRatio = Math.max(1, 12 - previewEffectiveStart.getMonth()) / 12;
  const previewFirstYearExpense = previewAnnualExpense * previewFirstYearRatio;
  const equivalentLifeYears = isRateBasis && rateIsValid ? 100 / rateValue : numYears;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى إدخال اسم الأصل.');
      return;
    }
    if (totalCost <= 0) {
      alert('يرجى إدخال تكلفة شراء صالحة للأصل.');
      return;
    }
    if (isRateBasis && !rateIsValid) {
      alert('يرجى إدخال نسبة إهلاك سنوية صحيحة بين 0.1% و100%.');
      return;
    }
    if (depreciationMethod === 'straight_line' && depreciationInputMode === 'years' && (!Number.isFinite(Number(usefulLifeYears)) || Number(usefulLifeYears) <= 0)) {
      alert('يرجى إدخال عمر إنتاجي صحيح أكبر من صفر.');
      return;
    }

    const assetData: Asset = {
      id: editingAsset ? editingAsset.id : `ast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      code: code.trim() || `AST-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category,
      purchaseDate,
      inServiceDate,
      purchaseCost: Number(purchaseCost) || 0,
      additionalCosts: Number(additionalCosts) || 0,
      salvageValue: Number(salvageValue) || 0,
      usefulLifeYears: isRateBasis && rateIsValid ? 100 / rateValue : Number(usefulLifeYears) || 1,
      depreciationInputMode: depreciationMethod === 'straight_line'
        ? editingAsset && !editingAsset.depreciationInputMode && depreciationInputMode === 'years'
          ? undefined
          : depreciationInputMode
        : undefined,
      annualDepreciationRate: isRateBasis && rateIsValid ? rateValue : undefined,
      depreciationMethod,
      startDepreciationRule,
      totalEstimatedUnits: depreciationMethod === 'units_of_production' ? Number(totalEstimatedUnits) || 10000 : undefined,
      unitOfMeasure: depreciationMethod === 'units_of_production' ? unitOfMeasure : undefined,
      department: department.trim() || 'الإدارة العامة',
      location: location.trim(),
      custodian: custodian.trim(),
      supplier: supplier.trim(),
      invoiceNumber: invoiceNumber.trim(),
      serialNumber: serialNumber.trim(),
      notes: notes.trim(),
      status: editingAsset ? editingAsset.status : 'active',
      disposal: editingAsset ? editingAsset.disposal : undefined,
      revaluations: editingAsset ? editingAsset.revaluations : undefined,
      createdAt: editingAsset ? editingAsset.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(assetData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {editingAsset ? `تعديل الأصل: ${editingAsset.name}` : 'إضافة أصل رأسمالي جديد'}
              </h2>
              <p className="text-xs text-slate-400">إدخال البيانات المالية وحساب جدول الإهلاك بدقة محاسبية كاملة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>١. البيانات الأساسية وتصنيف الأصل</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Asset Code */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  كود / باركود الأصل: <span className="text-rose-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                    placeholder="AST-001"
                  />
                  <button
                    type="button"
                    onClick={() => setCode(`AST-${Math.floor(1000 + Math.random() * 9000)}`)}
                    className="whitespace-nowrap px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-[11px]"
                    title="توليد كود تلقائي"
                  >
                    تلقائي
                  </button>
                </div>
              </div>

              {/* Asset Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  اسم الأصل ووصفه بالعربية: <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="مثال: شاحنة توزيع بضائع مبردة 2024"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">فئة وتصنيف الأصل:</label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  تاريخ الشراء: <span className="text-slate-400 text-[10px]">(English Date)</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => {
                    setPurchaseDate(e.target.value);
                    if (!inServiceDate) setInServiceDate(e.target.value);
                  }}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* In Service Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  تاريخ بدء التشغيل / الخدمة: <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={inServiceDate}
                  onChange={(e) => setInServiceDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 15-Day Cutoff Depreciation Convention Selector */}
            <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-sky-400" />
                  سياسة وتوقيت بدء احتساب إهلاك الأصل:
                </label>
                <span className="text-[11px] text-slate-300">
                  يوم بدء التشغيل: <strong className="text-sky-300 font-mono-numbers">{inServiceDate ? new Date(inServiceDate).getDate() : 1}</strong> من الشهر
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStartDepreciationRule('mid_month_15')}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    startDepreciationRule === 'mid_month_15'
                      ? 'border-sky-500 bg-sky-950/60 text-white ring-1 ring-sky-500 shadow-sm'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-sky-300">قاعدة 15 يوم (منتصف الشهر)</span>
                    <span className="text-[9px] bg-sky-900 text-sky-300 px-1 py-0.2 rounded">المعتمد محاسبياً</span>
                  </div>
                  <div className="text-[10px] text-slate-300 mt-1 leading-snug">
                    يوم 1-15: يحسب إهلاك نفس الشهر | يوم 16-نهاية الشهر: يضاف كأصل ويبدأ الإهلاك الشهر التالي
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStartDepreciationRule('same_month')}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    startDepreciationRule === 'same_month'
                      ? 'border-sky-500 bg-sky-950/60 text-white ring-1 ring-sky-500 shadow-sm'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-200">نفس الشهر كاملاً فوراً</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                    احتساب قسط شهر التشغيل كاملاً بغض النظر عن يوم الشراء
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStartDepreciationRule('next_month')}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    startDepreciationRule === 'next_month'
                      ? 'border-sky-500 bg-sky-950/60 text-white ring-1 ring-sky-500 shadow-sm'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-200">الشهر التالي دائماً</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                    يضاف الأصل في شهر الشراء ويبدأ الإهلاك من أول الشهر التالي
                  </div>
                </button>
              </div>

              {/* Live Rule Status Explanation */}
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0"></span>
                {startDepreciationRule === 'mid_month_15' && (
                  (inServiceDate ? new Date(inServiceDate).getDate() : 1) > 15 ? (
                    <span className="text-amber-300">
                      <strong>تطبيق القاعدة:</strong> تاريخ التشغيل يوم <strong>{new Date(inServiceDate).getDate()}</strong> (بعد يوم 15). سيتم إدراج الأصل بالدفاتر الآن، ويبدأ احتساب قسط الإهلاك اعتباراً من <strong>أول الشهر التالي</strong>.
                    </span>
                  ) : (
                    <span className="text-emerald-300">
                      <strong>تطبيق القاعدة:</strong> تاريخ التشغيل يوم <strong>{new Date(inServiceDate).getDate()}</strong> (من 1 إلى 15). سيتم احتساب إهلاك الشهر الحالي كاملاً للأصل.
                    </span>
                  )
                )}
                {startDepreciationRule === 'same_month' && (
                  <span className="text-slate-300">سيتم احتساب إهلاك الشهر الحالي كاملاً فوراً.</span>
                )}
                {startDepreciationRule === 'next_month' && (
                  <span className="text-slate-300">يضاف الأصل الآن كأصل ثابت ويبدأ احتساب الإهلاك من أول الشهر التالي.</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Financial Capitalization & Depreciation Engine */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>٢. التكلفة الرأسمالية وطريقة الإهلاك</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Purchase Cost */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  تكلفة الشراء التاريخية ({currency}): <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Additional Costs */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  مصاريف رأسمالية إضافية (نقل، تركيب، ضرائب):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={additionalCosts}
                  onChange={(e) => setAdditionalCosts(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Salvage Value */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    قيمة الخردة / النفاية ({currency}):
                  </label>
                  <div className="flex gap-1">
                    {[0, 5, 10].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleQuickSalvagePercent(p)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 font-mono-numbers"
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={salvageValue}
                  onChange={(e) => setSalvageValue(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Straight-line input basis; other methods retain their existing useful-life control. */}
              <div>
                {depreciationMethod === 'straight_line' && (
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">أساس إدخال القسط الثابت:</label>
                    <select
                      value={depreciationInputMode}
                      onChange={(e) => setDepreciationInputMode(e.target.value as 'years' | 'rate')}
                      className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                    >
                      <option value="years">العمر الإنتاجي بالسنوات</option>
                      <option value="rate">نسبة سنوية من القيمة القابلة للإهلاك</option>
                    </select>
                  </div>
                )}
                {depreciationMethod === 'straight_line' && depreciationInputMode === 'rate' ? (
                  <>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      نسبة الإهلاك السنوية (%): <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="100"
                      step="any"
                      required
                      value={annualDepreciationRate}
                      onChange={(e) => setAnnualDepreciationRate(e.target.value)}
                      className={`w-full rounded-xl bg-slate-800 border px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:outline-none ${rateIsValid ? 'border-slate-700 focus:border-sky-500' : 'border-rose-500 focus:border-rose-500'}`}
                    />
                    <p className={`mt-1 text-[10px] ${rateIsValid ? 'text-slate-400' : 'text-rose-400'}`}>
                      تُضرب النسبة في (التكلفة الرأسمالية − القيمة التخريدية). النطاق 0.1%–100%؛ العمر المكافئ: {rateIsValid ? formatNumber(equivalentLifeYears) : '—'} سنة.
                    </p>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      العمر الإنتاجي (بالسنوات): <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={usefulLifeYears}
                      onChange={(e) => setUsefulLifeYears(e.target.value)}
                      className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Depreciation Method Selection */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                اختر طريقة حساب الإهلاك المحاسبية:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'straight_line',
                    name: 'طريقة القسط الثابت',
                    sub: 'توزيع متساوي لقيمة الأصل على سنوات العمر الإنتاجي',
                    tag: 'الأكثر شيوعاً',
                  },
                  {
                    id: 'double_declining',
                    name: 'القسط المتناقص المضاعف 200%',
                    sub: 'إهلاك متسارع مضاعف في السنوات الأولى (المعدات والسيارات)',
                    tag: 'متسارع',
                  },
                  {
                    id: 'declining_150',
                    name: 'القسط المتناقص 150%',
                    sub: 'إهلاك متسارع بنسبة 1.5 من القسط الثابت',
                    tag: 'معتدل',
                  },
                  {
                    id: 'sum_of_years',
                    name: 'مجموع أرقام السنين (SYD)',
                    sub: 'إهلاك بنسب تنازلية وفق الكسر السنوي من مجموع سنوات العمر',
                    tag: 'تنازلي',
                  },
                  {
                    id: 'units_of_production',
                    name: 'وحدات الإنتاج والنشاط',
                    sub: 'حسب ساعات العمل الفعلية أو الكيلومترات أو عدد القطع المنتجة',
                    tag: 'تشغيلي',
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDepreciationMethod(m.id as DepreciationMethod)}
                    className={`flex flex-col text-right p-3 rounded-xl border text-xs transition-all ${
                      depreciationMethod === m.id
                        ? 'border-sky-500 bg-sky-950/40 text-white ring-1 ring-sky-500'
                        : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold">{m.name}</span>
                      <span className="text-[10px] rounded px-1.5 py-0.5 bg-slate-900 text-sky-400 font-medium">
                        {m.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-snug">{m.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* If Units of Production selected: extra fields */}
            {depreciationMethod === 'units_of_production' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-4 rounded-xl bg-slate-800/80 border border-slate-700">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    إجمالي الوحدات المقدرة للعمر الإنتاجي:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalEstimatedUnits}
                    onChange={(e) => setTotalEstimatedUnits(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                    placeholder="مثال: 50,000 ساعة أو 200,000 كم"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    وحدة قياس النشاط:
                  </label>
                  <input
                    type="text"
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                    placeholder="ساعة عمل / كم / قطعة منتجة / طن"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Live Calculation Summary Card */}
          <div className="rounded-xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-slate-900 p-4 border border-sky-800/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-sky-400" />
                المعاينة الفورية لحسبة الإهلاك:
              </span>
              <span className="text-xs font-mono-numbers text-slate-300">{previewMethodLabel}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400">إجمالي التكلفة الرأسمالية:</div>
                <div className="text-sm font-bold text-slate-100 font-mono-numbers mt-0.5">
                  {formatNumber(totalCost)} {currency}
                </div>
              </div>

              <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400">القيمة الخاضعة للإهلاك:</div>
                <div className="text-sm font-bold text-slate-100 font-mono-numbers mt-0.5">
                  {formatNumber(depreciableBase)} {currency}
                </div>
              </div>

              <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">مصروف السنة الأولى بعد التناسب:</div>
                  <div className="text-sm font-bold text-amber-400 font-mono-numbers mt-0.5">
                  {formatNumber(previewFirstYearExpense)} {currency}
                  </div>
              </div>

              <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">المصروف السنوي الكامل:</div>
                  <div className="text-sm font-bold text-purple-300 font-mono-numbers mt-0.5">
                  {formatNumber(previewAnnualExpense)} {currency}
                  </div>
              </div>
            </div>
          </div>

          {/* Section 4: Location, Custody & Supplier Info */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>٣. الموقع الجغرافي والعهدة والمورد</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">الإدارة / القسم:</label>
                <input
                  type="text"
                  list="standard-departments"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="اختر أو اكتب اسم الإدارة..."
                />
                <datalist id="standard-departments">
                  {STANDARD_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">الموقع / الفرع:</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="المقر الرئيسي / مستودع الدمام"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">الموظف المسؤول (العهدة):</label>
                <input
                  type="text"
                  value={custodian}
                  onChange={(e) => setCustodian(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="اسم مستلم العهدة"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">اسم المورد / البائع:</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="شركة التوريدات الحديثة"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الفاتورة الأصلية:</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                  placeholder="INV-99201"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">الرقم التسلسلي (Serial No):</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-mono-numbers focus:border-sky-500 focus:outline-none"
                  placeholder="SN-2024-XXXX"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">ملاحظات إضافية:</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                placeholder="تفاصيل الضمان، شروط الصيانة، أو أي تفاصيل محاسبية أخرى..."
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-900/40 hover:from-sky-400 hover:to-blue-500 transition"
            >
              <Save className="h-4 w-4" />
              {editingAsset ? 'حفظ التعديلات' : 'إضافة الأصل وحساب الإهلاك'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
