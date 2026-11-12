/**
 * Location, Dual-Time & LDR Distance Service
 *
 * Provides high-precision coordinates, IANA timezones, Haversine distance,
 * live solar/ambient cycles, and persistent partner location management.
 */

export interface CityProfile {
  name: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  label?: string;
}

export const KNOWN_CITIES: Record<string, CityProfile> = {
  bacolod: {
    name: "Bacolod",
    country: "Philippines",
    lat: 10.6765,
    lng: 122.9509,
    timezone: "Asia/Manila",
    label: "City of Smiles",
  },
  manila: {
    name: "Manila",
    country: "Philippines",
    lat: 14.5995,
    lng: 120.9842,
    timezone: "Asia/Manila",
    label: "Metro Manila",
  },
  cebu: {
    name: "Cebu City",
    country: "Philippines",
    lat: 10.3157,
    lng: 123.8854,
    timezone: "Asia/Manila",
    label: "Queen City of the South",
  },
  iloilo: {
    name: "Iloilo City",
    country: "Philippines",
    lat: 10.7202,
    lng: 122.5621,
    timezone: "Asia/Manila",
    label: "City of Love",
  },
  davao: {
    name: "Davao City",
    country: "Philippines",
    lat: 7.1907,
    lng: 125.4553,
    timezone: "Asia/Manila",
    label: "Durian Capital",
  },
  baguio: {
    name: "Baguio",
    country: "Philippines",
    lat: 16.4023,
    lng: 120.596,
    timezone: "Asia/Manila",
    label: "Summer Capital",
  },
  dumaguete: {
    name: "Dumaguete",
    country: "Philippines",
    lat: 9.3068,
    lng: 123.3054,
    timezone: "Asia/Manila",
    label: "City of Gentle People",
  },
  cagayan_de_oro: {
    name: "Cagayan de Oro",
    country: "Philippines",
    lat: 8.4542,
    lng: 124.6319,
    timezone: "Asia/Manila",
    label: "City of Golden Friendship",
  },
  angeles: {
    name: "Angeles City",
    country: "Philippines",
    lat: 15.1452,
    lng: 120.5887,
    timezone: "Asia/Manila",
    label: "Pampanga",
  },
  tagbilaran: {
    name: "Tagbilaran",
    country: "Philippines",
    lat: 9.6444,
    lng: 123.8542,
    timezone: "Asia/Manila",
    label: "Bohol",
  },
  tokyo: {
    name: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    timezone: "Asia/Tokyo",
    label: "Japan",
  },
  seoul: {
    name: "Seoul",
    country: "South Korea",
    lat: 37.5665,
    lng: 126.978,
    timezone: "Asia/Seoul",
    label: "South Korea",
  },
  singapore: {
    name: "Singapore",
    country: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    timezone: "Asia/Singapore",
    label: "Singapore",
  },
  sydney: {
    name: "Sydney",
    country: "Australia",
    lat: -33.8688,
    lng: 151.2093,
    timezone: "Australia/Sydney",
    label: "Australia",
  },
  melbourne: {
    name: "Melbourne",
    country: "Australia",
    lat: -37.8136,
    lng: 144.9631,
    timezone: "Australia/Melbourne",
    label: "Australia",
  },
  vancouver: {
    name: "Vancouver",
    country: "Canada",
    lat: 49.2827,
    lng: -123.1207,
    timezone: "America/Vancouver",
    label: "Canada",
  },
  toronto: {
    name: "Toronto",
    country: "Canada",
    lat: 43.6532,
    lng: -79.3832,
    timezone: "America/Toronto",
    label: "Canada",
  },
  los_angeles: {
    name: "Los Angeles",
    country: "United States",
    lat: 34.0522,
    lng: -118.2437,
    timezone: "America/Los_Angeles",
    label: "California",
  },
  new_york: {
    name: "New York",
    country: "United States",
    lat: 40.7128,
    lng: -74.006,
    timezone: "America/New_York",
    label: "New York",
  },
  london: {
    name: "London",
    country: "United Kingdom",
    lat: 51.5074,
    lng: -0.1278,
    timezone: "Europe/London",
    label: "United Kingdom",
  },
};

const LS_USER_CITY = "seanaya.user_city";
const LS_PARTNER_CITY = "seanaya.partner_city";

