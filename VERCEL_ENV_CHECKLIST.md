# Vercel 变量清单

下面这组变量可以直接填进 Vercel Project Settings -> Environment Variables。

## 一、站点访问密码

如果你想先只给内部教师试用，建议至少设置：

```text
SITE_USERNAME=teacher
SITE_PASSWORD=你自己设定的强密码
```

说明：

- 没有设置 `SITE_PASSWORD` 时，网站默认公开访问
- 设置后，整站会启用 Basic Auth
- 如果你不想直接保存明文密码，可改用：

```text
SITE_USERNAME=teacher
SITE_PASSWORD_HASH=你的SHA256十六进制哈希
```

- 如果 `SITE_PASSWORD_HASH` 和 `SITE_PASSWORD` 同时存在，优先使用哈希版本

## 二、DeepSeek

```text
LLM_PROVIDER=deepseek
LLM_API_KEY=你的 DeepSeek Key
LLM_MODEL=deepseek-chat
```

可选：

```text
LLM_BASE_URL=https://api.deepseek.com/v1
```

## 三、Kimi / Moonshot

```text
LLM_PROVIDER=kimi
LLM_API_KEY=你的 Kimi Key
LLM_MODEL=kimi-k2-0711-preview
```

可选：

```text
LLM_BASE_URL=https://api.moonshot.ai/v1
```

## 四、硅基流动 SiliconFlow

```text
LLM_PROVIDER=siliconflow
LLM_API_KEY=你的 SiliconFlow Key
LLM_MODEL=deepseek-ai/DeepSeek-V3
```

可选：

```text
LLM_BASE_URL=https://api.siliconflow.cn/v1
```

## 五、自定义 OpenAI-Compatible 接口

```text
LLM_PROVIDER=custom
LLM_API_KEY=你的 Key
LLM_MODEL=你的模型名
LLM_BASE_URL=你的兼容接口地址
```

## 六、图片生成

目前：

- OpenAI 默认支持图片生成
- DeepSeek / Kimi / 硅基流动 当前在本项目里默认只做文本生成
- 如果未启用图片生成，前端会自动回退到站内内置教学插图

如果以后你接入支持图片生成的兼容服务，可再设置：

```text
IMAGE_MODEL=你的图片模型名
```

## 七、我建议你当前先这样配

如果你主要用 DeepSeek：

```text
SITE_USERNAME=teacher
SITE_PASSWORD=你自己的密码
LLM_PROVIDER=deepseek
LLM_API_KEY=你的 DeepSeek Key
LLM_MODEL=deepseek-chat
```

## 八、GitHub Actions 自动发布需要的 Secrets

如果你采用仓库里的 GitHub Actions，而不是依赖 GitHub App 直接连 Vercel，请在 GitHub 仓库 Secrets 里补上：

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

如果你主要用 Kimi：

```text
SITE_USERNAME=teacher
SITE_PASSWORD=你自己的密码
LLM_PROVIDER=kimi
LLM_API_KEY=你的 Kimi Key
LLM_MODEL=kimi-k2-0711-preview
```

如果你主要用硅基流动：

```text
SITE_USERNAME=teacher
SITE_PASSWORD=你自己的密码
LLM_PROVIDER=siliconflow
LLM_API_KEY=你的 SiliconFlow Key
LLM_MODEL=deepseek-ai/DeepSeek-V3
```
