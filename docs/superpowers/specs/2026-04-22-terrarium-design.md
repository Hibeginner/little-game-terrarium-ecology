# 微型生态瓶推演游戏 设计文档

> 日期：2026-04-22
> 状态：已确认

## 1. 项目概述

一个基于 H5 Canvas 的微型生态瓶（Terrarium）模拟推演游戏。玩家每天向一个玻璃瓶中投放材料（土壤、水、种子、动物等），由 LLM 推演生态系统的变化，用 emoji 在 Canvas 上实时展现 100 天的生态演化。

**核心体验：** 观察 LLM 推演出的生态涌现行为——种子发芽、食物链运转、四季更替、生死循环。

### 关键决策

| 决策项 | 选择 |
|--------|------|
| 容器概念 | 生态瓶（Terrarium），玻璃瓶/缸，有明确边界 |
| 画布布局 | 网格制（12x8），按 layer 自动布局 |
| 后端通信 | WebSocket 实时通信 |
| 玩家输入 | 按钮选择材料 |
| 每日材料上限 | 每天最多 3 个操作 |
| 时间推进 | 自动推进 + 可暂停 |
| 季节周期 | 25 天/季，100 天完整四季 |
| 胜负条件 | 生存 + 多样性评分 |
| 推演引擎 | 纯 LLM 推演 + 轻量校验 |

### 技术栈

- **前端：** 纯 HTML + CSS + JavaScript + Canvas API，无框架依赖
- **后端：** Node.js + `ws` 库（WebSocket）
- **LLM 调用：** 后端通过 `child_process.exec` 调用本地 `codemaker` CLI
- **状态管理：** 后端维护完整游戏状态，前端只负责渲染

---

## 2. 系统架构

```
┌─────────────────────────────────────────┐
│              Frontend (H5)              │
│  ┌───────────┐  ┌────────┐  ┌────────┐ │
│  │  Canvas    │  │ Control│  │  Log   │ │
│  │ (emoji    │  │ Panel  │  │ Panel  │ │
│  │ terrarium)│  │(buttons│  │(daily  │ │
│  │           │  │ pause) │  │ events)│ │
│  └───────────┘  └────────┘  └────────┘ │
│              WebSocket Client           │
└──────────────┬──────────────────────────┘
               │ ws://localhost:3001
┌──────────────▼──────────────────────────┐
│            Backend (Node.js)            │
│  ┌──────────────────────────────────┐   │
│  │  WebSocket Server                │   │
│  │  - receives player input         │   │
│  │  - manages game state            │   │
│  │  - sends results back            │   │
│  └──────────┬───────────────────────┘   │
│             │ child_process.exec        │
│  ┌──────────▼───────────────────────┐   │
│  │  CodeMaker CLI                   │   │
│  │  - prompt + current state → LLM  │   │
│  │  - returns next state JSON       │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 通信协议（WebSocket 消息）

**前端 → 后端：**

```json
{
  "type": "player_action",
  "actions": [
    { "item": "water", "quantity": 2 },
    { "item": "seed", "quantity": 1 }
  ]
}
```

```json
{ "type": "pause" }
{ "type": "resume" }
{ "type": "start_game" }
```

**后端 → 前端：**

```json
{
  "type": "day_result",
  "day": 3,
  "season": "spring",
  "state": {
    "entities": [
      { "type": "soil", "emoji": "🟫", "quantity": 5, "layer": "underground", "status": "healthy" },
      { "type": "sprout", "emoji": "🌱", "quantity": 2, "layer": "low", "status": "healthy" },
      { "type": "water", "emoji": "💧", "quantity": 3, "layer": "underground", "status": "healthy" },
      { "type": "mouse", "emoji": "🐭", "quantity": 1, "layer": "low", "status": "healthy" }
    ],
    "environment": {
      "sunlight": 5,
      "humidity": 4,
      "temperature": 16,
      "fertility": 2
    }
  },
  "log": "种子在湿润的土壤中发芽了，两株嫩绿的小草破土而出。",
  "events": [
    { "type": "growth", "description": "种子发芽", "source": "seed", "target": "sprout" }
  ]
}
```

---

## 3. 生态状态模型

### 核心数据结构

```typescript
interface GameState {
  day: number;              // 1-100
  season: "spring" | "summer" | "autumn" | "winter";

