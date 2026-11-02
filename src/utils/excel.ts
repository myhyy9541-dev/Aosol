import * as XLSX from 'xlsx-js-style';
import { Asset, AssetCategory, DepreciationScheduleRow } from '../types/asset';
import { calculatePeriodDepreciation, calculateSchedule, getCurrentAssetValuation, getTotalCost } from './depreciation';
import { formatNumber, getMethodLabel, getStartRuleLabel } from './formatters';

// Common Palette for Excel Exports (Accounting & Financial Elegance)
const COLORS = {
  NAVY_DARK: '0F2942',     // Primary dark navy for main report title
  ROYAL_BLUE: '1E3A8A',    // Royal blue for table headers
  SLATE_HEADER: '1E293B',  // Slate header alternative
  SUB_BANNER: '3B82F6',    // Soft blue for metadata banners
  ZEBRA_BG: 'F8FAFC',      // Soft ice slate for alternating data rows
  WHITE: 'FFFFFF',
  BORDER_LIGHT: 'E2E8F0',  // Light border between cells
  BORDER_DARK: '0F172A',   // Dark border for totals
  BORDER_HEADER: '94A3B8',
  AMBER_BG: 'FEF3C7',      // Warm amber highlight for period depreciation expense
  AMBER_TEXT: '92400E',
  EMERALD_BG: 'D1FAE5',    // Soft emerald highlight for Net Book Value (الصافي)
  EMERALD_TEXT: '065F46',
  ROSE_BG: 'FFE4E6',       // Soft rose for capital loss
  ROSE_TEXT: '9F1239',
  TOTALS_BG: 'E2E8F0',     // Light slate background for bottom totals
};

/**
 * Helper to generate cell border object
 */
function getBorder(color: string = COLORS.BORDER_LIGHT, topStyle: string = 'thin', bottomStyle: string = 'thin') {
  return {
    top: { style: topStyle, color: { rgb: color } },
    bottom: { style: bottomStyle, color: { rgb: color } },
    left: { style: 'thin', color: { rgb: color } },
    right: { style: 'thin', color: { rgb: color } },
  };
}

/**
 * Format cell with background color, font, alignment, and border
 */
function formatCell(
  ws: XLSX.WorkSheet,
  cellRef: string,
  val: any,
  style: any,
  format?: string
) {
  const cell: XLSX.CellObject = {
    v: val,
    t: typeof val === 'number' ? 'n' : 's',
    s: style,
  };
  if (format) {
    cell.z = format;
  }
  ws[cellRef] = cell;
}

/**
 * Calculates optimal column widths based on headers and row values,
 * ensuring Arabic text and financial numbers are never clipped or hidden as '###'.
 */
function calculateAutoFitCols(
  headers: string[],
  rows: any[][],
  minWidths?: Record<number, number>
): XLSX.ColInfo[] {
  return headers.map((header, cIdx) => {
    let maxLen = header ? header.length * 1.35 : 12;
    rows.forEach((row) => {
      const val = row[cIdx];
      if (val !== undefined && val !== null) {
        const str = typeof val === 'number' ? formatNumber(val) : String(val);
        const len = str.length * 1.25;
        if (len > maxLen) maxLen = len;
      }
    });
    const forcedMin = minWidths && minWidths[cIdx] ? minWidths[cIdx] : 14;
    const finalW = Math.max(Math.ceil(maxLen) + 3, forcedMin);
    return { wch: Math.min(finalW, 55) };
  });
}

/**
 * Strict enforcement of Right-to-Left (RTL) mode in OpenXML for Excel workbooks
 */
export function enforceWorkbookRTL(wb: XLSX.WorkBook): void {
  wb.Workbook = {
    Views: [{ RTL: true }],
  };
}

/**
 * Infallible workbook saver with dual-path download (Blob URL + XLSX.writeFile fallback)
 * Guarantees cross-browser and iframe compatibility with sanitized filenames and OpenXML RTL.
 */
export function saveWorkbookSafely(wb: XLSX.WorkBook, filename: string): void {
  enforceWorkbookRTL(wb);

  // Clean filename: remove illegal filesystem and URL characters
  const cleanFilename = (filename || 'Fixed_Assets_Report.xlsx')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const finalFilename = cleanFilename.endsWith('.xlsx') ? cleanFilename : `${cleanFilename}.xlsx`;

  try {
    // Generate binary buffer using xlsx-js-style
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Standard DOM anchor download (reliable in iframes and all browsers)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (blobErr) {
    console.warn('Blob download failed, falling back to XLSX.writeFile:', blobErr);
    XLSX.writeFile(wb, finalFilename);
  }
}

/**
 * Export all assets register to formatted colored Excel file (.xlsx) with RTL
 */
export function exportAssetsToExcel(
  assets: Asset[],
  categories: AssetCategory[],
  currency: string = 'ريال يمني (YER)',
  companyName: string = 'المؤسسة التجارية',
  filename: string = 'سجل_الأصول_الثابتة_الشامل.xlsx'
): void {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const headers = [
    'كود الأصل',
    'اسم الأصل',
    'تصنيف وفئة الأصل',
    'الإدارة / القسم',
    'سياسة بدء الإهلاك (قاعدة 15 يوم)',
    'تاريخ الشراء',
    'تاريخ التشغيل',
    'التكلفة التاريخية',
    'تكاليف إضافية',
    'إجمالي التكلفة الرأسمالية',
    'قيمة الخردة / النفاية',
    'العمر الإنتاجي (سنوات)',
    'طريقة الإهلاك',
    'مجمع الإهلاك الحالي',
    'صافي القيمة الدفترية',
    'نسبة الإهلاك %',
    'حالة الأصل',
    'الموقع / الفرع',
    'المسؤول / العهدة',
    'الرقم التسلسلي',
    'المورد',
    'ملاحظات',
  ];

  const totalCols = headers.length;
  let currentRow = 0;

  // Title Banner (Row 0)
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? `${companyName} - سجل الأصول الثابتة والإهلاك الشامل` : '', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // Metadata Sub-banner (Row 1)
  const metaText = `العملة المعتمدة: ${currency} | إجمالي الأصول: ${assets.length} أصل | تاريخ الاستخراج: ${new Date().toISOString().split('T')[0]}`;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? metaText : '', {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // Blank separator row (Row 2)
  currentRow++;

  // Table Headers (Row 3)
  const headerRowIdx = currentRow;
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    formatCell(ws, ref, h, {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: getBorder(COLORS.BORDER_HEADER, 'medium', 'medium'),
    });
  });
  currentRow++;

  // Data Rows
  let sumCost = 0;
  let sumExtra = 0;
  let sumTotalCost = 0;
  let sumSalvage = 0;
  let sumAccum = 0;
  let sumNBV = 0;

  assets.forEach((asset, idx) => {
    const valuation = getCurrentAssetValuation(asset);
    const totalCost = getTotalCost(asset);
    const methodInfo = getMethodLabel(asset.depreciationMethod);
    const ruleInfo = getStartRuleLabel(asset.startDepreciationRule);
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;

    sumCost += Number(asset.purchaseCost) || 0;
    sumExtra += Number(asset.additionalCosts) || 0;
    sumTotalCost += totalCost;
    sumSalvage += Number(asset.salvageValue) || 0;
    sumAccum += valuation.accumulatedDepreciation;
    sumNBV += valuation.netBookValue;

    const rowValues: { val: any; align?: string; format?: string; customBg?: string; customColor?: string }[] = [
      { val: asset.code, align: 'center' },
      { val: asset.name, align: 'right' },
      { val: catMap.get(asset.category) || asset.category, align: 'right' },
      { val: asset.department || 'الإدارة العامة', align: 'right' },
      { val: ruleInfo.label, align: 'center' },
      { val: asset.purchaseDate, align: 'center' },
      { val: asset.inServiceDate || asset.purchaseDate, align: 'center' },
      { val: Number(asset.purchaseCost) || 0, align: 'left', format: '#,##0.00' },
      { val: Number(asset.additionalCosts) || 0, align: 'left', format: '#,##0.00' },
      { val: totalCost, align: 'left', format: '#,##0.00' },
      { val: Number(asset.salvageValue) || 0, align: 'left', format: '#,##0.00' },
      { val: Number(asset.usefulLifeYears) || 0, align: 'center' },
      { val: methodInfo.short, align: 'center' },
      { val: Math.round(valuation.accumulatedDepreciation * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.AMBER_BG, customColor: COLORS.AMBER_TEXT },
      { val: Math.round(valuation.netBookValue * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.EMERALD_BG, customColor: COLORS.EMERALD_TEXT },
      { val: `${Math.round(valuation.depreciatedPercent * 10) / 10}%`, align: 'center' },
      { val: asset.status === 'active' ? 'نشط' : asset.status === 'disposed' ? 'مستبعد' : asset.status, align: 'center' },
      { val: asset.location || '-', align: 'right' },
      { val: asset.custodian || '-', align: 'right' },
      { val: asset.serialNumber || '-', align: 'center' },
      { val: asset.supplier || '-', align: 'right' },
      { val: asset.notes || '', align: 'right' },
    ];

    rowValues.forEach((cellData, c) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });
      formatCell(ws, ref, cellData.val, {
        font: {
          name: 'Arial',
          sz: 9.5,
          bold: Boolean(cellData.customBg),
          color: { rgb: cellData.customColor || '0F172A' },
        },
        fill: { fgColor: { rgb: cellData.customBg || rowBg } },
        alignment: { horizontal: cellData.align || 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      }, cellData.format);
    });

    currentRow++;
  });

  // Summary Totals Row (Footer)
  const totalsValues: { c: number; val: any; format?: string }[] = [
    { c: 0, val: 'الإجمالي الكلي:' },
    { c: 7, val: sumCost, format: '#,##0.00' },
    { c: 8, val: sumExtra, format: '#,##0.00' },
    { c: 9, val: sumTotalCost, format: '#,##0.00' },
    { c: 10, val: sumSalvage, format: '#,##0.00' },
    { c: 13, val: Math.round(sumAccum * 100) / 100, format: '#,##0.00' },
    { c: 14, val: Math.round(sumNBV * 100) / 100, format: '#,##0.00' },
  ];

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    const match = totalsValues.find((t) => t.c === c);
    formatCell(ws, ref, match ? match.val : '', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
      alignment: { horizontal: c === 0 ? 'right' : 'left', vertical: 'center' },
      border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
    }, match?.format);
  }

  // WorkSheet Range and Options
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: currentRow, c: totalCols - 1 },
  });

  // Enable Right-to-Left (RTL) View & Freeze Panes on Table Header (Rows 0-3 stay pinned on scroll)
  ws['!views'] = [
    {
      RTL: true,
      xSplit: 0,
      ySplit: 4,
      topLeftCell: 'A5',
      activePane: 'bottomLeft',
      state: 'frozen',
    },
  ];

  // Merges for headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
    { s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 6 } }, // merge total label
  ];

  // Dynamic Auto-fit Column Widths based on real content
  const assetsRowsForWidth = assets.map((a) => {
    const val = getCurrentAssetValuation(a);
    return [
      a.code,
      a.name,
      catMap.get(a.category) || a.category,
      a.department || 'الإدارة العامة',
      getStartRuleLabel(a.startDepreciationRule).label,
      a.purchaseDate,
      a.inServiceDate || a.purchaseDate,
      a.purchaseCost,
      a.additionalCosts,
      getTotalCost(a),
      a.salvageValue,
      a.usefulLifeYears,
      getMethodLabel(a.depreciationMethod).short,
      val.accumulatedDepreciation,
      val.netBookValue,
      `${val.depreciatedPercent}%`,
      a.status,
      a.location,
      a.custodian,
      a.serialNumber,
      a.supplier,
      a.notes,
    ];
  });
  ws['!cols'] = calculateAutoFitCols(headers, assetsRowsForWidth, {
    0: 13,
    1: 30,
    2: 24,
    3: 20,
    4: 24,
    7: 18,
    8: 16,
    9: 20,
    10: 16,
    13: 20,
    14: 20,
  });

  // Row heights
  ws['!rows'] = [
    { hpt: 30 }, // Title
    { hpt: 20 }, // Meta
    { hpt: 8 },  // Blank
    { hpt: 28 }, // Table Header
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'سجل الأصول الثابتة');
  saveWorkbookSafely(wb, filename);
}

