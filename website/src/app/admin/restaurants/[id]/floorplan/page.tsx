"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { AdminInput, AdminSelect } from "@/components/admin/FormField";

const BUCKET = "restaurant-floorplans";
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 1400;

type LayoutItem =
  | { id: string; kind: "wall"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: "zone"; x: number; y: number; width: number; height: number; label: string }
  | { id: string; kind: "label"; x: number; y: number; text: string };

type DrawTool = "navigate" | "wall" | "zone" | "label" | "table";

interface Floorplan {
  id: string;
  image_path: string | null;
  canvas_width: number;
  canvas_height: number;
  layout_data: LayoutItem[] | null;
}

interface RestaurantTable {
  id: string;
  restaurant_id: string;
  floorplan_id: string;
  label: string;
  min_capacity: number;
  max_capacity: number;
  shape: "round" | "square" | "rectangle";
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  rotation: number;
  zone: string;
  is_active: boolean;
}

interface TableInteraction {
  tableId: string;
  pointerId: number;
  kind: "move" | "resize";
}

interface Gesture {
  tool: DrawTool;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  startViewBox: { x: number; y: number; width: number; height: number };
}

function pickGeometry(table: RestaurantTable) {
  const { x_percent, y_percent, width_percent, height_percent } = table;
  return { x_percent, y_percent, width_percent, height_percent };
}

