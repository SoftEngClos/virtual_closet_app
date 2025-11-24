// src/services/weather.ts
export type DailyWeather = {
  date: string;
  icon: string;           // clear | rain | snow | storm | fog | sleet | cloud
  summary: string;        // simple text from weathercode
  tMin: number;
  tMax: number;
  humidity?: number;
  windSpeed?: number;
  pop?: number;
  feelsLike?: number;
  noon?: { temp: number; description: string; icon: string };
};

export function iconToIonicon(name: string): any {
  const k = (name || "").toLowerCase();
  if (k === "clear") return "sunny-outline";
  if (k === "rain") return "rainy-outline";
  if (k === "snow") return "snow-outline";
  if (k === "storm" || k === "thunder") return "thunderstorm-outline";
  if (k === "fog") return "cloudy-outline";
  if (k === "sleet") return "cloudy-outline";
  return "cloud-outline";
}

function codeToIcon(code: number): string {
  // https://open-meteo.com/en/docs weather codes
  if ([0].includes(code)) return "clear";
  if ([1, 2, 3].includes(code)) return "cloud";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 97].includes(code)) return "storm";
  return "cloud";
}

function codeToSummary(code: number): string {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 97].includes(code)) return "Thunderstorm";
  return "Cloudy";
}

export async function fetchForecastForDates(
  _place: string | null,
  dates: string[],
  units: "metric" | "imperial",
  coords?: { lat: number; lon: number }
): Promise<Record<string, DailyWeather>> {
  if (!coords) throw new Error("Missing coords for Open‑Meteo");
  const isImp = units === "imperial";
  const start = dates[0];
  const end = dates[dates.length - 1];

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&hourly=temperature_2m,relative_humidity_2m,weathercode` +
    `&temperature_unit=${isImp ? "fahrenheit" : "celsius"}` +
    `&wind_speed_unit=${isImp ? "mph" : "kmh"}` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather error ${res.status}`);
  const data = await res.json();

  const out: Record<string, DailyWeather> = {};
  const days = data.daily?.time || [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const tMax = Math.round(data.daily.temperature_2m_max[i]);
    const tMin = Math.round(data.daily.temperature_2m_min[i]);
    const pop = Number(data.daily.precipitation_probability_max?.[i] ?? 0) / 100;
    const code = data.daily.weathercode?.[i] ?? 1;
    const icon = codeToIcon(code);
    const summary = codeToSummary(code);

    out[d] = {
      date: d,
      icon,
      summary,
      tMin,
      tMax,
      windSpeed: Math.round(data.daily.wind_speed_10m_max?.[i] ?? 0),
      pop,
    };
  }

  // Ensure all requested week dates exist
  for (const d of dates) {
    if (!out[d]) {
      out[d] = { date: d, icon: "cloud", summary: "No data", tMin: 0, tMax: 0 };
    }
  }
  return out;
}
