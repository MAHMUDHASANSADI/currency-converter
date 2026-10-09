<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RateSnapshot extends Model
{
    protected $fillable = ['base', 'rates', 'fetched_at'];

    protected $casts = [
        'rates' => 'array',
        'fetched_at' => 'datetime',
    ];
}
