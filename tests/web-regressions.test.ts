import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePeriodDepreciation, calculateSchedule, getAnnualDepreciationRatePercent, getAssetDepreciationInputMode, getCurrentAssetValuation, getEquivalentUsefulLifeYears, isValidAnnualDepreciationRate } from '../src/utils/depreciation';
import { generatePrintableHTMLString } from '../src/utils/printHtml';
import { getStoredAssets, restoreBackupData } from '../src/utils/storage';
import { ALL_CUSTOM_REPORT_COLUMNS } from '../src/utils/customReportConfig';
import { exportAssetsToExcel, parseExcelImport } from '../src/utils/excel';
import XLSX from 'xlsx-js-style';
import type { Asset } from '../src/types/asset';

const baseAsset: Asset = {
  id: 'asset-1',
  code: 'AST-001',
  name: 'أصل اختبار',
  category: 'vehicles',
  purchaseDate: '2024-07-15',
  inServiceDate: '2024-07-15',
  purchaseCost: 12000,
  additionalCosts: 0,
  salvageValue: 2000,
  usefulLifeYears: 5,
  depreciationMethod: 'straight_line',
  startDepreciationRule: 'mid_month_15',
  status: 'active',
  location: 'المقر',
  department: 'الإدارة العامة',
  custodian: 'مسؤول',
  createdAt: '2024-07-15T00:00:00.000Z',
  updatedAt: '2024-07-15T00:00:00.000Z',
};

test('date-based valuation prorates depreciation by months within calendar years', () => {
  const yearEnd = getCurrentAssetValuation(baseAsset, new Date('2024-12-31T12:00:00'));
  const nextJune = getCurrentAssetValuation(baseAsset, new Date('2025-06-30T12:00:00'));
  assert.equal(Math.round(yearEnd.accumulatedDepreciation), 1000);
  assert.equal(Math.round(nextJune.accumulatedDepreciation), 2000);
});

test('a disposal snapshot does not affect valuations before the disposal date', () => {
  const disposed: Asset = {
    ...baseAsset,
    status: 'disposed',
    disposal: {
      disposalDate: '2025-06-30',
      disposalType: 'sale',
      salePrice: 11000,
      disposalCosts: 0,
      bookValueAtDisposal: 10000,
      accumulatedAtDisposal: 2000,
      gainLoss: 1000,
    },
  };
  const before = getCurrentAssetValuation(disposed, new Date('2025-01-01T12:00:00'));
  assert.ok(before.netBookValue > 10000);
  assert.equal(getCurrentAssetValuation(disposed, new Date('2025-06-30T12:00:00')).netBookValue, 10000);
});

test('period depreciation includes the first month and closes a disposed asset at zero', () => {
  const disposed: Asset = {
    ...baseAsset,
    status: 'disposed',
    disposal: {
      disposalDate: '2025-06-30',
      disposalType: 'sale',
      salePrice: 11000,
      disposalCosts: 0,
      bookValueAtDisposal: 10000,
      accumulatedAtDisposal: 2000,
      gainLoss: 1000,
    },
  };
  const report = calculatePeriodDepreciation(disposed, '2025-01-01', '2025-12-31');
  assert.equal(Math.round(report.periodExpense), 1000);
  assert.equal(report.endingBookValue, 0);
  assert.equal(report.statusInPeriod, 'disposed_in_period');
});

test('printable HTML escapes user-controlled labels and values', () => {
  const html = generatePrintableHTMLString({
    title: '<script>alert(1)</script>',
    companyName: 'A & B',
    currency: '<x>',
    columns: [{ label: '<img src=x onerror=1>' }],
    rows: [[{ text: '</td><script>boom()</script>' }]],
  });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;/td&gt;&lt;script&gt;boom()&lt;/script&gt;'));
  assert.ok(!html.includes('<script>boom()'));
});

test('an explicitly empty browser register remains empty after reload', () => {
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => '[]', setItem: () => undefined },
  });
  try {
    assert.deepEqual(getStoredAssets(), []);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  }
});

test('straight-line rate expense uses purchase cost plus additions less capped salvage and prorates the first year', () => {
  const rateAsset: Asset = {
    ...baseAsset,
    purchaseCost: 10000,
    additionalCosts: 2000,
    salvageValue: 2000,
    depreciationInputMode: 'rate',
    annualDepreciationRate: 20,
  };
  const schedule = calculateSchedule(rateAsset);
  assert.equal(schedule[0].depreciationExpense, 1000); // 10,000 × 20% × 6/12
  assert.equal(schedule[1].depreciationExpense, 2000);
  assert.equal(schedule[0].ratePercent, 20);
});

test('rate schedule closes to salvage by adjusting the final period', () => {
  const rateAsset: Asset = {
    ...baseAsset,
    inServiceDate: '2024-01-01',
    startDepreciationRule: 'same_month',
    purchaseCost: 1000,
    additionalCosts: 300,
    salvageValue: 200,
    depreciationInputMode: 'rate',
    annualDepreciationRate: 30,
  };
  const schedule = calculateSchedule(rateAsset);
  assert.equal(schedule.length, 4);
  assert.equal(schedule[0].depreciationExpense, 330);
  assert.equal(schedule[3].depreciationExpense, 110);
  assert.equal(schedule[3].endingBookValue, 200);
  assert.equal(schedule.reduce((sum, row) => sum + row.depreciationExpense, 0), 1100);
});

