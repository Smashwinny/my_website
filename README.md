# GENIUSQI · 创作浮岛

个人 3D 作品展厅，Three.js + React + Vinext，带原创悬浮伙伴“小齐”。

## Windows / Linux 协同开发

需要 Node.js >= 22.13 和 Git。

```sh
git clone https://github.com/Smashwinny/my_website.git
cd my_website
npm ci
npm run dev
```

访问终端打印的预览地址。WASD / 方向键移动、空格跳跃、拖动环顾、滚轮缩放、E 查看附近作品，也可直接点击展品。手机可通过方向按钮移动、跳跃按钮跳起、拖动环顾、点击展品或靠近后的互动按钮查看作品；图鉴提供完整的非 3D 浏览入口。

每次开始工作先 `git pull --ff-only`，创建英文名分支，例如 `git switch -c design/island-lighting`。完成后提交、推送并合并；另一台机器拉取后继续。不要提交 `.env`、登录资料、`node_modules` 或 `tmp`。

## 作品数据

`npm run sync:projects` 从 GitHub 公共 API 同步 Smashwinny 的全部非 Fork 仓库；网站自身 `my_website` 不放入展区。数据保存在 `data/projects.json`，构建时打包，因此访客不受 GitHub API 限流影响。没有简介的仓库不编造介绍。更新数据后提交并重新部署。

## 本机 Codex 伙伴

链路：浏览器 → 网站 `/api/chat` → HTTPS 隧道 → 本机 `bridge/server.mjs` → Codex CLI。

网页和 Cloudflare Worker 不会直接执行 Codex。连接服务必须运行在有 Codex CLI 的机器。机器关机、隧道断开或未登录时，对话明确报错。默认不返回模拟答案。

1. 在独立系统用户或容器中运行连接服务，环境只提供公开项目资料，不挂载日常开发工作目录。`read-only` 不是秘密文件隔离；隔离环境是上线前必要条件。
2. 在项目内建立专用 Codex 登录目录。Linux 示例：

```sh
mkdir -p .companion-codex
env CODEX_HOME="$PWD/.companion-codex" codex login
```

Windows PowerShell：

```powershell
$env:CODEX_HOME = "$PWD/.companion-codex"
codex login
```

3. 复制 `.env.example` 为 `.env`。设置 `COMPANION_BRIDGE_TOKEN` 为至少 24 字符的随机口令；设置 `COMPANION_CODEX_HOME` 为上述专用目录的绝对路径。运行 `npm run bridge`，默认只监听 `127.0.0.1:8788`。
4. 用自己的 HTTPS 隧道转发此端口，在网站服务端设置：
   - `COMPANION_BRIDGE_URL=https://你的隧道域名/chat`
   - `COMPANION_BRIDGE_TOKEN=上述连接口令`
   - `COMPANION_VISITOR_TOKEN=另一个访客访问口令`
5. 网页连接设置保留 `/api/chat`，填写访客访问口令。桥接口令始终只放服务端；不能放入浏览器构建变量。访客口令只保存在页面内存。

如果浏览器直连 HTTPS 连接服务，需要配置 `COMPANION_ALLOWED_ORIGINS`，填写允许的精确站点来源，逗号分隔。建议使用站点代理，避免把桥接口令交给浏览器。

CLI 使用 `exec --ignore-user-config --ignore-rules --ephemeral --sandbox read-only`，禁用 shell、apply_patch 和 web search，提示通过 stdin 传入；每次调用在独立临时目录运行。最近 12 条消息随请求传入，刷新页面清空对话。单进程每分钟最多 6 次、仅允许 1 个并发，95 秒超时。健康检查只证明桥接进程运行，不证明 Codex 已登录或能够回复。

