# 个人网站 2.0 — 完整技术文档

> **2026-08-19 / V2.0 当前状态**：V2.0 是对外版本名称；早期文档中的 v2.1、v2.4 等编号仅表示内部重构阶段。若历史记录与本节冲突，以本节和代码为准。

## V2.0 重构摘要

当前网站统一为「Mental Out / 学园都市交互终端」视觉语言：浏览器视口是环境层，倾斜的橙色面板是桌面层，食蜂操祈与聊天面板属于交互前景层。桌面使用六节点正六边形“记忆网络”引导用户在玩中探索；01–06 入口是构图的一部分，不允许拖动，打开后的软件窗口仍可拖动、缩放与最大化。V2.0 加入 VRMA 动作系统、十电子技术原子轨道、即时信号软件、自动时段氛围与本地作品海报。

### 启动与验收

```powershell
npm install
npm run check
npm start
```

默认地址为 `http://localhost:8080`。`?login=1` 可强制显示进入页，便于重复验收。不能直接双击 `index.html`，因为 ES Modules、VRM 与数据请求需要 HTTP 服务。

### 当前初始化顺序

```text
Login.init()
  ├─ LoginWallpaperManager：阿罗娜 / 依蕾娜 / 初音未来轮播
  └─ AssetPreloader：读取真实资源字节 + 至少 2.4 秒舒适过渡
Desktop.init() → MemoryNetwork.init() → WindowManager / Taskbar
Character.init()
  ├─ VRM 加载并校准放松、开放但克制的非对称基准姿态
  ├─ 无动作时由 CharacterMotionDirector 生成呼吸、重心、眨眼与视线组成的 living idle
  ├─ 八个经 VRMA Lab 审核的 VRMA 文件负责完整语义动作，结束后平滑回到基准姿态
  ├─ Raycaster 只让模型实际表面响应点击，透明区域穿透给窗口
  └─ CharacterReflectionRenderer 建立低清、隔帧且带接触光的独立倒影
Chat.init() → FieldConsole.init() → EasterEggs.init()
```

> V2.0 使用经过筛选并在 VRMA Lab 中调整的动作集合，再由 three-vrm-animation 按 Humanoid 语义重定向到当前模型。动作来源与模型许可必须在公开发布前逐项复核，详见 `assets/animations/THIRD_PARTY_NOTICES.md`。

### 新增核心模块

| 模块 | 文件 | 作用 |
|---|---|---|
| 角色混合动作系统 | `js/character-engine.js`、`assets/animations/character/` | 八个审核动作负责完整肢体表现；程序待机负责克制的呼吸、重心、眨眼和视线，动作结束后平滑回位 |
| 独立倒影渲染器 | `js/character-engine.js` | 第二个低分辨率 WebGL 画布，镜像、裁切和渐隐；低内存、小屏、减少动态时自动关闭 |
| Mental Link 聊天 | `js/chat.js` | 独立聊天历史、建议词、输入状态、角色动作联动、本地回退 |
| DeepSeek 服务端代理 | `server.js` | Key 仅存服务端，限流、超时、输入裁切、结构化 emotion/action 响应 |
| 三壁纸管理器 | `js/login-wallpapers.js` | 自动轮播、手动切换、可见性与视频播放管理 |
| 真实资源预载 | `js/asset-preloader.js` | 以流式字节进度加载 VRM、字体与数据，不显示伪进度 |
| 记忆网络 | `js/memory-network.js` | 六节点按正六边形分布；全部发现时触发一次 Mental Out 同步反馈 |
| 即时信号 | `js/modules/signal.js`、`data/signal.json` | 第六个软件，展示正在看、正在玩、正在学与正在制作的当前状态 |
| 媒体记忆库 | `js/modules/timeline.js`、`data/media-memory.json` | 从原始表保留个人评价，界面只分番剧/游戏；选定条目展示评分、原始短评与可选本地海报模糊背景 |
| 身份技术原子轨道 | `js/modules/about.js` | 头像作为原子核，十项技术在三条空间轨道上以景深、速度和悬停反馈持续运动 |
| 自动时段氛围 | `js/theme.js`、`css/variables.css`、`css/background-panel.css` | 清晨/白天/黄昏/夜晚自动切换环境、面板、地面与角色灯光；不再提供手动日夜开关 |
| 模型表面命中 | `js/character.js` | 使用 Raycaster 判断真实网格；角色仍可互动，但透明画布区域不再拦截关闭、拖动和内容点击 |
| 系统音语言 | `js/sound.js` | 统一短促低音与玻璃质感提示；只提供静音开关，实际音量交给操作系统 |
| 现场任务台 | `js/field-console.js` | 利用下方反射区显示当前记忆、实时轨迹、角色/API/会话状态 |
| 系统工具与成就 | `js/easter-eggs.js` | 可执行终端、22 项成就档案、解锁通知和探索提示 |
| 满成就访问票 | `js/achievement-reward.js`、`server.js` | 六项核心成就驱动中央奖杯蓄光；满成就后由服务端随机抽取四张票面之一、打印访客名称并签发唯一编号与校验凭证 |
| 发布检查 | `scripts/verify-release.js` | JS 语法、JSON、关键资产与占位资料检查 |

### DeepSeek 接入

复制 `.env.example` 为 `.env`，只在服务端填写：

```dotenv
DEEPSEEK_API_KEY=your_key_here
```

