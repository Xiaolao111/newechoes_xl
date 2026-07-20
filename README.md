# xiaolao's blogs

个人博客，记录学习、生活与技术探索。

**在线网站**：[https://xiaolao.ink](https://xiaolao.ink)

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

## 本地运行与预览

需要安装 Node.js 18 或更高版本。

```bash
git clone https://github.com/Xiaolao111/newechoes_xl.git
cd newechoes_xl
npm install
```

### 开发预览（边改边看）

```bash
npm run dev
```

浏览器访问：[http://localhost:4321](http://localhost:4321)

### 构建后预览（接近线上效果）

```bash
npm run build
HOST=127.0.0.1 PORT=4321 node ./dist/server/entry.mjs
```

浏览器访问：[http://127.0.0.1:4321](http://127.0.0.1:4321)

也可用：

```bash
npm run build
npm run preview
```

## 个性化配置

网站名称、域名、导航、首页个人信息等配置集中在 `src/consts.ts`。

```ts
export const SITE_URL = "https://xiaolao.ink";
export const SITE_TITLE = "xiaolao's blogs";
export const SITE_DESCRIPTION = "含哺而熙，鼓腹而游";
```

文章存放在 `src/content/` 目录。手动新建 Markdown 时需包含 frontmatter：

```markdown
---
title: "文章标题"
date: 2026-07-17T18:00:00+08:00
tags: ["标签"]
---

正文内容……
```

推荐使用交互式命令创建文章（会自动生成标准格式）：

```bash
npm run new-post
```

## 构建与部署

本站当前部署在 **阿里云轻量服务器**，域名：[https://xiaolao.ink](https://xiaolao.ink)

项目使用 `@astrojs/node` 适配器，`output: "server"`，由 Nginx 反向代理到本机 Node 服务。

### 本机构建

轻量服务器内存有限，建议在本地完成构建：

```bash
npm run build
```

### 同步 dist 到服务器

```bash
rsync -avz --delete \
  ./dist/ \
  root@<服务器公网IP>:/var/www/xiaolao-blog/dist/
```

### 在服务器生成搜索索引（必做）

搜索栏依赖 `dist/client/index/search_index.bin`。索引工具是 **Linux x86_64** 二进制，Mac 上 `npm run build` 无法生成，需在服务器执行：

```bash
ssh root@<服务器公网IP>
cd /var/www/xiaolao-blog
chmod +x src/assets/article-index/article-indexer-cli
./src/assets/article-index/article-indexer-cli \
  --source dist/client \
  --output dist/client/index \
  --verbose
ls dist/client/index/
```

应能看到 `search_index.bin` 和 `filter_index.bin`。

### 服务器重启服务

```bash
ssh root@<服务器公网IP>
cd /var/www/xiaolao-blog
pm2 restart xiaolao-blog
```

若尚未使用 PM2，可临时启动：

```bash
HOST=127.0.0.1 PORT=4321 node ./dist/server/entry.mjs
```

### 可选：OSS 静态托管

若仅部署纯静态内容，构建产物中的静态文件位于 `dist/client/`，可用 `ossutil` 上传：

```bash
ossutil sync ./dist/client/ oss://<你的-bucket-名称>/
```

在 OSS 中开启静态网站托管，并将默认首页设为 `index.html`。注意：豆瓣、相册等依赖 `/api/` 的功能需要 Node 服务器，纯 OSS 无法完整支持。

## 致谢

本项目基于 [lsy2246/newechoes](https://github.com/lsy2246/newechoes) 二次开发，保留并感谢原作者的设计与实现。

如需使用、分发或继续修改原项目相关代码，请同时遵循原仓库的说明与许可要求。