test('invalid, non-finite, and out-of-range annual percentages are rejected and never depreciated', () => {
  assert.equal(isValidAnnualDepreciationRate(0), false);
  assert.equal(isValidAnnualDepreciationRate(0.1), true);
  assert.equal(isValidAnnualDepreciationRate(100), true);
  assert.equal(isValidAnnualDepreciationRate(100.01), false);
  assert.equal(isValidAnnualDepreciationRate(Number.POSITIVE_INFINITY), false);
  const invalid = calculateSchedule({ ...baseAsset, depreciationInputMode: 'rate', annualDepreciationRate: Number.NaN });
  assert.equal(invalid[0].depreciationExpense, 0);
});

test('legacy assets without a basis remain years-based and are not migrated on read', () => {
  assert.equal(baseAsset.depreciationInputMode, undefined);
  assert.equal(getAssetDepreciationInputMode(baseAsset), 'years');
  assert.equal(calculateSchedule(baseAsset)[0].depreciationExpense, 1000);
  const serialized = JSON.parse(JSON.stringify(baseAsset)) as Asset;
  assert.equal(serialized.depreciationInputMode, undefined);
});

test('report rate disclosure uses the selected straight-line rate and omits rates for declining methods', () => {
  const rateAsset: Asset = { ...baseAsset, depreciationInputMode: 'rate', annualDepreciationRate: 20 };
  assert.equal(getAnnualDepreciationRatePercent(rateAsset), 20);
  assert.equal(getEquivalentUsefulLifeYears(rateAsset), 5);
  const declining = { ...rateAsset, depreciationMethod: 'double_declining' as const };
  assert.equal(getAnnualDepreciationRatePercent(declining), undefined);
  const rateColumn = ALL_CUSTOM_REPORT_COLUMNS.find((column) => column.id === 'depreciationRate');
  assert.equal(rateColumn?.getValue(declining, {}, new Map()).display, '—');
  assert.equal(rateColumn?.getValue(rateAsset, {}, new Map()).display, '20.0%');
});

test('CSV/XLSX import accepts rate aliases and treats files without new columns as years mode', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
  const readCsv = async (csv: string) => {
    class MockFileReader {
      result: string | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsBinaryString() {
        this.result = csv;
        this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
      }
    }
    Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: MockFileReader });
    return parseExcelImport({} as File, []);
  };
  try {
    const current = await readCsv('Asset Name,Cost,Additional Costs,Salvage Value,Useful Life,Method,Basis Mode,Annual Depreciation Rate\nRate asset,10000,2000,2000,5,straight_line,rate,20');
    assert.equal(current.success, true);
    assert.equal(current.assets[0].depreciationInputMode, 'rate');
    assert.equal(current.assets[0].annualDepreciationRate, 20);
    assert.equal(current.assets[0].usefulLifeYears, 5);

    const legacy = await readCsv('Asset Name,Cost,Useful Life,Method\nOld asset,12000,6,straight_line');
    assert.equal(legacy.success, true);
    assert.equal(legacy.assets[0].depreciationInputMode, undefined);
    assert.equal(legacy.assets[0].usefulLifeYears, 6);

    const invalid = await readCsv('Asset Name,Cost,Basis Mode,Annual Depreciation Rate\nBad rate,10000,rate,101');
    assert.equal(invalid.success, false);
    assert.match(invalid.errors.join(' '), /0\.1 إلى 100/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'FileReader', original);
    else delete (globalThis as { FileReader?: unknown }).FileReader;
  }
});

test('asset register Excel export includes mode, annual rate, and equivalent life', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const originalSetTimeout = globalThis.setTimeout;
  let exportedBlob: Blob | undefined;
  const body = { appendChild: () => undefined, removeChild: () => undefined, contains: () => false };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body, createElement: () => ({ click: () => undefined, style: {}, href: '', download: '' }) },
  });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (blob: Blob) => { exportedBlob = blob; return 'blob:test'; } });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
  globalThis.setTimeout = (() => 0) as unknown as typeof setTimeout;
  try {
    const rateAsset: Asset = { ...baseAsset, depreciationInputMode: 'rate', annualDepreciationRate: 20 };
    exportAssetsToExcel([rateAsset], []);
    assert.ok(exportedBlob);
    const workbook = XLSX.read(new Uint8Array(await exportedBlob!.arrayBuffer()), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    assert.ok(rows[3].includes('أساس إدخال القسط الثابت'));
    assert.ok(rows[3].includes('معدل الإهلاك السنوي من القيمة القابلة للإهلاك %'));
    assert.equal(rows[4][11], 5);
    assert.equal(rows[4][12], 'نسبة سنوية من القيمة القابلة للإهلاك');
    assert.equal(rows[4][13], '20%');
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as { document?: unknown }).document;
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else delete (URL as { createObjectURL?: unknown }).createObjectURL;
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('backup restore keeps new rate fields verbatim and leaves legacy basis absent', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) },
  });
  try {
    const oldAsset = { ...baseAsset };
    const rateAsset: Asset = { ...baseAsset, id: 'rate-asset', depreciationInputMode: 'rate', annualDepreciationRate: 12.5 };
    const restored = restoreBackupData({ assets: [oldAsset, rateAsset] } as any);
    assert.equal(restored.success, true);
    const loaded = getStoredAssets();
    assert.equal(loaded[0].depreciationInputMode, undefined);
    assert.equal(loaded[1].depreciationInputMode, 'rate');
    assert.equal(loaded[1].annualDepreciationRate, 12.5);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