  environment: {
    sunlight: number;       // 0=无光 5=适中 10=暴晒
    humidity: number;       // 0=干燥 5=适中 10=水涝
    temperature: number;    // 真实温度（℃），随季节基准浮动
    fertility: number;      // 0=贫瘠 10=肥沃
  };

  entities: Entity[];

  log: string;
  events: GameEvent[];
}

interface Entity {
  type: string;             // "soil" | "water" | "seed" | "sprout" | "grass" | ...
  emoji: string;            // 对应的 emoji
  quantity: number;         // 数量（可为小数，如 0.5 株被啃食的植物）
  layer: "underground" | "surface" | "low" | "mid" | "high" | "sky";
  status?: string;          // "healthy" | "wilting" | "dead" | "dormant" | ...
}

interface GameEvent {
  type: string;             // "birth" | "death" | "growth" | "decay" | "eat" | ...
  description: string;      // 中文描述
  source?: string;          // 引发事件的实体 type
  target?: string;          // 受影响的实体 type
}
```

### 季节温度基准

| 季节 | 天数 | 基准温度 | 范围 | 日间波动 |
|------|------|---------|------|---------|
| 春 | Day 1-25 | 15℃ | 8~22℃ | 受阳光投放影响 +1~3℃ |
| 夏 | Day 26-50 | 28℃ | 22~35℃ | 阳光过多可能达到 38℃+ |
| 秋 | Day 51-75 | 16℃ | 10~22℃ | 逐渐降温 |
| 冬 | Day 76-100 | 3℃ | -5~10℃ | 无阳光时会降到 0℃ 以下 |

### 实体分层规则 (layer)

| Layer | 层级 | 包含的实体类型 |
|-------|------|---------------|
| `underground` | 地下 | 土壤、蚯蚓、根系、水 |
| `surface` | 地表 | 种子、蘑菇、落叶、石头、蚂蚁、枯枝、冰 |
| `low` | 低矮 | 草、小花、青蛙、老鼠、蜗牛、嫩芽、花苞 |
| `mid` | 中层 | 灌木、成熟花、蜘蛛、蜜蜂、蛛网、红叶 |
| `high` | 高层 | 小树、藤蔓顶端、小鸟 |
| `sky` | 天空 | 太阳、云、蝴蝶、蜻蜓、雪花、彩虹、月亮 |

### 玩家可投放的材料

每天最多 3 个操作（所有 action 的 quantity 之和 <= 3）：

| 材料 | type | emoji | 效果 |
|------|------|-------|------|
| 土壤 | `soil` | 🟫 | +1 土壤量，提升 fertility |
| 水 | `water` | 💧 | +1 humidity，滋润植物 |
| 阳光 | `sunlight` | ☀️ | +2 sunlight，冬天必须持续投放 |
| 种子 | `seed` | 🫘 | 放置 1 颗种子，条件合适时发芽 |
| 花种 | `flower_seed` | 🌸 | 放置 1 颗花种子 |
| 石头 | `stone` | 🪨 | 装饰 + 蓄热（冬天缓释温度） |
| 枯枝 | `branch` | 🪵 | 腐烂后增加 fertility |
| 蚯蚓 | `earthworm` | 🪱 | 松土，加速 fertility 增长 |
| 蚂蚁 | `ant` | 🐜 | 清理碎屑，少量加速分解 |
| 老鼠 | `mouse` | 🐭 | 啃食植物，但粪便增加 fertility |
| 小鸟 | `bird` | 🐦 | 赶走老鼠，传播种子 |
| 青蛙 | `frog` | 🐸 | 吃蚊虫，需要水分维持 |
| 蜗牛 | `snail` | 🐌 | 缓慢消耗植物，留下分泌物增加 humidity |

---

## 4. Emoji 图鉴

### 基础材料

| type | emoji | layer | 说明 |
|------|-------|-------|------|
| `soil` | 🟫 | underground | 土壤基底 |
| `water` | 💧 | underground | 渗入土壤的水分 |
| `puddle` | 🫧 | surface | 地表积水（humidity 过高时出现） |
| `stone` | 🪨 | surface | 石头，蓄热体 |
| `branch` | 🪵 | surface | 枯枝，会腐烂 |
| `ice` | 🧊 | surface | 冬天积水结冰 |

### 植物生命周期

| type | emoji | layer | 说明 |
|------|-------|-------|------|
| `seed` | 🫘 | surface | 种子（未发芽） |
| `sprout` | 🌱 | low | 嫩芽（刚发芽） |
| `grass` | 🌿 | low | 草 |
| `herb` | 🍀 | low | 三叶草/药草 |
| `flower_seed` | 🌸 | surface | 花种子 |
| `flower_bud` | 🌷 | low | 花苞 |
| `flower` | 🌻 | mid | 盛开的花 |
| `wilted_flower` | 🥀 | low | 枯萎的花 |
| `bush` | 🌳 | mid | 灌木/小树 |
| `mushroom` | 🍄 | surface | 蘑菇（潮湿+腐殖质时长出） |
| `fallen_leaf` | 🍂 | surface | 落叶（秋天） |
| `maple_leaf` | 🍁 | mid | 红叶（秋天挂在植物上） |
| `clover` | ☘️ | low | 幸运草（稀有，随机出现） |

### 动物

| type | emoji | layer | 说明 |
|------|-------|-------|------|
| `earthworm` | 🪱 | underground | 蚯蚓，松土 |
| `ant` | 🐜 | surface | 蚂蚁，清理碎屑 |
| `snail` | 🐌 | low | 蜗牛，缓慢消耗植物 |
| `ladybug` | 🐞 | low | 瓢虫，吃害虫，有益 |
| `butterfly` | 🦋 | sky | 蝴蝶，授粉（花多时出现） |
| `dragonfly` | 🪺 | sky | 蜻蜓，吃蚊虫 |
| `bee` | 🐝 | mid | 蜜蜂，授粉加速花开 |
| `cricket` | 🦗 | surface | 蟋蟀，秋天出现 |
| `frog` | 🐸 | low | 青蛙，吃虫子，需要水 |
| `mouse` | 🐭 | low | 老鼠，啃食植物 |
| `bird` | 🐦 | high | 小鸟，赶走老鼠，传播种子 |
| `spider` | 🕷️ | mid | 蜘蛛，织网捕虫 |
| `caterpillar` | 🐛 | low | 毛毛虫，吃叶子，可变蝴蝶 |

### 天气/环境装饰

| type | emoji | layer | 触发条件 |
|------|-------|-------|---------|
| `sun` | ☀️ | sky | sunlight >= 5 |
| `mild_sun` | 🌤️ | sky | sunlight 2-4 |
| `cloud` | ☁️ | sky | sunlight <= 1 |
| `rain` | 🌧️ | sky | humidity >= 8 |
| `snow` | ❄️ | sky | 冬天 + temperature <= 0℃ |
| `snowflake` | 🌨️ | sky | 冬天降雪中 |
| `rainbow` | 🌈 | sky | 雨后 + sunlight >= 5（稀有） |
| `star` | ⭐ | sky | 夜间装饰（偶尔出现） |
| `moon` | 🌙 | sky | 夜间装饰 |
| `droplet` | 💦 | low | 露珠（清晨，春秋） |

### 死亡/衰败

| type | emoji | layer | 说明 |
|------|-------|-------|------|
| `dead_plant` | 🥀 | low | 死亡的植物 |
| `bone` | 🦴 | surface | 动物死亡残留 |
| `compost` | 🟤 | underground | 腐殖质（死亡物分解后） |
| `cobweb` | 🕸️ | mid | 蛛网（蜘蛛留下） |

---

## 5. Canvas 渲染规则

### 网格布局

瓶子为圆角矩形或椭圆形轮廓，内部 **12 列 x 8 行** 网格：

```
行 0-1 (sky)    : ☀️  ☁️  🦋          🌈
行 2   (high)   :     🐦      🐦
行 3   (mid)    :   🌻  🌳  🌻    🕸️
行 4   (low)    : 🌱🌿🐭 🌿🐸🌱🐌 🌿🌱
行 5   (surface): 🫘 🪨 🍂 🪵  🐜 🍄 🍂
行 6-7 (under)  : 🟫🟫💧🟫🪱🟫🟫💧🟫🟫🟫🟫
```

### 自动布局算法

1. 按 `layer` 将实体分配到对应行范围
2. 同一层内，根据 `quantity` 铺满格子（quantity=3 就放 3 个 emoji）
3. 同一层格子不够时，随机选择性展示
4. 每天渲染时加轻微随机偏移（每个 emoji 在格子内偏移 ±2px），避免看起来死板

### 季节视觉变化

- **春：** 背景淡绿色 `#E8F5E9`，瓶子外围偶尔飘落花瓣
- **夏：** 背景暖黄色 `#FFF8E1`，阳光光线更强烈
- **秋：** 背景橙褐色 `#FBE9E7`，落叶从顶部缓缓飘落
- **冬：** 背景冷蓝色 `#E3F2FD`，雪花飘落效果

