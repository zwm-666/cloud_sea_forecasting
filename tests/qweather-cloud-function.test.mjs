import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { decodeResponseBody, normalizePrivateKeyPem, privateKeyPemFromBase64 } = require('../cloudfunctions/qweatherWeather/index.js');
const { buildQWeatherRequestUrls } = require('../cloudfunctions/qweatherWeather/qweather-logic.js');

const mountain = {
  latitude: 30.132,
  longitude: 118.166,
};

test('qweather cloud function builds project API host URLs', () => {
  const urls = buildQWeatherRequestUrls({
    apiHost: 'abc1234xyz.def.qweatherapi.com',
    mountain,
  });

  assert.equal(
    urls.nowUrl,
    'https://abc1234xyz.def.qweatherapi.com/v7/weather/now?location=118.17%2C30.13&lang=zh&unit=m',
  );
  assert.equal(
    urls.dailyUrl,
    'https://abc1234xyz.def.qweatherapi.com/v7/weather/7d?location=118.17%2C30.13&lang=zh&unit=m',
  );
  assert.equal(
    urls.hourlyUrl,
    'https://abc1234xyz.def.qweatherapi.com/v7/weather/72h?location=118.17%2C30.13&lang=zh&unit=m',
  );
});

test('qweather cloud function rejects legacy shared API hosts', () => {
  assert.throws(
    () => buildQWeatherRequestUrls({ apiHost: 'api.qweather.com', mountain }),
    /project-specific host/,
  );
});

test('qweather cloud function normalizes private key PEM pasted as one line', () => {
  const oneLinePem = '-----BEGIN PRIVATE KEY-----MC4CAQAwBQYDK2VwBCIEIGiJgcxFrw92i4M2H90T0o37Vj4xhVVeeH2D3lBAQzM7-----END PRIVATE KEY-----';

  assert.equal(normalizePrivateKeyPem(oneLinePem), [
    '-----BEGIN PRIVATE KEY-----',
    'MC4CAQAwBQYDK2VwBCIEIGiJgcxFrw92i4M2H90T0o37Vj4xhVVeeH2D3lBAQzM7',
    '-----END PRIVATE KEY-----',
  ].join('\n'));
});

test('qweather cloud function rejects public key PEM for JWT signing', () => {
  assert.throws(
    () => normalizePrivateKeyPem('-----BEGIN PUBLIC KEY-----MCowBQYDK2VwAyEA0-----END PUBLIC KEY-----'),
    /PRIVATE KEY/,
  );
});

test('qweather cloud function decodes base64 private key environment value', () => {
  const pem = [
    '-----BEGIN PRIVATE KEY-----',
    'MC4CAQAwBQYDK2VwBCIEIGiJgcxFrw92i4M2H90T0o37Vj4xhVVeeH2D3lBAQzM7',
    '-----END PRIVATE KEY-----',
  ].join('\n');
  const encoded = Buffer.from(pem, 'utf8').toString('base64');

  assert.equal(privateKeyPemFromBase64(encoded), pem);
});

test('qweather cloud function does not depend on global fetch', () => {
  const source = require('fs').readFileSync(
    require('path').join(process.cwd(), 'cloudfunctions/qweatherWeather/index.js'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.match(source, /https\.request/);
});

test('qweather cloud function decodes gzip encoded JSON response body', async () => {
  const zlib = require('zlib');
  const payload = { code: '200', now: { text: '阴' } };
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));

  assert.equal(await decodeResponseBody([compressed], 'gzip'), JSON.stringify(payload));
});
