import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Printer, 
  TrendingDown, 
  Building2, 
  Layers, 
  Filter, 
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Tag,
  CalendarRange,
  Building,
  CheckSquare,
  Square,
  Sliders,
  SlidersHorizontal,
  Settings2,
  Check,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  RotateCcw,
  ListFilter,
  Eye,
  CheckCheck,
  Save,
  Sparkles,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  exportPeriodReportToExcel, 
  exportCategoryReportToExcel, 
  exportDepartmentReportToExcel, 
  exportDisposalsReportToExcel,
  exportCustomReportToExcel
} from '../utils/excel';
import { 
  downloadPrintableHTMLReport, 
  printReportDirectly, 
  openReportInNewWindow, 
  generatePrintableHTMLString, 
  PrintableReportConfig 
} from '../utils/printHtml';
import { 
  ALL_CUSTOM_REPORT_COLUMNS, 
  COLUMN_GROUP_LABELS, 
  PRESETS, 
  getSavedCustomColumns, 
  saveCustomColumnsPreference, 
  CustomReportColumnDef, 
  ColumnGroup 
} from '../utils/customReportConfig';
import { Asset, AssetCategory } from '../types/asset';
import { calculatePeriodDepreciation, getCurrentAssetValuation, getTotalCost } from '../utils/depreciation';
import { formatCurrency, formatDate, formatNumber, formatPercent, getMethodLabel, getStartRuleLabel } from '../utils/formatters';

