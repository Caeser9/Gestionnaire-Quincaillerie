@echo off
REM Script de démarrage de MongoDB Community Server pour Gestionnaire Quincaillerie

set MONGODB_DIR=%LOCALAPPDATA%\GestionnaireQuincaillerie\mongodb
set DATA_DIR=%LOCALAPPDATA%\GestionnaireQuincaillerie\data
set LOG_DIR=%LOCALAPPDATA%\GestionnaireQuincaillerie\logs

REM Créer les répertoires nécessaires s'ils n'existent pas
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM Vérifier si MongoDB est déjà en cours d'exécution
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo MongoDB est déjà en cours d'exécution
    exit /b 0
)

REM Démarrer MongoDB
"%MONGODB_DIR%\bin\mongod.exe" --dbpath "%DATA_DIR%" --logpath "%LOG_DIR%\mongodb.log" --bind_ip 127.0.0.1 --port 27017

if %ERRORLEVEL% EQU 0 (
    echo MongoDB démarré avec succès
) else (
    echo Erreur lors du démarrage de MongoDB
    exit /b 1
)
