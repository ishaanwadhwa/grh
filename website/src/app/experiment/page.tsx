import AngelView from "./view";

export const dynamic = "force-dynamic"; // "today" has to be today

export default async function ExperimentPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string; title?: string; ink?: string; bg?: string; embed?: string; book?: string }>;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD in Jaipur
  return <AngelView today={today} initial={await searchParams} />;
}
