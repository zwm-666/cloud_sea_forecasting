import {
  buildWeatherCacheKey,
  isCacheFresh,
  normalizeQWeatherResponse,
} from './logic.js';
import { cloudbaseTemplateConfig } from '../../config/index.js';

function ensureCloudReady() {
  if (!cloudbaseTemplateConfig.envId) {
    throw new Error('请先配置云开发环境ID：config/index.js 的 cloudbaseTemplateConfig.envId');
  }
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    throw new Error('Cloud functions are required for QWeather requests');
  }
}

function requestQWeatherPayload(mountain, selectedDate) {
  ensureCloudReady();
  console.info('[weather] cloud request start:', {
    provider: 'qweather',
    mountain: mountain.name,
    slug: mountain.slug,
    selectedDate,
  });

  return wx.cloud.callFunction({
    name: 'qweatherWeather',
    config: {
      env: cloudbaseTemplateConfig.envId,
    },
    data: {
      mountain: {
        name: mountain.name,
        slug: mountain.slug,
        latitude: mountain.latitude,
        longitude: mountain.longitude,
      },
      selectedDate,
    },
  }).then((response) => {
    console.info('[weather] cloud response:', response.result);
    if (!response.result || response.result.ok !== true) {
      throw new Error(response.result?.message || 'QWeather cloud function failed');
    }
    return response.result.payload;
  });
}

export async function fetchMountainWeather(mountain, selectedDate, options = {}) {
  const now = options.now || Date.now();
  const cacheKey = buildWeatherCacheKey(mountain, selectedDate);
  console.info('[weather] fetch start:', {
    provider: 'qweather',
    mountain: mountain.name,
    slug: mountain.slug,
    selectedDate,
    cacheKey,
  });

  const cached = wx.getStorageSync(cacheKey);
  console.info('[weather] cache state:', cacheKey, cached);

  try {
    const payload = await requestQWeatherPayload(mountain, selectedDate);
    const data = normalizeQWeatherResponse(payload, { mountain, selectedDate, now });

    wx.setStorageSync(cacheKey, {
      updatedAt: now,
      data,
    });

    return data;
  } catch (error) {
    if (!options.forceRefresh && isCacheFresh(cached, now)) {
      console.warn('[weather] request failed, fallback to cache:', cacheKey, error);
      return cached.data;
    }
    throw error;
  }
}
