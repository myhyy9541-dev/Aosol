import { Asset, DepreciationScheduleRow } from '../types/asset';

/**
 * Returns total capitalized cost (purchase cost + additional capitalizable expenses)
 */
export function getTotalCost(asset: Asset): number {
  return (Number(asset.purchaseCost) || 0) + (Number(asset.additionalCosts) || 0);
}

export function getAssetDepreciationInputMode(asset: Asset): 'years' | 'rate' {
  return asset.depreciationInputMode === 'rate' ? 'rate' : 'years';
}

export function isValidAnnualDepreciationRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0.1 && rate <= 100;
}

export function getEquivalentUsefulLifeYears(asset: Asset): number {
  if (asset.depreciationMethod === 'straight_line' && getAssetDepreciationInputMode(asset) === 'rate' && isValidAnnualDepreciationRate(asset.annualDepreciationRate)) {
    return 100 / asset.annualDepreciationRate;
  }
  return Number(asset.usefulLifeYears) || 0;
}

export function getAnnualDepreciationRatePercent(asset: Asset): number | undefined {
  if (asset.depreciationMethod !== 'straight_line') return undefined;
  if (getAssetDepreciationInputMode(asset) === 'rate') {
    return isValidAnnualDepreciationRate(asset.annualDepreciationRate) ? asset.annualDepreciationRate : undefined;
  }
  const years = Number(asset.usefulLifeYears);
  return Number.isFinite(years) && years > 0 ? 100 / years : undefined;
}

export function getDepreciationInputModeLabel(asset: Asset): string {
  if (asset.depreciationMethod !== 'straight_line') return '—';
  return getAssetDepreciationInputMode(asset) === 'rate' ? 'نسبة سنوية من القيمة القابلة للإهلاك' : 'عمر بالسنوات';
}

/**
 * Returns the effective date when depreciation expense starts based on the 15-day mid-month rule or chosen convention
 */
export function getEffectiveDepreciationStartDate(asset: Asset): Date {
  const inService = asset.inServiceDate ? new Date(asset.inServiceDate) : new Date(asset.purchaseDate || new Date());
  if (isNaN(inService.getTime())) return new Date();

  const rule = asset.startDepreciationRule || 'mid_month_15';
  const day = inService.getDate();
  const year = inService.getFullYear();
  const month = inService.getMonth(); // 0 to 11

  if (rule === 'mid_month_15') {
    // If in-service day is 1 to 15: calculate depreciation in same month
    // If in-service day is 16 to end of month: add as asset, start depreciation in next month
    if (day <= 15) {
      return new Date(year, month, 1);
    } else {
      return new Date(year, month + 1, 1);
    }
  } else if (rule === 'next_month') {
    return new Date(year, month + 1, 1);
  } else {
    // same_month
    return new Date(year, month, 1);
  }
}

/**
 * Generates the full year-by-year depreciation schedule for any asset using standard accounting practices
 */
