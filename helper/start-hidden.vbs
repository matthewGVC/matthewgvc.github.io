' Starts the GVC helper with no window. Task Scheduler runs this at log on
' (helper/install-task.ps1). Output goes to %APPDATA%\gvc-helper\helper.log.
'
' Task Scheduler's own "restart on failure" only covers a task that fails to
' start, not a program that crashes later, so this script restarts node itself:
' after a crash it waits a minute and starts it again; a clean exit (code 0)
' ends it. GVC_HELPER_RESTART_MS shortens the wait in tests.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
helperDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoDir = fso.GetParentFolderName(helperDir)
logDir = sh.ExpandEnvironmentStrings("%APPDATA%") & "\gvc-helper"
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
sh.CurrentDirectory = repoDir
waitMs = sh.ExpandEnvironmentStrings("%GVC_HELPER_RESTART_MS%")
If Not IsNumeric(waitMs) Then waitMs = 60000

Do
  rc = sh.Run("cmd /c node """ & helperDir & "\server.js"" >> """ & logDir & "\helper.log"" 2>&1", 0, True)
  If rc = 0 Then Exit Do
  WScript.Sleep CLng(waitMs)
Loop
WScript.Quit rc
