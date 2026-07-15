@echo off
title YT Remote Local Server with Internet Tunnel
chcp 65001 > nul
color 0b
cls

echo ======================================================
echo  ĐANG KHỞI CHẠY HỆ THỐNG ĐIỀU KHIỂN (MÁY CHỦ LAPTOP)
echo ======================================================
echo.

:: 1. Kiểm tra Node.js đã cài đặt chưa
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Lỗi] Máy tính chưa cài đặt Node.js! Vui lòng cài đặt Node.js trước.
    pause
    exit
)

:: 2. Khởi chạy Node.js Server ở cửa sổ ẩn/thu nhỏ
echo [+] Bước 1: Khởi chạy Máy chủ Node.js...
start "NodeJS Server" /min cmd /c "node server.js"

:: Đợi 2 giây để server khởi động hoàn tất
timeout /t 2 /nobreak > nul

:: 3. Khởi chạy Laptop Agent (C#) kết nối nội bộ tới localhost
echo [+] Bước 2: Khởi chạy Audio Agent (C#)...
start "Audio Agent" /min cmd /c "AudioHelper.exe connect ws://localhost:3000/laptop"

:: 4. Khởi chạy Localtunnel để mở rộng kết nối ra Internet miễn phí
echo [+] Bước 3: Đang thiết lập đường truyền Internet (Localtunnel)...
echo.
echo ------------------------------------------------------
echo  LƯU Ý QUAN TRỌNG:
echo  1. Copy link ở dòng "your url is: https://..." bên dưới
echo     và mở bằng Chrome trên điện thoại.
echo  2. Nếu điện thoại hiện trang bảo mật của Localtunnel,
echo     hãy nhấn nút "Click to Continue" để vào màn hình chính.
echo  3. Extension trên Chrome laptop hãy cấu hình URL là:
echo     ws://localhost:3000
echo ------------------------------------------------------
echo.

npx localtunnel --port 3000

echo.
echo Hệ thống đã dừng.
pause
