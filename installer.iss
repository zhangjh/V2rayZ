; V2rayZ - Inno Setup Script
; This script creates a Windows installer for the V2rayZ application

#define MyAppName "V2rayZ"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "V2rayZ Project"
#define MyAppURL "https://github.com/v2rayclient/v2ray-windows-client"
#define MyAppExeName "V2rayClient.exe"
#define MyAppId "{{8F7A3B2C-9D4E-4F1A-B8C6-2E5D7A9F3C1B}"

[Setup]
; Basic application information
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=LICENSE.txt
InfoBeforeFile=INSTALLER_INFO.txt
OutputDir=installer-output
OutputBaseFilename=V2rayClient-Setup-{#MyAppVersion}
SetupIconFile=V2rayClient\Resources\app.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

; Privileges
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Uninstall
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

; Version information
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoCopyright=Copyright (C) 2025 {#MyAppPublisher}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
; Note: ChineseSimplified.isl may not be included in all Inno Setup installations
; Uncomment the line below if you have the Chinese language file installed
; Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode
Name: "autostart"; Description: "开机自动启动 (Start automatically on system startup)"; GroupDescription: "启动选项 (Startup Options):"; Flags: unchecked

[Files]
; Main application executable
Source: "publish\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; Frontend files (wwwroot)
Source: "publish\wwwroot\*"; DestDir: "{app}\wwwroot"; Flags: ignoreversion recursesubdirs createallsubdirs

; V2ray resources
Source: "publish\Resources\*"; DestDir: "{app}\Resources"; Flags: ignoreversion recursesubdirs createallsubdirs

; Additional DLLs (if any - for framework-dependent builds)
Source: "publish\*.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; Documentation
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion isreadme
Source: "QUICKSTART.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
; Start Menu shortcuts
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\快速入门 (Quick Start)"; Filename: "{app}\QUICKSTART.md"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; Desktop shortcut (optional)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

; Quick Launch shortcut (optional, for older Windows)
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Option to launch application after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Registry]
; Auto-start registry entry (optional task)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#MyAppName}"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: autostart

; Application settings registry key
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}"; Flags: uninsdeletekeyifempty
Root: HKCU; Subkey: "Software\{#MyAppPublisher}\{#MyAppName}\Settings"; Flags: uninsdeletekey

[Code]
// Check if .NET 8 Runtime is installed (for framework-dependent builds)
function IsDotNet8Installed(): Boolean;
var
  ResultCode: Integer;
begin
  // Check if dotnet command exists and can query runtime version
  Result := Exec('cmd.exe', '/c dotnet --list-runtimes | findstr "Microsoft.WindowsDesktop.App 8"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

// Check for .NET Runtime before installation (optional - only for framework-dependent builds)
function InitializeSetup(): Boolean;
begin
  Result := True;
  
  // Uncomment the following lines for framework-dependent builds
  (*
  if not IsDotNet8Installed() then
  begin
    if MsgBox('.NET 8 Runtime is required but not installed.' + #13#10 + #13#10 +
              'Would you like to download and install it now?' + #13#10 + #13#10 +
              'The installer will open the download page in your browser.',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://dotnet.microsoft.com/download/dotnet/8.0/runtime', '', '', SW_SHOW, ewNoWait, ResultCode);
    end;
    Result := False;
  end;
  *)
end;

// Clean up application data on uninstall (optional)
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  AppDataPath: String;
  ResultCode: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    AppDataPath := ExpandConstant('{userappdata}\V2rayClient');
    
    if DirExists(AppDataPath) then
    begin
      if MsgBox('Do you want to remove application data and configuration files?' + #13#10 + #13#10 +
                'Path: ' + AppDataPath + #13#10 + #13#10 +
                'Select "Yes" to remove all data, or "No" to keep your settings.',
                mbConfirmation, MB_YESNO) = IDYES then
      begin
        DelTree(AppDataPath, True, True, True);
      end;
    end;
  end;
end;

// Check if application is running before installation
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  
  // Check if the application is running
  if CheckForMutexes('V2rayClientMutex') then
  begin
    Result := 'V2ray Client is currently running.' + #13#10 + #13#10 +
              'Please close the application before continuing with the installation.';
  end;
end;