模型在服务端固定为 `deepseek-v4-flash`，部署环境不能切换到更昂贵的型号。前端请求
`POST /api/chat/stream`，服务端以 NDJSON 依次返回安全的阶段事件和最终结果：

```json
{ "type": "phase", "phase": "thinking" }
{ "type": "phase", "phase": "responding" }
{
  "type": "result",
  "reply": "回复文本",
  "emotion": "joy",
  "action": "clapping",
  "provider": "deepseek"
}
```

思维链只用于判断阶段，不会发送到浏览器。访客输入最多 240 字符，最多携带最近 6 条、
合计 1800 字符的历史；DeepSeek 最多生成 640 Token，最终展示文本再次裁切为 260 字符。
没有 Key 或远端请求失败时，服务器会返回 `provider: "local"` 的可用本地回复。禁止把
API Key 写入 `index.html`、`js/config.js` 或任何浏览器可下载文件。

### 进入页素材

- 阿罗娜：原有 Canvas 星图。
- 依蕾娜：Wallpaper Engine 场景中的视频已转为 1920×1080、30fps、faststart 的 H.264 MP4，并生成 WebP poster。
- 初音未来：原场景拆为背景、水面、人物与辅助贴图，以多层 DOM/CSS 重建轻量动态效果。
- 浏览器只会请求进入页真正引用的成品素材；原始 `壁纸/` 文件夹不参与线上运行。

### 服务接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/chat/status` | 返回 `configured`、当前模型与模式 |
| POST | `/api/chat/stream` | 流式对话代理；返回思考、回应和结果事件，每 IP 每分钟最多 12 次 |
| POST | `/api/chat` | 兼容用非流式响应；同样受服务端长度和频率限制 |
| POST | `/api/tickets/issue` | 满成就票券签发；同一浏览器身份重复请求返回原票，每个网络每日最多签发 3 张 |
| GET | `/api/tickets/verify/:credential` | 校验访问票是否由当前服务器真实签发 |
| GET | `/api/tickets/qr/:credential` | 为有效票券生成指向独立检票页的二维码 SVG |
| GET | `/ticket/verify/:credential` | 轻量检票页面；扫码时无需加载主站和 3D 模型 |
| POST | `/api/submit` | 留言写入本机 `messages.txt`；仅适合本地演示 |

访问票签发记录和本地自动生成的签名密钥默认保存在 `.private/`，不会提交到 Git。正式部署时应配置长期稳定的 `TICKET_SIGNING_SECRET`、`PUBLIC_BASE_URL=https://你的域名`，并可通过 `TICKET_DATA_DIR` 把票号记录放进持久化目录。当前存储适合单实例个人网站；多实例环境应迁移到数据库。

### 上线前仍需人工确认

1. 确认 VRM、阿罗娜、依蕾娜、初音未来以及学园都市相关素材拥有公开再发布授权；没有授权时必须替换为自制/获授权素材。
2. 在 `data/profile.json` 填写真实 GitHub、邮箱等链接；当前 UI 会自动隐藏占位链接。
3. 选择部署平台，并把 `/api/submit` 改为持久数据库、邮件服务或关闭留言写入，不能依赖临时磁盘上的 `messages.txt`。
4. 在部署平台的服务端环境变量中配置 `DEEPSEEK_API_KEY`，不要提交 `.env`。

---

> **写给未来的开发者（人类和 AI）**：这份文档包含了项目的完整技术细节、架构设计、踩过的坑、以及所有需要知道的信息。读完就能上手开发。

---

## 目录

