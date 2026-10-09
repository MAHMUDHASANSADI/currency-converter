<?php

return [
    // Free, keyless endpoint covering ~160 currencies incl. BDT and MYR (daily updates).
    // Attribution to ExchangeRate-API is required by their terms: https://www.exchangerate-api.com
    'url' => env('RATES_API_URL', 'https://open.er-api.com/v6/latest/USD'),
    'max_age_minutes' => (int) env('RATES_MAX_AGE_MINUTES', 120),
];