### 动画

- 新出现的实体淡入（0.5s）
- 死亡的实体淡出（0.5s）
- 蝴蝶/小鸟缓慢浮动
- 每日状态过渡 0.8s

---

## 6. 生态规则

### 一、基础生存规则

| # | 规则 | 细节 |
|---|------|------|
| 1 | 无土不生长 | soil=0 时，所有种子无法发芽，已有植物每天 -0.5 |
| 2 | 水分不足植物枯萎 | humidity<=1 时，植物每天有 30% 概率变为 wilting，连续 3 天 wilting 即死亡 |
| 3 | 水分过多淹死 | humidity>=9 时，地面动物（蚂蚁、蚯蚓、老鼠）每天 40% 概率死亡，植物根部腐烂 |
| 4 | 阳光过强灼伤 | sunlight>=8 时，嫩芽/花苞有 50% 概率枯萎，动物躲藏（暂时消失 1 天） |
| 5 | 阳光不足停滞 | sunlight<=1 时，植物不生长，光合作用停止 |
| 6 | 冻死规则 | temperature<=0℃ 时，无耐寒属性的植物每天 40% 概率死亡，冷血动物（青蛙、蜗牛）进入休眠或死亡 |
| 7 | 高温规则 | temperature>=35℃ 时，水分蒸发加速（humidity 每天 -2），动物活动减少 |

