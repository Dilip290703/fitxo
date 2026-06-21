import { createClient } from "@fitzo/supabase/client";

/**
 * A rider is a Supabase user with role 'rider' AND a `riders` row. They can only
 * WORK once an admin sets is_verified=true. The agent panel gates every screen on
 * this — a session alone isn't enough.
 */
export type AgentStatus = "no-session" | "not-rider" | "unverified" | "ok";

export type AgentContext = {
  userId: string;
  email: string;
  name: string;
  riderId: string;
  isVerified: boolean;
  isAvailable: boolean;
  vehicleType: string;
  vehicleNumber: string | null;
  rating: number | null;
  totalDeliveries: number;
};

export async function getAgentContext(): Promise<{
  status: AgentStatus;
  context: AgentContext | null;
}> {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { status: "no-session", context: null };

  const { data: rider } = await supabase
    .from("riders")
    .select(
      "id, is_verified, is_available, vehicle_type, vehicle_number, rating, total_deliveries, user:users(name)",
    )
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!rider) return { status: "not-rider", context: null };

  const user = Array.isArray(rider.user) ? rider.user[0] : rider.user;

  const context: AgentContext = {
    userId: session.user.id,
    email: session.user.email ?? "",
    name: user?.name ?? "Rider",
    riderId: rider.id,
    isVerified: rider.is_verified,
    isAvailable: rider.is_available,
    vehicleType: rider.vehicle_type,
    vehicleNumber: rider.vehicle_number,
    rating: rider.rating,
    totalDeliveries: rider.total_deliveries,
  };

  return { status: rider.is_verified ? "ok" : "unverified", context };
}
