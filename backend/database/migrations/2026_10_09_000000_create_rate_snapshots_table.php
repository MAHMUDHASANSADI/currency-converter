<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('rate_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('base', 3)->default('USD');
            $table->json('rates');
            $table->timestamp('fetched_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rate_snapshots');
    }
};
