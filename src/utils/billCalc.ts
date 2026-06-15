export interface TariffSettings {
  tariffSlab1Limit: number;
  tariffSlab1Rate: number;
  tariffSlab2Limit: number;
  tariffSlab2Rate: number;
  tariffSlab3Limit: number;
  tariffSlab3Rate: number;
  tariffSlab4Limit: number;
  tariffSlab4Rate: number;
  tariffSlab5Rate: number;
}

export interface ClientBillBreakdown {
  slab: string;
  kwh: number;
  rate: number;
  amount: number;
}

/**
 * Mirror of the progressive slab calculation logic for real-time frontend sliders & adjustments
 */
export function calculateBillProgressive(totalKwh: number, cfg: TariffSettings) {
  const s1Lim = Number(cfg.tariffSlab1Limit);
  const s1Rt = Number(cfg.tariffSlab1Rate);
  const s2Lim = Number(cfg.tariffSlab2Limit);
  const s2Rt = Number(cfg.tariffSlab2Rate);
  const s3Lim = Number(cfg.tariffSlab3Limit);
  const s3Rt = Number(cfg.tariffSlab3Rate);
  const s4Lim = Number(cfg.tariffSlab4Limit);
  const s4Rt = Number(cfg.tariffSlab4Rate);
  const s5Rt = Number(cfg.tariffSlab5Rate);

  const breakdown: ClientBillBreakdown[] = [];
  let remaining = totalKwh;
  let totalTaka = 0;

  // Slab 1 (0 to s1Lim)
  const slab1Usage = Math.min(remaining, s1Lim);
  if (slab1Usage > 0) {
    const amt = slab1Usage * s1Rt;
    breakdown.push({ slab: `Slab 1 (0 - ${s1Lim} kWh)`, kwh: slab1Usage, rate: s1Rt, amount: amt });
    totalTaka += amt;
    remaining -= slab1Usage;
  }

  // Slab 2 (s1Lim to s2Lim)
  if (remaining > 0) {
    const slab2Size = s2Lim - s1Lim;
    const slab2Usage = Math.min(remaining, slab2Size);
    const amt = slab2Usage * s2Rt;
    breakdown.push({ slab: `Slab 2 (${s1Lim + 1} - ${s2Lim} kWh)`, kwh: slab2Usage, rate: s2Rt, amount: amt });
    totalTaka += amt;
    remaining -= slab2Usage;
  }

  // Slab 3 (s2Lim to s3Lim)
  if (remaining > 0) {
    const slab3Size = s3Lim - s2Lim;
    const slab3Usage = Math.min(remaining, slab3Size);
    const amt = slab3Usage * s3Rt;
    breakdown.push({ slab: `Slab 3 (${s2Lim + 1} - ${s3Lim} kWh)`, kwh: slab3Usage, rate: s3Rt, amount: amt });
    totalTaka += amt;
    remaining -= slab3Usage;
  }

  // Slab 4 (s3Lim to s4Lim)
  if (remaining > 0) {
    const slab4Size = s4Lim - s3Lim;
    const slab4Usage = Math.min(remaining, slab4Size);
    const amt = slab4Usage * s4Rt;
    breakdown.push({ slab: `Slab 4 (${s3Lim + 1} - ${s4Lim} kWh)`, kwh: slab4Usage, rate: s4Rt, amount: amt });
    totalTaka += amt;
    remaining -= slab4Usage;
  }

  // Slab 5 (Above s4Lim)
  if (remaining > 0) {
    const amt = remaining * s5Rt;
    breakdown.push({ slab: `Slab 5 (Above ${s4Lim} kWh)`, kwh: remaining, rate: s5Rt, amount: amt });
    totalTaka += amt;
  }

  const meterRent = 40.0;
  totalTaka += meterRent;

  return {
    totalTaka,
    meterRent,
    breakdown,
  };
}
