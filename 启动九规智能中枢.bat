@echo off
cd /d "%~dp0"
where pwsh.exe >nul 2>nul
if %errorlevel%==0 (
  pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\onlyoffice-deploy.ps1" -StartOnly -EnsureDockerDesktop -WaitSeconds 25
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\onlyoffice-deploy.ps1" -StartOnly -EnsureDockerDesktop -WaitSeconds 25
)
"node_modules\electron\dist\electron.exe" .
