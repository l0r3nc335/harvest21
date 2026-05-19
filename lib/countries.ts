import { countries } from "countries-list";

export const COUNTRIES_BY_REGION: Record<string, string[]> = {
  north_america: [
    "United States",
    "Canada",
    "Mexico",
    "Greenland",
    "Bahamas",
    "Cuba",
    "Jamaica",
    "Haiti",
    "Dominican Republic",
    "Puerto Rico",
  ],
  south_america: [
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Colombia",
    "Ecuador",
    "Paraguay",
    "Peru",
    "Uruguay",
    "Venezuela",
  ],
  europe: [
    "United Kingdom",
    "Belgium",
    "France",
    "Germany",
    "Spain",
    "Italy",
    "Portugal",
    "Netherlands",
    "Switzerland",
    "Poland",
    "Greece",
    "Ireland",
    "Austria",
    "Norway",
    "Sweden",
    "Denmark",
    "Finland",
    "Czech Republic",
    "Romania",
    "Hungary",
    "Turkey",
    "Ukraine",
    "Russia",
  ],
  africa: [
    "Nigeria",
    "Kenya",
    "South Africa",
    "Ghana",
    "Uganda",
    "Ethiopia",
    "Tanzania",
    "Egypt",
    "Morocco",
    "Cameroon",
    "Zimbabwe",
    "Zambia",
  ],
  asia: [
    "Philippines",
    "India",
    "China",
    "Japan",
    "South Korea",
    "Indonesia",
    "Vietnam",
    "Thailand",
    "Malaysia",
    "Singapore",
    "Nepal",
    "Bangladesh",
    "Pakistan",
    "Taiwan",
    "Israel",
    "Saudi Arabia",
    "United Arab Emirates",
  ],
  australia: [
    "Australia",
    "New Zealand",
    "Papua New Guinea",
    "Fiji",
    "Samoa",
    "Tonga",
    "Vanuatu",
    "Solomon Islands",
  ],
};

export const REGION_LABELS: Record<string, string> = {
  north_america: "North America",
  south_america: "South America",
  europe: "Europe",
  africa: "Africa",
  asia: "Asia",
  australia: "Australia & Oceania",
};

// Country helpers for components
const codeToCountry = new Map<string, { name: string; code: string }>();
const nameToCountry = new Map<string, { name: string; code: string }>();

Object.entries(countries).forEach(([code, data]) => {
  const country = { name: data.name, code: code.toUpperCase() };
  codeToCountry.set(code.toUpperCase(), country);
  codeToCountry.set(code.toLowerCase(), country);
  nameToCountry.set(data.name, country);
  nameToCountry.set(data.name.toLowerCase(), country);
});

// Aliases for names used by overview/backend (e.g. iso_to_country) that differ from countries-list
const countryNameAliases: [string, string][] = [
  ["Virgin Islands (U.S.)", "VI"],
  ["U.S. Virgin Islands", "VI"],
  ["United States Virgin Islands", "VI"],
  ["US Virgin Islands", "VI"],
  ["US Minor Virgin Islands", "VI"],
  ["United States Minor Outlying Islands", "UM"],
  ["U.S. Minor Outlying Islands", "UM"],
  ["British Virgin Islands", "VG"],
  ["Virgin Islands (British)", "VG"],
];
countryNameAliases.forEach(([aliasName, code]) => {
  const country = codeToCountry.get(code);
  if (country) {
    nameToCountry.set(aliasName, country);
    nameToCountry.set(aliasName.toLowerCase(), country);
  }
});

export function getCountryByCode(code: string | null | undefined): { name: string; code: string } | null {
  if (!code) return null;
  return codeToCountry.get(code.toUpperCase()) || null;
}

export function getCountryByName(name: string | null | undefined): { name: string; code: string } | null {
  if (!name) return null;
  return nameToCountry.get(name) || nameToCountry.get(name.toLowerCase()) || null;
}

export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode) return "";
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return "";
  
  const codePoints = [...code].map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function resolveMissionaryCardCountry(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const byName = getCountryByName(trimmed);
  if (byName) return byName.name;
  const alphaOnly = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (alphaOnly.length >= 2) {
    const byCode = getCountryByCode(alphaOnly.slice(0, 2));
    if (byCode) return byCode.name;
  }
  return trimmed;
}