### 二、植物规则

| # | 规则 | 细节 |
|---|------|------|
| 8 | 种子发芽条件 | 需要 soil>=1 且 humidity>=3 且 temperature 5~30℃，满足后 2-3 天发芽为 sprout |
| 9 | 生长阶段 | seed → sprout(2-3天) → grass/herb(3-5天) → bush(10-15天)；花种子路径：flower_seed → flower_bud(3天) → flower(5天) |
| 10 | 蘑菇自动生成 | humidity>=6 且 fertility>=5 且有 compost/fallen_leaf 时，20% 概率每天长出 1 个蘑菇 |
| 11 | 秋天落叶 | 秋天（Day 51-75），bush 和成熟植物每天 20% 概率掉落 fallen_leaf，自身不死亡 |
| 12 | 冬天休眠 | 冬天大部分植物进入 dormant 状态，停止生长但不死亡（除非冻死） |
| 13 | 春天复苏 | 春天 dormant 植物自动恢复为 healthy，fallen_leaf 逐渐分解为 compost |

### 三、动物食物链规则

| # | 规则 | 细节 |
|---|------|------|
| 14 | 老鼠啃食 | 每只老鼠每天吃掉 0.5 单位植物（草/花/灌木均可） |
| 15 | 小鸟驱鼠 | 每只小鸟可赶走 1 只老鼠（老鼠被赶走后消失） |
| 16 | 小鸟传播种子 | 小鸟每天 30% 概率在 surface 层随机种下 1 颗 seed |
| 17 | 毛毛虫吃叶 | 每只毛毛虫每天吃掉 0.3 单位草/叶 |
| 18 | 毛毛虫化蝶 | 毛毛虫存活 7 天后变为蝴蝶 |
| 19 | 蝴蝶授粉 | 蝴蝶/蜜蜂存在时，flower_bud → flower 时间缩短 1 天 |
| 20 | 青蛙吃虫 | 每只青蛙每天消灭 1 只蚂蚁/蟋蟀/毛毛虫（优先吃毛毛虫） |
| 21 | 蜘蛛捕虫 | 蜘蛛每天捕获 0.5 只飞行昆虫（蝴蝶、蜜蜂、蜻蜓） |
| 22 | 瓢虫益虫 | 瓢虫存在时，植物被虫害的概率减半 |
| 23 | 蜗牛缓食 | 每只蜗牛每天吃掉 0.2 单位植物，但留下的分泌物 +0.1 humidity |

