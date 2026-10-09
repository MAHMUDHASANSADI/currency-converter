<?php

namespace App\Console\Commands;

use App\Services\ExchangeRateService;
use Illuminate\Console\Command;

class FetchRates extends Command
{
    protected $signature = 'rates:fetch';
    protected $description = 'Fetch the latest exchange rates and store a snapshot';

    public function handle(ExchangeRateService $service): int
    {
        try {
            $snap = $service->fetch();
        } catch (\Throwable $e) {
            $this->error('Failed: '.$e->getMessage());
            return self::FAILURE;
        }

        $this->info('Stored '.count($snap->rates).' rates at '.$snap->fetched_at);
        return self::SUCCESS;
    }
}
