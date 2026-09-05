<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained('clinics')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('doctor_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('visited_at');
            $table->text('consultation_notes')->nullable();
            $table->timestamps();

            $table->index('visited_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
