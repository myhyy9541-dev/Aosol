import { Asset, AssetCategory, CompanySettings, DatabaseBackup } from '../types/asset';

const STORAGE_KEYS = {
  ASSETS: 'fa_assets_db_v1',
  CATEGORIES: 'fa_categories_db_v1',
  SETTINGS: 'fa_settings_db_v1',
  LAST_BACKUP: 'fa_last_backup_timestamp',
};

export const SUPPORTED_CURRENCIES = [
  { code: 'YER', name: 'ريال يمني', symbol: 'ريال يمني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'QAR', name: 'ريال قطري', symbol: 'ر.ق' },
  { code: 'OMR', name: 'ريال عماني', symbol: 'ر.ع' },
];

export const DEFAULT_CATEGORIES: AssetCategory[] = [
  {
    id: 'buildings',
    name: 'المباني والإنشاءات',
    nameEn: 'Buildings & Construction',
    defaultLifeYears: 25,
    defaultMethod: 'straight_line',
    defaultSalvagePercent: 10,
    iconName: 'Building2',
  },
  {
    id: 'machinery',
    name: 'الآلات وخطوط الإنتاج والمولدات',
    nameEn: 'Plant, Machinery & Generators',
    defaultLifeYears: 10,
    defaultMethod: 'double_declining',
    defaultSalvagePercent: 5,
    iconName: 'Cog',
  },
  {
    id: 'vehicles',
    name: 'المركبات ووسائل النقل',
    nameEn: 'Vehicles & Transport',
    defaultLifeYears: 5,
    defaultMethod: 'straight_line',
    defaultSalvagePercent: 15,
    iconName: 'Truck',
  },
  {
    id: 'solar_energy',
    name: 'منظومات الطاقة الشمسية والكهرباء',
    nameEn: 'Solar Energy & Power Systems',
    defaultLifeYears: 10,
    defaultMethod: 'straight_line',
    defaultSalvagePercent: 5,
    iconName: 'Sun',
  },
  {
    id: 'computers',
    name: 'أجهزة الكمبيوتر والتقنية والشبكات',
    nameEn: 'IT & Electronic Equipment',
    defaultLifeYears: 3,
    defaultMethod: 'double_declining',
    defaultSalvagePercent: 0,
    iconName: 'Laptop',
  },
  {
    id: 'furniture',
    name: 'الأثاث والتجهيزات المكتبية',
    nameEn: 'Furniture & Fixtures',
    defaultLifeYears: 7,
    defaultMethod: 'straight_line',
    defaultSalvagePercent: 5,
    iconName: 'Armchair',
  },
  {
    id: 'heavy_equipment',
    name: 'المعدات الثقيلة والحفارات',
    nameEn: 'Heavy Equipment',
    defaultLifeYears: 8,
    defaultMethod: 'units_of_production',
    defaultSalvagePercent: 8,
    iconName: 'HardHat',
  },
];

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'شركة سبأ للتجارة والاستثمار المحدودة',
  commercialReg: '02-45892',
  taxNumber: '10928374',
  currency: 'ريال يمني',
  fiscalYearStartMonth: 1,
  depreciationConvention: 'full_month',
};

export const STANDARD_DEPARTMENTS = [
  'الإدارة العامة',
  'الإدارة المالية والحسابات',
  'إدارة المبيعات والتوزيع',
  'إدارة الصيانة والتشغيل',
  'إدارة تقنية المعلومات والشبكات',
  'إدارة الخدمات الفنية والكهرباء',
  'إدارة المشاريع الهندسية',
  'إدارة الشؤون الإدارية والمالية',
  'إدارة الخدمات اللوجستية والنقل',
];

