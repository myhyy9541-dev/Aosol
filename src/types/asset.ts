export type DepreciationMethod = 
  | 'straight_line'        // القسط الثابت
  | 'double_declining'     // القسط المتناقص المضاعف 200%
  | 'declining_150'        // القسط المتناقص 150%
  | 'sum_of_years'         // مجموع أرقام السنين
  | 'units_of_production'; // وحدات الإنتاج أو النشاط

export type AssetStatus = 
  | 'active'     // نشط / قيد الاستخدام
  | 'fully_depreciated' // تم إهلاكه بالكامل
  | 'under_maintenance' // تحت الصيانة
  | 'disposed'   // مستبعد / مباع / تم تخريده
  | 'idle';      // متوقف مؤقتاً

export type DepreciationStartRule = 
  | 'mid_month_15' // قاعدة منتصف الشهر: يوم 1-15 يحسب إهلاك نفس الشهر، ويوم 16-نهاية الشهر يضاف كأصل ويبدأ الإهلاك الشهر التالي
  | 'same_month'   // بدء الإهلاك من نفس شهر التشغيل كاملاً
  | 'next_month';  // بدء الإهلاك من بداية الشهر التالي

export interface AssetCategory {
  id: string;
  name: string;
  nameEn: string;
  defaultLifeYears: number;
  defaultMethod: DepreciationMethod;
  defaultSalvagePercent: number;
  iconName: string;
}

export interface DepreciationScheduleRow {
  year: number;
  periodLabel: string;
  beginningBookValue: number;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  endingBookValue: number;
  ratePercent?: number;
  unitsProduced?: number;
}

export interface AssetDisposal {
  disposalDate: string; // YYYY-MM-DD
  disposalType: 'sale' | 'scrap' | 'donation' | 'loss';
  salePrice: number;
  disposalCosts: number;
  bookValueAtDisposal: number;
  accumulatedAtDisposal: number;
  gainLoss: number; // positive = gain, negative = loss
  reason?: string;
  buyerName?: string;
}

export interface AssetRevaluation {
  date: string;
  previousValue: number;
  newValue: number;
  reason: string;
}

export interface Asset {
  id: string;
  code: string;               // كود أو باركود الأصل (e.g. AST-001)
  name: string;               // اسم الأصل بالعربية
  category: string;           // معرف الفئة والتصنيف
  purchaseDate: string;       // تاريخ الشراء YYYY-MM-DD
  inServiceDate: string;      // تاريخ بدء الاستخدام YYYY-MM-DD
  purchaseCost: number;       // التكلفة التاريخية
  additionalCosts: number;    // تكاليف إضافية / رسوم تركيب ونقل
  salvageValue: number;       // قيمة النفاية / الخردة المقدرة
  usefulLifeYears: number;    // العمر الإنتاجي بالسنوات
  usefulLifeMonths?: number;  // أو بالشهور
  depreciationInputMode?: 'years' | 'rate';
  annualDepreciationRate?: number; // Annual percentage (e.g. 20 means 20%)
  depreciationMethod: DepreciationMethod;
  startDepreciationRule: DepreciationStartRule; // قاعدة بدء الإهلاك (يوم 1-15 أو 16-نهاية الشهر)
  status: AssetStatus;
  
  // خاص بطريقة وحدات الإنتاج
  totalEstimatedUnits?: number; // إجمالي الوحدات المقدرة للعمر
  producedUnitsToDate?: number; // الوحدات المنتجة حتى الآن
  unitOfMeasure?: string;       // وحدة القياس (ساعة، كم، قطعة، طن)
  
  // الموقع والعهدة والإدارة
  location: string;           // الموقع / الفرع
  department: string;         // الإدارة / القسم المخصص له الأصل
  custodian: string;          // الموظف المسؤول / العهدة
  serialNumber?: string;      // الرقم التسلسلي
  supplier?: string;          // المورد
  invoiceNumber?: string;     // رقم الفاتورة
  notes?: string;             // ملاحظات
  
  // استبعاد وتخريد
  disposal?: AssetDisposal;
  
  // سجل إعادة التقييم
  revaluations?: AssetRevaluation[];
  
  // تواريخ النظام
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  companyName: string;
  commercialReg: string;
  taxNumber: string;
  currency: string;
  fiscalYearStartMonth: number; // 1 = January
  depreciationConvention: 'half_year' | 'full_month' | 'exact_days';
}

export interface DatabaseBackup {
  version: string;
  exportDate: string;
  settings: CompanySettings;
  categories: AssetCategory[];
  assets: Asset[];
}
