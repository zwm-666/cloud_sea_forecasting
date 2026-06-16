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

function summarizeHourly(items) {
  if (!items.length) return {};

  const windSpeedKmh = average(items.map((item) => item.windSpeed));

  return {
    temperature: roundOptional(average(items.map((item) => item.temp))),
    humidity: roundOptional(average(items.map((item) => item.humidity))),
    cloud: roundOptional(average(items.map((item) => item.cloud))),
    windSpeed: Number.isFinite(windSpeedKmh) ? round(windSpeedKmh / 3.6, 1) : null,
    precipitation: roundOptional(sum(items.map((item) => item.precip), 0), 1),
    pressure: roundOptional(average(items.map((item) => item.pressure))),
    dewPoint: roundOptional(average(items.map((item) => item.dew)), 1),
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

function scorePrecipitation(precipitation) {
  if (!Number.isFinite(precipitation) || precipitation <= 0) return 0;
  if (precipitation <= 1) return 6;
  if (precipitation <= 5) return 14;
  if (precipitation <= 15) return 20;
  if (precipitation <= 30) return 12;
  return 6;
}

function scoreWetCloud(humidity, cloud) {
  if (humidity >= 85 && cloud >= 70) return 8;
  if (humidity >= 75 && cloud >= 60) return 5;
  if (humidity >= 65 && cloud >= 50) return 2;
  return 0;
}

function scoreHumidity(humidity) {
  if (humidity >= 95) return 20;
  if (humidity >= 90) return 17;
  if (humidity >= 85) return 13;
  if (humidity >= 80) return 9;
  if (humidity >= 70) return 5;
  return 0;
}

function scoreDewPointGap(gap) {
  if (!Number.isFinite(gap)) return 0;
  if (gap <= 1) return 15;
  if (gap <= 2) return 12;
  if (gap <= 3) return 8;
  if (gap <= 5) return 4;
  return 0;
}

function scoreWindSpeed(windSpeed) {
  if (windSpeed <= 1.5) return 15;
  if (windSpeed <= 3) return 12;
  if (windSpeed <= 5) return 6;
  if (windSpeed <= 7) return 2;
  return 0;
}

function scoreCloudCover(cloud) {
  if (!Number.isFinite(cloud)) return 0;
  if (cloud >= 20 && cloud <= 70) return 10;
  if (cloud > 70 && cloud <= 90) return 6;
  if (cloud >= 5 && cloud < 20) return 5;
  if (cloud > 90) return 2;
  return 1;
}

function scoreNightCooling(weather, previousWeather) {
  let cooling = null;
  if (Number.isFinite(previousWeather?.temperatureMax) && Number.isFinite(weather?.temperatureMin)) {
    cooling = previousWeather.temperatureMax - weather.temperatureMin;
  } else if (Number.isFinite(weather?.temperatureMax) && Number.isFinite(weather?.temperatureMin)) {
    cooling = (weather.temperatureMax - weather.temperatureMin) * 0.65;
  }

  if (!Number.isFinite(cooling)) return 0;
  if (cooling >= 6) return 10;
  if (cooling >= 4) return 8;
  if (cooling >= 2) return 5;
  if (cooling > 0) return 2;
  return 0;
}

function parseAltitude(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function scoreTerrain(mountain) {
  const altitudeDiff = Number(mountain?.altitudeDiff);
  if (Number.isFinite(altitudeDiff)) {
    if (altitudeDiff >= 600) return 10;
    if (altitudeDiff >= 400) return 8;
    if (altitudeDiff >= 200) return 5;
    if (altitudeDiff >= 100) return 2;
    return 0;
  }

  const altitude = parseAltitude(mountain?.altitude);
  if (!Number.isFinite(altitude)) return 5;
  if (altitude >= 2500) return 10;
  if (altitude >= 1600) return 8;
  if (altitude >= 1000) return 5;
  if (altitude >= 600) return 2;
  return 0;
}

function scoreVisibility(visibility) {
  if (!Number.isFinite(visibility)) return 0;
  if (visibility < 0.2) return -5;
  if (visibility <= 2) return 5;
  if (visibility <= 5) return 3;
  if (visibility <= 10) return 1;
  return 0;
}

function scoreWeatherTransition(weather, previousWeather) {
  const currentCode = numericWeatherCode(weather);
  const previousCode = numericWeatherCode(previousWeather);
  const currentClearLike = isClearLikeCode(currentCode);

  if (previousWeather) {
    if (isRainyCode(previousCode) && currentClearLike) return 15;
    if (isRainyCode(previousCode) && [104, 154].includes(currentCode)) return 12;
    if (isRainyCode(previousCode) && isWetCloudyCode(currentCode)) return 10;
    if ([104, 154].includes(previousCode) && currentClearLike) return 13;
    if (isWetCloudyCode(previousCode) && currentClearLike) return 10;
  }

  if (isRainyCode(currentCode)) return 0;
  if (isWetCloudyCode(currentCode)) return 8;
  if ([100, 150].includes(currentCode)) return 3;
  return 0;
}

function sigmoidProbability(score) {
  const probability = 1 / (1 + Math.exp(-0.09 * (score - 58)));
  return Math.min(98, Math.max(2, Math.round(probability * 100)));
}

function cloudSeaLevel(probability) {
  if (probability >= 90) return { level: '极高机会', guideLevel: '极有可能出现云海' };
  if (probability >= 75) return { level: '很高机会', guideLevel: '云海概率很高' };
  if (probability >= 60) return { level: '较高机会', guideLevel: '云海概率较高' };
  if (probability >= 40) return { level: '中等机会', guideLevel: '云海概率中等' };
  if (probability >= 20) return { level: '一定机会', guideLevel: '有一定机会出现云海' };
  return { level: '概率较低', guideLevel: '云海概率较低' };
}

function viewingRainCap(weatherCode, precipitation) {
  if (isBadRainCode(weatherCode) || precipitation >= 10) return 8;
  if (precipitation >= 3) return 12;
  if (isRainyCode(weatherCode)) return 18;
  if (precipitation > 0.1) return 45;
  if (precipitation > 0) return 55;
  return 98;
}

function viewingProbabilityFloor({ weatherCode, precipitation, previousWeather, humidity, windSpeed, cloud }) {
  if (viewingRainCap(weatherCode, precipitation) < 98) return 0;
  const previousCode = numericWeatherCode(previousWeather);

  if (previousWeather && isRainyCode(previousCode)) {
    if (isClearLikeCode(weatherCode)) return 72;
    if (isWetCloudyCode(weatherCode)) return 55;
    return 45;
  }

  if (isWetCloudyCode(weatherCode)) {
    if (humidity >= 85 && windSpeed <= 3) return 35;
    if (humidity >= 75 && windSpeed <= 5) return 25;
    return 18;
  }

  if (isClearLikeCode(weatherCode) && humidity >= 85 && windSpeed <= 3 && cloud >= 20 && cloud <= 80) return 45;
  return 0;
}

function scorePenalty({ weather, humidity, windSpeed, cloud, dewGap, precipitation, weatherCode }) {
  const penalties = [];
  if (isBadRainCode(weatherCode) || precipitation >= 10) penalties.push(-40);
  else if (precipitation >= 3) penalties.push(-35);
  else if (isRainyCode(weatherCode)) penalties.push(-30);
  else if (precipitation > 0.1) penalties.push(-15);
  else if (precipitation > 0) penalties.push(-8);
  if (windSpeed > 7) penalties.push(-20);
  if (humidity < 65) penalties.push(-20);
  if (Number.isFinite(dewGap) && dewGap > 7) penalties.push(-15);
  if (cloud > 95 && [104, 154].includes(weatherCode)) penalties.push(-10);
  if (precipitation > 30 && (isRainyCode(weatherCode) || [104, 154].includes(weatherCode))) penalties.push(-20);
  if ([100, 150].includes(weatherCode) && humidity < 60) penalties.push(-15);
  if (Number.isFinite(weather?.temperature) && weather.temperature >= 28 && humidity < 75) penalties.push(-6);

  return Math.max(-40, penalties.reduce((total, penalty) => total + penalty, 0));
}

function mainReasons(scores, weather) {
  const reasons = [];
  const weatherCode = numericWeatherCode(weather);
  const precipitation = Number.isFinite(weather?.precipitation) ? weather.precipitation : 0;
  if (isRainyCode(weatherCode) || precipitation > 0) reasons.push('当天降雨影响观赏');
  if (scores.moistureScore >= 12) reasons.push('水汽积累较好');
  if (scores.transitionScore >= 10) reasons.push('阴雨后转多云/晴');
  if (scores.humidityScore >= 13) reasons.push('清晨湿度高');
  if (scores.dewPointScore >= 8) reasons.push('露点差小');
  if (scores.windScore >= 12) reasons.push('风速较小');
  if (scores.cloudScore >= 8) reasons.push('云量适中');
  if (scores.terrainScore >= 8) reasons.push('观景点海拔有利');
  if (scores.penaltyScore <= -15) reasons.push('存在不利天气');
  if (!reasons.length && Number.isFinite(weather?.humidity)) reasons.push('天气条件一般');
  return reasons.slice(0, 4);
}

export function calculateCloudSeaPrediction(mountain, weather = {}, context = {}) {
  const previousWeather = context.previousWeather || weather.previousWeather || null;
  const weatherCode = numericWeatherCode(weather);
  const previousHumidity = Number.isFinite(previousWeather?.humidity) ? previousWeather.humidity : null;
  const previousCloud = Number.isFinite(previousWeather?.cloud) ? previousWeather.cloud : null;
  const previousPrecipitation = Number.isFinite(previousWeather?.precipitation) ? previousWeather.precipitation : null;
  const humidity = Number.isFinite(weather?.humidity) ? weather.humidity : 70;
  const cloud = Number.isFinite(weather?.cloud) ? weather.cloud : 50;
  const windSpeed = Number.isFinite(weather?.windSpeed) ? weather.windSpeed : 5;
  const precipitation = Number.isFinite(weather?.precipitation) ? weather.precipitation : 0;
  const temperature = Number.isFinite(weather?.temperature) ? weather.temperature : 18;
  const dewPoint = Number.isFinite(weather?.dewPoint) ? weather.dewPoint : calculateDewPoint(temperature, humidity);
  const dewGap = Number.isFinite(weather?.dewPointGap) ? weather.dewPointGap : dewPointGap(temperature, dewPoint);
  const visibility = Number.isFinite(weather?.visibility) ? weather.visibility : null;

  const moistureSourcePrecipitation = Number.isFinite(previousPrecipitation) ? previousPrecipitation : precipitation;
  const moistureSourceHumidity = Number.isFinite(previousHumidity) ? previousHumidity : humidity;
  const moistureSourceCloud = Number.isFinite(previousCloud) ? previousCloud : cloud;
  const moistureMultiplier = previousWeather ? 1 : 0.7;
  const moistureScore = Math.round(Math.min(
    20,
    (scorePrecipitation(moistureSourcePrecipitation) + scoreWetCloud(moistureSourceHumidity, moistureSourceCloud)) * moistureMultiplier,
  ));
  const transitionScore = scoreWeatherTransition(weather, previousWeather);
  const humidityScore = scoreHumidity(humidity);
  const dewPointScore = scoreDewPointGap(dewGap);
  const windScore = scoreWindSpeed(windSpeed);
  const cloudScore = scoreCloudCover(cloud);
  const coolingScore = scoreNightCooling(weather, previousWeather);
  const terrainScore = scoreTerrain(mountain);
  const visibilityScore = scoreVisibility(visibility);
  const penaltyScore = scorePenalty({
    weather,
    humidity,
    windSpeed,
    cloud,
    dewGap,
    precipitation,
    weatherCode,
  });

  const rawScore = moistureScore
    + transitionScore
    + humidityScore
    + dewPointScore
    + windScore
    + cloudScore
    + coolingScore
    + terrainScore
    + visibilityScore
    + penaltyScore;
  const score = Math.round(clamp(rawScore, 0, 100));
  const rainCap = viewingRainCap(weatherCode, precipitation);
  const probabilityFloor = viewingProbabilityFloor({
    weatherCode,
    precipitation,
    previousWeather,
    humidity,
    windSpeed,
    cloud,
  });
  const probability = Math.min(Math.max(sigmoidProbability(score), probabilityFloor), rainCap);
  const level = cloudSeaLevel(probability);
  const scores = {
    moistureScore,
    transitionScore,
    humidityScore,
    dewPointScore,
    windScore,
    cloudScore,
    coolingScore,
    terrainScore,
    visibilityScore,
    penaltyScore,
  };

  return {
    score,
    probability,
    rainCap,
    probabilityFloor,
    isRainy: rainCap < 98,
    level: level.level,
    guideLevel: level.guideLevel,
    reasons: mainReasons(scores, weather),
    scores,
  };
}

export function calculateCloudSeaProbability(mountain, weather, context = {}) {
  return calculateCloudSeaPrediction(mountain, weather, context).probability;
}

export function normalizeQWeatherResponse(payload, options = {}) {
  const { nowPayload, hourlyPayload, dailyPayload } = payload || {};
  const { selectedDate, now = Date.now() } = options;
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

    const weatherCode = Number(daily.iconDay || daily.iconNight);
    const weather = displayWeather(weatherCode, daily.textDay || daily.textNight);
    const temperatureMin = optionalNumber(daily.tempMin);
    const temperatureMax = optionalNumber(daily.tempMax);
    const windSpeedKmh = optionalNumber(daily.windSpeedDay ?? daily.windSpeedNight, 0);
    const hourly = summarizeHourly(hourlyItemsForDate(hourlyPayload, date));
    const temperature = round((temperatureMin + temperatureMax) / 2);
    const humidity = optionalNumber(hourly.humidity, optionalNumber(daily.humidity));
    const cloud = optionalNumber(hourly.cloud, optionalNumber(daily.cloud));
    const dewPoint = optionalNumber(hourly.dewPoint, calculateDewPoint(temperature, humidity));
    const gap = dewPointGap(temperature, dewPoint);
    const visibility = optionalNumber(daily.vis);

    return {
      offset,
      date,
      temperature,
      temperatureMin,
      temperatureMax,
      precipitation: optionalNumber(hourly.precipitation, optionalNumber(daily.precip, 0)),
      humidity,
      cloud,
      windSpeed: Number.isFinite(hourly.windSpeed) ? hourly.windSpeed : round(windSpeedKmh / 3.6, 1),
      dewPoint,
      dewPointGap: gap,
      pressure: optionalNumber(hourly.pressure, optionalNumber(daily.pressure)),
      visibility,
      lowCloud: cloud,
      lowCloudSource: 'cloud',
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
