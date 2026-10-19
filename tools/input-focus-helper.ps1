# Drives tools/input-focus-repro.js with REAL OS input, safely:
#  - native dialogs are dismissed by messaging the dialog HWND owned by the harness process (no global keys);
#  - keystrokes are sent ONLY when the foreground window belongs to the harness process.
# Usage: input-focus-helper.ps1 -Electron <electron.exe> -Repo <repoRoot> -Out <dir> -Label <l> -Mode dialogs|modals
param([string]$Electron, [string]$Repo, [string]$Out, [string]$Label = 'run', [string]$Mode = 'dialogs')
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Namespace VDF -Name U -MemberDefinition @'
public delegate bool EnumProc(System.IntPtr h, System.IntPtr l);
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, System.IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint p);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(System.IntPtr h);
[DllImport("user32.dll")] public static extern bool IsWindow(System.IntPtr h);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(System.IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern System.IntPtr SendMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll")] public static extern bool PostMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
'@
New-Item -ItemType Directory -Force $Out | Out-Null
Get-ChildItem $Out -Include *.req,*.res,harness.done,harness.pid -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$ud = Join-Path $env:TEMP ("vd-focus-ud-" + [guid]::NewGuid().ToString('N').Substring(0,8))
$script = Join-Path $PSScriptRoot 'input-focus-repro.js'
$p = Start-Process -FilePath $Electron -ArgumentList @("--user-data-dir=$ud", $script, $Repo, $Out, $Label, $Mode) -PassThru
function Get-DialogWindows([uint32]$procId) {
  $list = New-Object System.Collections.ArrayList
  $cb = [VDF.U+EnumProc]{ param($h, $l) $o = 0; [void][VDF.U]::GetWindowThreadProcessId($h, [ref]$o)
    if ($o -eq $procId -and [VDF.U]::IsWindowVisible($h)) { $sb = New-Object System.Text.StringBuilder 64; [void][VDF.U]::GetClassName($h, $sb, 64); if ($sb.ToString() -eq '#32770') { [void]$list.Add($h) } }
    return $true }
  [void][VDF.U]::EnumWindows($cb, [IntPtr]::Zero); return $list
}
$t0 = Get-Date
while (-not $p.HasExited -and ((Get-Date) - $t0).TotalSeconds -lt 180) {
  foreach ($req in @(Get-ChildItem $Out -Filter *.req -ErrorAction SilentlyContinue)) {
    $res = [IO.Path]::ChangeExtension($req.FullName, '.res'); $msg = ''
    if ($req.Name -like 'dismiss-*') {
      $wins = @(); for ($i = 0; $i -lt 20 -and $wins.Count -eq 0; $i++) { $wins = @(Get-DialogWindows ([uint32]$p.Id)); if ($wins.Count -eq 0) { Start-Sleep -Milliseconds 150 } }
      if ($wins.Count -eq 0) { $msg = 'no dialog window found' }
      foreach ($h in $wins) {
        [void][VDF.U]::SendMessage($h, 0x466, [IntPtr]1, [IntPtr]::Zero); Start-Sleep -Milliseconds 300   # TDM_CLICK_BUTTON IDOK
        if ([VDF.U]::IsWindow($h)) { [void][VDF.U]::PostMessage($h, 0x10, [IntPtr]::Zero, [IntPtr]::Zero); Start-Sleep -Milliseconds 300 }  # WM_CLOSE
        foreach ($id in 100,101) { if ([VDF.U]::IsWindow($h)) { [void][VDF.U]::SendMessage($h, 0x466, [IntPtr]$id, [IntPtr]::Zero); Start-Sleep -Milliseconds 300 } }
        $msg += "dismissed hwnd=$h stillOpen=$([VDF.U]::IsWindow($h)) "
      }
    } elseif ($req.Name -like 'type-*') {
      $j = Get-Content $req.FullName -Raw | ConvertFrom-Json
      $fg = [VDF.U]::GetForegroundWindow(); $fp = 0; [void][VDF.U]::GetWindowThreadProcessId($fg, [ref]$fp)
      if ($fp -eq $p.Id) { [System.Windows.Forms.SendKeys]::SendWait($j.text); $msg = "sent (foreground owned by harness pid $fp)" }
      else { $msg = "skipped: foreground pid=$fp ($((Get-Process -Id $fp -ErrorAction SilentlyContinue).Name)) is not the harness" }
    }
    Remove-Item $req.FullName -Force -ErrorAction SilentlyContinue
    Set-Content -Path $res -Value $msg
  }
  Start-Sleep -Milliseconds 100
}
if (-not $p.HasExited) { $p.Kill(); 'TIMEOUT' }
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like "*$ud*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force $ud -ErrorAction SilentlyContinue
