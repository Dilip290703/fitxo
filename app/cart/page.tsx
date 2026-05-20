import { redirect } from "next/navigation";

export default function CartRedirectPage() {
  redirect("/bag");
}
