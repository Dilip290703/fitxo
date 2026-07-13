import { NextResponse } from "next/server";

/**
 * Reverse-geocodes a browser coordinate to an Indian PIN code.
 *
 * Runs server-side on purpose: OpenStreetMap's Nominatim requires an
 * identifying User-Agent and rejects anonymous browser traffic, and calling it
 * from the client would also mean a cross-origin request on every detect tap.
 *
 * Keyless by design — Fitzo has no Maps key (see the agent-panel audit, which
 * reached the same conclusion for rider navigation).
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const CONTACT = "Fitzo (https://fitzo.in)";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return NextResponse.json(
      { error: "Invalid coordinates." },
      { status: 400 },
    );
  }

  const url = `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": CONTACT, "Accept-Language": "en" },
      // Coordinates repeat a lot in a single city; let the platform cache.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the location service." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Could not reach the location service." },
      { status: 502 },
    );
  }

  const data = (await response.json()) as {
    address?: { postcode?: string };
  };

  // Nominatim sometimes returns postcodes as "411 021" or a range.
  const raw = data.address?.postcode?.replace(/\D/g, "") ?? "";
  const pincode = raw.slice(0, 6);

  if (pincode.length !== 6) {
    return NextResponse.json(
      { error: "No pincode found for your location. Enter it manually." },
      { status: 404 },
    );
  }

  return NextResponse.json({ pincode });
}