export const INITIAL_SAMPLE_ASSETS: Asset[] = [
  {
    id: 'ast-001',
    code: 'AST-BLD-01',
    name: 'مبنى المقر الإداري الرئيسي - صنعاء',
    category: 'buildings',
    purchaseDate: '2022-01-15',
    inServiceDate: '2022-02-01',
    purchaseCost: 95000000,
    additionalCosts: 5000000,
    salvageValue: 12000000,
    usefulLifeYears: 25,
    depreciationMethod: 'straight_line',
    startDepreciationRule: 'mid_month_15',
    status: 'active',
    location: 'صنعاء - شارع حدة',
    department: 'الإدارة العامة',
    custodian: 'أحمد صالح اليماني',
    supplier: 'شركة الإنشاءات والتطوير العقاري',
    invoiceNumber: 'INV-2022-89',
    notes: 'تمت إضافة تكاليف رسوم التسجيل والفرز الرأسمالي والتجهيز',
    createdAt: '2022-01-15T09:00:00.000Z',
    updatedAt: '2024-01-10T11:00:00.000Z',
  },
  {
    id: 'ast-002',
    code: 'AST-GEN-02',
    name: 'مولد كهرباء ديزل كاتربيلر 500 KVA كاتم صوت',
    category: 'machinery',
    purchaseDate: '2022-06-10',
    inServiceDate: '2022-07-01',
    purchaseCost: 34500000,
    additionalCosts: 1500000,
    salvageValue: 2500000,
    usefulLifeYears: 8,
    depreciationMethod: 'double_declining',
    startDepreciationRule: 'mid_month_15',
    status: 'active',
    location: 'المجمع الصناعي - محطة التوليد',
    department: 'إدارة الصيانة والتشغيل',
    custodian: 'م. طارق الحيدري',
    supplier: 'شركة يمن ديزل للمولدات',
    invoiceNumber: 'CAT-99231',
    notes: 'إهلاك متسارع بنظام القسط المتناقص المضاعف 200%',
    createdAt: '2022-06-10T08:00:00.000Z',
    updatedAt: '2024-02-15T10:00:00.000Z',
  },
  {
    id: 'ast-003',
    code: 'AST-SLR-03',
    name: 'منظومة طاقة شمسية هجينة متكاملة 60 KW مع بطاريات ليثيوم',
    category: 'solar_energy',
    purchaseDate: '2023-01-10',
    inServiceDate: '2023-01-20',
    purchaseCost: 18000000,
    additionalCosts: 800000,
    salvageValue: 1000000,
    usefulLifeYears: 10,
    depreciationMethod: 'straight_line',
    startDepreciationRule: 'mid_month_15',
    status: 'active',
    location: 'سطح المقر الرئيسي - صنعاء',
    department: 'إدارة الخدمات الفنية والكهرباء',
    custodian: 'م. نبيل الشرجبي',
    supplier: 'مؤسسة الرواد للطاقة المتجددة',
    invoiceNumber: 'SOL-5521',
    notes: 'ألواح جينكو 580 وات مع عواكس Growatt وبطاريات Pylontech',
    createdAt: '2023-01-10T10:00:00.000Z',
    updatedAt: '2024-01-05T09:00:00.000Z',
  },
  {
    id: 'ast-004',
    code: 'AST-VEH-04',
    name: 'سيارة نقل وتوزيع تويوتا هايلكس دبل كابينة 2023',
    category: 'vehicles',
    purchaseDate: '2023-03-20',
    inServiceDate: '2023-04-01',
    purchaseCost: 16800000,
    additionalCosts: 400000,
    salvageValue: 3000000,
    usefulLifeYears: 5,
    depreciationMethod: 'straight_line',
    startDepreciationRule: 'mid_month_15',
    status: 'active',
    location: 'أسطول النقل والمستودعات - فرع عدن',
    department: 'إدارة المبيعات والتوزيع',
    custodian: 'سالم بازرعة',
    supplier: 'شركة بازرعة للسيارات',
    invoiceNumber: 'BAZ-4421',
    notes: 'مجهزة بصندوق فيبر جلاس ومكيف للمنتجات الحساسة للحرارة',
    createdAt: '2023-03-20T10:30:00.000Z',
    updatedAt: '2024-01-05T09:00:00.000Z',
  },
  {
    id: 'ast-005',
    code: 'AST-EQP-05',
    name: 'حفار هيدروليكي كوماتسو PC200 ثقيل',
    category: 'heavy_equipment',
    purchaseDate: '2022-04-10',
    inServiceDate: '2022-05-01',
    purchaseCost: 42000000,
    additionalCosts: 1800000,
    salvageValue: 5000000,
    usefulLifeYears: 6,
    depreciationMethod: 'units_of_production',
    startDepreciationRule: 'mid_month_15',
    totalEstimatedUnits: 25000,
    producedUnitsToDate: 6400,
    unitOfMeasure: 'ساعة تشغيل',
    status: 'active',
    location: 'مشروع إنشاءات طريق عمران',
    department: 'إدارة المشاريع الهندسية',
    custodian: 'م. فؤاد القباطي',
    supplier: 'شركة التوكيلات والمعدات الثقيلة',
    invoiceNumber: 'KOM-8891',
    notes: 'إهلاك بنظام وحدات الإنتاج بحساب ساعات التشغيل الفعلية',
    createdAt: '2022-04-10T11:00:00.000Z',
    updatedAt: '2024-04-10T16:00:00.000Z',
  },
  {
    id: 'ast-006',
    code: 'AST-SRV-06',
    name: 'خادم الشبكة الرئيسي ومصفوفة SAN للتخزين والنسخ الاحتياطي',
    category: 'computers',
    purchaseDate: '2023-08-15',
    inServiceDate: '2023-09-01',
    purchaseCost: 8200000,
    additionalCosts: 300000,
    salvageValue: 0,
    usefulLifeYears: 3,
    depreciationMethod: 'double_declining',
    startDepreciationRule: 'mid_month_15',
    status: 'active',
    location: 'غرفة السيرفرات - المقر الرئيسي',
    department: 'إدارة تقنية المعلومات والشبكات',
    custodian: 'عادل المؤيد',
    supplier: 'يمن نت تكنولوجي للأنظمة',
    invoiceNumber: 'YNT-2023-11',
    notes: 'خادم Dell PowerEdge R750 مع 128GB رام ووحدات SSD',
    createdAt: '2023-08-15T12:00:00.000Z',
    updatedAt: '2024-03-01T15:00:00.000Z',
  },
  {
    id: 'ast-007',
    code: 'AST-FRN-07',
    name: 'تجهيزات ومكاتب قاعات الاجتماعات والشؤون الإدارية',
    category: 'furniture',
    purchaseDate: '2022-10-01',
    inServiceDate: '2022-10-15',
    purchaseCost: 5400000,
    additionalCosts: 200000,
    salvageValue: 300000,
    usefulLifeYears: 7,
    depreciationMethod: 'sum_of_years',
    startDepreciationRule: 'mid_month_15',
    status: 'active',
    location: 'الدور الثاني - المقر الرئيسي',
    department: 'إدارة الشؤون الإدارية والمالية',
    custodian: 'سميرة العريقي',
    supplier: 'معارض الجزيرة للأثاث المكتبي',
    invoiceNumber: 'FUR-7761',
    notes: 'طريقة مجموع أرقام السنين SYD',
    createdAt: '2022-10-01T14:00:00.000Z',
    updatedAt: '2023-12-01T10:00:00.000Z',
  },
  {
    id: 'ast-008',
    code: 'AST-VEH-08',
    name: 'سيارة إشراف ميداني تويوتا لاندكروزر شاص',
    category: 'vehicles',
    purchaseDate: '2020-03-01',
    inServiceDate: '2020-03-15',
    purchaseCost: 12000000,
    additionalCosts: 350000,
    salvageValue: 2000000,
    usefulLifeYears: 4,
    depreciationMethod: 'straight_line',
    startDepreciationRule: 'mid_month_15',
    status: 'disposed',
    location: 'موقع العمل الميداني',
    department: 'إدارة المشاريع الهندسية',
    custodian: 'خالد الصبري',
    supplier: 'شركة بازرعة',
    invoiceNumber: 'BAZ-1029',
    disposal: {
      disposalDate: '2024-02-15',
      disposalType: 'sale',
      salePrice: 6500000,
      disposalCosts: 150000,
      bookValueAtDisposal: 2000000,
      accumulatedAtDisposal: 10350000,
      gainLoss: 4350000,
      reason: 'بيع في مزاد تجديد أسطول المركبات وتحقيق أرباح رأسمالية',
      buyerName: 'مؤسسة الوادي للتجارة والمقاولات',
    },
    notes: 'تم استبعاد الأصل وبيعه وتحقيق ربح رأسمالي بقيمة 4,350,000 ريال يمني',
    createdAt: '2020-03-01T08:00:00.000Z',
    updatedAt: '2024-02-15T12:00:00.000Z',
  },
];

