<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->date('followup_date')->nullable();
            $table->text('followup_notes')->nullable();
            $table->index('followup_date');
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->dropIndex(['followup_date']);
            $table->dropColumn(['followup_date', 'followup_notes']);
        });
    }
};
