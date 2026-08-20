# PaperFrame Personal Website V2.0

开发者纸帧（PaperFrame）的个人网站 V2.0。网站采用桌面式交互界面，包含个人介绍、游戏与番剧、作品集、关于本站、留言、成就、数字访问票与食蜂操祈互动系统。

V1.0 由本人手工编写；V2.0 在此基础上使用 AI Agent 辅助重构。角色动作通过 [VRMA Lab](https://github.com/YuBan834/vrma-lab) 调整后接入网站。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm ci
npm run check
npm run dev
```

默认地址为 `http://127.0.0.1:8080`。

## 私密配置

复制 `.env.example` 并在服务器环境变量中填写所需配置。不要把 API Key、票券签名密钥、留言记录或 `.private` 目录提交到仓库。

聊天系统固定使用 `deepseek-v4-flash`。正式部署前，必须撤销任何曾在聊天、截图或日志中出现过的旧 Key，再生成新 Key。

## 第三方角色资源

仓库不包含 `shokuhou.vrm` 和 `assets/animations/character/` 下的动作文件。

现用食蜂操祈 VRM 模型由 `のーり` 制作，其内嵌许可禁止再分发。若要在本地运行角色系统，请自行取得合法副本并放到项目根目录；公开部署前应另外取得授权或替换模型。动作文件也应在确认各自许可后放入 `assets/animations/character/`。

详细说明见 `assets/animations/THIRD_PARTY_NOTICES.md`。

## 部署

生产环境推荐使用 Nginx 处理 HTTPS 与静态请求，Node 服务仅监听本机端口。完整步骤见 `docs/服务器部署.md`。

## 相关项目

- [PaperFrame Website V1](https://github.com/YuBan834/paperframe-website-v1)
- [VRMA Lab](https://github.com/YuBan834/vrma-lab)
- [Star Focus](https://github.com/YuBan834/star-focus)
