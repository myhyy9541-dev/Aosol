import { Asset } from '../types/asset';
import { formatDate, formatNumber, formatPercent, getMethodLabel } from './formatters';

export type ColumnGroup = 'basic' | 'dates_policies' | 'financial' | 'operations';

export interface CustomReportColumnDef {
  id: string;
  label: string;
  group: ColumnGroup;
  align: 'right' | 'center' | 'left';
  width: number;
  isFinancial?: boolean;
  isNumeric?: boolean;
  highlight?: 'amber' | 'emerald' | 'none';
  defaultSelected: boolean;
  getValue: (asset: Asset, period: any, catMap: Map<string, string>) => {
    display: string;
    raw: any;
  };
}

export const ALL_CUSTOM_REPORT_COLUMNS: CustomReportColumnDef[] = [
  // 1. البيانات الأساسية والتعريفية
  {
    id: 'code',
    label: 'كود الأصل',
    group: 'basic',
    align: 'center',
    width: 14,
    defaultSelected: true,
    getValue: (asset) => ({ display: asset.code, raw: asset.code }),
  },
  {
    id: 'name',
    label: 'اسم الأصل',
    group: 'basic',
    align: 'right',
    width: 28,
    defaultSelected: true,
    getValue: (asset) => ({ display: asset.name, raw: asset.name }),
  },
  {
    id: 'category',
    label: 'تصنيف وفئة الأصل',
    group: 'basic',
    align: 'right',
    width: 20,
    defaultSelected: true,
    getValue: (asset, _, catMap) => {
      const cat = catMap.get(asset.category) || asset.category;
      return { display: cat, raw: cat };
    },
  },
  {
    id: 'department',
    label: 'الإدارة / القسم',
    group: 'basic',
    align: 'right',
    width: 20,
    defaultSelected: true,
    getValue: (asset) => {
      const dept = asset.department || 'الإدارة العامة';
      return { display: dept, raw: dept };
    },
  },
  {
    id: 'status',
    label: 'حالة الأصل',
    group: 'basic',
    align: 'center',
    width: 14,
    defaultSelected: false,
    getValue: (asset) => {
      const s = asset.status === 'active' ? 'نشط' : asset.status === 'disposed' ? 'مستبعد' : 'متوقف';
      return { display: s, raw: s };
    },
  },

  // 2. التواريخ وسياسات الإهلاك
  {
    id: 'purchaseDate',
    label: 'تاريخ الشراء',
    group: 'dates_policies',
    align: 'center',
    width: 16,
    defaultSelected: false,
    getValue: (asset) => ({ display: formatDate(asset.purchaseDate), raw: asset.purchaseDate }),
  },
  {
    id: 'inServiceDate',
    label: 'تاريخ بدء التشغيل',
    group: 'dates_policies',
    align: 'center',
    width: 16,
    defaultSelected: true,
    getValue: (asset) => ({ display: formatDate(asset.inServiceDate), raw: asset.inServiceDate }),
  },
  {
    id: 'depreciationMethod',
    label: 'طريقة الإهلاك',
    group: 'dates_policies',
    align: 'right',
    width: 24,
    defaultSelected: true,
    getValue: (asset) => {
      const m = getMethodLabel(asset.depreciationMethod).short;
      return { display: m, raw: m };
    },
  },
  {
    id: 'startRule',
    label: 'سياسة البدء (قاعدة 15 يوم)',
    group: 'dates_policies',
    align: 'right',
    width: 24,
    defaultSelected: true,
    getValue: (asset) => {
      const rule = asset.startDepreciationRule === 'mid_month_15'
        ? '⚖️ قاعدة 15 يوم'
        : asset.startDepreciationRule === 'next_month'
        ? 'الشهر التالي'
        : 'نفس الشهر مباشرة';
      return { display: rule, raw: rule };
    },
  },
  {
    id: 'usefulLife',
    label: 'العمر الإنتاجي (سنوات)',
    group: 'dates_policies',
    align: 'center',
    width: 16,
    isNumeric: true,
    defaultSelected: false,
    getValue: (asset) => ({ display: `${asset.usefulLifeYears} سنوات`, raw: asset.usefulLifeYears }),
  },
  {
    id: 'depreciationRate',
    label: 'نسبة الإهلاك السنوية %',
    group: 'dates_policies',
    align: 'center',
    width: 16,
    defaultSelected: false,
    getValue: (asset) => {
      const rate = asset.usefulLifeYears > 0 ? 100 / asset.usefulLifeYears : 0;
      const r = formatPercent(rate);
      return { display: r, raw: rate };
    },
  },

  // 3. القيم المحاسبية والمالية
  {
    id: 'totalCost',
    label: 'التكلفة التاريخية',
    group: 'financial',
    align: 'left',
    width: 22,
    isFinancial: true,
    defaultSelected: true,
    getValue: (_, period) => ({ display: formatNumber(period.totalCost), raw: period.totalCost }),
  },
  {
    id: 'salvageValue',
    label: 'قيمة الخردة / النفاية',
    group: 'financial',
    align: 'left',
    width: 18,
    isFinancial: true,
    defaultSelected: false,
    getValue: (asset) => ({ display: formatNumber(asset.salvageValue || 0), raw: asset.salvageValue || 0 }),
  },
  {
    id: 'beginningBookValue',
    label: 'القيمة الدفترية أول الفترة',
    group: 'financial',
    align: 'left',
    width: 22,
    isFinancial: true,
    defaultSelected: true,
    getValue: (_, period) => ({ display: formatNumber(period.beginningBookValue), raw: period.beginningBookValue }),
  },
  {
    id: 'periodExpense',
    label: 'إهلاك الفترة المحددة',
    group: 'financial',
    align: 'left',
    width: 22,
    isFinancial: true,
    highlight: 'amber',
    defaultSelected: true,
    getValue: (_, period) => ({ display: formatNumber(period.periodExpense), raw: period.periodExpense }),
  },
  {
    id: 'accumulatedDepreciation',
    label: 'مجمع الإهلاك نهاية الفترة',
    group: 'financial',
    align: 'left',
    width: 22,
    isFinancial: true,
    defaultSelected: true,
    getValue: (_, period) => ({ display: formatNumber(period.accumulatedAtEnd), raw: period.accumulatedAtEnd }),
  },
  {
    id: 'endingBookValue',
    label: 'صافي القيمة الدفترية نهاية الفترة',
    group: 'financial',
    align: 'left',
    width: 24,
    isFinancial: true,
    highlight: 'emerald',
    defaultSelected: true,
    getValue: (_, period) => ({ display: formatNumber(period.endingBookValue), raw: period.endingBookValue }),
  },
  {
    id: 'depreciationRatio',
    label: 'نسبة الاستهلاك %',
    group: 'financial',
    align: 'center',
    width: 16,
    defaultSelected: false,
    getValue: (_, period) => {
      const ratio = period.totalCost > 0 ? (period.accumulatedAtEnd / period.totalCost) * 100 : 0;
      return { display: formatPercent(ratio), raw: ratio };
    },
  },

  // 4. البيانات التشغيلية والميدانية والرقابية
  {
    id: 'location',
    label: 'الموقع / الفرع',
    group: 'operations',
    align: 'right',
    width: 20,
    defaultSelected: false,
    getValue: (asset) => ({ display: asset.location || '-', raw: asset.location || '-' }),
  },
  {
    id: 'custodian',
    label: 'المسؤول / العهدة',
    group: 'operations',
    align: 'right',
    width: 20,
    defaultSelected: false,
    getValue: (asset) => ({ display: asset.custodian || '-', raw: asset.custodian || '-' }),
  },
  {
    id: 'serialNumber',
    label: 'الرقم التسلسلي (S/N)',
    group: 'operations',
    align: 'center',
    width: 20,
    defaultSelected: false,
    getValue: (asset) => ({ display: asset.serialNumber || '-', raw: asset.serialNumber || '-' }),
  },
  {
    id: 'supplier',
    label: 'المورد / جهة الشراء',
    group: 'operations',
    align: 'right',
    width: 20,
    defaultSelected: false,
    getValue: (asset) => ({ display: asset.supplier || '-', raw: asset.supplier || '-' }),
  },
  {
    id: 'notes',
    label: 'ملاحظات',
    group: 'operations',
    align: 'right',
    width: 28,
    defaultSelected: false,
    getValue: (asset) => ({ display: asset.notes || '-', raw: asset.notes || '-' }),
  },
];

