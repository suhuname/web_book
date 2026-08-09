/**
 * 前端共享配置（web_book 双端复用）
 * 消除散落硬编码（§4 配置驱动零硬编码）：存储 key、主题 key、API 端点统一在此声明。
 * 挂在 window.APP_CONFIG，零依赖、纯静态。
 */
window.APP_CONFIG = {
    // localStorage 键名
    STORAGE_KEY: 'write_book_data',
    THEME_KEY: 'write_book_theme',
    // 本地服务器 API 端点（与 server.py 契约一致，见 TOOL_CONTRACT.md）
    API: {
        NOVEL: '/api/novel',
        CHAPTER: '/api/chapter',
        INFO: '/api/info'
    }
};
