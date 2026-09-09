<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->string('payment_status', 20)->default('unpaid')->after('completed_at');
            $table->decimal('amount_paid', 10, 2)->default(0)->after('payment_status');
            $table->text('payment_notes')->nullable()->after('amount_paid');
        });
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'amount_paid', 'payment_notes']);
        });
    }
};
