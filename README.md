# ava

广东高考英语听说·三问训练（v2）——纯前端刷题工具，提供在线与离线两个入口。

## 使用方式

- **在线版**：打开 `index.html`（依赖 Tailwind CDN 与 Google Fonts，需联网，样式与字体最完整）
- **离线版**：打开 `index-offline.html`（使用 `vendor/` 本地资源，**无需联网**，适合机房/断网环境）

两个页面功能与界面完全一致，共用同一份 `app.js` 与 `data.js`。

## 离线说明

所有第三方依赖均已本地化到 `vendor/` 目录：

```
vendor/
├── tailwind.js        # Tailwind CSS 运行时（来自 cdn.tailwindcss.com）
└── fonts/
    ├── fonts.css      # 本地 @font-face 声明
    ├── inter-latin.woff2    # Inter（可变字重，latin 子集）
    └── lexend-latin.woff2   # Lexend（可变字重，latin 子集）
```

中文字符使用系统字体回退（PingFang SC / Microsoft YaHei 等），无需额外下载。

## 文件结构

- `index.html` — 在线版页面（CDN 资源）
- `index-offline.html` — 离线版页面（本地资源）
- `app.js` — 交互/筛选/持久化逻辑（IIFE 封装）
- `data.js` — 题库数据（`rawData` 真题 2012–2025、`mockData` 模拟题）
- `题库数据团队约定.md` — 题库维护规范，替换/新增题目前必读

## 升级依赖

如需更新 Tailwind 运行时或字体，重新下载并覆盖 `vendor/` 内对应文件即可；
替换后断网打开 `index.html` 自测一遍筛选与出题功能。
