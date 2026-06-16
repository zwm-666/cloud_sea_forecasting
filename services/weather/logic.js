export const WEATHER_CACHE_TTL = 30 * 60 * 1000;

const WEATHER_CACHE_VERSION = 'v4';
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

function roundOptional(value, digits = 0) {
  if (value === null || value === undefined || value === '') return null;
  return round(value, digits);
}

function optionalNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values, fallback = null) {
  const validValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!validValues.length) return fallback;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function sum(values, fallback = 0) {
  const validValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!validValues.length) return fallback;
  return validValues.reduce((total, value) => total + value, 0);
}

function calculateDewPoint(temperature, humidity) {
  if (temperature === null || temperature === undefined || humidity === null || humidity === undefined) return null;
  const temp = Number(temperature);
  const rh = Number(humidity);
  if (!Number.isFinite(temp) || !Number.isFinite(rh) || rh <= 0) return null;

  const a = 17.27;
  const b = 237.7;
  const alpha = Math.log(rh / 100) + (a * temp) / (b + temp);
  return round((b * alpha) / (a - alpha), 1);
}

function dewPointGap(temperature, dewPoint) {
  if (temperature === null || temperature === undefined || dewPoint === null || dewPoint === undefined) return null;
  if (!Number.isFinite(temperature) || !Number.isFinite(dewPoint)) return null;
  return round(temperature - dewPoint, 1);
}

function dateFromFxTime(value) {
  return String(value || '').slice(0, 10);
}

function hourlyItemsForDate(hourlyPayload, date) {
  if (!hourlyPayload || !Array.isArray(hourlyPayload.hourly)) return [];
  return hourlyPayload.hourly.filter((item) => dateFromFxTime(item.fxTime) === date);
}

function parseClockMinutes(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function parseFxTimeMinutes(value) {
  return parseClockMinutes(String(value || '').slice(11, 16));
}

function sunriseWindow(mountain) {
  const windowMatch = String(mountain?.window || '').match(/(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})/);
  if (windowMatch) {
    return {
      start: parseClockMinutes(windowMatch[1]),
      end: parseClockMinutes(windowMatch[2]),
      label: `${windowMatch[1]}-${windowMatch[2]}`,
    };
  }

  const sunrise = parseClockMinutes(mountain?.sunrise);
  if (Number.isFinite(sunrise)) {
    const start = Math.max(0, sunrise - 45);
    const end = Math.min(24 * 60 - 1, sunrise + 90);
    return {
      start,
      end,
      label: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}-${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
    };
  }

  return {
    start: 5 * 60,
    end: 7 * 60 + 30,
    label: '05:00-07:30',
  };
}

function minutesInWindow(minutes, window) {
  if (!Number.isFinite(minutes) || !Number.isFinite(window.start) || !Number.isFinite(window.end)) return false;
  if (window.end >= window.start) return minutes >= window.start && minutes <= window.end;
  return minutes >= window.start || minutes <= window.end;
}

function hourlyItemsForSunriseWindow(hourlyPayload, date, mountain) {
  const items = hourlyItemsForDate(hourlyPayload, date);
  const window = sunriseWindow(mountain);
  return items.filter((item) => minutesInWindow(parseFxTimeMinutes(item.fxTime), window));
}

function modalNumber(values, fallback = null) {
  const counts = new Map();
  values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  if (!counts.size) return fallback;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function summarizeHourly(items) {
  if (!items.length) return {};

  const windSpeedKmh = average(items.map((item) => item.windSpeed));
  const weatherCode = modalNumber(items.map((item) => item.icon));
  const weatherText = items.find((item) => Number(item.icon) === weatherCode)?.text || items[0]?.text || '';

  return {
    temperature: roundOptional(average(items.map((item) => item.temp))),
    humidity: roundOptional(average(items.map((item) => item.humidity))),
    cloud: roundOptional(average(items.map((item) => item.cloud))),
    windSpeed: Number.isFinite(windSpeedKmh) ? round(windSpeedKmh / 3.6, 1) : null,
    precipitation: roundOptional(sum(items.map((item) => item.precip), 0), 1),
    pressure: roundOptional(average(items.map((item) => item.pressure))),
    dewPoint: roundOptional(average(items.map((item) => item.dew)), 1),
    weatherCode,
    weatherText,
  };
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
    hourlyUrl: `https://${host}/v7/weather/72h?${encodeQuery(commonParams)}`,
    dailyUrl: `https://${host}/v7/weather/7d?${encodeQuery(commonParams)}`,
  };
}

