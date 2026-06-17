import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEATHER_CACHE_TTL,
  calculateCloudSeaPrediction,
  buildQWeatherRequestUrls,
  buildWeatherCacheKey,
  calculateCloudSeaProbability,
  findDuplicateSlugs,
  isCacheFresh,
  mapWeatherCode,
  normalizeQWeatherResponse,
} from '../services/weather/logic.js';

const mountain = {
  name: '黄山',
  slug: 'huangshan',
  baseProbability: 70,
  window: '05:00-07:20',
  latitude: 30.132,
  longitude: 118.166,
};

test('buildWeatherCacheKey uses ascii slug and selected date', () => {
  assert.equal(buildWeatherCacheKey(mountain, '2026-06-14'), 'weather:v4:huangshan:2026-06-14');
  assert.throws(
    () => buildWeatherCacheKey({ ...mountain, slug: '黄山' }, '2026-06-14'),
    /ASCII/,
  );
});

test('findDuplicateSlugs returns only repeated slugs', () => {
  const duplicates = findDuplicateSlugs([
    { slug: 'huangshan' },
    { slug: 'taishan' },
    { slug: 'huangshan' },
    { slug: 'huashan' },
    { slug: 'taishan' },
  ]);

  assert.deepEqual(duplicates, ['huangshan', 'taishan']);
});

test('isCacheFresh treats exactly 30 minutes as stale', () => {
  const now = 1_000_000;

  assert.equal(isCacheFresh({ updatedAt: now - WEATHER_CACHE_TTL + 1 }, now), true);
  assert.equal(isCacheFresh({ updatedAt: now - WEATHER_CACHE_TTL }, now), false);
  assert.equal(isCacheFresh({ updatedAt: now - WEATHER_CACHE_TTL - 1 }, now), false);
  assert.equal(isCacheFresh(null, now), false);
});

test('mapWeatherCode maps common QWeather icon codes', () => {
  assert.deepEqual(mapWeatherCode(100), { weatherLabel: '晴天', weatherIcon: '☀' });
  assert.deepEqual(mapWeatherCode(101), { weatherLabel: '多云', weatherIcon: '☁' });
  assert.deepEqual(mapWeatherCode(104), { weatherLabel: '阴天', weatherIcon: '☁' });
  assert.deepEqual(mapWeatherCode(305), { weatherLabel: '小雨', weatherIcon: '🌧' });
  assert.deepEqual(mapWeatherCode(501), { weatherLabel: '雾', weatherIcon: '☁' });
});

test('buildQWeatherRequestUrls uses https API host and QWeather v7 endpoints', () => {
  const urls = buildQWeatherRequestUrls({
    apiHost: 'abc1234xyz.def.qweatherapi.com',
    mountain,
  });
  const nowUrl = new URL(urls.nowUrl);
  const dailyUrl = new URL(urls.dailyUrl);
  const hourlyUrl = new URL(urls.hourlyUrl);

  assert.equal(nowUrl.origin, 'https://abc1234xyz.def.qweatherapi.com');
  assert.equal(nowUrl.pathname, '/v7/weather/now');
  assert.equal(hourlyUrl.pathname, '/v7/weather/72h');
  assert.equal(dailyUrl.pathname, '/v7/weather/7d');
  assert.equal(nowUrl.searchParams.get('location'), '118.17,30.13');
  assert.equal(hourlyUrl.searchParams.get('location'), '118.17,30.13');
  assert.equal(dailyUrl.searchParams.get('location'), '118.17,30.13');
  assert.equal(nowUrl.searchParams.get('lang'), 'zh');
  assert.equal(hourlyUrl.searchParams.get('unit'), 'm');
  assert.equal(dailyUrl.searchParams.get('unit'), 'm');
});

test('buildQWeatherRequestUrls rejects legacy shared domains', () => {
  assert.throws(
    () => buildQWeatherRequestUrls({ apiHost: 'https://devapi.qweather.com', mountain }),
    /API Host/,
  );
});

test('buildQWeatherRequestUrls does not depend on global URL constructor', () => {
  const OriginalURL = globalThis.URL;
  globalThis.URL = undefined;

  try {
    const urls = buildQWeatherRequestUrls({ apiHost: 'abc1234xyz.def.qweatherapi.com', mountain });
    assert.match(urls.nowUrl, /^https:\/\/abc1234xyz\.def\.qweatherapi\.com\/v7\/weather\/now\?/);
    assert.match(urls.hourlyUrl, /\/v7\/weather\/72h\?/);
    assert.match(urls.dailyUrl, /location=118\.17%2C30\.13/);
  } finally {
    globalThis.URL = OriginalURL;
  }
});

