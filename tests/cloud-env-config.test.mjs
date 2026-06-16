import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('cloud calls use an explicit CloudBase environment id from config', async () => {
  const [config, app, weatherService] = await Promise.all([
    readFile(new URL('../config/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../services/weather/index.js', import.meta.url), 'utf8'),
  ]);

  assert.match(config, /envId:/);
  assert.match(app, /cloudbaseTemplateConfig/);
  assert.match(app, /env:\s*cloudbaseTemplateConfig\.envId/);
  assert.match(weatherService, /cloudbaseTemplateConfig\.envId/);
  assert.match(weatherService, /请先配置云开发环境ID/);
});