export function calculateSchedule(asset: Asset): DepreciationScheduleRow[] {
  const totalCost = getTotalCost(asset);
  const rateMode = asset.depreciationMethod === 'straight_line' && getAssetDepreciationInputMode(asset) === 'rate';
  const salvageValue = rateMode
    ? Math.min(Math.max(0, Number(asset.salvageValue) || 0), totalCost)
    : Math.min(Number(asset.salvageValue) || 0, totalCost);
  const depreciableBase = Math.max(0, totalCost - salvageValue);
  const lifeYears = Math.max(1, Number(asset.usefulLifeYears) || 1);

  if (rateMode && !isValidAnnualDepreciationRate(asset.annualDepreciationRate)) {
    return [{
      year: 1,
      periodLabel: 'السنة 1',
      beginningBookValue: totalCost,
      depreciationExpense: 0,
      accumulatedDepreciation: 0,
      endingBookValue: totalCost,
      ratePercent: 0,
    }];
  }

  if (depreciableBase <= 0) {
    return [
      {
        year: 1,
        periodLabel: 'السنة 1',
        beginningBookValue: totalCost,
        depreciationExpense: 0,
        accumulatedDepreciation: 0,
        endingBookValue: totalCost,
        ratePercent: 0,
      },
    ];
  }

  // Parse effective depreciation start date based on 15-day rule
  const effectiveStartDate = getEffectiveDepreciationStartDate(asset);
  const effectiveMonth = effectiveStartDate.getMonth(); // 0 to 11
  const startYear = effectiveStartDate.getFullYear();

  // Months active for depreciation in first fiscal year (Dec 31 fiscal year end)
  const firstYearMonths = Math.max(1, 12 - effectiveMonth);
  const firstYearRatio = firstYearMonths / 12;

  const schedule: DepreciationScheduleRow[] = [];
  let currentBookValue = totalCost;
  let totalAccumulated = 0;

  switch (asset.depreciationMethod) {
    case 'straight_line': {
      const rateFraction = rateMode ? (asset.annualDepreciationRate as number) / 100 : 1 / lifeYears;
      const annualExpense = rateMode ? depreciableBase * rateFraction : depreciableBase / lifeYears;
      let remainingDepreciable = depreciableBase;
      const totalPeriods = rateMode
        ? firstYearRatio < 1
          ? 1 + Math.ceil(1 / rateFraction - firstYearRatio)
          : Math.ceil(1 / rateFraction)
        : firstYearRatio < 1 ? lifeYears + 1 : lifeYears;

      for (let i = 1; i <= totalPeriods; i++) {
        const periodYear = startYear + (i - 1);
        const beginning = currentBookValue;
        let expense = 0;

        if (i === 1 && firstYearRatio < 1) {
          expense = annualExpense * firstYearRatio;
        } else if (i === totalPeriods && firstYearRatio < 1) {
          expense = remainingDepreciable;
        } else {
          expense = annualExpense;
        }

        expense = Math.min(expense, remainingDepreciable);
        expense = Math.min(expense, beginning - salvageValue);
        if (expense < 0) expense = 0;

        totalAccumulated += expense;
        currentBookValue = beginning - expense;
        remainingDepreciable -= expense;

        schedule.push({
          year: i,
          periodLabel: `السنة ${i} (${periodYear})`,
          beginningBookValue: beginning,
          depreciationExpense: expense,
          accumulatedDepreciation: totalAccumulated,
          endingBookValue: currentBookValue,
          ratePercent: rateMode ? rateFraction * 100 : (1 / lifeYears) * 100,
        });

        if (remainingDepreciable <= 0.001) break;
      }
      break;
    }

    case 'double_declining':
    case 'declining_150': {
      const multiplier = asset.depreciationMethod === 'double_declining' ? 2 : 1.5;
      const rate = multiplier / lifeYears;
      const maxYears = lifeYears + (firstYearRatio < 1 ? 1 : 0);

      for (let i = 1; i <= maxYears; i++) {
        const periodYear = startYear + (i - 1);
        const beginning = currentBookValue;
        let expense = 0;

        if (i === 1 && firstYearRatio < 1) {
          expense = beginning * rate * firstYearRatio;
        } else {
          expense = beginning * rate;
        }

        // Must never depreciate below salvage value
        if (beginning - expense < salvageValue) {
          expense = Math.max(0, beginning - salvageValue);
        }

        // In final year, clean up any remaining depreciable base if book value > salvage
        if (i === maxYears && currentBookValue - expense > salvageValue) {
          expense = Math.max(0, beginning - salvageValue);
        }

        totalAccumulated += expense;
        currentBookValue = beginning - expense;

        schedule.push({
          year: i,
          periodLabel: `السنة ${i} (${periodYear})`,
          beginningBookValue: beginning,
          depreciationExpense: expense,
          accumulatedDepreciation: totalAccumulated,
          endingBookValue: currentBookValue,
          ratePercent: rate * 100,
        });

        if (currentBookValue <= salvageValue + 0.01) break;
      }
      break;
    }

    case 'sum_of_years': {
      const sumOfYears = (lifeYears * (lifeYears + 1)) / 2;
      let remainingDepreciable = depreciableBase;

      for (let i = 1; i <= lifeYears; i++) {
        const periodYear = startYear + (i - 1);
        const beginning = currentBookValue;
        const remainingYears = lifeYears - i + 1;
        const rateFraction = remainingYears / sumOfYears;
        let expense = depreciableBase * rateFraction;

        expense = Math.min(expense, remainingDepreciable);
        expense = Math.min(expense, beginning - salvageValue);
        if (expense < 0) expense = 0;

        totalAccumulated += expense;
        currentBookValue = beginning - expense;
        remainingDepreciable -= expense;

        schedule.push({
          year: i,
          periodLabel: `السنة ${i} (${periodYear})`,
          beginningBookValue: beginning,
          depreciationExpense: expense,
          accumulatedDepreciation: totalAccumulated,
          endingBookValue: currentBookValue,
          ratePercent: rateFraction * 100,
        });
      }
      break;
    }

    case 'units_of_production': {
      const totalUnits = Math.max(1, Number(asset.totalEstimatedUnits) || 10000);
      const unitRate = depreciableBase / totalUnits;
      // Spread projected across years
      const avgUnitsPerYear = totalUnits / lifeYears;
      let unitsLeft = totalUnits;

      for (let i = 1; i <= lifeYears; i++) {
        const periodYear = startYear + (i - 1);
        const beginning = currentBookValue;
        const periodUnits = Math.min(unitsLeft, Math.round(avgUnitsPerYear));
        let expense = periodUnits * unitRate;

        expense = Math.min(expense, beginning - salvageValue);
        if (expense < 0) expense = 0;

        totalAccumulated += expense;
        currentBookValue = beginning - expense;
        unitsLeft -= periodUnits;

        schedule.push({
          year: i,
          periodLabel: `السنة ${i} (${periodYear})`,
          beginningBookValue: beginning,
          depreciationExpense: expense,
          accumulatedDepreciation: totalAccumulated,
          endingBookValue: currentBookValue,
          ratePercent: (periodUnits / totalUnits) * 100,
          unitsProduced: periodUnits,
        });
      }
      break;
    }
  }

  return schedule;
}

