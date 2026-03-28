import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ComingSoon from "@/components/sections/ComingSoon";

// Preview route — shows how the coming soon state looks
// Safe to remove before production launch

export default function ComingSoonPreviewPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark">
        {/* Toggle between variants to preview */}
        <ComingSoon
          subtitle="Properties"
          title="Our Houses Are Being Readied"
          description="Each room is being dressed with intention. We'll be opening our doors very soon — follow along on Instagram for a first look."
          backHref="/"
          backLabel="Back to Home"
        />
      </main>
      <Footer />
    </>
  );
}
