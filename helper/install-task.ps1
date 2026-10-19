# Registers the Windows Task Scheduler task "GVC Helper": starts the helper,
# hidden, every time Matt logs on, and restarts it if it stops.
#   powershell -ExecutionPolicy Bypass -File helper\install-task.ps1
#   powershell -ExecutionPolicy Bypass -File helper\install-task.ps1 -Uninstall
# Run it from the checkout the helper should run from (the main repo folder,
# not a temporary worktree), because the task remembers this path.
param([switch]$Uninstall)

$name = 'GVC Helper'
if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "Removed the '$name' task."
  return
}

$vbs = Join-Path $PSScriptRoot 'start-hidden.vbs'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $vbs + '"')
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'GVC Workspace desktop helper (DE sync, PDF writer). See helper/README.md.' -Force | Out-Null
Write-Output "Registered '$name': starts $vbs at log on."
