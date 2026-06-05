import { SearchResultsView } from "@/components/search/SearchResultsView";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />
      <SearchResultsView initialQuery={q} />
      <Footer />
    </main>
  );
}