依据：[Codex 非交互模式官方文档](https://developers.openai.com/codex/noninteractive)。已对本机 `codex exec --help` 核实参数。

2026-09-07 已在 Ubuntu 本机完成真实对话并接通 Cloudflare。`bridge/codex-isolated.sh` 用 bubblewrap 隔离文件系统与进程，清空继承环境，只挂载系统运行库、专用登录目录和本次请求目录；不挂载日常开发目录。专用目录从本机现有登录初始化，不上传到网站或 Git。它仍包含运行 Codex 必需的登录凭据，不能把该目录公开。

`npm run companion:cloudflare` 启动桥接与 Cloudflare Quick Tunnel，并通过 Wrangler 把隧道地址及桥接/访客口令写入 Worker secrets。重启时隧道地址会变化，脚本自动更新。Wrangler 登录配置保存在忽略的 `tmp/cloudflare-config`，可用 `XDG_CONFIG_HOME="$PWD/tmp/cloudflare-config" npx wrangler login` 更新登录。临时隧道没有稳定性保证；机器离线时网站仍能浏览，小齐无法回复。

本机当前后台单元为 `geniusqi-companion.service`，可用 `systemctl --user status geniusqi-companion` 和 `systemctl --user restart geniusqi-companion` 查看或重启。这是临时用户单元，不会开机自动启动；重启电脑后运行 `npm run companion:cloudflare`。勿同时运行两个桥接服务。访客访问口令见本机忽略文件 `tmp/companion-access.txt`，在网页“连接设置”中填写，接口保持 `/api/chat`。

## 检查与发布

```sh
npm test
npm run typecheck
npm run build
```

测试覆盖连接服务消息校验、鉴权、返回值、并发拒绝、错误处理；不替代真实 Codex 调用或浏览器视觉/交互验收。

正式发布在站主 Cloudflare 账号的 `geniusqi-world` Worker，域名为 https://geniusqi.com 和 https://www.geniusqi.com。`wrangler.production.json` 保存可重复部署配置；登录 Cloudflare 后运行 `npm run deploy:cloudflare`。本机项目内登录需同时设置 `XDG_CONFIG_HOME="$PWD/tmp/cloudflare-config"`。密钥由服务端 secrets 管理，不能写进部署配置。

原 `geniusqi-static` Pages 项目及版本保留，未覆盖。主域名旧的两条 A 记录在备份到 `tmp/cloudflare-before.json` 后替换为 Worker 自定义域名，其他子站保留。Sites 构建配置仍在 `.openai/hosting.json` 和 `vite.config.ts`，原 Sites 私有预览保留；正式访问使用上述 Cloudflare 域名。Windows 旧版源码尚未导入，此项目是新建实现。

## 人物与环境素材

人物使用 pixiv 提供的 VRM 动漫模型，约 36,470 个三角面，保留原始模型许可元数据。玩家和伙伴是同一基础模型的两个实例；伙伴在运行时改变发色、服装配色、比例并添加光环。行走、待机、眨眼由 VRM 标准骨骼和表情驱动。此版本不是定制人物建模，也不是原神角色素材。

环境使用 Quaternius Stylized Nature MegaKit 的 CC0 树木、花草、岩石与贴图。重复植被通过 InstancedMesh 批处理。默认近景人物视角，可切换俯瞰；使用色调映射、阴影、低强度泛光和雾。完整出处见 `public/asset-credits.txt`。

人物与环境资源本地打包约 38 MB，首次加载需要等待；加载失败会给出提示。更新素材时应同时更新来源、许可说明和资源依赖检查。


## 小齐、角色选择与动作

顶部“角色形象”可分别设置旅行者和小齐。四种预设共用基础 VRM，改变发色、服装配色、贝雷帽或星环双翼；预设选择保存在浏览器。也可导入不超过 30 MB、数据与贴图内嵌的 VRM 文件，更换真正的人物模型。自定义文件仅在当前页面内存中使用，不上传，重新进入场景后生效，刷新恢复基础模型。

小齐使用独立飞行动作：弯曲双腿、交错摆臂、双翼摆动、转弯侧倾和弹簧跟随；玩家动作使用平滑骨骼过渡、随实际速度推进的步态、起跳收腿与落地缓冲。这些是程序驱动动作，尚非动作捕捉动画。

人物采用固定 120 Hz 子步的胶囊与场景三角面碰撞。碰撞覆盖地形、石路、台阶、亭柱、树干、岩石和展台底座；相机与飞行伙伴也使用同一碰撞世界。花草和树叶作为柔性装饰不构成实体障碍。自定义人物按标准身高归一化，碰撞体保持统一，特大配饰可能超出碰撞体。

物理回归测试包括跳跃落地、空中二次起跳拒绝、薄墙、低顶、台阶、转角、边界、相机收近和飞行体排除重叠；完整手机与自定义模型兼容性仍需要具体设备/模型验证。
