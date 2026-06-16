const LEGACY_QWEATHER_HOSTS = new Set([
  'api.qweather.com',
  'devapi.qweather.com',
]);

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

function buildQWeatherRequestUrls({ apiHost, mountain }) {
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

module.exports = {
  buildQWeatherRequestUrls,
};
