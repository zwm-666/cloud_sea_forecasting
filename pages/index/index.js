import { fetchMountainWeather } from '../../services/weather/index.js';
import { calculateCloudSeaProbability } from '../../services/weather/logic.js';

const mountains = [
  {
    name: '黄山',
    slug: 'huangshan',
    province: '安徽',
    city: '黄山市',
    latitude: 30.132,
    longitude: 118.166,
    altitude: '1864m',
    sunrise: '05:12',
    window: '05:00-07:20',
    weather: '湿度 92% · 风速 2.8m/s · 低云层 88%',
    baseProbability: 86,
    routes: [
      { name: '云谷寺', time: '4.5h', distance: '7.2km', difficulty: '中等', best: '始信峰', tips: ['云谷寺上山适合第一次看云海，索道可节省体力。', '北海到狮子峰一线适合拍摄翻涌云瀑。', '住宿优先选北海、排云亭或光明顶。'] },
      { name: '慈光阁', time: '6h', distance: '10.1km', difficulty: '偏难', best: '莲花峰', tips: ['适合体力较好的人，前山景观开阔但爬升更集中。', '玉屏楼到迎客松人流较多，日出前出发更顺。', '雨后转晴次日清晨云海机会高。'] },
      { name: '西海', time: '5.5h', distance: '8.4km', difficulty: '中高', best: '排云亭', tips: ['西海大峡谷视野纵深强，适合下午观察云层。', '环线台阶多，建议带登山杖和防滑鞋。', '雾大时控制节奏，优先走官方开放路段。'] },
    ],
  },
  {
    name: '泰山',
    slug: 'taishan',
    province: '山东',
    city: '泰安市',
    latitude: 36.255,
    longitude: 117.101,
    altitude: '1545m',
    sunrise: '04:55',
    window: '04:40-06:30',
    weather: '湿度 84% · 风速 3.4m/s · 低云层 68%',
    baseProbability: 72,
    routes: [
      { name: '红门', time: '5.5h', distance: '9.5km', difficulty: '中高', best: '玉皇顶', tips: ['经典徒步线，适合夜爬看日出和云海。', '中天门后台阶密集，补水和保暖要提前准备。', '云海常出现在雨后降温或清晨湿度高时。'] },
      { name: '天外村', time: '3h', distance: '6.8km', difficulty: '中等', best: '南天门', tips: ['景区车到中天门后再登顶，适合时间紧的人。', '南天门到天街风大，带防风外套。', '清晨先看天街云层，再上玉皇顶。'] },
    ],
  },
  {
    name: '华山',
    slug: 'huashan',
    province: '陕西',
    city: '渭南市',
    latitude: 34.483,
    longitude: 110.083,
    altitude: '2154m',
    sunrise: '05:26',
    window: '05:10-07:00',
    weather: '湿度 78% · 风速 4.1m/s · 低云层 66%',
    baseProbability: 64,
    routes: [
      { name: '西上北下', time: '6h', distance: '8.7km', difficulty: '中高', best: '东峰', tips: ['西峰索道上山可快速进入主峰区。', '东峰观日台云海视野最好，但清晨人多。', '风大时不建议走高风险体验项目。'] },
      { name: '玉泉院', time: '7h', distance: '12km', difficulty: '高', best: '苍龙岭', tips: ['全程爬升强，适合经验丰富的徒步者。', '夜爬需头灯、手套和分层衣物。', '云层高度合适时苍龙岭两侧容易出现云瀑。'] },
    ],
  },
  {
    name: '峨眉山',
    slug: 'emeishan',
    province: '四川',
    city: '乐山市',
    latitude: 29.517,
    longitude: 103.333,
    altitude: '3099m',
    sunrise: '06:03',
    window: '05:45-08:10',
    weather: '湿度 95% · 风速 2.2m/s · 低云层 91%',
    baseProbability: 89,
    routes: [
      { name: '雷洞坪', time: '2.5h', distance: '3.5km', difficulty: '轻中', best: '金顶', tips: ['雷洞坪住宿后清晨上金顶，最稳妥。', '金顶海拔高，保暖和防滑比速度更重要。', '雨后转晴的早晨常见壮观云海和佛光。'] },
      { name: '万年寺', time: '8h', distance: '18km', difficulty: '高', best: '洗象池', tips: ['适合两日徒步，沿途补给点多但爬升持续。', '洗象池到雷洞坪清晨云雾浓，要预留时间。', '夏季注意雨具，冬季确认冰雪路况。'] },
    ],
  },
  {
    name: '庐山',
    slug: 'lushan',
    province: '江西',
    city: '九江市',
    latitude: 29.567,
    longitude: 115.983,
    altitude: '1474m',
    sunrise: '05:18',
    window: '05:05-07:00',
    weather: '湿度 90% · 风速 2.9m/s · 低云层 79%',
    baseProbability: 80,
    routes: [
      { name: '牯岭镇', time: '3h', distance: '6km', difficulty: '轻中', best: '含鄱口', tips: ['住牯岭镇便于清晨去含鄱口看云海。', '芦林湖和五老峰适合做备选观景点。', '夏季湿度大，注意防潮和防滑。'] },
      { name: '三叠泉', time: '4.5h', distance: '7.6km', difficulty: '中等', best: '五老峰', tips: ['三叠泉台阶多，返程体力消耗明显。', '五老峰视野更开阔，适合低云层天气。', '景区交通分段，提前看末班车时间。'] },
    ],
  },
  {
    name: '武功山',
    slug: 'wugongshan',
    province: '江西',
    city: '萍乡市',
    latitude: 27.467,
    longitude: 114.175,
    altitude: '1918m',
    sunrise: '05:24',
    window: '05:05-07:30',
    weather: '湿度 88% · 风速 3.6m/s · 低云层 76%',
    baseProbability: 77,
    routes: [
      { name: '金顶', time: '4h', distance: '6.5km', difficulty: '中等', best: '金顶营地', tips: ['金顶住宿或露营可直接蹲守日出云海。', '山顶风大，帐篷和冲锋衣要靠谱。', '草甸路段雨后泥泞，鞋底抓地很关键。'] },
      { name: '反穿线', time: '9h', distance: '18km', difficulty: '高', best: '发云界', tips: ['适合有长线经验的人，沿途补给少。', '发云界到绝望坡云海层次丰富。', '天气突变快，务必保留撤退时间。'] },
    ],
  },
  {
    name: '牛背山',
    slug: 'niubeishan',
    province: '四川',
    city: '雅安市',
    latitude: 29.842,
    longitude: 102.298,
    altitude: '3660m',
    sunrise: '06:11',
    window: '05:50-08:20',
    weather: '湿度 86% · 风速 3.1m/s · 低云层 94%',
    baseProbability: 91,
    routes: [
      { name: '景区车线', time: '2h', distance: '4km', difficulty: '轻中', best: '观景平台', tips: ['高海拔地区要放慢节奏，避免剧烈运动。', '贡嘎雪山方向日出前后最震撼。', '冬季道路和住宿政策变化大，出发前确认开放情况。'] },
      { name: '徒步线', time: '6h', distance: '12km', difficulty: '高', best: '云海平台', tips: ['徒步线海拔爬升明显，需要成熟户外装备。', '云海常在雨雪后晴天出现，但体感温度低。', '建议结伴或跟随当地向导。'] },
    ],
  },
  {
    name: '梵净山',
    slug: 'fanjingshan',
    province: '贵州',
    city: '铜仁市',
    latitude: 27.895,
    longitude: 108.703,
    altitude: '2572m',
    sunrise: '05:56',
    window: '05:35-07:45',
    weather: '湿度 93% · 风速 2.6m/s · 低云层 83%',
    baseProbability: 84,
    routes: [
      { name: '东线', time: '4h', distance: '6.2km', difficulty: '中等', best: '红云金顶', tips: ['东线接驳成熟，适合第一次到访。', '红云金顶台阶窄，云雾大时按景区指引通行。', '蘑菇石附近适合拍云海翻涌。'] },
      { name: '西线', time: '5h', distance: '8km', difficulty: '中高', best: '老金顶', tips: ['西线生态感更强，体力消耗略高。', '老金顶视野开阔，低云天更容易看到层云。', '旺季门票和索道建议提前预约。'] },
    ],
  },
];

