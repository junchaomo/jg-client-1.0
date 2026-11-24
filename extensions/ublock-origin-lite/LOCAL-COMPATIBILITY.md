# uBlock Origin Lite 本地兼容说明

- 官方项目：https://github.com/uBlockOrigin/uBOL-home
- 发布版本：2026.1122.1948
- 官方 Chromium 包：`packages/uBOLite_2026.1122.1948.chromium.zip`
- 官方 SHA-256：`7cd72ae78fe6fa007193de633d2dec085a0da50f53283e821918a77978d105fb`
- 安装目录：`extensions/ublock-origin-lite`

## 本地兼容调整

1. `js/background.js` 对 Electron 尚未实现的 `chrome.commands` 使用可选监听。快捷键不可用时不再导致 Service Worker 注册失败。
2. Electron 45 当前不会执行扩展的 Manifest V3 `declarativeNetRequest` 静态规则。`electron/extension-dnr.cjs` 在云浏览器独立分区读取官方已启用规则集，通过 `webRequest.onBeforeRequest` 实现常见域名和路径的 `block/allow` 网络拦截。
3. 当前兼容层不宣称支持完整 uBOL：重定向、资源类型与发起站条件、完整优先级、脚本注入和元素隐藏等高级能力不在已验证范围内。

## 实测

真实 Electron 开关对照中，`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` 在扩展关闭时正常响应，启用后被 Chromium 以 `ERR_BLOCKED_BY_CLIENT` 拦截。测试入口为 `tests/cloud-browser-electron.test.mjs`，规则匹配回归为 `tests/extension-dnr.test.cjs`。
