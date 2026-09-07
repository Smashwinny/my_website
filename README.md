# GENIUSQI · 创作浮岛

个人 3D 作品展厅，Three.js + React + Vinext，带原创悬浮伙伴“小齐”。

## 人物与性能更新

当前人物使用高清 `web` / 移动 `lite` 两档：保留更清晰的面部，合并重复发束绘制；迷雾衣装增加开衩下摆、曲面铜甲与动态披风。步行动作改为按真实位移推进的脚掌支撑和双腿 IK，改善滑步、急转与落地。自然场景贴图缩减约 83%，移动人物合计传输缩减约 36.5%；选择世界时并行加载主角和场景脚本。

完整实现、量化报告、重建命令与验证边界见 [人物／动作／加载优化说明](docs/avatar-motion-loading.md)。以下历史章节保留此前版本的设计背景，当前资源档位和动作实现以上述说明为准。

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

## 世界风格与迷雾路线

顶部“切换风格”可选择晴岚浮岛（原神风格的明亮庭园）或雾隐山海（黑神话悟空风格的东方迷雾）。原庭园保留完整图鉴与自由漫游。选择会保存在浏览器；切换世界会回到起点，保留角色性别、形象和已经发现的作品。

雾隐山海只有当前与前后邻岛可见，岛屿持续上下浮动，按移动键配合空格跳过间隙。靠近石碑按 E 调查；有的岛包含作品，有的只是空岛。失足会返回最近落脚的岛。发现手记只列出已调查的作品，不显示总数；小齐只接收已经发现的项目资料。隐藏是探索体验设计，公开作品仍包含在客户端数据中。

`data/mist-route.json` 按顺序定义岛屿，`id` 保持唯一，`project` 填项目名称或 `null`。`arrival` 是起点，可在其前方、后方或任意两岛之间插入条目。路线以外继续生成同风格空岛。`npm run sync:projects` 保留手工排列，为未安排的新作品在末尾补充空岛和项目岛；可随后移动到任意位置再部署。

扩展其他风格时，在 `app/scene/world-styles.ts` 注册名称和探索规则，在 `app/world-view.tsx` 注册独立场景组件，样式按 `data-world-style` 隔离。两种现有场景共享角色与小齐，但各自拥有场景和移动逻辑。迷雾模式使用固定步长的平台碰撞与随岛运动，庭园保留原有三角面碰撞。

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

内置人物可选择男、女两种独立 VRM 模型：男性使用 pixiv / VRoid Studio 的 CC0 HairSample_Male，女性使用 pixiv 的 VRM1_Constraint_Twist_Sample。保留原始许可元数据。旅行者默认男性，小齐默认女性，两者均可独立更换性别与配色。伙伴在运行时调整比例并添加光环；行走、待机、眨眼由 VRM 标准骨骼和表情驱动。此版本不是定制人物建模，也不是原神角色素材。

环境使用 Quaternius Stylized Nature MegaKit 的 CC0 树木、花草、岩石与贴图。重复植被通过 InstancedMesh 批处理。默认近景人物视角，可切换俯瞰；使用色调映射、阴影、低强度泛光和雾。完整出处见 `public/asset-credits.txt`。

人物与环境资源本地打包约 56 MB，场景只请求当前选用的人物；首次加载需要等待，加载失败会给出提示。更新素材时应同时更新来源、许可说明和资源依赖检查。


## 小齐、角色选择与动作

顶部“角色形象”先选择旅行者或小齐，再选“男角色 / 女角色”和配色配饰。性别与配色分别保存在浏览器；切换性别加载对应独立模型，统一身高和碰撞体，VRM 0 模型会进行朝向校正。也可导入不超过 30 MB、数据与贴图内嵌的 VRM 文件。导入人物不推断性别，界面明确显示自定义状态；文件仅在当前页面内存中使用，不上传。刷新或恢复时使用该角色上次选择的内置性别。

小齐使用独立飞行动作：弯曲双腿、交错摆臂、双翼摆动、转弯侧倾和弹簧跟随；玩家动作使用平滑骨骼过渡、随实际速度推进的步态、起跳收腿与落地缓冲。这些是程序驱动动作，尚非动作捕捉动画。

人物采用固定 120 Hz 子步的胶囊与场景三角面碰撞。碰撞覆盖地形、石路、台阶、亭柱、树干、岩石和展台底座；相机与飞行伙伴也使用同一碰撞世界。花草和树叶作为柔性装饰不构成实体障碍。自定义人物按标准身高归一化，碰撞体保持统一，特大配饰可能超出碰撞体。

