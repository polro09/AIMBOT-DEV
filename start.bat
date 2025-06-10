@echo off
chcp 65001 >nul
title Aimdot.dev Bot Manager
color 0A

:: 작업 디렉토리 설정
cd /d "D:\Discord bot\Aimbot.dev"

:MENU
cls
echo ================================================
echo           Aimdot.dev Bot Manager
echo                 PM2 Control Panel
echo ================================================
echo.
echo   1. 봇 시작 (Start Bot)
echo   2. 봇 중지 (Stop Bot)
echo   3. 봇 재시작 (Restart Bot)
echo   4. 실시간 로그 보기 (View Logs)
echo   5. 봇 상태 확인 (Check Status)
echo   6. PM2 초기 설정 (Initial Setup)
echo   7. 봇 삭제 (Delete Bot)
echo   8. 시스템 모니터링 (System Monitor)
echo   9. 로그 파일 열기 (Open Log Files)
echo   0. 종료 (Exit)
echo.
echo ================================================
echo.
echo 현재 경로: %CD%
echo.

:: PM2 설치 확인
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] PM2가 설치되어 있지 않습니다.
    echo [!] 6번을 선택하여 초기 설정을 진행해주세요.
    echo.
)

set /p choice="원하는 작업을 선택하세요 (0-9): "

if "%choice%"=="1" goto START_BOT
if "%choice%"=="2" goto STOP_BOT
if "%choice%"=="3" goto RESTART_BOT
if "%choice%"=="4" goto VIEW_LOGS
if "%choice%"=="5" goto CHECK_STATUS
if "%choice%"=="6" goto INITIAL_SETUP
if "%choice%"=="7" goto DELETE_BOT
if "%choice%"=="8" goto SYSTEM_MONITOR
if "%choice%"=="9" goto OPEN_LOGS
if "%choice%"=="0" goto EXIT

echo.
echo [!] 잘못된 선택입니다. 다시 선택해주세요.
timeout /t 2 /nobreak >nul
goto MENU

:START_BOT
cls
echo ================================================
echo                 봇 시작
echo ================================================
echo.

:: 기존 프로세스 확인
pm2 list | findstr "aimdot-bot" >nul 2>nul
if %errorlevel% equ 0 (
    echo [!] 봇이 이미 실행 중입니다.
    echo.
    echo 1. 재시작하기
    echo 2. 메뉴로 돌아가기
    echo.
    set /p restart="선택하세요 (1-2): "
    if "%restart%"=="1" goto RESTART_BOT
    goto MENU
)

echo [*] 봇을 시작합니다...
pm2 start ecosystem.config.js

if %errorlevel% neq 0 (
    echo.
    echo [!] 봇 시작에 실패했습니다.
    echo [!] ecosystem.config.js 파일이 있는지 확인해주세요.
    pause
    goto MENU
)

echo.
echo [+] 봇이 성공적으로 시작되었습니다!
echo.
timeout /t 2 /nobreak >nul

echo 실시간 로그를 확인하시겠습니까? (Y/N)
set /p viewlog="선택: "
if /i "%viewlog%"=="Y" goto VIEW_LOGS

goto MENU

:STOP_BOT
cls
echo ================================================
echo                 봇 중지
echo ================================================
echo.

pm2 list | findstr "aimdot-bot" >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] 실행 중인 봇이 없습니다.
    echo.
    pause
    goto MENU
)

echo 정말로 봇을 중지하시겠습니까? (Y/N)
set /p confirm="선택: "

if /i "%confirm%"=="Y" (
    echo.
    echo [*] 봇을 중지합니다...
    pm2 stop aimdot-bot
    echo.
    echo [+] 봇이 중지되었습니다.
) else (
    echo.
    echo [i] 취소되었습니다.
)

echo.
pause
goto MENU

:RESTART_BOT
cls
echo ================================================
echo                 봇 재시작
echo ================================================
echo.

echo [*] 봇을 재시작합니다...
pm2 restart aimdot-bot

if %errorlevel% equ 0 (
    echo.
    echo [+] 봇이 성공적으로 재시작되었습니다!
) else (
    echo.
    echo [!] 재시작에 실패했습니다.
    echo [!] 봇이 실행 중인지 확인해주세요.
)

