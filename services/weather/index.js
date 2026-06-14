import {
  buildOpenMeteoUrl,
  buildWeatherCacheKey,
  isCacheFresh,
  normalizeOpenMeteoResponse,
} from './logic.js';

function requestJson(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Open-Meteo request failed: ${response.statusCode}`));
          return;
        }
        resolve(response.data);
      },
      fail(error) {
        reject(new Error(error?.errMsg || 'Open-Meteo request failed'));
      },
    });
  });
}

export async function fetchMountainWeather(mountain, selectedDate, options = {}) {
  const now = options.now || Date.now();
  const cacheKey = buildWeatherCacheKey(mountain, selectedDate);

  if (!options.forceRefresh) {
    const cached = wx.getStorageSync(cacheKey);
    if (isCacheFresh(cached, now)) {
      return cached.data;
    }
  }

  const url = buildOpenMeteoUrl(mountain);
  const payload = await requestJson(url.toString());
  const data = normalizeOpenMeteoResponse(payload, { mountain, selectedDate, now });

  wx.setStorageSync(cacheKey, {
    updatedAt: now,
    data,
  });

  return data;
}
