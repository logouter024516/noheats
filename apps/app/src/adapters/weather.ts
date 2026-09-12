import { WeatherSnapshot } from '../domain/types';
import { WeatherProvider } from '../providers/types';

export async function fetchWeather(lat: number, lon: number, _at?: string): Promise<WeatherSnapshot> {
  return openMeteoWeather.fetch(lat, lon);
}

export const openMeteoWeather: WeatherProvider = {
  name: 'Open-Meteo',

  async fetch(lat: number, lon: number): Promise<WeatherSnapshot> {
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index' +
      '&timezone=Asia/Seoul';

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
    const data = await res.json();
    const c = data.current;

    return {
      observedAt: c.time ?? new Date().toISOString().replace('Z', '+09:00'),
      temperatureC: c.temperature_2m,
      apparentTemperatureC: c.apparent_temperature,
      humidityPct: c.relative_humidity_2m,
      uvIndex: c.uv_index ?? undefined,
      windMps: c.wind_speed_10m / 3.6,
      precipitationProbability: c.precipitation_probability,
      source: 'Open-Meteo',
      dataQuality: 'live',
    };
  },
};