/**
 * Export Period Report (من - إلى) with full colors, RTL, and department details
 */
export function exportPeriodReportToExcel(
  periodResults: any[],
  periodTotals: any,
  fromDate: string,
  toDate: string,
  currency: string,
  companyName: string,
  selectedDepartments: string[],
  selectedCategory: string,
  catMap: Map<string, string>,
  filename?: string
): void {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const headers = [
    'كود الأصل',
    'اسم الأصل',
    'الإدارة / القسم',
    'تصنيف وفئة الأصل',
    'تاريخ التشغيل',
    'طريقة وسياسة الإهلاك',
    'التكلفة التاريخية',
    'القيمة أول الفترة',
    `مصروف إهلاك الفترة (${fromDate} إلى ${toDate})`,
    'مجمع الإهلاك نهاية الفترة',
    'صافي القيمة الدفترية نهاية الفترة',
    'الموقع / الفرع',
    'المسؤول / العهدة',
  ];

  const totalCols = headers.length;
  let currentRow = 0;

  // Title Banner (Row 0)
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? `${companyName} - تقرير حركة ومصروف إهلاك الأصول للفترة من ${fromDate} إلى ${toDate}` : '', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // Metadata Sub-banner (Row 1)
  const deptLabel = selectedDepartments.length === 0 ? 'كافة الإدارات' : selectedDepartments.join('، ');
  const catLabel = selectedCategory === 'all' ? 'كافة التصنيفات' : (catMap.get(selectedCategory) || selectedCategory);
  const metaText = `الفترة المالية: من ${fromDate} إلى ${toDate} | العملة: ${currency} | الإدارات: ${deptLabel} | التصنيف: ${catLabel} | عدد الأصول: ${periodResults.length}`;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? metaText : '', {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // Blank separator (Row 2)
  currentRow++;

  // Table Headers (Row 3)
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, h, {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: getBorder(COLORS.BORDER_HEADER, 'medium', 'medium'),
    });
  });
  currentRow++;

  // Data Rows
  periodResults.forEach((r, idx) => {
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;
    const ruleLabel = r.asset.startDepreciationRule === 'mid_month_15' ? 'قاعدة 15 يوم' : r.asset.startDepreciationRule;
    const methodShort = `${getMethodLabel(r.asset.depreciationMethod).short} (${ruleLabel})`;

    const cells: { val: any; align?: string; format?: string; customBg?: string; customColor?: string }[] = [
      { val: r.assetCode, align: 'center' },
      { val: r.assetName, align: 'right' },
      { val: r.asset.department || 'الإدارة العامة', align: 'right' },
      { val: r.categoryName, align: 'right' },
      { val: r.inServiceDate, align: 'center' },
      { val: methodShort, align: 'center' },
      { val: r.totalCost, align: 'left', format: '#,##0.00' },
      { val: Math.round(r.beginningBookValue * 100) / 100, align: 'left', format: '#,##0.00' },
      { val: Math.round(r.periodExpense * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.AMBER_BG, customColor: COLORS.AMBER_TEXT },
      { val: Math.round(r.accumulatedAtEnd * 100) / 100, align: 'left', format: '#,##0.00' },
      { val: Math.round(r.endingBookValue * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.EMERALD_BG, customColor: COLORS.EMERALD_TEXT },
      { val: r.asset.location || '-', align: 'right' },
      { val: r.asset.custodian || '-', align: 'right' },
    ];

    cells.forEach((cellData, c) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });
      formatCell(ws, ref, cellData.val, {
        font: {
          name: 'Arial',
          sz: 9.5,
          bold: Boolean(cellData.customBg),
          color: { rgb: cellData.customColor || '0F172A' },
        },
        fill: { fgColor: { rgb: cellData.customBg || rowBg } },
        alignment: { horizontal: cellData.align || 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      }, cellData.format);
    });

    currentRow++;
  });

  // Footer Totals Row
  const totals: { c: number; val: any; format?: string }[] = [
    { c: 0, val: 'المجموع الكلي للفترة المحددة:' },
    { c: 6, val: periodTotals.totalCost, format: '#,##0.00' },
    { c: 7, val: periodTotals.beginningBookValue, format: '#,##0.00' },
    { c: 8, val: periodTotals.periodExpense, format: '#,##0.00' },
    { c: 9, val: periodTotals.accumulatedAtEnd, format: '#,##0.00' },
    { c: 10, val: periodTotals.endingBookValue, format: '#,##0.00' },
  ];

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    const match = totals.find((t) => t.c === c);
    formatCell(ws, ref, match ? match.val : '', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
      alignment: { horizontal: c === 0 ? 'right' : 'left', vertical: 'center' },
      border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
    }, match?.format);
  }

  // WorkSheet Range and Options
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: currentRow, c: totalCols - 1 },
  });

  // Enable Right-to-Left (RTL) & Freeze Panes on Table Header (Rows 0-3 stay frozen on scroll)
  ws['!views'] = [
    {
      RTL: true,
      xSplit: 0,
      ySplit: 4,
      topLeftCell: 'A5',
      activePane: 'bottomLeft',
      state: 'frozen',
    },
  ];

  // Merges
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
    { s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } },
  ];

  // Auto-fit dynamic column widths
  const periodRowsForWidth = periodResults.map((r) => [
    r.assetCode,
    r.assetName,
    r.asset.department || 'الإدارة العامة',
    r.categoryName,
    r.inServiceDate,
    getMethodLabel(r.asset.depreciationMethod).short,
    r.totalCost,
    r.beginningBookValue,
    r.periodExpense,
    r.accumulatedAtEnd,
    r.endingBookValue,
    r.asset.location,
    r.asset.custodian,
  ]);
  ws['!cols'] = calculateAutoFitCols(headers, periodRowsForWidth, {
    0: 14,
    1: 30,
    2: 22,
    3: 22,
    6: 18,
    7: 18,
    8: 20,
    9: 18,
    10: 18,
  });

  ws['!rows'] = [
    { hpt: 32 },
    { hpt: 22 },
    { hpt: 8 },
    { hpt: 28 },
  ];

  const actualFilename = filename || `تقرير_إهلاك_الأصول_${fromDate}_إلى_${toDate}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, 'تقرير إهلاك الفترة');
  saveWorkbookSafely(wb, actualFilename);
}

/**
 * Export Category Depreciation Summary Report to Excel (RTL & Colors)
 */
export function exportCategoryReportToExcel(
  categoryPeriodSummary: any[],
  fromDate: string,
  toDate: string,
  currency: string,
  companyName: string
): void {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const headers = [
    'تصنيف وفئة الأصل',
    'عدد الأصول',
    'إجمالي التكلفة الرأسمالية',
    'القيمة الدفترية أول الفترة',
    `مصروف إهلاك الفترة (${fromDate} إلى ${toDate})`,
    'مجمع الإهلاك حتى نهاية الفترة',
    'صافي القيمة الدفترية نهاية الفترة',
    'نسبة الاستهلاك %',
  ];

  const totalCols = headers.length;
  let currentRow = 0;

  // Title
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? `${companyName} - تقرير إهلاك الأصول حسب التصنيفات والفئات` : '', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // Subtitle
  const metaText = `الفترة: من ${fromDate} إلى ${toDate} | العملة: ${currency} | تاريخ الاستخراج: ${new Date().toISOString().split('T')[0]}`;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? metaText : '', {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;
  currentRow++; // Blank

  // Headers
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, h, {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: getBorder(COLORS.BORDER_HEADER, 'medium', 'medium'),
    });
  });
  currentRow++;

  let sumCount = 0;
  let sumCost = 0;
  let sumBeg = 0;
  let sumExpense = 0;
  let sumAccum = 0;
  let sumEnd = 0;

  categoryPeriodSummary.forEach((cData, idx) => {
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;
    const ratio = cData.cost > 0 ? (cData.accumulated / cData.cost) * 100 : 0;

    sumCount += cData.count;
    sumCost += cData.cost;
    sumBeg += cData.beginning;
    sumExpense += cData.periodExpense;
    sumAccum += cData.accumulated;
    sumEnd += cData.ending;

    const cells: { val: any; align?: string; format?: string; customBg?: string; customColor?: string }[] = [
      { val: cData.categoryName, align: 'right' },
      { val: cData.count, align: 'center' },
      { val: cData.cost, align: 'left', format: '#,##0.00' },
      { val: Math.round(cData.beginning * 100) / 100, align: 'left', format: '#,##0.00' },
      { val: Math.round(cData.periodExpense * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.AMBER_BG, customColor: COLORS.AMBER_TEXT },
      { val: Math.round(cData.accumulated * 100) / 100, align: 'left', format: '#,##0.00' },
      { val: Math.round(cData.ending * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.EMERALD_BG, customColor: COLORS.EMERALD_TEXT },
      { val: `${Math.round(ratio * 10) / 10}%`, align: 'center' },
    ];

    cells.forEach((cellData, c) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });
      formatCell(ws, ref, cellData.val, {
        font: {
          name: 'Arial',
          sz: 9.5,
          bold: Boolean(cellData.customBg),
          color: { rgb: cellData.customColor || '0F172A' },
        },
        fill: { fgColor: { rgb: cellData.customBg || rowBg } },
        alignment: { horizontal: cellData.align || 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      }, cellData.format);
    });

    currentRow++;
  });

  // Totals
  const totals: { c: number; val: any; format?: string }[] = [
    { c: 0, val: 'المجموع الكلي لجميع التصنيفات:' },
    { c: 1, val: sumCount },
    { c: 2, val: sumCost, format: '#,##0.00' },
    { c: 3, val: sumBeg, format: '#,##0.00' },
    { c: 4, val: sumExpense, format: '#,##0.00' },
    { c: 5, val: sumAccum, format: '#,##0.00' },
    { c: 6, val: sumEnd, format: '#,##0.00' },
    { c: 7, val: sumCost > 0 ? `${Math.round((sumAccum / sumCost) * 1000) / 10}%` : '-' },
  ];

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    const match = totals.find((t) => t.c === c);
    formatCell(ws, ref, match ? match.val : '', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
      alignment: { horizontal: c === 0 ? 'right' : 'left', vertical: 'center' },
      border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
    }, match?.format);
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow, c: totalCols - 1 } });
  // Freeze Panes on Table Header (Rows 0-3 stay pinned on scroll)
  ws['!views'] = [
    {
      RTL: true,
      xSplit: 0,
      ySplit: 4,
      topLeftCell: 'A5',
      activePane: 'bottomLeft',
      state: 'frozen',
    },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
  ];
  const catRowsForWidth = categoryPeriodSummary.map((c) => [
    c.categoryName,
    c.count,
    c.cost,
    c.beginning,
    c.periodExpense,
    c.accumulated,
    c.ending,
    c.cost > 0 ? (c.accumulated / c.cost) * 100 : 0,
  ]);
  ws['!cols'] = calculateAutoFitCols(headers, catRowsForWidth, {
    0: 28,
    1: 14,
    2: 22,
    3: 20,
    4: 22,
    5: 22,
    6: 22,
    7: 16,
  });

  XLSX.utils.book_append_sheet(wb, ws, 'إهلاك التصنيفات');
  saveWorkbookSafely(wb, `تقرير_الإهلاك_حسب_التصنيفات_${fromDate}_إلى_${toDate}.xlsx`);
}

/**
 * Export Department Breakdown Report to Excel (RTL & Colors)
 */
export function exportDepartmentReportToExcel(
  departmentSummary: any[],
  fromDate: string,
  toDate: string,
  currency: string,
  companyName: string
): void {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const headers = [
    'القسم / الإدارة',
    'تصنيفات الأصول الموجودة في القسم',
    'عدد الأصول',
    'إجمالي التكلفة الرأسمالية',
    `مصروف إهلاك الفترة (${fromDate} إلى ${toDate})`,
    'صافي القيمة الدفترية الحالية',
  ];

  const totalCols = headers.length;
  let currentRow = 0;

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? `${companyName} - تقرير توزيع الأصول وإهلاكها حسب الإدارات والأقسام` : '', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  const metaText = `الفترة: من ${fromDate} إلى ${toDate} | العملة: ${currency} | تاريخ الاستخراج: ${new Date().toISOString().split('T')[0]}`;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? metaText : '', {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;
  currentRow++; // Blank

  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, h, {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: getBorder(COLORS.BORDER_HEADER, 'medium', 'medium'),
    });
  });
  currentRow++;

  let sumCount = 0;
  let sumCost = 0;
  let sumExpense = 0;
  let sumNBV = 0;

  departmentSummary.forEach((d, idx) => {
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;

    sumCount += d.count;
    sumCost += d.cost;
    sumExpense += d.periodExpense;
    sumNBV += d.nbv;

    const cells: { val: any; align?: string; format?: string; customBg?: string; customColor?: string }[] = [
      { val: d.department, align: 'right' },
      { val: d.categoriesList, align: 'right' },
      { val: d.count, align: 'center' },
      { val: d.cost, align: 'left', format: '#,##0.00' },
      { val: Math.round(d.periodExpense * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.AMBER_BG, customColor: COLORS.AMBER_TEXT },
      { val: Math.round(d.nbv * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.EMERALD_BG, customColor: COLORS.EMERALD_TEXT },
    ];

    cells.forEach((cellData, c) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });
      formatCell(ws, ref, cellData.val, {
        font: {
          name: 'Arial',
          sz: 9.5,
          bold: Boolean(cellData.customBg),
          color: { rgb: cellData.customColor || '0F172A' },
        },
        fill: { fgColor: { rgb: cellData.customBg || rowBg } },
        alignment: { horizontal: cellData.align || 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      }, cellData.format);
    });

    currentRow++;
  });

  // Totals
  const totals: { c: number; val: any; format?: string }[] = [
    { c: 0, val: 'المجموع الكلي لجميع الإدارات:' },
    { c: 2, val: sumCount },
    { c: 3, val: sumCost, format: '#,##0.00' },
    { c: 4, val: sumExpense, format: '#,##0.00' },
    { c: 5, val: sumNBV, format: '#,##0.00' },
  ];

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    const match = totals.find((t) => t.c === c);
    formatCell(ws, ref, match ? match.val : '', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
      alignment: { horizontal: c === 0 ? 'right' : 'left', vertical: 'center' },
      border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
    }, match?.format);
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow, c: totalCols - 1 } });
  // Freeze Panes on Table Header (Rows 0-3 stay pinned on scroll)
  ws['!views'] = [
    {
      RTL: true,
      xSplit: 0,
      ySplit: 4,
      topLeftCell: 'A5',
      activePane: 'bottomLeft',
      state: 'frozen',
    },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
    { s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 1 } },
  ];
  const deptRowsForWidth = departmentSummary.map((d) => [
    d.department,
    d.categoriesList,
    d.count,
    d.cost,
    d.periodExpense,
    d.nbv,
  ]);
  ws['!cols'] = calculateAutoFitCols(headers, deptRowsForWidth, {
    0: 26,
    1: 34,
    2: 14,
    3: 22,
    4: 22,
    5: 22,
  });

  XLSX.utils.book_append_sheet(wb, ws, 'أصول وإهلاك الإدارات');
  saveWorkbookSafely(wb, `تقرير_أصول_وإهلاك_الإدارات_${fromDate}_إلى_${toDate}.xlsx`);
}

/**
 * Export Disposals Report to Excel (RTL & Colors)
 */
export function exportDisposalsReportToExcel(
  disposalAssets: Asset[],
  currency: string = 'ريال يمني (YER)',
  companyName: string = 'المؤسسة التجارية',
  catMap?: Map<string, string>
): void {
  const safeCatMap = catMap || new Map<string, string>();
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const headers = [
    'كود الأصل',
    'اسم الأصل',
    'تصنيف وفئة الأصل',
    'الإدارة / القسم',
    'تاريخ الاستبعاد',
    'نوع العملية',
    'سعر البيع / الإيراد',
    'تكاليف البيع',
    'القيمة الدفترية عند الاستبعاد',
    'مجمع الإهلاك عند الاستبعاد',
    'أرباح / (خسائر) رأسمالية',
    'المشتري / الجهة المستلمة',
    'السبب / الملاحظات',
  ];

  const totalCols = headers.length;
  let currentRow = 0;

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? `${companyName} - تقرير استبعاد وبيع الأصول الثابتة والأرباح الرأسمالية` : '', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  const metaText = `العملة: ${currency} | عدد الأصول المستبعدة: ${disposalAssets.length} | تاريخ الاستخراج: ${new Date().toISOString().split('T')[0]}`;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? metaText : '', {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;
  currentRow++; // Blank

  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, h, {
      font: { name: 'Arial', sz: 10.5, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: getBorder(COLORS.BORDER_HEADER, 'medium', 'medium'),
    });
  });
  currentRow++;

  let sumPrice = 0;
  let sumCost = 0;
  let sumBV = 0;
  let sumAccum = 0;
  let sumGainLoss = 0;

  disposalAssets.forEach((asset, idx) => {
    const d = asset.disposal!;
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;
    const isGain = d.gainLoss >= 0;

    sumPrice += d.salePrice;
    sumCost += d.disposalCosts;
    sumBV += d.bookValueAtDisposal;
    sumAccum += d.accumulatedAtDisposal;
    sumGainLoss += d.gainLoss;

    const cells: { val: any; align?: string; format?: string; customBg?: string; customColor?: string }[] = [
      { val: asset.code, align: 'center' },
      { val: asset.name, align: 'right' },
      { val: safeCatMap.get(asset.category) || asset.category, align: 'right' },
      { val: asset.department || 'الإدارة العامة', align: 'right' },
      { val: d.disposalDate, align: 'center' },
      { val: d.disposalType === 'sale' ? 'بيع' : d.disposalType === 'scrap' ? 'تخريد' : d.disposalType === 'donation' ? 'تبرع' : 'فقد/تلف', align: 'center' },
      { val: d.salePrice, align: 'left', format: '#,##0.00' },
      { val: d.disposalCosts, align: 'left', format: '#,##0.00' },
      { val: d.bookValueAtDisposal, align: 'left', format: '#,##0.00' },
      { val: d.accumulatedAtDisposal, align: 'left', format: '#,##0.00' },
      { val: d.gainLoss, align: 'left', format: '#,##0.00', customBg: isGain ? COLORS.EMERALD_BG : COLORS.ROSE_BG, customColor: isGain ? COLORS.EMERALD_TEXT : COLORS.ROSE_TEXT },
      { val: d.buyerName || '-', align: 'right' },
      { val: d.reason || '-', align: 'right' },
    ];

    cells.forEach((cellData, c) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });
      formatCell(ws, ref, cellData.val, {
        font: {
          name: 'Arial',
          sz: 9.5,
          bold: Boolean(cellData.customBg),
          color: { rgb: cellData.customColor || '0F172A' },
        },
        fill: { fgColor: { rgb: cellData.customBg || rowBg } },
        alignment: { horizontal: cellData.align || 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      }, cellData.format);
    });

    currentRow++;
  });

  // Totals
  const totals: { c: number; val: any; format?: string }[] = [
    { c: 0, val: 'المجموع الكلي للاستبعادات:' },
    { c: 6, val: sumPrice, format: '#,##0.00' },
    { c: 7, val: sumCost, format: '#,##0.00' },
    { c: 8, val: sumBV, format: '#,##0.00' },
    { c: 9, val: sumAccum, format: '#,##0.00' },
    { c: 10, val: sumGainLoss, format: '#,##0.00' },
  ];

  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    const match = totals.find((t) => t.c === c);
    formatCell(ws, ref, match ? match.val : '', {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
      alignment: { horizontal: c === 0 ? 'right' : 'left', vertical: 'center' },
      border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
    }, match?.format);
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow, c: totalCols - 1 } });
  // Freeze Panes on Table Header (Rows 0-3 stay pinned on scroll)
  ws['!views'] = [
    {
      RTL: true,
      xSplit: 0,
      ySplit: 4,
      topLeftCell: 'A5',
      activePane: 'bottomLeft',
      state: 'frozen',
    },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
    { s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 5 } },
  ];
  const dispRowsForWidth = disposalAssets.map((a) => {
    const d = a.disposal!;
    return [
      a.code,
      a.name,
      safeCatMap.get(a.category) || a.category,
      a.department || 'الإدارة العامة',
      d.disposalDate,
      d.disposalType,
      d.salePrice,
      d.disposalCosts,
      d.bookValueAtDisposal,
      d.accumulatedAtDisposal,
      d.gainLoss,
      d.buyerName,
      d.reason,
    ];
  });
  ws['!cols'] = calculateAutoFitCols(headers, dispRowsForWidth, {
    0: 13,
    1: 30,
    2: 22,
    3: 20,
    6: 18,
    8: 20,
    9: 20,
    10: 20,
  });

  XLSX.utils.book_append_sheet(wb, ws, 'استبعادات ومبيعات الأصول');
  saveWorkbookSafely(wb, 'تقرير_استبعاد_وبيع_الأصول.xlsx');
}

/**
 * Export single asset depreciation schedule to Excel (RTL & Colors)
 */
export function exportScheduleToExcel(asset: Asset, currency: string = 'ريال يمني (YER)'): void {
  const schedule = calculateSchedule(asset);
  const totalCost = getTotalCost(asset);
  const wb = XLSX.utils.book_new();

  // Schedule Sheet
  const wsSchedule: XLSX.WorkSheet = {};
  const headers = [
    'السنة / الفترة المالية',
    'القيمة الدفترية بداية الفترة',
    'مصروف إهلاك الفترة',
    'مجمع الإهلاك حتى نهاية الفترة',
    'صافي القيمة الدفترية نهاية الفترة',
    'نسبة الإهلاك %',
  ];

  let currentRow = 0;
  // Title
  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(wsSchedule, ref, c === 0 ? `جدول الإهلاك التقديري للأصل: ${asset.name} (${asset.code})` : '', {
      font: { name: 'Arial', sz: 13, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // Subtitle
  const ruleInfo = getStartRuleLabel(asset.startDepreciationRule);
  const meta = `طريقة الإهلاك: ${getMethodLabel(asset.depreciationMethod).ar} | سياسة البدء: ${ruleInfo.label} | التكلفة: ${formatNumber(totalCost)} ${currency} | الخردة: ${formatNumber(asset.salvageValue)} ${currency}`;
  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(wsSchedule, ref, c === 0 ? meta : '', {
      font: { name: 'Arial', sz: 9.5, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;
  currentRow++; // Blank

  // Headers
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(wsSchedule, ref, h, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: getBorder(COLORS.BORDER_HEADER),
    });
  });
  currentRow++;

  schedule.forEach((row, idx) => {
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;

    const cells: { val: any; align?: string; format?: string; customBg?: string; customColor?: string }[] = [
      { val: row.periodLabel, align: 'center' },
      { val: Math.round(row.beginningBookValue * 100) / 100, align: 'left', format: '#,##0.00' },
      { val: Math.round(row.depreciationExpense * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.AMBER_BG, customColor: COLORS.AMBER_TEXT },
      { val: Math.round(row.accumulatedDepreciation * 100) / 100, align: 'left', format: '#,##0.00' },
      { val: Math.round(row.endingBookValue * 100) / 100, align: 'left', format: '#,##0.00', customBg: COLORS.EMERALD_BG, customColor: COLORS.EMERALD_TEXT },
      { val: row.ratePercent ? `${Math.round(row.ratePercent * 10) / 10}%` : '-', align: 'center' },
    ];

    cells.forEach((cellData, c) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });
      formatCell(wsSchedule, ref, cellData.val, {
        font: {
          name: 'Arial',
          sz: 9.5,
          bold: Boolean(cellData.customBg),
          color: { rgb: cellData.customColor || '0F172A' },
        },
        fill: { fgColor: { rgb: cellData.customBg || rowBg } },
        alignment: { horizontal: cellData.align || 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      }, cellData.format);
    });

    currentRow++;
  });

  wsSchedule['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow - 1, c: headers.length - 1 } });
  wsSchedule['!views'] = [
    {
      RTL: true,
      xSplit: 0,
      ySplit: 3,
      topLeftCell: 'A4',
      activePane: 'bottomLeft',
      state: 'frozen',
    },
  ];
  wsSchedule['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
  ];
  const scheduleRowsForWidth = schedule.map((row) => [
    row.periodLabel,
    row.beginningBookValue,
    row.depreciationExpense,
    row.accumulatedDepreciation,
    row.endingBookValue,
    row.ratePercent,
  ]);
  wsSchedule['!cols'] = calculateAutoFitCols(headers, scheduleRowsForWidth, {
    0: 22,
    1: 24,
    2: 22,
    3: 26,
    4: 26,
    5: 16,
  });

  XLSX.utils.book_append_sheet(wb, wsSchedule, 'جدول الإهلاك التقديري');
  saveWorkbookSafely(wb, `جدول_إهلاك_${asset.code}_${asset.name.replace(/\s+/g, '_')}.xlsx`);
}

export interface CustomReportColumn {
  id: string;
  label: string;
  align?: 'right' | 'center' | 'left';
  width?: number;
  isFinancial?: boolean;
  isNumeric?: boolean;
  highlight?: 'amber' | 'emerald' | 'none';
}

/**
 * Export dynamically customized user-defined report to Excel (Full Colors & Strict RTL)
 */
export function exportCustomReportToExcel(params: {
  title: string;
  columns: CustomReportColumn[];
  rows: Array<Record<string, any>>;
  currency: string;
  companyName: string;
  fromDate?: string;
  toDate?: string;
  filterSummary?: string;
  filename?: string;
}): void {
  const {
    title,
    columns,
    rows,
    currency,
    companyName,
    fromDate,
    toDate,
    filterSummary,
    filename,
  } = params;

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const totalCols = Math.max(columns.length, 1);
  let currentRow = 0;

  // 1. Title Banner (Row 0)
  const fullTitle = `${companyName} - ${title}`;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? fullTitle : '', {
      font: { name: 'Arial', sz: 14, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // 2. Subtitle / Metadata (Row 1)
  const dateInfo = fromDate && toDate ? `الفترة المالية: من ${fromDate} إلى ${toDate} | ` : '';
  const filterInfo = filterSummary ? `المحددات: ${filterSummary} | ` : '';
  const metaText = `${dateInfo}${filterInfo}العملة: ${currency} | عدد الأصول المعروضة: ${rows.length} | تاريخ الاستخراج: ${new Date().toISOString().split('T')[0]}`;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? metaText : '', {
      font: { name: 'Arial', sz: 9.5, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // 3. Blank row (Row 2)
  currentRow++;

  // 4. Headers Row
  const headerRowIdx = currentRow;
  columns.forEach((col, c) => {
    const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    formatCell(ws, ref, col.label, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: getBorder(COLORS.BORDER_HEADER),
    });
  });
  currentRow++;

  // 5. Data Rows
  const totals: Record<string, number> = {};
  columns.forEach(col => {
    if (col.isNumeric || col.isFinancial) {
      totals[col.id] = 0;
    }
  });

  rows.forEach((row, idx) => {
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;

    columns.forEach((col, c) => {
      const rawVal = row[col.id];
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });

      let cellVal = rawVal;
      let cellFormat: string | undefined = undefined;
      let customBg: string | undefined = undefined;
      let customColor: string | undefined = undefined;

      if (col.isFinancial) {
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
        totals[col.id] = (totals[col.id] || 0) + numVal;
        cellVal = Math.round(numVal * 100) / 100;
        cellFormat = '#,##0.00';

        if (col.highlight === 'amber' || col.id === 'periodExpense') {
          customBg = COLORS.AMBER_BG;
          customColor = COLORS.AMBER_TEXT;
        } else if (col.highlight === 'emerald' || col.id === 'endingBookValue') {
          customBg = COLORS.EMERALD_BG;
          customColor = COLORS.EMERALD_TEXT;
        }
      } else if (col.isNumeric) {
        const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0;
        totals[col.id] = (totals[col.id] || 0) + numVal;
        cellVal = numVal;
        cellFormat = '#,##0';
      }

      formatCell(
        ws,
        ref,
        cellVal ?? '-',
        {
          font: {
            name: 'Arial',
            sz: 9.5,
            bold: Boolean(customBg),
            color: { rgb: customColor || '0F172A' },
          },
          fill: { fgColor: { rgb: customBg || rowBg } },
          alignment: {
            horizontal: col.align || (col.isNumeric || col.isFinancial ? 'left' : 'right'),
            vertical: 'center',
          },
          border: getBorder(COLORS.BORDER_LIGHT),
        },
        cellFormat
      );
    });

    currentRow++;
  });

  // 6. Totals Row
  const totalRowIdx = currentRow;
  let firstNumericColIdx = columns.findIndex(col => col.isFinancial || col.isNumeric);
  if (firstNumericColIdx < 0) firstNumericColIdx = columns.length;

  for (let c = 0; c < totalCols; c++) {
    const col = columns[c];
    const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });

    if (c === 0) {
      formatCell(ws, ref, 'الإجمالي العام:', {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
      });
    } else if (c < firstNumericColIdx) {
      formatCell(ws, ref, '', {
        fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
        border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
      });
    } else if (col && col.isFinancial) {
      const sumVal = Math.round((totals[col.id] || 0) * 100) / 100;
      formatCell(
        ws,
        ref,
        sumVal,
        {
          font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
          fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
        },
        '#,##0.00'
      );
    } else if (col && col.isNumeric && totals[col.id] !== undefined) {
      formatCell(
        ws,
        ref,
        totals[col.id],
        {
          font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
          fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
        },
        '#,##0'
      );
    } else {
      formatCell(ws, ref, '-', {
        font: { name: 'Arial', sz: 9, color: { rgb: '64748B' } },
        fill: { fgColor: { rgb: COLORS.TOTALS_BG } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: getBorder(COLORS.BORDER_DARK, 'medium', 'double'),
      });
    }
  }

  // 7. Merges & Dimensions with Freeze Panes on Table Header
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRowIdx, c: totalCols - 1 },
  });
  ws['!views'] = [
    {
      RTL: true,
      xSplit: 0,
      ySplit: headerRowIdx + 1,
      topLeftCell: `A${headerRowIdx + 2}`,
      activePane: 'bottomLeft',
      state: 'frozen',
    },
  ];

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
  ];
  if (firstNumericColIdx > 1) {
    merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: firstNumericColIdx - 1 } });
  }
  ws['!merges'] = merges;

  // Auto-fit Column Widths based on real cell contents
  const customRowsForWidth = rows.map((r) => columns.map((c) => r[c.id]));
  ws['!cols'] = calculateAutoFitCols(columns.map((c) => c.label), customRowsForWidth);

  // Row Heights
  ws['!rows'] = [
    { hpt: 30 }, // Title
    { hpt: 20 }, // Meta
    { hpt: 8 },  // Blank
    { hpt: 28 }, // Headers
  ];

  const actualFilename = filename || `${title.replace(/\s+/g, '_')}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير المخصص');
  saveWorkbookSafely(wb, actualFilename);
}

