const fs = require('fs');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const { buildQWeatherRequestUrls } = require('./qweather-logic');

const DEFAULT_PRIVATE_KEY_PATH = 'C:\\Users\\86191\\.qweather\\miniprogram-1\\ed25519-private.pem';
const DEFAULT_PROJECT_ID = '2KKQ89AG4E';
const DEFAULT_CREDENTIAL_ID = 'K4PUGAPDNY';
const TOKEN_TTL_SECONDS = 600;

let tokenCache = null;

function normalizePrivateKeyPem(value) {
  const raw = String(value || '').trim();
  if (!raw.includes('PRIVATE KEY')) {
    throw new Error('QWEATHER_PRIVATE_KEY_PEM must be a PKCS#8 PRIVATE KEY PEM');
  }
  if (raw.includes('PUBLIC KEY')) {
    throw new Error('QWEATHER_PRIVATE_KEY_PEM must be PRIVATE KEY, not PUBLIC KEY');
  }

  const withRealNewlines = raw.replace(/\\n/g, '\n');
  const compact = withRealNewlines
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  if (!compact) {
    throw new Error('QWEATHER_PRIVATE_KEY_PEM is missing private key body');
  }

  return [
    '-----BEGIN PRIVATE KEY-----',
    compact,
    '-----END PRIVATE KEY-----',
  ].join('\n');
}

function privateKeyPemFromBase64(value) {
  const decoded = Buffer.from(String(value || '').trim(), 'base64').toString('utf8');
  return normalizePrivateKeyPem(decoded);
}

function getConfig() {
  return {
    projectId: process.env.QWEATHER_PROJECT_ID || DEFAULT_PROJECT_ID,
    credentialId: process.env.QWEATHER_CREDENTIAL_ID || DEFAULT_CREDENTIAL_ID,
    apiHost: process.env.QWEATHER_API_HOST,
    privateKeyPath: process.env.QWEATHER_PRIVATE_KEY_PATH || DEFAULT_PRIVATE_KEY_PATH,
    privateKeyBase64: process.env.QWEATHER_PRIVATE_KEY_BASE64,
    privateKeyPem: process.env.QWEATHER_PRIVATE_KEY_PEM,
  };
}

function readPrivateKey(config) {
  if (config.privateKeyBase64) {
    return privateKeyPemFromBase64(config.privateKeyBase64);
  }
  if (config.privateKeyPem) {
    return normalizePrivateKeyPem(config.privateKeyPem);
  }

  const privateKeyPath = path.resolve(config.privateKeyPath);
  return normalizePrivateKeyPem(fs.readFileSync(privateKeyPath, 'utf8'));
}

async function createJwt(config, nowSeconds) {
  const { importPKCS8, SignJWT } = await import('jose');
  const privateKey = await importPKCS8(readPrivateKey(config), 'EdDSA');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'EdDSA', kid: config.credentialId })
    .setIssuedAt(nowSeconds - 30)
    .setExpirationTime(nowSeconds + TOKEN_TTL_SECONDS)
    .setSubject(config.projectId)
    .sign(privateKey);
}

async function getJwt(config) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > nowSeconds) {
    return tokenCache.token;
  }

  const token = await createJwt(config, nowSeconds);
  tokenCache = {
    token,
    expiresAt: nowSeconds + TOKEN_TTL_SECONDS,
  };
  return token;
}

function inflate(buffer, encoding) {
  return new Promise((resolve, reject) => {
    const normalizedEncoding = String(encoding || '').toLowerCase();
    if (normalizedEncoding.includes('gzip')) {
      zlib.gunzip(buffer, (error, result) => (error ? reject(error) : resolve(result)));
      return;
    }
    if (normalizedEncoding.includes('deflate')) {
      zlib.inflate(buffer, (error, result) => (error ? reject(error) : resolve(result)));
      return;
    }
    if (normalizedEncoding.includes('br') && typeof zlib.brotliDecompress === 'function') {
      zlib.brotliDecompress(buffer, (error, result) => (error ? reject(error) : resolve(result)));
      return;
    }
    resolve(buffer);
  });
}

async function decodeResponseBody(chunks, encoding) {
  const buffer = Buffer.concat(chunks);
  const decoded = await inflate(buffer, encoding);
  return decoded.toString('utf8');
}

async function requestJson(url, token) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on('end', async () => {
        let payload;
        let body;
        try {
          body = await decodeResponseBody(chunks, response.headers['content-encoding']);
          payload = JSON.parse(body);
        } catch (error) {
          reject(new Error(`QWeather returned invalid JSON: ${error.message}`));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`QWeather request failed with status ${response.statusCode}`));
          return;
        }
        resolve(payload);
      });
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy(new Error('QWeather request timeout'));
    });
    request.end();
  });
}

exports.main = async (event = {}) => {
  try {
    const { mountain } = event;
    const config = getConfig();
    if (!config.apiHost) {
      throw new Error('Missing QWEATHER_API_HOST environment variable');
    }

    const urls = buildQWeatherRequestUrls({ apiHost: config.apiHost, mountain });
    const token = await getJwt(config);
    const [nowPayload, hourlyResult, dailyPayload] = await Promise.all([
      requestJson(urls.nowUrl, token),
      requestJson(urls.hourlyUrl, token).catch((error) => ({
        code: 'request_failed',
        message: error.message || 'QWeather hourly request failed',
      })),
      requestJson(urls.dailyUrl, token),
    ]);
    const hourlyPayload = hourlyResult?.code === '200' ? hourlyResult : null;

    return {
      ok: true,
      provider: 'qweather',
      payload: {
        nowPayload,
        hourlyPayload,
        dailyPayload,
        hourlyWarning: hourlyPayload ? '' : hourlyResult?.message || `QWeather hourly request failed with code ${hourlyResult?.code || 'unknown'}`,
      },
    };
  } catch (error) {
    console.error('[qweatherWeather] failed:', error);
    return {
      ok: false,
      provider: 'qweather',
      message: error.message || 'QWeather request failed',
    };
  }
};

exports.normalizePrivateKeyPem = normalizePrivateKeyPem;
exports.privateKeyPemFromBase64 = privateKeyPemFromBase64;
exports.decodeResponseBody = decodeResponseBody;
