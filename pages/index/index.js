import { fetchMountainWeather } from '../../services/weather/index.js';
import { calculateCloudSeaPrediction } from '../../services/weather/logic.js';

function createMountain({
  name,
  slug,
  province,
  city,
  latitude,
  longitude,
  altitude,
  sunrise,
  window,
  baseProbability,
  best = '主峰观景台',
  routeName = '核心观景线',
  difficulty = '中等',
}) {
  return {
    name,
    slug,
    province,
    city,
    latitude,
    longitude,
    altitude,
    sunrise,
    window,
    weather: '湿度 -- · 风速 -- · 低云层 --',
    baseProbability,
    routes: [
      {
        name: routeName,
        time: '4h',
        distance: '6km',
        difficulty,
        best,
        tips: [
          `优先选择${best}或附近高海拔开阔点等待日出云海。`,
          `雨后转晴或转多云的清晨，重点关注 ${window} 的观景窗口。`,
          '山区天气变化快，出发前确认景区开放、交通和索道时间。',
        ],
      },
      {
        name: '轻量游览线',
        time: '2.5h',
        distance: '4km',
        difficulty: '轻中',
        best,
        tips: [
          '适合第一次到访或天气不稳定时作为保守路线。',
          '清晨风大或能见度差时，优先选择成熟步道和近距离观景点。',
          '带好防风外套、雨具、头灯和防滑鞋，给返程留足余量。',
        ],
      },
    ],
  };
}

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
  createMountain({
    name: '恒山',
    slug: 'hengshan-shanxi',
    province: '山西',
    city: '大同市浑源县',
    latitude: 39.674,
    longitude: 113.733,
    altitude: '2016m',
    sunrise: '05:02',
    window: '04:45-06:50',
    baseProbability: 70,
    best: '天峰岭',
    routeName: '北岳主线',
  }),
  createMountain({
    name: '衡山',
    slug: 'hengshan-hunan',
    province: '湖南',
    city: '衡阳市南岳区',
    latitude: 27.254,
    longitude: 112.701,
    altitude: '1300m',
    sunrise: '05:36',
    window: '05:20-07:20',
    baseProbability: 78,
    best: '祝融峰',
    routeName: '南岳主线',
  }),
  createMountain({
    name: '嵩山',
    slug: 'songshan',
    province: '河南',
    city: '郑州市登封市',
    latitude: 34.508,
    longitude: 113.011,
    altitude: '1512m',
    sunrise: '05:18',
    window: '05:00-07:05',
    baseProbability: 68,
    best: '峻极峰',
    routeName: '太室山线',
  }),
  createMountain({
    name: '雁荡山',
    slug: 'yandangshan',
    province: '浙江',
    city: '温州市乐清市',
    latitude: 28.373,
    longitude: 121.081,
    altitude: '1057m',
    sunrise: '05:00',
    window: '04:45-06:55',
    baseProbability: 82,
    best: '灵峰景区',
    routeName: '灵峰灵岩线',
  }),
  createMountain({
    name: '九华山',
    slug: 'jiuhuashan',
    province: '安徽',
    city: '池州市青阳县',
    latitude: 30.478,
    longitude: 117.812,
    altitude: '1342m',
    sunrise: '05:12',
    window: '04:55-07:05',
    baseProbability: 80,
    best: '天台峰',
    routeName: '天台景区线',
  }),
  createMountain({
    name: '五台山',
    slug: 'wutaishan',
    province: '山西',
    city: '忻州市五台县',
    latitude: 39.005,
    longitude: 113.596,
    altitude: '3058m',
    sunrise: '05:01',
    window: '04:40-06:55',
    baseProbability: 76,
    best: '台怀镇高处观景点',
    routeName: '台怀镇周边线',
  }),
  createMountain({
    name: '普陀山',
    slug: 'putuoshan',
    province: '浙江',
    city: '舟山市普陀区',
    latitude: 30.006,
    longitude: 122.390,
    altitude: '291m',
    sunrise: '04:53',
    window: '04:40-06:45',
    baseProbability: 72,
    best: '佛顶山',
    routeName: '佛顶山线',
    difficulty: '轻中',
  }),
  createMountain({
    name: '雪窦山',
    slug: 'xuedoushan',
    province: '浙江',
    city: '宁波市奉化区',
    latitude: 29.689,
    longitude: 121.227,
    altitude: '800m',
    sunrise: '04:56',
    window: '04:40-06:50',
    baseProbability: 78,
    best: '千丈岩观景区',
    routeName: '溪口雪窦线',
  }),
  createMountain({
    name: '齐云山',
    slug: 'qiyunshan',
    province: '安徽',
    city: '黄山市休宁县',
    latitude: 29.812,
    longitude: 118.035,
    altitude: '585m',
    sunrise: '05:11',
    window: '04:55-07:00',
    baseProbability: 78,
    best: '月华街观景台',
    routeName: '月华街线',
    difficulty: '轻中',
  }),
  createMountain({
    name: '武当山',
    slug: 'wudangshan',
    province: '湖北',
    city: '十堰市丹江口市',
    latitude: 32.406,
    longitude: 111.003,
    altitude: '1612m',
    sunrise: '05:28',
    window: '05:10-07:20',
    baseProbability: 77,
    best: '金顶',
    routeName: '金顶线',
  }),
  createMountain({
    name: '龙虎山',
    slug: 'longhushan',
    province: '江西',
    city: '鹰潭市贵溪市',
    latitude: 28.093,
    longitude: 116.991,
    altitude: '247m',
    sunrise: '05:18',
    window: '05:00-07:05',
    baseProbability: 74,
    best: '仙水岩观景区',
    routeName: '仙水岩线',
    difficulty: '轻中',
  }),
  createMountain({
    name: '青城山',
    slug: 'qingchengshan',
    province: '四川',
    city: '成都市都江堰市',
    latitude: 30.905,
    longitude: 103.565,
    altitude: '1260m',
    sunrise: '06:02',
    window: '05:45-08:00',
    baseProbability: 79,
    best: '老君阁',
    routeName: '前山主线',
  }),
  createMountain({
    name: '四姑娘山',
    slug: 'siguniangshan',
    province: '四川',
    city: '阿坝州小金县',
    latitude: 31.095,
    longitude: 102.902,
    altitude: '6250m',
    sunrise: '06:05',
    window: '05:45-08:05',
    baseProbability: 83,
    best: '长坪沟观景点',
    routeName: '长坪沟线',
    difficulty: '中高',
  }),
  createMountain({
    name: '天柱山',
    slug: 'tianzhushan',
    province: '安徽',
    city: '安庆市潜山市',
    latitude: 30.733,
    longitude: 116.459,
    altitude: '1489m',
    sunrise: '05:17',
    window: '05:00-07:10',
    baseProbability: 82,
    best: '天池峰',
    routeName: '主峰线',
  }),
  createMountain({
    name: '长白山',
    slug: 'changbaishan',
    province: '吉林',
    city: '白山市长白山保护开发区',
    latitude: 42.006,
    longitude: 128.055,
    altitude: '2749m',
    sunrise: '04:01',
    window: '03:45-06:00',
    baseProbability: 80,
    best: '天池北坡',
    routeName: '天池北坡线',
    difficulty: '中高',
  }),
  createMountain({
    name: '梅里雪山',
    slug: 'meilixueshan',
    province: '云南',
    city: '迪庆州德钦县',
    latitude: 28.436,
    longitude: 98.683,
    altitude: '6740m',
    sunrise: '06:27',
    window: '06:05-08:35',
    baseProbability: 86,
    best: '飞来寺观景台',
    routeName: '飞来寺观景线',
    difficulty: '轻中',
  }),
  createMountain({
    name: '武夷山',
    slug: 'wuyishan',
    province: '福建',
    city: '南平市武夷山市',
    latitude: 27.756,
    longitude: 117.683,
    altitude: '2158m',
    sunrise: '05:17',
    window: '05:00-07:10',
    baseProbability: 83,
    best: '天游峰',
    routeName: '天游峰线',
  }),
  createMountain({
    name: '三清山',
    slug: 'sanqingshan',
    province: '江西',
    city: '上饶市玉山县',
    latitude: 28.915,
    longitude: 118.064,
    altitude: '1819m',
    sunrise: '05:10',
    window: '04:55-07:05',
    baseProbability: 85,
    best: '玉京峰',
    routeName: '南清园线',
    difficulty: '中高',
  }),
  createMountain({
    name: '张家界',
    slug: 'zhangjiajie',
    province: '湖南',
    city: '张家界市武陵源区',
    latitude: 29.345,
    longitude: 110.479,
    altitude: '1262m',
    sunrise: '05:42',
    window: '05:25-07:35',
    baseProbability: 87,
    best: '袁家界观景台',
    routeName: '袁家界线',
  }),
  createMountain({
    name: '太白山',
    slug: 'taibaishan',
    province: '陕西',
    city: '宝鸡市眉县',
    latitude: 34.058,
    longitude: 107.748,
    altitude: '3771m',
    sunrise: '05:39',
    window: '05:20-07:35',
    baseProbability: 78,
    best: '拔仙台',
    routeName: '高山区线',
    difficulty: '高',
  }),
  createMountain({
    name: '老君山',
    slug: 'laojunshan',
    province: '河南',
    city: '洛阳市栾川县',
    latitude: 33.752,
    longitude: 111.638,
    altitude: '2217m',
    sunrise: '05:26',
    window: '05:10-07:20',
    baseProbability: 80,
    best: '金顶道观群',
    routeName: '金顶线',
  }),
  createMountain({
    name: '云台山',
    slug: 'yuntaishan',
    province: '河南',
    city: '焦作市修武县',
    latitude: 35.429,
    longitude: 113.383,
    altitude: '1308m',
    sunrise: '05:13',
    window: '04:55-07:05',
    baseProbability: 73,
    best: '茱萸峰',
    routeName: '茱萸峰线',
  }),
  createMountain({
    name: '太姥山',
    slug: 'taimushan',
    province: '福建',
    city: '宁德市福鼎市',
    latitude: 27.103,
    longitude: 120.211,
    altitude: '917m',
    sunrise: '05:08',
    window: '04:50-07:00',
    baseProbability: 82,
    best: '九鲤湖观景区',
    routeName: '山海观景线',
  }),
];