物理回归测试包括跳跃落地、空中二次起跳拒绝、薄墙、低顶、台阶、转角、边界、相机收近和飞行体排除重叠；完整手机与自定义模型兼容性仍需要具体设备/模型验证。

## 快速入口与写实材质

首次打开先显示风格入口，不挂载三维组件、不下载人物或场景。选定后才动态导入对应世界；无需进入三维也能先浏览图鉴。保存的风格只用于标记上次选择，不会在刷新时自动开始下载。

内置模型使用 `*-mobile.vrm.bin`：原始两个人物合计 29,257,924 字节，网络传输合计 4,428,947 字节，减少约 85%。原骨骼、几何与许可元数据保留，贴图缩至最长边 512 像素，再无损 gzip 压缩。浏览器解压后交给 VRM 加载器；不支持 DecompressionStream 的浏览器使用未压缩的 mobile VRM。缓存原始模型字节供风格切换复用，各场景独立拥有并释放 GPU 模型。自定义 VRM 保持原始质量。

重建移动版资源：`python3 scripts/optimize-avatars.py`（需要 Pillow）。资源测试会解压真实文件、比较元数据并加载骨骼运行动画。传输体积不等于加载耗时，网络、解压和 GPU 初始化仍受设备影响。

迷雾世界使用 Poly Haven CC0 摄影岩石色彩与法线贴图，约 153 KB；增加不规则岩壁、旧石铺地、双层曲檐石龛、盘根松树。人物改为受光照的标准材质，附加原创斗笠、布袍、铜甲、护腕与念珠。以《黑神话：悟空》的环境展示为方向参考，不是游戏人物模型或同等级写实复刻。明亮庭园保持原有美术方向。

## 加载进度与持棒动作

加载进度按收到的字节更新，未知总大小时显示已下载量与不定进度条；解压和人物准备单独提示，不用计时器模拟百分比。明亮场景的总准备进度综合环境和两个人物，迷雾场景只下载旅行者。

迷雾中不创建或下载飞行小齐，旅行者右手骨骼持金箍棒；小齐仍可通过右下角传音对话。男女模型都先进入自然站姿再显示。动作区分 VRM 0 与 VRM 1 的坐标方向，校正旧版男角色抬臂异常，手肘前屈，左臂自然摆动、右臂稳定持棒。

`npm run test:motion` 使用真实内置模型验证站立、行走、起跳、落地、握持跟随与棒端离地；测试不包含画面渲染和自定义模型视觉验收。

## 第三主题：掌中万象

以站主提供的 `sample.jpg` / `sample.mp4` 为暗色手部能量视觉参考，以 `sample2.jpg` 人物为主体生成专属托球画面。主体是优化后的静态 WebP（约 55 KB），元素球由 Canvas 实时绘制：火焰与火星、水纹与水滴、电弧与辉光。不是原视频播放或新的 VRM 人物。

左右划动人物区域、点击左右箭头或按左右方向键切换项目，点掌心球体或项目名打开详情。纵向滑动与小幅点击不会触发切换。`data/project-elements.json` 指定已有项目的元素类型；新项目默认按名称稳定分配。切换主题后才下载主体画面，后台或弹窗打开时暂停动画，尊重系统减少动态效果偏好。

本主题向导叫“小浩”，通过 `worldStyle: elements` 同步前端文案与本机 Codex 提示。原来的小齐、小津与两种主题保持可用。此主题的人物固定采用参考主体，因此不显示前两种主题的 VRM 角色更换入口。

掌中万象已恢复最初的蓝衣、自然肤色人物（`hero.webp`），掌心球体位置同步恢复。两个绿色巨人变体留作历史素材，不在当前主题中使用。

## 第四主题：马里奥探险

轻量 Canvas 像素横版场景，无需下载 VRM、视频或大型场景素材。用方向键 / A、D 移动，空格 / W / 上方向键跳跃；手机使用屏幕左右与跳跃按钮。从下方顶问号砖会弹出对应项目的蘑菇，蘑菇落下移动，碰到后打开项目详情。已使用的砖可再次顶出同一项目，方便重看。管道与砖块有实体碰撞，不会穿过。

关卡按公开项目数量生成，每个项目一块问号砖；加入项目并重新构建后会增加对应关卡段。收集计数在当前主题会话内有效。向导仍叫小齐，服务端知道本主题的顶砖与收集操作。所有像素绘制由代码完成，未引入游戏原版音频或素材包。
