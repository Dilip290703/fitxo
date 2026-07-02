"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadStoreProducts,
  setProductActive,
  softDeleteProduct,
  type CatalogueProduct,
} from "@/lib/products";
import { formatCurrency, formatDate } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { RowsSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { inputClass } from "@/components/ui/FormField";

type StatusFilter = "all" | "active" | "inactive" | "out_of_stock";

export function CatalogueView() {
  const { storeId } = useStorePanel();
  const toast = useToast();
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
      toast(`"${p.name}" deleted`);
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Catalogue
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
            Products
            {products ? (
              <span className="ml-2 text-[16px] font-medium text-muted">
                {products.length}
              </span>
            ) : null}
          </h1>
        </div>
        <Link
          href="/catalogue/new"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft"
        >
          + Add product
        </Link>
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className={`${inputClass} min-w-[220px] flex-1`}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={`${inputClass} w-auto`}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </div>

      {error ? (
        <Banner variant="error" className="mt-4">{error}</Banner>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
        {!products ? (
          <RowsSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          products.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-[15px] font-semibold text-ink">Your catalogue is empty</p>
              <p className="mx-auto mt-1 max-w-[360px] text-[13px] leading-6 text-soft">
                Add your first product with photos, sizes and stock — it appears to
                customers as soon as it&apos;s active.
              </p>
              <Link
                href="/catalogue/new"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft"
              >
                Add your first product
              </Link>
            </div>
          ) : (
            <p className="p-8 text-center text-[14px] text-soft">No products match your search.</p>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
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
                  <tr key={p.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="text-[11px] text-muted">
                        {p.categoryName ?? "Uncategorised"} · {p.variantCount} variant
                        {p.variantCount === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={p.isActive ? "green" : "neutral"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right text-ink">
                      {p.discountedPrice != null && p.discountedPrice < p.basePrice ? (
                        <span>
                          <span className="font-semibold">
                            {formatCurrency(p.discountedPrice)}
                          </span>{" "}
                          <span className="text-[11px] text-faint line-through">
                            {formatCurrency(p.basePrice)}
                          </span>
                        </span>
                      ) : (
                        <span className="font-semibold">{formatCurrency(p.basePrice)}</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        p.totalStock === 0 ? "text-danger" : "text-ink"
                      }`}
                    >
                      {p.totalStock === 0 ? "Out" : p.totalStock}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggle(p)}
                          disabled={busyId === p.id}
                          className="rounded-lg border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-body transition hover:border-ink hover:text-ink disabled:opacity-50"
                        >
                          {p.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <Link
                          href={`/catalogue/${p.id}/edit`}
                          className="rounded-lg border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-body transition hover:border-ink hover:text-ink"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p)}
                          disabled={busyId === p.id}
                          className="rounded-lg border border-danger-line px-3 py-1.5 text-[12px] font-semibold text-danger transition hover:bg-danger-bg disabled:opacity-50"
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
        <ConfirmDialog
          title="Delete product?"
          body={
            <>
              <strong>{confirmDelete.name}</strong> will be removed from your store.
              This can be restored from the database if needed.
            </>
          }
          confirmLabel="Delete"
          busy={busyId === confirmDelete.id}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}