### 四、分解与循环规则

| # | 规则 | 细节 |
|---|------|------|
| 24 | 死亡分解 | 死亡植物 3 天后变为 compost，死亡动物 2 天后变为 bone，bone 5 天后消失并 +1 fertility |
| 25 | 枯枝腐烂 | branch 投入后 5-8 天腐烂为 compost |
| 26 | 落叶分解 | fallen_leaf 4-6 天分解为 compost |
| 27 | 蚯蚓加速 | 蚯蚓存在时，所有分解时间减半，fertility 每天额外 +0.2 |
| 28 | compost 转化 | compost 积累后自动增加 fertility（每 2 个 compost = +1 fertility） |

### 五、季节特殊事件

| # | 季节 | 事件 | 触发 |
|---|------|------|------|
| 29 | 春 | 惊蛰：地下蚯蚓活跃度翻倍 | Day 5 自动触发 |
| 30 | 春 | 春雨：连续 2 天 humidity +2 | 15%/天 |
| 31 | 夏 | 暴晒：sunlight 临时 +3 | 10%/天 |
| 32 | 夏 | 夏雷阵雨：sunlight 骤降，humidity +3 | 10%/天 |
| 33 | 秋 | 丰收：所有成熟植物 quantity +0.5 | Day 55 自动触发 |
| 34 | 秋 | 秋风：随机吹走 1 个 sky 层实体 | 15%/天 |
| 35 | 冬 | 初雪：temperature -5℃，地表覆盖 ❄️ | Day 80 自动触发 |
| 36 | 冬 | 寒潮：连续 3 天 temperature -3℃ | 10%/天 |
| 37 | 任意 | 彩虹：雨后+阳光，纯装饰 | 雨后 sunlight>=5 时 40% |
| 38 | 春夏 | 幸运草：随机长出 ☘️ clover | 3%/天 |

### 六、动物生存需求

