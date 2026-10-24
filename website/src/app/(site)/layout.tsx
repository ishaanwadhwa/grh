import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getProperties } from "@/lib/supabase/queries";

// Shared shell for every public page: nav on top, footer at the bottom.
// ponytail: always fresh from Supabase; switch to `revalidate = 60` to cache pages for a minute.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [property] = await getProperties().catch(() => []); // footer just hides the address if Supabase is down

  return (
    <>
      <Navbar />
      {children}
      <Footer property={property} />
    </>
  );
}
