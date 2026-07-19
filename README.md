# xiaolao's blogs

个人静态博客，记录学习、生活与技术探索。

在线访问：[xiaolao.ink](https://xiaolao.ink)

## 功能

- 响应式文章博客与明暗主题
- 交互式 3D 首页场景
- Markdown / MDX 写作、代码高亮与 Mermaid 图表
- 自动生成 RSS、站点地图与 robots.txt
- 文章标签、筛选、网格浏览与全文内容索引
- 可选的读书、观影、相册、项目展示和旅行足迹页面

## 技术栈

- [Astro](https://astro.build/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React](https://react.dev/)
- [Three.js](https://threejs.org/)

## 本地运行

需要安装 Node.js 18 或更高版本。

```bash
git clone <你的仓库地址>
cd newechoes_xl
npm install
npm run dev
```

启动后访问 [http://localhost:4321](http://localhost:4321)。

## 个性化配置

网站名称、域名、导航、首页个人信息等配置集中在 `src/consts.ts`。

```ts
export const SITE_URL = "https://xiaolao.ink";
export const SITE_TITLE = "xiaolao's blogs";
export const SITE_DESCRIPTION = "含哺而熙，鼓腹而游";
```

文章存放在 `src/content/` 目录，可手动新增 Markdown 文件：

```markdown
---
title: "文章标题"
date: 2026-07-17
tags: ["标签"]
---

正文内容……
```

也可以使用交互式命令创建文章：

```bash
npm run new-post
```



## 构建与部署

构建静态站点：

```bash
npm run build
```

本地预览构建产物：

```bash
npm run preview
```

本项目部署到阿里云 OSS 时，静态文件位于 `dist/client/`。配置好 `ossutil` 后可同步上传：

```bash
ossutil sync ./dist/client/ oss://<你的-bucket-名称>/
```

在 OSS 中开启静态网站托管，并将默*认首页设为* `index.html`。

## 致谢

本项目基于 [lsy2246/newechoes](https://github.com/lsy2246/newechoes) 二次开发，保留并感谢原作者的设计与实现。

如需使用、分发或继续修改原项目相关代码，请同时遵循原仓库的说明与许可要求。