const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const cardThemes = ['lime', 'green', 'teal'];

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

function buildDatePickerRange(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    dateStart: formatDate(today),
    dateEnd: formatDate(addDays(today, 30)),
  };
}

function normalizeSelectedDate(value, range) {
  if (!value || value < range.dateStart) return range.dateStart;
  if (value > range.dateEnd) return range.dateEnd;
  return value;
}

function weatherFor(probability, offset) {
  if (probability >= 88) return { icon: '☁', label: '多云' };
  if (probability >= 76) return { icon: '☁', label: '阴天' };
  if (probability >= 62) return { icon: '🌦', label: offset === 0 ? '小雨' : '多云' };
  return { icon: '☀', label: '晴天' };
}

function displayMetric(value, suffix = '') {
  return Number.isFinite(value) ? `${value}${suffix}` : '--';
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

const initialDatePickerRange = buildDatePickerRange();

Page({
  data: {
    mountains,
    mountainNames: mountains.map((item) => `${item.name} · ${item.province}`),
    mountainIndex: 0,
    routeIndex: 0,
    selectedDate: initialDatePickerRange.dateStart,
    dateStart: initialDatePickerRange.dateStart,
    dateEnd: initialDatePickerRange.dateEnd,
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
    searchValue: '',
    searchFocused: false,
    searchResults: [],
  },

  onLoad() {
    const range = buildDatePickerRange();
    this.setData({
      ...range,
      selectedDate: normalizeSelectedDate(this.data.selectedDate, range),
    });
    this.refreshPage();
    this.refreshWeather();
  },

  onSearchFocus() {
    this.setData({
      searchFocused: true,
      searchResults: this.buildSearchResults(this.data.searchValue),
    });
  },

  onSearchInput(event) {
    const searchValue = event.detail.value;
    this.setData({
      searchValue,
      searchFocused: true,
      searchResults: this.buildSearchResults(searchValue),
    });
  },

  onSearchConfirm() {
    const firstResult = this.data.searchResults[0];
    if (firstResult) this.selectMountainByIndex(firstResult.index);
  },

  onSearchClear() {
    this.setData({
      searchValue: '',
      searchFocused: false,
      searchResults: [],
    });
  },

  onSearchResultTap(event) {
    this.selectMountainByIndex(Number(event.currentTarget.dataset.index));
  },

  buildForecasts(mountain) {
    const baseDate = new Date(`${this.data.selectedDate}T00:00:00`);
    return [0, 1, 2].map((offset) => {
      const date = addDays(baseDate, offset);
      const seasonal = Math.round(Math.sin(((date.getMonth() + 1) / 12) * Math.PI) * 7);
      const wave = ((date.getDate() * 7 + offset * 11 + mountain.name.length * 5) % 17) - 8;
      const seedProbability = clamp(mountain.baseProbability + seasonal + wave, 38, 96);
      const wind = Number((2.1 + ((date.getDate() + offset) % 5) * 0.4).toFixed(1));
      const weather = weatherFor(seedProbability, offset);
      const humidity = clamp(seedProbability + 1, 50, 96);
      const cloud = clamp(seedProbability - 5, 35, 94);
      const dewPoint = 6 + ((date.getDate() + offset + mountain.name.length) % 8);
      const pressure = 900 + ((date.getDate() + offset * 3) % 38);
      const visibility = Number((4 + ((date.getDate() + offset) % 7) * 0.8).toFixed(1));
      const temp = 8 + ((date.getDate() + offset + mountain.name.length) % 9);
      const weatherData = {
        temperature: temp,
        temperatureMin: temp - 2,
        temperatureMax: temp + 4,
        windSpeed: wind,
        humidity,
        cloud,
        dewPoint,
        dewPointGap: Number((temp - dewPoint).toFixed(1)),
        visibility,
        precipitation: weather.label === '小雨' ? 0.8 : 0,
        weatherCode: weather.label === '小雨' ? 305 : 101,
      };
      const prediction = calculateCloudSeaPrediction(mountain, weatherData);
      return {
        offset,
        theme: cardThemes[offset],
        day: date.getDate(),
        week: weekNames[date.getDay()],
        title: offset === 0 ? '目标日' : `第 ${offset + 1} 天`,
        probability: prediction.probability,
        level: prediction.level,
        guideLevel: prediction.guideLevel,
        reasons: prediction.reasons,
        isRainy: prediction.isRainy,
        rainGate: prediction.rainGate,
        perfectWindow: prediction.perfectWindow,
        score: prediction.score,
        temp,
        wind,
        humidity,
        cloud,
        lowCloud: cloud,
        dewPoint,
        pressure,
        visibility,
        cloudText: displayMetric(cloud, '%'),
        dewPointText: displayMetric(dewPoint, '°C'),
        pressureText: displayMetric(pressure, 'hPa'),
        visibilityText: displayMetric(visibility, 'km'),
        weatherIcon: weather.icon,
        weatherLabel: weather.label,
      };
    });
  },

  buildForecastsFromWeather(mountain, weatherData) {
    const baseDate = new Date(`${this.data.selectedDate}T00:00:00`);
    return weatherData.dailyForecasts.map((dayWeather, index) => {
      const date = new Date(`${dayWeather.date || formatDate(addDays(baseDate, index))}T00:00:00`);
      const previousWeather = index > 0 ? weatherData.dailyForecasts[index - 1] : null;
      const prediction = calculateCloudSeaPrediction(mountain, dayWeather, { previousWeather });
      const hasTemperatureRange = Number.isFinite(dayWeather.temperatureMin) && Number.isFinite(dayWeather.temperatureMax);
      const tempText = hasTemperatureRange
        ? `${dayWeather.temperatureMin}-${dayWeather.temperatureMax}`
        : `${dayWeather.temperature}`;
      const humidity = Number.isFinite(dayWeather.humidity) ? dayWeather.humidity : prediction.probability;
      const apiCloud = Number.isFinite(dayWeather.cloud) ? dayWeather.cloud : null;
      const cloud = Number.isFinite(apiCloud) ? apiCloud : clamp(Math.round((humidity + prediction.probability) / 2), 35, 96);
      const lowCloud = Number.isFinite(dayWeather.lowCloud) ? dayWeather.lowCloud : cloud;
      const dewPoint = Number.isFinite(dayWeather.dewPoint) ? dayWeather.dewPoint : null;
      const pressure = Number.isFinite(dayWeather.pressure) ? dayWeather.pressure : null;
      const visibility = Number.isFinite(dayWeather.visibility) ? dayWeather.visibility : null;

      return {
        offset: index,
        theme: cardThemes[index] || cardThemes[cardThemes.length - 1],
        day: date.getDate(),
        week: weekNames[date.getDay()],
        title: index === 0 ? '目标日' : `第 ${index + 1} 天`,
        probability: prediction.probability,
        level: prediction.level,
        guideLevel: prediction.guideLevel,
        reasons: prediction.reasons,
        isRainy: prediction.isRainy,
        rainGate: prediction.rainGate,
        perfectWindow: prediction.perfectWindow,
        score: prediction.score,
        temp: dayWeather.temperature,
        tempText,
        wind: dayWeather.windSpeed,
        humidity,
        cloud,
        lowCloud,
        dewPoint,
        pressure,
        visibility,
        cloudText: displayMetric(cloud, '%'),
        dewPointText: displayMetric(dewPoint, '°C'),
        pressureText: displayMetric(pressure, 'hPa'),
        visibilityText: displayMetric(visibility, 'km'),
        weatherIcon: dayWeather.weatherIcon,
        weatherLabel: dayWeather.weatherLabel,
      };
    });
  },

  buildGuide(mountain, forecast) {
    const lead = forecast.isRainy
      ? '日出窗口有降水，不建议按完美云海行程冲顶'
      : forecast.probability >= 75
        ? '建议优先安排日出观景'
        : forecast.probability >= 40
          ? '建议保留备选日期并关注清晨更新'
          : '不建议专程冲顶，可等待更湿润的转晴窗口';
    const windAdvice = Number.isFinite(forecast.wind) && forecast.wind > 5
      ? '风速偏大，山脊和垭口注意防风，云层可能被吹散。'
      : '风速较小，适合在观景台等待云层稳定。';
    const rainText = forecast.rainGate?.label || (forecast.isRainy ? '日出窗口可能下雨' : '日出窗口无降水');
    const weatherAdvice = forecast.isRainy
      ? `${rainText}，完美观赏基础条件不成立，建议等待雨停后转多云或转晴的清晨。`
      : forecast.probability >= 75
      ? `${forecast.guideLevel}，${rainText}，${(forecast.reasons || []).join('、') || '清晨条件较好'}。`
      : `${forecast.guideLevel}，${rainText}，${(forecast.reasons || []).join('、') || '关键条件不够稳定'}。`;
    return [
      `前往${mountain.city}时，${lead}，完美云海重点看 ${forecast.perfectWindow || mountain.window}。${weatherAdvice}`,
      `日出窗口：湿度 ${displayMetric(forecast.humidity, '%')}，云量 ${displayMetric(forecast.cloud, '%')}，风速 ${displayMetric(forecast.wind, 'm/s')}。${windAdvice}`,
      `装备建议：${forecast.isRainy ? '雨具、防滑鞋和备用路线优先；若清晨仍有降雨，建议推迟到雨后转晴时段。' : forecast.probability >= 60 ? '防风外套、头灯、防滑鞋、热水和离线地图；云雾天气要把返程时间留足。' : '优先准备雨具、防滑鞋和备用路线；若清晨仍降雨或能见度很差，建议推迟观景。'}`,
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
      { name: '云量', value: `${forecast.lowCloud}%`, width: `${forecast.lowCloud}%` },
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

  buildSearchResults(keyword) {
    const query = normalizeSearchText(keyword);
    if (!query) return [];

    return mountains
      .map((mountain, index) => {
        const routeText = (mountain.routes || [])
          .map((route) => [route.name, route.best, ...(route.tips || [])].join(' '))
          .join(' ');
        const searchableText = normalizeSearchText([
          mountain.name,
          mountain.province,
          mountain.city,
          mountain.slug,
          mountain.altitude,
          routeText,
        ].join(' '));

        if (!searchableText.includes(query)) return null;

        return {
          index,
          name: mountain.name,
          meta: `${mountain.province} · ${mountain.city}`,
          detail: `${mountain.routes?.[0]?.best || '主峰观景点'} · ${mountain.altitude}`,
          activeClass: index === this.data.mountainIndex ? 'active' : '',
        };
      })
      .filter(Boolean)
      .slice(0, 8);
  },

  selectMountainByIndex(index, options = {}) {
    if (!Number.isInteger(index) || !mountains[index]) return;
    const nextSearchValue = options.keepSearchValue ? this.data.searchValue : mountains[index].name;

    this.setData({
      mountainIndex: index,
      routeIndex: 0,
      weatherData: null,
      searchValue: nextSearchValue,
      searchFocused: false,
      searchResults: [],
    }, () => {
      this.refreshPage(null);
      this.refreshWeather();
    });
  },

  refreshPage(weatherData = this.data.weatherData) {
    const mountain = mountains[this.data.mountainIndex];
    const route = mountain.routes[this.data.routeIndex] || mountain.routes[0];
    const hasWeatherData = weatherData && Array.isArray(weatherData.dailyForecasts) && weatherData.dailyForecasts.length;
    const forecasts = hasWeatherData ? this.buildForecastsFromWeather(mountain, weatherData) : this.buildForecasts(mountain);
    const currentForecast = forecasts[0];
    const guideLines = this.buildGuide(mountain, currentForecast);
    const weatherText = `湿度 ${displayMetric(currentForecast.humidity, '%')} · 云量 ${displayMetric(currentForecast.cloud, '%')} · 风速 ${displayMetric(currentForecast.wind, 'm/s')} · ${currentForecast.weatherLabel}`;
    this.setData({
      currentMountain: {
        ...mountain,
        weather: weatherText,
      },
      currentRoute: route,
      forecasts,
      currentForecast: {
        ...currentForecast,
        ringStyle: `background: conic-gradient(#D8FF75 ${currentForecast.probability}%, #E8F1ED 0);`,
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
    this.selectMountainByIndex(Number(event.detail.value), { keepSearchValue: true });
  },

  onDateChange(event) {
    const range = buildDatePickerRange();
    this.setData({
      ...range,
      selectedDate: normalizeSelectedDate(event.detail.value, range),
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
