import { DepreciationMethod, AssetStatus } from '../types/asset';

// Format numbers in English/Western digits with thousand separators
export function formatCurrency(amount: number, currency: string = 'ر.س'): string {
  if (isNaN(amount) || amount === null || amount === undefined) return `0.00 ${currency}`;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

export function formatNumber(val: number, decimals: number = 2): string {
  if (isNaN(val) || val === null || val === undefined) return '0';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '0%';
  return `${val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

// Format date into English format (YYYY-MM-DD or DD/MM/YYYY)
export function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMethodLabel(method: DepreciationMethod): { ar: string; en: string; short: string } {
  switch (method) {
    case 'straight_line':
      return { ar: 'طريقة القسط الثابت', en: 'Straight-Line Method', short: 'القسط الثابت' };
    case 'double_declining':
      return { ar: 'طريقة القسط المتناقص المضاعف (200%)', en: 'Double Declining Balance (200%)', short: 'المتناقص 200%' };
    case 'declining_150':
      return { ar: 'طريقة القسط المتناقص (150%)', en: '150% Declining Balance', short: 'المتناقص 150%' };
    case 'sum_of_years':
      return { ar: 'طريقة مجموع أرقام السنين (SYD)', en: "Sum-of-the-Years' Digits", short: 'مجموع أرقام السنين' };
    case 'units_of_production':
      return { ar: 'طريقة وحدات الإنتاج والنشاط', en: 'Units of Production Method', short: 'وحدات الإنتاج' };
    default:
      return { ar: 'غير محدد', en: 'Unknown', short: '-' };
  }
}

export function getStatusBadge(status: AssetStatus): { text: string; bg: string; textClass: string; border: string } {
  switch (status) {
    case 'active':
      return { text: 'نشط ويعمل', bg: 'bg-emerald-500/10', textClass: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'fully_depreciated':
      return { text: 'مُهلك بالكامل', bg: 'bg-blue-500/10', textClass: 'text-blue-400', border: 'border-blue-500/30' };
    case 'under_maintenance':
      return { text: 'قيد الصيانة', bg: 'bg-amber-500/10', textClass: 'text-amber-400', border: 'border-amber-500/30' };
    case 'disposed':
      return { text: 'مستبعد / مباع', bg: 'bg-rose-500/10', textClass: 'text-rose-400', border: 'border-rose-500/30' };
    case 'idle':
      return { text: 'متوقف مؤقتاً', bg: 'bg-slate-500/10', textClass: 'text-slate-400', border: 'border-slate-500/30' };
    default:
      return { text: 'غير معروف', bg: 'bg-slate-800', textClass: 'text-slate-400', border: 'border-slate-700' };
  }
}

export function getStartRuleLabel(rule?: string): { short: string; label: string; desc: string } {
  switch (rule) {
    case 'same_month':
      return {
        short: 'نفس الشهر فوراً',
        label: 'بدء الإهلاك من نفس شهر التشغيل كاملاً',
        desc: 'يحسب إهلاك الشهر الذي بدأ فيه الأصل فوراً',
      };
    case 'next_month':
      return {
        short: 'الشهر التالي دائماً',
        label: 'بدء الإهلاك من أول الشهر التالي',
        desc: 'يضاف كأصل في شهر الشراء ويبدأ احتساب الإهلاك من أول الشهر التالي',
      };
    case 'mid_month_15':
    default:
      return {
        short: 'قاعدة 15 يوم (منتصف الشهر)',
        label: '1-15 نفس الشهر | 16-نهاية الشهر الشهر التالي',
        desc: 'إذا كان تاريخ التشغيل من يوم 1 إلى 15 يحسب إهلاك نفس الشهر، وإذا كان من 16 إلى نهاية الشهر يضاف كأصل فقط ويبدأ إهلاكه من أول الشهر التالي',
      };
  }
}
