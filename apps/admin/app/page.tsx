import { redirect } from "next/navigation";

// The admin panel lives under /admin; send the app root there.
export default function Home() {
  redirect("/admin");
}
