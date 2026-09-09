<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\StockItemResource;
use App\Models\StockItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = StockItem::where('clinic_id', $request->user()->clinic_id)
            ->orderBy('name');

        if ($search = $request->query('q')) {
            $q->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $items = $q->get();

        return response()->json([
            'data' => StockItemResource::collection($items),
            'meta' => ['total' => $items->count()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'           => ['required', 'string', 'max:200'],
            'category'       => ['nullable', 'string', 'max:100'],
            'unit'           => ['nullable', 'string', 'max:50'],
            'selling_price'  => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'description'    => ['nullable', 'string', 'max:500'],
        ]);

        $item = StockItem::create([
            'clinic_id' => $request->user()->clinic_id,
            ...$validated,
            'stock_quantity' => $validated['stock_quantity'] ?? 0,
        ]);

        return response()->json(['data' => new StockItemResource($item)], 201);
    }

    public function update(Request $request, StockItem $stockItem): JsonResponse
    {
        if ($stockItem->clinic_id !== $request->user()->clinic_id) {
            abort(403);
        }

        $validated = $request->validate([
            'name'           => ['sometimes', 'string', 'max:200'],
            'category'       => ['nullable', 'string', 'max:100'],
            'unit'           => ['nullable', 'string', 'max:50'],
            'selling_price'  => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'description'    => ['nullable', 'string', 'max:500'],
        ]);

        $stockItem->update($validated);

        return response()->json(['data' => new StockItemResource($stockItem->fresh())]);
    }

    public function destroy(Request $request, StockItem $stockItem): JsonResponse
    {
        if ($stockItem->clinic_id !== $request->user()->clinic_id) {
            abort(403);
        }

        $stockItem->delete();

        return response()->json(['message' => 'Item deleted.']);
    }
}
