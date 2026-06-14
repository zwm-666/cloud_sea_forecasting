export const WEATHER_CACHE_TTL = 30 * 60 * 1000;

const ASCII_SLUG_PATTERN = /^[a-z0-9-]+$/;
const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const CURRENT_FIELDS = 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code';
const HOURLY_FIELDS = 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dateStringFromOffset(selectedDate, offset) {
  const baseDate = new Date(`${selectedDate}T00:00:00`);
  baseDate.setDate(baseDate.getDate() + offset);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseHour(localTime) {
  const match = String(localTime).match(/T(\d{2}):/);
  return match ? Number(match[1]) : null;
}

function parseWindowStartHour(windowText) {
  const match = String(windowText || '').match(/(\d{2}):\d{2}/);
  return match ? Number(match[1]) : 6;
}

function modal(values) {
  const counts = new Map();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  let selected = values[0];
  let selectedCount = 0;
  counts.forEach((count, value) => {
    if (count > selectedCount) {
      selected = value;
      selectedCount = count;
    }
  });
  return selected;
}

function assertHourly(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid Open-Meteo response');
  }
  if (!payload.current || !payload.hourly) {
    throw new Error('Open-Meteo response missing current or hourly data');
  }
  if (!Array.isArray(payload.hourly.time) || !payload.hourly.time.length) {
    throw new Error('Open-Meteo response missing hourly time data');
  }
}

function getHourlyRecords(payload) {
  const hourly = payload.hourly;
  return hourly.time.map((time, index) => ({
    time,
    date: String(time).slice(0, 10),
    hour: parseHour(time),
    temperature: hourly.temperature_2m[index],
    humidity: hourly.relative_humidity_2m[index],
    windSpeed: hourly.wind_speed_10m[index],
    weatherCode: hourly.weather_code[index],
  })).filter((record) => (
    record.hour !== null
    && Number.isFinite(record.temperature)
    && Number.isFinite(record.humidity)
    && Number.isFinite(record.windSpeed)
    && Number.isFinite(record.weatherCode)
  ));
}

function nearestRecord(records, targetHour) {
  if (!records.length) return null;
  return records.reduce((best, record) => {
    const bestDistance = Math.abs(best.hour - targetHour);
    const recordDistance = Math.abs(record.hour - targetHour);
    return recordDistance < bestDistance ? record : best;
  }, records[0]);
}

export function buildWeatherCacheKey(mountain, selectedDate) {
  if (!mountain || !ASCII_SLUG_PATTERN.test(mountain.slug || '')) {
    throw new Error('Mountain slug must be an ASCII-safe identifier');
  }
  if (!selectedDate) {
    throw new Error('selectedDate is required');
  }
  return `weather:${mountain.slug}:${selectedDate}`;
}

export function findDuplicateSlugs(mountains) {
  const seen = new Set();
  const duplicates = new Set();

  mountains.forEach((mountain) => {
    if (!mountain.slug) return;
    if (seen.has(mountain.slug)) {
      duplicates.add(mountain.slug);
    }
    seen.add(mountain.slug);
  });

  return Array.from(duplicates);
}

export function isCacheFresh(cached, now = Date.now()) {
  if (!cached || !Number.isFinite(cached.updatedAt)) return false;
  return now - cached.updatedAt < WEATHER_CACHE_TTL;
}

export function mapWeatherCode(code) {
  if (code === 0) return { weatherLabel: '晴天', weatherIcon: '☀' };
  if (code === 1 || code === 2) return { weatherLabel: '多云', weatherIcon: '☁' };
  if (code === 3) return { weatherLabel: '阴天', weatherIcon: '☁' };
  if (code === 45 || code === 48) return { weatherLabel: '雾', weatherIcon: '☁' };
  if (code >= 51 && code <= 57) return { weatherLabel: '毛毛雨', weatherIcon: '🌧' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { weatherLabel: '小雨', weatherIcon: '🌧' };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { weatherLabel: '雪', weatherIcon: '❄' };
  if (code >= 95 && code <= 99) return { weatherLabel: '雷雨', weatherIcon: '⛈' };
  return { weatherLabel: '多云', weatherIcon: '☁' };
}

export function buildOpenMeteoUrl(mountain) {
  if (!Number.isFinite(mountain?.latitude) || !Number.isFinite(mountain?.longitude)) {
    throw new Error('Mountain latitude and longitude are required');
  }

  const url = new URL(OPEN_METEO_ENDPOINT);
  url.searchParams.set('latitude', String(mountain.latitude));
  url.searchParams.set('longitude', String(mountain.longitude));
  url.searchParams.set('current', CURRENT_FIELDS);
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('forecast_days', '3');
  url.searchParams.set('timezone', 'auto');
  return url;
}

export function calculateCloudSeaProbability(mountain, weather) {
  const baseline = Number.isFinite(mountain?.baseProbability) ? mountain.baseProbability : 65;
  const humidity = Number(weather?.humidity ?? 60);
  const windSpeed = Number(weather?.windSpeed ?? 5);
  const temperature = Number(weather?.temperature ?? 18);
  const weatherCode = Number(weather?.weatherCode ?? 1);
  let score = baseline;

  score += (humidity - 75) * 0.45;

  if (windSpeed <= 4) score += 8;
  else if (windSpeed <= 7) score += 2;
  else score -= (windSpeed - 7) * 5;

  if ([2, 3, 45, 48, 51, 53, 55, 61, 63, 80].includes(weatherCode)) score += 7;
  if (weatherCode === 0) score -= 7;
  if (temperature >= 24) score -= 4;

  return Math.round(clamp(score, 20, 96));
}

export function normalizeOpenMeteoResponse(payload, options = {}) {
  assertHourly(payload);

  const { selectedDate, mountain, now = Date.now() } = options;
  if (!selectedDate) {
    throw new Error('selectedDate is required');
  }

  const hourlyRecords = getHourlyRecords(payload);
  if (!hourlyRecords.length) {
    throw new Error('Open-Meteo response contains no usable hourly records');
  }

  const targetHour = parseWindowStartHour(mountain?.window);
  const dailyForecasts = [0, 1, 2].map((offset) => {
    const date = dateStringFromOffset(selectedDate, offset);
    const dayRecords = hourlyRecords.filter((record) => record.date === date);
    const daytimeRecords = dayRecords.filter((record) => record.hour >= 6 && record.hour <= 18);
    const usableRecords = daytimeRecords.length ? daytimeRecords : dayRecords;
    const targetRecord = nearestRecord(usableRecords, targetHour) || hourlyRecords[0];
    const humidity = average(usableRecords.map((record) => record.humidity));
    const windSpeed = average(usableRecords.map((record) => record.windSpeed));
    const weatherCode = modal(usableRecords.map((record) => record.weatherCode));
    const weather = mapWeatherCode(weatherCode);

    return {
      offset,
      date,
      temperature: round(targetRecord.temperature),
      humidity: round(humidity),
      windSpeed: round(windSpeed, 1),
      weatherCode,
      weatherLabel: weather.weatherLabel,
      weatherIcon: weather.weatherIcon,
    };
  });

  const currentWeather = mapWeatherCode(payload.current.weather_code);

  return {
    updatedAt: now,
    current: {
      time: payload.current.time,
      temperature: payload.current.temperature_2m,
      humidity: payload.current.relative_humidity_2m,
      windSpeed: payload.current.wind_speed_10m,
      weatherCode: payload.current.weather_code,
      weatherLabel: currentWeather.weatherLabel,
      weatherIcon: currentWeather.weatherIcon,
    },
    dailyForecasts,
  };
}
