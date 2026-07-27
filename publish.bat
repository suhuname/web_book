@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   星落之城 - Vercel 一键发布
echo ========================================
echo.

REM 检查 vercel 是否安装
where vercel >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 vercel CLI，请先运行: npm install -g vercel
    pause
    exit /b 1
)

REM 检查是否已登录
vercel whoami >nul 2>nul
if errorlevel 1 (
    echo [提示] 未登录 Vercel，正在启动登录流程...
    echo 请在浏览器中完成授权（支持 GitHub 账号登录）
    echo.
    vercel login
    if errorlevel 1 (
        echo [错误] 登录失败，请重试
        pause
        exit /b 1
    )
)

echo [1/2] 正在部署到 Vercel 生产环境...
echo.

REM 执行生产部署，--yes 跳过交互确认
vercel --prod --yes > .vercel_output.txt 2>&1
if errorlevel 1 (
    echo [错误] 部署失败，详细信息：
    type .vercel_output.txt
    del .vercel_output.txt 2>nul
    pause
    exit /b 1
)

REM 从输出中提取 https 链接（优先取 aliased 域名）
set "PROD_URL="
for /f "tokens=*" %%a in ('findstr /r "https://[a-zA-Z0-9.-]*\.vercel\.app" .vercel_output.txt') do (
    set "LINE=%%a"
    if not defined PROD_URL (
        for %%u in (!LINE!) do (
            echo %%u | findstr /r "^https://" >nul && set "PROD_URL=%%u"
        )
    )
)
del .vercel_output.txt 2>nul

REM 如果没有解析到，使用已保存的域名
if not defined PROD_URL (
    if exist .vercel_url (
        set /p PROD_URL=<.vercel_url
    )
)

if not defined PROD_URL (
    echo [警告] 未能自动解析部署地址，请查看上方输出手动复制
    pause
    exit /b 0
)

REM 保存域名到本地配置
echo %PROD_URL%>.vercel_url

echo.
echo [2/2] 部署成功！
echo ========================================
echo   公开阅读地址: %PROD_URL%/reader.html
echo ========================================
echo.

REM 复制链接到剪贴板
echo %PROD_URL%/reader.html | clip
echo [√] 链接已复制到剪贴板，可直接粘贴分享
echo.

REM 询问是否打开浏览器
set /p OPEN="是否在浏览器中打开？(Y/N): "
if /i "%OPEN%"=="Y" start "" "%PROD_URL%/reader.html"

pause
