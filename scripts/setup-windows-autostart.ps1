# Run this script in Windows PowerShell as Administrator (NOT in WSL)
# It registers a Task Scheduler entry that starts your job-tracker via PM2 at Windows login.
#
# How to run:
#   1. Open Windows PowerShell as Administrator
#   2. Run: powershell -ExecutionPolicy Bypass -File "\\wsl.localhost\<distro>\<path-to>\job-tracker\scripts\setup-windows-autostart.ps1" -AppDir "~/job-tracker"
#
# Requires PM2 inside WSL: npm install -g pm2

param(
    # Path to the project inside WSL
    [string]$AppDir = "~/job-tracker"
)

$taskName   = "JobTracker Auto-Start"
$wslScript  = "cd $AppDir && (pm2 resurrect || pm2 start ecosystem.config.js) && pm2 save"
$action     = New-ScheduledTaskAction `
    -Execute "wsl.exe" `
    -Argument "-e bash -c `"$wslScript`""

$trigger    = New-ScheduledTaskTrigger -AtLogOn

$settings   = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries

$principal  = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force

Write-Host ""
Write-Host "Done. Task '$taskName' registered successfully." -ForegroundColor Green
Write-Host "Job Tracker will start automatically every time you log into Windows." -ForegroundColor Green
Write-Host ""
Write-Host "To verify: open Task Scheduler and look for '$taskName' under Task Scheduler Library." -ForegroundColor Cyan
