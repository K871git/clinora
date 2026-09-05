<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained('clinics')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('mobile', 20);
            $table->date('date_of_birth')->nullable();
            $table->unsignedInteger('age')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->text('address')->nullable();
            $table->timestamps();

            $table->index('name');
            $table->index('mobile');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
