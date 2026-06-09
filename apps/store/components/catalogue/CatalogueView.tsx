"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadStoreProducts,
  setProductActive,
  softDeleteProduct,
  type CatalogueProduct,
} from "@/lib/products";

type StatusFilter = "all" | "active" | "inactive" | "out_of_stock";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CatalogueView({ storeId }: { storeId: string }) {
  const [products, setProducts] = useState<CatalogueProduct[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CatalogueProduct | null>(null);

  useEffect(() => {
    let active = true;
    loadStoreProducts(storeId)
      .then((rows) => {
        if (active) setProducts(rows);
      })
      .catch(() => {
        if (active) setError("We couldn't load your products. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (status === "active" && !p.isActive) return false;
      if (status === "inactive" && p.isActive) return false;
      if (status === "out_of_stock" && p.totalStock > 0) return false;
      return true;
    });
  }, [products, search, status]);

  const handleToggle = async (p: CatalogueProduct) => {
    setBusyId(p.id);
    setError("");
    try {
      await setProductActive(p.id, !p.isActive);
      setProducts((current) =>
        (current ?? []).map((row) =>
          row.id === p.id ? { ...row, isActive: !row.isActive } : row,
        ),
      );
    } catch {
      setError("Couldn't update that product. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (p: CatalogueProduct) => {
    setBusyId(p.id);
    setError("");
    try {
      await softDeleteProduct(p.id);
      setProducts((current) => (current ?? []).filter((row) => row.id !== p.id));
      setConfirmDelete(null);
    } catch {
      setError("Couldn't delete that product. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
            Catalogue
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
            Products
            {products ? (
              <span className="ml-2 text-[16px] font-medium text-[#958675]">
                {products.length}
              </span>
            ) : null}
          </h1>
        </div>
        {/* Add Product lands here once screen #4 ships. */}
        <span
          title="Coming soon"
          className="inline-flex cursor-default items-center gap-2 rounded-full bg-[#ece5da] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9a9034]"
        >
          + Add product
          <span className="rounded-full bg-white px-2 py-0.5 text-[9px] tracking-[0.12em] text-[#958675]">
            Soon
          </span>
        </span>
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-11 min-w-[220px] flex-1 rounded-xl border border-[#ded3c6] bg-white px-4 text-[14px] text-[#171d2b] outline-none transition focus:border-[#171d2b] focus:ring-4 focus:ring-[#ffd233]/25"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="h-11 rounded-xl border border-[#ded3c6] bg-white px-3 text-[14px] text-[#171d2b] outline-none transition focus:border-[#171d2b]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#ece5da] bg-white">
        {!products ? (
          <div className="space-y-3 p-5" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#f4efe7]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-[#7f7469]">
            {products.length === 0
              ? "No products yet."
              : "No products match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#ece5da] text-[11px] uppercase tracking-[0.1em] text-[#958675]">
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Added</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#f0ebe3] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#171d2b]">{p.name}</p>
                      <p className="text-[11px] text-[#958675]">
                        {p.categoryName ?? "Uncategorised"} · {p.variantCount} variant
                        {p.variantCount === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={p.isActive} />
                    </td>
                    <td className="px-4 py-3 text-right text-[#171d2b]">
                      {p.discountedPrice != null && p.discountedPrice < p.basePrice ? (
                        <span>
                          <span className="font-semibold">
                            {formatCurrency(p.discountedPrice)}
                          </span>{" "}
                          <span className="text-[11px] text-[#a79e92] line-through">
                            {formatCurrency(p.basePrice)}
                          </span>
                        </span>
                      ) : (
                        <span className="font-semibold">{formatCurrency(p.basePrice)}</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        p.totalStock === 0 ? "text-[#b83c24]" : "text-[#171d2b]"
                      }`}
                    >
                      {p.totalStock === 0 ? "Out" : p.totalStock}
                    </td>
                    <td className="px-4 py-3 text-right text-[#958675]">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggle(p)}
                          disabled={busyId === p.id}
                          className="rounded-lg border border-[#ded3c6] px-3 py-1.5 text-[12px] font-semibold text-[#5f574e] transition hover:border-[#171d2b] hover:text-[#171d2b] disabled:opacity-50"
                        >
                          {p.isActive ? "Deactivate" : "Activate"}
                        </button>
                        {/* Edit lands here once screen #5 ships. */}
                        <span
                          title="Coming soon"
                          className="cursor-default rounded-lg border border-[#ece5da] px-3 py-1.5 text-[12px] font-semibold text-[#bcb3a6]"
                        >
                          Edit
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p)}
                          disabled={busyId === p.id}
                          className="rounded-lg border border-[#e6c4bb] px-3 py-1.5 text-[12px] font-semibold text-[#b83c24] transition hover:bg-[#fbeeea] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-[0_30px_80px_rgba(20,20,20,0.25)]">
            <h2 className="text-[17px] font-semibold text-[#171d2b]">Delete product?</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#5f574e]">
              <strong>{confirmDelete.name}</strong> will be removed from your store.
              This can be restored from the database if needed.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-full border border-[#ded3c6] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5f574e] transition hover:border-[#171d2b] hover:text-[#171d2b]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                disabled={busyId === confirmDelete.id}
                className="rounded-full bg-[#b83c24] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#a3331d] disabled:opacity-60"
              >
                {busyId === confirmDelete.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-[#e8f3ea] px-2.5 py-1 text-[11px] font-semibold text-[#2f7d46]">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#f0ebe3] px-2.5 py-1 text-[11px] font-semibold text-[#8a8073]">
      Inactive
    </span>
  );
}
