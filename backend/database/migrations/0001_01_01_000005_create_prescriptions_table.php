<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained('clinics')->restrictOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('visit_id')->constrained('visits')->restrictOnDelete();
            $table->foreignId('doctor_id')->constrained('users')->restrictOnDelete();
            $table->dateTime('prescribed_at');
            $table->text('doctor_notes')->nullable();
            $table->string('status', 50)->default('draft');
            $table->dateTime('sent_to_pharmacy_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->unsignedBigInteger('completed_by')->nullable();
            $table->foreign('completed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prescriptions');
    }
};
