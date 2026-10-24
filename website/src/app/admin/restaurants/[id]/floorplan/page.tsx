"use client";

// Floor plan: two jobs, two modes.
//   Tables — add, drag, resize, set seats. Most visits are this.
//   Room   — walls, areas and labels, drawn once. Tables are locked while you draw, and vice versa.
// Every change saves on its own; there is no Save button to forget.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminInput, FormField } from "@/components/admin/FormField";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  DEFAULT_CANVAS, FLOOR_BUCKET, FloorFrame, FloorTable, ZoomButtons, byLabel, contentBox, loadFloor, panBox, photoUrl, seatsLabel, tableBox, zoomBox,
  type FloorTableRow, type Floorplan, type LayoutItem, type ViewBox,
} from "@/components/admin/floor";
import { Chevron, Empty, Loading, RestaurantHeader, Sheet, StatusTag, Stepper, SwitchRow, plural, useNotice } from "@/components/admin/ui";

type Mode = "tables" | "room";
type RoomTool = "select" | "wall" | "zone" | "label";

type Point = { x: number; y: number };

interface Drag {
  kind: "pan" | "move" | "resize" | "draw";
  pointerId: number;
  start: Point;          // canvas units
  startClient: Point;
  startViewBox: ViewBox;
  table?: FloorTableRow;
  moved: boolean;
}

const ROOM_TOOLS: { key: RoomTool; label: string; hint: string }[] = [
  { key: "select", label: "Select", hint: "Tap a wall, area or label to rename or delete it. Drag to move around." },
  { key: "wall", label: "Wall", hint: "Drag to draw a wall. Keep dragging to draw the next one." },
  { key: "zone", label: "Area", hint: "Drag a box around a part of the room, like Terrace or Bar." },
  { key: "label", label: "Label", hint: "Tap where the label goes, like Entry or Kitchen." },
];

