# FX Converter (Laravel API + React)

Convert any currency to any currency (default MYR -> BDT).

## Setup
Requires PHP 8.2+, Composer, Node 18+.

    ./setup.sh

Windows (no bash): run the steps in setup.sh manually: `composer create-project laravel/laravel backend`,
`php artisan install:api`, copy `backend-overlay/*` over `backend/`, append the schedule line to
`routes/console.php`, `php artisan migrate`, `php artisan rates:fetch`, then `npm install` in `frontend/`.

## Run
    cd backend  && php artisan serve
    cd frontend && npm run dev   # http://localhost:5173

## API
- GET /api/currencies
- GET /api/convert?from=MYR&to=BDT&amount=1000
- GET /api/history?from=MYR&to=BDT&days=30

## How it works
`rates:fetch` (hourly via the scheduler) stores a snapshot of USD-based rates; any pair is computed as
rate[to]/rate[from]. If no fresh snapshot exists, the API fetches on demand and falls back to the last stored one
if the provider is down. History charts fill in as daily snapshots accumulate.

Rates are mid-market and indicative; transfer providers add their own margin. Attribution to ExchangeRate-API is
required by their free-tier terms. Change the source via `RATES_API_URL` in `backend/.env`.
