# ACTFL 中文教学备课平台

这是一个面向美国一线中文教师的专业教学网站原型，整合了：

- 9 份 ACTFL Vocabulary `docx` 词表的结构化浏览
- 按等级 / 主题 / 子主题 / 话题筛选
- 同话题跨等级对比
- AI 扩展示例语料
- AI 教学配图
- “三专家圆桌”教学建议

## 1. 生成数据

```powershell
npm run build:data
```

会更新：

- [site/data.js](D:\2026 ACTFL 词表\词表202603\site\data.js)
- [site/data.json](D:\2026 ACTFL 词表\词表202603\site\data.json)

## 2. 启动网站

```powershell
npm start
```

启动后访问：

- <http://localhost:3000>

## 3. 站点密码保护

项目现在支持两种方式保护网站：

1. 明文密码
2. `SHA-256` 哈希密码

推荐优先使用哈希密码。

如果你想先给内部教师试用，可在本地或 Vercel 环境变量中设置：

```powershell
$env:SITE_USERNAME="teacher"
$env:SITE_PASSWORD="你的强密码"
```

如果你更希望不直接保存明文密码，可改用：

```powershell
$env:SITE_USERNAME="teacher"
$env:SITE_PASSWORD_HASH="你的SHA256十六进制哈希"
```

PowerShell 生成 `SHA-256` 哈希示例：

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes("你的强密码")
$hash = [System.Security.Cryptography.SHA256]::HashData($bytes)
($hash | ForEach-Object { $_.ToString("x2") }) -join ""
```

说明：

- 如果 `SITE_PASSWORD` 和 `SITE_PASSWORD_HASH` 都为空，网站默认公开
- 如果同时存在，优先使用 `SITE_PASSWORD_HASH`
- Vercel `middleware.js` 和本地 `server/server.js` 都会执行同一套 Basic Auth 校验

## 4. Vercel 发布

仓库已经补好了 Vercel 所需结构：

- [vercel.json](D:\2026 ACTFL 词表\词表202603\vercel.json)
- [api](D:\2026 ACTFL 词表\词表202603\api)
- [public](D:\2026 ACTFL 词表\词表202603\public)

发布时建议：

1. 把整个目录推到 GitHub
2. 在 Vercel 里导入仓库
3. Build Command 使用仓库内的默认配置即可
4. 在 Vercel 项目环境变量中设置模型供应商相关变量

变量可以直接参考：

- [VERCEL_ENV_CHECKLIST.md](D:\2026 ACTFL 词表\词表202603\VERCEL_ENV_CHECKLIST.md)

本地也可以先模拟一次构建：

```powershell
npm run build:web
```

## 5. 接入 DeepSeek / 兼容模型 API

这个项目现在支持 OpenAI 兼容方式接入：

- DeepSeek
- Kimi / Moonshot
- SiliconFlow / 硅基流动
- OpenAI
- 自定义 OpenAI-Compatible 网关

推荐统一使用这组环境变量：

```powershell
$env:LLM_PROVIDER="deepseek"
$env:LLM_API_KEY="你的密钥"
$env:LLM_MODEL="deepseek-chat"
```

也支持直接使用供应商专用变量名，例如：

```powershell
$env:DEEPSEEK_API_KEY="你的密钥"
```

或：

```powershell
$env:KIMI_API_KEY="你的密钥"
$env:LLM_PROVIDER="kimi"
```

或：

```powershell
$env:SILICONFLOW_API_KEY="你的密钥"
$env:LLM_PROVIDER="siliconflow"
```

如果希望生成真实的扩展示例、专家圆桌和配图，先在当前终端设置：

```powershell
$env:LLM_PROVIDER="deepseek"
$env:LLM_API_KEY="你的_API_Key"
$env:LLM_MODEL="deepseek-chat"
npm start
```

如果没有配置可用的 API key，网站仍然可以运行，但会自动切换到本地演示模式。

说明：

- DeepSeek / Kimi / 硅基流动 当前默认只负责文本生成，图片会回退到内置教学插图
- 如果你以后要接支持图片生成的供应商，可以再加 `IMAGE_MODEL`
- 可直接参考这几个示例文件：
  [\.env.vercel.deepseek.example](D:\2026 ACTFL 词表\词表202603\.env.vercel.deepseek.example)
  [\.env.vercel.kimi.example](D:\2026 ACTFL 词表\词表202603\.env.vercel.kimi.example)
  [\.env.vercel.siliconflow.example](D:\2026 ACTFL 词表\词表202603\.env.vercel.siliconflow.example)

当前文本生成已改成“兼容 OpenAI SDK + Chat Completions 回退”的方式：

- OpenAI 优先走官方能力
- DeepSeek / Kimi / SiliconFlow 走兼容式文本调用
- 这比单纯依赖 `responses.create` 更适合实际部署

## 6. GitHub -> Vercel 自动发布

如果你不想依赖 GitHub App 直连，也可以直接使用仓库里的 GitHub Actions：

- [\.github/workflows/vercel-production.yml](D:\2026 ACTFL 词表\词表202603\.github\workflows\vercel-production.yml)

你只需要在 GitHub 仓库里配置 3 个 Secrets：

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

工作流会在 `main` 分支 push 时自动：

1. 安装依赖
2. 重新生成数据与 `public`
3. 调用 Vercel CLI 构建
4. 发布到 Production

## 7. 域名绑定

发布成功后，在 Vercel 项目里进入：

`Settings -> Domains`

然后绑定你在腾讯云或阿里云购买的域名。

常见做法：

- 根域名：按 Vercel 提示配置 `A` 记录
- `www`：按 Vercel 提示配置 `CNAME`

建议：

- 主域名用 `.com`
- 如果面向中国大陆访问较多，再补一个 `.cn` 跳转
- 域名解析完全以 Vercel 面板生成的记录值为准，不手抄旧教程

## 8. 目录说明

- [scripts/build_vocabulary_dataset.py](D:\2026 ACTFL 词表\词表202603\scripts\build_vocabulary_dataset.py)：解析 9 份 `docx` 并生成结构化数据
- [scripts/prepare_public.mjs](D:\2026 ACTFL 词表\词表202603\scripts\prepare_public.mjs)：准备 Vercel `public` 静态资源
- [server/server.js](D:\2026 ACTFL 词表\词表202603\server\server.js)：Node/Express 服务
- [server/openai-service.js](D:\2026 ACTFL 词表\词表202603\server\openai-service.js)：OpenAI 生成逻辑
- [api](D:\2026 ACTFL 词表\词表202603\api)：Vercel Serverless API
- [site/index.html](D:\2026 ACTFL 词表\词表202603\site\index.html)：前端入口
- [site/app.js](D:\2026 ACTFL 词表\词表202603\site\app.js)：前端交互逻辑
- [site/styles.css](D:\2026 ACTFL 词表\词表202603\site\styles.css)：产品化 UI