/**
 * Downloads the official formatted Excel Template for importing assets
 * Exactly matches all fields, titles, categories, departments and methods of the application.
 */
export function downloadExcelTemplate(mode: 'blank' | 'with_sample' = 'with_sample'): void {
  const wb = XLSX.utils.book_new();

  // Template Column Headers (Matched exactly with app models)
  const headers = [
    'كود الأصل (اختياري)',
    'اسم الأصل (إلزامي)',
    'تصنيف وفئة الأصل (إلزامي)',
    'الإدارة / القسم (إلزامي)',
    'تاريخ الشراء (YYYY-MM-DD)',
    'تاريخ بدء التشغيل (YYYY-MM-DD)',
    'تكلفة الشراء الأصلية',
    'تكاليف إضافية (نقل وتركيب)',
    'قيمة الخردة / النفاية',
    'العمر الإنتاجي (سنوات)',
    'طريقة الإهلاك',
    'سياسة بدء الإهلاك (قاعدة 15 يوم)',
    'الموقع / الفرع',
    'الموظف المسؤول (العهدة)',
    'الرقم التسلسلي (Serial No)',
    'المورد / الشركة البائعة',
    'رقم الفاتورة',
    'إجمالي الوحدات المقدرة (لوحدات الإنتاج)',
    'الوحدات المنتجة حتى الآن',
    'وحدة القياس',
    'ملاحظات',
  ];

  const totalCols = headers.length;
  const ws: XLSX.WorkSheet = {};
  let currentRow = 0;

  // Title Banner
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? 'نموذج استيراد الأصول الثابتة المعتمد - نظام إدارة وحساب إهلاك الأصول' : '', {
      font: { name: 'Arial', sz: 13, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;

  // Subtitle with essential guidelines
  const instructions = 'تعليمات التعبئة: يرجى إدخال التكاليف كأرقام مجردة بالإنجليزية | التواريخ بصيغة YYYY-MM-DD | راجع تبويب (دليل الخيارات المعتمدة) بالأسفل للتعرف على التصنيفات وطرق الإهلاك';
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    formatCell(ws, ref, c === 0 ? instructions : '', {
      font: { name: 'Arial', sz: 9.5, italic: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.SUB_BANNER } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  currentRow++;
  currentRow++; // Blank spacer

  // Table Column Headers
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: currentRow, c });
    const isRequired = h.includes('إلزامي');
    formatCell(ws, ref, h, {
      font: {
        name: 'Arial',
        sz: 10,
        bold: true,
        color: { rgb: COLORS.WHITE },
      },
      fill: { fgColor: { rgb: isRequired ? COLORS.ROYAL_BLUE : '334155' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: getBorder(COLORS.BORDER_HEADER, 'medium', 'medium'),
    });
  });
  currentRow++;

  // Sample data rows (realistic, rich, and demonstrating features)
  const sampleRows = mode === 'with_sample' ? [
    [
      'AST-101',
      'سيرفر رئيسي Dell PowerEdge R750',
      'أجهزة الكمبيوتر والتقنية والشبكات',
      'إدارة تقنية المعلومات',
      '2024-01-10',
      '2024-01-12',
      3500000,
      150000,
      200000,
      5,
      'القسط الثابت',
      'قاعدة 15 يوم (منتصف الشهر)',
      'المركز الرئيسي - صنعاء',
      'م. عادل الشامي',
      'DELL-SN-994821',
      'شركة النظم المتقدمة',
      'INV-2024-881',
      '',
      '',
      '',
      'بدء قبل 15 فيحسب إهلاك شهر 1 كاملاً',
    ],
    [
      'AST-102',
      'مولد كهربائي كاتربيلر 150 KVA',
      'الآلات وخطوط الإنتاج والمولدات',
      'إدارة العمليات والتشغيل',
      '2023-06-18',
      '2023-06-20',
      12000000,
      500000,
      800000,
      10,
      'القسط المتناقص المضاعف',
      'قاعدة 15 يوم (منتصف الشهر)',
      'محطة التشغيل المركزية',
      'أحمد صالح المهندس',
      'CAT-GEN-55421',
      'شركة وكالات الطاقة',
      'INV-99321',
      '',
      '',
      '',
      'بدء بعد 15 فيضاف كأصل لشهر 6 ويبدأ إهلاكه من شهر 7',
    ],
    [
      'AST-103',
      'باص نقل موظفين تويوتا هايس 15 راكب',
      'المركبات ووسائل النقل',
      'إدارة الخدمات اللوجستية',
      '2024-03-05',
      '2024-03-05',
      8500000,
      200000,
      1200000,
      5,
      'القسط الثابت',
      'قاعدة 15 يوم (منتصف الشهر)',
      'الفرع الرئيسي',
      'خالد ناصر السائق',
      'TOY-BUS-8812',
      'وكالة بازرعة',
      'INV-4412',
      '',
      '',
      '',
      'مخصص لنقل موظفي الفروع',
    ],
    [
      'AST-104',
      'منظومة طاقة شمسية 20 كيلوواط مع بطاريات ليثيوم',
      'منظومات الطاقة الشمسية والكهرباء',
      'إدارة الخدمات العامة',
      '2024-02-14',
      '2024-02-14',
      6200000,
      300000,
      400000,
      8,
      'مجموع أرقام السنين',
      'قاعدة 15 يوم (منتصف الشهر)',
      'سطح مبنى الإدارة العامة',
      'م. فهد القدسي',
      'SOLAR-HYB-20K',
      'شركة البدائل الذكية',
      'INV-7721',
      '',
      '',
      '',
      'تشمل 40 لوح شمسي بقدرة 550 واط',
    ],
  ] : [];

  sampleRows.forEach((rowValues, idx) => {
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? COLORS.ZEBRA_BG : COLORS.WHITE;

    rowValues.forEach((val, c) => {
      const ref = XLSX.utils.encode_cell({ r: currentRow, c });
      const isNumber = typeof val === 'number';
      formatCell(ws, ref, val, {
        font: { name: 'Arial', sz: 9.5, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: rowBg } },
        alignment: { horizontal: isNumber ? 'left' : c === 0 || c === 4 || c === 5 || c === 9 || c === 10 || c === 11 ? 'center' : 'right', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      }, isNumber ? '#,##0.00' : undefined);
    });

    currentRow++;
  });

  // Range and Properties
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(currentRow - 1, 15), c: totalCols - 1 },
  });
  ws['!views'] = [{ RTL: true }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
  ];

  // Column Widths
  ws['!cols'] = [
    { wch: 18 }, // كود
    { wch: 34 }, // اسم
    { wch: 28 }, // تصنيف
    { wch: 24 }, // إدارة
    { wch: 18 }, // تاريخ شراء
    { wch: 18 }, // تاريخ تشغيل
    { wch: 18 }, // تكلفة
    { wch: 18 }, // تكاليف إضافية
    { wch: 18 }, // خردة
    { wch: 16 }, // عمر
    { wch: 22 }, // طريقة
    { wch: 26 }, // سياسة
    { wch: 22 }, // موقع
    { wch: 20 }, // عهدة
    { wch: 20 }, // تسلسلي
    { wch: 22 }, // مورد
    { wch: 16 }, // فاتورة
    { wch: 22 }, // وحدات مقدرة
    { wch: 18 }, // وحدات منتجة
    { wch: 14 }, // وحدة قياس
    { wch: 36 }, // ملاحظات
  ];

  ws['!rows'] = [
    { hpt: 30 },
    { hpt: 20 },
    { hpt: 8 },
    { hpt: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'نموذج_إدخال_الأصول');

  // Sheet 2: Reference Guide & Options Sheet (دليل الخيارات والتصنيفات المعتمدة)
  const wsGuide: XLSX.WorkSheet = {};
  let gRow = 0;

  // Title Guide
  for (let c = 0; c < 4; c++) {
    const ref = XLSX.utils.encode_cell({ r: gRow, c });
    formatCell(wsGuide, ref, c === 0 ? 'دليل الخيارات والتصنيفات المعتمدة في النظام' : '', {
      font: { name: 'Arial', sz: 13, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  gRow += 2;

  // Section 1: Categories
  const catHeaders = ['اسم التصنيف المعتمد', 'الرمز الإنجليزي', 'العمر الافتراضي المقترح', 'طريقة الإهلاك النموذجية'];
  catHeaders.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: gRow, c });
    formatCell(wsGuide, ref, h, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: COLORS.ROYAL_BLUE } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: getBorder(COLORS.BORDER_HEADER),
    });
  });
  gRow++;

  const catRows = [
    ['المباني والإنشاءات', 'buildings', '25 سنة', 'القسط الثابت (Straight Line)'],
    ['الآلات وخطوط الإنتاج والمولدات', 'machinery', '10 سنوات', 'القسط المتناقص المضاعف أو القسط الثابت'],
    ['المركبات ووسائل النقل', 'vehicles', '5 سنوات', 'القسط الثابت'],
    ['منظومات الطاقة الشمسية والكهرباء', 'solar_energy', '10 سنوات', 'القسط الثابت أو مجموع السنين'],
    ['أجهزة الكمبيوتر والتقنية والشبكات', 'computers', '3-5 سنوات', 'القسط الثابت'],
    ['الأثاث والتجهيزات المكتبية', 'furniture', '5-7 سنوات', 'القسط الثابت'],
    ['العدد والمعدات والتركيبات', 'tools', '5 سنوات', 'القسط الثابت'],
  ];

  catRows.forEach((rVals) => {
    rVals.forEach((val, c) => {
      const ref = XLSX.utils.encode_cell({ r: gRow, c });
      formatCell(wsGuide, ref, val, {
        font: { name: 'Arial', sz: 9.5, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: gRow % 2 === 1 ? COLORS.ZEBRA_BG : COLORS.WHITE } },
        alignment: { horizontal: c === 0 ? 'right' : 'center', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      });
    });
    gRow++;
  });
  gRow += 2;

  // Section 2: Depreciation Methods
  const methodHeaders = ['اسم طريقة الإهلاك في النموذج', 'الرمز المقبول', 'شرح طريقة الحسبة المحاسبية', ''];
  methodHeaders.forEach((h, c) => {
    if (c === 3) return;
    const ref = XLSX.utils.encode_cell({ r: gRow, c });
    formatCell(wsGuide, ref, h, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: '047857' } }, // Emerald header
      alignment: { horizontal: 'center', vertical: 'center' },
      border: getBorder(COLORS.BORDER_HEADER),
    });
  });
  gRow++;

  const methodGuideRows = [
    ['القسط الثابت', 'straight_line', 'قسط متساوٍ سنوياً أو شهرياً: (التكلفة - الخردة) ÷ العمر'],
    ['القسط المتناقص المضاعف', 'double_declining', 'نسبة مضاعفة 200% تطبق على صافي القيمة الدفترية أول الفترة'],
    ['القسط المتناقص 150%', 'declining_150', 'نسبة 150% تطبق على صافي القيمة الدفترية أول الفترة'],
    ['مجموع أرقام السنين', 'sum_of_years', 'إهلاك متناقص وفق وزن السنوات (n(n+1)/2)'],
    ['وحدات الإنتاج أو النشاط', 'units_of_production', 'احتساب الإهلاك بحسب ساعات التشغيل أو الكيلومترات أو القطع المنتجة'],
  ];

  methodGuideRows.forEach((rVals) => {
    rVals.forEach((val, c) => {
      const ref = XLSX.utils.encode_cell({ r: gRow, c });
      formatCell(wsGuide, ref, val, {
        font: { name: 'Arial', sz: 9.5, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: gRow % 2 === 1 ? COLORS.ZEBRA_BG : COLORS.WHITE } },
        alignment: { horizontal: c === 0 || c === 2 ? 'right' : 'center', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      });
    });
    gRow++;
  });
  gRow += 2;

  // Section 3: Start Rule (15-Day Mid Month Rule)
  const ruleHeaders = ['سياسة بدء الإهلاك', 'الرمز المقبول', 'شرح كيفية الحسبة عند الإدخال', ''];
  ruleHeaders.forEach((h, c) => {
    if (c === 3) return;
    const ref = XLSX.utils.encode_cell({ r: gRow, c });
    formatCell(wsGuide, ref, h, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
      fill: { fgColor: { rgb: 'B45309' } }, // Amber header
      alignment: { horizontal: 'center', vertical: 'center' },
      border: getBorder(COLORS.BORDER_HEADER),
    });
  });
  gRow++;

  const ruleGuideRows = [
    ['قاعدة 15 يوم (منتصف الشهر)', 'mid_month_15', 'إذا بدأ الأصل من 1 إلى 15 من الشهر يحسب إهلاك الشهر نفسه. وإذا بدأ من 16 إلى نهاية الشهر يضاف كأصل فقط ويبدأ إهلاكه من الشهر التالي.'],
    ['نفس شهر التشغيل', 'same_month', 'يبدأ احتساب إهلاك الشهر كاملاً بغض النظر عن يوم التشغيل.'],
    ['الشهر التالي دائماً', 'next_month', 'يبدأ الإهلاك دائماً من اليوم الأول للشهر التالي لتاريخ التشغيل.'],
  ];

  ruleGuideRows.forEach((rVals) => {
    rVals.forEach((val, c) => {
      const ref = XLSX.utils.encode_cell({ r: gRow, c });
      formatCell(wsGuide, ref, val, {
        font: { name: 'Arial', sz: 9.5, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: gRow % 2 === 1 ? COLORS.ZEBRA_BG : COLORS.WHITE } },
        alignment: { horizontal: c === 0 || c === 2 ? 'right' : 'center', vertical: 'center' },
        border: getBorder(COLORS.BORDER_LIGHT),
      });
    });
    gRow++;
  });

  wsGuide['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: gRow - 1, c: 3 } });
  wsGuide['!views'] = [{ RTL: true }];
  wsGuide['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
  ];
  wsGuide['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 55 },
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, wsGuide, 'دليل_الخيارات_المعتمدة');

  const outName = mode === 'with_sample' 
    ? 'نموذج_استيراد_الأصول_مع_أمثلة_استرشادية.xlsx' 
    : 'نموذج_استيراد_الأصول_فارغ.xlsx';

  saveWorkbookSafely(wb, outName);
}

