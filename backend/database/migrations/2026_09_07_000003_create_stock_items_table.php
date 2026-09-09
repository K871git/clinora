<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('unit')->nullable();
            $table->decimal('selling_price', 10, 2)->nullable();
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->index('clinic_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_items');
    }
};
