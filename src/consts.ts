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
            { id: 'books', text: '读书', href: '/books' }
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