test('calculateCloudSeaProbability estimates perfect sunrise cloud-sea conditions', () => {
  const favorable = calculateCloudSeaProbability(mountain, {
    humidity: 96,
    windSpeed: 1.4,
    temperature: 14,
    temperatureMin: 12,
    temperatureMax: 21,
    cloud: 68,
    dewPoint: 13.2,
    dewPointGap: 0.8,
    visibility: 1.2,
    precipitation: 0,
    weatherCode: 501,
  }, {
    previousWeather: {
      humidity: 91,
      cloud: 80,
      precipitation: 5,
      temperatureMax: 22,
      weatherCode: 305,
    },
  });
  const dryWindy = calculateCloudSeaProbability(mountain, {
    humidity: 42,
    windSpeed: 9.5,
    temperature: 26,
    temperatureMin: 22,
    temperatureMax: 30,
    cloud: 5,
    dewPoint: 8,
    dewPointGap: 18,
    visibility: 15,
    precipitation: 0,
    weatherCode: 100,
  });

  assert.equal(favorable <= 98, true);
  assert.equal(dryWindy >= 2, true);
  assert.equal(favorable > dryWindy, true);
  assert.equal(favorable >= 75, true);
});

test('calculateCloudSeaPrediction returns perfect sunrise score, level, and reasons', () => {
  const result = calculateCloudSeaPrediction(mountain, {
    humidity: 96,
    windSpeed: 1.2,
    temperature: 14,
    temperatureMin: 13,
    temperatureMax: 21,
    precipitation: 0,
    cloud: 64,
    dewPoint: 13.3,
    dewPointGap: 0.7,
    visibility: 1.2,
    weatherCode: 501,
  }, {
    previousWeather: {
      humidity: 90,
      cloud: 85,
      precipitation: 6,
      temperatureMax: 20,
      weatherCode: 305,
    },
  });

  assert.equal(result.probability >= 75, true);
  assert.equal(['完美机会高', '完美机会极高'].includes(result.level), true);
  assert.equal(result.rainGate.label, '日出窗口无降水');
  assert.equal(result.scores.moistureScore >= 9, true);
  assert.equal(result.reasons.includes('日出湿度接近饱和'), true);
});

test('calculateCloudSeaPrediction caps rainy sunrise windows', () => {
  const rainyTarget = calculateCloudSeaPrediction(mountain, {
    humidity: 96,
    windSpeed: 0.8,
    temperature: 24,
    temperatureMin: 19,
    temperatureMax: 29,
    precipitation: 0,
    cloud: 70,
    dewPoint: 23.1,
    dewPointGap: 0.9,
    visibility: 24,
    weatherCode: 305,
  });

  assert.equal(rainyTarget.probability <= 18, true);
  assert.equal(rainyTarget.isRainy, true);
  assert.equal(rainyTarget.level, '不适合冲顶');
  assert.equal(rainyTarget.reasons[0], '日出窗口可能下雨');
});

test('calculateCloudSeaPrediction is slightly more permissive for marginal dry sunrise windows', () => {
  const marginal = calculateCloudSeaPrediction(mountain, {
    humidity: 82,
    windSpeed: 3.6,
    temperature: 16,
    temperatureMin: 13,
    temperatureMax: 20,
    precipitation: 0,
    cloud: 38,
    dewPoint: 12.8,
    dewPointGap: 3.2,
    visibility: 6,
    weatherCode: 101,
  }, {
    previousWeather: {
      humidity: 84,
      cloud: 70,
      precipitation: 1.2,
      temperatureMax: 21,
      weatherCode: 305,
    },
  });

  assert.equal(marginal.isRainy, false);
  assert.equal(marginal.probability >= 45, true);
  assert.equal(marginal.probability < 75, true);
});

