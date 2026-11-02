/**
 * Utility to generate standalone, self-contained, high-fidelity printable HTML documents.
 * This guarantees 100% vector printing/PDF generation with selectable text, crystal-sharp lines,
 * repeating table headers across pages, executive KPI summary cards, and official certification blocks.
 */

export interface PrintableColumn {
  label: string;
  align?: 'right' | 'center' | 'left';
  highlight?: 'amber' | 'emerald' | 'none';
  width?: string;
}

export interface PrintableReportConfig {
  title: string;
  companyName: string;
  currency: string;
  fromDate?: string;
  toDate?: string;
  metaBadges?: string[];
  kpiSummary?: {
    totalCount: number;
    totalCost: number;
    periodExpense: number;
    endingNBV: number;
    beginningNBV?: number;
  };
  columns: PrintableColumn[];
  rows: Array<Array<{ text: string; align?: 'right' | 'center' | 'left'; isBold?: boolean; highlight?: 'amber' | 'emerald' | 'none' }>>;
  totals?: Array<{ text: string; align?: 'right' | 'center' | 'left'; isBold?: boolean; colSpan?: number }>;
  orientation?: 'landscape' | 'portrait';
  colorMode?: 'color' | 'bw';
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num || 0);
}

export function generatePrintableHTMLString(config: PrintableReportConfig): string {
  const {
    title,
    companyName,
    currency,
    fromDate,
    toDate,
    metaBadges = [],
    kpiSummary,
    columns,
    rows,
    totals,
    orientation = 'landscape',
    colorMode = 'color',
  } = config;

  const isColor = colorMode === 'color';
  const currentDate = new Date().toISOString().split('T')[0];
  const refCode = `REP-${currentDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${companyName}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 10mm 8mm 12mm 8mm;
      @bottom-center {
        content: "صفحة " counter(page) " من " counter(pages);
        font-size: 9pt;
        color: #64748b;
      }
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Tajawal", "Cairo", Tahoma, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-size: 11px;
      line-height: 1.4;
    }
    .page-container {
      padding: 16px 20px;
      max-width: 100%;
      margin: 0 auto;
    }
    .no-print {
      margin-bottom: 20px;
      padding: 14px 20px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .no-print-text {
      font-size: 13px;
      color: #334155;
    }
    .no-print-actions {
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 8px 18px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary {
      background: #0284c7;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #0369a1;
    }
    .btn-secondary {
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #f8fafc;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      .page-container {
        padding: 0 !important;
      }
      body {
        background: #ffffff !important;
      }
    }

    /* Official Corporate Financial Header */
    .official-header {
      border-bottom: 2.5px solid ${isColor ? '#0f2942' : '#0f172a'};
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-block h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 900;
      color: ${isColor ? '#0f2942' : '#000000'};
      letter-spacing: -0.5px;
    }
    .company-block .sub {
      margin-top: 3px;
      font-size: 11.5px;
      color: #475569;
      font-weight: 600;
    }
    .company-block .legal-meta {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .meta-block {
      text-align: left;
      font-size: 11px;
      color: #334155;
      line-height: 1.6;
    }
    .meta-block strong {
      color: #0f172a;
      font-family: Courier, monospace;
    }
    .doc-ref {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-family: Courier, monospace;
      font-size: 10px;
      font-weight: bold;
      color: #0369a1;
      margin-bottom: 4px;
    }

    /* Report Title & Scope Badges */
    .title-banner {
      text-align: center;
      margin-bottom: 16px;
      padding: 10px 14px;
      background: ${isColor ? '#f8fafc' : '#ffffff'};
      border: 1px solid ${isColor ? '#e2e8f0' : '#cbd5e1'};
      border-radius: 8px;
    }
    .report-main-title {
      font-size: 17px;
      font-weight: 900;
      color: ${isColor ? '#0369a1' : '#000000'};
      margin: 0 0 6px 0;
    }
    .badge-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 11px;
      color: #475569;
    }
    .badge-bar .badge-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge-bar .separator {
      color: #cbd5e1;
    }

    /* Executive KPI Cards */
    .kpi-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      text-align: right;
    }
    .kpi-card .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-card .kpi-value {
      font-size: 14px;
      font-weight: 800;
      font-family: Courier, monospace;
      color: #0f172a;
    }
    .kpi-card.amber-kpi {
      border-color: ${isColor ? '#f59e0b' : '#cbd5e1'};
      background: ${isColor ? '#fffbeb' : '#ffffff'};
    }
    .kpi-card.amber-kpi .kpi-value {
      color: ${isColor ? '#b45309' : '#000000'};
    }
    .kpi-card.emerald-kpi {
      border-color: ${isColor ? '#10b981' : '#cbd5e1'};
      background: ${isColor ? '#ecfdf5' : '#ffffff'};
    }
    .kpi-card.emerald-kpi .kpi-value {
      color: ${isColor ? '#047857' : '#000000'};
    }

    /* Table Architecture with Multi-Page Header Repeating */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 20px;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    th {
      background-color: ${isColor ? '#0f2942' : '#1e293b'} !important;
      color: #ffffff !important;
      padding: 8px 6px;
      border: 1px solid ${isColor ? '#1e3a5f' : '#475569'};
      font-weight: 800;
      white-space: nowrap;
      text-align: right;
    }
    td {
      padding: 6px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background-color: ${isColor ? '#f8fafc' : '#ffffff'};
    }
    .align-right { text-align: right; }
    .align-center { text-align: center; }
    .align-left { text-align: left; font-family: Courier, monospace; }
    .bold { font-weight: 700; }
    .highlight-amber {
      background-color: ${isColor ? '#fef3c7' : 'transparent'} !important;
      color: ${isColor ? '#92400e' : '#000000'} !important;
      font-weight: 700;
    }
    .highlight-emerald {
      background-color: ${isColor ? '#d1fae5' : 'transparent'} !important;
      color: ${isColor ? '#065f46' : '#000000'} !important;
      font-weight: 700;
    }
    tfoot td {
      background-color: ${isColor ? '#f1f5f9' : '#e2e8f0'} !important;
      font-weight: 800;
      border-top: 2px solid #0f172a;
      border-bottom: 3.5px double #0f172a;
      padding: 8px 6px;
      color: #0f172a;
    }

    /* Certification & Signature Section */
    .certification-block {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1.5px solid #cbd5e1;
    }
    .cert-statement {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 16px;
      text-align: justify;
      line-height: 1.5;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .sig-column {
      flex: 1;
      padding: 10px 14px;
      background: ${isColor ? '#f8fafc' : '#ffffff'};
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 10.5px;
      line-height: 1.9;
    }
    .sig-title {
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .stamp-box {
      margin-top: 12px;
      height: 48px;
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <!-- Screen Actions Toolbar (Hidden in print) -->
    <div class="no-print">
      <div class="no-print-text">
        <strong>تقرير مالي رسمي منسق مقاس A4</strong> — نصوص متجهية حقيقية قابلة للنسخ والبحث مع تكرار الترويسة آلياً على كافة الصفحات.
      </div>
      <div class="no-print-actions">
        <button class="btn btn-primary" onclick="window.print()">🖨️ طباعة فورية / حفظ كـ PDF</button>
        <button class="btn btn-secondary" onclick="window.close()">إغلاق النافذة</button>
      </div>
    </div>

    <!-- Official Corporate Financial Header -->
    <div class="official-header">
      <div class="company-block">
        <h1>${companyName}</h1>
        <div class="sub">الإدارة المالية العامة — قسم حسابات وإهلاك الأصول الثابتة</div>
        <div class="legal-meta">العملة الرسمية المعتمدة: <strong>${currency}</strong> | الجمهورية اليمنية</div>
      </div>
      <div class="meta-block">
        <div><span class="doc-ref">${refCode}</span></div>
        ${fromDate && toDate ? `<div>الفترة المالية: <strong>من ${fromDate} إلى ${toDate}</strong></div>` : ''}
        <div>تاريخ استخراج التقرير: <strong>${currentDate}</strong></div>
      </div>
    </div>

    <!-- Report Main Title Banner -->
    <div class="title-banner">
      <h2 class="report-main-title">${title}</h2>
      <div class="badge-bar">
        <span class="badge-item">إجمالي عدد الأصول: <strong>${rows.length} أصل</strong></span>
        ${metaBadges.map(b => `<span class="separator">•</span><span class="badge-item">${b}</span>`).join('')}
      </div>
    </div>

    <!-- Executive KPI Summary Cards -->
    ${kpiSummary ? `
      <div class="kpi-cards-grid">
        <div class="kpi-card">
          <div class="kpi-label">عدد الأصول المشمولة بالتقرير</div>
          <div class="kpi-value">${kpiSummary.totalCount} أصل</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">إجمالي التكلفة الرأسمالية (التاريخية)</div>
          <div class="kpi-value">${formatNumber(kpiSummary.totalCost)} ${currency}</div>
        </div>
        <div class="kpi-card amber-kpi">
          <div class="kpi-label">مصروف إهلاك الفترة المحددة</div>
          <div class="kpi-value">${formatNumber(kpiSummary.periodExpense)} ${currency}</div>
        </div>
        <div class="kpi-card emerald-kpi">
          <div class="kpi-label">صافي القيمة الدفترية نهاية الفترة</div>
          <div class="kpi-value">${formatNumber(kpiSummary.endingNBV)} ${currency}</div>
        </div>
      </div>
    ` : ''}

    <!-- Official Vector Data Table -->
    <table>
      <thead>
        <tr>
          <th class="align-center" style="width: 28px;">#</th>
          ${columns.map(c => `
            <th class="align-${c.align || 'right'}" style="${c.width ? `width: ${c.width};` : ''}">
              ${c.label}
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((rowCells, rIdx) => `
          <tr>
            <td class="align-center" style="color: #64748b; font-family: Courier, monospace;">${rIdx + 1}</td>
            ${rowCells.map(cell => {
              let cls = `align-${cell.align || 'right'}`;
              if (cell.isBold) cls += ' bold';
              if (cell.highlight === 'amber') cls += ' highlight-amber';
              if (cell.highlight === 'emerald') cls += ' highlight-emerald';
              return `<td class="${cls}">${cell.text}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
      ${totals && totals.length > 0 ? `
        <tfoot>
          <tr>
            ${totals.map(t => {
              let cls = `align-${t.align || 'left'}`;
              if (t.isBold) cls += ' bold';
              return `<td class="${cls}" ${t.colSpan ? `colspan="${t.colSpan}"` : ''}>${t.text}</td>`;
            }).join('')}
          </tr>
        </tfoot>
      ` : ''}
    </table>

    <!-- Official Accounting Certification and Stamp Block -->
    <div class="certification-block">
      <div class="cert-statement">
        نقر بصحة واكتمال بيانات الأصول الموضحة أعلاه، وأنها مطابقة للدفاتر المحاسبية وسجلات الجرد الفعلي وسياسات الإهلاك المعتمدة وفقاً لمعايير المحاسبة والأنظمة المالية المعمول بها.
      </div>
      <div class="signatures-row">
        <div class="sig-column">
          <div class="sig-title">المحاسب المالي المسؤول</div>
          <div>الاسم: _____________________</div>
          <div>التوقيع: ___________________</div>
          <div>التاريخ: ___________________</div>
        </div>
        <div class="sig-column">
          <div class="sig-title">رئيس قسم الأصول والحسابات</div>
          <div>الاسم: _____________________</div>
          <div>التوقيع: ___________________</div>
          <div>التاريخ: ___________________</div>
        </div>
        <div class="sig-column">
          <div class="sig-title">اعتماد المدير المالي وختم المنشأة</div>
          <div>الاسم: _____________________</div>
          <div>التوقيع: ___________________</div>
          <div class="stamp-box">موضع الختم الرسمي للمنشأة</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // In standalone file view, offer print prompt
    window.addEventListener('DOMContentLoaded', function() {
      // Auto-focus document
      window.focus();
    });
  </script>
</body>
</html>`;
}

export function printReportDirectly(config: PrintableReportConfig): void {
  try {
    const htmlContent = generatePrintableHTMLString(config);
    let iframe = document.getElementById('report-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'report-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print blocked, downloading standalone A4 HTML instead:', e);
          downloadPrintableHTMLReport(config);
        }
      }, 500);
    } else {
      downloadPrintableHTMLReport(config);
    }
  } catch (err) {
    console.warn('Error in printReportDirectly:', err);
    downloadPrintableHTMLReport(config);
  }
}

export function openReportInNewWindow(config: PrintableReportConfig): void {
  try {
    const htmlContent = generatePrintableHTMLString(config);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      downloadPrintableHTMLReport(config);
    }
  } catch (e) {
    downloadPrintableHTMLReport(config);
  }
}

export function downloadPrintableHTMLReport(config: PrintableReportConfig): void {
  const htmlContent = generatePrintableHTMLString(config);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const cleanName = (config.title || 'تقرير_الأصول_المالي')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const filename = `${cleanName}_A4.html`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

