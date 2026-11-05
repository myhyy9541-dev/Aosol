import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePeriodDepreciation, getCurrentAssetValuation } from '../src/utils/depreciation';
import { generatePrintableHTMLString } from '../src/utils/printHtml';
import { getStoredAssets } from '../src/utils/storage';
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
