<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clinic_settings', function (Blueprint $table) {
            $table->string('prescription_template', 255)->nullable()->after('show_clinic_contact');
        });
    }

    public function down(): void
    {
        Schema::table('clinic_settings', function (Blueprint $table) {
            $table->dropColumn('prescription_template');
        });
    }
};