const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const cloudVisualThemes = [
  {
    max: 30,
    pageClass: 'theme-clear',
    prompt: '晴空万里，暂难成海',
    accentColor: '#1f4f8f',
    accentSoftColor: '#d8edff',
    accentTextColor: '#24384c',
    gradientStart: '#4facfe',
    gradientEnd: '#00f2fe',
    tierName: '清朗晴空',
  },
  {
    max: 60,
    pageClass: 'theme-mist',
    prompt: '雾气渐起，云海蓄势',
    accentColor: '#1f5f56',
    accentSoftColor: '#dbe8e9',
    accentTextColor: '#284653',
    gradientStart: '#cfd9df',
    gradientEnd: '#e2ebf0',
    tierName: '朦胧雾气',
  },
  {
    max: 85,
    pageClass: 'theme-dawn',
    prompt: '云海初现，值得期待',
    accentColor: '#18a058',
    accentSoftColor: '#d7f3e5',
    accentTextColor: '#0f6b43',
    gradientStart: '#7be7a5',
    gradientEnd: '#18a058',
    tierName: '破晓初现',
  },
  {
    max: 100,
    pageClass: 'theme-sunrise',
    prompt: '云海翻涌，正宜观赏',
    accentColor: '#0f6b43',
    accentSoftColor: '#d8f8e6',
    accentTextColor: '#0a4f33',
    gradientStart: '#18a058',
    gradientEnd: '#0f6b43',
    tierName: '壮观翻腾',
  },
];
const forecastCardThemes = [
  { max: 40, cardClass: 'forecast-low', recommendLabel: '不推荐' },
  { max: 60, cardClass: 'forecast-watch', recommendLabel: '可观望' },
  { max: 80, cardClass: 'forecast-good', recommendLabel: '推荐' },
  { max: 100, cardClass: 'forecast-best', recommendLabel: '强推荐' },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function levelFor(probability) {
  if (probability >= 85) return '极佳机会';
  if (probability >= 72) return '较高机会';
  if (probability >= 58) return '可尝试';
  return '谨慎出行';
}

function weatherFor(probability, offset) {
  if (probability >= 88) return { icon: '☁', label: '多云' };
  if (probability >= 76) return { icon: '☁', label: '阴天' };
  if (probability >= 62) return { icon: '🌦', label: offset === 0 ? '小雨' : '多云' };
  return { icon: '☀', label: '晴天' };
}

function buildCloudVisualTheme(cloudProbability) {
  const probability = clamp(Number(cloudProbability) || 0, 0, 100);
  return cloudVisualThemes.find((theme) => probability <= theme.max) || cloudVisualThemes[cloudVisualThemes.length - 1];
}

function buildForecastCardTheme(cloudProbability) {
  const probability = clamp(Number(cloudProbability) || 0, 0, 100);
  return forecastCardThemes.find((theme) => probability <= theme.max) || forecastCardThemes[forecastCardThemes.length - 1];
}

Page({
  data: {
    mountains,
    mountainNames: mountains.map((item) => `${item.name} · ${item.province}`),
    mountainIndex: 0,
    routeIndex: 0,
    selectedDate: formatDate(new Date()),
    currentMountain: mountains[0],
    forecasts: [],
    currentForecast: {},
    currentRoute: mountains[0].routes[0],
    factorRows: [],
    guideLines: [],
    guideRows: [],
    routeTabs: [],
    scheduleItems: [],
    weatherLoading: false,
    weatherError: '',
    weatherUpdatedAt: '',
    weatherData: null,
    weatherRequestKey: '',
    visualTheme: buildCloudVisualTheme(0),
  },

  onLoad() {
    this.refreshPage();
    this.refreshWeather();
  },

  buildForecasts(mountain) {
    const baseDate = new Date(`${this.data.selectedDate}T00:00:00`);
    return [0, 1, 2].map((offset) => {
      const date = addDays(baseDate, offset);
      const seasonal = Math.round(Math.sin(((date.getMonth() + 1) / 12) * Math.PI) * 7);
      const wave = ((date.getDate() * 7 + offset * 11 + mountain.name.length * 5) % 17) - 8;
      const probability = clamp(mountain.baseProbability + seasonal + wave, 38, 96);
      const wind = Number((2.1 + ((date.getDate() + offset) % 5) * 0.4).toFixed(1));
      const weather = weatherFor(probability, offset);
      return {
        offset,
        cardTheme: buildForecastCardTheme(probability),
        day: date.getDate(),
        week: weekNames[date.getDay()],
        title: offset === 0 ? '目标日' : `第 ${offset + 1} 天`,
        probability,
        level: levelFor(probability),
        temp: 8 + ((date.getDate() + offset + mountain.name.length) % 9),
        wind,
        humidity: clamp(probability + 1, 50, 96),
        lowCloud: clamp(probability - 5, 35, 94),
        weatherIcon: weather.icon,
        weatherLabel: weather.label,
      };
    });
  },

  buildForecastsFromWeather(mountain, weatherData) {
    const baseDate = new Date(`${this.data.selectedDate}T00:00:00`);
    return weatherData.dailyForecasts.map((dayWeather, index) => {
      const date = new Date(`${dayWeather.date || formatDate(addDays(baseDate, index))}T00:00:00`);
      const probability = calculateCloudSeaProbability(mountain, dayWeather);
      const hasTemperatureRange = Number.isFinite(dayWeather.temperatureMin) && Number.isFinite(dayWeather.temperatureMax);
      const tempText = hasTemperatureRange
        ? `${dayWeather.temperatureMin}-${dayWeather.temperatureMax}`
        : `${dayWeather.temperature}`;
      const humidity = Number.isFinite(dayWeather.humidity) ? dayWeather.humidity : probability;

      return {
        offset: index,
        cardTheme: buildForecastCardTheme(probability),
        day: date.getDate(),
        week: weekNames[date.getDay()],
        title: index === 0 ? '目标日' : `第 ${index + 1} 天`,
        probability,
        level: levelFor(probability),
        temp: dayWeather.temperature,
        tempText,
        wind: dayWeather.windSpeed,
        humidity,
        lowCloud: clamp(Math.round((humidity + probability) / 2), 35, 96),
        weatherIcon: dayWeather.weatherIcon,
        weatherLabel: dayWeather.weatherLabel,
      };
    });
  },

  buildGuide(mountain, forecast) {
    const lead = forecast.probability >= 80 ? '建议优先安排日出观景' : '建议保留备选日期';
    return [
      `前往${mountain.city}时，${lead}，核心观测窗口为 ${mountain.window}。`,
      `交通建议：先到${mountain.city}或附近高铁站，再换乘景区专线；若当天冲顶，至少提前一晚到山脚。`,
      '装备建议：防风外套、头灯、防滑鞋、热水和离线地图；云雾天气要把返程时间留足。',
    ];
  },

  buildSchedule(mountain, route) {
    return [
      { time: '前晚', title: `抵达${mountain.city}`, desc: '检查天气、门票和景区交通末班时间' },
      { time: '04:20', title: '出发上山', desc: `前往${route.best}，控制节奏并保持体温` },
      { time: mountain.sunrise, title: '日出观测', desc: `云海窗口 ${mountain.window}，先拍广角再拍细节` },
      { time: '09:30', title: '下撤补给', desc: '避开高峰路段，云雾未散可延长观景' },
    ];
  },

  buildFactors(forecast) {
    return [
      { name: '湿度', value: `${forecast.humidity}%`, width: `${forecast.humidity}%` },
      { name: '温差', value: `${forecast.temp}°C`, width: `${clamp(forecast.temp * 7, 20, 100)}%` },
      { name: '风速', value: `${forecast.wind}m/s`, width: `${clamp(100 - forecast.wind * 10, 20, 100)}%` },
      { name: '低云层', value: `${forecast.lowCloud}%`, width: `${forecast.lowCloud}%` },
    ];
  },

  buildGuideRows(lines) {
    const icons = ['⌖', '▤', '▣'];
    return lines.map((text, index) => ({
      icon: icons[index] || '▣',
      text,
    }));
  },

  buildRouteTabs(mountain) {
    return mountain.routes.map((route, index) => ({
      ...route,
      index,
      className: this.data.routeIndex === index ? 'active' : '',
    }));
  },

  refreshPage(weatherData = this.data.weatherData) {
    const mountain = mountains[this.data.mountainIndex];
    const route = mountain.routes[this.data.routeIndex] || mountain.routes[0];
    const hasWeatherData = weatherData && Array.isArray(weatherData.dailyForecasts) && weatherData.dailyForecasts.length;
    const forecasts = hasWeatherData ? this.buildForecastsFromWeather(mountain, weatherData) : this.buildForecasts(mountain);
    const currentForecast = forecasts[0];
    const visualTheme = buildCloudVisualTheme(currentForecast.probability);
    const guideLines = this.buildGuide(mountain, currentForecast);
    const weatherText = hasWeatherData
      ? `湿度 ${weatherData.current.humidity}% · 风速 ${weatherData.current.windSpeed}m/s · 实况 ${weatherData.current.weatherLabel}`
      : mountain.weather;
    this.setData({
      currentMountain: {
        ...mountain,
        weather: weatherText,
      },
      currentRoute: route,
      visualTheme,
      forecasts,
      currentForecast: {
        ...currentForecast,
        ringStyle: `background: conic-gradient(${visualTheme.accentColor} ${currentForecast.probability}%, rgba(255,255,255,0.34) 0);`,
      },
      factorRows: this.buildFactors(currentForecast),
      guideLines,
      guideRows: this.buildGuideRows(guideLines),
      routeTabs: this.buildRouteTabs(mountain),
      scheduleItems: this.buildSchedule(mountain, route),
    });
  },

  async refreshWeather() {
    const mountain = mountains[this.data.mountainIndex];
    const requestKey = `${mountain.slug}:${this.data.selectedDate}`;

    this.setData({
      weatherLoading: true,
      weatherError: '',
      weatherRequestKey: requestKey,
    });

    try {
      const weatherData = await fetchMountainWeather(mountain, this.data.selectedDate);
      if (this.data.weatherRequestKey !== requestKey) return;
      this.setData({
        weatherData,
        weatherUpdatedAt: formatDate(new Date(weatherData.updatedAt)),
      }, () => this.refreshPage(weatherData));
    } catch (error) {
      if (this.data.weatherRequestKey !== requestKey) return;
      console.error('[weather] refresh failed:', error);
      const errorMessage = error?.message || '天气数据暂不可用';
      this.setData({
        weatherData: null,
        weatherError: errorMessage,
      }, () => this.refreshPage(null));
      wx.showToast({ title: errorMessage, icon: 'none' });
    } finally {
      if (this.data.weatherRequestKey === requestKey) {
        this.setData({ weatherLoading: false });
      }
    }
  },

  onMountainChange(event) {
    this.setData({
      mountainIndex: Number(event.detail.value),
      routeIndex: 0,
      weatherData: null,
    }, () => {
      this.refreshPage(null);
      this.refreshWeather();
    });
  },

  onDateChange(event) {
    this.setData({
      selectedDate: event.detail.value,
      weatherData: null,
    }, () => {
      this.refreshPage(null);
      this.refreshWeather();
    });
  },

  onRouteTap(event) {
    this.setData({
      routeIndex: Number(event.currentTarget.dataset.index),
    }, () => this.refreshPage(this.data.weatherData));
  },
});
