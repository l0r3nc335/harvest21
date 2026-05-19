import { countries } from "countries-list";

export const countryList = Object.entries(countries)
  .map(([, data]) => ({ value: data.name, label: data.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

const isoToNameMap = new Map<string, string>();
const nameToIsoMap = new Map<string, string>();

Object.entries(countries).forEach(([code, data]) => {
  isoToNameMap.set(code.toUpperCase(), data.name);
  isoToNameMap.set(code.toLowerCase(), data.name);
  nameToIsoMap.set(data.name, code.toUpperCase());
  nameToIsoMap.set(data.name.toLowerCase(), code.toUpperCase());
});

export function getCountryNameFromISO(isoCode: string | null | undefined): string {
  if (!isoCode) return "";
  
  const upperCode = isoCode.toUpperCase();
  return isoToNameMap.get(upperCode) || isoCode;
}

export function getISOFromCountryName(countryName: string | null | undefined): string {
  if (!countryName) return "";
  
  return nameToIsoMap.get(countryName) || nameToIsoMap.get(countryName.toLowerCase()) || countryName;
}

export function isISOCode(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.length === 2 && value === value.toUpperCase();
}