export function getStoredAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSETS);
    if (!raw) {
      saveStoredAssets(INITIAL_SAMPLE_ASSETS);
      return INITIAL_SAMPLE_ASSETS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SAMPLE_ASSETS;
  } catch (e) {
    console.error('Failed to load assets from localStorage:', e);
    return INITIAL_SAMPLE_ASSETS;
  }
}

export function saveStoredAssets(assets: Asset[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));
  } catch (e) {
    console.error('Failed to save assets to localStorage:', e);
  }
}

export function getStoredCategories(): AssetCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      saveStoredCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_CATEGORIES;
  }
}

export function saveStoredCategories(categories: AssetCategory[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories:', e);
  }
}

export function getStoredSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      saveStoredSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: CompanySettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Loads and resets to the full rich demo dataset
 */
export function loadDemoDataset(): void {
  saveStoredAssets(INITIAL_SAMPLE_ASSETS);
  saveStoredCategories(DEFAULT_CATEGORIES);
  saveStoredSettings(DEFAULT_SETTINGS);
  localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, new Date().toISOString());
}

/**
 * Creates and triggers download of a full local JSON backup file
 */
export function exportLocalBackup(): void {
  const assets = getStoredAssets();
  const categories = getStoredCategories();
  const settings = getStoredSettings();

  const backup: DatabaseBackup = {
    version: '1.1.0',
    exportDate: new Date().toISOString(),
    settings,
    categories,
    assets,
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `نسخة_احتياطية_أصول_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, new Date().toISOString());
}

/**
 * Restores database from a parsed backup object
 */
export function restoreBackupData(data: DatabaseBackup): { success: boolean; message: string; count?: number } {
  if (!data || !Array.isArray(data.assets)) {
    return { success: false, message: 'ملف النسخة الاحتياطية غير صالح أو تالف.' };
  }

  try {
    if (data.assets) saveStoredAssets(data.assets);
    if (data.categories && Array.isArray(data.categories)) saveStoredCategories(data.categories);
    if (data.settings) saveStoredSettings(data.settings);
    localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, new Date().toISOString());
    return {
      success: true,
      message: `تم استرجاع النسخة الاحتياطية بنجاح (${data.assets.length} أصل).`,
      count: data.assets.length,
    };
  } catch (e) {
    return { success: false, message: 'حدث خطأ أثناء حفظ بيانات النسخة الاحتياطية.' };
  }
}

export function getLastBackupTimestamp(): string | null {
  return localStorage.getItem(STORAGE_KEYS.LAST_BACKUP);
}