| 动物 | 食物需求 | 水分需求 | 温度耐受 | 特殊 |
|------|---------|---------|---------|------|
| 🪱 蚯蚓 | 不需要 | humidity>=2 | 0~30℃ | 冬天休眠 |
| 🐜 蚂蚁 | 碎屑（自动） | 不需要 | 5~35℃ | 水淹即死 |
| 🐌 蜗牛 | 植物 0.2/天 | humidity>=3 | 5~28℃ | 冬天休眠 |
| 🐞 瓢虫 | 害虫（自动） | 不需要 | 5~32℃ | 冬天消失 |
| 🐛 毛毛虫 | 植物 0.3/天 | 不需要 | 10~30℃ | 7天后化蝶 |
| 🦋 蝴蝶 | 花蜜（需花） | 不需要 | 15~32℃ | 无花则 3 天后离开 |
| 🐝 蜜蜂 | 花蜜（需花） | 不需要 | 12~35℃ | 无花则 2 天后离开 |
| 🐸 青蛙 | 虫 1/天 | humidity>=4 | 5~32℃ | 冬天冬眠 |
| 🐭 老鼠 | 植物 0.5/天 | humidity>=1 | -5~35℃ | 最耐寒动物 |
| 🐦 小鸟 | 虫/种子 | 不需要 | -3~35℃ | 可离开瓶子（飞走） |
| 🕷️ 蜘蛛 | 飞虫 0.5/天 | 不需要 | 0~30℃ | 无猎物 5 天后离开 |
| 🦗 蟋蟀 | 植物碎屑 | 不需要 | 8~28℃ | 秋天自动出现 |

---

## 7. LLM Prompt 设计

### System Prompt（固定，写入配置文件）

```
你是一个微型生态瓶模拟器。你的任务是根据当前生态状态和玩家输入，推演出下一天的生态变化。

## 身份
你是自然法则的执行者。你必须严格遵守生态规则，同时在规则允许的范围内创造合理的涌现行为。

## 生态规则
[嵌入 Section 6 的全部规则表]

## Emoji 图鉴
[嵌入 Section 4 的实体类型表，LLM 只能使用图鉴中的 type 和 emoji]

## 输出要求
1. 严格以 JSON 格式输出，不要输出任何 JSON 之外的内容
2. entities 中每个实体必须包含 type, emoji, quantity, layer, status 字段
3. quantity 精确到小数点后 1 位
4. log 字段用 1-3 句中文描述今天发生的关键事件，语气像自然纪录片旁白
5. events 列出所有发生的事件
6. 不要凭空创造图鉴之外的实体类型
7. 遵守数量守恒：实体不能凭空出现或消失，必须有规则依据
```

### User Prompt（每天动态组装）

```
## 当前状态
- 第 {day} 天 / {season}（{season_cn}）
- 温度：{temperature}℃
- 环境：sunlight={sunlight}, humidity={humidity}, fertility={fertility}

## 瓶内实体
{entities_json}

## 玩家今日操作
{player_actions_json}

## 请推演第 {day+1} 天的状态
请根据生态规则，计算所有变化，输出完整的下一天状态 JSON。
```

### 输出 JSON Schema

```json
{
  "day": 4,
  "season": "spring",
  "environment": {
    "sunlight": 5,
    "humidity": 4,
    "temperature": 16,
    "fertility": 2
  },
  "entities": [
    {
      "type": "soil",
      "emoji": "🟫",
      "quantity": 5,
      "layer": "underground",
      "status": "healthy"
    }
  ],
  "log": "春雨绵绵，土壤湿润了许多。一颗种子在温暖的泥土中悄悄裂开了壳。",
  "events": [
    {
      "type": "growth",
      "description": "一颗种子开始发芽",
      "source": "seed",
      "target": "sprout"
    }
  ]
}
```

### CodeMaker CLI 调用方式

```bash
echo '<完整prompt>' | codemaker chat --no-interactive
```

或写入临时文件：

```bash
codemaker chat --no-interactive < /tmp/terrarium_prompt.txt
```

后端解析 stdout 中的 JSON。如果 LLM 输出了非 JSON 内容，提取 ` ```json ``` ` 包裹的部分再尝试解析。仍然失败则重试 1 次。

