@echo off
echo Re-encoding video for OBS compatibility...
echo.

REM Get the video file path
set "VIDEO_FILE=%APPDATA%\VirtualDeck\sounds\test2_1758742637740_video.mp4"
set "OUTPUT_FILE=%APPDATA%\VirtualDeck\sounds\test2_1758742637740_video_obs.mp4"

echo Input file: %VIDEO_FILE%
echo Output file: %OUTPUT_FILE%
echo.

REM Check if ffmpeg is available
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: FFmpeg is not installed or not in PATH
    echo Please install FFmpeg first: https://ffmpeg.org/download.html
    pause
    exit /b 1
)

REM Re-encode the video with H.264 + AAC (OBS-compatible)
echo Re-encoding video...
ffmpeg -i "%VIDEO_FILE%" -c:v libx264 -c:a aac -movflags faststart -preset fast "%OUTPUT_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Video re-encoded successfully!
    echo Original file: %VIDEO_FILE%
    echo New file: %OUTPUT_FILE%
    echo.
    echo The new file should work in OBS browser source.
) else (
    echo.
    echo ERROR: Failed to re-encode video
)

pause
