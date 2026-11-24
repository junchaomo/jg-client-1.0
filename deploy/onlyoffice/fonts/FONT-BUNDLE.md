# OnlyOffice 中文字体包

这个目录解决一个具体问题：DOCX 只保存字体 family 名称，OnlyOffice 只认容器内 `AllFonts.js` 注册过的字体。容器原本只有西文 `msttcorefonts` 和 `WenQuanYi Zen Hei`，所以公文指定的 `仿宋_GB2312`、`楷体_GB2312`、`黑体`、`宋体`、`方正小标宋简体` 都会落到兜底字体。

## 组成

- `source/`：Fandol 开源字体（GPL，见 `COPYING`），六个字形：仿宋、楷体、黑体、宋体、黑体粗体、宋体粗体。
- `build-fonts.py`：改写 `name` 表，生成公文常用 family 别名。
- `aliases/`：安装到容器的实际产物，`manifest.json` 记录 family → 源文件映射。
- `scripts/onlyoffice-fonts.ps1`：复制、重建 `AllFonts.js`、重启文档服务并校验。

## 已配齐的 family

- 公文核心：`仿宋_GB2312`、`楷体_GB2312`、`黑体`、`宋体`、`方正小标宋简体`
- 常用：`仿宋`、`楷体`、`新宋体`、`微软雅黑`、`微软雅黑 Light`、`等线`、`等线 Light`
- 其它公文/Office 常见：`方正仿宋简体`、`方正仿宋_GBK`、`方正楷体简体`、`方正楷体_GBK`、`方正黑体简体`、`方正黑体_GBK`、`方正书宋简体`、`方正书宋_GBK`、`方正小标宋_GBK`、`小标宋`、`华文宋体`、`华文中宋`、`华文仿宋`、`华文楷体`、`华文黑体`、`华文细黑`、`幼圆`

## 重要限制

这是**字形近似替代**，不是微软/方正的授权原字体。字体 family 命中后，跨 Windows/macOS/Linux 终端会使用同一套服务器字体，换行和分页不再随客户端字体变化；但 `仿宋_GB2312` 的精确字形、字宽与 GB/T 9704 排版仍应以有授权的原字体为准。

不要把 `C:\Windows\Fonts` 直接复制进 Linux 容器分发。要精确交付时，把集团已授权的字体文件放进 `jg-onlyoffice-fonts` 卷，再执行 `documentserver-generate-allfonts.sh`；如果原名 family 已正确，不需要本目录的别名。

## 重新生成

```powershell
py -3 deploy\onlyoffice\fonts\build-fonts.py
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-fonts.ps1 -Rebuild
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-fonts.ps1 -VerifyOnly
```