/**
 * Calculates current accumulated depreciation and net book value as of today
 */
export function getCurrentAssetValuation(asset: Asset, asOfDate: Date = new Date()) {
  const totalCost = getTotalCost(asset);
  const rateMode = asset.depreciationMethod === 'straight_line' && getAssetDepreciationInputMode(asset) === 'rate';
  const salvageValue = rateMode
    ? Math.min(Math.max(0, Number(asset.salvageValue) || 0), totalCost)
    : Math.min(Number(asset.salvageValue) || 0, totalCost);
  const depreciableBase = Math.max(0, totalCost - salvageValue);

  // Apply the disposal snapshot only on/after its effective date. Historical
  // reports before disposal must continue to value the asset as active.
  const disposalDate = asset.disposal?.disposalDate ? new Date(`${asset.disposal.disposalDate.slice(0, 10)}T00:00:00`) : null;
  if (asset.status === 'disposed' && asset.disposal && disposalDate && !isNaN(disposalDate.getTime()) && asOfDate >= disposalDate) {
    const bookVal = asset.disposal.bookValueAtDisposal;
    const acc = asset.disposal.accumulatedAtDisposal;
    return {
      totalCost,
      accumulatedDepreciation: acc,
      netBookValue: bookVal,
      currentYearExpense: 0,
      depreciatedPercent: totalCost > 0 ? (acc / totalCost) * 100 : 0,
      isFullyDepreciated: bookVal <= salvageValue + 0.01,
    };
  }

  // If units of production and actual produced units to date provided
  if (asset.depreciationMethod === 'units_of_production' && asset.totalEstimatedUnits && asset.producedUnitsToDate !== undefined) {
    const totalUnits = Math.max(1, asset.totalEstimatedUnits);
    const produced = Math.min(totalUnits, Number(asset.producedUnitsToDate) || 0);
    const unitRate = depreciableBase / totalUnits;
    const acc = Math.min(depreciableBase, produced * unitRate);
    const nbv = Math.max(salvageValue, totalCost - acc);

    return {
      totalCost,
      accumulatedDepreciation: acc,
      netBookValue: nbv,
      currentYearExpense: unitRate * (produced / Math.max(1, asset.usefulLifeYears || 1)),
      depreciatedPercent: totalCost > 0 ? (acc / totalCost) * 100 : 0,
      isFullyDepreciated: nbv <= salvageValue + 0.01,
    };
  }

  // Date-based calculation
  const inService = asset.inServiceDate ? new Date(asset.inServiceDate) : new Date(asset.purchaseDate || new Date());
  if (isNaN(inService.getTime()) || inService > asOfDate) {
    return {
      totalCost,
      accumulatedDepreciation: 0,
      netBookValue: totalCost,
      currentYearExpense: 0,
      depreciatedPercent: 0,
      isFullyDepreciated: false,
    };
  }

  // Effective depreciation start date respecting the 15-day rule
  const effectiveStart = getEffectiveDepreciationStartDate(asset);
  if (asOfDate < effectiveStart) {
    // Asset is added to balance sheet, but depreciation starts in the following month
    return {
      totalCost,
      accumulatedDepreciation: 0,
      netBookValue: totalCost,
      currentYearExpense: 0,
      depreciatedPercent: 0,
      isFullyDepreciated: false,
    };
  }

  const schedule = calculateSchedule(asset);
  if (schedule.length === 0) {
    return {
      totalCost,
      accumulatedDepreciation: 0,
      netBookValue: totalCost,
      currentYearExpense: 0,
      depreciatedPercent: 0,
      isFullyDepreciated: false,
    };
  }

  let accumulated = 0;
  let currentYearExpense = 0;
  const startMonth = effectiveStart.getMonth();
  for (let i = 0; i < schedule.length; i++) {
    const periodYear = effectiveStart.getFullYear() + i;
    const periodStartMonth = i === 0 ? startMonth : 0;
    const periodMonths = 12 - periodStartMonth;
    if (asOfDate.getFullYear() < periodYear || (asOfDate.getFullYear() === periodYear && asOfDate.getMonth() < periodStartMonth)) break;
    const elapsedMonths = asOfDate.getFullYear() > periodYear
      ? periodMonths
      : Math.min(periodMonths, asOfDate.getMonth() - periodStartMonth + 1);
    const fraction = Math.max(0, elapsedMonths / periodMonths);
    const rowExpense = schedule[i].depreciationExpense;
    accumulated += rowExpense * fraction;
    if (asOfDate.getFullYear() === periodYear) {
      currentYearExpense = rowExpense;
      break;
    }
  }

  accumulated = Math.min(accumulated, depreciableBase);
  accumulated = Math.max(0, accumulated);
  const netBookValue = Math.max(salvageValue, totalCost - accumulated);
  const isFullyDepreciated = netBookValue <= salvageValue + 0.01 || accumulated >= depreciableBase - 0.01;

  return {
    totalCost,
    accumulatedDepreciation: accumulated,
    netBookValue,
    currentYearExpense,
    depreciatedPercent: totalCost > 0 ? (accumulated / totalCost) * 100 : 0,
    isFullyDepreciated,
  };
}