function numericWeatherCode(weather) {
  return Number(weather?.weatherCode ?? weather?.iconDay ?? weather?.iconNight);
}

function isRainyCode(code) {
  return code >= 300 && code <= 399;
}

function isBadRainCode(code) {
  return [302, 303, 304, 307, 308, 310, 311, 312, 316, 317, 318, 350, 351].includes(code);
}

function isClearLikeCode(code) {
  return [100, 101, 102, 103, 150, 151, 152, 153].includes(code);
}

function isWetCloudyCode(code) {
  return [101, 102, 103, 104, 151, 152, 153, 154, 501, 502, 514, 515].includes(code);
}

function isFogCode(code) {
  return code >= 500 && code <= 515;
}

function scoreBand(value, idealMin, idealMax, hardMin, hardMax, maxScore) {
  if (!Number.isFinite(value)) return Math.round(maxScore * 0.45);
  if (value >= idealMin && value <= idealMax) return maxScore;
  if (value < hardMin || value > hardMax) return 0;
  if (value < idealMin) {
    return Math.round(maxScore * ((value - hardMin) / (idealMin - hardMin)));
  }
  return Math.round(maxScore * ((hardMax - value) / (hardMax - idealMax)));
}

function scoreMinimum(value, ideal, hardMin, maxScore) {
  if (!Number.isFinite(value)) return Math.round(maxScore * 0.45);
  if (value >= ideal) return maxScore;
  if (value <= hardMin) return 0;
  return Math.round(maxScore * ((value - hardMin) / (ideal - hardMin)));
}

function scoreMaximum(value, idealMax, hardMax, maxScore) {
  if (!Number.isFinite(value)) return Math.round(maxScore * 0.45);
  if (value <= idealMax) return maxScore;
  if (value >= hardMax) return 0;
  return Math.round(maxScore * ((hardMax - value) / (hardMax - idealMax)));
}

function scoreHumidityForSunrise(humidity) {
  return scoreMinimum(humidity, 88, 62, 24);
}

function scoreDewGapForSunrise(gap) {
  return scoreMaximum(gap, 2.5, 9, 18);
}

function scoreWindForSunrise(windSpeed) {
  return scoreMaximum(windSpeed, 3.2, 9, 16);
}

function scoreCloudForSunrise(cloud) {
  return scoreBand(cloud, 35, 90, 10, 100, 12);
}

function scoreVisibilityForSunrise(visibility) {
  if (!Number.isFinite(visibility)) return 4;
  if (visibility < 0.1) return 1;
  if (visibility <= 1.5) return 8;
  if (visibility <= 5) return 6;
  if (visibility <= 10) return 3;
  return 0;
}

function scoreNightCoolingForSunrise(weather, previousWeather) {
  let cooling = null;
  if (Number.isFinite(previousWeather?.temperatureMax) && Number.isFinite(weather?.temperatureMin)) {
    cooling = previousWeather.temperatureMax - weather.temperatureMin;
  } else if (Number.isFinite(weather?.temperatureMax) && Number.isFinite(weather?.temperatureMin)) {
    cooling = weather.temperatureMax - weather.temperatureMin;
  }

  return scoreMinimum(cooling, 5, 0, 10);
}