### 轻量校验层

LLM 返回 JSON 后，后端做以下校验：

1. **字段完整性：** 必须包含 day, season, environment, entities, log, events
2. **数值范围：** temperature 在 -10~45℃，sunlight/humidity/fertility 在 0~10
3. **实体合法性：** 所有 entity.type 必须在图鉴中，emoji 必须与 type 匹配
4. **quantity 非负：** 所有 quantity >= 0，为 0 的实体自动移除
5. **season 正确：** 根据 day 计算 season 是否正确，不正确则修正

校验失败的字段直接用上一天的值兜底，不重试。

---

## 8. 前端 UI 布局与交互流程

### 页面布局

```
┌──────────────────────────────────────────────────────┐
│  🌿 微型生态瓶   Day 3/100   🌸春天   🌡️16℃       │  ← 顶栏
│                              💧4  ☀️5  🌱3          │
├────────────────────────────┬─────────────────────────┤
│                            │  📋 每日日志            │
│                            │─────────────────────────│
│                            │  Day 3:                 │
│     ┌──────────────────┐   │  🫘→🌱 种子发芽了       │
│     │   ☀️    🦋       │   │  💧 土壤吸收了水分      │
│     │      🐦          │   │                         │
│     │  🌻  🌳  🌻     │   │  Day 2:                 │
│     │ 🌱🌿🐭🌿🐸🌱   │   │  ...                    │
│     │ 🫘🪨 🍂🪵 🐜🍄  │   │                         │
│     │ 🟫🟫💧🟫🪱🟫🟫  │   │                         │
│     └──────────────────┘   │                         │
│        生态瓶 (Canvas)      │                         │
├────────────────────────────┴─────────────────────────┤
│  今日操作 (剩余 3/3)                                  │
│  🟫土壤  💧水  ☀️阳光  🫘种子  🌸花种  🪨石头       │
│  🪵枯枝  🪱蚯蚓  🐜蚂蚁  🐭老鼠  🐦小鸟  🐸青蛙   │
│  🐌蜗牛                                              │
│                                    [⏸暂停] [▶️确认]   │
└──────────────────────────────────────────────────────┘
```

### 三大区域

**顶栏（状态条）：** 游戏名称、Day X/100、季节+emoji（🌸春 ☀️夏 🍂秋 ❄️冬）、🌡️温度℃、环境指标快览（💧humidity ☀️sunlight 🌱fertility）

**主体区域（左右分栏）：**
- 左 60%：Canvas 生态瓶，圆角矩形玻璃质感边框，12x8 网格
- 右 40%：日志面板，按天倒序，事件用 emoji 前缀标识，可滚动

**底部操作栏：** 材料按钮网格（emoji+中文名）、剩余操作次数、确认/暂停按钮

### 交互流程（单日循环）

1. 玩家选择材料（点击按钮，数量角标+1，可点多次，可取消）
2. 点击 [确认]
3. 底部栏禁用，显示 "推演中..."
4. WebSocket 发送 player_action
5. 后端组装 prompt → 调用 codemaker CLI → 校验 → 推送 day_result
6. 前端收到结果：
   - 顶栏数据更新
   - Canvas 动画过渡（0.8s 淡入淡出）
   - 日志面板顶部插入新日志
   - 底部栏恢复可操作
7. 自动推进：3 秒倒计时，无操作则发送空操作进入下一天

### 特殊界面

- **Day 1 开场：** 空瓶子 + 引导文字「欢迎来到你的生态瓶，往里面放点什么吧」
- **Day 100 结算：** 全屏结算画面 + 评分
- **全灭判定：** 弹出提示但游戏继续，玩家可重新投放

---

## 9. 评分系统

### 评分时机

Day 100 结束时进行最终结算。过程中不显示分数。

### 评分维度（总分 100 分）

