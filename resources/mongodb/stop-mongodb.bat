@echo off
REM Script d'arrêt de MongoDB Community Server pour Gestionnaire Quincaillerie

REM Vérifier si MongoDB est en cours d'exécution
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Arrêt de MongoDB...
    taskkill /F /IM mongod.exe
    echo MongoDB arrêté
) else (
    echo MongoDB n'est pas en cours d'exécution
)