/**
 * Calculates Net Gain or Loss on Asset Disposal
 */
export function calculateDisposalGainLoss(
  totalCost: number,
  accumulatedDepreciation: number,
  salePrice: number,
  disposalCosts: number
): { bookValue: number; netProceeds: number; gainLoss: number; isGain: boolean } {
  const bookValue = Math.max(0, totalCost - accumulatedDepreciation);
  const netProceeds = (Number(salePrice) || 0) - (Number(disposalCosts) || 0);
  const gainLoss = netProceeds - bookValue;
  return {
    bookValue,
    netProceeds,
    gainLoss,
    isGain: gainLoss >= 0,
  };
}

export interface PeriodDepreciationResult {
  assetId: string;
  assetCode: string;
  assetName: string;
  category: string;
  department: string;
  startDepreciationRule: string;
  totalCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: string;
  inServiceDate: string;
  beginningBookValue: number;
  periodExpense: number;
  accumulatedAtEnd: number;
  endingBookValue: number;
  statusInPeriod: 'active' | 'acquired_in_period' | 'disposed_in_period' | 'disposed_before_period' | 'fully_depreciated' | 'not_yet_in_service';
  depreciationRatePercent?: number;
}

/**
 * Calculates exact depreciation incurred within an arbitrary custom period (fromDate to toDate)
 */
