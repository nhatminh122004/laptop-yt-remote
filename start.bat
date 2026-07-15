@echo off
title YT Remote Local Server
chcp 65001 > nul
color 0b
cls

echo ======================================================
echo  ĐANG KHỞI CHẠY MÁY CHỦ ĐIỀU KHIỂN (MÁY CHỦ LAPTOP)
echo ======================================================
echo.

:: Kiểm tra cài đặt Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Lỗi] Máy tính chưa cài đặt Node.js! Vui lòng cài đặt Node.js trước.
    pause
    exit
)

echo [+] Đang khởi chạy máy chủ Node.js trên cổng 3000...
echo [+] Địa chỉ máy tính: http://localhost:3000
echo [+] Địa chỉ mạng LAN (Nhập địa chỉ này trên điện thoại):
echo     👉 http://192.168.90.81:3000
echo.
echo Giữ cửa sổ này mở trong lúc sử dụng. Nhấn Ctrl+C để dừng.
echo ------------------------------------------------------
echo.

node server.js

pause
