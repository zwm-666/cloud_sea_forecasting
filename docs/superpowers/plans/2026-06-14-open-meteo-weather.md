# Open-Meteo Weather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace simulated homepage weather with real Open-Meteo current and hourly forecast data, with local caching and a safe simulated fallback.

**Architecture:** Keep WeChat-specific network and storage calls in `services/weather/index.js`. Put pure normalization, cache, weather-code mapping, and cloud-sea probability logic in `services/weather/logic.js` so it can be tested with Node's built-in test runner. Keep the existing homepage layout, but make `pages/index/index.js` call the weather service and rebuild its existing view models from normalized weather data.

**Tech Stack:** WeChat Mini Program JavaScript, `wx.request`, `wx.getStorageSync`, `wx.setStorageSync`, Open-Meteo Forecast API, Node built-in `node:test` for pure logic tests.

---

## File Structure

- Create `services/weather/logic.js`: pure functions for cache keys, cache freshness, weather-code mapping, Open-Meteo response normalization, and cloud-sea probability.
- Create `services/weather/index.js`: WeChat service wrapper around `wx.request` and local storage cache.
- Create `tests/weather-logic.test.mjs`: Node tests for pure logic.
- Modify `pages/index/index.js`: add mountain `slug` and coordinates; import weather service and probability helper; refresh page from API data when available; keep simulated fallback.
- Modify `package.json`: add `test` script using `node --test`.

## Task 1: Add Pure Weather Logic With Tests

**Files:**
- Create: `services/weather/logic.js`
- Create: `tests/weather-logic.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add a test script**

Update `package.json` so scripts contain:

```json
"scripts": {
  "test": "node --test tests"
}
```

- [ ] **Step 2: Write failing tests for weather logic**

Create `tests/weather-logic.test.mjs` with tests for:

- `buildWeatherCacheKey` returns ASCII slug-based keys.
- duplicate slugs are detected.
- cache is fresh at 29 minutes and stale at exactly 30 minutes.
- `mapWeatherCode` maps Open-Meteo cloudy/fog/rain codes to Chinese display values.
- `calculateCloudSeaProbability` stays within 20-96 and responds to humidity/wind changes.
- `normalizeOpenMeteoResponse` aggregates hourly daytime records into `dailyForecasts`.

Import from `../services/weather/logic.js`.

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: FAIL because `services/weather/logic.js` does not exist or exports are missing.

- [ ] **Step 4: Implement minimal pure logic**

Create `services/weather/logic.js` exporting:

```js
export const WEATHER_CACHE_TTL = 30 * 60 * 1000;

export function buildWeatherCacheKey(mountain, selectedDate) {}
export function findDuplicateSlugs(mountains) {}
export function isCacheFresh(cached, now = Date.now()) {}
export function mapWeatherCode(code) {}
export function calculateCloudSeaProbability(mountain, weather) {}
export function normalizeOpenMeteoResponse(payload, options = {}) {}
```

Implementation requirements:

- `buildWeatherCacheKey` must throw if `mountain.slug` is missing or non-ASCII.
- `findDuplicateSlugs` must return an array of duplicated slugs.
- `isCacheFresh` must return true when age is lower than 30 minutes and false when age is equal to or greater than 30 minutes.
- `mapWeatherCode` must handle clear, cloudy, fog, drizzle, rain, snow, and thunderstorm codes.
- `normalizeOpenMeteoResponse` must validate `current`, `hourly`, and `hourly.time`.
- `normalizeOpenMeteoResponse` must compute three day entries from hourly arrays and choose 06:00-18:00 local records for humidity, wind, and modal weather code.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npm test
```

Expected: PASS.

## Task 2: Add WeChat Weather Service Wrapper

**Files:**
- Create: `services/weather/index.js`
- Modify: `tests/weather-logic.test.mjs` if extra pure helpers are needed.

- [ ] **Step 1: Write failing tests for request URL construction if helper is needed**

If request URL construction is added as a pure helper in `logic.js`, write a test that a mountain with latitude and longitude produces an Open-Meteo URL containing:

```text
current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
forecast_days=3
timezone=auto
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test
```

Expected: FAIL if a new helper was added to tests before implementation.

- [ ] **Step 3: Implement `services/weather/index.js`**

Create a service that exports:

```js
export async function fetchMountainWeather(mountain, selectedDate, options = {}) {}
```

Behavior:

- Validate coordinates and slug through pure helpers.
- Build cache key from mountain slug and selected date.
- Read `wx.getStorageSync(key)` unless `options.forceRefresh` is true.
- Return cached normalized data when `isCacheFresh` is true.
- Call Open-Meteo through `wx.request`.
- Normalize response through `normalizeOpenMeteoResponse`.
- Store `{ updatedAt, data }` through `wx.setStorageSync`.
- Throw meaningful errors for request failure or invalid response.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

## Task 3: Wire Weather Data Into Homepage

**Files:**
- Modify: `pages/index/index.js`

- [ ] **Step 1: Add mountain slugs and coordinates**

Add unique ASCII `slug`, `latitude`, and `longitude` to every item in the homepage `mountains` array:

- `huangshan`: 30.132, 118.166
- `taishan`: 36.255, 117.101
- `huashan`: 34.483, 110.083
- `emeishan`: 29.517, 103.333
- `lushan`: 29.567, 115.983
- `wugongshan`: 27.467, 114.175
- `niubeishan`: 29.842, 102.298
- `fanjingshan`: 27.895, 108.703

- [ ] **Step 2: Import weather service and probability helper**

At the top of `pages/index/index.js`, import:

```js
import { fetchMountainWeather } from '../../services/weather/index';
import { calculateCloudSeaProbability } from '../../services/weather/logic';
```

- [ ] **Step 3: Preserve simulated fallback**

Keep existing `buildForecasts(mountain)` behavior as the fallback when API data is unavailable.

- [ ] **Step 4: Add weather state fields**

Add page data fields:

```js
weatherLoading: false,
weatherError: '',
weatherUpdatedAt: '',
weatherData: null
```

- [ ] **Step 5: Add an async weather refresh path**

Create `refreshWeather()` that:

- sets `weatherLoading: true`;
- calls `fetchMountainWeather(mountain, selectedDate)`;
- stores `weatherData`;
- calls `refreshPage(weatherData)`;
- on failure sets `weatherError` and calls `refreshPage(null)`;
- shows `wx.showToast({ title: '天气数据暂不可用', icon: 'none' })`;
- always clears `weatherLoading`.

- [ ] **Step 6: Rebuild forecasts from real weather**

Change `refreshPage` to accept optional normalized weather data:

- If weather data is present, build forecast cards from `weatherData.dailyForecasts`.
- Use `calculateCloudSeaProbability(mountain, dayWeather)` for probability.
- Use real `temperature`, `humidity`, `windSpeed`, `weatherLabel`, and `weatherIcon`.
- Keep `theme`, `day`, `week`, `title`, `level`, and route guide behavior.
- If weather data is absent, use the original simulated forecast output.

- [ ] **Step 7: Update selected mountain weather strip**

When real current weather is available, set a display string like:

```text
湿度 92% · 风速 2.8m/s · 实况 多云
```

Keep local `mountain.weather` as fallback.

- [ ] **Step 8: Refresh weather on page load and relevant input changes**

Change:

- `onLoad()` calls `refreshPage()` first, then `refreshWeather()`.
- `onMountainChange` resets route index, calls `refreshPage()`, then `refreshWeather()`.
- `onDateChange` calls `refreshPage()`, then `refreshWeather()`.
- `onRouteTap` only calls `refreshPage(this.data.weatherData)` because route changes should not call the weather API.

## Task 4: Verify Behavior

**Files:**
- No code changes unless verification finds a bug.

- [ ] **Step 1: Run automated tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run syntax import check**

Run:

```bash
node --check services/weather/logic.js
```

Expected: no syntax errors.

- [ ] **Step 3: Inspect changed files**

Run:

```bash
git diff -- pages/index/index.js services/weather/logic.js services/weather/index.js tests/weather-logic.test.mjs package.json
```

Expected: only weather integration changes appear.

- [ ] **Step 4: Manual WeChat DevTools verification**

Open the mini program in WeChat DevTools and verify:

- Homepage renders with fallback before weather data returns.
- Weather updates after API response.
- Switching mountain refreshes weather.
- Switching route does not call weather API.
- Network failure shows the toast and keeps fallback data.
- If request fails in DevTools with domain checking enabled, add `https://api.open-meteo.com` to the mini program legal request domain configuration.

## Self-Review Notes

- Spec coverage: API fetch, local cache, slug cache key, daily hourly aggregation, fallback behavior, no database, and tests are covered.
- Placeholders: no implementation step depends on unspecified behavior.
- Type consistency: service returns normalized `current` and `dailyForecasts`; page consumes the same fields.
