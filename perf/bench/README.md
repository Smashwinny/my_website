# 复测说明

本目录只用于开发验证，不被页面导入，不部署遥测。

1. 保留基线提交的正式 `dist` 构建到 `tmp/flash-baseline/dist`，然后构建候选版本。
2. Node >=22.13：`node perf/bench/serve.mjs 3100 tmp/flash-baseline/dist` 与 `node perf/bench/serve.mjs 3101 dist`。
3. Python 环境需 `playwright`、`Pillow`，安装用户指定 huashu-flash skill。脚本启动独立、无现有用户配置的 Edge（已安装），不连接用户打开的浏览器。
4. `python perf/bench/scene.py --url http://127.0.0.1:3100 --url-b http://127.0.0.1:3101 --runs 10 --out perf/bench/paired-garden.json`
5. `python perf/bench/visual.py`：1440 / 390 宽度，固定初始场景帧，正文、SEO、链接逐项相等，像素差阈值 0.1%。这不是性能测量，也不是手机实机测试。
6. `node perf/bench/collision-golden.mjs`：完整碰撞树哈希与 480 帧控制器轨迹，防止用简化碰撞换速度。
7. 原 skill 的 `ratchet.py check --result perf/bench/paired-garden.json --version B --metric click_to_ready --label garden --ceilings perf/bench/ceilings.json`（5% 噪声容差）。
8. `npm test`、`npm run typecheck`、`npm run test:motion`、`npm run build`。

计时自导航/真实点击开始；场景 ready 表达式在 scene.py，真实按键与现有物理测试补充验证。每轮新上下文，缓存禁用，Fast 4G 全请求限速，A/B 顺序逐轮交换。

注意：本地正式服务器未自动压缩 JS/CSS，不能把绝对秒数当线上承诺。请保持前后服务器配置相同；若改网络/CPU/压缩口径，重新测 A/B，不能与本次直接比较。不要同时跑构建或 CPU 测试。

`repack.py` 是未采纳的离线 gzip 实验，默认不修改资产；它需要隔离安装的 zopfli，网站运行不需要此依赖。它的少量字节收益不是已证明的体感提升。

`pilot*.json` 是定位测量脚本问题的试跑，不能进入结论。首次试跑发现 SSR 文本可见时事件尚未绑定，第二次发现关图鉴后世界菜单自动打开；已按真实交互修正，所有正式测量使用修正后的相同流程。
