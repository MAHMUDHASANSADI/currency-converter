<?php

namespace App\Services;

use App\Models\RateSnapshot;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class ExchangeRateService
{
    /** Pull fresh rates from the external API and store a snapshot. */
    public function fetch(): RateSnapshot
    {
        $res = Http::timeout(15)->retry(2, 500)->get(config('rates.url'))->throw()->json();

        if (($res['result'] ?? null) !== 'success' || empty($res['rates'])) {
            throw new \RuntimeException('Unexpected response from rates API');
        }

        $snap = RateSnapshot::create([
            'base' => $res['base_code'] ?? 'USD',
            'rates' => $res['rates'],
            'fetched_at' => now(),
        ]);

        Cache::put('rates.latest', $snap, 600);

        return $snap;
    }

    /** Latest snapshot: cache -> DB -> API (falls back to stale DB data if the API fails). */
    public function latest(): RateSnapshot
    {
        return Cache::remember('rates.latest', 600, function () {
            $snap = RateSnapshot::latest('fetched_at')->first();
            $stale = $snap && $snap->fetched_at->lt(now()->subMinutes(config('rates.max_age_minutes')));

            if (! $snap || $stale) {
                try {
                    return $this->fetch();
                } catch (\Throwable $e) {
                    report($e);
                    if ($snap) {
                        return $snap;
                    }
                    throw $e;
                }
            }

            return $snap;
        });
    }

    /** Cross rate between any two currencies in a snapshot. */
    public static function rate(array $rates, string $from, string $to): float
    {
        if (! isset($rates[$from], $rates[$to]) || $rates[$from] == 0) {
            throw new \InvalidArgumentException('Unsupported currency');
        }

        return $rates[$to] / $rates[$from];
    }
}
