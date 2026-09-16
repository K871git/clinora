<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->text('soap_subjective')->nullable();
            $table->text('soap_objective')->nullable();
            $table->text('soap_assessment')->nullable();
            $table->text('soap_plan')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->dropColumn(['soap_subjective', 'soap_objective', 'soap_assessment', 'soap_plan']);
        });
    }
};
