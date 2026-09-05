<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('generic_name', 255)->nullable();
            $table->string('category', 100)->nullable();
            $table->string('unit', 50)->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->decimal('price', 10, 2)->nullable();
            $table->timestamps();

            $table->index(['clinic_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicines');
    }
};
