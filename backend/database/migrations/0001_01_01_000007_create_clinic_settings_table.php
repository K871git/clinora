<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinic_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->unique()->constrained('clinics')->cascadeOnDelete();
            $table->text('prescription_header')->nullable();
            $table->text('prescription_footer')->nullable();
            $table->tinyInteger('show_doctor_contact')->default(1);
            $table->tinyInteger('show_clinic_contact')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_settings');
    }
};