**1. 生物多样性（40 分）**

| 存活物种数 | 得分 |
|-----------|------|
| 0 种 | 0 分 |
| 1-3 种 | 10 分 |
| 4-6 种 | 20 分 |
| 7-9 种 | 30 分 |
| 10+ 种 | 40 分 |

物种 = 不同的 entity type（status 非 dead 且 quantity > 0），植物和动物都算。

**2. 生态平衡（30 分）**

| 指标 | 满分 | 计算方式 |
|------|------|---------|
| 食物链完整性 | 10 分 | 同时存在植物+草食动物+捕食者 = 10 分，缺一层 -4 分 |
| 环境参数均衡 | 10 分 | sunlight/humidity/fertility 都在 3-7 范围 = 10 分，每个超标 -3 分 |
| 植物覆盖率 | 10 分 | 植物总 quantity / 网格总数 >= 30% = 10 分，按比例折算 |

**3. 生存韧性（20 分）**

| 指标 | 满分 | 计算方式 |
|------|------|---------|
| 存活天数 | 10 分 | 瓶内始终有至少 1 个生物存活的连续天数，100 天全活 = 10 分 |
| 安度寒冬 | 10 分 | 冬季结束时仍有生物存活 = 5 分，存活 3 种以上 = 10 分 |

**4. 特殊成就（10 分，可超额）**

| 成就 | 分值 | 条件 |
|------|------|------|
| 🌈 彩虹守护者 | 2 分 | 游戏中出现过彩虹 |
| ☘️ 幸运之瓶 | 2 分 | 出现过幸运草 |
| 🦋 破茧成蝶 | 2 分 | 毛毛虫成功化蝶 |
| 🌳 参天之木 | 2 分 | 培育出 bush |
| 🍄 菌落王国 | 2 分 | 同时存在 3+ 蘑菇 |
| 🐦 百鸟朝凤 | 2 分 | 同时存在 3+ 只小鸟 |
| ⚖️ 完美平衡 | 2 分 | 任意一天所有环境参数都在 4-6 |

### 评级

| 分数 | 评级 | 称号 |
|------|------|------|
| 90+ | S | 生态大师 |
| 80-89 | A | 自然守护者 |
| 60-79 | B | 园艺爱好者 |
| 40-59 | C | 生态新手 |
| 0-39 | D | 生态灾难 |

### Day 100 结算画面

```
┌──────────────────────────────────────┐
│         🌿 你的生态瓶故事 🌿         │
│                                      │
│     [最终生态瓶状态 Canvas 截图]      │
│                                      │
│  📊 最终评分                         │
│  ──────────────────────              │
│  🌍 生物多样性    30/40              │
│  ⚖️ 生态平衡      22/30              │
│  💪 生存韧性      18/20              │
│  ⭐ 特殊成就       6/10+             │
│  ──────────────────────              │
│  总分: 76/100  评级: A               │
│                                      │
│  🏆 获得成就:                        │
│  🦋 破茧成蝶  🌳 参天之木            │
│  ☘️ 幸运之瓶                         │
│                                      │
│         [再来一次]                    │
└──────────────────────────────────────┘
```

---

## 10. 项目文件结构

```
little-game-4/
├── frontend/
│   ├── index.html          # 主页面
│   ├── style.css           # 样式
│   ├── app.js              # 主逻辑（WebSocket、交互）
│   ├── canvas.js           # Canvas 渲染（瓶子、emoji 布局）
│   └── constants.js        # emoji 图鉴、材料定义
├── backend/
│   ├── server.js           # WebSocket 服务 + 游戏状态管理
│   ├── llm.js              # CodeMaker CLI 调用 + 输出解析
│   ├── validator.js         # LLM 输出校验
│   ├── prompt.js           # Prompt 模板组装
│   └── rules.txt           # 生态规则文本（嵌入 system prompt）
├── package.json
└── docs/
```
