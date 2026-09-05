<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 100)->nullable()->after('avatar');
            $table->string('phone', 30)->nullable()->after('username');
            $table->enum('gender', ['male', 'female', 'other'])->nullable()->after('phone');
            $table->date('dob')->nullable()->after('gender');
            $table->text('address')->nullable()->after('dob');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['username', 'phone', 'gender', 'dob', 'address']);
        });
    }
};