interface ReportsViewProps {
  assets: Asset[];
  categories: AssetCategory[];
  currency: string;
  companyName: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  assets,
  categories,
  currency,
  companyName,
}) => {
  // Main report view selection: period | category | department | disposals | custom
  const [reportType, setReportType] = useState<'period' | 'category' | 'department' | 'disposals' | 'custom'>('period');

  // Custom Report Builder States (Columns & Rows by user choice)
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() => getSavedCustomColumns());
  const [customReportTitle, setCustomReportTitle] = useState<string>('تقرير الأصول الثابتة المخصص والمفصل');
  const [isColumnsPanelOpen, setIsColumnsPanelOpen] = useState<boolean>(true);
  const [activeColumnGroupTab, setActiveColumnGroupTab] = useState<ColumnGroup | 'all'>('all');
  const [customStatusFilter, setCustomStatusFilter] = useState<'all' | 'active' | 'disposed'>('all');
  const [customRuleFilter, setCustomRuleFilter] = useState<'all' | 'mid_month_15' | 'next_month' | 'immediate'>('all');
  const [customSearchTerm, setCustomSearchTerm] = useState<string>('');
  const [customExcludedAssetIds, setCustomExcludedAssetIds] = useState<Set<string>>(new Set());
  const [isRowPickerOpen, setIsRowPickerOpen] = useState<boolean>(false);
  const [customSortBy, setCustomSortBy] = useState<string>('code');
  const [customSortDir, setCustomSortDir] = useState<'asc' | 'desc'>('asc');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Export action states and feedback
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setExportFeedback({ type, message });
    setTimeout(() => {
      setExportFeedback((cur) => (cur?.message === message ? null : cur));
    }, 6000);
  };

  // Print & PDF formatting options: orientation and color mode
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [printColorMode, setPrintColorMode] = useState<'color' | 'bw'>('color');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState<boolean>(false);

  // Period filter type: 'custom' (من إلى) | 'annual' (سنوي) | 'monthly' (شهري) | 'all' (تراكمي)
  const [periodType, setPeriodType] = useState<'custom' | 'annual' | 'monthly' | 'all'>('custom');

  // Selected Year and Month for preset reports
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1 - 12

  // Custom date range: fromDate and toDate
  const [fromDate, setFromDate] = useState<string>(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState<string>(`${currentYear}-12-31`);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Multi-department filter (empty array means ALL departments selected)
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Unique departments from assets
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => {
      const d = (a.department || 'الإدارة العامة').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [assets]);

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments((prev) => {
      if (prev.includes(dept)) {
        return prev.filter((d) => d !== dept);
      } else {
        return [...prev, dept];
      }
    });
  };

  // Adjust dates when user selects Annual or Monthly
  const handlePeriodTypeChange = (type: 'custom' | 'annual' | 'monthly' | 'all') => {
    setPeriodType(type);
    if (type === 'annual') {
      setFromDate(`${selectedYear}-01-01`);
      setToDate(`${selectedYear}-12-31`);
    } else if (type === 'monthly') {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      setFromDate(`${selectedYear}-${monthStr}-01`);
      setToDate(`${selectedYear}-${monthStr}-${lastDay}`);
    } else if (type === 'all') {
      setFromDate('2000-01-01');
      setToDate(new Date().toISOString().split('T')[0]);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (periodType === 'annual') {
      setFromDate(`${year}-01-01`);
      setToDate(`${year}-12-31`);
    } else if (periodType === 'monthly') {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(year, selectedMonth, 0).getDate();
      setFromDate(`${year}-${monthStr}-01`);
      setToDate(`${year}-${monthStr}-${lastDay}`);
    }
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    if (periodType === 'monthly') {
      const monthStr = String(month).padStart(2, '0');
      const lastDay = new Date(selectedYear, month, 0).getDate();
      setFromDate(`${selectedYear}-${monthStr}-01`);
      setToDate(`${selectedYear}-${monthStr}-${lastDay}`);
    }
  };

  // Quick preset shortcuts
  const applyPreset = (preset: 'this_month' | 'this_quarter' | 'this_year' | 'last_year') => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;

    if (preset === 'this_month') {
      setPeriodType('monthly');
      setSelectedYear(y);
      setSelectedMonth(m);
      const mStr = String(m).padStart(2, '0');
      const lastDay = new Date(y, m, 0).getDate();
      setFromDate(`${y}-${mStr}-01`);
      setToDate(`${y}-${mStr}-${lastDay}`);
    } else if (preset === 'this_quarter') {
      setPeriodType('custom');
      const q = Math.floor((m - 1) / 3);
      const qStart = q * 3 + 1;
      const qEnd = qStart + 2;
      const qEndLastDay = new Date(y, qEnd, 0).getDate();
      setFromDate(`${y}-${String(qStart).padStart(2, '0')}-01`);
      setToDate(`${y}-${String(qEnd).padStart(2, '0')}-${qEndLastDay}`);
    } else if (preset === 'this_year') {
      setPeriodType('annual');
      setSelectedYear(y);
      setFromDate(`${y}-01-01`);
      setToDate(`${y}-12-31`);
    } else if (preset === 'last_year') {
      setPeriodType('annual');
      setSelectedYear(y - 1);
      setFromDate(`${y - 1}-01-01`);
      setToDate(`${y - 1}-12-31`);
    }
  };

  // Filtered Assets based on Category and Department
  const activeAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
      const dept = (a.department || 'الإدارة العامة').trim();
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(dept);
      return matchCat && matchDept;
    });
  }, [assets, selectedCategory, selectedDepartments]);

  // Calculations for Period Report (من - إلى)
  const periodResults = useMemo(() => {
    return activeAssets.map((asset) => {
      const calc = calculatePeriodDepreciation(asset, fromDate, toDate);
      return {
        ...calc,
        asset,
        categoryName: catMap.get(asset.category) || asset.category,
      };
    });
  }, [activeAssets, fromDate, toDate, catMap]);

  // Totals for Period Report
  const periodTotals = useMemo(() => {
    return periodResults.reduce(
      (acc, r) => {
        acc.totalCost += r.totalCost;
        acc.beginningBookValue += r.beginningBookValue;
        acc.periodExpense += r.periodExpense;
        acc.accumulatedAtEnd += r.accumulatedAtEnd;
        acc.endingBookValue += r.endingBookValue;
        return acc;
      },
      { totalCost: 0, beginningBookValue: 0, periodExpense: 0, accumulatedAtEnd: 0, endingBookValue: 0 }
    );
  }, [periodResults]);

  // Report 2: Category Breakdown for the specific period
  const categoryPeriodSummary = useMemo(() => {
    const map = new Map<
      string,
      { count: number; cost: number; beginning: number; periodExpense: number; accumulated: number; ending: number }
    >();

    categories.forEach((c) => {
      map.set(c.id, { count: 0, cost: 0, beginning: 0, periodExpense: 0, accumulated: 0, ending: 0 });
    });

    periodResults.forEach((r) => {
      const cData = map.get(r.category) || { count: 0, cost: 0, beginning: 0, periodExpense: 0, accumulated: 0, ending: 0 };
      cData.count++;
      cData.cost += r.totalCost;
      cData.beginning += r.beginningBookValue;
      cData.periodExpense += r.periodExpense;
      cData.accumulated += r.accumulatedAtEnd;
      cData.ending += r.endingBookValue;
      map.set(r.category, cData);
    });

    return Array.from(map.entries()).map(([catId, data]) => ({
      categoryId: catId,
      categoryName: catMap.get(catId) || catId,
      ...data,
    }));
  }, [categories, periodResults, catMap]);

  // Report 3: Department Breakdown with Category Details
  const departmentSummary = useMemo(() => {
    const map = new Map<string, { count: number; cost: number; nbv: number; periodExpense: number; categories: Set<string> }>();
    periodResults.forEach((r) => {
      const dept = r.asset.department || 'الإدارة العامة';
      const dData = map.get(dept) || { count: 0, cost: 0, nbv: 0, periodExpense: 0, categories: new Set() };
      dData.count++;
      dData.cost += r.totalCost;
      dData.nbv += r.endingBookValue;
      dData.periodExpense += r.periodExpense;
      dData.categories.add(r.categoryName);
      map.set(dept, dData);
    });

    return Array.from(map.entries()).map(([dept, data]) => ({
      department: dept,
      ...data,
      categoriesList: Array.from(data.categories).join('، '),
    }));
  }, [periodResults]);

  // Report 4: Disposals with explicit Category and Department Filter
  const disposalAssets = useMemo(() => {
    return assets.filter((a) => {
      if (a.status !== 'disposed' || !a.disposal) return false;
      const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
      const dept = (a.department || 'الإدارة العامة').trim();
      const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(dept);
      return matchCat && matchDept;
    });
  }, [assets, selectedCategory, selectedDepartments]);

  // Active custom columns selected by user
  const activeCustomColumns = useMemo(() => {
    return ALL_CUSTOM_REPORT_COLUMNS.filter((c) => selectedColumnIds.includes(c.id));
  }, [selectedColumnIds]);

  // Report 5: Filtered Assets for Custom Report (Rows selected according to user criteria)
  const customFilteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Department filter
      if (selectedDepartments.length > 0) {
        const d = (asset.department || 'الإدارة العامة').trim();
        if (!selectedDepartments.includes(d)) return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && asset.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (customStatusFilter !== 'all' && asset.status !== customStatusFilter) {
        return false;
      }
      // Start rule filter
      if (customRuleFilter !== 'all' && asset.startDepreciationRule !== customRuleFilter) {
        return false;
      }
      // Keyword search filter
      if (customSearchTerm.trim()) {
        const q = customSearchTerm.toLowerCase().trim();
        const code = (asset.code || '').toLowerCase();
        const name = (asset.name || '').toLowerCase();
        const cust = (asset.custodian || '').toLowerCase();
        const loc = (asset.location || '').toLowerCase();
        const sn = (asset.serialNumber || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !cust.includes(q) && !loc.includes(q) && !sn.includes(q)) {
          return false;
        }
      }
      // Individual row exclusion filter
      if (customExcludedAssetIds.has(asset.id)) {
        return false;
      }
      return true;
    });
  }, [assets, selectedDepartments, selectedCategory, customStatusFilter, customRuleFilter, customSearchTerm, customExcludedAssetIds]);

  // Process rows and period values for Custom Report
  const customReportData = useMemo(() => {
    const list = customFilteredAssets.map((asset) => {
      const period = calculatePeriodDepreciation(asset, fromDate, toDate);
      const rowDict: Record<string, any> = {};
      const displayDict: Record<string, string> = {};

      ALL_CUSTOM_REPORT_COLUMNS.forEach((col) => {
        const val = col.getValue(asset, period, catMap);
        rowDict[col.id] = val.raw;
        displayDict[col.id] = val.display;
      });

      return {
        asset,
        period,
        rawRow: rowDict,
        displayRow: displayDict,
      };
    });

    // Sorting
    list.sort((a, b) => {
      const valA = a.rawRow[customSortBy];
      const valB = b.rawRow[customSortBy];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return customSortDir === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? '');
      const strB = String(valB ?? '');
      return customSortDir === 'asc' ? strA.localeCompare(strB, 'ar') : strB.localeCompare(strA, 'ar');
    });

    return list;
  }, [customFilteredAssets, fromDate, toDate, catMap, customSortBy, customSortDir]);

  // Custom report totals
  const customTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    ALL_CUSTOM_REPORT_COLUMNS.forEach((col) => {
      if (col.isFinancial || col.isNumeric) {
        totals[col.id] = 0;
      }
    });

    customReportData.forEach((item) => {
      ALL_CUSTOM_REPORT_COLUMNS.forEach((col) => {
        if (col.isFinancial || col.isNumeric) {
          const val = item.rawRow[col.id];
          const num = typeof val === 'number' ? val : parseFloat(val) || 0;
          totals[col.id] = (totals[col.id] || 0) + num;
        }
      });
    });

    return totals;
  }, [customReportData]);

  // Text summary of active filters for Excel subtitle
  const customFilterSummaryText = useMemo(() => {
    const parts: string[] = [];
    if (selectedDepartments.length > 0) parts.push(`الإدارات: ${selectedDepartments.join('، ')}`);
    if (selectedCategory !== 'all') parts.push(`التصنيف: ${catMap.get(selectedCategory) || selectedCategory}`);
    if (customStatusFilter !== 'all') parts.push(`الحالة: ${customStatusFilter === 'active' ? 'نشط فقط' : 'مستبعد فقط'}`);
    if (customRuleFilter !== 'all') parts.push(`السياسة: ${customRuleFilter === 'mid_month_15' ? 'قاعدة 15 يوم' : customRuleFilter}`);
    if (customExcludedAssetIds.size > 0) parts.push(`مستبعد يدوياً: ${customExcludedAssetIds.size} أصل`);
    return parts.join(' | ') || 'كافة الأصول والإدارات';
  }, [selectedDepartments, selectedCategory, customStatusFilter, customRuleFilter, customExcludedAssetIds, catMap]);

  // Export current report to Excel with rich colors, RTL, and formatting
  const handleExportExcel = () => {
    try {
      setIsExportingExcel(true);
      if (reportType === 'period') {
        if (periodResults.length === 0) {
          showFeedback('error', 'تنبيه: لا توجد أصول مطابقة للفترة المحددة لتصديرها.');
          setIsExportingExcel(false);
          return;
        }
        exportPeriodReportToExcel(
          periodResults,
          periodTotals,
          fromDate,
          toDate,
          currency,
          companyName,
          selectedDepartments,
          selectedCategory,
          catMap
        );
        showFeedback('success', `تم تصدير تقرير إهلاك الفترة (${periodResults.length} أصل) إلى ملف إكسل بنجاح!`);
      } else if (reportType === 'category') {
        exportCategoryReportToExcel(
          categoryPeriodSummary,
          fromDate,
          toDate,
          currency,
          companyName
        );
        showFeedback('success', `تم تصدير تقرير إهلاك التصنيفات إلى ملف إكسل بنجاح!`);
      } else if (reportType === 'department') {
        exportDepartmentReportToExcel(
          departmentSummary,
          fromDate,
          toDate,
          currency,
          companyName
        );
        showFeedback('success', `تم تصدير تقرير أصول وإهلاك الإدارات إلى ملف إكسل بنجاح!`);
      } else if (reportType === 'disposals') {
        exportDisposalsReportToExcel(
          disposalAssets,
          currency,
          companyName,
          catMap
        );
        showFeedback('success', `تم تصدير سجل استبعاد ومبيعات الأصول (${disposalAssets.length} أصل) بنجاح!`);
      } else if (reportType === 'custom') {
        if (activeCustomColumns.length === 0) {
          showFeedback('error', 'يرجى تحديد عمود واحد على الأقل من لوحة اختيار الأعمدة قبل التصدير.');
          setIsExportingExcel(false);
          return;
        }
        if (customReportData.length === 0) {
          showFeedback('error', 'لا توجد أصول مطابقة للمحددات الحالية لتصديرها. تحقق من الفلاتر أو الأصول المستبعدة.');
          setIsExportingExcel(false);
          return;
        }

        const safeTitle = (customReportTitle || 'تقرير_الأصول_المخصص').replace(/[/\\?%*:|"<>]/g, '_').trim();
        exportCustomReportToExcel({
          title: customReportTitle || 'تقرير الأصول المخصص والمفصل',
          columns: activeCustomColumns.map((c) => ({
            id: c.id,
            label: c.label,
            align: c.align,
            width: c.width,
            isFinancial: c.isFinancial,
            isNumeric: c.isNumeric,
            highlight: c.highlight,
          })),
          rows: customReportData.map((r) => r.rawRow),
          currency,
          companyName,
          fromDate,
          toDate,
          filterSummary: customFilterSummaryText,
          filename: `${safeTitle}_${fromDate}_إلى_${toDate}.xlsx`,
        });
        showFeedback('success', `تم تصدير التقرير المخصص (${customReportData.length} أصل، ${activeCustomColumns.length} عمود) إلى ملف إكسل بنجاح!`);
      }
    } catch (err: any) {
      console.error('Error exporting to Excel:', err);
      showFeedback('error', `حدث خطأ أثناء تصدير ملف الإكسل: ${err?.message || 'خطأ غير متوقع'}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Helper to build the high-fidelity A4 Printable & PDF Configuration for all 5 reports
  const getPrintableReportConfig = (): PrintableReportConfig => {
    try {
      if (reportType === 'custom') {
        const cols = activeCustomColumns.length > 0 ? activeCustomColumns : ALL_CUSTOM_REPORT_COLUMNS.slice(0, 8);
        return {
          title: customReportTitle || 'تقرير الأصول المخصص والمفصل',
          companyName,
          currency,
          fromDate,
          toDate,
          metaBadges: [
            `الأعمدة: ${cols.length} عمود`,
            `الإدارات: ${selectedDepartments.length === 0 ? 'كافة الإدارات' : selectedDepartments.join('، ')}`,
            `التصنيف: ${selectedCategory === 'all' ? 'كافة التصنيفات' : (catMap.get(selectedCategory) || selectedCategory)}`,
          ],
          kpiSummary: {
            totalCount: customReportData.length,
            totalCost: customTotals['totalCost'] || 0,
            periodExpense: customTotals['periodExpense'] || 0,
            endingNBV: customTotals['endingBookValue'] || 0,
            beginningNBV: customTotals['beginningBookValue'] || 0,
          },
          columns: cols.map((c) => ({
            label: c.label,
            align: c.align,
            highlight: c.highlight,
          })),
          rows: customReportData.map((item) =>
            cols.map((col) => ({
              text: item.displayRow[col.id] ?? '-',
              align: col.align || (col.isFinancial || col.isNumeric ? 'left' : 'right'),
              highlight: col.highlight,
              isBold: col.highlight === 'amber' || col.highlight === 'emerald',
            }))
          ),
          totals: [
            { text: 'الإجمالي العام:', align: 'right', isBold: true },
            ...cols.slice(1).map((col) => {
              if (col.isFinancial) {
                return {
                  text: `${formatNumber(customTotals[col.id] || 0)} ${currency}`,
                  align: 'left' as const,
                  isBold: true,
                };
              }
              if (col.isNumeric) {
                return {
                  text: formatNumber(customTotals[col.id] || 0),
                  align: 'center' as const,
                  isBold: true,
                };
              }
              return { text: '-', align: 'center' as const };
            }),
          ],
          orientation: printOrientation,
          colorMode: printColorMode,
        };
      } else if (reportType === 'period') {
        return {
          title: `تقرير حركة ومصروف إهلاك الأصول للفترة من ${fromDate} إلى ${toDate}`,
          companyName,
          currency,
          fromDate,
          toDate,
          metaBadges: [
            `الإدارات: ${selectedDepartments.length === 0 ? 'كافة الإدارات' : selectedDepartments.join('، ')}`,
            `التصنيف: ${selectedCategory === 'all' ? 'كافة التصنيفات' : (catMap.get(selectedCategory) || selectedCategory)}`,
          ],
          kpiSummary: {
            totalCount: periodResults.length,
            totalCost: periodTotals.totalCost,
            periodExpense: periodTotals.periodExpense,
            endingNBV: periodTotals.endingBookValue,
            beginningNBV: periodTotals.beginningBookValue,
          },
          columns: [
            { label: 'كود الأصل', align: 'center' },
            { label: 'اسم الأصل', align: 'right' },
            { label: 'الإدارة / القسم', align: 'right' },
            { label: 'تصنيف الأصل', align: 'right' },
            { label: 'تاريخ التشغيل', align: 'center' },
            { label: 'طريقة وسياسة الإهلاك', align: 'right' },
            { label: 'التكلفة التاريخية', align: 'left' },
            { label: 'القيمة أول الفترة', align: 'left' },
            { label: 'مصروف إهلاك الفترة', align: 'left', highlight: 'amber' },
            { label: 'مجمع الإهلاك نهاية الفترة', align: 'left' },
            { label: 'صافي القيمة نهاية الفترة', align: 'left', highlight: 'emerald' },
          ],
          rows: periodResults.map((r) => [
            { text: r.asset.code, align: 'center' },
            { text: r.asset.name, align: 'right', isBold: true },
            { text: r.asset.department || 'الإدارة العامة', align: 'right' },
            { text: r.categoryName, align: 'right' },
            { text: r.asset.inServiceDate, align: 'center' },
            { text: getMethodLabel(r.asset.depreciationMethod).ar, align: 'right' },
            { text: `${formatNumber(r.totalCost)} ${currency}`, align: 'left' },
            { text: `${formatNumber(r.beginningBookValue)} ${currency}`, align: 'left' },
            { text: `${formatNumber(r.periodExpense)} ${currency}`, align: 'left', highlight: 'amber', isBold: true },
            { text: `${formatNumber(r.accumulatedAtEnd)} ${currency}`, align: 'left' },
            { text: `${formatNumber(r.endingBookValue)} ${currency}`, align: 'left', highlight: 'emerald', isBold: true },
          ]),
          totals: [
            { text: 'الإجمالي العام:', align: 'right', isBold: true, colSpan: 6 },
            { text: `${formatNumber(periodTotals.totalCost)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(periodTotals.beginningBookValue)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(periodTotals.periodExpense)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(periodTotals.accumulatedAtEnd)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(periodTotals.endingBookValue)} ${currency}`, align: 'left', isBold: true },
          ],
          orientation: printOrientation,
          colorMode: printColorMode,
        };
      } else if (reportType === 'category') {
        const sumCost = categoryPeriodSummary.reduce((s, c) => s + c.cost, 0);
        const sumExpense = categoryPeriodSummary.reduce((s, c) => s + c.periodExpense, 0);
        const sumEnding = categoryPeriodSummary.reduce((s, c) => s + c.ending, 0);
        const sumCount = categoryPeriodSummary.reduce((s, c) => s + c.count, 0);

        return {
          title: `تقرير إهلاك الأصول حسب التصنيفات والفئات للفترة من ${fromDate} إلى ${toDate}`,
          companyName,
          currency,
          fromDate,
          toDate,
          kpiSummary: {
            totalCount: sumCount,
            totalCost: sumCost,
            periodExpense: sumExpense,
            endingNBV: sumEnding,
          },
          columns: [
            { label: 'تصنيف وفئة الأصل', align: 'right' },
            { label: 'عدد الأصول', align: 'center' },
            { label: 'إجمالي التكلفة الرأسمالية', align: 'left' },
            { label: 'القيمة الدفترية أول الفترة', align: 'left' },
            { label: 'مصروف إهلاك الفترة', align: 'left', highlight: 'amber' },
            { label: 'مجمع الإهلاك حتى نهاية الفترة', align: 'left' },
            { label: 'صافي القيمة الدفترية نهاية الفترة', align: 'left', highlight: 'emerald' },
            { label: 'نسبة الاستهلاك %', align: 'center' },
          ],
          rows: categoryPeriodSummary.map((c) => {
            const ratio = c.cost > 0 ? (c.accumulated / c.cost) * 100 : 0;
            return [
              { text: c.categoryName, align: 'right', isBold: true },
              { text: String(c.count), align: 'center' },
              { text: `${formatNumber(c.cost)} ${currency}`, align: 'left' },
              { text: `${formatNumber(c.beginning)} ${currency}`, align: 'left' },
              { text: `${formatNumber(c.periodExpense)} ${currency}`, align: 'left', highlight: 'amber', isBold: true },
              { text: `${formatNumber(c.accumulated)} ${currency}`, align: 'left' },
              { text: `${formatNumber(c.ending)} ${currency}`, align: 'left', highlight: 'emerald', isBold: true },
              { text: `${formatPercent(ratio)}`, align: 'center' },
            ];
          }),
          totals: [
            { text: 'المجموع الكلي لكافة التصنيفات:', align: 'right', isBold: true },
            { text: String(sumCount), align: 'center', isBold: true },
            { text: `${formatNumber(sumCost)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(categoryPeriodSummary.reduce((s, c) => s + c.beginning, 0))} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(sumExpense)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(categoryPeriodSummary.reduce((s, c) => s + c.accumulated, 0))} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(sumEnding)} ${currency}`, align: 'left', isBold: true },
            { text: '-', align: 'center' },
          ],
          orientation: printOrientation,
          colorMode: printColorMode,
        };
      } else if (reportType === 'department') {
        const sumCost = departmentSummary.reduce((s, d) => s + d.cost, 0);
        const sumExpense = departmentSummary.reduce((s, d) => s + d.periodExpense, 0);
        const sumNBV = departmentSummary.reduce((s, d) => s + d.nbv, 0);
        const sumCount = departmentSummary.reduce((s, d) => s + d.count, 0);

        return {
          title: `تقرير أصول وإهلاك الأقسام والإدارات للفترة من ${fromDate} إلى ${toDate}`,
          companyName,
          currency,
          fromDate,
          toDate,
          kpiSummary: {
            totalCount: sumCount,
            totalCost: sumCost,
            periodExpense: sumExpense,
            endingNBV: sumNBV,
          },
          columns: [
            { label: 'الإدارة / القسم', align: 'right' },
            { label: 'التصنيفات المشمولة', align: 'right' },
            { label: 'عدد الأصول', align: 'center' },
            { label: 'إجمالي التكلفة الرأسمالية', align: 'left' },
            { label: 'مصروف إهلاك الفترة', align: 'left', highlight: 'amber' },
            { label: 'صافي القيمة الدفترية', align: 'left', highlight: 'emerald' },
          ],
          rows: departmentSummary.map((d) => [
            { text: d.department, align: 'right', isBold: true },
            { text: d.categoriesList, align: 'right' },
            { text: String(d.count), align: 'center' },
            { text: `${formatNumber(d.cost)} ${currency}`, align: 'left' },
            { text: `${formatNumber(d.periodExpense)} ${currency}`, align: 'left', highlight: 'amber', isBold: true },
            { text: `${formatNumber(d.nbv)} ${currency}`, align: 'left', highlight: 'emerald', isBold: true },
          ]),
          totals: [
            { text: 'المجموع الكلي لجميع الإدارات:', align: 'right', isBold: true, colSpan: 2 },
            { text: String(sumCount), align: 'center', isBold: true },
            { text: `${formatNumber(sumCost)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(sumExpense)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(sumNBV)} ${currency}`, align: 'left', isBold: true },
          ],
          orientation: printOrientation,
          colorMode: printColorMode,
        };
      } else {
        const sumSales = disposalAssets.reduce((s, a) => s + (a.disposal?.salePrice || 0), 0);
        const sumBookVal = disposalAssets.reduce((s, a) => s + (a.disposal?.bookValueAtDisposal || 0), 0);
        const sumGainLoss = disposalAssets.reduce((s, a) => s + (a.disposal?.gainLoss || 0), 0);
        const sumCost = disposalAssets.reduce((s, a) => s + getTotalCost(a), 0);

        return {
          title: `سجل استبعاد وبيع وتخريد الأصول الثابتة والأرباح الرأسمالية`,
          companyName,
          currency,
          kpiSummary: {
            totalCount: disposalAssets.length,
            totalCost: sumCost,
            periodExpense: sumBookVal,
            endingNBV: sumSales,
          },
          columns: [
            { label: 'كود الأصل', align: 'center' },
            { label: 'اسم الأصل', align: 'right' },
            { label: 'تصنيف الأصل', align: 'right' },
            { label: 'تاريخ الاستبعاد', align: 'center' },
            { label: 'نوع العملية', align: 'center' },
            { label: 'سعر البيع', align: 'left' },
            { label: 'القيمة الدفترية عند البيع', align: 'left' },
            { label: 'أرباح / (خسائر) رأسمالية', align: 'left' },
            { label: 'المشتري / السبب', align: 'right' },
          ],
          rows: disposalAssets.map((asset) => {
            const d = asset.disposal!;
            return [
              { text: asset.code, align: 'center' },
              { text: asset.name, align: 'right', isBold: true },
              { text: catMap.get(asset.category) || asset.category, align: 'right' },
              { text: d.disposalDate, align: 'center' },
              { text: d.disposalType === 'sale' ? 'بيع' : d.disposalType, align: 'center' },
              { text: `${formatNumber(d.salePrice)} ${currency}`, align: 'left' },
              { text: `${formatNumber(d.bookValueAtDisposal)} ${currency}`, align: 'left' },
              { text: `${d.gainLoss > 0 ? '+' : ''}${formatNumber(d.gainLoss)} ${currency}`, align: 'left', highlight: d.gainLoss >= 0 ? 'emerald' : 'amber', isBold: true },
              { text: d.buyerName || d.reason || '-', align: 'right' },
            ];
          }),
          totals: [
            { text: 'الإجمالي العام:', align: 'right', isBold: true, colSpan: 5 },
            { text: `${formatNumber(sumSales)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(sumBookVal)} ${currency}`, align: 'left', isBold: true },
            { text: `${formatNumber(sumGainLoss)} ${currency}`, align: 'left', isBold: true },
            { text: '-', align: 'center' },
          ],
          orientation: printOrientation,
          colorMode: printColorMode,
        };
      }
    } catch (err: any) {
      console.error('Error building printable report config:', err);
      return {
        title: 'التقرير المالي للأصول',
        companyName,
        currency,
        columns: [{ label: 'البيان', align: 'right' }],
        rows: [[{ text: 'حدث خطأ أثناء إعداد التقرير' }]],
      };
    }
  };

  // Download standalone printable HTML report (Works 100% offline and in all sandboxed iframes)
  const handleDownloadPrintableHTML = () => {
    try {
      const config = getPrintableReportConfig();
      downloadPrintableHTMLReport(config);
      showFeedback('success', 'تم تنزيل نسخة التقرير المالي الجاهزة للطباعة والـ PDF مقاس A4 بنجاح!');
    } catch (err: any) {
      console.error('Error downloading printable HTML:', err);
      showFeedback('error', `تعذر تجهيز التقرير للطباعة: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // High-fidelity A4 Print and PDF Export with pure vector quality
  const handlePrintPdf = () => {
    try {
      const config = getPrintableReportConfig();
      printReportDirectly(config);
      showFeedback('success', 'تم إرسال أمر الطباعة / الحفظ كـ PDF بمقاس A4 بنجاح.');
    } catch (err: any) {
      console.warn('Direct print failed, downloading standalone A4 HTML instead:', err);
      handleDownloadPrintableHTML();
    }
  };

  // Open standalone vector report in new window
  const handleOpenNewWindow = () => {
    try {
      const config = getPrintableReportConfig();
      openReportInNewWindow(config);
      showFeedback('success', 'تم فتح التقرير المالي في نافذة مستقلة جديدة.');
    } catch (err: any) {
      console.warn('Open new window failed:', err);
      handleDownloadPrintableHTML();
    }
  };

  const monthNames = [
    'يناير (شهر 1)', 'فبراير (شهر 2)', 'مارس (شهر 3)', 'أبريل (شهر 4)', 'مايو (شهر 5)', 'يونيو (شهر 6)',
    'يوليو (شهر 7)', 'أغسطس (شهر 8)', 'سبتمبر (شهر 9)', 'أكتوبر (شهر 10)', 'نوفمبر (شهر 11)', 'ديسمبر (شهر 12)'
  ];

  return (
    <div className="space-y-6">
      {/* Control Box (Hidden in Print) */}
      <div className="no-print rounded-2xl bg-slate-800/80 p-5 border border-slate-700/70 shadow-md space-y-4">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-400" />
              التقارير المالية وحركة الإهلاك (شهرية، سنوية، وفترات مخصصة)
            </h2>
            <p className="text-xs text-slate-400">
              تحديد الفترة بدقة واحتساب مصروف وإهلاك كل أصل، مع دعم التصدير الملون للإكسل والـ PDF بمقاس A4
            </p>
          </div>
        </div>

        {/* PDF & Excel A4 Print & Export Formatting Panel */}
        <div className="rounded-xl bg-slate-900/90 p-3.5 border border-slate-700/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            {/* A4 Page Orientation */}
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold">مقاس وتوجيه A4:</span>
              <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPrintOrientation('landscape')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                    printOrientation === 'landscape'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="عرضي A4 Landscape - مستحسن للجداول المالية الكبيرة"
                >
                  A4 عرضي (مستحسن)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrientation('portrait')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                    printOrientation === 'portrait'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="طولي A4 Portrait"
                >
                  A4 طولي
                </button>
              </div>
            </div>

            {/* Print Color Mode */}
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold">تنسيق الألوان:</span>
              <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPrintColorMode('color')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                    printColorMode === 'color'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="ألوان محاسبية كاملة للتقارير والـ PDF"
                >
                  ألوان كاملة (Color)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintColorMode('bw')}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                    printColorMode === 'bw'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="أبيض وأسود للطباعة الورقية الاقتصادية"
                >
                  أبيض وأسود (B&W)
                </button>
              </div>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-3.5 py-2 text-xs font-bold transition shadow-md shadow-emerald-950/40 cursor-pointer"
              title="تصدير التقرير الحالي إلى إكسل منسق بالألوان وتجميد الترويسة ومن اليمين إلى اليسار"
            >
              {isExportingExcel ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span>تصدير إكسل (ملون و RTL)</span>
            </button>
            <button
              onClick={() => setIsPrintPreviewOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 text-xs font-bold transition shadow-md shadow-sky-950/40 cursor-pointer"
              title="معاينة التقرير الرسمي المالي مقاس A4 وتخصيص الطباعة وتصدير PDF"
            >
              <Eye className="h-4 w-4" />
              <span>معاينة وطباعة A4 (PDF)</span>
            </button>
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-2 text-xs font-bold transition shadow-md shadow-blue-950/40 cursor-pointer"
              title="طباعة التقرير فورياً أو حفظه كـ PDF مقاس A4 نصوص متجهة 100%"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة فورية / PDF</span>
            </button>
            <button
              onClick={handleDownloadPrintableHTML}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 text-xs font-medium transition cursor-pointer"
              title="تنزيل صفحة A4 مستقلة للطباعة المباشرة والـ PDF في أي متصفح دون إنترنت"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              <span>تنزيل صفحة A4</span>
            </button>
          </div>
        </div>

        {/* Global Export Alert & Feedback Banner */}
        {exportFeedback && (
          <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border shadow-md animate-fade-in ${
            exportFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/70 text-rose-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {exportFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{exportFeedback.message}</span>
            </div>
            <button 
              onClick={() => setExportFeedback(null)} 
              className="p-1 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="إغلاق التنبيه"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Report Kind Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-700">
          <button
            onClick={() => setReportType('period')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center transition ${
              reportType === 'period'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            تقرير حركة وإهلاك الفترة (من - إلى)
          </button>
          <button
            onClick={() => setReportType('category')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center transition ${
              reportType === 'category'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            تقرير الإهلاك حسب تصنيفات الأصول
          </button>
          <button
            onClick={() => setReportType('department')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center transition ${
              reportType === 'department'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            توزيع الأصول وتصنيفاتها حسب الأقسام
          </button>
          <button
            onClick={() => setReportType('disposals')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold text-center transition ${
              reportType === 'disposals'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            سجل الاستبعادات والمبيعات وتصنيفاتها
          </button>
          <button
            onClick={() => setReportType('custom')}
            className={`col-span-2 sm:col-span-1 px-3 py-2.5 rounded-xl text-xs font-bold text-center transition flex items-center justify-center gap-1.5 ${
              reportType === 'custom'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                : 'bg-slate-900 text-emerald-300 hover:bg-slate-850 border border-emerald-700/50'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 text-emerald-400" />
            <span>تصميم تقرير مخصص (أعمدة وصفوف)</span>
          </button>
        </div>

        {/* Date Filter & Period Selector Panel */}
        <div className="rounded-xl bg-slate-900/90 p-4 border border-slate-700/80 space-y-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Period Mode Selector */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <CalendarRange className="h-4 w-4 text-sky-400" />
                نوع الفترة:
              </span>
              <button
                type="button"
                onClick={() => handlePeriodTypeChange('custom')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  periodType === 'custom' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                تحديد فترة مخصصة (من - إلى)
              </button>
              <button
                type="button"
                onClick={() => handlePeriodTypeChange('annual')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  periodType === 'annual' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                تقرير سنوي
              </button>
              <button
                type="button"
                onClick={() => handlePeriodTypeChange('monthly')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  periodType === 'monthly' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                تقرير شهري
              </button>
              <button
                type="button"
                onClick={() => handlePeriodTypeChange('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  periodType === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                كامل المدة حتى اليوم
              </button>
            </div>

            {/* Quick shortcuts */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">فترات سريعة:</span>
              <button
                type="button"
                onClick={() => applyPreset('this_month')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => applyPreset('this_quarter')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                الربع الحالي
              </button>
              <button
                type="button"
                onClick={() => applyPreset('this_year')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                السنة الحالية
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last_year')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                السنة السابقة
              </button>
            </div>
          </div>

          {/* Date Picker Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
            {/* If Annual: Year selector */}
            {periodType === 'annual' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">اختر السنة المالية:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
                >
                  {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5].map((y) => (
                    <option key={y} value={y}>
                      السنة المالية {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* If Monthly: Year and Month selector */}
            {periodType === 'monthly' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">السنة:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
                  >
                    {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">الشهر:</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    {monthNames.map((m, i) => (
                      <option key={i + 1} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Custom Range: From Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                من تاريخ: <span className="text-slate-400 font-mono-numbers">(YYYY-MM-DD)</span>
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPeriodType('custom');
                }}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Custom Range: To Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                إلى تاريخ: <span className="text-slate-400 font-mono-numbers">(YYYY-MM-DD)</span>
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPeriodType('custom');
                }}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white font-mono-numbers focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Category / Classification Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">تصفية حسب تصنيف الأصل:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="all">كافة التصنيفات والفئات ({assets.length} أصل)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-Department Filter Panel (بحسب إدارة معينة أو عدة إدارات) */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Building className="h-4 w-4 text-emerald-400" />
                <span>استخراج التقرير بحسب الإدارات:</span>
                <span className="text-[11px] font-normal text-emerald-400">
                  {selectedDepartments.length === 0
                    ? '(كافة الإدارات مشمولة بالتقرير)'
                    : `(تم تحديد ${selectedDepartments.length} من إجمالي ${availableDepartments.length} إدارات)`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedDepartments([])}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    selectedDepartments.length === 0
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  كافة الإدارات ({assets.length} أصل)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDepartments([...availableDepartments])}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                >
                  تحديد الكل
                </button>
                {selectedDepartments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDepartments([])}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 hover:bg-rose-900/70 text-xs"
                  >
                    إلغاء التحديد
                  </button>
                )}
              </div>
            </div>

            {/* Department interactive multi-select pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {availableDepartments.map((dept) => {
                const isSelected = selectedDepartments.includes(dept);
                const countInDept = assets.filter((a) => (a.department || 'الإدارة العامة').trim() === dept).length;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDepartment(dept)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition border ${
                      isSelected
                        ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 font-bold shadow-md ring-1 ring-emerald-500/40'
                        : selectedDepartments.length === 0
                        ? 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-600'
                        : 'bg-slate-800/30 border-slate-800 text-slate-400 hover:border-slate-700 opacity-75'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-slate-500" />
                    )}
                    <span>{dept}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-400 font-mono-numbers">
                      {countInDept}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CUSTOM REPORT DESIGNER: Columns & Rows Customizer */}
        {reportType === 'custom' && (
          <div className="space-y-4 no-print">
            {/* Custom Report Instant Export Action Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-sky-950/90 p-4 border border-emerald-500/50 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                    <span>تقريرك المخصص جاهز للتصدير:</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono-numbers text-xs font-bold border border-emerald-500/30">
                      {activeCustomColumns.length} عموداً مختاراً
                    </span>
                    <span>•</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 font-mono-numbers text-xs font-bold border border-sky-500/30">
                      {customReportData.length} أصلاً مشمولاً
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    اختر الأعمدة والصفوف أدناه حسب حاجتك، ثم اضغط على زر التصدير لحفظ الملف فوراً
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 active:scale-95 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 cursor-pointer"
                  title="تصدير الأعمدة والصفوف المحددة حالياً إلى ملف Excel منسق وملون"
                >
                  {isExportingExcel ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <FileSpreadsheet className="h-4 w-4" />}
                  <span>تصدير التقرير المخصص إلى Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold transition shadow-lg shadow-sky-950/50 cursor-pointer"
                  title="طباعة التقرير المخصص أو حفظه كـ PDF مقاس A4"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة / حفظ كـ PDF (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPrintableHTML}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                  title="تنزيل صفحة التقرير كاملة كملف مستقل جاهز للطباعة والـ PDF في أي متصفح"
                >
                  <Download className="h-3.5 w-3.5 text-sky-400" />
                  <span>تنزيل صفحة A4</span>
                </button>
              </div>
            </div>

            {/* 1. Report Title & Fast Presets Bar */}
            <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-5 border border-emerald-600/30 shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    عنوان التقرير المخصص (يظهر في الإكسل والـ PDF المطبوع):
                  </label>
                  <input
                    type="text"
                    value={customReportTitle}
                    onChange={(e) => setCustomReportTitle(e.target.value)}
                    placeholder="مثال: تقرير حصر وإهلاك الأصول للإدارة العامة والمالية..."
                    className="w-full rounded-xl bg-slate-950/80 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 px-3.5 py-2 text-sm text-white font-semibold transition"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      saveCustomColumnsPreference(selectedColumnIds);
                      setSavedSuccessMsg('تم حفظ قالب الأعمدة المخصص بنجاح!');
                      setTimeout(() => setSavedSuccessMsg(null), 3500);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/50 px-3.5 py-2 text-xs font-bold transition"
                    title="حفظ اختياراتك الحالية للأعمدة لتفتح تلقائياً في المرات القادمة"
                  >
                    <Save className="h-4 w-4" />
                    <span>حفظ كقالب افتراضي</span>
                  </button>
                  {savedSuccessMsg && (
                    <span className="text-xs text-emerald-400 font-semibold animate-fade-in flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      {savedSuccessMsg}
                    </span>
                  )}
                </div>
              </div>

              {/* Column Presets */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400" />
                    قوالب جاهزة سريعة للأعمدة:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedColumnIds(PRESETS.FINANCIAL);
                      setSavedSuccessMsg('تم تطبيق القالب المالي بنجاح');
                      setTimeout(() => setSavedSuccessMsg(null), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition"
                  >
                    📊 التقرير المالي الشامل (11)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedColumnIds(PRESETS.INVENTORY);
                      setSavedSuccessMsg('تم تطبيق قالب الحصر والعهدة');
                      setTimeout(() => setSavedSuccessMsg(null), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition"
                  >
                    🏢 الحصر الميداني والعهدة (11)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedColumnIds(PRESETS.POLICIES_AND_15_DAYS);
                      setSavedSuccessMsg('تم تطبيق قالب السياسات وقاعدة 15 يوم');
                      setTimeout(() => setSavedSuccessMsg(null), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition"
                  >
                    ⚖️ سياسات وقاعدة 15 يوم (11)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedColumnIds(PRESETS.ALL);
                      setSavedSuccessMsg('تم تحديد كافة الأعمدة الـ 23');
                      setTimeout(() => setSavedSuccessMsg(null), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900/80 text-sky-300 border border-sky-700/60 font-semibold transition"
                  >
                    ✨ تحديد كافة الأعمدة (23)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColumnIds(['code', 'name'])}
                    className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                  >
                    مسح التحديد
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsColumnsPanelOpen(!isColumnsPanelOpen)}
                  className="flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300 transition"
                >
                  <span>{isColumnsPanelOpen ? 'إخفاء لوحة اختيار الأعمدة' : 'إظهار لوحة اختيار الأعمدة'}</span>
                  {isColumnsPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 2. Interactive Column Selector Panel */}
            {isColumnsPanelOpen && (
              <div className="rounded-2xl bg-slate-900/90 p-5 border border-slate-700/80 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sliders className="h-4 w-4 text-emerald-400" />
                      اختر الأعمدة المراد تضمينها في التقرير:
                    </span>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                      {selectedColumnIds.length} من {ALL_CUSTOM_REPORT_COLUMNS.length} عمود محدد
                    </span>
                  </div>

                  {/* Group Tabs */}
                  <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveColumnGroupTab('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        activeColumnGroupTab === 'all'
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      الكل ({ALL_CUSTOM_REPORT_COLUMNS.length})
                    </button>
                    {(['basic', 'dates_policies', 'financial', 'operations'] as ColumnGroup[]).map((grp) => (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setActiveColumnGroupTab(grp)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                          activeColumnGroupTab === grp
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {grp === 'basic' ? 'الأساسية' : grp === 'dates_policies' ? 'السياسات والتواريخ' : grp === 'financial' ? 'المالية' : 'التشغيلية والعهدة'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column Selection Chips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {ALL_CUSTOM_REPORT_COLUMNS.filter((col) => activeColumnGroupTab === 'all' || col.group === activeColumnGroupTab).map((col) => {
                    const isSelected = selectedColumnIds.includes(col.id);
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setSelectedColumnIds((prev) => {
                            if (prev.includes(col.id)) {
                              if (prev.length <= 1) return prev;
                              return prev.filter((id) => id !== col.id);
                            } else {
                              const next = [...prev, col.id];
                              return ALL_CUSTOM_REPORT_COLUMNS.filter((c) => next.includes(c.id)).map((c) => c.id);
                            }
                          });
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium text-right transition ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 shadow-sm'
                            : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-500 shrink-0" />
                          )}
                          <span className="truncate">{col.label}</span>
                        </div>
                        {col.isFinancial && (
                          <span className="text-[10px] rounded bg-amber-500/10 text-amber-300 px-1.5 py-0.2 border border-amber-500/20 shrink-0">
                            مالي
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Row Filters, Search, Sorting, and Cherry-picking */}
            <div className="rounded-2xl bg-slate-900/90 p-5 border border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-sky-400" />
                  خيارات تصفية واختيار الصفوف والأصول:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRowPickerOpen(!isRowPickerOpen)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-sky-300 border border-sky-800/50 px-3 py-1.5 text-xs font-semibold transition"
                  >
                    <ListFilter className="h-3.5 w-3.5" />
                    <span>تحديد صفوف أصول معينة ({customFilteredAssets.length} مشمول)</span>
                    {isRowPickerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Filter controls grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Search */}
                <div>
                  <label className="block text-slate-400 mb-1">بحث في الأصول المتاحة:</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={customSearchTerm}
                      onChange={(e) => setCustomSearchTerm(e.target.value)}
                      placeholder="كود، اسم، عهدة، موقع..."
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 pr-8 pl-3 py-1.5 text-xs text-white"
                    />
                    {customSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setCustomSearchTerm('')}
                        className="absolute left-2.5 top-2 text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-slate-400 mb-1">حالة الأصل:</label>
                  <select
                    value={customStatusFilter}
                    onChange={(e) => setCustomStatusFilter(e.target.value as any)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="all">كافة الحالات (النشطة والمستبعدة)</option>
                    <option value="active">الأصول النشطة فقط</option>
                    <option value="disposed">الأصول المستبعدة / المباعة فقط</option>
                  </select>
                </div>

                {/* Rule Filter */}
                <div>
                  <label className="block text-slate-400 mb-1">سياسة بدء الإهلاك:</label>
                  <select
                    value={customRuleFilter}
                    onChange={(e) => setCustomRuleFilter(e.target.value as any)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="all">كافة السياسات</option>
                    <option value="mid_month_15">⚖️ الخاضعة لقاعدة 15 يوم فقط</option>
                    <option value="next_month">الشهر التالي</option>
                    <option value="immediate">نفس الشهر مباشرة</option>
                  </select>
                </div>

                {/* Sort By & Direction */}
                <div>
                  <label className="block text-slate-400 mb-1">ترتيب صفوف التقرير:</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={customSortBy}
                      onChange={(e) => setCustomSortBy(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-white"
                    >
                      <option value="code">كود الأصل</option>
                      <option value="name">اسم الأصل</option>
                      <option value="inServiceDate">تاريخ بدء التشغيل</option>
                      <option value="totalCost">التكلفة التاريخية</option>
                      <option value="periodExpense">إهلاك الفترة</option>
                      <option value="endingBookValue">صافي القيمة الدفترية</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setCustomSortDir(customSortDir === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700"
                      title={customSortDir === 'asc' ? 'تصاعدي (انقر للتحويل إلى تنازلي)' : 'تنازلي (انقر للتحويل إلى تصاعدي)'}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Individual Row Cherry-Picker Drawer */}
              {isRowPickerOpen && (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">
                      حدد أو استبعد أصولاً بعينها من الظهور في التقرير:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomExcludedAssetIds(new Set())}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold"
                      >
                        تحديد الكل ({assets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomExcludedAssetIds(new Set(assets.map((a) => a.id)))}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
                      >
                        استبعاد الكل
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800">
                    {assets.map((asset) => {
                      const isIncluded = !customExcludedAssetIds.has(asset.id);
                      return (
                        <div
                          key={asset.id}
                          onClick={() => {
                            setCustomExcludedAssetIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(asset.id)) {
                                next.delete(asset.id);
                              } else {
                                next.add(asset.id);
                              }
                              return next;
                            });
                          }}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                            isIncluded
                              ? 'bg-slate-900 text-slate-200 hover:bg-slate-850'
                              : 'bg-slate-950/40 text-slate-500 hover:bg-slate-900/60 line-through'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isIncluded ? (
                              <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-slate-600" />
                            )}
                            <span className="font-mono-numbers font-semibold text-sky-400">{asset.code}</span>
                            <span>{asset.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 font-mono-numbers text-[11px]">
                            <span>{asset.department || 'الإدارة العامة'}</span>
                            <span>{formatNumber(getTotalCost(asset))} {currency}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KPI Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-700">
            <span className="text-slate-400 text-[11px]">
              {reportType === 'custom' ? 'الأصول والأعمدة المشمولة:' : 'القيمة الدفترية أول الفترة:'}
            </span>
            <div className="text-base font-bold text-slate-200 font-mono-numbers mt-0.5">
              {reportType === 'custom'
                ? `${customReportData.length} أصل (${activeCustomColumns.length} عمود)`
                : `${formatNumber(periodTotals.beginningBookValue)} ${currency}`}
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-700">
            <span className="text-slate-400 text-[11px]">
              {reportType === 'custom' ? 'إجمالي التكلفة الرأسمالية:' : 'مجمع الإهلاك نهاية الفترة:'}
            </span>
            <div className="text-base font-bold text-white font-mono-numbers mt-0.5">
              {reportType === 'custom'
                ? `${formatNumber(customTotals['totalCost'] || 0)} ${currency}`
                : `${formatNumber(periodTotals.accumulatedAtEnd)} ${currency}`}
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 p-3 border border-amber-500/40">
            <span className="text-amber-400 text-[11px] font-semibold">مصروف إهلاك الفترة المحددة:</span>
            <div className="text-base font-extrabold text-amber-400 font-mono-numbers mt-0.5">
              {formatNumber(reportType === 'custom' ? (customTotals['periodExpense'] || 0) : periodTotals.periodExpense)} {currency}
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 p-3 border border-emerald-500/40">
            <span className="text-emerald-400 text-[11px] font-semibold">صافي القيمة الدفترية نهاية الفترة:</span>
            <div className="text-base font-extrabold text-emerald-400 font-mono-numbers mt-0.5">
              {formatNumber(reportType === 'custom' ? (customTotals['endingBookValue'] || 0) : periodTotals.endingBookValue)} {currency}
            </div>
          </div>
        </div>
      </div>

      {/* Official Printable Report Document */}
      <div dir="rtl" className="printable-document rounded-2xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Printable Official Header */}
        <div className="border-b border-slate-800 print:border-gray-400 pb-5 mb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-xl font-black text-white print:text-black">{companyName}</div>
            <div className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
              إدارة الحسابات العامة والميزانية - تقرير حركة وإهلاك الأصول الثابتة
            </div>
          </div>
          <div className="text-left sm:text-left text-xs text-slate-300 print:text-gray-700 font-mono-numbers">
            <div>الفترة المالية: <strong>من {fromDate} إلى {toDate}</strong></div>
            <div>العملة: <strong>{currency}</strong></div>
            <div className="text-[11px] text-slate-400 print:text-gray-500">تاريخ الاستخراج: {new Date().toISOString().split('T')[0]}</div>
          </div>
        </div>

        {/* Report Main Title */}
        <div className="mb-4 text-center">
          <h3 className="text-base font-extrabold text-sky-300 print:text-black">
            {reportType === 'period' && `تقرير حركة ومصروف إهلاك الأصول للفترة من ${fromDate} إلى ${toDate}`}
            {reportType === 'category' && `تقرير الإهلاك الشامل بحسب تصنيفات وفئات الأصول للفترة من ${fromDate} إلى ${toDate}`}
            {reportType === 'department' && `تقرير توزيع الأصول وتصنيفاتها على الأقسام والمواقع عن الفترة`}
            {reportType === 'disposals' && `سجل الأصول المستبعدة والمباعة والتصنيف والأرباح الرأسمالية`}
            {reportType === 'custom' && (customReportTitle || 'تقرير الأصول الثابتة المخصص والمفصل')}
          </h3>
          <div className="text-xs text-slate-400 print:text-gray-600 mt-1 flex flex-wrap items-center justify-center gap-3 font-mono-numbers">
            <span>
              عدد الأصول: {reportType === 'custom' ? customReportData.length : (reportType === 'disposals' ? disposalAssets.length : periodResults.length)} أصل
            </span>
            {reportType === 'custom' && (
              <>
                <span>|</span>
                <span className="text-emerald-400 print:text-black font-bold">الأعمدة المعروضة: {activeCustomColumns.length} عمود</span>
              </>
            )}
            <span>|</span>
            <span>العملة: {currency}</span>
            <span>|</span>
            <span>
              الإدارات: {selectedDepartments.length === 0 ? 'كافة الإدارات' : selectedDepartments.join('، ')}
            </span>
            <span>|</span>
            <span>
              التصنيف: {selectedCategory === 'all' ? 'كافة التصنيفات' : (catMap.get(selectedCategory) || selectedCategory)}
            </span>
          </div>
        </div>

        {/* On-Table Action Bar (Screen Only - No Print) */}
        <div className="no-print mb-4 p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-slate-100">
              {reportType === 'custom' ? 'التقرير المخصص جاهز للتصدير والطباعة' : 'بيانات التقرير جاهزة للتصدير والطباعة'}
            </span>
            <span className="text-slate-400 text-[11px] font-mono-numbers">
              ({reportType === 'custom' ? `${customReportData.length} أصل • ${activeCustomColumns.length} عمود` : `${reportType === 'disposals' ? disposalAssets.length : periodResults.length} أصل`})
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold transition shadow-sm cursor-pointer"
              title="تصدير هذا الجدول إلى إكسل منسق بالألوان و RTL"
            >
              {isExportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              <span>تصدير إكسل (XLSX)</span>
            </button>
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-sm cursor-pointer"
              title="طباعة هذا الجدول أو حفظه كـ PDF مقاس A4"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة / PDF (A4)</span>
            </button>
            <button
              onClick={handleDownloadPrintableHTML}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition cursor-pointer"
              title="تنزيل صفحة A4 مستقلة للطباعة المباشرة في أي متصفح أوفلاين"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              <span>تنزيل صفحة A4</span>
            </button>
          </div>
        </div>

        {/* REPORT 1: Period Depreciation Table (من - إلى) */}
        {reportType === 'period' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#0f2942] print:text-white print-color-header' : 'print:bg-gray-100 print:text-black'} text-slate-300 border-b border-slate-700 print:border-gray-400`}>
                  <th className="p-2.5">الكود</th>
                  <th className="p-2.5">اسم الأصل</th>
                  <th className="p-2.5 text-emerald-400 font-bold">الإدارة / القسم</th>
                  <th className="p-2.5 text-sky-400 font-bold">تصنيف الأصل</th>
                  <th className="p-2.5">تاريخ التشغيل</th>
                  <th className="p-2.5">طريقة وسياسة الإهلاك</th>
                  <th className="p-2.5">التكلفة التاريخية</th>
                  <th className="p-2.5">القيمة أول الفترة</th>
                  <th className="p-2.5 text-amber-400 font-bold">إهلاك الفترة ({fromDate} إلى {toDate})</th>
                  <th className="p-2.5">مجمع الإهلاك حتى نهاية الفترة</th>
                  <th className="p-2.5 text-emerald-400 font-bold">صافي القيمة نهاية الفترة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                {periodResults.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 print:text-gray-600">
                      لا توجد أصول مطابقة للفترة أو الإدارات أو التصنيف المحدد.
                    </td>
                  </tr>
                ) : (
                  periodResults.map((r) => (
                    <tr key={r.assetId} className={`hover:bg-slate-850 ${printColorMode === 'color' ? 'print:even:bg-[#f8fafc]' : 'print:hover:bg-transparent'}`}>
                      <td className="p-2.5 font-mono-numbers text-sky-400 print:text-black font-semibold whitespace-nowrap">
                        {r.assetCode}
                      </td>
                      <td className="p-2.5 font-medium text-slate-100 print:text-black">{r.assetName}</td>
                      {/* Department Column */}
                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded ${
                          printColorMode === 'color' 
                            ? 'bg-emerald-950/60 print:bg-[#ecfdf5] text-emerald-300 print:text-[#065f46] border border-emerald-800/60 print:border-[#a7f3d0]' 
                            : 'bg-emerald-950/60 print:bg-transparent text-emerald-300 print:text-black font-medium border border-emerald-800/60 print:border-none'
                        }`}>
                          {r.asset.department || 'الإدارة العامة'}
                        </span>
                      </td>
                      {/* Category Column */}
                      <td className="p-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded ${
                          printColorMode === 'color'
                            ? 'bg-slate-800 print:bg-[#f0f9ff] text-slate-200 print:text-[#0369a1] border border-slate-700 print:border-[#bae6fd]'
                            : 'bg-slate-800 print:bg-transparent text-slate-200 print:text-black font-semibold border border-slate-700 print:border-none'
                        }`}>
                          {r.categoryName}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono-numbers text-slate-300 print:text-gray-700 whitespace-nowrap">
                        {formatDate(r.inServiceDate)}
                      </td>
                      {/* Method & 15-Day Rule */}
                      <td className="p-2.5 text-slate-400 print:text-gray-700 whitespace-nowrap">
                        <div className="font-medium text-slate-300 print:text-black">{getMethodLabel(r.asset.depreciationMethod).short}</div>
                        <div className="mt-0.5">
                          {r.asset.startDepreciationRule === 'mid_month_15' ? (
                            <span 
                              className={`text-[10px] font-semibold ${printColorMode === 'color' ? 'text-amber-300 print:text-[#b45309]' : 'print:text-gray-800'}`}
                              title="قبل 15: إهلاك نفس الشهر، بعد 15: إهلاك الشهر التالي"
                            >
                              ⚖️ قاعدة 15 يوم
                            </span>
                          ) : r.asset.startDepreciationRule === 'next_month' ? (
                            <span className="text-[10px] text-purple-300 print:text-gray-800">
                              الشهر التالي
                            </span>
                          ) : (
                            <span className="text-[10px] text-blue-300 print:text-gray-800">
                              نفس الشهر
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 font-mono-numbers text-slate-100 print:text-black whitespace-nowrap">
                        {formatNumber(r.totalCost)}
                      </td>
                      <td className="p-2.5 font-mono-numbers text-slate-300 print:text-gray-800 whitespace-nowrap">
                        {formatNumber(r.beginningBookValue)}
                      </td>
                      <td className={`p-2.5 font-mono-numbers ${
                        printColorMode === 'color'
                          ? 'text-amber-400 print:bg-[#fef3c7] print:text-[#92400e] print-color-amber'
                          : 'text-amber-400 print:text-black'
                      } font-bold whitespace-nowrap`}>
                        {formatNumber(r.periodExpense)}
                      </td>
                      <td className="p-2.5 font-mono-numbers text-slate-300 print:text-gray-800 whitespace-nowrap">
                        {formatNumber(r.accumulatedAtEnd)}
                      </td>
                      <td className={`p-2.5 font-mono-numbers ${
                        printColorMode === 'color'
                          ? 'text-emerald-400 print:bg-[#d1fae5] print:text-[#065f46] print-color-emerald'
                          : 'text-emerald-400 print:text-black'
                      } font-bold whitespace-nowrap`}>
                        {formatNumber(r.endingBookValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#f1f5f9] print:text-[#0f172a] print-color-footer' : 'print:bg-gray-200 print:text-black'} font-bold border-t-2 border-slate-600 print:border-t-2 print:border-t-[#0f172a] print:border-b-4 print:border-b-double print:border-b-[#0f172a] text-slate-100`}>
                  <td colSpan={6} className="p-3 text-right">
                    إجمالي فترة التقرير ({fromDate} إلى {toDate}):
                  </td>
                  <td className="p-3 font-mono-numbers whitespace-nowrap">{formatNumber(periodTotals.totalCost)} {currency}</td>
                  <td className="p-3 font-mono-numbers whitespace-nowrap">{formatNumber(periodTotals.beginningBookValue)} {currency}</td>
                  <td className="p-3 font-mono-numbers whitespace-nowrap">{formatNumber(periodTotals.periodExpense)} {currency}</td>
                  <td className="p-3 font-mono-numbers whitespace-nowrap">{formatNumber(periodTotals.accumulatedAtEnd)} {currency}</td>
                  <td className="p-3 font-mono-numbers whitespace-nowrap">{formatNumber(periodTotals.endingBookValue)} {currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT 2: Category Summary Table */}
        {reportType === 'category' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#0f2942] print:text-white print-color-header' : 'print:bg-gray-100 print:text-black'} text-slate-300 border-b border-slate-700 print:border-gray-400`}>
                  <th className="p-3 font-bold text-sky-400 print:text-inherit">تصنيف وفئة الأصل</th>
                  <th className="p-3">عدد الأصول</th>
                  <th className="p-3">إجمالي التكلفة الرأسمالية</th>
                  <th className="p-3">القيمة الدفترية أول الفترة</th>
                  <th className="p-3 text-amber-400 print:text-inherit font-bold">إهلاك الفترة المحددة</th>
                  <th className="p-3">مجمع الإهلاك نهاية الفترة</th>
                  <th className="p-3 text-emerald-400 print:text-inherit font-bold">صافي القيمة الدفترية نهاية الفترة</th>
                  <th className="p-3">نسبة الاستهلاك</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                {categoryPeriodSummary.map((c) => {
                  const ratio = c.cost > 0 ? (c.accumulated / c.cost) * 100 : 0;
                  return (
                    <tr key={c.categoryId} className={`hover:bg-slate-850 ${printColorMode === 'color' ? 'print:even:bg-[#f8fafc]' : ''}`}>
                      <td className="p-3 font-bold text-slate-100 print:text-black flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-sky-400 print:text-[#0284c7]" />
                        {c.categoryName}
                      </td>
                      <td className="p-3 font-mono-numbers text-sky-400 print:text-[#0369a1] font-bold">{c.count}</td>
                      <td className="p-3 font-mono-numbers font-semibold text-white print:text-black">{formatNumber(c.cost)} {currency}</td>
                      <td className="p-3 font-mono-numbers text-slate-300 print:text-gray-700">{formatNumber(c.beginning)} {currency}</td>
                      <td className={`p-3 font-mono-numbers font-bold text-amber-400 ${printColorMode === 'color' ? 'print:text-[#b45309] print:bg-[#fffbeb] print-color-amber' : 'print:text-black'}`}>
                        {formatNumber(c.periodExpense)} {currency}
                      </td>
                      <td className="p-3 font-mono-numbers text-slate-300 print:text-gray-700">{formatNumber(c.accumulated)} {currency}</td>
                      <td className={`p-3 font-mono-numbers font-bold text-emerald-400 ${printColorMode === 'color' ? 'print:text-[#047857] print:bg-[#ecfdf5] print-color-emerald' : 'print:text-black'}`}>
                        {formatNumber(c.ending)} {currency}
                      </td>
                      <td className="p-3 font-mono-numbers text-slate-300 print:text-gray-700">{formatPercent(ratio)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#f1f5f9] print:text-[#0f172a] print-color-footer' : 'print:bg-gray-200 print:text-black'} font-bold border-t-2 border-slate-600 print:border-t-2 print:border-t-[#0f172a] print:border-b-4 print:border-b-double print:border-b-[#0f172a] text-slate-100`}>
                  <td className="p-3">المجموع الكلي لجميع التصنيفات:</td>
                  <td className="p-3 font-mono-numbers">{categoryPeriodSummary.reduce((s, c) => s + c.count, 0)}</td>
                  <td className="p-3 font-mono-numbers">{formatNumber(categoryPeriodSummary.reduce((s, c) => s + c.cost, 0))} {currency}</td>
                  <td className="p-3 font-mono-numbers">{formatNumber(categoryPeriodSummary.reduce((s, c) => s + c.beginning, 0))} {currency}</td>
                  <td className={`p-3 font-mono-numbers text-amber-400 ${printColorMode === 'color' ? 'print:text-[#b45309]' : 'print:text-black'}`}>{formatNumber(categoryPeriodSummary.reduce((s, c) => s + c.periodExpense, 0))} {currency}</td>
                  <td className="p-3 font-mono-numbers">{formatNumber(categoryPeriodSummary.reduce((s, c) => s + c.accumulated, 0))} {currency}</td>
                  <td className={`p-3 font-mono-numbers text-emerald-400 ${printColorMode === 'color' ? 'print:text-[#047857]' : 'print:text-black'}`}>{formatNumber(categoryPeriodSummary.reduce((s, c) => s + c.ending, 0))} {currency}</td>
                  <td className="p-3">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT 3: Department Table with Categories Included */}
        {reportType === 'department' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#0f2942] print:text-white print-color-header' : 'print:bg-gray-100 print:text-black'} text-slate-300 border-b border-slate-700 print:border-gray-400`}>
                  <th className="p-3">القسم / الإدارة</th>
                  <th className="p-3 font-bold text-sky-400 print:text-inherit">تصنيفات الأصول الموجودة</th>
                  <th className="p-3">عدد الأصول المخصصة</th>
                  <th className="p-3">إجمالي التكلفة الرأسمالية</th>
                  <th className="p-3 text-amber-400 print:text-inherit font-bold">إهلاك الفترة ({fromDate} إلى {toDate})</th>
                  <th className="p-3 text-emerald-400 print:text-inherit font-bold">صافي القيمة الدفترية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                {departmentSummary.map((d, i) => (
                  <tr key={i} className={`hover:bg-slate-850 ${printColorMode === 'color' ? 'print:even:bg-[#f8fafc]' : ''}`}>
                    <td className="p-3 font-bold text-slate-100 print:text-black">{d.department}</td>
                    <td className="p-3 text-slate-300 print:text-gray-700 font-medium">
                      <span className={`inline-block px-2 py-0.5 rounded ${
                        printColorMode === 'color'
                          ? 'bg-slate-800 print:bg-[#f0f9ff] text-slate-200 print:text-[#0369a1] border border-slate-700 print:border-[#bae6fd]'
                          : 'bg-slate-800 print:bg-transparent text-slate-200 print:text-black font-medium border border-slate-700 print:border-none'
                      }`}>
                        {d.categoriesList}
                      </span>
                    </td>
                    <td className="p-3 font-mono-numbers text-sky-400 print:text-[#0369a1] font-bold">{d.count}</td>
                    <td className="p-3 font-mono-numbers font-semibold text-white print:text-black">{formatNumber(d.cost)} {currency}</td>
                    <td className={`p-3 font-mono-numbers text-amber-400 font-bold ${printColorMode === 'color' ? 'print:text-[#b45309] print:bg-[#fffbeb] print-color-amber' : 'print:text-black'}`}>
                      {formatNumber(d.periodExpense)} {currency}
                    </td>
                    <td className={`p-3 font-mono-numbers font-bold text-emerald-400 ${printColorMode === 'color' ? 'print:text-[#047857] print:bg-[#ecfdf5] print-color-emerald' : 'print:text-black'}`}>
                      {formatNumber(d.nbv)} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#f1f5f9] print:text-[#0f172a] print-color-footer' : 'print:bg-gray-200 print:text-black'} font-bold border-t-2 border-slate-600 print:border-t-2 print:border-t-[#0f172a] print:border-b-4 print:border-b-double print:border-b-[#0f172a] text-slate-100`}>
                  <td colSpan={2} className="p-3">الإجمالي العام لكافة الأقسام والإدارات:</td>
                  <td className="p-3 font-mono-numbers">{departmentSummary.reduce((s, d) => s + d.count, 0)}</td>
                  <td className="p-3 font-mono-numbers">{formatNumber(departmentSummary.reduce((s, d) => s + d.cost, 0))} {currency}</td>
                  <td className={`p-3 font-mono-numbers text-amber-400 ${printColorMode === 'color' ? 'print:text-[#b45309]' : 'print:text-black'}`}>{formatNumber(departmentSummary.reduce((s, d) => s + d.periodExpense, 0))} {currency}</td>
                  <td className={`p-3 font-mono-numbers text-emerald-400 ${printColorMode === 'color' ? 'print:text-[#047857]' : 'print:text-black'}`}>{formatNumber(departmentSummary.reduce((s, d) => s + d.nbv, 0))} {currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* REPORT 4: Disposals Table with Categories Included */}
        {reportType === 'disposals' && (
          <div className="overflow-x-auto">
            {disposalAssets.length === 0 ? (
              <div className="py-8 text-center text-slate-400 print:text-gray-600">
                لا توجد عمليات استبعاد أو بيع أصول مسجلة حتى الآن.
              </div>
            ) : (
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#0f2942] print:text-white print-color-header' : 'print:bg-gray-100 print:text-black'} text-slate-300 border-b border-slate-700 print:border-gray-400`}>
                    <th className="p-3">كود الأصل</th>
                    <th className="p-3">اسم الأصل</th>
                    <th className="p-3 font-bold text-sky-400 print:text-inherit">تصنيف الأصل</th>
                    <th className="p-3">تاريخ الاستبعاد</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">سعر البيع</th>
                    <th className="p-3">القيمة الدفترية عند البيع</th>
                    <th className="p-3">أرباح / خسائر رأسمالية</th>
                    <th className="p-3">المشتري / الملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                  {disposalAssets.map((asset) => {
                    const d = asset.disposal!;
                    const isGain = d.gainLoss >= 0;
                    return (
                      <tr key={asset.id} className={`hover:bg-slate-850 ${printColorMode === 'color' ? 'print:even:bg-[#f8fafc]' : ''}`}>
                        <td className="p-3 font-mono-numbers text-sky-400 print:text-black font-semibold">{asset.code}</td>
                        <td className="p-3 font-medium text-slate-100 print:text-black">{asset.name}</td>
                        <td className="p-3 text-slate-200 print:text-black font-medium">
                          <span className={`inline-block px-2 py-0.5 rounded ${
                            printColorMode === 'color'
                              ? 'bg-slate-800 print:bg-[#f0f9ff] text-slate-200 print:text-[#0369a1] border border-slate-700 print:border-[#bae6fd]'
                              : 'bg-slate-800 print:bg-transparent text-slate-200 print:text-black font-semibold border border-slate-700 print:border-none'
                          }`}>
                            {catMap.get(asset.category) || asset.category}
                          </span>
                        </td>
                        <td className="p-3 font-mono-numbers text-slate-300 print:text-gray-700">{d.disposalDate}</td>
                        <td className="p-3 text-slate-300 print:text-gray-700">{d.disposalType === 'sale' ? 'بيع' : d.disposalType}</td>
                        <td className="p-3 font-mono-numbers font-semibold text-white print:text-black">{formatNumber(d.salePrice)} {currency}</td>
                        <td className="p-3 font-mono-numbers text-slate-300 print:text-gray-700">{formatNumber(d.bookValueAtDisposal)} {currency}</td>
                        <td className={`p-3 font-mono-numbers font-bold ${
                          isGain 
                            ? (printColorMode === 'color' ? 'text-emerald-400 print:text-[#047857] print:bg-[#ecfdf5]' : 'text-emerald-400 print:text-black')
                            : (printColorMode === 'color' ? 'text-rose-400 print:text-[#b91c1c] print:bg-[#fef2f2]' : 'text-rose-400 print:text-black')
                        }`}>
                          {d.gainLoss > 0 ? '+' : ''}{formatNumber(d.gainLoss)} {currency}
                        </td>
                        <td className="p-3 text-slate-300 print:text-gray-700">{d.buyerName || d.reason || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* REPORT 5: Custom User-Defined Report Table (الأعمدة والصفوف المخصصة) */}
        {reportType === 'custom' && (
          <div className="overflow-x-auto">
            {customReportData.length === 0 ? (
              <div className="py-12 text-center text-slate-400 print:text-gray-600">
                لا توجد أصول مطابقة للتصفيات المحددة أو تم استبعاد كافة الأصول يدوياً.
              </div>
            ) : (
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#0f2942] print:text-white print-color-header' : 'print:bg-gray-100 print:text-black'} text-slate-300 border-b border-slate-700 print:border-gray-400`}>
                    <th className="p-2 text-center w-8">#</th>
                    {activeCustomColumns.map((col) => (
                      <th
                        key={col.id}
                        className={`p-2.5 font-bold ${
                          col.highlight === 'amber'
                            ? 'text-amber-400 print:text-inherit'
                            : col.highlight === 'emerald'
                            ? 'text-emerald-400 print:text-inherit'
                            : col.id === 'code' || col.id === 'name'
                            ? 'text-sky-300 print:text-inherit'
                            : 'text-slate-300 print:text-inherit'
                        } ${col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                  {customReportData.map((item, rowIdx) => (
                    <tr
                      key={item.asset.id}
                      className={`hover:bg-slate-850 ${printColorMode === 'color' ? 'print:even:bg-[#f8fafc]' : ''}`}
                    >
                      <td className="p-2 text-center text-slate-400 print:text-gray-600 font-mono-numbers text-[10px]">
                        {rowIdx + 1}
                      </td>
                      {activeCustomColumns.map((col) => {
                        const cellDisplay = item.displayRow[col.id];
                        const isAmber = col.highlight === 'amber' || col.id === 'periodExpense';
                        const isEmerald = col.highlight === 'emerald' || col.id === 'endingBookValue';

                        return (
                          <td
                            key={col.id}
                            className={`p-2.5 whitespace-nowrap ${
                              col.align === 'center'
                                ? 'text-center'
                                : col.align === 'left'
                                ? 'text-left'
                                : 'text-right'
                            } ${
                              col.isFinancial || col.isNumeric
                                ? 'font-mono-numbers'
                                : ''
                            } ${
                              isAmber
                                ? `text-amber-400 font-bold ${printColorMode === 'color' ? 'print:text-[#b45309] print:bg-[#fffbeb] print-color-amber' : 'print:text-black'}`
                                : isEmerald
                                ? `text-emerald-400 font-bold ${printColorMode === 'color' ? 'print:text-[#047857] print:bg-[#ecfdf5] print-color-emerald' : 'print:text-black'}`
                                : col.id === 'code'
                                ? 'text-sky-400 print:text-black font-semibold'
                                : col.id === 'name'
                                ? 'text-slate-100 print:text-black font-medium'
                                : 'text-slate-300 print:text-gray-800'
                            }`}
                          >
                            {col.id === 'department' ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                                printColorMode === 'color'
                                  ? 'bg-emerald-950/60 print:bg-[#ecfdf5] text-emerald-300 print:text-[#065f46] border border-emerald-800/60 print:border-[#a7f3d0]'
                                  : 'bg-emerald-950/60 print:bg-transparent text-emerald-300 print:text-black border border-emerald-800/60 print:border-none'
                              }`}>
                                {cellDisplay}
                              </span>
                            ) : col.id === 'category' ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                                printColorMode === 'color'
                                  ? 'bg-slate-800 print:bg-[#f0f9ff] text-slate-200 print:text-[#0369a1] border border-slate-700 print:border-[#bae6fd]'
                                  : 'bg-slate-800 print:bg-transparent text-slate-200 print:text-black border border-slate-700 print:border-none'
                              }`}>
                                {cellDisplay}
                              </span>
                            ) : (
                              `${cellDisplay}${col.isFinancial && cellDisplay !== '-' ? ` ${currency}` : ''}`
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`bg-slate-800/90 ${printColorMode === 'color' ? 'print:bg-[#f1f5f9] print:text-[#0f172a] print-color-footer' : 'print:bg-gray-200 print:text-black'} font-bold border-t-2 border-slate-600 print:border-t-2 print:border-t-[#0f172a] print:border-b-4 print:border-b-double print:border-b-[#0f172a] text-slate-100`}>
                    <td className="p-2.5 text-center">∑</td>
                    {activeCustomColumns.map((col, idx) => {
                      if (idx === 0) {
                        return (
                          <td key={col.id} className="p-2.5 text-right font-bold">
                            الإجمالي العام ({customReportData.length} أصل):
                          </td>
                        );
                      }
                      if (col.isFinancial) {
                        const sumVal = customTotals[col.id] || 0;
                        const isAmber = col.highlight === 'amber' || col.id === 'periodExpense';
                        const isEmerald = col.highlight === 'emerald' || col.id === 'endingBookValue';
                        return (
                          <td
                            key={col.id}
                            className={`p-2.5 font-mono-numbers whitespace-nowrap text-left ${
                              isAmber
                                ? `text-amber-400 ${printColorMode === 'color' ? 'print:text-[#b45309]' : 'print:text-black'}`
                                : isEmerald
                                ? `text-emerald-400 ${printColorMode === 'color' ? 'print:text-[#047857]' : 'print:text-black'}`
                                : 'text-slate-100 print:text-black'
                            }`}
                          >
                            {formatNumber(sumVal)} {currency}
                          </td>
                        );
                      }
                      if (col.isNumeric && customTotals[col.id] !== undefined) {
                        return (
                          <td key={col.id} className="p-2.5 font-mono-numbers whitespace-nowrap text-center text-slate-200 print:text-black">
                            {formatNumber(customTotals[col.id])}
                          </td>
                        );
                      }
                      return (
                        <td key={col.id} className="p-2.5 text-center text-slate-500 print:text-gray-400">
                          -
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}

        {/* Quick Table Footer Action Bar (Screen Only - No Print) */}
        <div className="no-print mt-6 p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
          <div className="text-slate-300 font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>نهاية جدول بيانات التقرير — يمكنك حفظ وتصدير الملف بصيغة إكسل أو PDF:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2 font-bold transition shadow-sm cursor-pointer"
            >
              {isExportingExcel ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span>تصدير إكسل (Excel)</span>
            </button>
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 font-bold transition shadow-sm cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة / حفظ PDF مقاس A4</span>
            </button>
            <button
              onClick={handleDownloadPrintableHTML}
              className="flex items-center gap-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 px-3 py-2 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              <span>تنزيل صفحة A4</span>
            </button>
          </div>
        </div>

        {/* Formal Signature Block in PDF Print */}
        <div className="hidden print:flex justify-between items-center pt-12 mt-12 border-t border-gray-400 text-xs text-black">
          <div>
            <div>المحاسب المسؤول: _______________________</div>
            <div className="mt-1">التوقيع: _______________________</div>
          </div>
          <div>
            <div>المدير المالي: _______________________</div>
            <div className="mt-1">التوقيع: _______________________</div>
          </div>
          <div>
            <div>ختم المنشأة المعتمد: _______________________</div>
            <div className="mt-1">التاريخ: _______________________</div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Quick Export Ribbon (Always accessible on screen when scrolling) */}
      <div className="no-print fixed bottom-3 left-4 right-4 sm:left-auto sm:right-6 z-40 bg-slate-900/95 backdrop-blur-md border border-sky-500/40 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 pl-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-bold text-white text-xs truncate max-w-[160px] sm:max-w-xs">
            {reportType === 'custom' ? (customReportTitle || 'التقرير المخصص') : 'التقرير المالي'}
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline font-mono-numbers">
            ({reportType === 'custom' ? `${customReportData.length} أصل • ${activeCustomColumns.length} عمود` : `${reportType === 'disposals' ? disposalAssets.length : periodResults.length} أصل`})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-emerald-950/50 transition cursor-pointer"
            title="تصدير سريع إلى إكسل"
          >
            {isExportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            <span>إكسل</span>
          </button>
          <button
            onClick={() => setIsPrintPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-sky-500/30 transition cursor-pointer"
            title="معاينة التقرير الرسمي المالي مقاس A4 وتصدير PDF"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>معاينة A4</span>
          </button>
          <button
            onClick={handlePrintPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-950/50 transition cursor-pointer"
            title="طباعة أو حفظ كـ PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>طباعة PDF</span>
          </button>
        </div>
      </div>

      {/* Interactive A4 Report & PDF Live Preview Modal */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header & Controls Toolbar */}
            <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    معاينة التقرير الرسمي المالي مقاس A4 وتصدير PDF
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      نصوص متجهة 100%
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تقرير منسق وفق المعايير المحاسبية مع ترويسة معتمدة، كروت المؤشرات، وجدول بيانات متكرر الترويسة
                  </p>
                </div>
              </div>

              {/* Formatting & Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Orientation Toggle */}
                <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('landscape')}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      printOrientation === 'landscape' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    A4 عرضي
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      printOrientation === 'portrait' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    A4 طولي
                  </button>
                </div>

                {/* Color Mode Toggle */}
                <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintColorMode('color')}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      printColorMode === 'color' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ألوان كاملة
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintColorMode('bw')}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      printColorMode === 'bw' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    أبيض وأسود
                  </button>
                </div>

                {/* Direct Print Button */}
                <button
                  type="button"
                  onClick={() => {
                    printReportDirectly(getPrintableReportConfig());
                    showFeedback('success', 'تم إرسال أمر الطباعة / الحفظ كـ PDF.');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-sky-950/40 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة فورية / PDF</span>
                </button>

                {/* Download Standalone HTML */}
                <button
                  type="button"
                  onClick={() => {
                    downloadPrintableHTMLReport(getPrintableReportConfig());
                    showFeedback('success', 'تم تنزيل صفحة A4 المستقلة.');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                  title="تنزيل ملف تقرير مستقل للطباعة في أي وقت بدون إنترنت"
                >
                  <Download className="h-3.5 w-3.5 text-sky-400" />
                  <span>تنزيل A4</span>
                </button>

                {/* Open In New Window */}
                <button
                  type="button"
                  onClick={() => openReportInNewWindow(getPrintableReportConfig())}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                  title="فتح التقرير في نافذة مستقلة كاملة"
                >
                  <Eye className="h-4 w-4" />
                </button>

                {/* Close Modal */}
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
                  title="إغلاق المعاينة"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Realistic A4 Document Preview */}
            <div className="flex-1 bg-slate-950/60 p-4 sm:p-6 overflow-auto flex justify-center">
              <div className="w-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300 flex flex-col h-full min-h-[500px]">
                <iframe
                  title="A4 Report Preview"
                  srcDoc={generatePrintableHTMLString(getPrintableReportConfig())}
                  className="w-full h-full border-0 flex-1 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
