// Shared garment size chart data — used by the product SizeChartModal and the
// standalone /size-guide page. All measurements in centimeters.

export type SizeRow = {
  size: string;
  chest: number;
  length: number;
  shoulder: number;
  sleeve: number;
};

export const SIZE_DATA: SizeRow[] = [
  { size: "XS",  chest: 91.4,  length: 66.0, shoulder: 39.4, sleeve: 20.3 },
  { size: "S",   chest: 96.5,  length: 68.6, shoulder: 40.6, sleeve: 21.0 },
  { size: "M",   chest: 101.6, length: 71.1, shoulder: 41.9, sleeve: 21.6 },
  { size: "L",   chest: 106.7, length: 73.7, shoulder: 43.2, sleeve: 22.9 },
  { size: "XL",  chest: 111.8, length: 76.2, shoulder: 44.5, sleeve: 22.9 },
  { size: "XXL", chest: 116.8, length: 77.5, shoulder: 45.7, sleeve: 23.5 },
  { size: "3XL", chest: 132.1, length: 78.7, shoulder: 52.7, sleeve: 24.8 },
  { size: "4XL", chest: 137.2, length: 80.0, shoulder: 54.6, sleeve: 26.0 },
  { size: "5XL", chest: 142.2, length: 81.3, shoulder: 56.5, sleeve: 27.3 },
  { size: "6XL", chest: 147.3, length: 82.6, shoulder: 58.4, sleeve: 28.6 },
];

export const CM_TO_IN = 0.393701;

/** Format a centimeter value in the requested unit, to 1 decimal. */
export const formatMeasure = (v: number, unit: "cm" | "in"): string =>
  unit === "cm" ? v.toFixed(1) : (v * CM_TO_IN).toFixed(1);
