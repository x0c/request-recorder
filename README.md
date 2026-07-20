# Request Recorder

Chrome extension that records browser HTTP requests and exports them in 8 formats.

Built with [Plasmo](https://www.plasmo.com/) + React + TypeScript + Tailwind CSS.

## Features

- Record XHR / fetch (and optional resource types) from the active tab
- Capture request/response headers, bodies, timing, and click-trigger context
- Filter by request type and URL keyword
- Session history with multi-select export
- Export formats: **curl**, **fetch**, **axios**, **HTTP Raw**, **JSON**, **HAR**, **Postman Collection v2.1**, **mitmproxy flow**
- Header group filters (auth headers off by default to reduce accidental leaks)

## Install (development)

```bash
npm install
npm run dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `build/chrome-mv3-dev`

## Production build

```bash
npm run build
# optional zip:
npm run package
```

Output: `build/chrome-mv3-prod` (and `.zip` after `package`).

## Permissions

| Permission | Why |
|---|---|
| `webRequest` | Observe request/response metadata |
| `<all_urls>` | Record requests across sites you visit |
| `storage` / `unlimitedStorage` | Persist sessions and preferences |
| `alarms` | Keep the service worker lifecycle healthy while recording |
| `tabs` / `activeTab` | Attach recording to the current page |

All capture stays local in the browser. Nothing is uploaded by this extension.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development build with HMR |
| `npm run build` | Production build |
| `npm run package` | Zip the production build |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |

## License

[MIT](./LICENSE) © x0c