test('calculateCloudSeaPrediction rewards prior moisture only when sunrise is dry', () => {
  const rainy = calculateCloudSeaPrediction(mountain, {
    humidity: 96,
    windSpeed: 0.8,
    temperature: 24,
    temperatureMin: 19,
    temperatureMax: 29,
    precipitation: 0.8,
    cloud: 70,
    dewPoint: 23.1,
    dewPointGap: 0.9,
    visibility: 24,
    weatherCode: 305,
  }, {
    previousWeather: {
      humidity: 90,
      cloud: 82,
      precipitation: 5,
      temperatureMax: 26,
      weatherCode: 305,
    },
  });
  const afterRainDry = calculateCloudSeaPrediction(mountain, {
    humidity: 93,
    windSpeed: 1.4,
    temperature: 20,
    temperatureMin: 16,
    temperatureMax: 25,
    precipitation: 0,
    cloud: 65,
    dewPoint: 18.8,
    dewPointGap: 1.2,
    visibility: 2,
    weatherCode: 101,
  }, {
    previousWeather: {
      humidity: 91,
      cloud: 86,
      precipitation: 6,
      temperatureMax: 24,
      weatherCode: 305,
    },
  });

  assert.equal(rainy.probability <= 18, true);
  assert.equal(rainy.isRainy, true);
  assert.equal(afterRainDry.isRainy, false);
  assert.equal(afterRainDry.probability > rainy.probability, true);
  assert.equal(afterRainDry.scores.moistureScore >= 9, true);
});

test('calculateCloudSeaPrediction gives dry but poor sunrise windows a low chance', () => {
  const cloudy = calculateCloudSeaPrediction(mountain, {
    humidity: 54,
    windSpeed: 7.8,
    temperature: 28,
    temperatureMin: 21,
    temperatureMax: 35,
    precipitation: 0,
    cloud: 7,
    dewPoint: 15.6,
    dewPointGap: 12.4,
    visibility: 25,
    weatherCode: 100,
  });

  assert.equal(cloudy.isRainy, false);
  assert.equal(cloudy.probability < 25, true);
});

test('normalizeQWeatherResponse uses current and daily QWeather fields', () => {
  const payload = {
    nowPayload: {
      code: '200',
      updateTime: '2026-06-14T08:00+08:00',
      now: {
        obsTime: '2026-06-14T07:50+08:00',
        temp: '18',
        icon: '104',
        text: '阴',
        windSpeed: '10',
        humidity: '92',
        precip: '0.0',
        cloud: '90',
        dew: '16.6',
        pressure: '906',
        vis: '4',
      },
    },
    hourlyPayload: {
      code: '200',
      hourly: [
        { fxTime: '2026-06-14T06:00+08:00', temp: '17', windSpeed: '9', humidity: '90', precip: '0.1', cloud: '84', dew: '15.3', pressure: '905', icon: '104', text: '阴' },
        { fxTime: '2026-06-14T07:00+08:00', temp: '18', windSpeed: '11', humidity: '92', precip: '0.2', cloud: '88', dew: '16.5', pressure: '906', icon: '104', text: '阴' },
        { fxTime: '2026-06-15T06:00+08:00', temp: '15', windSpeed: '8', humidity: '94', precip: '0.3', cloud: '91', dew: '14.0', pressure: '907', icon: '501', text: '雾' },
        { fxTime: '2026-06-16T06:00+08:00', temp: '13', windSpeed: '5', humidity: '96', precip: '0.0', cloud: '95', dew: '12.4', pressure: '908', icon: '501', text: '雾' },
      ],
    },
    dailyPayload: {
      code: '200',
      updateTime: '2026-06-14T08:00+08:00',
      daily: [
        { fxDate: '2026-06-14', tempMax: '21', tempMin: '15', iconDay: '305', textDay: '小雨', windSpeedDay: '11', humidity: '88', precip: '0.7', cloud: '86', pressure: '905', vis: '5' },
        { fxDate: '2026-06-15', tempMax: '20', tempMin: '13', iconDay: '104', textDay: '阴', windSpeedDay: '8', humidity: '93', precip: '3.2', cloud: '91', pressure: '907', vis: '3' },
        { fxDate: '2026-06-16', tempMax: '19', tempMin: '12', iconDay: '501', textDay: '雾', windSpeedDay: '6', humidity: '95', precip: '0.0', cloud: '95', pressure: '908', vis: '1' },
      ],
    },
  };

  const result = normalizeQWeatherResponse(payload, {
    selectedDate: '2026-06-14',
    mountain,
    now: 123456789,
  });

  assert.equal(result.updatedAt, 123456789);
  assert.deepEqual(result.current, {
    time: '2026-06-14T07:50+08:00',
    temperature: 18,
    humidity: 92,
    windSpeed: 2.8,
    precipitation: 0,
    cloud: 90,
    dewPoint: 16.6,
    dewPointGap: 1.4,
    pressure: 906,
    visibility: 4,
    lowCloud: 90,
    lowCloudSource: 'cloud',
    weatherCode: 104,
    weatherLabel: '阴',
    weatherIcon: '☁',
  });
  assert.equal(result.dailyForecasts.length, 3);
  assert.equal(result.dailyForecasts[0].date, '2026-06-14');
  assert.equal(result.dailyForecasts[0].temperature, 18);
  assert.equal(result.dailyForecasts[0].temperatureMin, 15);
  assert.equal(result.dailyForecasts[0].temperatureMax, 21);
  assert.equal(result.dailyForecasts[0].precipitation, 0.3);
  assert.equal(result.dailyForecasts[0].windSpeed, 2.8);
  assert.equal(result.dailyForecasts[0].cloud, 86);
  assert.equal(result.dailyForecasts[0].dewPoint, 15.9);
  assert.equal(result.dailyForecasts[0].pressure, 906);
  assert.equal(result.dailyForecasts[0].visibility, 5);
  assert.equal(result.dailyForecasts[0].lowCloud, 86);
  assert.equal(result.dailyForecasts[0].lowCloudSource, 'cloud');
  assert.equal(result.dailyForecasts[0].weatherCode, 104);
  assert.equal(result.dailyForecasts[0].weatherLabel, '阴');
  assert.equal(result.dailyForecasts[0].sunriseWindow, '05:00-07:20');
  assert.equal(result.dailyForecasts[0].sunriseSampleCount, 2);
  assert.equal(result.dailyForecasts[1].weatherCode, 501);
  assert.equal(result.dailyForecasts[2].weatherCode, 501);
});

