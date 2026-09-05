<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            // Tracks when pharmacy moves prescription to "dispensing" (ongoing) state
            $table->dateTime('dispensed_at')->nullable()->after('sent_to_pharmacy_at');
        });
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropColumn('dispensed_at');
        });
    }
};
