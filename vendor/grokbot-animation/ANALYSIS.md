# `grok-bot-lazy` DOM 与动画分析

分析对象：[x.ai/bot](https://x.ai/bot)，检查时间为 2026-08-13。

## 1. DOM 分层

页面首屏中的角色不是图片，也不是 Canvas / WebGL。它的降级结构是：

```html
<span class="grok-bot-lazy">
  <svg class="grok-bot-mark" viewBox="-15 -15 259 259">
    <path class="grok-bot-mark__head" />
    <path class="grok-bot-mark__eye" />
    <path class="grok-bot-mark__eye" />
  </svg>
</span>
```

- `.grok-bot-lazy` 只负责尺寸、行高和进入视口后的懒加载。
- 未进入视口或动画 chunk 尚未完成加载时，内部是上面的静态三路径 SVG。
- 动画组件加载后，`data-state` 挂在内部 `.grok-bot-mark` SVG 上，而不是外层 `.grok-bot-lazy` 上。
- 动态 SVG 会新增 `defs / clipPath`、效果图层、可复用的圆环与 glyph 图层；两只眼睛被裁切在头部轮廓内。

基础 CSS 很克制：SVG 宽度 100%，头部 `fill: var(--fg)`，眼睛 `fill: var(--bg)`，颜色过渡为 600ms。

## 2. 39 个 `data-state`

| 分类 | 状态 |
|---|---|
| Lifecycle | `sleeping`, `waking`, `idle`, `listening`, `thinking`, `searching`, `working` |
| Reactions | `excited`, `surprised`, `suspicious`, `angry`, `drowsy`, `happy`, `curious`, `confused`, `bored`, `proud`, `shy`, `sad`, `laughing`, `scared`, `playful`, `celebrate` |
| Agent morphs | `orbit`, `radar`, `progress` |
| Product lifecycle | `spawning`, `humming`, `loading`, `dictating`, `writing`, `sending`, `receiving`, `uploading`, `notifying`, `alerting`, `dragging`, `bouncing`, `powering-down` |

## 3. 动画系统的关键机制

1. **不是逐帧素材**：头部轮廓与眼睛都是点阵路径，运行时在路径之间做线性插值。
2. **弹性求解**：位置、旋转、横纵缩放、眼睛开合、形变进度都用阻尼弹簧推进；主循环是 `requestAnimationFrame`，大帧会被拆成更小步长，避免卡顿后的跳变。
3. **表情池**：每个状态对应 2–5 组眼形索引，并有独立的表情切换区间与眨眼区间。例如 `searching`、`excited` 的切换更快，`bored`、`sad`、`sleeping` 更慢。
4. **视线跟随**：指针位置相对组件中心归一化并限幅，约映射到横向 22、纵向 14 个 SVG 单位；随后再做平滑追踪。
5. **头部不是静止底板**：状态会同时修改平移、旋转、整体 squash / stretch。`searching` 左右扫视，`working` 有轻微点头，`excited` 会跳动，`scared` 会高频抖动。
6. **Morph 状态**：`thinking → dots`、`orbit → orbit`、`radar → radar`、`progress → progress`；任务态还映射到 `gather / wave / send / receive / dock / ball / whirl / pencil / bang / standby` 等几何符号。
7. **一次性形变**：`spawning` 与 `progress` 会在一段展示后回到休止，再重新触发，而非无限匀速循环。
8. **低动态偏好**：检测到 `prefers-reduced-motion: reduce` 后，组件选择状态表情池的第一个表情并冻结大部分动态。
9. **形状是独立属性**：`shape` 不属于 `data-state`。原组件公开 18 种形状；切换时用频率 10 的弹簧插值 96 点轮廓、`face` 眼位参数、倾斜系数和 belt radius，并轮换触发转身、弹跳或粒子动作。

## 4. 为什么它显得“可爱”

- 头部不是标准圆，而是略微偏心、带手捏感的 blob；自然的不对称先提供了性格。
- 眼睛放在右上象限，留出大块黑色负空间，看起来像一个侧着身子观察人的小生物。
- 位移很小，但每次都同时影响眼睛、头部倾角与整体纵向形变，因此动作有重量。
- 状态不是单一姿态：低频呼吸、随机眨眼、偶发侧看与主表情叠加，避免了机械循环。
- 工作状态用非常简单的几何隐喻替代文字，信息清楚，同时保留玩具感。

## 5. 本项目如何保证造型对齐

项目已经移除 3D 方案。默认二维运行时不再依靠人工估计的姿态，而是使用目标组件公开脚本中的原始数据模型：

- `component/original-data.js` 保存完整 25 组双眼环；每只眼睛 48 点，运行时在环之间插值。
- 同一文件保存 18 种原始头部形状、96 点轮廓环、脸部安全区、缩放、倾角和 belt radius。
- 形状库直接预览这 18 条原始 path；`blob` 对应圆形观感，`hex` 对应六边形，`wedge` 对应三角楔形。中文名称只是识别标签，不改动原始 ID 或几何。
- 眼睛按每个形状独立的 `face {x,y,sx,sy,eye}` 参数适配，并根据轮廓横截面限制位置；形状切换过程中，脸部参数与轮廓同步插值。
- 39 个状态直接使用原始 `EXPRESSION_POOLS`、`EXPRESSION_CADENCE` 和 `BLINK_CADENCE`。
- `component/grok-bot-engine.js` 按原始频率实现固定步长阻尼弹簧、状态运动公式、随机视线、眨眼、wink、转身及弹跳。
- 任务状态使用原始 morph 映射和几何参数，而不是另外画一套近似图标。
- 默认 `viewBox`、颜色变量、裁切层级与动态扩张规则保持原组件结构。

编辑器中的所有数值均叠加在原始参数之上；形状作为全局属性跨状态保持，状态参数继续独立保存。状态显示“原版参数”时没有人为姿态覆盖。修改后会显示“已自定义”，并可单独或整体恢复原版。

## 6. 状态切换中的细节校正

复刻不能只对齐静态 path。几处看起来像“眼睛消失”或“任务态形变不对”的问题，实际来自时间模型和叠加顺序：

- `waking` 在 1.2–1.4 秒之间还有一次恢复眨眼，不能只从睁眼直接回到 idle 眼形。
- `celebrate` 的狂转阶段会直接叠加眼球横纵抖动；宽粒子样式只在狂转窗口开启，休止段要恢复普通样式，也不能在每轮额外注入一个不存在于源组件的粒子爆发。
- 指针平滑写在原组件的双眼循环内，因此每帧会逐眼推进两次。复刻保留这个细小的不对称，而不是把平滑提前成每帧一次。
- morph 图形本身以 `morphAmount × crossfadeWeight` 混合；`dots / pencil / bang / whirl / ball` 对头部产生的位移和旋转，在最终姿态中还会再乘一次 `morphAmount`。遗漏第二次乘法会让入场初期位移过猛，直接互切时尤其明显。
- 状态运行使用独立仿真时钟。慢放、暂停和逐帧会同时作用于弹簧、状态计时、眼形、粒子及 morph，而不是只暂停界面上的一层 CSS 动画。

项目的确定性回归会遍历全部 1,521 个有序状态对，并检查 1,800 个形状、眼形、开合度组合，确保快速互切后头部 path 有效、变换值有限，且两只眼睛仍适配当前轮廓。

## 7. 编辑器配置边界

v6 配置把原组件的属性边界明确拆开：

- `shape`：全局造型，跨全部状态保持。
- `character`：材质、颜色/渐变/玻璃参数、眼色、尺寸、水平翻转、指针视线、通知颜色与尺寸。
- `states[state]`：眼形池/权重、眼形和眨眼节奏、任务 morph、姿态偏移及运动倍率。

这样从 `thinking` 切换到其他状态时，不会因为每个状态各自保存了一份材质或指针配置而产生意外差异。旧 v5 / v4 / v3 JSON 会以已有角色字段作为全局基准完成提升，并保留各状态的眼形、节奏、姿态与 morph 自定义值。

编辑器另外提供不改写状态默认值的单次 morph 预览。它先退出当前持续 morph 回到 bot，再依次经过 `RESET → ENTER → HOLD → EXIT → DONE`，最终停留在 bot；点击“恢复状态默认”才会重新采用该状态原有的持续或循环逻辑。该状态机使用同一仿真时钟，所以暂停、逐帧和播放倍率对单次形变同样有效。

## 8. 编辑器与使用组件分层

项目现在分为两个边界清楚的产品面：

- 根页面是高级编辑器，负责检查全部状态、改参数、编排切换并导出 v6 JSON。
- `component/` 是可独立复制和发布的运行时包，提供标准 `<morph-bot>` Custom Element。
- `component/index.html` 按“编辑 → 展示 → 使用”的顺序提供快速配置、真实尺寸上下文和同步生成的 HTML。

组件将 SVG 模板、动画引擎、几何数据和类型声明放在同一目录，没有向包外导入文件。每个实例使用独立 Shadow DOM 与 clip ID，属性变化直接更新运行时；实例离开视口时暂停，从 DOM 移除时清理帧循环、观察器和指针监听。编辑器仍通过根目录兼容入口引用同一套核心代码，因此不会形成两份难以同步的动画实现。

## 9. 材质系统

材质是角色级配置，不属于某个状态，也不会另画一套形状。`MaterialSystem` 在同一条实时头部 path 上应用三类表面：纯色、带明确角度和有序色标的 SVG 渐变、由彩虹基底/体积暗部/局部高光/轮廓组成的玻璃。眼睛保持在材质层上方，状态 Morph 使用相同 paint，因此切换形状、状态或任务形变时不会回退为默认黑色。

渐变数据结构参考 Open Props 的可移植 token 方式和 WebGradients 的 angle + ordered stops 表达；颜色为本项目重新设计。运行时在 OKLab 中为相邻颜色生成密集采样点，再以 SVG `sRGB` 小区间插值输出，避免三段渐变在中间色标处出现生硬拐点。彩虹玻璃的环境高光、暗部、边缘色散和内部焦散会用逆旋转抵消角色姿态旋转，因此几何在转，光场仍固定在镜头方向。全部预设集中在 `component/materials.js`，实验室、组件编辑器、生成代码和 API 文档不再各自维护名称与颜色。
