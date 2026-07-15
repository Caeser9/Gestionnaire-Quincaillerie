; Script NSIS personnalisé pour l'installation de MongoDB Community Server
; Ce script sera exécuté pendant l'installation de l'application

!macro customInstall
  ; Installation de MongoDB Community Server
  DetailPrint "Installation de MongoDB Community Server..."
  
  ; Chemin vers le fichier MSI de MongoDB
  SetOutPath "$INSTDIR\resources\mongodb"
  
  ; Exécuter l'installation de MongoDB en mode silencieux
  ; Installation dans le dossier LocalAppData de l'utilisateur
  ExecWait 'msiexec /i "$INSTDIR\resources\mongodb\mongodb.msi" /quiet /norestart INSTALLDIR="$LOCALAPPDATA\GestionnaireQuincaillerie\mongodb" ADDLOCAL="all"'
  
  ; Créer les répertoires de données et logs
  CreateDirectory "$LOCALAPPDATA\GestionnaireQuincaillerie\data"
  CreateDirectory "$LOCALAPPDATA\GestionnaireQuincaillerie\logs"
  
  DetailPrint "MongoDB installé avec succès"
!macroend

!macro customUninstall
  ; Arrêter MongoDB si en cours d'exécution
  DetailPrint "Arrêt de MongoDB..."
  nsExec::ExecToLog 'taskkill /F /IM mongod.exe'
  Pop $0
  
  ; Désinstaller MongoDB Community Server
  DetailPrint "Désinstallation de MongoDB Community Server..."
  
  ; Utiliser le programme de désinstallation de MongoDB
  ; Le chemin peut varier selon la version, on essaie plusieurs chemins possibles
  IfFileExists "$LOCALAPPDATA\GestionnaireQuincaillerie\mongodb\Uninstall MongoDB.exe" 0 +2
    ExecWait '"$LOCALAPPDATA\GestionnaireQuincaillerie\mongodb\Uninstall MongoDB.exe" /quiet /norestart'
  
  ; Supprimer les répertoires de données et logs
  DetailPrint "Suppression des données MongoDB..."
  RMDir /r "$LOCALAPPDATA\GestionnaireQuincaillerie\data"
  RMDir /r "$LOCALAPPDATA\GestionnaireQuincaillerie\logs"
  
  ; Supprimer le répertoire MongoDB
  RMDir /r "$LOCALAPPDATA\GestionnaireQuincaillerie\mongodb"
  
  DetailPrint "MongoDB désinstallé avec succès"
!macroend
