@echo off
rem Opens Podium in its own app window. No install, no server, no internet needed.
setlocal EnableDelayedExpansion
set "APP=%~dp0index.html"
set "URL=file:///!APP:\=/!"
set "URL=!URL: =%%20!"

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "!EDGE!" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "!CHROME!" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "!EDGE!" (
  start "" "!EDGE!" --app="!URL!" --start-maximized
) else if exist "!CHROME!" (
  start "" "!CHROME!" --app="!URL!" --start-maximized
) else (
  start "" "!APP!"
)
endlocal
