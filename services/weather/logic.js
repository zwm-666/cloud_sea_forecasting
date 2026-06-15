export const WEATHER_CACHE_TTL = 30 * 60 * 1000;

const WEATHER_CACHE_VERSION = 'v3';
const ASCII_SLUG_PATTERN = /^[a-z0-9-]+$/;
const LEGACY_QWEATHER_HOSTS = new Set([
  'api.qweather.com',
  'devapi.qweather.com',
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function optionalNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dateStringFromOffset(selectedDate, offset) {
  const baseDate = new Date(`${selectedDate}T00:00:00`);
  baseDate.setDate(baseDate.getDate() + offset);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeApiHost(apiHost) {
  const normalized = String(apiHost || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

  if (!normalized) {
    throw new Error('QWeather API Host is required');
  }
  if (LEGACY_QWEATHER_HOSTS.has(normalized)) {
    throw new Error('QWeather API Host must use your project-specific host, not legacy shared domains');
  }
  return normalized;
}

function encodeQuery(params) {
  return params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function locationParam(mountain) {
  if (!Number.isFinite(mountain?.latitude) || !Number.isFinite(mountain?.longitude)) {
    throw new Error('Mountain latitude and longitude are required');
  }
  return `${Number(mountain.longitude).toFixed(2)},${Number(mountain.latitude).toFixed(2)}`;
}

function assertQWeatherPayload(payload, fieldName) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid QWeather ${fieldName} response`);
  }
  if (payload.code !== '200') {
    throw new Error(`QWeather ${fieldName} request failed with code ${payload.code || 'unknown'}`);
  }
}

function displayWeather(code, text) {
  const mapped = mapWeatherCode(code);
  return {
    weatherLabel: text || mapped.weatherLabel,
    weatherIcon: mapped.weatherIcon,
  };
}

export function buildWeatherCacheKey(mountain, selectedDate) {
  if (!mountain || !ASCII_SLUG_PATTERN.test(mountain.slug || '')) {
    throw new Error('Mountain slug must be an ASCII-safe identifier');
  }
  if (!selectedDate) {
    throw new Error('selectedDate is required');
  }
  return `weather:${WEATHER_CACHE_VERSION}:${mountain.slug}:${selectedDate}`;
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
  const numericCode = Number(code);
  if (numericCode === 100 || numericCode === 150) return { weatherLabel: '晴天', weatherIcon: '☀' };
  if ([101, 102, 103, 151, 152, 153].includes(numericCode)) return { weatherLabel: '多云', weatherIcon: '☁' };
  if (numericCode === 104 || numericCode === 154) return { weatherLabel: '阴天', weatherIcon: '☁' };
  if (numericCode >= 300 && numericCode <= 399) return { weatherLabel: '小雨', weatherIcon: '🌧' };
  if (numericCode >= 400 && numericCode <= 499) return { weatherLabel: '雪', weatherIcon: '❄' };
  if (numericCode >= 500 && numericCode <= 515) return { weatherLabel: '雾', weatherIcon: '☁' };
  return { weatherLabel: '多云', weatherIcon: '☁' };
}

export function buildQWeatherRequestUrls({ apiHost, mountain }) {
  const host = normalizeApiHost(apiHost);
  const commonParams = [
    ['location', locationParam(mountain)],
    ['lang', 'zh'],
    ['unit', 'm'],
  ];

  return {
    nowUrl: `https://${host}/v7/weather/now?${encodeQuery(commonParams)}`,
    dailyUrl: `https://${host}/v7/weather/7d?${encodeQuery(commonParams)}`,
  };
}

export function calculateCloudSeaProbability(mountain, weather) {
  const baseline = Number.isFinite(mountain?.baseProbability) ? mountain.baseProbability : 65;
  const humidity = Number.isFinite(weather?.humidity) ? Number(weather.humidity) : baseline;
  const windSpeed = Number(weather?.windSpeed ?? 5);
  const temperature = Number(weather?.temperature ?? 18);
  const weatherCode = Number(weather?.weatherCode ?? 101);
  let score = baseline;

  score += (humidity - 75) * 0.45;

  if (windSpeed <= 4) score += 8;
  else if (windSpeed <= 7) score += 2;
  else score -= (windSpeed - 7) * 5;

  if ([101, 102, 103, 104, 305, 306, 307, 309, 313, 501, 502, 514, 515].includes(weatherCode)) score += 7;
  if (weatherCode === 100 || weatherCode === 150) score -= 7;
  if (temperature >= 24) score -= 4;

  return Math.round(clamp(score, 20, 96));
}

export function normalizeQWeatherResponse(payload, options = {}) {
  const { nowPayload, dailyPayload } = payload || {};
  const { selectedDate, now = Date.now() } = options;
  if (!selectedDate) {
    throw new Error('selectedDate is required');
  }

  assertQWeatherPayload(nowPayload, 'now');
  assertQWeatherPayload(dailyPayload, 'daily');
  if (!nowPayload.now || !Array.isArray(dailyPayload.daily)) {
    throw new Error('QWeather response missing now or daily data');
  }

  const currentCode = Number(nowPayload.now.icon);
  const currentWeather = displayWeather(currentCode, nowPayload.now.text);
  const dailyForecasts = [0, 1, 2].map((offset) => {
    const date = dateStringFromOffset(selectedDate, offset);
    const daily = dailyPayload.daily.find((item) => item.fxDate === date);
    if (!daily) {
      throw new Error(`QWeather daily data missing date ${date}`);
    }

    const weatherCode = Number(daily.iconDay || daily.iconNight);
    const weather = displayWeather(weatherCode, daily.textDay || daily.textNight);
    const temperatureMin = optionalNumber(daily.tempMin);
    const temperatureMax = optionalNumber(daily.tempMax);
    const windSpeedKmh = optionalNumber(daily.windSpeedDay ?? daily.windSpeedNight, 0);

    return {
      offset,
      date,
      temperature: round((temperatureMin + temperatureMax) / 2),
      temperatureMin,
      temperatureMax,
      precipitation: optionalNumber(daily.precip, 0),
      humidity: optionalNumber(daily.humidity),
      cloud: optionalNumber(daily.cloud),
      windSpeed: round(windSpeedKmh / 3.6, 1),
      weatherCode,
      weatherLabel: weather.weatherLabel,
      weatherIcon: weather.weatherIcon,
    };
  });

  return {
    updatedAt: now,
    provider: 'qweather',
    current: {
      time: nowPayload.now.obsTime || nowPayload.updateTime || '',
      temperature: optionalNumber(nowPayload.now.temp),
      humidity: optionalNumber(nowPayload.now.humidity),
      windSpeed: round(optionalNumber(nowPayload.now.windSpeed, 0) / 3.6, 1),
      precipitation: optionalNumber(nowPayload.now.precip, 0),
      cloud: optionalNumber(nowPayload.now.cloud),
      weatherCode: currentCode,
      weatherLabel: currentWeather.weatherLabel,
      weatherIcon: currentWeather.weatherIcon,
    },
    dailyForecasts,
  };
}
