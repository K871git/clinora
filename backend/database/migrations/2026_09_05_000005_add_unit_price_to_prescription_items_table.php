<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescription_items', function (Blueprint $table) {
            $table->decimal('unit_price', 10, 2)->nullable()->default(null)->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('prescription_items', function (Blueprint $table) {
            $table->dropColumn('unit_price');
        });
    }
};
