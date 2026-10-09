<#
  Atoms Demo · Windows 服务化脚本（基于系统自带的任务计划程序，零第三方依赖）

  用法（管理员 PowerShell）：
    安装： powershell -ExecutionPolicy Bypass -File .\deploy\windows-service.ps1 -Action install
    查看： powershell -ExecutionPolicy Bypass -File .\deploy\windows-service.ps1 -Action status
    卸载： powershell -ExecutionPolicy Bypass -File .\deploy\windows-service.ps1 -Action uninstall

  说明：
  - 服务随开机启动，进程崩溃后自动重启；Node 请先装好并确保 node.exe 在 PATH 里。
  - install / uninstall / start / stop 需要管理员权限；脚本会提前检查并给出提示，
    status 不需要管理员权限。
  - 本文件必须保持「UTF-8 with BOM」保存：Windows PowerShell 5.1 会用 ANSI 读取
    没有 BOM 的脚本，中文会变乱码并直接导致语法错误（已实测踩过）。
#>
param(
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'status')]
    [string]$Action = 'install',

    [string]$ProjectPath = (Split-Path -Parent $PSScriptRoot),
    [string]$TaskName = 'AtomsDemo',
    [int]$Port = 8787
)

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
            [Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

# 提前挡掉"权限不足"，不然只会看到一串 拒绝访问
if ($Action -in @('install', 'uninstall', 'start', 'stop') -and -not (Test-IsAdmin)) {
    Write-Host '这个操作需要管理员权限。' -ForegroundColor Yellow
    Write-Host '  请从开始菜单右键「Windows PowerShell」→「以管理员身份运行」，然后重新执行：'
    Write-Host "    powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Action $Action"
    Write-Host '  只查看状态不需要管理员：-Action status'
    exit 1
}

function Get-EntryScript {
    $entry = Join-Path $ProjectPath 'server.js'
    if (-not (Test-Path -LiteralPath $entry)) {
        throw "在 $ProjectPath 下找不到 server.js，请用 -ProjectPath 指定正确的项目目录。"
    }
    return $entry
}

switch ($Action) {
    'install' {
        $cmd = Get-Command node -ErrorAction SilentlyContinue
        if (-not $cmd) { throw '没找到 node，请先安装 Node.js 24+ 并确认它在 PATH 里。' }
        $node = $cmd.Source
        $entry = Get-EntryScript

        Write-Host "注册计划任务 $TaskName" -ForegroundColor Cyan
        Write-Host "  程序：$node"
        Write-Host "  脚本：$entry"
        Write-Host "  目录：$ProjectPath"
        Write-Host "  端口：$Port（可用 .env 里的 PORT 调整）"

        $action = New-ScheduledTaskAction -Execute $node `
            -Argument "--disable-warning=ExperimentalWarning `"$entry`"" `
            -WorkingDirectory $ProjectPath
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -RestartCount 999 `
            -RestartInterval (New-TimeSpan -Minutes 1) `
            -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
            -Principal $principal -Settings $settings -Force | Out-Null
        Start-ScheduledTask -TaskName $TaskName
        Start-Sleep -Seconds 3

        Write-Host "`n已启动，健康检查：" -ForegroundColor Green
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port/api/health" -TimeoutSec 8
            Write-Host "  $($r.StatusCode) $($r.Content)"
        } catch {
            Write-Host "  还连不上，稍等几秒再试，或用 -Action status 查看。" -ForegroundColor Yellow
        }
    }

    'uninstall' {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "已卸载计划任务 $TaskName" -ForegroundColor Green
    }

    'start' { Start-ScheduledTask -TaskName $TaskName; Write-Host '已启动' }
    'stop'  { Stop-ScheduledTask  -TaskName $TaskName; Write-Host '已停止' }

    'status' {
        $info = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if (-not $info) { Write-Host "任务 $TaskName 未注册"; break }
        $state = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "状态：$($info.State)　上次运行：$($state.LastRunTime)　退出码：$($state.LastTaskResult)"
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port/api/health" -TimeoutSec 8
            Write-Host "健康检查：$($r.Content)" -ForegroundColor Green
        } catch {
            Write-Host "健康检查失败：$($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# ---------------------------------------------------------------------------
# 另一条路：用 NSSM 把 node 包装成「真正的」Windows 服务（可用 services.msc 管理）
#   nssm install AtomsDemo "C:\Program Files\nodejs\node.exe" "--disable-warning=ExperimentalWarning server.js"
#   nssm set AtomsDemo AppDirectory "C:\atoms-demo"
#   nssm set AtomsDemo AppStdout "C:\atoms-demo\logs\service.log"
#   nssm set AtomsDemo AppStderr "C:\atoms-demo\logs\service.log"
#   nssm set AtomsDemo AppExit Default Restart
#   nssm start AtomsDemo
# 差别：NSSM 支持优雅停止与统一日志，计划任务不需要装任何东西。
# ---------------------------------------------------------------------------
