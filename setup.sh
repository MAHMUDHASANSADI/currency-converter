#!/usr/bin/env bash
# Requires: PHP 8.2+, Composer, Node 18+. Creates a fresh Laravel app and applies the overlay.
set -e
cd "$(dirname "$0")"

composer create-project laravel/laravel backend --prefer-dist
cd backend
php artisan install:api --no-interaction || true
cp -r ../backend-overlay/. .
echo "\\Illuminate\\Support\\Facades\\Schedule::command('rates:fetch')->hourly();" >> routes/console.php
php artisan migrate --force
php artisan rates:fetch
cd ../frontend && npm install

echo
echo "Done. Run:"
echo "  cd backend  && php artisan serve        # API on :8000"
echo "  cd frontend && npm run dev              # UI on :5173"
echo "Production cron:  * * * * * cd /path/backend && php artisan schedule:run >> /dev/null 2>&1"
