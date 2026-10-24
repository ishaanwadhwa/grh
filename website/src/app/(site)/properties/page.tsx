import { getProperties } from "@/lib/supabase/queries";
import PropertiesView from "./view";

export default async function PropertiesPage() {
  return <PropertiesView properties={await getProperties()} />;
}
