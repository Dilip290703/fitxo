import { RoutePlaceholder } from "@/components/RoutePlaceholder";
import { testimonials } from "@/lib/mockData";

export default function ReviewsPage() {
  return (
    <RoutePlaceholder
      eyebrow="Customer reviews"
      title="What early FitZo shoppers are saying."
      description="Real reactions from people using slot-based delivery, doorstep try-on, and pay-later checkout."
      primaryLabel="Browse products"
      primaryHref="/products"
      secondaryLabel="Back to home"
      secondaryHref="/"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {testimonials.map((item) => (
          <article
            key={item.id}
            className="rounded-[24px] border border-[#eadfd4] bg-white p-7 shadow-[0_18px_40px_rgba(28,23,18,0.05)]"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
              {item.role}
            </p>
            <h2 className="mt-3 font-display text-[34px] leading-none text-[#171717]">
              {item.name}
            </h2>
            <p className="mt-4 text-[15px] leading-8 text-[#6f6050]">{item.quote}</p>
          </article>
        ))}
      </div>
    </RoutePlaceholder>
  );
}