function scoreMoistureSupply(weather, previousWeather) {
  const previousCode = numericWeatherCode(previousWeather);
  const previousPrecipitation = Number.isFinite(previousWeather?.precipitation) ? previousWeather.precipitation : null;
  const previousHumidity = Number.isFinite(previousWeather?.humidity) ? previousWeather.humidity : null;
  const previousCloud = Number.isFinite(previousWeather?.cloud) ? previousWeather.cloud : null;

  let score = 0;
  if (Number.isFinite(previousPrecipitation)) score += scoreBand(previousPrecipitation, 0.5, 8, 0, 25, 7);
  if (isRainyCode(previousCode)) score += 3;
  if (Number.isFinite(previousHumidity)) score += scoreMinimum(previousHumidity, 85, 60, 3);
  if (Number.isFinite(previousCloud)) score += scoreBand(previousCloud, 55, 90, 20, 100, 2);
  if (!previousWeather) score = 4;
  return clamp(Math.round(score), 0, 12);
}

function sunriseRainGate(weatherCode, precipitation) {
  if (isBadRainCode(weatherCode) || precipitation >= 3) {
    return { cap: 8, isRainy: true, label: '日出窗口有明显降水' };
  }
  if (isRainyCode(weatherCode) || precipitation >= 0.5) {
    return { cap: 18, isRainy: true, label: '日出窗口可能下雨' };
  }
  if (precipitation > 0.05) {
    return { cap: 55, isRainy: true, label: '日出窗口有零星降水' };
  }
  return { cap: 98, isRainy: false, label: '日出窗口无降水' };
}

function scoreWeatherState(weatherCode) {
  if (isFogCode(weatherCode)) return 7;
  if (isWetCloudyCode(weatherCode)) return 5;
  if (isClearLikeCode(weatherCode)) return 3;
  return 2;
}

function perfectSunriseProbability(score, rainCap) {
  const probability = Math.round(clamp((score - 15) * 1.3, 2, 98));
  return Math.min(probability, rainCap);
}

function sunriseQualityCap({ humidity, dewGap, windSpeed, cloud }) {
  const cloudUsable = !Number.isFinite(cloud) || (cloud >= 25 && cloud <= 95);
  if (humidity >= 90 && dewGap <= 2 && windSpeed <= 3 && cloudUsable) return 98;
  if (humidity >= 85 && dewGap <= 3.5 && windSpeed <= 4.5 && cloudUsable) return 82;
  if (humidity >= 78 && dewGap <= 5 && windSpeed <= 6 && cloudUsable) return 65;
  return 38;
}

function cloudSeaLevel(probability) {
  if (probability >= 90) return { level: '完美机会极高', guideLevel: '日出完美云海窗口非常好' };
  if (probability >= 75) return { level: '完美机会高', guideLevel: '日出完美云海概率高' };
  if (probability >= 60) return { level: '较有机会', guideLevel: '日出云海条件较好' };
  if (probability >= 40) return { level: '机会一般', guideLevel: '日出云海条件不够稳定' };
  if (probability >= 20) return { level: '机会偏低', guideLevel: '完美观赏条件偏弱' };
  return { level: '不适合冲顶', guideLevel: '日出完美云海概率低' };
}

function mainReasons(scores, weather, rainGate) {
  const reasons = [];
  if (rainGate.isRainy) reasons.push(rainGate.label);
  if (scores.humidityScore >= 18) reasons.push('日出湿度接近饱和');
  if (scores.dewPointScore >= 14) reasons.push('温度露点差很小');
  if (scores.windScore >= 12) reasons.push('日出风速小');
  if (scores.cloudScore >= 9) reasons.push('云量适合成海并留出日出光线');
  if (scores.moistureScore >= 9) reasons.push('前一日水汽补给好');
  if (scores.coolingScore >= 8) reasons.push('夜间降温有利凝结');
  if (scores.visibilityScore >= 6) reasons.push('近地雾云信号明显');
  if (!reasons.length && Number.isFinite(weather?.humidity)) reasons.push('日出关键条件一般');
  return reasons.slice(0, 4);
}