test('normalizeQWeatherResponse keeps first forecast date equal to selected date', () => {
  const payload = {
    nowPayload: {
      code: '200',
      now: {
        obsTime: '2026-06-14T20:00+08:00',
        temp: '9',
        icon: '104',
        text: '阴',
        windSpeed: '1',
        humidity: '97',
      },
    },
    dailyPayload: {
      code: '200',
      daily: [
        { fxDate: '2026-06-15', tempMax: '22', tempMin: '16', iconDay: '101', textDay: '多云', windSpeedDay: '7', humidity: '80', precip: '0.0' },
        { fxDate: '2026-06-16', tempMax: '21', tempMin: '15', iconDay: '104', textDay: '阴', windSpeedDay: '8', humidity: '88', precip: '0.2' },
        { fxDate: '2026-06-17', tempMax: '21', tempMin: '14', iconDay: '104', textDay: '阴', windSpeedDay: '11', humidity: '90', precip: '0.7' },
        { fxDate: '2026-06-18', tempMax: '22', tempMin: '13', iconDay: '101', textDay: '多云', windSpeedDay: '12', humidity: '82', precip: '3.2' },
        { fxDate: '2026-06-19', tempMax: '23', tempMin: '12', iconDay: '100', textDay: '晴', windSpeedDay: '6', humidity: '76', precip: '0.0' },
      ],
    },
  };

  const result = normalizeQWeatherResponse(payload, {
    selectedDate: '2026-06-17',
    mountain,
    now: 123456789,
  });

  assert.deepEqual(result.dailyForecasts.map((item) => item.date), [
    '2026-06-17',
    '2026-06-18',
    '2026-06-19',
  ]);
  assert.equal(result.dailyForecasts[0].weatherCode, 104);
  assert.equal(result.dailyForecasts[0].temperatureMin, 14);
  assert.equal(result.dailyForecasts[0].temperatureMax, 21);
  assert.equal(result.dailyForecasts[0].precipitation, 0.7);
});

test('normalizeQWeatherResponse throws when selected three-day range is missing', () => {
  assert.throws(
    () => normalizeQWeatherResponse({
      nowPayload: { code: '200', now: { obsTime: '2026-06-15T08:00+08:00', temp: '18', icon: '101', text: '多云', windSpeed: '7', humidity: '80' } },
      dailyPayload: {
        code: '200',
        daily: [
          { fxDate: '2026-06-15', tempMax: '22', tempMin: '16', iconDay: '101', textDay: '多云', windSpeedDay: '7', humidity: '80', precip: '0.0' },
        ],
      },
    }, { selectedDate: '2026-06-15', mountain }),
    /QWeather daily data missing date 2026-06-16/,
  );
});
