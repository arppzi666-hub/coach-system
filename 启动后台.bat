@echo off
cd /d "C:\Users\Windows11\Desktop\coach-system"
echo ========================================
echo   教练助手 - 后台管理系统启动中...
echo ========================================
echo.
echo 启动后台服务器 (端口 3000)...
start "教练助手后台" /MIN node server.js
echo.
echo 后台服务器已启动！
echo.
echo 请在浏览器打开: http://localhost:3000
echo.
echo 数据存储在: data.json
echo.
echo 按任意键打开浏览器...
pause >nul
start http://localhost:3000
