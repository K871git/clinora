<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('lab_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('visit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('report_name');
            $table->string('lab_name')->nullable();
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['ordered', 'received', 'reviewed'])->default('ordered');
            $table->date('ordered_at')->nullable();
            $table->date('received_at')->nullable();
            $table->timestamps();

            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_reports');
    }
};