echo.
pause
goto MENU

:VIEW_LOGS
cls
echo ================================================
echo              실시간 로그 모니터링
echo ================================================
echo.
echo 종료하려면 Ctrl+C를 누르고 Y를 입력하세요.
echo.
echo ================================================
echo.
pm2 logs aimdot-bot --lines 50
goto MENU

:CHECK_STATUS
cls
echo ================================================
echo                 봇 상태 확인
echo ================================================
echo.

echo [프로세스 목록]
echo.
pm2 list
echo.
echo ------------------------------------------------
echo.
echo [상세 정보]
echo.
pm2 describe aimdot-bot
echo.
pause
goto MENU

:INITIAL_SETUP
cls
echo ================================================
echo                PM2 초기 설정
echo ================================================
echo.

:: 관리자 권한 확인
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] 이 기능은 관리자 권한이 필요합니다.
    echo.
    echo 1. 관리자 권한으로 재실행
    echo 2. 메뉴로 돌아가기
    echo.
    set /p admin="선택하세요 (1-2): "
    
    if "%admin%"=="1" (
        echo.
        echo [*] 관리자 권한으로 재실행합니다...
        powershell -Command "Start-Process '%~f0' -Verb RunAs"
        exit
    )
    goto MENU
)

echo [1/4] PM2 설치 확인 중...
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] PM2가 설치되어 있지 않습니다. 설치합니다...
    npm install -g pm2
    if %errorlevel% neq 0 (
        echo [!] PM2 설치에 실패했습니다.
        echo [!] Node.js가 설치되어 있는지 확인해주세요.
        pause
        goto MENU
    )
)
echo [+] PM2가 설치되어 있습니다.
echo.

echo [2/4] PM2 로그 회전 설치...
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
echo [+] 로그 회전 설정 완료
echo.

echo [3/4] 봇 시작...
pm2 start ecosystem.config.js
echo [+] 봇 시작 완료
echo.

echo [4/4] 자동 시작 설정...
echo.
echo 시스템 재부팅 시 자동으로 봇을 시작하시겠습니까? (Y/N)
set /p autostart="선택: "

if /i "%autostart%"=="Y" (
    pm2 save
    echo.
    echo [!] 아래 명령어를 복사하여 실행해주세요:
    echo.
    pm2 startup
    echo.
)

echo [+] PM2 설정이 완료되었습니다!
echo.
pause
goto MENU

:DELETE_BOT
cls
echo ================================================
echo                 봇 삭제
echo ================================================
echo.
echo [경고] 이 작업은 PM2에서 봇을 완전히 제거합니다.
echo.

echo 정말로 봇을 삭제하시겠습니까? (Y/N)
set /p confirm="선택: "

if /i "%confirm%"=="Y" (
    echo.
    echo 한번 더 확인합니다. 정말로 삭제하시겠습니까? (YES 입력)
    set /p confirm2="입력: "
    
    if /i "%confirm2%"=="YES" (
        echo.
        echo [*] 봇을 삭제합니다...
        pm2 delete aimdot-bot
        echo.
        echo [+] 봇이 삭제되었습니다.
    ) else (
        echo.
        echo [i] 취소되었습니다.
    )
) else (
    echo.
    echo [i] 취소되었습니다.
)

echo.
pause
goto MENU

:SYSTEM_MONITOR
cls
echo ================================================
echo              시스템 모니터링
echo ================================================
echo.
echo PM2 모니터링 도구를 시작합니다.
echo 종료하려면 Ctrl+C 또는 Q를 누르세요.
echo.
pause
pm2 monit
goto MENU

:OPEN_LOGS
cls
echo ================================================
echo                로그 파일 열기
echo ================================================
echo.

if exist "logs" (
    echo [*] logs 폴더를 엽니다...
    start "" "logs"
) else (
    echo [!] logs 폴더가 없습니다.
    echo [*] 폴더를 생성합니다...
    mkdir logs
    start "" "logs"
)

echo.
echo PM2 로그 위치:
pm2 info aimdot-bot | findstr "log path"
echo.
pause
goto MENU

:EXIT
cls
echo.
echo Aimdot.dev Bot Manager를 종료합니다.
echo.
timeout /t 2 /nobreak >nul
exit /b 0