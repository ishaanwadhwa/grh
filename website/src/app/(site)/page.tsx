import HeroMinimal from "@/components/sections/HeroMinimal";
import HeroImage from "@/components/sections/HeroImage";
import BrandStory from "@/components/sections/BrandStory";
import FeaturedProperty from "@/components/sections/FeaturedProperty";
import FeaturedRestaurants from "@/components/sections/FeaturedRestaurants";
import NewsletterSignup from "@/components/sections/NewsletterSignup";
import { getFeaturedProperty, getRestaurants } from "@/lib/supabase/queries";

// Toggle between "minimal" and "image" to switch homepage variants
const HOMEPAGE_VARIANT: "minimal" | "image" = "minimal";

export default async function Home() {
  const [property, restaurants] = await Promise.all([
    getFeaturedProperty(),
    getRestaurants({ featured: true }),
  ]);

  return (
    <>
      {HOMEPAGE_VARIANT === "minimal" ? <HeroMinimal /> : <HeroImage />}
      <BrandStory />
      <FeaturedProperty property={property} />
      <FeaturedRestaurants restaurants={restaurants} />
      <NewsletterSignup />
    </>
  );
}
