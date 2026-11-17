param(
  [Parameter(Mandatory = $true)][int]$TargetPid,
  [int]$MemoryMB = 1024,
  [int]$MaxProcesses = 8
)

$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;

public class JgJobLimit {
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct IO_COUNTERS {
    public ulong ReadOperationCount;
    public ulong WriteOperationCount;
    public ulong OtherOperationCount;
    public ulong ReadTransferCount;
    public ulong WriteTransferCount;
    public ulong OtherTransferCount;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed;
    public UIntPtr PeakJobMemoryUsed;
  }

  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);
  [DllImport("kernel32.dll")]
  public static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION lpJobObjectInfo, uint cbJobObjectInfoLength);
  [DllImport("kernel32.dll")]
  public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);
  [DllImport("kernel32.dll")]
  public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);
  [DllImport("kernel32.dll")]
  public static extern bool CloseHandle(IntPtr hObject);
}
'@

$JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x00000008
$JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100
$JOB_OBJECT_LIMIT_JOB_MEMORY = 0x00000200
$JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000

$job = [JgJobLimit]::CreateJobObject([IntPtr]::Zero, $null)
if ($job -eq [IntPtr]::Zero) { Write-Output 'FAIL:CreateJobObject'; exit 2 }

$info = New-Object JgJobLimit+JOBOBJECT_EXTENDED_LIMIT_INFORMATION
$info.BasicLimitInformation.LimitFlags = $JOB_OBJECT_LIMIT_ACTIVE_PROCESS -bor $JOB_OBJECT_LIMIT_PROCESS_MEMORY -bor $JOB_OBJECT_LIMIT_JOB_MEMORY -bor $JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
$info.BasicLimitInformation.ActiveProcessLimit = [uint32]$MaxProcesses
$info.ProcessMemoryLimit = [UIntPtr]([uint64]$MemoryMB * 1MB)
$info.JobMemoryLimit = [UIntPtr]([uint64]$MemoryMB * 2MB)

$size = [Runtime.InteropServices.Marshal]::SizeOf([type][JgJobLimit+JOBOBJECT_EXTENDED_LIMIT_INFORMATION])
$ok = [JgJobLimit]::SetInformationJobObject($job, 9, [ref]$info, [uint32]$size)
if (-not $ok) { [JgJobLimit]::CloseHandle($job) | Out-Null; Write-Output 'FAIL:SetInformationJobObject'; exit 3 }

$process = [JgJobLimit]::OpenProcess(0x00000100 -bor 0x00000400, $false, $TargetPid)
if ($process -eq [IntPtr]::Zero) { [JgJobLimit]::CloseHandle($job) | Out-Null; Write-Output 'FAIL:OpenProcess'; exit 4 }

$assigned = [JgJobLimit]::AssignProcessToJobObject($job, $process)
[JgJobLimit]::CloseHandle($process) | Out-Null
if (-not $assigned) { [JgJobLimit]::CloseHandle($job) | Out-Null; Write-Output 'FAIL:AssignProcessToJobObject'; exit 5 }

Write-Output "READY:${TargetPid}:${MemoryMB}:${MaxProcesses}"
[Console]::Out.Flush()

# 宿主进程存活期间持有 Job 句柄；退出时 KILL_ON_JOB_CLOSE 会清理整棵进程树。
while (Get-Process -Id $TargetPid -ErrorAction SilentlyContinue) {
  Start-Sleep -Milliseconds 500
}
[JgJobLimit]::CloseHandle($job) | Out-Null