export default function RestaurantFloorplanPage() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);
  const svgRef = useRef<SVGSVGElement>(null);
  const tableInteractionRef = useRef<TableInteraction | null>(null);
  // Last known database state of each table, used to revert discarded edits.
  const savedTablesRef = useRef<Record<string, RestaurantTable>>({});
  const [gesture, setGesture] = useState<Gesture | null>(null);

  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableDirty, setTableDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [tool, setTool] = useState<DrawTool>("navigate");
  const [labelText, setLabelText] = useState("Entry");
  const [selectedLayoutItemId, setSelectedLayoutItemId] = useState("");
  const [layoutLabelDraft, setLayoutLabelDraft] = useState("");
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_HEIGHT);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const selected = tables.find((table) => table.id === selectedId) || null;
  const layoutItems = floorplan?.layout_data || [];
  const selectedLayoutItem = layoutItems.find((item) => item.id === selectedLayoutItemId) || null;

  const load = useCallback(async () => {
    const [{ data: restaurant, error: restaurantError }, { data: plan, error: planError }] = await Promise.all([
      supabase.from("restaurants").select("name").eq("id", restaurantId).single(),
      supabase.from("restaurant_floorplans")
        .select("id, image_path, canvas_width, canvas_height, layout_data")
        .eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle(),
    ]);
    if (restaurantError || planError) {
      setNotice(`Could not load saved floor-plan data: ${(planError || restaurantError)?.message}`);
      setLoading(false);
      return;
    }
    setRestaurantName(restaurant?.name || "Restaurant");

    if (plan) {
      setCanvasWidth(plan.canvas_width);
      setCanvasHeight(plan.canvas_height);
      const [{ data: signed, error: imageError }, { data: rows, error: tablesError }] = await Promise.all([
        plan.image_path
          ? supabase.storage.from(BUCKET).createSignedUrl(plan.image_path, 3600)
          : Promise.resolve({ data: null, error: null }),
        supabase.from("restaurant_tables").select("*").eq("floorplan_id", plan.id).order("label"),
      ]);
      if (tablesError) {
        setNotice(`Could not load saved tables: ${tablesError.message}`);
        setLoading(false);
        return;
      }
      setFloorplan(plan as Floorplan);
      if (imageError) setNotice(`Could not load the reference image: ${imageError.message}`);
      setReferenceUrl(signed?.signedUrl || "");
      savedTablesRef.current = Object.fromEntries((rows || []).map((row) => [row.id, row]));
      setTableDirty(false);
      setTables(rows || []);
      setSelectedId((current) => (rows || []).some((row) => row.id === current) ? current : rows?.[0]?.id || "");
      setViewBox({ x: 0, y: 0, width: plan.canvas_width, height: plan.canvas_height });
    } else {
      setFloorplan(null);
      setCanvasWidth(DEFAULT_WIDTH);
      setCanvasHeight(DEFAULT_HEIGHT);
      setReferenceUrl("");
      setTables([]);
      setSelectedId("");
      setViewBox({ x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    }
    setLoading(false);
  }, [restaurantId, supabase]);

  // Load the selected restaurant's native layout and table records.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const createFloorplan = async () => {
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase.from("restaurant_floorplans").insert({
      restaurant_id: restaurantId,
      name: "Main floor",
      image_path: null,
      canvas_width: DEFAULT_WIDTH,
      canvas_height: DEFAULT_HEIGHT,
      layout_data: [],
      is_active: true,
    }).select("id, image_path, canvas_width, canvas_height, layout_data").single();
    if (error || !data) {
      setNotice(error?.message || "Could not create the floor plan. Apply the latest database migration and try again.");
      setSaving(false);
      return;
    }
    setFloorplan(data as Floorplan);
    setViewBox({ x: 0, y: 0, width: data.canvas_width, height: data.canvas_height });
    setNotice("Blank floor plan created. Draw the room outline, then add and place table markers.");
    setSaving(false);
  };

  const selectLayoutItem = (item: LayoutItem) => {
    setSelectedLayoutItemId(item.id);
    setLayoutLabelDraft(item.kind === "zone" ? item.label : item.kind === "label" ? item.text : "");
  };

  const saveLayout = async (nextItems: LayoutItem[]) => {
    if (!floorplan) return;
    setSaving(true);
    const { error } = await supabase.from("restaurant_floorplans")
      .update({ layout_data: nextItems })
      .eq("id", floorplan.id);
    if (error) {
      setNotice(error.message);
    } else {
      setFloorplan((current) => current ? { ...current, layout_data: nextItems } : current);
      setNotice("Floor plan saved.");
    }
    setSaving(false);
  };

  const saveLayoutItemLabel = () => {
    if (!selectedLayoutItem || !layoutLabelDraft.trim()) return;
    const updated = layoutItems.map((item) => {
      if (item.id !== selectedLayoutItem.id) return item;
      return item.kind === "zone"
        ? { ...item, label: layoutLabelDraft.trim() }
        : item.kind === "label"
          ? { ...item, text: layoutLabelDraft.trim() }
          : item;
    });
    void saveLayout(updated);
  };

  const deleteLayoutItem = () => {
    if (!selectedLayoutItem) return;
    void saveLayout(layoutItems.filter((item) => item.id !== selectedLayoutItem.id));
    setSelectedLayoutItemId("");
    setLayoutLabelDraft("");
  };

  const saveReferenceImage = async (file: File) => {
    if (!floorplan || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setNotice("Choose a PNG, JPG, or WebP image smaller than 10 MB.");
      return;
    }
    setUploading(true);
    const path = `${restaurantId}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (uploadError) {
      setNotice(uploadError.message);
      setUploading(false);
      return;
    }
    const { error } = await supabase.from("restaurant_floorplans").update({ image_path: path }).eq("id", floorplan.id);
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      setNotice(error.message);
    } else {
      if (floorplan.image_path) await supabase.storage.from(BUCKET).remove([floorplan.image_path]);
      setFloorplan({ ...floorplan, image_path: path });
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      setReferenceUrl(signed?.signedUrl || "");
      setNotice("Optional tracing reference added. The drawn layout remains editable vector data.");
    }
    setUploading(false);
  };

  const addTable = async () => {
    if (!floorplan) return;
    const labels = new Set(tables.map((table) => table.label));
    let number = 1;
    while (labels.has(`T${number}`)) number++;
    const { data, error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: restaurantId,
      floorplan_id: floorplan.id,
      label: `T${number}`,
      min_capacity: 1,
      max_capacity: 2,
      shape: "round",
      x_percent: 50,
      y_percent: 50,
      width_percent: 12,
      height_percent: 8,
      rotation: 0,
      zone: "",
      is_active: true,
    }).select().single();
    if (error || !data) {
      setNotice(error?.message || "Could not add the table.");
      return;
    }
    savedTablesRef.current[data.id] = data;
    setTables((current) => [...current, data]);
    setSelectedId(data.id);
    setTool("table");
    setNotice(`Table ${data.label} added and bookable. Tap its position on the plan.`);
  };

  const updateSelected = (key: keyof RestaurantTable, value: string | number | boolean) => {
    if (!selected) return;
    setTables((current) => current.map((table) => table.id === selected.id ? { ...table, [key]: value } : table));
    setTableDirty(true);
  };

  const revertSelected = () => {
    const saved = selectedId ? savedTablesRef.current[selectedId] : undefined;
    if (saved) setTables((current) => current.map((table) => table.id === saved.id ? saved : table));
    setTableDirty(false);
  };

  const selectTable = (tableId: string) => {
    if (tableDirty && tableId !== selectedId) {
      if (!window.confirm("Discard unsaved table changes?")) return false;
      revertSelected();
    }
    setSelectedId(tableId);
    return true;
  };

  // Warn before leaving the page with unsaved table edits.
  useEffect(() => {
    if (!tableDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [tableDirty]);

  const svgPoint = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + ((event.clientX - rect.left) / rect.width) * viewBox.width,
      y: viewBox.y + ((event.clientY - rect.top) / rect.height) * viewBox.height,
    };
  };

  const tablePatchAtPoint = (table: RestaurantTable, point: { x: number; y: number }, kind: TableInteraction["kind"]) => {
    if (!floorplan) return {};
    if (kind === "move") {
      return {
        x_percent: Number(Math.max(0, Math.min(100, point.x / floorplan.canvas_width * 100)).toFixed(2)),
        y_percent: Number(Math.max(0, Math.min(100, point.y / floorplan.canvas_height * 100)).toFixed(2)),
      };
    }
    const centerX = table.x_percent * floorplan.canvas_width / 100;
    const centerY = table.y_percent * floorplan.canvas_height / 100;
    return {
      width_percent: Number(Math.max(3, Math.min(100, Math.abs(point.x - centerX) * 2 / floorplan.canvas_width * 100)).toFixed(2)),
      height_percent: Number(Math.max(3, Math.min(100, Math.abs(point.y - centerY) * 2 / floorplan.canvas_height * 100)).toFixed(2)),
    };
  };

  const beginTableInteraction = (event: React.PointerEvent<SVGGElement | SVGRectElement>, table: RestaurantTable, kind: TableInteraction["kind"]) => {
    event.stopPropagation();
    if (!selectTable(table.id)) return;
    if (tool !== "navigate") {
      setTool("navigate");
      return;
    }
    tableInteractionRef.current = { tableId: table.id, pointerId: event.pointerId, kind };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const beginGesture = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as HTMLElement).closest("[data-table-marker]")) return;
    const point = svgPoint(event);
    setGesture({
      tool,
      startX: point.x,
      startY: point.y,
      clientX: event.clientX,
      clientY: event.clientY,
      startViewBox: viewBox,
    });
    if (tool === "navigate") setIsPanning(true);
    else setDrawPreview(point);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveGesture = (event: React.PointerEvent<SVGSVGElement>) => {
    const tableInteraction = tableInteractionRef.current;
    if (tableInteraction?.pointerId === event.pointerId) {
      const table = tables.find((item) => item.id === tableInteraction.tableId);
      if (table) {
        const patch = tablePatchAtPoint(table, svgPoint(event), tableInteraction.kind);
        setTables((current) => current.map((item) => item.id === table.id ? { ...item, ...patch } : item));
      }
      return;
    }
    if (!gesture) return;
    if (gesture.tool === "navigate") {
      const rect = event.currentTarget.getBoundingClientRect();
      const dx = (event.clientX - gesture.clientX) * gesture.startViewBox.width / rect.width;
      const dy = (event.clientY - gesture.clientY) * gesture.startViewBox.height / rect.height;
      const { width, height } = gesture.startViewBox;
      setViewBox({
        x: Math.max(0, Math.min(floorplan!.canvas_width - width, gesture.startViewBox.x - dx)),
        y: Math.max(0, Math.min(floorplan!.canvas_height - height, gesture.startViewBox.y - dy)),
        width,
        height,
      });
    } else {
      setDrawPreview(svgPoint(event));
    }
  };

  const endGesture = (event: React.PointerEvent<SVGSVGElement>) => {
    const tableInteraction = tableInteractionRef.current;
    if (tableInteraction?.pointerId === event.pointerId) {
      const table = tables.find((item) => item.id === tableInteraction.tableId);
      tableInteractionRef.current = null;
      if (table) {
        const patch = tablePatchAtPoint(table, svgPoint(event), tableInteraction.kind);
        setTables((current) => current.map((item) => item.id === table.id ? { ...item, ...patch } : item));
        setSaving(true);
        void supabase.from("restaurant_tables").update(patch).eq("id", table.id).select().maybeSingle().then(({ data, error }) => {
          setSaving(false);
          const saved = savedTablesRef.current[table.id];
          if (error || !data) {
            setNotice(error?.message || `${table.label} was not saved. Your session may have expired \u2014 sign in again.`);
            // Roll back only the geometry; keep any unsaved seat/label edits.
            if (saved) setTables((current) => current.map((item) => item.id === table.id ? { ...item, ...pickGeometry(saved) } : item));
            return;
          }
          savedTablesRef.current[table.id] = saved ? { ...saved, ...pickGeometry(data) } : data;
          setNotice(`${table.label} ${tableInteraction.kind === "move" ? "position" : "size"} saved.`);
        });
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (!gesture) return;
    setGesture(null);
    setIsPanning(false);
    setDrawPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    if (gesture.tool === "navigate") return;
    const end = svgPoint(event);
    if (gesture.tool === "table") {
      if (selected) {
        const xPercent = Math.max(0, Math.min(100, (end.x / floorplan!.canvas_width) * 100));
        const yPercent = Math.max(0, Math.min(100, (end.y / floorplan!.canvas_height) * 100));
        setTables((current) => current.map((table) => table.id === selected.id
          ? { ...table, x_percent: Number(xPercent.toFixed(2)), y_percent: Number(yPercent.toFixed(2)) }
          : table));
        setTableDirty(true);
        setNotice(`${selected.label} placed. Save table details to keep the position.`);
      }
      setTool("navigate");
      return;
    }
    if (gesture.tool === "label") {
      if (!labelText.trim()) {
        setNotice("Enter a label before placing it.");
        return;
      }
      void saveLayout([...layoutItems, { id: crypto.randomUUID(), kind: "label", x: end.x, y: end.y, text: labelText.trim() }]);
      return;
    }
    if (Math.hypot(end.x - gesture.startX, end.y - gesture.startY) < 12) return;
    if (gesture.tool === "wall") {
      void saveLayout([...layoutItems, { id: crypto.randomUUID(), kind: "wall", x1: gesture.startX, y1: gesture.startY, x2: end.x, y2: end.y }]);
    } else if (gesture.tool === "zone") {
      const x = Math.min(gesture.startX, end.x);
      const y = Math.min(gesture.startY, end.y);
      void saveLayout([...layoutItems, {
        id: crypto.randomUUID(), kind: "zone", x, y,
        width: Math.abs(end.x - gesture.startX), height: Math.abs(end.y - gesture.startY), label: labelText.trim() || "Zone",
      }]);
    }
  };

  const zoomMap = (factor: number) => {
    if (!floorplan) return;
    setViewBox((current) => {
      const width = Math.max(250, Math.min(floorplan.canvas_width, current.width * factor));
      const height = Math.max(350, Math.min(floorplan.canvas_height, current.height * factor));
      const centerX = current.x + current.width / 2;
      const centerY = current.y + current.height / 2;
      return {
        x: Math.max(0, Math.min(floorplan.canvas_width - width, centerX - width / 2)),
        y: Math.max(0, Math.min(floorplan.canvas_height - height, centerY - height / 2)),
        width,
        height,
      };
    });
  };

  const fitMap = () => {
    if (!floorplan) return;
    setViewBox({ x: 0, y: 0, width: floorplan.canvas_width, height: floorplan.canvas_height });
  };

  const expandCanvas = async () => {
    if (!floorplan) return;
    setSaving(true);
    setNotice("");
    const { error } = await supabase.rpc("expand_restaurant_floorplan", {
      p_floorplan_id: floorplan.id,
      p_canvas_width: Number(canvasWidth),
      p_canvas_height: Number(canvasHeight),
    });
    if (error) {
      setNotice(error.message);
      setSaving(false);
      return;
    }
    setNotice("Workspace expanded. Existing walls and tables stayed in place.");
    await load();
    setSaving(false);
  };

  const saveTable = async (activeOverride?: boolean) => {
    if (!selected) return;
    const minSeats = Number(selected.min_capacity);
    const maxSeats = Number(selected.max_capacity);
    if (!Number.isInteger(minSeats) || !Number.isInteger(maxSeats) || minSeats < 1 || maxSeats > 50 || minSeats > maxSeats) {
      setNotice("Seats must be whole numbers between 1 and 50, with min seats no more than max seats.");
      return;
    }
    if (!selected.label.trim()) {
      setNotice("Table label cannot be empty.");
      return;
    }
    setSaving(true);
    const isActive = activeOverride ?? selected.is_active;
    const { data, error } = await supabase.from("restaurant_tables").update({
      label: selected.label.trim(), min_capacity: Number(selected.min_capacity),
      max_capacity: Number(selected.max_capacity), shape: selected.shape,
      x_percent: Number(selected.x_percent), y_percent: Number(selected.y_percent),
      width_percent: Number(selected.width_percent), height_percent: Number(selected.height_percent),
      rotation: Number(selected.rotation), zone: selected.zone.trim(), is_active: isActive,
    }).eq("id", selected.id).select().maybeSingle();
    if (error) {
      setNotice(`Could not save ${selected.label}: ${error.message}`);
    } else if (!data) {
      setNotice(`${selected.label} was not saved. Your session may have expired \u2014 sign in again, then retry.`);
    } else {
      // Show exactly what the database stored.
      savedTablesRef.current[data.id] = data;
      setTables((current) => current.map((table) => table.id === data.id ? data : table));
      setTableDirty(false);
      setNotice(`${data.label} saved: ${data.min_capacity}\u2013${data.max_capacity} seats${data.is_active ? ", bookable" : ", draft"}.`);
    }
    setSaving(false);
  };

  const enableAllTables = async () => {
    if (!floorplan) return;
    if (tableDirty) {
      setNotice("Save the selected table details before enabling all tables.");
      return;
    }
    const draftCount = tables.filter((table) => !table.is_active).length;
    if (!draftCount) {
      setNotice("All tables are already enabled for bookings.");
      return;
    }
    if (!window.confirm(`Enable all ${draftCount} draft tables for booking availability using their saved capacities?`)) return;

    setSaving(true);
    const { error } = await supabase.from("restaurant_tables")
      .update({ is_active: true })
      .eq("floorplan_id", floorplan.id)
      .eq("is_active", false);
    if (error) {
      setNotice(`Could not enable tables: ${error.message}`);
    } else {
      setTables((current) => current.map((table) => ({ ...table, is_active: true })));
      setNotice(`${draftCount} tables enabled for bookings.`);
    }
    setSaving(false);
  };

  const hideTable = async () => {
    if (!selected || !window.confirm(`Hide table ${selected.label}? Existing reservations keep their assignment.`)) return;
    const { data, error } = await supabase.from("restaurant_tables").update({ is_active: false }).eq("id", selected.id).select().maybeSingle();
    if (error || !data) setNotice(error?.message || "Table was not hidden. Your session may have expired \u2014 sign in again.");
    else {
      if (savedTablesRef.current[data.id]) savedTablesRef.current[data.id].is_active = false;
      setTables((current) => current.map((table) => table.id === selected.id ? { ...table, is_active: false } : table));
      setNotice("Table moved to draft and removed from availability.");
    }
  };

  if (loading) return <div className="p-6 text-sm text-text/40">Loading floor plan…</div>;

  return (
    <div className="min-h-screen bg-background px-4 pb-28 pt-4 text-text md:px-8 md:pb-12 md:pt-8">
      <div className="mx-auto max-w-6xl">
        <Link href={`/admin/restaurants/${restaurantId}`} className="inline-flex min-h-10 items-center text-xs text-text/45 transition hover:text-accent">← {restaurantName}</Link>
        <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-accent-gold">Restaurant setup</p>
            <h1 className="mt-1 font-display text-2xl text-primary md:text-3xl">Floor plan & tables</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text/55">Draw the room directly in the app. Add walls, zones, labels, and table markers; drag to pan and zoom on mobile.</p>
          </div>
          {floorplan && <button type="button" onClick={() => void addTable()} className="min-h-11 rounded bg-accent px-5 text-xs font-medium uppercase tracking-widest text-white shadow-soft transition hover:bg-accent-hover">+ Add table</button>}
        </header>

        {!floorplan ? (
          <section className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-accent-gold/50 bg-white p-6 text-center shadow-soft">
            <span className="text-3xl text-accent-gold">⌖</span>
            <h2 className="mt-3 font-display text-2xl text-primary">Start a native floor plan</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text/50">Create an editable vector layout for staff. No image is required; an optional reference image can be added for tracing.</p>
            <button type="button" onClick={() => void createFloorplan()} disabled={saving} className="mt-5 min-h-11 rounded bg-primary px-5 text-xs font-medium uppercase tracking-widest text-white disabled:opacity-50">{saving ? "Creating…" : "Create blank floor plan"}</button>
          </section>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 rounded-lg border border-border-subtle bg-white p-3 shadow-soft md:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 rounded border border-border-subtle bg-background p-1">
                  {(["navigate", "wall", "zone", "label", "table"] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => setTool(mode)} aria-pressed={tool === mode} className={`min-h-9 rounded px-3 text-[10px] uppercase tracking-wide ${tool === mode ? "bg-primary text-text-inverse" : "text-text/55 hover:bg-white"}`}>
                      {mode === "navigate" ? "Pan / Select" : mode === "wall" ? "Draw wall" : mode === "zone" ? "Draw zone" : mode === "label" ? "Add label" : "Place table"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded border border-border-subtle bg-white p-1">
                  <button type="button" onClick={() => zoomMap(0.8)} aria-label="Zoom in" className="h-9 w-9 rounded text-lg text-primary hover:bg-background">+</button>
                  <button type="button" onClick={() => zoomMap(1.25)} aria-label="Zoom out" className="h-9 w-9 rounded text-lg text-primary hover:bg-background">−</button>
                  <button type="button" onClick={fitMap} className="h-9 rounded px-2 text-[10px] uppercase tracking-wide text-text/50 hover:bg-background">Fit</button>
                  <button type="button" onClick={() => void saveLayout(layoutItems.slice(0, -1))} disabled={!layoutItems.length || saving} className="h-9 rounded bg-accent-gold px-3 text-[10px] font-medium uppercase tracking-wide text-primary disabled:opacity-40">Undo</button>
                </div>
              </div>

              <details className="mb-3 rounded border border-border-subtle bg-background px-3 py-2">
                <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-widest text-primary">Need more room? Expand canvas · {floorplan.canvas_width} × {floorplan.canvas_height}</summary>
                <div className="mt-3 flex flex-wrap items-end gap-3 pb-1">
                  <label className="text-[10px] text-text/50">Width units
                    <AdminInput className="mt-1.5 w-28" type="number" min={floorplan.canvas_width} max={6000} step={100} value={canvasWidth} onChange={(event) => setCanvasWidth(Number(event.target.value))} />
                  </label>
                  <label className="text-[10px] text-text/50">Height units
                    <AdminInput className="mt-1.5 w-28" type="number" min={floorplan.canvas_height} max={6000} step={100} value={canvasHeight} onChange={(event) => setCanvasHeight(Number(event.target.value))} />
                  </label>
                  <button type="button" onClick={() => void expandCanvas()} disabled={saving || (canvasWidth <= floorplan.canvas_width && canvasHeight <= floorplan.canvas_height)} className="min-h-10 rounded border border-accent-gold/60 px-3 text-[10px] font-medium uppercase tracking-wide text-primary disabled:opacity-40">{saving ? "Saving…" : "Expand workspace"}</button>
                  <p className="basis-full text-[10px] text-text/40">Existing walls and tables keep their current position; added space extends to the right and bottom.</p>
                </div>
              </details>

              {(tool === "zone" || tool === "label") && (
                <label className="mb-3 flex items-center gap-3 text-xs text-text/55">
                  {tool === "zone" ? "Zone name" : "Label text"}
                  <AdminInput className="max-w-xs" value={labelText} onChange={(event) => setLabelText(event.target.value)} placeholder={tool === "zone" ? "Dining room" : "Entry"} />
                </label>
              )}

              <div className="overflow-hidden rounded-lg border border-primary/20 bg-background">
                <svg
                  ref={svgRef}
                  viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                  preserveAspectRatio="none"
                  className={`block h-[58vh] min-h-[420px] max-h-[760px] w-full touch-none ${isPanning ? "cursor-grabbing" : tool === "navigate" ? "cursor-grab" : "cursor-crosshair"}`}
                  onPointerDown={beginGesture}
                  onPointerMove={moveGesture}
                  onPointerUp={endGesture}
                  onPointerCancel={endGesture}
                >
                  <defs>
                    <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#D4CBB8" strokeWidth="1" opacity="0.45" />
                    </pattern>
                  </defs>
                  <rect width={floorplan.canvas_width} height={floorplan.canvas_height} fill="#F8F5ED" />
                  <rect width={floorplan.canvas_width} height={floorplan.canvas_height} fill="url(#floor-grid)" />
                  {referenceUrl && <image href={referenceUrl} width={floorplan.canvas_width} height={floorplan.canvas_height} opacity="0.22" preserveAspectRatio="none" pointerEvents="none" />}
                  {layoutItems.map((item) => item.kind === "wall" ? (
                    <g
                      key={item.id}
                      onPointerDown={(event) => {
                        if (tool !== "navigate") return;
                        event.stopPropagation();
                        selectLayoutItem(item);
                      }}
                      pointerEvents={tool === "navigate" ? "stroke" : "none"}
                      className={tool === "navigate" ? "cursor-pointer" : ""}
                    >
                      <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={selectedLayoutItemId === item.id ? "#A33E3E" : "#1A2238"} strokeWidth={selectedLayoutItemId === item.id ? 18 : 12} strokeLinecap="round" />
                    </g>
                  ) : item.kind === "zone" ? (
                    <g
                      key={item.id}
                      onPointerDown={(event) => {
                        if (tool !== "navigate") return;
                        event.stopPropagation();
                        selectLayoutItem(item);
                      }}
                      className={tool === "navigate" ? "cursor-pointer" : ""}
                    >
                      <rect x={item.x} y={item.y} width={item.width} height={item.height} rx="18" fill="#D4CBB8" fillOpacity="0.48" stroke={selectedLayoutItemId === item.id ? "#A33E3E" : "#C4A26C"} strokeWidth={selectedLayoutItemId === item.id ? 7 : 4} strokeDasharray="12 8" />
                      <text x={item.x + 18} y={item.y + 35} fill="#1A2238" fontSize="22" fontWeight="600" pointerEvents="none">{item.label}</text>
                    </g>
                  ) : (
                    <text
                      key={item.id}
                      x={item.x}
                      y={item.y}
                      fill={selectedLayoutItemId === item.id ? "#1A2238" : "#A33E3E"}
                      fontSize="24"
                      fontWeight="700"
                      stroke={selectedLayoutItemId === item.id ? "#C4A26C" : "none"}
                      strokeWidth="1"
                      onPointerDown={(event) => {
                        if (tool !== "navigate") return;
                        event.stopPropagation();
                        selectLayoutItem(item);
                      }}
                      className={tool === "navigate" ? "cursor-pointer" : ""}
                    >{item.text}</text>
                  ))}
                  {drawPreview && gesture?.tool === "wall" && (
                    <line x1={gesture.startX} y1={gesture.startY} x2={drawPreview.x} y2={drawPreview.y} stroke="#A33E3E" strokeWidth="10" strokeDasharray="16 8" pointerEvents="none" />
                  )}
                  {drawPreview && gesture?.tool === "zone" && (
                    <rect x={Math.min(gesture.startX, drawPreview.x)} y={Math.min(gesture.startY, drawPreview.y)} width={Math.abs(drawPreview.x - gesture.startX)} height={Math.abs(drawPreview.y - gesture.startY)} fill="#C4A26C" fillOpacity="0.22" stroke="#A33E3E" strokeWidth="4" strokeDasharray="12 8" pointerEvents="none" />
                  )}
                  {tables.map((table) => {
                    const x = table.x_percent * floorplan.canvas_width / 100;
                    const y = table.y_percent * floorplan.canvas_height / 100;
                    const width = table.width_percent * floorplan.canvas_width / 100;
                    const height = table.height_percent * floorplan.canvas_height / 100;
                    const isSelected = selectedId === table.id;
                    const fill = isSelected ? "#C4A26C" : table.is_active ? "#1A2238" : "#D4CBB8";
                    const textFill = isSelected ? "#0E1624" : table.is_active ? "#F8F5ED" : "#2B2B2B";
                    return (
                      <g key={table.id} data-table-marker="true" onPointerDown={(event) => beginTableInteraction(event, table, "move")} onClick={() => { if (selectTable(table.id)) setTool("navigate"); }} className="cursor-move">
                        {table.shape === "round" ? (
                          <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2} fill={fill} stroke={isSelected ? "#A33E3E" : "#F8F5ED"} strokeWidth={isSelected ? 6 : 3} transform={`rotate(${table.rotation} ${x} ${y})`} />
                        ) : (
                          <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx={table.shape === "rectangle" ? 16 : 8} fill={fill} stroke={isSelected ? "#A33E3E" : "#F8F5ED"} strokeWidth={isSelected ? 6 : 3} transform={`rotate(${table.rotation} ${x} ${y})`} />
                        )}
                        <text x={x} y={y + 7} textAnchor="middle" fill={textFill} fontSize="22" fontWeight="700" pointerEvents="none">{table.label}</text>
                        {selectedId === table.id && (
                          <rect
                            data-table-marker="true"
                            x={x + width / 2 - 14}
                            y={y + height / 2 - 14}
                            width="28"
                            height="28"
                            rx="5"
                            fill="#A33E3E"
                            stroke="#F8F5ED"
                            strokeWidth="3"
                            className="cursor-nwse-resize"
                            onPointerDown={(event) => beginTableInteraction(event, table, "resize")}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
              <p className="mt-2 text-[11px] text-text/45">{tool === "navigate" ? "Drag to pan · tap a table to select it." : tool === "wall" ? "Drag to draw a wall segment." : tool === "zone" ? "Drag to draw a room or service zone." : tool === "table" ? "Tap the map to place the selected table." : "Tap the plan to place a label."}</p>
              {layoutItems.length > 0 && (
                <section className="mt-4 rounded-lg border border-border-subtle bg-background p-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary">Walls, zones & labels</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {layoutItems.map((item) => {
                      const wallNumber = item.kind === "wall"
                        ? layoutItems.slice(0, layoutItems.indexOf(item) + 1).filter((layoutItem) => layoutItem.kind === "wall").length
                        : 0;
                      const itemName = item.kind === "wall" ? `Wall ${wallNumber}` : item.kind === "zone" ? `Zone · ${item.label}` : `Label · ${item.text}`;
                      return (
                        <button type="button" key={item.id} onClick={() => selectLayoutItem(item)} aria-pressed={selectedLayoutItemId === item.id} className={`min-h-9 rounded border px-3 text-xs ${selectedLayoutItemId === item.id ? "border-accent-gold bg-white text-primary" : "border-border-subtle bg-white/60 text-text/60"}`}>
                          {itemName}
                        </button>
                      );
                    })}
                  </div>
                  {selectedLayoutItem && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      {selectedLayoutItem.kind === "wall" ? (
                        <p className="mr-auto text-xs text-text/50">Selected wall segment</p>
                      ) : (
                        <label className="min-w-48 flex-1 text-[10px] text-text/50">
                          {selectedLayoutItem.kind === "zone" ? "Zone name" : "Label text"}
                          <AdminInput className="mt-1.5" value={layoutLabelDraft} onChange={(event) => setLayoutLabelDraft(event.target.value)} />
                        </label>
                      )}
                      {selectedLayoutItem.kind !== "wall" && <button type="button" onClick={saveLayoutItemLabel} disabled={!layoutLabelDraft.trim() || saving} className="min-h-10 rounded bg-primary px-3 text-[10px] uppercase tracking-wide text-white disabled:opacity-40">Save name</button>}
                      <button type="button" onClick={deleteLayoutItem} disabled={saving} className="min-h-10 px-2 text-[10px] text-accent hover:underline">Delete selected</button>
                    </div>
                  )}
                </section>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex min-h-9 cursor-pointer items-center rounded border border-border-subtle px-3 text-[10px] text-text/50 hover:border-accent-gold/60">
                  {uploading ? "Uploading reference…" : referenceUrl ? "Replace tracing reference" : "Add optional tracing image"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void saveReferenceImage(file);
                    event.currentTarget.value = "";
                  }} />
                </label>
                <span className="inline-flex min-h-9 items-center px-2 text-[10px] text-text/40">Reference is faint underlay only; the vector layout is the editable floor plan.</span>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-lg border border-border-subtle bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-primary">Tables</h2>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">{tables.length}</span>
                </div>
                {tables.length > 0 && (
                  <button type="button" onClick={() => void enableAllTables()} disabled={saving || tables.every((table) => table.is_active)} className="mt-3 min-h-10 w-full rounded border border-accent-gold/60 bg-white px-3 text-[10px] font-medium uppercase tracking-wide text-primary disabled:opacity-40">
                    {tables.every((table) => table.is_active) ? "All tables enabled" : "Enable all for bookings"}
                  </button>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
                  {tables.map((table) => (
                    <button key={table.id} type="button" onClick={() => { if (selectTable(table.id)) setTool("navigate"); }} aria-pressed={selectedId === table.id} className={`flex min-h-11 items-center justify-between gap-2 rounded border px-3 text-left text-xs transition ${selectedId === table.id ? "border-accent-gold bg-white text-primary shadow-soft" : "border-border-subtle bg-white/60 text-text/65 hover:border-accent-gold/50"}`}>
                      <span className="font-medium">{table.label}</span>
                      <span className={`truncate text-[10px] ${table.is_active ? "text-text/40" : "text-accent"}`}>{table.is_active ? (table.zone || "Bookable") : "Draft · not bookable"}</span>
                    </button>
                  ))}
                  {tables.length === 0 && <p className="col-span-2 text-xs text-text/45">Add your first table to start mapping.</p>}
                </div>
              </section>

              {selected && (
                <section className="rounded-lg border border-border-subtle bg-white p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-accent-gold">{selected.is_active ? "Bookable table" : "Draft table"}</p>
                      <h2 className="mt-1 font-display text-xl text-primary">{selected.label}</h2>
                    </div>
                    <span className="rounded-full bg-background px-2 py-1 text-[10px] uppercase tracking-wide text-text/50">{selected.shape}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <label className="text-[11px] text-text/55">Label<AdminInput className="mt-1.5" value={selected.label} onChange={(e) => updateSelected("label", e.target.value)} /></label>
                    <label className="text-[11px] text-text/55">Zone<AdminInput className="mt-1.5" value={selected.zone} onChange={(e) => updateSelected("zone", e.target.value)} placeholder="Patio" /></label>
                    <label className="text-[11px] text-text/55">Min seats<AdminInput className="mt-1.5" type="number" inputMode="numeric" min={1} max={50} step={1} value={Number.isNaN(selected.min_capacity) ? "" : selected.min_capacity} onChange={(e) => updateSelected("min_capacity", e.target.valueAsNumber)} /></label>
                    <label className="text-[11px] text-text/55">Max seats<AdminInput className="mt-1.5" type="number" inputMode="numeric" min={1} max={50} step={1} value={Number.isNaN(selected.max_capacity) ? "" : selected.max_capacity} onChange={(e) => updateSelected("max_capacity", e.target.valueAsNumber)} /></label>
                    <label className="text-[11px] text-text/55">Shape
                      <AdminSelect className="mt-1.5" value={selected.shape} onChange={(e) => updateSelected("shape", e.target.value)}>
                        <option value="round">Round</option><option value="square">Square</option><option value="rectangle">Rectangle</option>
                      </AdminSelect>
                    </label>
                    <label className="text-[11px] text-text/55">Rotation°<AdminInput className="mt-1.5" type="number" min={0} max={359} value={selected.rotation} onChange={(e) => updateSelected("rotation", Number(e.target.value))} /></label>
                    <label className="text-[11px] text-text/55">Width %<AdminInput className="mt-1.5" type="number" min={3} max={100} value={selected.width_percent} onChange={(e) => updateSelected("width_percent", Number(e.target.value))} /></label>
                    <label className="text-[11px] text-text/55">Height %<AdminInput className="mt-1.5" type="number" min={3} max={100} value={selected.height_percent} onChange={(e) => updateSelected("height_percent", Number(e.target.value))} /></label>
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-text/40">Drag the table marker to move it. Drag the red corner handle to resize it; use the width and height fields for precise adjustments.</p>
                  <p className="mt-2 text-[10px] text-text/40">Position {selected.x_percent}% × {selected.y_percent}% · size {selected.width_percent}% × {selected.height_percent}%</p>
                  {tableDirty && (
                    <p className="mt-2 flex items-center justify-between text-[10px] font-medium text-accent">
                      Unsaved table changes
                      <button type="button" onClick={revertSelected} disabled={saving} className="underline disabled:opacity-40">Discard changes</button>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setSelectedId(selected.id); setTool("table"); setNotice(`Tap the plan to place ${selected.label}.`); }} className="min-h-10 w-full rounded border border-accent-gold/60 px-3 text-[10px] font-medium uppercase tracking-wider text-primary hover:bg-background">Place on plan</button>
                  </div>
                  <button type="button" onClick={() => void saveTable()} disabled={saving} className="mt-2 min-h-10 w-full rounded bg-primary px-3 text-[10px] font-medium uppercase tracking-wider text-white disabled:opacity-50">{saving ? "Saving…" : "Save table details"}</button>
                  <button type="button" onClick={() => void saveTable(!selected.is_active)} disabled={saving} className={`mt-2 min-h-10 w-full rounded border px-3 text-[10px] font-medium uppercase tracking-wider disabled:opacity-50 ${selected.is_active ? "border-accent text-accent" : "border-accent-gold/60 text-primary"}`}>
                    {saving ? "Saving…" : selected.is_active ? "Save and move to draft" : "Save and enable bookings"}
                  </button>
                  {!selected.is_active && <p className="mt-1 text-[10px] leading-relaxed text-text/40">Draft tables are visible on the plan but won’t be offered to guests until enabled.</p>}
                  <button type="button" onClick={() => void hideTable()} className="mt-2 min-h-8 w-full text-[10px] text-text/40 hover:text-accent">Remove table from plan</button>
                </section>
              )}
            </aside>
          </div>
        )}

        {notice && <p className="mt-4 rounded border border-accent-gold/30 bg-white px-4 py-3 text-sm text-text/65" role="status">{notice}</p>}
      </div>
    </div>
  );
}
