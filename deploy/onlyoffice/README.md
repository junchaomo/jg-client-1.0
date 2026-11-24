# 九规智能中枢 · OnlyOffice 部署包

这个目录只放 OnlyOffice Document Server 的部署资产，不包含中枢业务代码，也不提交 JWT 密钥。

## Windows 一键启动

中枢的正式启动入口是根目录的 `启动九规智能中枢.bat`。它会先执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-deploy.ps1 -StartOnly -EnsureDockerDesktop -WaitSeconds 25
```

脚本行为：

1. 检查 Docker 引擎；未启动时按需启动 Docker Desktop，最多等待 90 秒。
2. 如果容器 `jg-onlyoffice` 不存在，就用当前镜像创建容器。
3. 如果容器已存在但未运行，就 `docker start`，不重建、不丢失数据卷。
4. 读取或生成 `data/onlyoffice.json` 中的 64 位 JWT 密钥，并确保与容器 `JWT_SECRET` 对齐。
5. 最多等待 25 秒健康检查；未通过也不阻断 Electron 启动，中枢会自动回退 PDF 预览。
6. 健康后检查 `scripts\onlyoffice-fonts.ps1` 的字体清单；缺少公文字体时自动安装并重建 `AllFonts.js`。

## 中文字体

OnlyOffice 只认容器里的字体 family，不会使用用户 Windows 上的字体。启动脚本会把 `deploy\onlyoffice\fonts\aliases` 放进命名卷 `jg-onlyoffice-fonts`，再执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-fonts.ps1
```

当前自动配齐的 family 包括：

- 公文核心：`仿宋_GB2312`、`楷体_GB2312`、`黑体`、`宋体`、`方正小标宋简体`
- 常用替代：`仿宋`、`楷体`、`新宋体`、`微软雅黑`、`等线`、`华文宋体`、`华文仿宋`、`华文楷体`、`华文黑体`、`幼圆`
- 西文：容器原有 `Times New Roman`、`Arial`、`Calibri` 等 `msttcorefonts`

说明：

- 字体源是 GPL 授权的 Fandol（见 `fonts/COPYING`），通过修改 name table 生成公文 family 别名。
- 这样可以保证“family 命中、跨终端一致”，但**不是微软/方正 GB2312 字体的原始字形**。需要 GB/T 9704 的精确字形时，把有授权的原字体放入字体卷并重新生成 `AllFonts.js`，不要直接分发 Windows 字体。
- 校验：`scripts\onlyoffice-fonts.ps1 -VerifyOnly`；AllFonts.js 中应能检索到上述 family。


关闭联动：

```powershell
$env:JG_ONLYOFFICE_AUTOSTART = '0'
```

## Linux / 内网服务器 Compose

```bash
cd deploy/onlyoffice
cp .env.example .env
# 编辑 .env，填入与中枢 data/onlyoffice.json 一致的 JWT 密钥
docker compose up -d
```

容器参数：

- 端口默认 `8082:80`
- `JWT_ENABLED=true`
- `JWT_HEADER=AuthorizationJwt`
- `--shm-size=2g`，低于 2GB 时 OnlyOffice 容易在保存或大文档场景崩溃
- `host.docker.internal:host-gateway`，供容器内下载中枢源文件
- 数据、日志、缓存、字体分别落到命名卷

## 中枢配置

中枢读取以下配置，环境变量优先于 `data/onlyoffice.json`：

```text
JG_ONLYOFFICE_ENABLED=1
JG_ONLYOFFICE_URL=http://127.0.0.1:8082
JG_ONLYOFFICE_PUBLIC_URL=http://127.0.0.1:8082
JG_ONLYOFFICE_DOCUMENT_HOST_URL=http://host.docker.internal:54270
JG_ONLYOFFICE_SECRET=<64 位 hex>
JG_ONLYOFFICE_HEADER=AuthorizationJwt
```

三个地址不能混用：

- `internalUrl`：中枢服务端访问 OnlyOffice 命令服务的地址。
- `publicUrl`：浏览器加载 `api.js` 和编辑器 iframe 的地址。
- `documentHostUrl`：OnlyOffice 容器访问中枢文件下载/保存回调的地址。默认走中枢云入口 `54270`，因为 `127.0.0.1:54269` 只绑定本机回环，容器通过网关访问不到。

如果改了中枢云入口端口：

```powershell
$env:JG_CLOUD_PORT = '54280'
$env:JG_ONLYOFFICE_DOCUMENT_HOST_URL = 'http://host.docker.internal:54280'
```

## 生产注意事项

- 不要把 `8082` 直接暴露到公网。前面加 Nginx/Caddy，启用 HTTPS 与 WebSocket 转发。
- 公网部署时，把 `JG_ONLYOFFICE_PUBLIC_URL` 改成用户浏览器能访问的 HTTPS 域名；`JG_ONLYOFFICE_DOCUMENT_HOST_URL` 改成容器能访问的中枢内网地址。
- JWT 密钥只放 `data/onlyoffice.json` 或环境变量/密钥管理，不能提交到 Git。
- 当前验证镜像为 `documentserver:latest`（实际版本 10.0.0 Build 169）。生产建议固定镜像 digest，避免自动升级引入前端加载竞态。
- OnlyOffice 打不开时，中枢已有的 LibreOffice → PDF 只读预览仍然可用，在线编辑入口会明确报错，不会把 Office 文件当文本读出。

## 自检

```powershell
docker ps --filter name=jg-onlyoffice
Invoke-WebRequest http://127.0.0.1:8082/healthcheck -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:54269/api/health -UseBasicParsing
```

浏览器打开任意 `.docx/.xlsx/.pptx` 的只读预览，再点“在线编辑”。
