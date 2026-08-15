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

### 一键部署（推荐）

在项目根目录执行（本机构建 → rsync `dist` → 服务器生成搜索索引 → `pm2 restart`）：

```bash
npm run deploy
```

等价于：

```bash
./scripts/deploy.sh
```

可选环境变量：

```bash
DEPLOY_HOST=root@<服务器公网IP> \
REMOTE_DIR=/var/www/xiaolao-blog \
PM2_APP=xiaolao-blog \
npm run deploy
```

默认 `DEPLOY_HOST` 为当前阿里云实例。

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

### 可选：接入自建 QQ 音乐 API

站点已内置 QQ 音乐歌单「博客歌单」（ID `9751662138`，分享链接
`https://c6.y.qq.com/base/fcgi-bin/u?__=hhgTVWOMHBEh`）。封面与曲目元数据可直接从
QQ 拉取；站内试听需要自建 [Meting-API](https://github.com/mikus-loli/Meting-API)
并配置 VIP Cookie（歌单内多为付费曲目）：

```bash
git clone https://github.com/mikus-loli/Meting-API.git /opt/meting-api
cd /opt/meting-api
npm install
pm2 start node.js --name qq-music-api
pm2 save
```

确认接口能返回歌单：

```bash
curl "http://127.0.0.1:2500/api?server=tencent&type=playlist&id=9751662138"
```

然后把 API 地址和歌单 ID 写入博客进程环境变量：

```bash
cd /var/www/xiaolao-blog
QQ_MUSIC_API_BASE=http://127.0.0.1:2500 \
QQ_MUSIC_PLAYLIST_ID=9751662138 \
pm2 restart xiaolao-blog --update-env
pm2 save
```

### QQ 音乐「昨天能播今天不行」

常见原因：**播放直链会过期**（通常几小时），或 Meting-API 里的
**VIP Cookie 失效**。站点已改为点击播放时通过 `/api/music/url` 现取新链接。

若仍失败，在服务器检查：

```bash
# Meting-API 是否在跑
pm2 status
curl "http://127.0.0.1:2500/api?server=tencent&type=url&id=0013FZ2a2kpRO2"

# 博客环境变量是否还在
pm2 show xiaolao-blog | grep -i QQ_MUSIC
```

若 `type=url` 返回空：打开 Meting 后台，重新粘贴 QQ Cookie 并验证 VIP。

### 可选：OSS 静态托管

若仅部署纯静态内容，构建产物中的静态文件位于 `dist/client/`，可用 `ossutil` 上传：

```bash
ossutil sync ./dist/client/ oss://<你的-bucket-名称>/
```

在 OSS 中开启静态网站托管，并将默认首页设为 `index.html`。注意：豆瓣、相册等依赖 `/api/` 的功能需要 Node 服务器，纯 OSS 无法完整支持。

## 致谢

本项目基于 [lsy2246/newechoes](https://github.com/lsy2246/newechoes) 二次开发，保留并感谢原作者的设计与实现。

如需使用、分发或继续修改原项目相关代码，请同时遵循原仓库的说明与许可要求。
