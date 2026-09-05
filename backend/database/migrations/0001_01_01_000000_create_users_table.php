<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinics', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('doctor_name', 150);
            $table->string('qualification', 150)->nullable();
            $table->text('address')->nullable();
            $table->string('contact', 30)->nullable();
            $table->string('logo_path', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained('clinics')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('email', 150)->unique();
            $table->string('password', 255);
            $table->enum('role', ['doctor', 'pharmacy']);
            $table->tinyInteger('is_active')->default(1);
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('clinics');
    }
};