1. [项目概览](#1-项目概览)
2. [快速开始](#2-快速开始)
3. [项目结构](#3-项目结构)
4. [初始化与加载顺序](#4-初始化与加载顺序)
5. [3D 角色系统详解](#5-3d-角色系统详解)
6. [3D 模型修复历程（踩坑实录）](#6-3d-模型修复历程踩坑实录)
7. [页面布局与命名表](#7-页面布局与命名表)
8. [数据格式与 API](#8-数据格式与-api)
9. [自定义指南](#9-自定义指南)
10. [3D 模型动画制作](#10-3d-模型动画制作)
11. [彩蛋与快捷键](#11-彩蛋与快捷键)
12. [Vibe Coding 协作指南](#12-vibe-coding-协作指南)
13. [常见问题](#13-常见问题)

---

## 1. 项目概览

一个 **Windows 11 桌面风格**的个人主页，运行在浏览器中。核心特色是桌面右下角有一个 **3D 食蜂操祈角色**（VRM 格式），可以互动、做表情、聊天。

### 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | 原生 JavaScript（无框架），模块化对象 |
| 3D 渲染 | Three.js **r160**（ES 模块版） |
| 3D 角色 | @pixiv/three-vrm **v3.5.5**（`three-vrm-v3.module.js`） |
| 动画系统 | @pixiv/three-vrm-animation（VRMA 动画加载） |
| 后端 | Express v5（`server.js`，仅开发服务器） |
| 3D 模型 | `shokuhou.vrm`（~16.5 MB，VRM 0.0 格式） |
| 动画 | 11 个 VRMA 动画文件（`assets/animations/*.vrma`） |

### 设计理念

- **桌面 OS 隐喻**：图标、窗口、任务栏、开始菜单
- **整洁但不匮乏**：几个按钮几行字背后有丰富的功能和菜单
- **丝滑动画**：弹性窗口、粒子连线、碎片消散等
- **彩蛋文化**：Konami 码、命令行、连击等隐藏互动

---

## 2. 快速开始

### 启动

```bash
cd "C:\Users\a\Desktop\个人网站2.0"
npm install    # 仅需 express 依赖
npm start      # → http://localhost:8080
```

### ⚠️ 绝对不能双击 index.html 打开！

ES 模块（`import()`）和 import map 需要 HTTP 协议，`file://` 协议会报错。

### 其他启动方式

```bash
# Python
python -m http.server 8080

# Node.js live-server
npx live-server --port=8080
```

---

## 3. 项目结构

```
个人网站2.0/
├── index.html                     # 入口页面
├── server.js                      # Express 服务器（端口 8080）
├── package.json                   # npm 配置
├── TECHNICAL.md                   # ← 本文档
├── shokuhou.vrm                   # 3D 角色模型（16.5 MB，VRM 0.0）
│
├── css/
│   ├── reset.css                  # CSS reset
│   ├── variables.css              # CSS 变量（主题色、间距等）
│   ├── character.css              # 角色容器样式（280×420px，右下角）
│   ├── desktop.css                # 桌面布局
│   ├── window.css                 # 窗口系统样式
│   ├── taskbar.css                # 任务栏样式
│   ├── modules.css                # 模块（关于、时间线等）样式
│   ├── login.css                  # 登录画面样式
│   ├── easter-eggs.css            # 彩蛋动画样式
│   └── background-panel.css       # 背景面板样式
│
├── js/
│   ├── app.js                     # 主入口，初始化顺序
│   ├── config.js                  # 全局配置（i18n、桌面图标、彩蛋定义等）
│   ├── utils.js                   # 工具函数（DOM、事件总线、动画等）
│   ├── character.js               # ★ 3D 角色核心（最复杂的文件）
│   ├── particles.js               # 粒子背景动画（Canvas）
│   ├── desktop.js                 # 固定桌面入口、心理扫描、框选
│   ├── window-manager.js          # 窗口拖拽、缩放、最大化、关闭动画
│   ├── taskbar.js                 # 任务栏、开始菜单、时钟
│   ├── theme.js                   # 日间/夜间主题切换
│   ├── login.js                   # 登录画面
│   ├── chat.js                    # 聊天系统
│   ├── sound.js                   # 音效系统
│   ├── easter-eggs.js             # 彩蛋系统（Konami 码、命令行等）
│   ├── arona-wallpaper.js         # 壁纸相关
│   └── modules/
│       ├── about.js               # "关于我" 窗口
│       ├── timeline.js            # "时间线" 窗口
│       ├── works.js               # "作品集" 窗口
│       ├── changelog.js           # "关于本站" 窗口（内部沿用旧模块名）
│       └── contact.js             # "留言" 窗口
│
├── assets/
│   ├── fonts/像素字.ttf           # 像素字体
│   ├── images/
│   │   ├── avatar.jpg             # 头像
│   │   └── wallpaper/             # 壁纸（SVG + 图片）
│   ├── animations/                # VRMA 动画文件（11 个）
│   │   ├── Angry.vrma
│   │   ├── Blush.vrma
│   │   ├── Clapping.vrma
│   │   ├── Goodbye.vrma
│   │   ├── Jump.vrma
│   │   ├── LookAround.vrma
│   │   ├── Relax.vrma
│   │   ├── Sad.vrma
│   │   ├── Sleepy.vrma
│   │   ├── Surprised.vrma
│   │   └── Thinking.vrma
│   └── js/vendor/
│       ├── build/
│       │   └── three.module.js    # Three.js r160 ES 模块
│       ├── examples/jsm/
│       │   ├── loaders/GLTFLoader.js
│       │   └── utils/BufferGeometryUtils.js
│       ├── three-vrm-v3.module.js # @pixiv/three-vrm v3.5.5（当前使用）
│       └── three-vrm-animation.module.js  # VRMA 动画加载器
│
└── data/
    ├── profile.json               # 个人信息
    ├── media-memory.json          # 媒体记忆库（番剧/游戏）
    ├── works.json                 # 作品集数据
    └── changelog.json             # 站点档案与版本说明
```

---

## 4. 初始化与加载顺序

### 脚本加载顺序（`index.html`）

```
importmap  →  module script (设置 window.THREE)
→ config.js  →  utils.js  →  particles.js  →  theme.js
→ desktop.js → window-manager.js → taskbar.js
→ character.js → chat.js → modules/*.js
→ easter-eggs.js → app.js
```

### 运行时初始化（`js/app.js`）

```
1. Particles.init()        → 粒子背景（Canvas）
2. ThemeManager.init()     → 主题恢复（localStorage）
3. Desktop.init()          → 固定桌面入口 + 右键心理扫描
4. WindowManager.init()    → 窗口系统
5. Taskbar.init()          → 任务栏 + 开始菜单
6. Character.init()        → ★ 3D 角色加载
7. Chat.init()             → 聊天系统
8. EasterEggs.init()       → 彩蛋系统（键盘监听等）
```

---

## 5. 3D 角色系统详解

这是项目最核心、最复杂的模块（`js/character.js`）。

### 架构

```
Character 对象
├── init()                    # 初始化入口
├── setupScene()              # 创建 Three.js Scene、Camera、WebGLRenderer
├── setupLighting()           # 4 个灯光：Ambient + Key + Fill + Rim
├── loadModel()               # 异步加载 VRM 模型
│   ├── import GLTFLoader + VRMLoaderPlugin
│   ├── loader.loadAsync('shokuhou.vrm')
│   ├── gltf.userData.vrm     # 获取 VRM 实例
│   ├── 自动缩放 + 定位
│   ├── 相机调整
│   ├── 原生 MToon 材质渲染       # three-vrm v3.5.5
│   ├── _buildExpressionMap()     # 建立 VRM 表情映射
│   ├── AnimationManager.loadAll() # 加载 VRMA 动画文件
│   └── _scheduleBlink()          # 启动眨眼循环
├── startAnimationLoop()       # 渲染循环
│   ├── vrm.update(dt)         # 弹簧物理 + 表情 + 人形骨骼
│   ├── _updateExpression(dt)  # 表情过渡（0.35s）
│   ├── _updateBlink(dt)       # 眨眼动画
│   ├── _updateLookAt()        # 眼睛/头部视线追踪
│   ├── VRMA mixer.update(dt)
│   └── _renderReflection()    # 底部水镜倒影
├── startIdleBehavior()        # 空闲行为：眨眼、发呆表情、位置偏移
│
├── 表情系统
│   ├── setExpression(name)    # 切换到指定表情（0.35s 过渡）
│   ├── resetExpression()      # 清除所有表情 → 中立
│   └── blink()                # 快速眨眼
│
├── VRMA 动画系统
│   ├── playAnimation(name)    # 播放指定动画（如 'Jump', 'Angry'）
│   ├── stopAnimation()        # 停止当前动画
│   └── 动画与表情互斥         # 播放动画时暂停表情
│
├── 交互
│   ├── onClick()              # 单击：循环表情
│   ├── startChat()            # 双击：聊天模式
│   └── onAnnoyed()            # 5连点：生气彩蛋（8秒恢复）
│
└── 辅助
    ├── showFallback()          # VRM 加载失败时显示 🪄 emoji
    └── showBubble() / typeText() / hideBubble()  # 聊天气泡
```

### 支持的 VRM 表情

| 调用 | VRM 表情名 | 效果 |
|------|-----------|------|
| `setExpression('neutral')` | neutral | 中立 |
| `setExpression('joy')` | happy | 开心 😊 |
| `setExpression('angry')` | angry | 生气 😠 |
| `setExpression('sorrow')` | sad | 悲伤 😢 |
| `setExpression('surprised')` | Surprised | 惊讶 😲 |
| `setExpression('fun')` | relaxed | 放松 |
| `blink()` | blink | 眨眼（0.1s） |

控制台测试：`Character.setExpression('joy')`

### VRMA 动画列表

| 文件名 | 触发场景 |
|--------|---------|
| `Angry.vrma` | 5连点生气 |
| `Blush.vrma` | 害羞 |
| `Clapping.vrma` | 拍手 |
| `Goodbye.vrma` | 告别 |
| `Jump.vrma` | Konami 码触发 |
| `LookAround.vrma` | 空闲环视 |
| `Relax.vrma` | 放松 |
| `Sad.vrma` | 悲伤 |
| `Sleepy.vrma` | 深夜/困倦 |
| `Surprised.vrma` | 惊讶 |
| `Thinking.vrma` | 思考中 |

### 模型姿势

手臂从 T-pose 调整为自然下垂。参数在 `_applyRestPoseFrame()` 中：
- 上臂：Z 轴旋转 ±1.15 rad（约 66°）
- 前臂：Z 轴旋转 ±0.15 rad（轻微肘部弯曲）

---

## 6. 3D 模型修复历程（踩坑实录）

> **历史资料警告（2026-07-20）**：本节 #1～#4 记录的是旧版
> `three-vrm v1.0.1` 的排障过程，不能再当作当前实现说明。项目现在使用
> `three-vrm v3.5.5`、`VRMLoaderPlugin` 与原生 `MToonMaterial`；当前代码中已经
> 没有 `_convertMToonMaterials()`、shader chunk polyfill 或 v1 表情 API。

> 2026-07-17，3D 模型完全不显示。以下是逐层排查和修复的完整过程。

### 坑 #1：API 版本不匹配

**症状**：`VRM.from is not a function`

**原因**：`character.js` 的代码是为 `@pixiv/three-vrm` **v2.x** 写的，但 vendor 文件是 **v1.0.1**。两代 API 完全不同：

| 功能 | v2 API（代码写的） | v1 API（实际存在的） |
|------|-------------------|---------------------|
| 加载 | `VRM.from(gltf)` | `GLTFLoader` + `VRMLoaderPlugin` → `gltf.userData.vrm` |
| 表情 | `vrm.blendShapeProxy` | `vrm.expressionManager` |
| 获取表情 | `bp.getExpressions()` → Map | `Object.keys(em.expressionMap)` |
| 获取值 | `bp.getValue(name)` | `em.getValue(name)` |
| 设置值 | `bp.setValue(name, weight)` | `em.setValue(name, weight)` |
| 更新 | `springBoneManager.update(dt)` | `vrm.update(dt)`（同时更新表情+骨骼+物理） |

**修复**：重写 `loadModel()` 和所有表情/动画 API 调用，改为 v1 版本。

### 坑 #2：两个 Three.js 实例冲突

**症状**：`Can not resolve #include`（shader 编译错误）

**原因**：`index.html` 同时加载了：
- `three.min.js`（UMD 全局版）→ 全局 `THREE`
- `three.module.js`（ES 模块版）→ 被 `three-vrm.module.js` 通过 import map 引用

VRM 的 MToon 材质在 ES 模块版 THREE 上注册了自定义 shader，但渲染用的是全局版 THREE 的 renderer——两个实例的 `ShaderChunk` 不同，找不到 include。

**修复**：**删掉 `three.min.js`**，改为用 `<script type="module">` 把 ES 模块的 THREE 暴露到 `window.THREE`：

```html
<script type="module">
  import * as THREE from 'three';
  window.THREE = THREE;
</script>
```

### 坑 #3：Shader Chunk 缺失

**症状**：`Can not resolve #include <uv2_pars_fragment>`

**原因**：Three.js r160 删除了 `uv2_pars_vertex`、`uv2_vertex`、`uv2_pars_fragment`、`uv2_fragment` 四个 shader chunk。但 three-vrm v1.0.1 的 MToon shader 仍在使用它们。

**修复**：在加载 VRM 前注入空 polyfill：

```js
THREE.ShaderChunk['uv2_pars_vertex'] = `...`;
THREE.ShaderChunk['uv2_vertex'] = `...`;
THREE.ShaderChunk['uv2_pars_fragment'] = `...`;
THREE.ShaderChunk['uv2_fragment'] = '';
```

### 坑 #4：MToon Shader 灯光 API 不兼容

**症状**：shader 编译通过，但模型渲染**全黑**（不可见）

**原因**：three-vrm v1.0.1 的 MToon shader 是为 Three.js r125–r140 设计的。Three.js r155+ 修改了灯光函数的参数签名，MToon shader 传递旧参数格式，编译时无报错但渲染结果全黑。

**修复**：加载 VRM 后将所有 MToon 材质转换为 Three.js 原生材质：
- 有纹理 → `MeshStandardMaterial`（PBR 着色）
- 无纹理 → `MeshLambertMaterial`（简单漫反射）

转换代码在 `_convertMToonMaterials()` 中，检测条件：
```js
mat.isShaderMaterial && typeof mat.customProgramCacheKey === 'function'
  && mat.uniforms && mat.uniforms.litFactor !== undefined
```

**代价**：丢失了 MToon 特有的卡通着色效果（toon shading、rim light、outline），但基本渲染正常。

### 坑 #5：表情叠加 Bug

**症状**：连续点击角色后，表情"鬼畜"——多套表情同时叠加在脸上

**原因**：表情过渡完成后 `_exprTarget` 被清空（设为 `null`），导致下一次切换表情时无法清除上一个表情。

**修复**：
1. `setExpression()` 切换表情时遍历**所有**表达式，将非目标表达式权重置零
2. `resetExpression()` 清空所有表情再过渡到 neutral
3. 自动恢复定时器改用 `_exprCurrent`（过渡完成后不清空）判断是否需要重置

### 坑 #6：眨眼不工作

**症状**：角色从不眨眼

**原因**：`_scheduleBlink()` 在模型加载前被调用，此时 `loaded=false`，函数直接 return。模型加载完成后没有重新启动眨眼循环。

**修复**：在 `loadModel()` 完成后再调用一次 `_scheduleBlink()`。

### 坑 #7：HTTP 服务器必要性

**症状**：`ERR_FILE_NOT_FOUND`、CORS 错误

**原因**：用户双击 `index.html` 用 `file://` 协议打开，ES 模块和 import map 都需要 HTTP 服务器。

**修复**：创建 `server.js`（Express），`npm start` 启动。

### 版本兼容性总结

| 组件 | 版本 | 兼容范围 |
|------|------|---------|
| Three.js | r160 | - |
| @pixiv/three-vrm | v3.5.5 | 当前使用原生 MToon |
| VRM 格式 | 0.0 | - |

当前加载链路以 `index.html` 的 import map 与 `js/character.js` 为准。上面的
v1 workaround 仅保留为迁移历史，不应重新加入代码。

---

## 7. 页面布局与命名表

### 2026-07-20 视觉架构

当前页面采用三个互相独立的坐标层：

1. **环境层（浏览器视口）**：深蓝背景、`#time-hud`、`#scene-floor` 和粒子。
2. **学园都市桌面层**：`#background-panel` 使用梯形 `clip-path` 绘制“左大右小”
   的透视，但不使用 CSS 3D transform；图标、任务栏和开始菜单属于此层。
3. **交互前景层（浏览器视口）**：功能窗口和 `#character-container`。角色默认是
   主视觉并位于窗口前方；活动窗口进入右侧安全区或最大化时，body 添加
   `.character-yielding`，角色侧移、降暗并退到窗口后方。

角色脚部位于橙色面板下缘附近，`#character-reflection` 延伸进底部深蓝地面。
窗口必须保持视口坐标和水平阅读面，不跟随橙色面板发生透视变形。

和 AI 交流时请使用此命名表，确保精确沟通。

```
┌──────────────────────────────────────────────────────────────┐
│  浏览器窗口                                                    │
│                                                               │
│  ★ ② 粒子背景 (Particles) — 全屏星空连线                      │
│                                                               │
│  ┌── ③ 桌面 (Desktop) ──────────────────────────────────┐    │
│  │                                                        │    │
│  │  ┌─ ③a 桌面图标 ─┐    ┌─ ③b 角色容器 ──────────┐      │    │
│  │  │  👤 关于我     │    │  食蜂操祈 3D 模型      │      │    │
│  │  │  🕐 时间线     │    │  渲染区域              │      │    │
│  │  │  📂 作品集     │    └────────────────────────┘      │    │
│  │  │  04 关于本站   │    ┌─ ③c 对话气泡 ───┐            │    │
│  │  │  ✉️ 留言       │    │  "你好呀~ ✨"    │            │    │
│  │  │  06 即时信号   │    └─────────────────┘            │    │
│  │  └───────────────┘                                      │    │
│  │  ┌─ ③d 心理扫描 ─┐    ┌─ ③e 命令行 ──────────┐      │    │
│  │  │  右键定位记忆   │    │  >_ 输入指令...      │      │    │
│  │  └───────────────┘    └──────────────────────┘      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌── ④ 任务栏 (Taskbar) ─────────────────────────────────┐   │
│  │  [✦开始] │ 📁窗口按钮...  │ 🌐中 ☀️ 🕐14:30         │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌── ⑤ 开始菜单 ──┐    ┌── ⑥ 弹窗 (Window) ──────────┐     │
│  │  [头像] 昵称    │    │  标题栏  _ □ ✕              │     │
│  │  5个模块项      │    │  弹窗内容                    │     │
│  │  彩蛋计数       │    │  (关于/时间线/作品集/本站/留言)│     │
│  └────────────────┘    └──────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 完整命名对照表

| 编号 | 中文名 | 英文名 | CSS 选择器 | JS 文件 |
|------|--------|--------|-----------|---------|
| ① | 登录画面 | Login Overlay | `#login-overlay` | `js/login.js` |
| ② | 面板粒子 | Panel Particles | `#panel-particles` | `js/particles.js` |
| ③ | 桌面 | Desktop | `#desktop` | `js/desktop.js` |
| ③a | 桌面图标 | Desktop Icons | `#desktop-icons` | `js/desktop.js` |
| ③b | 角色容器 | Character Container | `#character-container` | `js/character.js` |
| ③c | 对话气泡 | Chat Bubble | `#chat-bubble` | `js/character.js` |
| ③d | 心理扫描 | Mental Scan | `.mental-scan-pulse` | `js/desktop.js` |
| ③e | 命令行 | Command Line | `#command-line` | `js/easter-eggs.js` |
| ③f | 彩蛋通知 | Egg Notification | `#egg-notification` | `js/easter-eggs.js` |
| ④ | 任务栏 | Taskbar | `#taskbar` | `js/taskbar.js` |
| ⑤ | 开始菜单 | Start Menu | `#start-menu` | `js/taskbar.js` |
| ⑥ | 弹窗系统 | Windows | `.window` | `js/window-manager.js` |
| ⑥a | 弹窗-关于 | About Window | — | `js/modules/about.js` |
| ⑥b | 弹窗-时间线 | Timeline Window | — | `js/modules/timeline.js` |
| ⑥c | 弹窗-作品集 | Works Window | — | `js/modules/works.js` |
| ⑥d | 弹窗-关于本站 | Site Manifest Window | — | `js/modules/changelog.js` |
| ⑥e | 弹窗-留言 | Contact Window | — | `js/modules/contact.js` |
| ⑥f | 弹窗-即时信号 | Current Signal Window | — | `js/modules/signal.js` |

### 文件速查

| 想改什么 | 去哪个文件 |
|----------|-----------|
| 角色大小/位置 | `css/character.css` |
| 角色 3D 行为 | `js/character.js` |
| 桌面布局/图标 | `css/desktop.css` + `js/desktop.js` |
| 弹窗样式 | `css/window.css` |
| 弹窗内容（关于/时间线等） | `js/modules/about.js` 等 |
| 主题颜色 | `css/variables.css` |
| 多语言文本 | `js/config.js` (I18N) |
| 个人信息/技能/链接 | `data/profile.json` |
| 媒体记忆数据 | `data/media-memory.json` |
| 当前状态数据 | `data/signal.json` |
| 作品数据 | `data/works.json` |
| 粒子效果 | `js/particles.js` |
| 彩蛋 | `js/easter-eggs.js` |
| 任务栏/开始菜单 | `js/taskbar.js` + `css/taskbar.css` |

---

## 8. 数据格式与 API

### Profile (`data/profile.json`)

```json
{
  "avatar": "assets/images/avatar.jpg",
  "nickname": "昵称",
  "nicknameEn": "Nickname",
  "ip": "属地",
  "identity": "身份描述",
  "identityEn": "Identity EN",
  "age": "年龄",
  "gender": "性别",
  "genderEn": "Gender",
  "bio": "中文自我介绍...",
  "bioEn": "Self intro in English...",
  "skills": [
    { "name": "技能名", "level": 80 }
  ],
  "socials": [
    { "platform": "GitHub", "url": "链接", "icon": "🐙" }
  ]
}
```

### Media Memory (`data/media-memory.json`)

```json
{
  "items": [
    {
      "id": "m01",
      "type": "anime",
      "title": "番剧名",
      "year": 2025,
      "rating": 5,
      "review": "个人评价",
      "cover": "assets/images/media/m01.jpg",
      "wallpaper": "assets/images/media/m01-wallpaper.jpg"
    }
  ]
}
```
- `type`: `"anime"` 或 `"game"`
- `rating`: 0-5 分；当前界面只展示 `anime` 与 `game`

### Works (`data/works.json`)

```json
[
  {
    "id": "唯一id",
    "name": "项目名",
    "nameEn": "Project Name",
    "description": "描述",
    "descriptionEn": "Description",
    "tech": ["HTML", "CSS", "JavaScript"],
    "date": "2025-07",
    "links": [{ "label": "Demo", "url": "https://..." }]
  }
]
```

### 关于本站 (`data/changelog.json`)

```json
[
  {
    "version": "v2.1.0",
    "date": "2025-07-20",
    "changes": [
      { "type": "added", "zh": "新增功能", "en": "Added feature" },
      { "type": "fixed", "zh": "修复问题", "en": "Fixed issue" }
    ]
  }
]
```
- `type`: `"added"` | `"changed"` | `"fixed"` | `"removed"`

### API 接口

#### POST /api/chat/stream — AI 对话

```
Request:  { "message": "用户消息", "history": [], "lang": "zh" }
Stream:   { "type": "phase", "phase": "thinking" }
Stream:   { "type": "phase", "phase": "responding" }
Stream:   { "type": "result", "reply": "AI 回复", "emotion": "joy", "action": "greeting" }
```

#### POST /api/submit — 留言提交

```
Request:  { "name": "...", "contact": "...", "message": "..." }
Response: { "success": true }
429:      { "error": "提交太频繁，请一分钟后再试~" }
```

**前端验证限制**：name ≤ 10 字符，contact ≤ 30 字符，message ≤ 1000 字符。

---

## 9. 自定义指南

### 修改个人信息

编辑 `data/profile.json` 即可。

### 修改预设对话

编辑 `js/config.js`，找到 `charReplies` 对象，修改或添加触发词和回复。

### 修改壁纸

把新壁纸放到 `assets/images/wallpaper/`，修改 `css/variables.css` 中的 `--desktop-bg`：

```css
:root {
  --desktop-bg: url('../assets/images/wallpaper/你的壁纸.jpg') center/cover no-repeat;
}
```

### 如果换 3D 模型

新 VRM 模型放到根目录，更新 `js/config.js` 中的 `CHARACTER_CONFIG.modelPath`。可能需要调整：
- 缩放：`targetHeight` 参数
- 相机距离：`camDist` 乘数
- 手臂姿势：`_applyRestPoseFrame` 中的旋转值

### 如果要升级 three-vrm

升级到 v2.x（支持 Three.js r150+）可以避免坑 #2、#3、#4。但 v2.x 的 API 又不同于 v1.x，需要改回 `blendShapeProxy` 等 v2 API。

### 重置所有数据

```javascript
// 浏览器控制台
localStorage.clear();
location.reload();
```

---

## 10. 3D 模型动画制作

### 整体流程

```
shokuhou.glb → Blender导出FBX → Mixamo(绑骨骼+下载动画) → Blender合并 → 新的shokuhou.glb
```

### 一、Blender 导出 FBX

1. 打开 Blender → 新建项目 → 删掉默认方块
2. **File → Import → glTF 2.0** → 选 `shokuhou.glb`
3. **File → Export → FBX**，Scale: **1.00**，勾选 **Apply Transform**

### 二、Mixamo 自动绑骨骼

1. 打开 [mixamo.com](https://www.mixamo.com)，用 Adobe 账号登录
2. 右侧面板点 **Upload Character** → 选 `shokuhou.fbx`
3. 标记关键点：**下巴、手腕、手肘、膝盖、腹股沟**
4. 点 **Next** 自动生成骨骼

### 三、下载动画

需要下载的动画（**全部选 Without Skin，FBX, 30fps**）：

| 用途 | 搜索关键词 | 备选 |
|------|-----------|------|
| idle（待机） | `Breathing Idle` | `Idle` |
| sit（坐下） | `Sitting` | `Sit` |
| walk（走路） | `Walking` | — |
| wave（挥手） | `Waving` | — |
| jump（跳跃） | `Jumping` | `Jump` |
| dance（跳舞） | `Dancing` | `Hip Hop Dancing` |
| sleep（睡觉） | `Laying` | `Tired`, `Stretching` |
| surprised（惊讶） | `Surprised` | `Shocked`, `Reaction` |

> ⚠️ **必须选 Without Skin**（只要骨骼动画），否则文件很大且对不上角色。

文件命名：`shokuhou_idle.fbx`、`shokuhou_jump.fbx` 等。

### 四、Blender 合并动画

1. **File → New → General**，删掉默认方块和灯光
2. **File → Import → glTF 2.0** → 导入原始 `shokuhou.glb`
3. 选中骨架（Armature），打开 **NLA Editor**
4. 对每个动画 FBX：
   - **File → Import → FBX**
   - 找到新导入的骨架 → Action → **Push Down**（变成 NLA track）
   - 双击 track 重命名为动画名（如 `idle`）
   - 右键删掉新骨架
   - 把 track 拖到原始骨架上
5. 全部完成后：**File → Export → glTF 2.0**：
   - Format: **glTF Binary (.glb)**
   - 展开 **Animation**：勾选 **Animation** + **NLA Strips** + **Always Sample Animations**

### 五、验证

打开网站 → F12 Console → 应看到：`Character: available animations: ["idle", "walk", ...]`

> 代码用**关键词模糊匹配**动画名，`Breathing Idle` 包含 `idle` 就能匹配。

---

## 11. 彩蛋与快捷键

### 键盘快捷键

| 快捷键 | 效果 |
|--------|------|
| `Ctrl+K` | 打开迷你命令行 |
| `Ctrl+D` | 显示桌面（最小化所有窗口） |
| `Ctrl+Shift+N` | 星空占卜 |
| `Ctrl+Shift+T` | 切换日/夜主题 |
| `Ctrl+Shift+L` | 切换中/英文 |
| `Ctrl+1` ~ `Ctrl+5` | 快捷打开对应模块窗口 |
| `F11` | 全屏沉浸模式 |
| `Esc` | 关闭所有弹窗/菜单/气泡/命令行 |
| `↑↑↓↓←→←→BA` | Konami Code：粒子爆炸 + 角色跳起 |

### 鼠标彩蛋

| 彩蛋 | 触发方式 |
|------|---------|
| 😤 别点啦 | 快速点击角色 5 次 → 角色转身 |
| 🪟 Aero Shake | 快速摇晃窗口标题栏 → 其他窗口最小化 |
| 💬 图标投掷 | 拖图标到角色身上 → 角色吐槽 |
| ⭐ 星座 | 双击桌面空白 → 粒子聚成星座 |
| 🌀 粒子漩涡 | 按住右键画圈 → 粒子围绕旋转 |

### 命令行指令

| 指令 | 效果 |
|------|------|
| `help` | 显示可用指令 |
| `whoami` | 角色自我介绍 |
| `summon cat` 🐱 | 像素猫桌面漫步 |
| `theme retro` | 临时 Win98 配色 |
| `star` 🔮 | 星空占卜 |
| `sudo rm -rf /` | 角色慌张回复 |

### 时间彩蛋

| 彩蛋 | 触发条件 |
|------|---------|
| 🌙 深夜模式 | 00:00-06:00 访问 → 自动暗色 |
| ⏰ 整点报时 | 每小时 XX:00 → 角色报时气泡 |
| ⏰ 休息提醒 | 在线满 1 小时 → 休息提醒气泡 |

### 重置彩蛋

```javascript
localStorage.removeItem('found_eggs');
location.reload();
```

---

## 12. Vibe Coding 协作指南

### 任务分类

| 分类 | 典型任务 | 理由 |
|------|----------|------|
| ✋ **自己写** | CSS 像素调整、颜色/字体微调、最终视觉验收 | AI 看不到屏幕，来回调整不如手动改 |
| 🤖 **AI 写** | 新模块框架、Bug 排查、数据处理、重复模板 | AI 搜索快、知识广、不出低级错误 |
| 🔀 **混合** | 新增功能、重构 | 你描述→AI出框架→你调样式 |

### 高效对话模板

```
1. 指代区域 → 用命名表编号（说"③b角色"而不是"那个模型"）
2. 描述效果 → 用数值（说"占50vh"而不是"大一点"）
3. 指定文件 → 涉及样式说 CSS 文件，涉及逻辑说 JS 文件
4. 明确边界 → 需要 AI 出代码时说"出框架，我自己调样式"
```

### 示例

```
❌ "把角色调大一点"
✅ "把 ③b 角色容器的 CSS 改大，宽度从 42vw 改成 60vw，高度从 55vh 改成 85vh"

❌ "把绕着头像转的光球改一下"
✅ "把 ⑥a 弹窗-关于 里的光球改成显示 data/profile.json 中全部 5 种语言"
```

---

## 13. 常见问题

### Q: 打开后一片空白？
- 不要用 `file://` 协议打开，必须通过 HTTP 服务器
- 检查浏览器控制台（F12 → Console）

### Q: 3D 角色不显示？
- 确认 `shokuhou.vrm` 在根目录
- 检查控制台是否有 Three.js 加载错误
- VRM 加载失败时会显示 🪄 emoji 占位

### Q: 粒子不显示？
- 检查 Canvas 是否被支持
- 尝试切换主题

### Q: 窗口打开没有内容？
- 确认 `data/` 目录下的 JSON 文件存在且格式正确
- 检查 Network 面板，看 JSON 请求是否 404

### Q: 语言/主题切换后刷新没保存？
- 确认浏览器没有禁用 localStorage
- 检查 `localStorage.getItem('theme')` 和 `localStorage.getItem('lang')`

### Q: 移动端能用吗？
- 设计为桌面端体验，移动端交互不完整

### 快速验证脚本

```javascript
// 浏览器控制台
console.log('Particles:', typeof Particles);
console.log('Desktop:', typeof Desktop);
console.log('WindowManager:', typeof WindowManager);
console.log('Taskbar:', typeof Taskbar);
console.log('Character:', typeof Character);
console.log('EasterEggs:', typeof EasterEggs);
console.log('当前语言:', currentLang);
console.log('当前主题:', document.body.classList.contains('night') ? 'night' : 'light');
fetch('data/profile.json').then(r => r.json()).then(d => console.log('Profile:', d));
```

---

> **最后更新**：2026-07-20
> **原始创建**：Claude Fable 5（经多轮调试完成 3D 模型修复）
> **本文档合并了**：PROJECT-GUIDE.md、TESTING-GUIDE.md、3D模型动画制作指南.md、docs/ai-workflow.md、docs/page-naming.md、openspec specs、需求说明
