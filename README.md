# 小叶 3D 语音助手 — Vercel 部署版

## 目录结构
```
xiaoye-vercel/
├── api/
│   ├── chat.js          # 扣子对话（普通接口，兜底）
│   ├── chat-stream.js   # 扣子对话（流式接口，Edge Runtime，边生成边读）
│   └── tts.js           # 火山 TTS（Serverless Function）
├── public/
│   ├── index.html       # 前端页面（Three.js + 语音识别 + 口型同步 + 骨骼动作）
│   ├── xiaoye-new.glb   # 3D 角色模型（52骨骼/5动作/5口型，59MB）
│   └── vendor/three/    # Three.js 本地库
├── vercel.json          # Vercel 路由配置
└── README.md
```

## 一、部署到 Vercel（推荐流程）

1. 进入 [vercel.com](https://vercel.com)，用 GitHub/GitLab 账号登录
2. 把这个文件夹上传：可以 `vercel` CLI 部署，或在网页端 Add New → Project 导入仓库
   - 最快方式：安装 Node 后在此目录执行 `npx vercel`，按提示回车即可
3. **部署前先配环境变量**（在项目 Settings → Environment Variables 添加）：

   | 变量名 | 值 | 说明 |
   |---|---|---|
   | `COZE_TOKEN` | `pat_xxx` | 扣子 PAT Token |
   | `COZE_BOT_ID` | `7710073198343159871` | 扣子 Bot ID |
   | `VOLC_API_KEY` | `xxx` | 火山引擎 API Key |
   | `VOLC_RESOURCE_ID` | `seed-tts-2.0` | 资源 ID；1.0 音色填 `volc.service_type.10029` |
   | `VOLC_VOICE_TYPE` | `zh_female_vv_uranus_bigtts` | 音色 ID，换成你想要的 |

   配完后 **Redeploy** 一次让环境变量生效。

4. 部署完成会得到一个 `https://xxx.vercel.app` 的 HTTPS 地址，访问即可。

> ⚠️ 密钥只存在 Vercel 环境变量里，不会暴露给浏览器。不要把它们写进 index.html。

## 二、本地预览（可选）

```bash
npx vercel dev
```
会自动读取环境变量（可在项目根目录放一个 `.env.local` 文件，格式 `KEY=value` 每行一条），
然后浏览器打开 `http://localhost:3000`。

## 三、前端可改的配置项

打开 `public/index.html`，找到顶部的 `CONFIG`：

```js
const CONFIG = {
  modelUrl: '/xiaoye-new.glb',
  visemes: ['aa','ih','ou','ee','oh'],
  saluteClipName: 'human_000052', // 敬礼动画
  idleClipName: 'human_000000',   // 空闲拉伸动画
  welcome: '你好呀，我是小叶…',   // ← 欢迎语文字改这里
  filler: '好，我想想哦～',        // 提问瞬间的应声词
  lang: 'zh-CN'
};
```

## 四、重要提醒

1. **语音识别（按住说话）**：用的是浏览器 Web Speech API 的 SpeechRecognition，
   - Chrome / Edge 支持，Safari 部分支持
   - 国内网络下 Chrome 的识别依赖 Google 服务器，**可能不可用** → 请用文字输入框作为主要方式
   - 必须 HTTPS（Vercel 自带）或 localhost 才能用麦克风
2. **模型 59MB**：首次加载较慢，属正常。Vercel 免费版单文件 100MB 以内可托管。
   - 已用 `.gitignore` 排除旧的 `xiaoye.glb`（47MB），只上传正式模型。
3. **换音色**：改环境变量 `VOLC_VOICE_TYPE`；若是 1.0 音色，同时把 `VOLC_RESOURCE_ID` 改为 `volc.service_type.10029`。
4. **Token 安全**：扣子 PAT Token 和火山 Key 别贴到公开场合；泄露后去后台重建。
