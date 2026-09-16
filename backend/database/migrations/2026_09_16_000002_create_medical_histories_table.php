<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('medical_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['allergy', 'chronic', 'surgery', 'family', 'medication', 'other']);
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('severity', ['mild', 'moderate', 'severe'])->nullable();
            $table->date('diagnosed_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_histories');
    }
};
