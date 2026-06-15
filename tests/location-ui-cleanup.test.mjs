import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('index page does not expose user location UI or permission', async () => {
  const [wxml, wxss, js, appJson] = await Promise.all([
    readFile(new URL('../pages/index/index.wxml', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxss', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.json', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(wxml, /当前位置|使用定位|onLocationInput|onUseLocation|locationText|locate-button/);
  assert.match(wxml, /出行指南/);
  assert.doesNotMatch(wxml, /定位出行指南/);

  assert.doesNotMatch(wxss, /text-input|locate-button/);
  assert.doesNotMatch(js, /locationText|onLocationInput|onUseLocation|wx\.getLocation/);
  assert.doesNotMatch(appJson, /scope\.userLocation/);
});
