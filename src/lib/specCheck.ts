import type { Material } from "../types";

export interface SpecRange {
  min?: number;
  max?: number;
}

export interface SpecCheckResult {
  hasSpec: boolean;
  min?: number;
  max?: number;
  result?: "OK" | "NG";
}

export function parseTurkishNumber(s: string | number | null | undefined): number | undefined {
  if (s === null || s === undefined) return undefined;
  if (typeof s === "number") return isNaN(s) ? undefined : s;
  const str = String(s).trim().replace(",", ".");
  if (!str) return undefined;
  const match = str.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const val = parseFloat(match[0]);
  return isNaN(val) ? undefined : val;
}

/**
 * Serbest metinden (örn: "1,7-2,1 g/cm3", "%28-32", "<1,5") min/max değerlerini ayıklar.
 */
export function extractRangeFromString(specText: string | null | undefined): SpecRange {
  if (!specText) return {};
  const original = String(specText).trim();
  const splitDecimalRange = original.match(/^\s*(-?\d+)\s*,\s*-?(\d+)\s*,\s*(\d+)\b/);
  if (splitDecimalRange) {
    return {
      min: parseFloat(splitDecimalRange[1]),
      max: parseFloat(`${splitDecimalRange[2]}.${splitDecimalRange[3]}`),
    };
  }

  const cleaned = original.replace(/,/g, ".");
  const numbers = cleaned.match(/\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length === 0) return {};

  const vals = numbers.map((n) => parseFloat(n)).filter((n) => !isNaN(n));
  if (vals.length === 0) return {};

  if (cleaned.includes("<")) {
    return { max: vals[0] };
  }
  if (cleaned.includes(">")) {
    return { min: vals[0] };
  }

  const range = cleaned.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    return { min: parseFloat(range[1]), max: parseFloat(range[2]) };
  }

  if (vals.length === 1) {
    return { min: vals[0], max: vals[0] };
  }

  return { min: Math.min(...vals), max: Math.max(...vals) };
}

/**
 * Malzeme objesinden sayısal min/max alanlarını öncelikli okur,
 * yoksa eski serbest metin alanından min/max çıkarır.
 */
export function getMaterialSpecRange(
  material: Material | undefined | null,
  paramKey: "yogunluk" | "mfr" | "sertlik" | "vizkozite" | "katki" | "renkFarkiDE"
): SpecRange {
  if (!material) return {};

  const minKey = (paramKey === "renkFarkiDE" ? "renkFarkiDEMin" : `${paramKey}Min`) as keyof Material;
  const maxKey = (paramKey === "renkFarkiDE" ? "renkFarkiDEMax" : `${paramKey}Max`) as keyof Material;

  const numMin = parseTurkishNumber(material[minKey] as any);
  const numMax = parseTurkishNumber(material[maxKey] as any);

  if (numMin !== undefined || numMax !== undefined) {
    return { min: numMin, max: numMax };
  }

  // Eski string alanlar için geriye dönük uyumluluk
  const legacyMap: Record<string, keyof Material> = {
    yogunluk: "yogunlukMinMax",
    mfr: "mfrMinMax",
    sertlik: "sertlikMinMax",
    vizkozite: "vizkoziteMinMax",
    katki: "katkiMinMax",
    renkFarkiDE: "renkFarkiDE",
  };

  const legacyStr = material[legacyMap[paramKey]] as string | null | undefined;
  return extractRangeFromString(legacyStr);
}

/**
 * Ölçülen değeri spec min/max sınırları ile sayısal olarak karşılaştırır.
 */
export function checkValueWithRange(
  range: SpecRange,
  inputValue: string | number | undefined | null
): SpecCheckResult {
  const { min, max } = range;
  const hasSpec = min !== undefined || max !== undefined;

  if (!hasSpec) return { hasSpec: false };

  const val = parseTurkishNumber(inputValue);
  if (val === undefined) return { hasSpec: true, min, max };

  let isOk = true;
  if (min !== undefined && val < min) isOk = false;
  if (max !== undefined && val > max) isOk = false;

  return {
    hasSpec: true,
    min,
    max,
    result: isOk ? "OK" : "NG",
  };
}

/**
 * Eski `checkValue` fonksiyonu için geriye dönük sarmalayıcı (wrapper)
 */
export function checkValue(
  specText: string | null | undefined,
  inputValue: string | undefined
): SpecCheckResult {
  const range = extractRangeFromString(specText);
  return checkValueWithRange(range, inputValue);
}

/**
 * Spec aralığını okunabilir metin olarak biçimlendirir (örn. "1.7 - 2.1", "≤ 1.5")
 */
export function formatSpecText(range: SpecRange): string {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) {
    if (min === max) return `${min}`;
    return `${min} - ${max}`;
  }
  if (min !== undefined) return `≥ ${min}`;
  if (max !== undefined) return `≤ ${max}`;
  return "—";
}

