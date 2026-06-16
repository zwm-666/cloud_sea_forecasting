import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('index page renders specific weather error details', async () => {
  const [wxml, js, wxss] = await Promise.all([
    readFile(new URL('../pages/index/index.wxml', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxss', import.meta.url), 'utf8'),
  ]);

  assert.match(wxml, /weather-error/);
  assert.match(wxml, /weatherError/);
  assert.match(js, /weatherError: errorMessage/);
  assert.match(js, /wx\.showToast\(\{ title: errorMessage/);
  assert.match(wxss, /\.weather-error/);
});
