import { WishlistCard } from "@/components/wishlist/WishlistCard";
import { type WishlistItem } from "@/store/wishlistStore";

export function WishlistGrid({ items }: { items: WishlistItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <WishlistCard key={item.id} item={item} />
      ))}
    </div>
  );
}