export function calculatePeriodDepreciation(
  asset: Asset,
  fromDateStr: string,
  toDateStr: string
): PeriodDepreciationResult {
  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);
  const totalCost = getTotalCost(asset);
  const rateMode = asset.depreciationMethod === 'straight_line' && getAssetDepreciationInputMode(asset) === 'rate';
  const salvageValue = rateMode
    ? Math.min(Math.max(0, Number(asset.salvageValue) || 0), totalCost)
    : Math.min(Number(asset.salvageValue) || 0, totalCost);
  const inService = asset.inServiceDate ? new Date(asset.inServiceDate) : new Date(asset.purchaseDate || new Date());

  // If asset in-service is after the target period
  if (inService > toDate) {
    return {
      assetId: asset.id,
      assetCode: asset.code,
      assetName: asset.name,
      category: asset.category,
      department: asset.department || 'غير محدد',
      startDepreciationRule: asset.startDepreciationRule || 'mid_month_15',
      totalCost,
      salvageValue,
      usefulLifeYears: asset.usefulLifeYears,
      depreciationMethod: asset.depreciationMethod,
      inServiceDate: asset.inServiceDate || asset.purchaseDate,
      beginningBookValue: totalCost,
      periodExpense: 0,
      accumulatedAtEnd: 0,
      endingBookValue: totalCost,
      statusInPeriod: 'not_yet_in_service',
      depreciationRatePercent: 0,
    };
  }

  // If asset was disposed before the period started
  if (asset.status === 'disposed' && asset.disposal) {
    const dispDate = new Date(asset.disposal.disposalDate);
    if (dispDate < fromDate) {
      return {
        assetId: asset.id,
        assetCode: asset.code,
        assetName: asset.name,
        category: asset.category,
        department: asset.department || 'غير محدد',
        startDepreciationRule: asset.startDepreciationRule || 'mid_month_15',
        totalCost,
        salvageValue,
        usefulLifeYears: asset.usefulLifeYears,
        depreciationMethod: asset.depreciationMethod,
        inServiceDate: asset.inServiceDate || asset.purchaseDate,
        beginningBookValue: 0,
        periodExpense: 0,
        accumulatedAtEnd: asset.disposal.accumulatedAtDisposal,
        endingBookValue: 0,
        statusInPeriod: 'disposed_before_period',
        depreciationRatePercent: 0,
      };
    }
  }

  // Opening balance is measured the day before the requested period begins.
  const dayBeforePeriod = new Date(fromDate);
  dayBeforePeriod.setDate(dayBeforePeriod.getDate() - 1);
  const valStart = getCurrentAssetValuation(asset, dayBeforePeriod);

  // Calculate valuation at end of period
  let valEnd: { netBookValue: number; accumulatedDepreciation: number; isFullyDepreciated: boolean };
  if (asset.status === 'disposed' && asset.disposal) {
    const dispDate = new Date(asset.disposal.disposalDate);
    if (dispDate <= toDate) {
      valEnd = {
        netBookValue: asset.disposal.bookValueAtDisposal,
        accumulatedDepreciation: asset.disposal.accumulatedAtDisposal,
        isFullyDepreciated: false,
      };
    } else {
      valEnd = getCurrentAssetValuation(asset, toDate);
    }
  } else {
    valEnd = getCurrentAssetValuation(asset, toDate);
  }

  const periodExpense = Math.max(0, valEnd.accumulatedDepreciation - valStart.accumulatedDepreciation);
  const beginningBookValue = valStart.netBookValue;
  const isDisposedInPeriod = asset.status === 'disposed' && !!asset.disposal && new Date(asset.disposal.disposalDate) >= fromDate && new Date(asset.disposal.disposalDate) <= toDate;
  const endingBookValue = isDisposedInPeriod ? 0 : Math.max(salvageValue, beginningBookValue - periodExpense);

  let statusInPeriod: PeriodDepreciationResult['statusInPeriod'] = 'active';
  if (inService >= fromDate && inService <= toDate) {
    statusInPeriod = 'acquired_in_period';
  } else if (asset.status === 'disposed' && asset.disposal) {
    const dDate = new Date(asset.disposal.disposalDate);
    if (dDate >= fromDate && dDate <= toDate) {
      statusInPeriod = 'disposed_in_period';
    }
  } else if (valEnd.isFullyDepreciated) {
    statusInPeriod = 'fully_depreciated';
  }

  const annualRate = asset.depreciationMethod !== 'straight_line'
    ? undefined
    : rateMode
      ? (isValidAnnualDepreciationRate(asset.annualDepreciationRate) ? asset.annualDepreciationRate : 0)
      : (1 / Math.max(1, asset.usefulLifeYears)) * 100;

  return {
    assetId: asset.id,
    assetCode: asset.code,
    assetName: asset.name,
    category: asset.category,
    department: asset.department || 'غير محدد',
    startDepreciationRule: asset.startDepreciationRule || 'mid_month_15',
    totalCost,
    salvageValue,
    usefulLifeYears: asset.usefulLifeYears,
    depreciationMethod: asset.depreciationMethod,
    inServiceDate: asset.inServiceDate || asset.purchaseDate,
    beginningBookValue,
    periodExpense,
    accumulatedAtEnd: valEnd.accumulatedDepreciation,
    endingBookValue,
    statusInPeriod,
    depreciationRatePercent: annualRate,
  };
}
