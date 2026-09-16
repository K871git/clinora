<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vital_signs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('visit_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedSmallInteger('bp_systolic')->nullable();
            $table->unsignedSmallInteger('bp_diastolic')->nullable();
            $table->unsignedSmallInteger('pulse')->nullable();
            $table->decimal('temperature', 4, 1)->nullable();
            $table->decimal('weight', 5, 1)->nullable();
            $table->decimal('height', 5, 1)->nullable();
            $table->unsignedTinyInteger('spo2')->nullable();
            $table->unsignedSmallInteger('respiratory_rate')->nullable();
            $table->string('blood_group', 5)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vital_signs');
    }
};
