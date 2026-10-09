<?php

use App\Http\Controllers\RateController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:60,1')->group(function () {
    Route::get('/currencies', [RateController::class, 'currencies']);
    Route::get('/convert', [RateController::class, 'convert']);
    Route::get('/history', [RateController::class, 'history']);
});
