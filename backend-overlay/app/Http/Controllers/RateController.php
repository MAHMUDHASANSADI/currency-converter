<?php

namespace App\Http\Controllers;

use App\Models\RateSnapshot;
use App\Services\ExchangeRateService;
use Illuminate\Http\Request;

class RateController extends Controller
{
    public function __construct(private ExchangeRateService $service) {}

    public function currencies()
    {
        $snap = $this->service->latest();
        $codes = array_keys($snap->rates);
        sort($codes);

        return response()->json(['currencies' => $codes, 'updated_at' => $snap->fetched_at]);
    }

    public function convert(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'alpha', 'size:3'],
            'to' => ['required', 'alpha', 'size:3'],
            'amount' => ['nullable', 'numeric', 'min:0', 'max:1000000000000'],
        ]);
        [$from, $to] = [strtoupper($data['from']), strtoupper($data['to'])];
        $amount = (float) ($data['amount'] ?? 1);

        $snap = $this->service->latest();
        try {
            $rate = ExchangeRateService::rate($snap->rates, $from, $to);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => 'Unsupported currency'], 422);
        }

        return response()->json([
            'from' => $from,
            'to' => $to,
            'amount' => $amount,
            'rate' => $rate,
            'inverse_rate' => 1 / $rate,
            'result' => $amount * $rate,
            'updated_at' => $snap->fetched_at,
        ]);
    }

    public function history(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'alpha', 'size:3'],
            'to' => ['required', 'alpha', 'size:3'],
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);
        [$from, $to] = [strtoupper($data['from']), strtoupper($data['to'])];

        $points = RateSnapshot::where('fetched_at', '>=', now()->subDays($data['days'] ?? 30))
            ->orderBy('fetched_at')
            ->get(['rates', 'fetched_at'])
            ->groupBy(fn ($s) => $s->fetched_at->toDateString())
            ->map(function ($day) use ($from, $to) {
                $s = $day->last();
                try {
                    return ['date' => $s->fetched_at->toDateString(), 'rate' => ExchangeRateService::rate($s->rates, $from, $to)];
                } catch (\InvalidArgumentException $e) {
                    return null;
                }
            })
            ->filter()
            ->values();

        return response()->json(['from' => $from, 'to' => $to, 'points' => $points]);
    }
}
