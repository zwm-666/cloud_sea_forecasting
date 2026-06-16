# QWeather Setup

The mini program does not call QWeather directly. It calls the `qweatherWeather`
cloud function, and the cloud function signs QWeather requests with JWT.

Set these cloud function environment variables before deploying:

- `QWEATHER_API_HOST`: your project-specific QWeather API Host, without protocol.
- `QWEATHER_PROJECT_ID`: `2KKQ89AG4E`
- `QWEATHER_CREDENTIAL_ID`: `K4PUGAPDNY`
- `QWEATHER_PRIVATE_KEY_BASE64`: Base64 of `ed25519-private.pem`. This is the
  recommended option because cloud function consoles often damage multiline PEM
  values.
- `QWEATHER_PRIVATE_KEY_PEM`: raw `ed25519-private.pem` content. Use only if the
  console preserves the `-----BEGIN PRIVATE KEY-----` and
  `-----END PRIVATE KEY-----` text correctly.

Generate the Base64 value locally with PowerShell:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content -Raw 'C:\Users\86191\.qweather\miniprogram-1\ed25519-private.pem')))
```

Do not put the private key in mini program frontend files. The frontend package
can be inspected, and QWeather JWT credentials must stay server-side.

The request domain/protocol should be the project API Host over HTTPS:

```text
https://<QWEATHER_API_HOST>/v7/weather/now
https://<QWEATHER_API_HOST>/v7/weather/7d
```

Do not use the legacy shared hosts `api.qweather.com` or
`devapi.qweather.com`.
