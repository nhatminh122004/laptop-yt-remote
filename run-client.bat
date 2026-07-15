@echo off
title YT Remote Laptop Agent
chcp 65001 > nul
color 0a
cls
echo ======================================================
echo    TRÌNH KẾT NỐI LAPTOP AGENT (CLOUDS)
echo ======================================================
echo.
echo Hướng dẫn: Nhập địa chỉ máy chủ đám mây của bạn (bắt đầu bằng wss://)
echo Ví dụ: wss://your-remote-name.glitch.me
echo.
set /p CLOUD_URL="👉 Nhập địa chỉ Cloud Server: "

if "%CLOUD_URL%"=="" (
    echo.
    echo [Lỗi] Địa chỉ không được để trống!
    pause
    exit
)

cls
echo ======================================================
echo    LAPTOP AGENT ĐANG HOẠT ĐỘNG
echo ======================================================
echo  Kết nối tới: %CLOUD_URL%
echo  Nhấn Ctrl+C để ngắt kết nối.
echo.
echo  Đang thiết lập kết nối...
echo.

AudioHelper.exe connect %CLOUD_URL%

echo.
echo Kết nối bị đóng.
pause
