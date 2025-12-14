; Custom NSIS script for V2rayZ installer

; Request admin privileges for installation
RequestExecutionLevel admin

; Custom install steps
!macro customInstall
  ; Add any custom installation steps here
  DetailPrint "Installing V2rayZ..."
!macroend

; Custom uninstall steps
!macro customUnInstall
  ; Clean up any additional files or registry entries
  DetailPrint "Uninstalling V2rayZ..."
  
  ; Remove auto-start registry entry if exists
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "V2rayZ"
!macroend
