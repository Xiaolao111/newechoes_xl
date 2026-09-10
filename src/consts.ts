export const SITE_URL = 'https://xiaolao.ink';
export const SITE_TITLE = "xiaolao' blogs";
export const SITE_DESCRIPTION = "含哺而熙，鼓腹而游";
// 新的导航结构 - 支持分层导航
export const NAV_STRUCTURE = [
    { id: "home", text: "首页", href: "/" },
    {
        id: 'articles',
        text: '博文',
        items: [
            { id: 'path', text: '网格', href: '/articles' },
            { id: 'filter', text: '筛选', href: '/filtered' }
        ]
    },
    {
        id: 'life',
        text: '生活',
        items: [
            { id: 'movies', text: '观影', href: '/movies' },
            { id: 'books', text: '读书', href: '/books' },
            { id: 'music', text: '歌单', href: '/music' }
        ]
    },
    { id: 'albums', text: '足迹', href: '/albums' },
    {
        id: 'other',
        text: '其他',
        items: [
            { id: 'about', text: '关于', href: '/about' },
            { id: 'projects', text: '项目', href: '/projects' }
        ]
    }
];

export const ARTICLE_EXPIRY_CONFIG = {
    enabled: true, // 是否启用文章过期提醒
    expiryDays: 365, // 文章过期天数
    warningMessage: '这篇文章已经发布超过一年了，内容可能已经过时，请谨慎参考。' // 提醒消息
};

export const PHOTO_ALBUM_CONFIG = {
    shareUrl: 'https://photos.app.goo.gl/',
    title: '生活碎片'
};

/** Cloudflare Pages 上的相册 Worker，浏览器从这里加载缩略图，避免直连 Google。 */
export const GOOGLE_PHOTOS_WORKER_ORIGIN = "https://xiaolao-photos.pages.dev";

/**
 * 旅行足迹相册：每个国家 / 中国省份对应一个 Google Photos「链接分享」相册。
 * 在 Google 相册里按地点建相册 → 分享 → 获取链接 → 填到 shareUrl。
 * 没填 shareUrl 时，地图仍可点进去，页面会提示还没有照片。
 */
export type TravelAlbum = {
    place: string;
    shareUrl?: string;
    title?: string;
};

export const TRAVEL_ALBUMS: TravelAlbum[] = [
    { place: "中国-黑龙江" },
    { place: "中国-吉林" },
    { place: "中国-辽宁" },
    { place: "中国-北京" },
    { place: "中国-河北" },
    { place: "中国-山东" },
    { place: "中国-江苏", shareUrl: "https://photos.app.goo.gl/U5qrc3r3ghs7q2un8" },
    { place: "中国-安徽" },
    { place: "中国-广东" },
    { place: "中国-福建" },
    { place: "中国-重庆" },
    { place: "中国-江西" },
    { place: "中国-浙江" },
    { place: "中国-上海", shareUrl: "https://photos.app.goo.gl/zhC4JsPhftJDsaBw5" },
    { place: "韩国" },
];

export const VISITED_PLACES = TRAVEL_ALBUMS.map((album) => album.place);

export function getTravelAlbum(place: string) {
    return TRAVEL_ALBUMS.find((album) => album.place === place) ?? null;
}

export function getTravelAlbumPath(place: string) {
    return `/albums/${encodeURIComponent(place)}`;
}

// 主页 diorama —— 笔记本屏幕上显示的个人信息
// 所有字段都可以改。rows 可加可减；typewriter 列表里的每一条都会被轮播打字-删除。
export const HOME_PROFILE = {
    title: 'xiaolao',                               // 屏幕上的大字
    subtitle: 'student & engineer',            // 大字下方副标题
    rows: [
        { label: 'stack', value: 'python · C/C++' },
        { label: 'contact', value: '2269221594@qq.com' },
    ] as { label: string; value: string }[],
    typewriter: [
        'git commit -m "今天也有进步"',
        'brew coffee && code',
    ] as string[],
};