/**
 * Robust date normalizer supporting Excel serial numbers, ISO strings, and slash formats
 */
function normalizeDate(raw: any): string {
  if (!raw) return new Date().toISOString().split('T')[0];

  // If already YYYY-MM-DD
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }

  // If Excel numeric serial date (e.g. 45300)
  if (typeof raw === 'number' || (!isNaN(Number(raw)) && Number(raw) > 30000 && Number(raw) < 70000)) {
    const num = Number(raw);
    const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  // If Date object
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().split('T')[0];
  }

  // String formats: DD/MM/YYYY or DD-MM-YYYY
  const str = String(raw).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Standard JS parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parses an Excel or CSV file and converts it into Asset objects
 * Intelligently recognizes Arabic titles, synonyms, English headers, and clean formats.
 */
export async function parseExcelImport(file: File, categories: AssetCategory[]): Promise<{
  success: boolean;
  assets: Asset[];
  errors: string[];
  totalRead: number;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse sheet to rows (header: 1 returns 2D array of rows)
        const rawJson = XLSX.utils.sheet_to_json<any[]>(worksheet, { defval: '', header: 1 });

        if (!rawJson || rawJson.length === 0) {
          resolve({
            success: false,
            assets: [],
            errors: ['الملف فارغ أو لا يحتوي على صفوف صالحة.'],
            totalRead: 0,
          });
          return;
        }

        // Find the header row (the first row containing 'اسم الأصل' or 'Asset Name' or 'الكود' or 'الأصل')
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
          const rowStr = rawJson[i].map((c) => String(c || '').toLowerCase()).join(' ');
          if (rowStr.includes('اسم') || rowStr.includes('أصل') || rowStr.includes('اصل') || rowStr.includes('name') || rowStr.includes('code') || rowStr.includes('تكلفة')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0; // fallback to row 0
        }

        const rawHeaders = rawJson[headerRowIndex].map((h) => String(h || '').trim());
        const dataRows = rawJson.slice(headerRowIndex + 1);

        const validAssets: Asset[] = [];
        const errors: string[] = [];

        // Category dictionary
        const categoryMapByName = new Map<string, string>();
        categories.forEach((c) => {
          categoryMapByName.set(c.name.trim().toLowerCase(), c.id);
          categoryMapByName.set(c.nameEn.trim().toLowerCase(), c.id);
          categoryMapByName.set(c.id.toLowerCase(), c.id);
        });

        // Helper to get value for column by synonyms
        const getRowVal = (rowArray: any[], synonyms: string[]): string => {
          for (const syn of synonyms) {
            const cleanSyn = syn.trim().toLowerCase();
            const colIdx = rawHeaders.findIndex((h) => {
              const cleanHeader = h.trim().toLowerCase();
              return cleanHeader.includes(cleanSyn) || cleanSyn.includes(cleanHeader);
            });
            if (colIdx !== -1 && rowArray[colIdx] !== undefined && rowArray[colIdx] !== null) {
              const val = String(rowArray[colIdx]).trim();
              if (val) return val;
            }
          }
          return '';
        };

        dataRows.forEach((row, index) => {
          const rowNum = headerRowIndex + index + 2;

          // Skip completely empty rows
          if (!row || row.every((c: any) => c === '' || c === undefined || c === null)) {
            return;
          }

          const name = getRowVal(row, ['اسم الأصل', 'اسم الاصل', 'الأصل', 'الاصل', 'Asset Name', 'Name', 'Description']);
          if (!name) {
            // If it's just notes or blank, skip
            return;
          }

          const code = getRowVal(row, ['كود الأصل', 'كود الاصل', 'الكود', 'رقم الأصل', 'Asset Code', 'Code', 'Tag']) ||
            `AST-${Math.floor(1000 + Math.random() * 9000)}`;

          // Category match
          const catInput = getRowVal(row, ['تصنيف', 'فئة', 'نوع الأصل', 'Category', 'Asset Category']);
          let matchedCatId = 'machinery';
          if (catInput) {
            const lowerCat = catInput.toLowerCase();
            for (const [k, v] of categoryMapByName.entries()) {
              if (lowerCat.includes(k) || k.includes(lowerCat)) {
                matchedCatId = v;
                break;
              }
            }
          }

          // Department
          const department = getRowVal(row, ['الإدارة', 'القسم', 'إدارة', 'قسم', 'Department', 'Dept']) || 'الإدارة العامة';

          // Numbers (strip commas, spaces, currency symbols)
          const cleanNum = (str: string): number => {
            if (!str) return 0;
            const cleaned = str.replace(/[^\d.-]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
          };

          const purchaseCost = cleanNum(getRowVal(row, ['تكلفة الشراء الأصلية', 'تكلفة الشراء', 'التكلفة', 'سعر الشراء', 'Cost', 'Purchase Cost', 'Price']));
          const additionalCosts = cleanNum(getRowVal(row, ['تكاليف إضافية', 'مصاريف إضافية', 'نقل وتركيب', 'Additional Costs', 'Extra']));
          const salvageValue = cleanNum(getRowVal(row, ['قيمة الخردة', 'الخردة', 'النفاية', 'Salvage Value', 'Scrap']));
          const usefulLifeYears = cleanNum(getRowVal(row, ['العمر الإنتاجي', 'العمر', 'Useful Life', 'Life Years', 'Years'])) || 5;

          // Dates
          const rawPurchaseDate = getRowVal(row, ['تاريخ الشراء', 'Purchase Date', 'الشراء']);
          const purchaseDate = normalizeDate(rawPurchaseDate);

          const rawInServiceDate = getRowVal(row, ['تاريخ بدء التشغيل', 'تاريخ التشغيل', 'تاريخ بدء الاستخدام', 'In-Service Date', 'Start Date']);
          const inServiceDate = rawInServiceDate ? normalizeDate(rawInServiceDate) : purchaseDate;

          // Depreciation Method
          const methodInput = getRowVal(row, ['طريقة الإهلاك', 'طريقة الاهلاك', 'Depreciation Method', 'Method']).toLowerCase();
          let method: Asset['depreciationMethod'] = 'straight_line';
          if (methodInput.includes('مضاعف') || methodInput.includes('double') || methodInput === 'double_declining') {
            method = 'double_declining';
          } else if (methodInput.includes('150') || methodInput === 'declining_150') {
            method = 'declining_150';
          } else if (methodInput.includes('سنين') || methodInput.includes('سنوات') || methodInput.includes('syd') || methodInput === 'sum_of_years') {
            method = 'sum_of_years';
          } else if (methodInput.includes('وحدات') || methodInput.includes('production') || methodInput === 'units_of_production') {
            method = 'units_of_production';
          }

          // 15-Day Mid-Month Start Rule
          const ruleInput = getRowVal(row, ['سياسة بدء الإهلاك', 'قاعدة 15 يوم', 'قاعدة منتصف الشهر', 'Start Rule', 'Rule']).toLowerCase();
          let startDepreciationRule: Asset['startDepreciationRule'] = 'mid_month_15'; // Default to user's 15-day rule
          if (ruleInput.includes('same') || ruleInput.includes('نفس')) {
            startDepreciationRule = 'same_month';
          } else if (ruleInput.includes('next') || ruleInput.includes('تال') || ruleInput.includes('التالي')) {
            startDepreciationRule = 'next_month';
          } else if (ruleInput.includes('15') || ruleInput.includes('mid') || ruleInput.includes('منتصف')) {
            startDepreciationRule = 'mid_month_15';
          }

          // Additional optional fields
          const location = getRowVal(row, ['الموقع', 'الفرع', 'Location', 'Branch']);
          const custodian = getRowVal(row, ['الموظف المسؤول', 'المسؤول', 'العهدة', 'Custodian', 'Responsible']);
          const serialNumber = getRowVal(row, ['الرقم التسلسلي', 'سيريال', 'Serial No', 'Serial Number']);
          const supplier = getRowVal(row, ['المورد', 'الشركة البائعة', 'Supplier', 'Vendor']);
          const invoiceNumber = getRowVal(row, ['رقم الفاتورة', 'الفاتورة', 'Invoice']);
          const notes = getRowVal(row, ['ملاحظات', 'Notes', 'Remarks']);
          const totalEstimatedUnits = cleanNum(getRowVal(row, ['إجمالي الوحدات المقدرة', 'Total Estimated Units'])) || undefined;
          const producedUnitsToDate = cleanNum(getRowVal(row, ['الوحدات المنتجة حتى الآن', 'Produced Units'])) || undefined;
          const unitOfMeasure = getRowVal(row, ['وحدة القياس', 'Unit of Measure']) || undefined;

          const asset: Asset = {
            id: `ast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            code,
            name,
            category: matchedCatId,
            purchaseDate,
            inServiceDate,
            purchaseCost,
            additionalCosts,
            salvageValue,
            usefulLifeYears,
            depreciationMethod: method,
            startDepreciationRule,
            status: 'active',
            department,
            location,
            custodian,
            serialNumber,
            supplier,
            invoiceNumber,
            notes,
            totalEstimatedUnits,
            producedUnitsToDate,
            unitOfMeasure,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          validAssets.push(asset);
        });

        resolve({
          success: validAssets.length > 0,
          assets: validAssets,
          errors,
          totalRead: validAssets.length,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        resolve({
          success: false,
          assets: [],
          errors: [`حدث خطأ أثناء قراءة ملف الإكسل: ${errorMsg}`],
          totalRead: 0,
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        assets: [],
        errors: ['تعذر قراءة الملف من الجهاز.'],
        totalRead: 0,
      });
    };

    reader.readAsBinaryString(file);
  });
}
