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

## 3. Vercel 发布

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

## 4. 接入模型 API

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

## 5. 目录说明

- [scripts/build_vocabulary_dataset.py](D:\2026 ACTFL 词表\词表202603\scripts\build_vocabulary_dataset.py)：解析 9 份 `docx` 并生成结构化数据
- [scripts/prepare_public.mjs](D:\2026 ACTFL 词表\词表202603\scripts\prepare_public.mjs)：准备 Vercel `public` 静态资源
- [server/server.js](D:\2026 ACTFL 词表\词表202603\server\server.js)：Node/Express 服务
- [server/openai-service.js](D:\2026 ACTFL 词表\词表202603\server\openai-service.js)：OpenAI 生成逻辑
- [api](D:\2026 ACTFL 词表\词表202603\api)：Vercel Serverless API
- [site/index.html](D:\2026 ACTFL 词表\词表202603\site\index.html)：前端入口
- [site/app.js](D:\2026 ACTFL 词表\词表202603\site\app.js)：前端交互逻辑
- [site/styles.css](D:\2026 ACTFL 词表\词表202603\site\styles.css)：产品化 UI
