"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DeliveryFlowModal } from "@/components/DeliveryFlowModal";

export function Hero() {
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  return (
    <>
      <section className="overflow-hidden">
        <div className="grid min-h-[85vh] grid-cols-1 md:grid-cols-[60%_40%]">
          <div className="relative isolate flex items-center overflow-hidden bg-[#1e293b] bg-[repeating-linear-gradient(135deg,#1e293b,#1e293b_10px,#223046_10px,#223046_20px)] px-6 py-16 sm:px-10 md:px-12 md:py-20">
            <div className="w-full md:ml-16">
              <div className="max-w-[420px] space-y-4 bg-white/80 p-10 text-left shadow-lg backdrop-blur-sm">
                <h1 className="font-serif text-5xl leading-tight text-gray-100">
                  <span className="block">Try before</span>
                  <span className="block">you buy.</span>
                </h1>
                <p className="text-lg font-light text-orange-300">
                  60-min delivery
                </p>
                <p className="max-w-[280px] text-sm leading-8 text-gray-300">
                  Discover nearby fashion collections, try your picks at home,
                  and pay only for what you keep.
                </p>

                <div className="space-y-4 pt-2">
                  <Link
                    href="/products"
                    className="inline-flex items-center border border-white px-6 py-3 text-xs uppercase tracking-widest text-white transition hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white/60"
                  >
                    Pick your outfits
                    <span className="ml-4 text-sm leading-none">→</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsFlowOpen(true)}
                    className="block text-xs uppercase tracking-widest text-gray-100 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                  >
                    Watch delivery flow
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative isolate overflow-hidden bg-[color:var(--warm)]">
            <div className="absolute inset-0">
              <Image
                src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80"
                alt="FitZo fashion model"
                fill
                className="scale-[1.06] object-cover object-center"
                sizes="(max-width: 768px) 100vw, 40vw"
                priority
              />
            </div>
          </div>
        </div>
      </section>
      <DeliveryFlowModal
        isOpen={isFlowOpen}
        onClose={() => setIsFlowOpen(false)}
      />
    </>
  );
}