export default function RestaurantFloorplanPage() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const supabase = createClient();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const timers = useRef<Record<string, number>>({});
  const pending = useRef<Record<string, Partial<FloorTableRow>>>({});

  const [restaurantName, setRestaurantName] = useState("Restaurant");
  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [tables, setTables] = useState<FloorTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"" | "saving" | "saved">("");
  const { say, fail: report, snackbar } = useNotice();

  const [mode, setMode] = useState<Mode>("tables");
  const [roomTool, setRoomTool] = useState<RoomTool>("select");
  const [selectedId, setSelectedId] = useState("");
  const [roomItemId, setRoomItemId] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, ...DEFAULT_CANVAS });
  const [drawPreview, setDrawPreview] = useState<{ start: Point; end: Point } | null>(null);
  const [canvasSize, setCanvasSize] = useState(DEFAULT_CANVAS);

  const selected = tables.find((table) => table.id === selectedId) || null;
  const layoutItems = useMemo(() => floorplan?.layout_data || [], [floorplan]);
  const roomItem = layoutItems.find((item) => item.id === roomItemId) || null;
  const W = floorplan?.canvas_width || DEFAULT_CANVAS.width;
  const H = floorplan?.canvas_height || DEFAULT_CANVAS.height;
  const fail = (error: string | { message: string; code?: string }) => { report(error); setStatus(""); };

  const load = useCallback(async () => {
    const [{ data: restaurant, error }, floor] = await Promise.all([
      supabase.from("restaurants").select("name").eq("id", restaurantId).single(),
      loadFloor(supabase, restaurantId),
    ]);
    if (error || floor.error) report(error || floor.error!);
    setRestaurantName(restaurant?.name || "Restaurant");
    setFloorplan(floor.plan);
    setTables(floor.tables);
    setReferenceUrl(floor.referenceUrl);
    if (floor.plan) {
      setCanvasSize({ width: floor.plan.canvas_width, height: floor.plan.canvas_height });
      setViewBox(contentBox(floor.tables, floor.plan.layout_data || [], floor.plan.canvas_width, floor.plan.canvas_height));
    }
    setLoading(false);
  }, [restaurantId, supabase, report]);

  // Loading remote floor data is an intentional effect-driven state sync.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Switching mode drops the other mode's selection so only one thing is ever "selected".
  const switchMode = (next: Mode) => {
    setMode(next);
    setSelectedId("");
    setRoomItemId("");
    setRoomTool("select");
  };

  // ---------- Saving ----------
  // Every write asks for the changed row back (.select). An expired session gets no error and no row,
  // so "nothing came back" is treated as a failed save (carried over from main's 2a960c8).

  const NOT_SAVED = "Nothing was saved. Your session may have expired: sign in again and retry.";

  /** Update a table now, write it after `delay` ms (typing debounces, drags save at once). */
  const persistTable = (tableId: string, patch: Partial<FloorTableRow>, delay = 0) => {
    setTables((current) => current.map((table) => table.id === tableId ? { ...table, ...patch } : table));
    pending.current[tableId] = { ...pending.current[tableId], ...patch };
    window.clearTimeout(timers.current[tableId]);
    setStatus("saving");
    timers.current[tableId] = window.setTimeout(async () => {
      const body = pending.current[tableId];
      delete pending.current[tableId];
      if (!body) return;
      if ("label" in body && !String(body.label).trim()) { setStatus(""); return; } // keep typing; don't save an empty name
      const { data, error } = await supabase.from("restaurant_tables").update(body).eq("id", tableId).select("id");
      if (error || !data?.length) {
        fail(!error ? NOT_SAVED : error.message.includes("restaurant_tables_floorplan_id_label_key") ? "Two tables can't share a name. Pick another." : error);
        void load(); // show what's really stored
      } else setStatus("saved");
    }, delay);
  };

  const saveLayout = async (nextItems: LayoutItem[]) => {
    if (!floorplan) return;
    const previous = floorplan.layout_data;
    setFloorplan({ ...floorplan, layout_data: nextItems });
    setStatus("saving");
    const { data, error } = await supabase.from("restaurant_floorplans").update({ layout_data: nextItems }).eq("id", floorplan.id).select("id");
    if (error || !data?.length) {
      setFloorplan((current) => current ? { ...current, layout_data: previous } : current);
      fail(error || NOT_SAVED);
    } else setStatus("saved");
  };

  const createFloorplan = async () => {
    setBusy(true);
    const { data, error } = await supabase.from("restaurant_floorplans").insert({
      restaurant_id: restaurantId, name: "Main floor", image_path: null,
      canvas_width: DEFAULT_CANVAS.width, canvas_height: DEFAULT_CANVAS.height, layout_data: [], is_active: true,
    }).select("id, image_path, canvas_width, canvas_height, layout_data").single();
    setBusy(false);
    if (error || !data) { fail(error || "Couldn't start the floor plan. Try again."); return; }
    setFloorplan(data as Floorplan);
    setViewBox({ x: 0, y: 0, width: data.canvas_width, height: data.canvas_height });
    setMode("room");
    setRoomTool("wall");
    say("Start with the walls, then switch to Tables");
  };

  // Warn before leaving while a save is still on its way (typing debounces up to 600ms).
  useEffect(() => {
    if (status !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  // ---------- Tables ----------

  const addTable = async () => {
    if (!floorplan) return;
    const labels = new Set(tables.map((table) => table.label));
    let n = 1;
    while (labels.has(`T${n}`)) n++;
    // drop it in the middle of what you're looking at, not the middle of the whole canvas
    const cx = ((viewBox.x + viewBox.width / 2) / W) * 100;
    const cy = ((viewBox.y + viewBox.height / 2) / H) * 100;
    const { data, error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: restaurantId, floorplan_id: floorplan.id, label: `T${n}`,
      min_capacity: 1, max_capacity: 2, shape: "round",
      x_percent: Number(cx.toFixed(2)), y_percent: Number(cy.toFixed(2)), width_percent: 10, height_percent: 7,
      rotation: 0, zone: "", is_active: true,
    }).select().single();
    if (error || !data) { fail(error || "Couldn't add a table. Try again."); return; }
    setTables((current) => [...current, data as FloorTableRow].sort(byLabel));
    setMode("tables");
    setSelectedId(data.id);
    say(`${data.label} added. Drag it into place.`);
  };

  const setSeats = (which: "min" | "max", value: number) => {
    if (!selected) return;
    const patch = which === "min"
      ? { min_capacity: value, max_capacity: Math.max(value, selected.max_capacity) }
      : { max_capacity: value, min_capacity: Math.min(value, selected.min_capacity) };
    persistTable(selected.id, patch, 400);
  };

  const deleteTable = async () => {
    if (!selected) return;
    setConfirmDelete(false);
    const { data, error } = await supabase.from("restaurant_tables").delete().eq("id", selected.id).select("id");
    if (error || !data?.length) {
      fail(!error ? NOT_SAVED : error.code === "23503" ? `${selected.label} has bookings on it, so it can't be deleted. Switch off “Bookable online” instead.` : error);
      return;
    }
    setTables((current) => current.filter((table) => table.id !== selected.id));
    setSelectedId("");
    setSheetOpen(false);
    say(`${selected.label} deleted`);
  };

  const enableAll = async () => {
    if (!floorplan) return;
    const count = tables.filter((table) => !table.is_active).length;
    const { data, error } = await supabase.from("restaurant_tables").update({ is_active: true }).eq("floorplan_id", floorplan.id).eq("is_active", false).select("id");
    if (error || !data?.length) { fail(error || NOT_SAVED); return; }
    setTables((current) => current.map((table) => ({ ...table, is_active: true })));
    say(`${plural(count, "table")} now bookable`);
  };

  // ---------- Room ----------

  const pickRoomItem = (item: LayoutItem) => {
    setRoomItemId(item.id);
    setNameDraft(item.kind === "zone" ? item.label : item.kind === "label" ? item.text : "");
  };

  const renameRoomItem = () => {
    if (!roomItem || roomItem.kind === "wall") return;
    const name = nameDraft.trim();
    const current = roomItem.kind === "zone" ? roomItem.label : roomItem.text;
    if (!name || name === current) return;
    void saveLayout(layoutItems.map((item) => item.id !== roomItem.id ? item
      : item.kind === "zone" ? { ...item, label: name } : item.kind === "label" ? { ...item, text: name } : item));
  };

  const deleteRoomItem = () => {
    if (!roomItemId) return;
    void saveLayout(layoutItems.filter((item) => item.id !== roomItemId));
    setRoomItemId("");
  };

  // Backspace / Delete removes the selected wall, area or label (not while typing)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement)?.closest("input, textarea, select");
      if (!typing && roomItemId && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        deleteRoomItem();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const saveReferenceImage = async (file: File) => {
    if (!floorplan || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      fail("Choose a PNG, JPG or WebP under 10 MB.");
      return;
    }
    setBusy(true);
    const path = `${restaurantId}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from(FLOOR_BUCKET).upload(path, file, { contentType: file.type });
    if (uploadError) { fail(uploadError); setBusy(false); return; }
    const { error } = await supabase.from("restaurant_floorplans").update({ image_path: path }).eq("id", floorplan.id);
    if (error) {
      await supabase.storage.from(FLOOR_BUCKET).remove([path]);
      fail(error);
    } else {
      if (floorplan.image_path) await supabase.storage.from(FLOOR_BUCKET).remove([floorplan.image_path]);
      setFloorplan({ ...floorplan, image_path: path });
      setReferenceUrl(await photoUrl(supabase, path));
      say("Photo added under the plan. Trace over it.");
    }
    setBusy(false);
  };

  const expandCanvas = async () => {
    if (!floorplan) return;
    setBusy(true);
    const { error } = await supabase.rpc("expand_restaurant_floorplan", {
      p_floorplan_id: floorplan.id,
      p_canvas_width: Number(canvasSize.width),
      p_canvas_height: Number(canvasSize.height),
    });
    if (error) fail(error);
    else { say("More room added. Everything stayed where it was."); await load(); }
    setBusy(false);
  };

  // ---------- Canvas: pointer → canvas units, pan, zoom ----------

  const toCanvas = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const zoom = (factor: number) => setViewBox((current) => zoomBox(current, factor, W, H));
  const fit = () => setViewBox(contentBox(tables, layoutItems, W, H));

  const startDrag = (event: React.PointerEvent, kind: Drag["kind"], table?: FloorTableRow) => {
    dragRef.current = {
      kind, pointerId: event.pointerId, table, moved: false,
      start: toCanvas(event.clientX, event.clientY),
      startClient: { x: event.clientX, y: event.clientY },
      startViewBox: viewBox,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onCanvasDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (mode === "room" && roomTool !== "select") {
      startDrag(event, "draw");
      const p = toCanvas(event.clientX, event.clientY);
      if (roomTool !== "label") setDrawPreview({ start: p, end: p });
      return;
    }
    startDrag(event, "pan");
  };

  const onTableDown = (event: React.PointerEvent, table: FloorTableRow) => {
    if (mode !== "tables") return;
    event.stopPropagation();
    setSelectedId(table.id);
    startDrag(event, "move", table);
  };

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dxClient = event.clientX - drag.startClient.x;
    const dyClient = event.clientY - drag.startClient.y;
    if (!drag.moved && Math.hypot(dxClient, dyClient) < 4) return; // a tap, not a drag
    drag.moved = true;

    if (drag.kind === "pan") {
      setViewBox(panBox(drag.startViewBox, dxClient, dyClient, svgRef.current?.getBoundingClientRect().width || 1, W, H));
      return;
    }
    const p = toCanvas(event.clientX, event.clientY);
    if (drag.kind === "draw") { setDrawPreview((current) => current ? { ...current, end: p } : current); return; }
    const table = drag.table!;
    if (drag.kind === "move") {
      const x = Math.max(0, Math.min(100, table.x_percent + ((p.x - drag.start.x) / W) * 100));
      const y = Math.max(0, Math.min(100, table.y_percent + ((p.y - drag.start.y) / H) * 100));
      setTables((current) => current.map((t) => t.id === table.id ? { ...t, x_percent: Number(x.toFixed(2)), y_percent: Number(y.toFixed(2)) } : t));
    } else {
      const { x: cx, y: cy } = tableBox(table, W, H);
      const width = Math.max(3, Math.min(60, (Math.abs(p.x - cx) * 2 / W) * 100));
      const height = Math.max(3, Math.min(60, (Math.abs(p.y - cy) * 2 / H) * 100));
      setTables((current) => current.map((t) => t.id === table.id ? { ...t, width_percent: Number(width.toFixed(2)), height_percent: Number(height.toFixed(2)) } : t));
    }
  };

  const onUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);

    if (drag.kind === "pan") {
      if (!drag.moved) { setSelectedId(""); setRoomItemId(""); } // tap on empty floor = deselect
      return;
    }
    if (drag.kind === "move" || drag.kind === "resize") {
      if (!drag.moved) return;
      const latest = tables.find((t) => t.id === drag.table!.id);
      if (latest) persistTable(latest.id, drag.kind === "move"
        ? { x_percent: latest.x_percent, y_percent: latest.y_percent }
        : { width_percent: latest.width_percent, height_percent: latest.height_percent });
      return;
    }
    // draw
    const end = toCanvas(event.clientX, event.clientY);
    const start = drag.start;
    setDrawPreview(null);
    if (roomTool === "label") {
      const item: LayoutItem = { id: crypto.randomUUID(), kind: "label", x: end.x, y: end.y, text: "Label" };
      void saveLayout([...layoutItems, item]);
      pickRoomItem(item);
      setRoomTool("select");
      return;
    }
    if (Math.hypot(end.x - start.x, end.y - start.y) < 16) return;
    if (roomTool === "wall") {
      void saveLayout([...layoutItems, { id: crypto.randomUUID(), kind: "wall", x1: start.x, y1: start.y, x2: end.x, y2: end.y }]);
    } else if (roomTool === "zone") {
      const item: LayoutItem = { id: crypto.randomUUID(), kind: "zone", x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y), label: "Area" };
      void saveLayout([...layoutItems, item]);
      pickRoomItem(item);
      setRoomTool("select");
    }
  };

  // ---------- Render ----------

  if (loading) return <Loading />;

  const bookable = tables.filter((t) => t.is_active);
  const seatTotal = bookable.reduce((sum, t) => sum + t.max_capacity, 0);
  const drafts = tables.length - bookable.length;
  const zoneNames = [...new Set([...layoutItems.flatMap((i) => i.kind === "zone" ? [i.label] : []), ...tables.map((t) => t.zone).filter(Boolean)])];
  const hint = mode === "tables"
    ? (tables.length ? "Drag a table to move it. Drag its corner dot to resize. Tap empty floor to deselect." : "Add your first table, then drag it into place.")
    : ROOM_TOOLS.find((t) => t.key === roomTool)!.hint;
  const count = (kind: LayoutItem["kind"]) => layoutItems.filter((i) => i.kind === kind).length;
  const statusText = status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : "";

  const tableInspector = selected && (
    <div>
      <button type="button" onClick={() => { setSelectedId(""); setSheetOpen(false); }} className="back hidden lg:inline-flex"><Chevron dir="left" />All tables</button>
      <div className="form mt-2">
        <FormField label="Name">
          <AdminInput value={selected.label} onChange={(e) => persistTable(selected.id, { label: e.target.value }, 600)} />
        </FormField>
        <FormField group label="Seats" hint="Online bookings only land here for parties in this range.">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="t-cap mb-1">At least</p><Stepper label="Minimum seats" value={selected.min_capacity} min={1} max={50} onChange={(n) => setSeats("min", n)} /></div>
            <div><p className="t-cap mb-1">At most</p><Stepper label="Maximum seats" value={selected.max_capacity} min={1} max={50} onChange={(n) => setSeats("max", n)} /></div>
          </div>
        </FormField>
        <FormField group label="Shape">
          <div className="pills -ml-1">
            {([["round", "Round"], ["square", "Square"], ["rectangle", "Long"]] as const).map(([shape, label]) => (
              <button key={shape} type="button" className="pill" aria-pressed={selected.shape === shape} onClick={() => persistTable(selected.id, shape === "rectangle" && selected.shape !== "rectangle"
                ? { shape, width_percent: Math.max(selected.width_percent, selected.height_percent * 1.8 * (H / W)) }
                : { shape })}>{label}</button>
            ))}
            <button type="button" className="btn btn-grey btn-sm ml-auto" onClick={() => persistTable(selected.id, { rotation: (selected.rotation + 45) % 360 })}>Rotate</button>
          </div>
        </FormField>
        <FormField label="Area" hint={zoneNames.length ? undefined : "Optional, like Terrace or Bar. Staff see it on the live floor."}>
          <AdminInput list="floor-areas" value={selected.zone} onChange={(e) => persistTable(selected.id, { zone: e.target.value }, 600)} placeholder="Terrace" />
          <datalist id="floor-areas">{zoneNames.map((z) => <option key={z} value={z} />)}</datalist>
        </FormField>
      </div>
      <div className="mt-2 rows">
        <SwitchRow label="Bookable online" sub={selected.is_active ? "Guests can be seated here" : "Shown on the plan, never offered"} checked={selected.is_active} onChange={(v) => persistTable(selected.id, { is_active: v })} />
      </div>
      <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-danger btn-sm mt-4 -ml-3">Delete table</button>
    </div>
  );

  const tablesList = (
    <div>
      <h2 className="t-h4">Tables</h2>
      <p className="t-sub">{tables.length ? `${plural(bookable.length, "bookable table")} · ${plural(seatTotal, "seat")}` : "No tables yet"}</p>
      {drafts > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-(--warn-tint) px-4 py-3">
          <p className="text-sm text-(--warn)">{plural(drafts, "table")} not bookable</p>
          <button type="button" onClick={() => void enableAll()} className="btn btn-sm btn-secondary">Make all bookable</button>
        </div>
      )}
      <div className="rows -mx-6 mt-3">
        {tables.map((table) => (
          <button key={table.id} type="button" className="row" onClick={() => { setSelectedId(table.id); setSheetOpen(true); }}>
            <span className="row-main">
              <span className="row-title">{table.label}</span>
              <span className="row-sub">{seatsLabel(table)}{table.zone ? ` · ${table.zone}` : ""}</span>
            </span>
            {!table.is_active && <StatusTag status="not_bookable" />}
            <Chevron />
          </button>
        ))}
      </div>
    </div>
  );

  const roomInspector = (
    <div>
      <h2 className="t-h4">Room</h2>
      <p className="t-sub">Walls, areas and labels staff see on the live floor. Tables stay put while you draw.</p>
      {roomItem ? (
        <div className="mt-6">
          <p className="t-cap mb-2">{roomItem.kind === "wall" ? "Wall" : roomItem.kind === "zone" ? "Area" : "Label"} selected</p>
          {roomItem.kind !== "wall" && (
            <FormField label="Name">
              <AdminInput autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={renameRoomItem} onKeyDown={(e) => { if (e.key === "Enter") renameRoomItem(); }} />
            </FormField>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={deleteRoomItem} className="btn btn-danger btn-sm -ml-3">Delete</button>
            <button type="button" onClick={() => setRoomItemId("")} className="btn btn-grey btn-sm ml-auto">Done</button>
          </div>
        </div>
      ) : (
        <p className="t-sub mt-4">{layoutItems.length ? `${plural(count("wall"), "wall")}, ${plural(count("zone"), "area")}, ${plural(count("label"), "label")}.` : "Nothing drawn yet. Pick Wall above and drag on the floor."}</p>
      )}

      <div className="mt-8 border-t border-(--rule) pt-6">
        <p className="t-h4">Trace from a photo</p>
        <p className="t-sub">A photo or sketch of the room, shown faintly under the plan. Guests never see it.</p>
        <label className={`btn btn-secondary btn-sm mt-3 ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {referenceUrl ? "Replace photo" : "Add photo"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void saveReferenceImage(file);
            e.currentTarget.value = "";
          }} />
        </label>
      </div>

      {floorplan && (
        <details className="mt-6 border-t border-(--rule) pt-6">
          <summary className="t-h4 cursor-pointer">Need more space?</summary>
          <p className="t-sub mt-1">Adds room to the right and bottom. Nothing moves.</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <FormField label="Width">
              <AdminInput type="number" min={floorplan.canvas_width} max={6000} step={100} value={canvasSize.width} onChange={(e) => setCanvasSize((s) => ({ ...s, width: Number(e.target.value) }))} />
            </FormField>
            <FormField label="Height">
              <AdminInput type="number" min={floorplan.canvas_height} max={6000} step={100} value={canvasSize.height} onChange={(e) => setCanvasSize((s) => ({ ...s, height: Number(e.target.value) }))} />
            </FormField>
          </div>
          <button type="button" onClick={() => void expandCanvas()} disabled={busy || (canvasSize.width <= floorplan.canvas_width && canvasSize.height <= floorplan.canvas_height)} className="btn btn-secondary btn-sm mt-4">Add space</button>
        </details>
      )}
    </div>
  );

  return (
    <div className="page page-wide">
      <RestaurantHeader id={restaurantId} name={restaurantName} current="floor" actions={statusText && <p className="t-sub" role="status">{statusText}</p>} />

      {!floorplan ? (
        <section className="card">
          <Empty
            title="Draw your floor"
            sub="Sketch the room and place your tables. Staff then seat guests on it from the live floor."
            action={<button type="button" onClick={() => void createFloorplan()} disabled={busy} className="btn btn-primary">{busy ? "Starting…" : "Start the floor plan"}</button>}
          />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="card min-w-0 p-3 md:p-4">
            {/* Toolbar: mode first, then that mode's actions, zoom on the right */}
            <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
              <div className="pills" role="group" aria-label="What are you editing?">
                <button type="button" className="pill" aria-pressed={mode === "tables"} onClick={() => switchMode("tables")}>Tables <span className="n">{tables.length}</span></button>
                <button type="button" className="pill" aria-pressed={mode === "room"} onClick={() => switchMode("room")}>Room</button>
              </div>
              <span className="mx-1 hidden h-6 w-px bg-(--rule) sm:block" aria-hidden="true" />
              {mode === "tables" ? (
                <button type="button" onClick={() => void addTable()} className="btn btn-primary btn-sm">Add table</button>
              ) : (
                <div className="pills" role="group" aria-label="Drawing tool">
                  {ROOM_TOOLS.map((tool) => (
                    <button key={tool.key} type="button" className="pill" aria-pressed={roomTool === tool.key} onClick={() => { setRoomTool(tool.key); setRoomItemId(""); }}>{tool.label}</button>
                  ))}
                  <button type="button" className="pill" onClick={() => void saveLayout(layoutItems.slice(0, -1))} disabled={!layoutItems.length}>Undo</button>
                </div>
              )}
              <div className="ml-auto flex items-center gap-1">
                <ZoomButtons onZoom={zoom} />
                <button type="button" onClick={fit} className="btn btn-grey btn-sm">Fit</button>
              </div>
            </div>

            <FloorFrame
              svgRef={svgRef}
              box={viewBox}
              W={W}
              H={H}
              dots
              referenceUrl={referenceUrl}
              items={layoutItems}
              roomSelected={roomItemId}
              onRoomPick={mode === "room" && roomTool === "select" ? pickRoomItem : undefined}
              cursor={mode === "room" && roomTool !== "select" ? "crosshair" : "grab"}
              onPointerDown={onCanvasDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
                {drawPreview && roomTool === "wall" && (
                  <line x1={drawPreview.start.x} y1={drawPreview.start.y} x2={drawPreview.end.x} y2={drawPreview.end.y} style={{ stroke: "var(--red)" }} strokeWidth={10} strokeLinecap="round" strokeDasharray="18 10" pointerEvents="none" />
                )}
                {drawPreview && roomTool === "zone" && (
                  <rect x={Math.min(drawPreview.start.x, drawPreview.end.x)} y={Math.min(drawPreview.start.y, drawPreview.end.y)} width={Math.abs(drawPreview.end.x - drawPreview.start.x)} height={Math.abs(drawPreview.end.y - drawPreview.start.y)} rx={18} style={{ fill: "var(--red-tint)", stroke: "var(--red)" }} strokeWidth={4} strokeDasharray="14 10" pointerEvents="none" />
                )}
                <g pointerEvents={mode === "tables" ? "auto" : "none"} opacity={mode === "room" ? 0.45 : 1}>
                  {tables.map((table) => {
                    const box = tableBox(table, W, H);
                    const isSelected = mode === "tables" && table.id === selectedId;
                    return (
                      <FloorTable
                        key={table.id}
                        table={table}
                        canvasW={W}
                        canvasH={H}
                        selected={isSelected}
                        line2={seatsLabel(table)}
                        state={table.is_active ? "idle" : "off"}
                        onPointerDown={(e) => onTableDown(e, table)}
                      >
                        {isSelected && (
                          <circle
                            cx={box.x + box.w / 2}
                            cy={box.y + box.h / 2}
                            r={16}
                            style={{ fill: "var(--red)", stroke: "var(--card)", cursor: "nwse-resize" }}
                            strokeWidth={4}
                            onPointerDown={(e) => { e.stopPropagation(); startDrag(e, "resize", table); }}
                          >
                            <title>Drag to resize</title>
                          </circle>
                        )}
                      </FloorTable>
                    );
                  })}
                </g>
            </FloorFrame>
            <p className="t-cap px-1 pt-3">{hint}</p>
          </section>

          {/* Inspector: desktop side panel */}
          <aside className="card hidden h-fit lg:sticky lg:top-6 lg:block">
            {mode === "room" ? roomInspector : selected ? tableInspector : tablesList}
          </aside>

          {/* Phones: the same panel lives under the plan; an edited table opens in a sheet */}
          <aside className="card lg:hidden">
            {mode === "room" ? roomInspector : tablesList}
          </aside>
        </div>
      )}

      {/* Phones: a selected table gets a bar at the bottom, so editing it is one tap away */}
      {selected && mode === "tables" && !sheetOpen && (
        <div className="bottom-bar flex items-center gap-3 lg:hidden">
          <p className="min-w-0 flex-1 truncate"><span className="t-h4">{selected.label}</span> <span className="t-sub">{seatsLabel(selected)}</span></p>
          <button type="button" onClick={() => setSheetOpen(true)} className="btn btn-secondary btn-sm">Edit table</button>
        </div>
      )}
      <div className="lg:hidden">
        <Sheet open={sheetOpen && !!selected} onClose={() => setSheetOpen(false)} labelledBy="table-sheet-title">
          <h2 id="table-sheet-title" className="t-h3 mb-2 pr-12">{selected?.label}</h2>
          {tableInspector}
        </Sheet>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selected?.label || "table"}?`}
        message="It comes off the plan for good. To keep it but stop online bookings, switch off “Bookable online” instead."
        confirmLabel="Delete table"
        onConfirm={() => void deleteTable()}
        onCancel={() => setConfirmDelete(false)}
      />
      {snackbar}
    </div>
  );
}
