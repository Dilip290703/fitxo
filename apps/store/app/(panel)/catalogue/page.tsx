import type { Metadata } from "next";
import { CatalogueView } from "@/components/catalogue/CatalogueView";

export const metadata: Metadata = { title: "Catalogue · FitXo Store" };

export default function CataloguePage() {
  return <CatalogueView />;
}
