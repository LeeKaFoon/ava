# ava

广东高考英语听说·三问训练（v2）——纯前端刷题工具，提供在线与离线两个入口。

## 标准工作流程

```
源码（根目录维护）                 构建                         分发
├─ index.html  页面结构 ─┐
├─ app.js      交互逻辑  ─┼→ node build-offline.js → check/index-offline.html → 发给客户
├─ data.js     题库数据  ─┘        （一键打包，固定输出到 check/）
└─ vendor/     样式引擎+字体（仅构建时读取）
```

日常操作只有两步：

1. **改源码**：更新题库改 `data.js`（规范见《题库数据团队约定.md》）；更新页面/交互改 `index.html` / `app.js`
2. **构建并分发**：在项目根目录执行

   ```bash
   node build-offline.js
   ```

   成功会输出 `OK -> check/index-offline.html (582.6 KB)`，把 **`check/index-offline.html` 这一个文件**发给客户即可。

### 注意事项

- 离线版是构建时的**快照**，改完源码必须重新构建，客户拿到的才会更新
- 构建必须在**项目根目录**执行（脚本按相对路径读取源文件）
- 构建输出的文件大小应稳定在 580 KB 左右；明显偏小说明有源文件没读到，检查后再发
- 离线版内置自检：文件传输损坏/被截断时，打开后页面底部会自动弹红色提示条说明原因

## 使用方式

- **在线版**：打开 `index.html`（依赖 Tailwind CDN 与 Google Fonts，需联网）
- **离线版**：`check/index-offline.html` —— **完全自包含的单文件**，内嵌 Tailwind 引擎、字体、`app.js`、`data.js`，无需联网、无需任何其他文件，单独拷贝/传输到任何电脑双击即用

两个页面功能与界面完全一致。

## 文件结构

```
├── index.html               # 在线版页面（CDN 资源）
├── app.js                   # 交互/筛选/持久化逻辑（IIFE 封装）
├── data.js                  # 题库数据（rawData 真题 2012–2025、mockData 模拟题）
├── build-offline.js         # 离线版构建脚本（产物输出到 check/）
├── 题库数据团队约定.md        # 题库维护规范，替换/新增题目前必读
├── vendor/                  # 构建源：Tailwind 运行时 + 本地字体（不分发）
│   ├── tailwind.js
│   └── fonts/
│       ├── inter-latin.woff2    # Inter（可变字重，latin 子集）
│       └── lexend-latin.woff2   # Lexend（可变字重，latin 子集）
└── check/                   # 打包分发目录（唯一产物）
    └── index-offline.html   # 离线版成品，发客户只需这一个文件
```

中文字符使用系统字体回退（PingFang SC / Microsoft YaHei 等），无需额外下载。

## 升级依赖

如需更新 Tailwind 运行时或字体，下载新版本覆盖 `vendor/` 内对应文件，然后执行
`node build-offline.js` 重建离线版，并断网打开自测一遍筛选与出题功能。
