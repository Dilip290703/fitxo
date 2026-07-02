import type { Metadata } from "next";
import { ProductForm } from "@/components/catalogue/ProductForm";

export const metadata: Metadata = { title: "Edit product · FitZo Store" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductForm mode="edit" productId={id} />;
}
