import { RoutePlaceholder } from "@/components/RoutePlaceholder";
import { SearchPanel } from "@/components/SearchPanel";

export default function SearchPage() {
  return (
    <RoutePlaceholder
      eyebrow="Search Fitzo"
      title="Find the next look to try at home."
      description="Search brands, outfits, and categories, then jump straight into a product or brand page."
      primaryLabel="See all products"
      primaryHref="/products"
      secondaryLabel="Back to home"
      secondaryHref="/"
    >
      <SearchPanel />
    </RoutePlaceholder>
  );
}
