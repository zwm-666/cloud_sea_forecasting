import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('index page defines four cloud probability visual tiers', async () => {
  const js = await readFile(new URL('../pages/index/index.js', import.meta.url), 'utf8');

  assert.match(js, /function\s+buildCloudVisualTheme\s*\(/);
  assert.match(js, /晴空万里，暂难成海/);
  assert.match(js, /雾气渐起，云海蓄势/);
  assert.match(js, /云海初现，值得期待/);
  assert.match(js, /云海翻涌，正宜观赏/);
  assert.match(js, /theme-clear/);
  assert.match(js, /theme-mist/);
  assert.match(js, /theme-dawn/);
  assert.match(js, /theme-sunrise/);
  assert.match(js, /#4facfe/);
  assert.match(js, /#00f2fe/);
  assert.match(js, /#cfd9df/);
  assert.match(js, /#e2ebf0/);
  assert.match(js, /#7be7a5/);
  assert.match(js, /#18a058/);
  assert.match(js, /#18a058/);
  assert.match(js, /#0f6b43/);
});

test('index page uses TDesign progress and glass visualization shell', async () => {
  const [json, wxml, wxss] = await Promise.all([
    readFile(new URL('../pages/index/index.json', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxml', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxss', import.meta.url), 'utf8'),
  ]);

  assert.match(json, /"t-progress"\s*:\s*"tdesign-miniprogram\/progress\/progress"/);
  assert.match(wxml, /class="page \{\{visualTheme\.pageClass\}\}"/);
  assert.match(wxml, /<t-progress/);
  assert.match(wxml, /theme="circle"/);
  assert.match(wxml, /percentage="\{\{currentForecast\.probability\}\}"/);
  assert.match(wxml, /color="\{\{visualTheme\.accentColor\}\}"/);
  assert.match(wxml, /visualTheme\.prompt/);

  assert.match(wxss, /transition:\s*background 0\.8s ease/);
  assert.match(wxss, /backdrop-filter:\s*blur\(12px\)/);
  assert.match(wxss, /rgba\(255,\s*255,\s*255,\s*0\.3\)/);
  assert.match(wxss, /\.theme-clear/);
  assert.match(wxss, /\.theme-mist/);
  assert.match(wxss, /\.theme-dawn/);
  assert.match(wxss, /\.theme-sunrise/);
});

test('three-day forecast cards are themed by each day probability with greener recommendation states', async () => {
  const [js, wxml, wxss] = await Promise.all([
    readFile(new URL('../pages/index/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxml', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxss', import.meta.url), 'utf8'),
  ]);

  assert.match(js, /function\s+buildForecastCardTheme\s*\(/);
  assert.match(js, /cardTheme:\s*buildForecastCardTheme\(probability\)/);
  assert.match(wxml, /class="forecast-card \{\{item\.cardTheme\.cardClass\}\}"/);
  assert.match(wxml, /\{\{item\.cardTheme\.recommendLabel\}\}/);

  assert.match(wxss, /\.forecast-low/);
  assert.match(wxss, /\.forecast-watch/);
  assert.match(wxss, /\.forecast-good/);
  assert.match(wxss, /\.forecast-best/);
  assert.match(wxss, /#18a058/);
  assert.match(wxss, /#0f6b43/);
});

test('page background stays neutral while probability accents use greener colors', async () => {
  const [js, wxss] = await Promise.all([
    readFile(new URL('../pages/index/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxss', import.meta.url), 'utf8'),
  ]);

  assert.match(js, /pageClass:\s*'theme-sunrise'[\s\S]*?accentColor:\s*'#0f6b43'/);
  assert.match(js, /ringStyle:\s*`background: conic-gradient\(\$\{visualTheme\.accentColor\}/);
  assert.match(js, /pageClass:\s*'theme-dawn'[\s\S]*?accentColor:\s*'#18a058'/);
  assert.match(wxss, /\.page\s*\{[\s\S]*?background:\s*linear-gradient\(180deg,\s*#f7fbf8 0%,\s*#eef7f3 48%,\s*#e4f0ec 100%\)/);
  assert.match(wxss, /\.theme-sunrise\s*\{\s*\}/);
  assert.match(wxss, /\.theme-dawn\s*\{\s*\}/);
  assert.doesNotMatch(wxss, /\.theme-sunrise\s*\{[^}]*background/);
  assert.doesNotMatch(wxss, /\.theme-dawn\s*\{[^}]*background/);
});

test('forecast date numbers stay dark on all recommendation card colors', async () => {
  const wxss = await readFile(new URL('../pages/index/index.wxss', import.meta.url), 'utf8');

  assert.match(wxss, /\.date-day\s*\{[^}]*color:\s*#14312d/);
  assert.doesNotMatch(wxss, /\.forecast-best\s+\.date-day\s*\{[^}]*color:\s*#fff/);
});

test('main probability number stays dark while ring color remains data driven', async () => {
  const [wxml, wxss] = await Promise.all([
    readFile(new URL('../pages/index/index.wxml', import.meta.url), 'utf8'),
    readFile(new URL('../pages/index/index.wxss', import.meta.url), 'utf8'),
  ]);

  assert.match(wxml, /color="\{\{visualTheme\.accentColor\}\}"/);
  assert.doesNotMatch(wxml, /class="probability-number"[^>]*style="color:\s*\{\{visualTheme\.accentColor\}\}/);
  assert.match(wxss, /\.probability-number\s*\{[^}]*color:\s*#14312d/);
});

test('forecast weekday labels are calculated from actual selected dates', async () => {
  const js = await readFile(new URL('../pages/index/index.js', import.meta.url), 'utf8');

  assert.match(js, /function\s+dateFromDateString\s*\(/);
  assert.match(js, /new Date\(year,\s*month - 1,\s*day\)/);
  assert.match(js, /const baseDate = dateFromDateString\(this\.data\.selectedDate\)/);
  assert.match(js, /week:\s*weekNames\[date\.getDay\(\)\]/);
  assert.doesNotMatch(js, /new Date\(`\$\{this\.data\.selectedDate\}T00:00:00`\)/);
});