export const COLUMN_GROUP_LABELS: Record<ColumnGroup, string> = {
  basic: 'البيانات الأساسية والتعريفية',
  dates_policies: 'التواريخ وسياسات الإهلاك',
  financial: 'القيم المحاسبية والمالية',
  operations: 'البيانات التشغيلية والعهدة والموقع',
};

// Preset Column Sets
export const PRESETS = {
  FINANCIAL: [
    'code',
    'name',
    'category',
    'department',
    'inServiceDate',
    'depreciationMethod',
    'totalCost',
    'beginningBookValue',
    'periodExpense',
    'accumulatedDepreciation',
    'endingBookValue',
  ],
  INVENTORY: [
    'code',
    'name',
    'category',
    'department',
    'status',
    'location',
    'custodian',
    'serialNumber',
    'purchaseDate',
    'totalCost',
    'notes',
  ],
  POLICIES_AND_15_DAYS: [
    'code',
    'name',
    'department',
    'inServiceDate',
    'startRule',
    'depreciationMethod',
    'usefulLife',
    'depreciationRate',
    'totalCost',
    'salvageValue',
    'periodExpense',
  ],
  ALL: ALL_CUSTOM_REPORT_COLUMNS.map((c) => c.id),
};

const STORAGE_KEY = 'fixed_assets_custom_report_columns_v1';

export function getSavedCustomColumns(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load custom columns preference', e);
  }
  return ALL_CUSTOM_REPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.id);
}

export function saveCustomColumnsPreference(columns: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch (e) {
    console.error('Failed to save custom columns preference', e);
  }
}
