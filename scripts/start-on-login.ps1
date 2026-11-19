# Job Tracker: auto-start on Windows login (optional, WSL2 + PM2)
# Run by Windows Task Scheduler at login. Starts WSL and brings up the app via PM2.
# Requires: npm install -g pm2 (inside WSL)

param(
    # Path to the project inside WSL. Edit to match where you cloned it.
    [string]$AppDir = "~/job-tracker"
)

wsl -e bash -lc "cd $AppDir && (pm2 resurrect || pm2 start ecosystem.config.js) && pm2 save"
