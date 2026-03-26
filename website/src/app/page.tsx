import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroMinimal from "@/components/sections/HeroMinimal";
import HeroImage from "@/components/sections/HeroImage";
import BrandStory from "@/components/sections/BrandStory";
import FeaturedProperty from "@/components/sections/FeaturedProperty";
import FeaturedRestaurants from "@/components/sections/FeaturedRestaurants";
import NewsletterSignup from "@/components/sections/NewsletterSignup";

// Toggle between "minimal" and "image" to switch homepage variants
const HOMEPAGE_VARIANT: "minimal" | "image" = "minimal";

export default function Home() {
  return (
    <>
      <Navbar />
      {HOMEPAGE_VARIANT === "minimal" ? <HeroMinimal /> : <HeroImage />}
      <BrandStory />
      <FeaturedProperty />
      <FeaturedRestaurants />
      <NewsletterSignup />
      <Footer />
    </>
  );
}
