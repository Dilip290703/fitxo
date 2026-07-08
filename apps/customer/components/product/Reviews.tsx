import Image from "next/image";
import { ProductReview } from "@/components/product/types";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-[#f3b242]">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} aria-hidden="true">
          {index < rating ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

export function Reviews({ reviews }: { reviews: ProductReview[] }) {
  // Honest empty state — 0/0 would render "NaN" as the average.
  if (reviews.length === 0) {
    return (
      <div className="rounded-[18px] bg-[#fbf7f1] p-5 text-center">
        <p className="text-[15px] font-medium text-[#171717]">
          No reviews yet
        </p>
        <p className="mt-2 text-[13px] leading-6 text-[#7b736b]">
          Be the first — order a doorstep try-on and tell us how the fit felt.
        </p>
      </div>
    );
  }

  const averageRating =
    reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] bg-[#fbf7f1] p-4">
        <p className="text-[28px] font-medium text-[#171717]">
          {averageRating.toFixed(1)}
        </p>
        <p className="mt-1 text-[12px] uppercase tracking-[0.08em] text-[#7b736b]">
          Based on {reviews.length} FitZo reviews
        </p>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="rounded-[18px] border border-[#eee4d9] bg-white p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-[#171717]">
                  {review.name}
                </p>
                <p className="mt-1 text-[12px] text-[#80786f]">{review.role}</p>
              </div>
              <StarRow rating={review.rating} />
            </div>
            <p className="mt-4 text-[13px] leading-6 text-[#57514b]">
              {review.quote}
            </p>
            {review.photo ? (
              <div className="relative mt-4 h-[96px] w-[76px] overflow-hidden rounded-[12px]">
                <Image
                  src={review.photo}
                  alt={review.name}
                  fill
                  className="object-cover"
                  sizes="76px"
                />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
