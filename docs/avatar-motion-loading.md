# 人物、动作与加载优化

本次沿用四个现有世界、项目入口、自定义 VRM 导入、男女角色与伙伴功能。没有用新的重建场景替换网站，也没有把既有 CC0 模型包装成原创雕刻或站主的数字分身。

## 改了什么

### 人物与衣装

- 从原始 VRM 重新制作 `web` / `lite` 两档，脸部均保留 1024 贴图。桌面 web 档另保留更清晰的眼睛与发丝；粗指针或不超过 4 GB 的设备自动使用 lite。
- 不减三角形，不改骨骼、蒙皮、表情、弹簧骨或许可。男性同材质同顶点流发束合并，primitive 从 131 降到 14。透明发片仍为 PNG，不透明贴图改为高质量 JPEG。
- 修复运行时 `map=null` 丢失发丝、衣服纹理的问题；色彩配饰仍可切换。
- 迷雾衣装在标准人物坐标中装配，纠正男女模型原始骨架方向不同引起的前后错位。铜甲改为有倒角的合并曲面片，长筒裙改为六片开衩下摆，披风加入受速度、转弯驱动的低幅褶皱运动。

### 动作

- 足相位按角色真实水平位移推进；步长、支撑比例和抬脚高度随步行/慢跑速度变化。
- 支撑阶段在世界坐标固定脚掌，摆动阶段使用触地速度连续的 Hermite 轨迹。
- 三维双骨 IK 解算腿部，膝盖弯曲方向跟随人物朝向；根据腿长及脚目标降低骨盆，保证脚可达。停止时使用短恢复步，不把脚拖回站姿。
- 起跳保留收腿动作，落地恢复脚掌支撑与髋部缓冲；胸、肩、手臂跟随足相位。去掉旧的每周期四次单向弹跳。
- 内置人物无指定参考中心的弹簧骨在角色空间模拟，避免恒速行走把长发持续拉成水平。自定义人物保留原始设置。
- 朝向跟随实际速度，限速转身；镜头采用指数阻尼。显示帧上限从 40 ms 调整为与物理步进一致的 80 ms，避免 20 FPS 时角色慢动作。

### 加载

- 首屏仍不下载三维；选择晴岚/迷雾后，立即并行请求当前主角，与场景脚本加载重叠。元素、像素主题不请求 VRM。
- 只下载当前人物档位，主角准备完后才启动伙伴；场景分批加载策略保持。
- 下载使用收到的真实字节报告进度，共享未完成请求；仅缓存最近三个已完成模型。自定义 blob 不持久缓存。
- 45 秒超时、失败后可重新请求、压缩资源 404/415 自动退回普通 VRM；不支持解压流的浏览器直接使用普通 VRM。
- 自然场景改用 `nature-web`：1024 树皮、数值归一化法线、保留 alpha 覆盖的叶片。几何和碰撞不变。

## 可复核的量化结果

| 资源 | 旧版 | 新版 | 变化 |
|---|---:|---:|---:|
| 男性移动档，gzip 传输 | 2,486,590 B | 1,473,232 B | −40.8% |
| 女性移动档，gzip 传输 | 1,942,357 B | 1,339,681 B | −31.0% |
| 两个人物移动档合计 | 4,428,947 B | 2,812,913 B | −36.5% |
| 男性 web 档，gzip 传输 | 2,486,590 B | 1,993,467 B | −19.8% |
| 女性 web 档，gzip 传输 | 1,942,357 B | 1,538,791 B | −20.8% |
| 自然场景 12 张贴图 | 26,469,873 B | 4,562,390 B | −82.8% |
| 自然贴图 RGBA8 估算，不含 mipmap | 116.8 MiB | 44.8 MiB | −61.7% |
| 男性模型 primitive | 131 | 14 | −89.3% |

这些是资源体积与解析指标，不是对任何手机承诺的页面加载秒数。web 档高清纹理会增加显存，所以移动端使用接近旧版纹理预算的 lite 档。实际首屏仍受网络、图片解码、着色器编译、GPU、浏览器限制影响。

连续 120 Hz、3.1 m/s、真实已发布模型的支撑附近采样中，新版脚的平均水平速度约 0.069 m/s，摆动最高约 10.7 cm；旧动作审查同速度下约 4.1 m/s。旧数据为前期数值诊断，新版完整复现入口见下方；触地附近统计包括摆动边缘帧，不等同于整个摆动周期速度。

Node 24 本机五次中位数（图片解码用 1px stub，不含 GPU）中，男性 VRM gzip+解析+骨架整理从约 54 ms 降到 web 30 ms / lite 26 ms。详见 `performance/avatar-cpu-benchmark.json`，不要据此声称浏览器总加载时间下降同样比例。

## 验证与重建

```sh
npm ci
npm test
npm run typecheck
npm run test:motion
npm run build
node scripts/check-startup-budget.mjs

# Python 3.10+，Pillow 与 numpy；原始素材已在仓库内，无需联网建模
python scripts/build-web-avatars.py --source-dir public/models --output-dir public/models --profile all
python scripts/optimize-nature-textures.py --source public/models/nature --output public/models/nature-web
node scripts/benchmark-avatar-load.mjs

# 模型绑定姿态的离线纹理比较；不是浏览器截图
python scripts/render-avatar-comparison.py --source-dir public/models --models-dir public/models --output-dir tmp/avatar-comparison
# 导出实际骨骼动画与衣装的世界空间网格供离线渲染
node scripts/check-character-motion.mjs --snapshots
python scripts/render-motion-snapshots.py --snapshot tmp/motion-poses.json --source-dir . --output-dir tmp/motion-qa --states walk-375,idle
```

资源脚本检查实际三角形覆盖、顶点属性、形变、节点、骨骼、许可、对齐与 gzip 往返。测试覆盖六个人物档位、自然资源依赖、并行下载复用与 fallback、步态接触连续性、真实控制器跳跃落地、20/30/60/120 Hz 和 180° 转身；原有碰撞、项目探索与服务端鉴权测试保持通过。

离线图在 `performance/avatars/`，每张三列依次为旧 mobile / 新 web / 新 lite，视角一致。`performance/motion-final/` 为实际运行时网格的正面、35°、侧面姿态，包含最终衣装和步态。实际动作导出只用于本地 QA，不作为网页视频下载。

## 边界

- 这是保留原设计的模型细节/成本优化与新的程序步态、衣装，不是动作捕捉，也不是站主肖像的全新建模。
- 脚接地以人物所在支撑面的高度为基准，不是对每只脚单独射线采样复杂石阶。极端自定义比例、突然传送和复杂斜坡仍需专项检查。
- 衣摆和披风为轻量二级运动，不是完整布料物理。
- 数值与离线图片不能替代实机浏览器的观感和帧率验收；本次没有进行浏览器自动点击/截图测试。
- 原始模型和自然素材保留在仓库，便于无损重建与回滚；网页只请求优化版本。

技术依据：[VRMUtils 官方 API](https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMUtils.html)、[Three.js SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)。