/**
 * Calculates Great-Circle distance in kilometers between two geographic coordinates
 * using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Resolves a city name (case-insensitive key or name) to a CityProfile.
 */
export function resolveCity(inputName: string): CityProfile {
  const cleaned = inputName.trim().toLowerCase();
  for (const [key, profile] of Object.entries(KNOWN_CITIES)) {
    if (key === cleaned || profile.name.toLowerCase() === cleaned) {
      return profile;
    }
  }
  // Fallback for custom cities: estimate timezone or default to Asia/Manila
  return {
    name: inputName.trim() || "Manila",
    country: "Philippines",
    lat: 14.5995,
    lng: 120.9842,
    timezone: "Asia/Manila",
    label: inputName.trim() || "Partner City",
  };
}

export function getUserCity(): string {
  if (typeof window === "undefined") return "Bacolod";
  return localStorage.getItem(LS_USER_CITY) || "Bacolod";
}

export function setUserCity(city: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_USER_CITY, city);
    window.dispatchEvent(new Event("seanaya:location_updated"));
  }
}

export function getPartnerCity(): string {
  if (typeof window === "undefined") return "Manila";
  return localStorage.getItem(LS_PARTNER_CITY) || "Manila";
}

export function setPartnerCity(city: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_PARTNER_CITY, city);
    window.dispatchEvent(new Event("seanaya:location_updated"));
  }
}

/**
 * Formats live time in a target timezone.
 */
export function getLiveTimeInTimezone(
  timezone: string,
  date = new Date(),
): {
  timeStr: string;
  hour12: number;
  minutes: string;
  seconds: string;
  ampm: string;
  hour24: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const parts = formatter.formatToParts(date);
    let hour12 = 12;
    let minutes = "00";
    let seconds = "00";
    let ampm = "AM";

    for (const p of parts) {
      if (p.type === "hour") hour12 = parseInt(p.value, 10);
      if (p.type === "minute") minutes = p.value;
      if (p.type === "second") seconds = p.value;
      if (p.type === "dayPeriod") ampm = p.value.toUpperCase();
    }

    const hour24Formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    });
    const hour24 = parseInt(hour24Formatter.format(date), 10);

    return {
      timeStr: `${hour12}:${minutes} ${ampm}`,
      hour12,
      minutes,
      seconds,
      ampm,
      hour24,
    };
  } catch {
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return {
      timeStr: `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`,
      hour12: h % 12 || 12,
      minutes: m,
      seconds: s,
      ampm: h >= 12 ? "PM" : "AM",
      hour24: h,
    };
  }
}

/**
 * Calculates human-friendly relative time difference between local and partner timezone.
 */
export function getTimezoneOffsetDescription(
  localTz: string,
  partnerTz: string,
  date = new Date(),
): string {
  try {
    const localUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
    const localDate = new Date(date.toLocaleString("en-US", { timeZone: localTz })).getTime();
    const partnerDate = new Date(date.toLocaleString("en-US", { timeZone: partnerTz })).getTime();

    const diffHours = Math.round((partnerDate - localDate) / (1000 * 60 * 60));

    if (diffHours === 0) return "Same time zone (PHT)";
    if (diffHours > 0) return `${diffHours}h ahead of you`;
    return `${Math.abs(diffHours)}h behind you`;
  } catch {
    return "Synchronized";
  }
}

/**
 * Returns poetic ambient solar state based on the local hour (24-hour scale).
 */
export function getSolarState(hour24: number): {
  phase: string;
  mood: string;
  isDay: boolean;
} {
  if (hour24 >= 5 && hour24 < 7) {
    return { phase: "Dawn", mood: "Gentle sunrise", isDay: true };
  } else if (hour24 >= 7 && hour24 < 12) {
    return { phase: "Morning", mood: "Soft sunlight", isDay: true };
  } else if (hour24 >= 12 && hour24 < 17) {
    return { phase: "Afternoon", mood: "Warm daylight", isDay: true };
  } else if (hour24 >= 17 && hour24 < 19) {
    return { phase: "Golden Hour", mood: "Amber sunset", isDay: true };
  } else if (hour24 >= 19 && hour24 < 22) {
    return { phase: "Evening", mood: "Quiet dusk", isDay: false };
  } else {
    return { phase: "Night", mood: "Starry stillness", isDay: false };
  }
}
