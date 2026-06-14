import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEATHER_CACHE_TTL,
  buildOpenMeteoUrl,
  buildWeatherCacheKey,
  calculateCloudSeaProbability,
  findDuplicateSlugs,
  isCacheFresh,
  mapWeatherCode,
  normalizeOpenMeteoResponse,
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
  assert.equal(buildWeatherCacheKey(mountain, '2026-06-14'), 'weather:huangshan:2026-06-14');
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

test('mapWeatherCode maps common Open-Meteo weather codes', () => {
  assert.deepEqual(mapWeatherCode(0), { weatherLabel: '晴天', weatherIcon: '☀' });
  assert.deepEqual(mapWeatherCode(3), { weatherLabel: '阴天', weatherIcon: '☁' });
  assert.deepEqual(mapWeatherCode(45), { weatherLabel: '雾', weatherIcon: '☁' });
  assert.deepEqual(mapWeatherCode(61), { weatherLabel: '小雨', weatherIcon: '🌧' });
  assert.deepEqual(mapWeatherCode(95), { weatherLabel: '雷雨', weatherIcon: '⛈' });
});

test('buildOpenMeteoUrl includes expected forecast parameters', () => {
  const url = buildOpenMeteoUrl(mountain);

  assert.equal(url.origin, 'https://api.open-meteo.com');
  assert.equal(url.pathname, '/v1/forecast');
  assert.equal(url.searchParams.get('latitude'), '30.132');
  assert.equal(url.searchParams.get('longitude'), '118.166');
  assert.equal(
    url.searchParams.get('current'),
    'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
  );
  assert.equal(
    url.searchParams.get('hourly'),
    'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
  );
  assert.equal(url.searchParams.get('forecast_days'), '3');
  assert.equal(url.searchParams.get('timezone'), 'auto');
});

test('calculateCloudSeaProbability stays bounded and responds to weather factors', () => {
  const favorable = calculateCloudSeaProbability(mountain, {
    humidity: 94,
    windSpeed: 2.4,
    temperature: 14,
    weatherCode: 45,
  });
  const dryWindy = calculateCloudSeaProbability(mountain, {
    humidity: 42,
    windSpeed: 9.5,
    temperature: 26,
    weatherCode: 0,
  });

  assert.equal(favorable <= 96, true);
  assert.equal(dryWindy >= 20, true);
  assert.equal(favorable > dryWindy, true);
});

test('normalizeOpenMeteoResponse aggregates daytime hourly records', () => {
  const payload = {
    current: {
      time: '2026-06-14T08:00',
      temperature_2m: 18.4,
      relative_humidity_2m: 92,
      wind_speed_10m: 2.8,
      weather_code: 3,
    },
    hourly: {
      time: [
        '2026-06-14T05:00',
        '2026-06-14T06:00',
        '2026-06-14T12:00',
        '2026-06-14T18:00',
        '2026-06-15T06:00',
        '2026-06-15T12:00',
        '2026-06-15T18:00',
        '2026-06-16T06:00',
        '2026-06-16T12:00',
        '2026-06-16T18:00',
      ],
      temperature_2m: [15, 16, 22, 19, 17, 24, 20, 18, 25, 21],
      relative_humidity_2m: [94, 90, 80, 85, 88, 78, 82, 86, 76, 80],
      wind_speed_10m: [2.2, 3, 5, 4, 2, 4, 6, 3, 5, 7],
      weather_code: [45, 3, 3, 61, 3, 1, 1, 45, 45, 3],
    },
  };

  const result = normalizeOpenMeteoResponse(payload, {
    selectedDate: '2026-06-14',
    mountain,
    now: 123456789,
  });

  assert.equal(result.updatedAt, 123456789);
  assert.deepEqual(result.current, {
    time: '2026-06-14T08:00',
    temperature: 18.4,
    humidity: 92,
    windSpeed: 2.8,
    weatherCode: 3,
    weatherLabel: '阴天',
    weatherIcon: '☁',
  });
  assert.equal(result.dailyForecasts.length, 3);
  assert.equal(result.dailyForecasts[0].date, '2026-06-14');
  assert.equal(result.dailyForecasts[0].temperature, 16);
  assert.equal(result.dailyForecasts[0].humidity, 85);
  assert.equal(result.dailyForecasts[0].windSpeed, 4);
  assert.equal(result.dailyForecasts[0].weatherCode, 3);
  assert.equal(result.dailyForecasts[1].weatherCode, 1);
  assert.equal(result.dailyForecasts[2].weatherCode, 45);
});
