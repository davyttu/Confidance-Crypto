@echo off
echo ========================================
echo NETTOYAGE COMPLET ET REINSTALLATION
echo ========================================
echo.

cd /d "%~dp0"

echo [1/5] Suppression de .next...
if exist ".next" rmdir /s /q ".next"

echo [2/5] Suppression de node_modules (peut prendre du temps)...
if exist "node_modules" rmdir /s /q "node_modules"

echo [3/5] Suppression de package-lock.json...
if exist "package-lock.json" del /f /q "package-lock.json"

echo [4/5] Reinstallation des dependances...
call npm install

echo [5/5] Termine !
echo.
echo ========================================
echo INSTALLATION TERMINEE
echo Vous pouvez maintenant lancer: npm run dev
echo ========================================
pause