export function calculateCloudSeaPrediction(mountain, weather = {}, context = {}) {
  const previousWeather = context.previousWeather || weather.previousWeather || null;
  const weatherCode = numericWeatherCode(weather);
  const humidity = Number.isFinite(weather?.humidity) ? weather.humidity : 70;
  const cloud = Number.isFinite(weather?.cloud) ? weather.cloud : 50;
  const windSpeed = Number.isFinite(weather?.windSpeed) ? weather.windSpeed : 5;
  const precipitation = Number.isFinite(weather?.precipitation) ? weather.precipitation : 0;
  const temperature = Number.isFinite(weather?.temperature) ? weather.temperature : 18;
  const dewPoint = Number.isFinite(weather?.dewPoint) ? weather.dewPoint : calculateDewPoint(temperature, humidity);
  const dewGap = Number.isFinite(weather?.dewPointGap) ? weather.dewPointGap : dewPointGap(temperature, dewPoint);
  const visibility = Number.isFinite(weather?.visibility) ? weather.visibility : null;

  const rainGate = sunriseRainGate(weatherCode, precipitation);
  const humidityScore = scoreHumidityForSunrise(humidity);
  const dewPointScore = scoreDewGapForSunrise(dewGap);
  const windScore = scoreWindForSunrise(windSpeed);
  const cloudScore = scoreCloudForSunrise(cloud);
  const moistureScore = scoreMoistureSupply(weather, previousWeather);
  const coolingScore = scoreNightCoolingForSunrise(weather, previousWeather);
  const visibilityScore = scoreVisibilityForSunrise(visibility);
  const weatherStateScore = scoreWeatherState(weatherCode);

  const rawScore = humidityScore
    + dewPointScore
    + windScore
    + cloudScore
    + moistureScore
    + coolingScore
    + visibilityScore
    + weatherStateScore;
  const score = Math.round(clamp(rawScore, 0, 100));
  const qualityCap = sunriseQualityCap({
    humidity,
    dewGap,
    windSpeed,
    cloud,
  });
  const probability = Math.min(perfectSunriseProbability(score, rainGate.cap), qualityCap);
  const level = cloudSeaLevel(probability);
  const scores = {
    moistureScore,
    humidityScore,
    dewPointScore,
    windScore,
    cloudScore,
    coolingScore,
    visibilityScore,
    weatherStateScore,
  };

  return {
    score,
    probability,
    rainCap: rainGate.cap,
    qualityCap,
    probabilityFloor: 0,
    rainGate,
    isRainy: rainGate.isRainy,
    level: level.level,
    guideLevel: level.guideLevel,
    reasons: mainReasons(scores, weather, rainGate),
    scores,
    perfectWindow: weather.sunriseWindow || context.sunriseWindow || sunriseWindow(mountain).label,
  };
}

export function calculateCloudSeaProbability(mountain, weather, context = {}) {
  return calculateCloudSeaPrediction(mountain, weather, context).probability;
}

