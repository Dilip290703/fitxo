import type { Metadata } from "next";
import { ProductForm } from "@/components/catalogue/ProductForm";

export const metadata: Metadata = { title: "Add product · FitXo Store" };

export default function NewProductPage() {
  return <ProductForm mode="create" />;
}
