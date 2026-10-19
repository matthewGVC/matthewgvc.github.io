' Starts the GVC helper with no window. Task Scheduler runs this at log on
' (helper/install-task.ps1). Output goes to %APPDATA%\gvc-helper\helper.log.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
helperDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoDir = fso.GetParentFolderName(helperDir)
logDir = sh.ExpandEnvironmentStrings("%APPDATA%") & "\gvc-helper"
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
sh.CurrentDirectory = repoDir
' Pass node's exit code on, so Task Scheduler sees a crash and restarts the helper.
WScript.Quit sh.Run("cmd /c node """ & helperDir & "\server.js"" >> """ & logDir & "\helper.log"" 2>&1", 0, True)