export function normalizeQWeatherResponse(payload, options = {}) {
  const { nowPayload, hourlyPayload, dailyPayload } = payload || {};
  const { mountain, selectedDate, now = Date.now() } = options;
  if (!selectedDate) {
    throw new Error('selectedDate is required');
  }

  assertQWeatherPayload(nowPayload, 'now');
  if (hourlyPayload) assertQWeatherPayload(hourlyPayload, 'hourly');
  assertQWeatherPayload(dailyPayload, 'daily');
  if (!nowPayload.now || !Array.isArray(dailyPayload.daily)) {
    throw new Error('QWeather response missing now or daily data');
  }

  const currentCode = Number(nowPayload.now.icon);
  const currentWeather = displayWeather(currentCode, nowPayload.now.text);
  const currentTemperature = optionalNumber(nowPayload.now.temp);
  const currentHumidity = optionalNumber(nowPayload.now.humidity);
  const currentCloud = optionalNumber(nowPayload.now.cloud);
  const currentDewPoint = optionalNumber(nowPayload.now.dew, calculateDewPoint(currentTemperature, currentHumidity));
  const currentDewPointGap = dewPointGap(currentTemperature, currentDewPoint);
  const currentVisibility = optionalNumber(nowPayload.now.vis);

  const dailyForecasts = [0, 1, 2].map((offset) => {
    const date = dateStringFromOffset(selectedDate, offset);
    const daily = dailyPayload.daily.find((item) => item.fxDate === date);
    if (!daily) {
      throw new Error(`QWeather daily data missing date ${date}`);
    }

    const temperatureMin = optionalNumber(daily.tempMin);
    const temperatureMax = optionalNumber(daily.tempMax);
    const windSpeedKmh = optionalNumber(daily.windSpeedDay ?? daily.windSpeedNight, 0);
    const sunriseWindowInfo = sunriseWindow(mountain);
    const sunriseItems = hourlyItemsForSunriseWindow(hourlyPayload, date, mountain);
    const sunriseHourly = summarizeHourly(sunriseItems);
    const dayHourly = summarizeHourly(hourlyItemsForDate(hourlyPayload, date));
    const weatherCode = Number(sunriseHourly.weatherCode ?? daily.iconDay ?? daily.iconNight);
    const weather = displayWeather(weatherCode, sunriseHourly.weatherText || daily.textDay || daily.textNight);
    const temperature = optionalNumber(sunriseHourly.temperature, round((temperatureMin + temperatureMax) / 2));
    const humidity = optionalNumber(sunriseHourly.humidity, optionalNumber(dayHourly.humidity, optionalNumber(daily.humidity)));
    const cloud = optionalNumber(sunriseHourly.cloud, optionalNumber(dayHourly.cloud, optionalNumber(daily.cloud)));
    const dewPoint = optionalNumber(sunriseHourly.dewPoint, optionalNumber(dayHourly.dewPoint, calculateDewPoint(temperature, humidity)));
    const gap = dewPointGap(temperature, dewPoint);
    const visibility = optionalNumber(daily.vis);

    return {
      offset,
      date,
      temperature,
      temperatureMin,
      temperatureMax,
      precipitation: optionalNumber(sunriseHourly.precipitation, optionalNumber(dayHourly.precipitation, optionalNumber(daily.precip, 0))),
      humidity,
      cloud,
      windSpeed: Number.isFinite(sunriseHourly.windSpeed) ? sunriseHourly.windSpeed : (Number.isFinite(dayHourly.windSpeed) ? dayHourly.windSpeed : round(windSpeedKmh / 3.6, 1)),
      dewPoint,
      dewPointGap: gap,
      pressure: optionalNumber(sunriseHourly.pressure, optionalNumber(dayHourly.pressure, optionalNumber(daily.pressure))),
      visibility,
      lowCloud: cloud,
      lowCloudSource: 'cloud',
      weatherCode,
      weatherLabel: weather.weatherLabel,
      weatherIcon: weather.weatherIcon,
      sunriseWindow: sunriseWindowInfo.label,
      sunriseSampleCount: sunriseItems.length,
    };
  });

  return {
    updatedAt: now,
    provider: 'qweather',
    current: {
      time: nowPayload.now.obsTime || nowPayload.updateTime || '',
      temperature: currentTemperature,
      humidity: currentHumidity,
      windSpeed: round(optionalNumber(nowPayload.now.windSpeed, 0) / 3.6, 1),
      precipitation: optionalNumber(nowPayload.now.precip, 0),
      cloud: currentCloud,
      dewPoint: currentDewPoint,
      dewPointGap: currentDewPointGap,
      pressure: optionalNumber(nowPayload.now.pressure),
      visibility: currentVisibility,
      lowCloud: currentCloud,
      lowCloudSource: 'cloud',
      weatherCode: currentCode,
      weatherLabel: currentWeather.weatherLabel,
      weatherIcon: currentWeather.weatherIcon,
    },
    dailyForecasts,
  };
}
