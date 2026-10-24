"use client";

// Everything the floor plan editor and the live floor share: data loading, the canvas and its pan/zoom
// maths, the room, and the tables. A table is a soft pastel top with chair pills around it; its colour
// says its state (tokens in admin.css). Interaction stays in the two pages.

import type { createClient } from "@/lib/supabase/client";
import { plural } from "./ui";

export type LayoutItem =
  | { id: string; kind: "wall"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: "zone"; x: number; y: number; width: number; height: number; label: string }
  | { id: string; kind: "label"; x: number; y: number; text: string };

export interface TableGeom {
  id: string;
  label: string;
  min_capacity: number;
  max_capacity: number;
  shape: "round" | "square" | "rectangle";
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  rotation: number;
}

export interface FloorTableRow extends TableGeom { zone: string; is_active: boolean; }

export interface Floorplan {
  id: string;
  image_path: string | null;
  canvas_width: number;
  canvas_height: number;
  layout_data: LayoutItem[] | null;
}

export type ViewBox = { x: number; y: number; width: number; height: number };

export const FLOOR_BUCKET = "restaurant-floorplans";
export const DEFAULT_CANVAS = { width: 1000, height: 1400 };

/** T1, T2 … T10, not T1, T10, T2. */
export const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, undefined, { numeric: true });

export const seatsLabel = (t: Pick<TableGeom, "min_capacity" | "max_capacity">) =>
  t.min_capacity < t.max_capacity ? `${t.min_capacity}–${t.max_capacity} seats` : plural(t.max_capacity, "seat");

/** A restaurant's active floor plan, its tables (sorted by name) and a short-lived link to the tracing photo. */
export async function loadFloor(supabase: ReturnType<typeof createClient>, restaurantId: string, { bookableOnly = false } = {}) {
  const { data: plan, error } = await supabase.from("restaurant_floorplans")
    .select("id, image_path, canvas_width, canvas_height, layout_data")
    .eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle();
  if (error || !plan) return { plan: null, tables: [] as FloorTableRow[], referenceUrl: "", error };
  let tableQuery = supabase.from("restaurant_tables").select("*").eq("floorplan_id", plan.id);
  if (bookableOnly) tableQuery = tableQuery.eq("is_active", true);
  const [{ data: rows, error: tablesError }, signed] = await Promise.all([tableQuery, photoUrl(supabase, plan.image_path)]);
  return { plan: plan as Floorplan, tables: ((rows || []) as FloorTableRow[]).sort(byLabel), referenceUrl: signed, error: tablesError };
}

export async function photoUrl(supabase: ReturnType<typeof createClient>, path: string | null) {
  if (!path) return "";
  const { data } = await supabase.storage.from(FLOOR_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl || "";
}

// --- Bookings on tables ---

/** Statuses after which a booking no longer holds a table. */
export const ENDED = ["cancelled", "completed", "no_show"];
export const ENDED_FILTER = `(${ENDED.join(",")})`;
/** Add to a reservations select to get its current tables in the same request. */
export const WITH_TABLES = "reservation_table_assignments(table_id, released_at)";
type WithTables = { reservation_table_assignments?: { table_id: string; released_at: string | null }[] | null };
export const tablesOf = (r: WithTables) => (r.reservation_table_assignments || []).filter((a) => !a.released_at).map((a) => a.table_id);
export const needsTable = (r: { status: string }, tableIds: string[]) => !tableIds.length && r.status !== "seated" && !ENDED.includes(r.status);
export const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

// --- Canvas maths ---

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const clampBox = (box: ViewBox, W: number, H: number): ViewBox =>
  ({ ...box, x: clamp(box.x, 0, Math.max(0, W - box.width)), y: clamp(box.y, 0, Math.max(0, H - box.height)) });

/** Zoom around the centre, keeping the frame's shape. factor < 1 zooms in. */
export function zoomBox(box: ViewBox, factor: number, W: number, H: number): ViewBox {
  const ratio = box.height / box.width;
  const width = clamp(box.width * factor, W * 0.15, Math.min(W, H / ratio));
  const height = width * ratio;
  return clampBox({ x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height }, W, H);
}

/** Follow a drag of (dx, dy) screen pixels on a frame `framePx` pixels wide. */
export const panBox = (start: ViewBox, dx: number, dy: number, framePx: number, W: number, H: number) =>
  clampBox({ ...start, x: start.x - (dx * start.width) / framePx, y: start.y - (dy * start.width) / framePx }, W, H);

export function tableBox(table: TableGeom, canvasW: number, canvasH: number) {
  return {
    x: (table.x_percent * canvasW) / 100,
    y: (table.y_percent * canvasH) / 100,
    w: (table.width_percent * canvasW) / 100,
    h: (table.height_percent * canvasH) / 100,
  };
}

/** The part of the canvas that has something on it, plus a margin. Empty floors show the whole canvas. */
export function contentBox(tables: TableGeom[], items: LayoutItem[], W: number, H: number, pad = 70): ViewBox {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const t of tables) {
    const { x, y, w, h } = tableBox(t, W, H);
    const r = Math.max(w, h) / 2 + 30; // room for chairs and rotation
    xs.push(x - r, x + r); ys.push(y - r, y + r);
  }
  for (const i of items) {
    if (i.kind === "wall") { xs.push(i.x1, i.x2); ys.push(i.y1, i.y2); }
    else if (i.kind === "zone") { xs.push(i.x, i.x + i.width); ys.push(i.y, i.y + i.height); }
    else { xs.push(i.x - 60, i.x + 60); ys.push(i.y - 30, i.y + 10); }
  }
  if (!xs.length) return { x: 0, y: 0, width: W, height: H };
  const x = Math.max(0, Math.min(...xs) - pad);
  const y = Math.max(0, Math.min(...ys) - pad);
  return { x, y, width: Math.min(W, Math.max(...xs) + pad) - x, height: Math.min(H, Math.max(...ys) + pad) - y };
}

// --- Tables ---

/** free/booked/arrived/seated on the live floor; idle (bookable) and off (not bookable) in the editor. */
export type TableState = "free" | "booked" | "arrived" | "seated" | "idle" | "off";
const paint = (state: TableState) => ({ top: `var(--t-${state})`, chair: `var(--t-${state}-2)`, ink: `var(--t-${state}-ink)` });

/** Chairs per side, [top, right, bottom, left]. Long tables seat their long sides first and add ends from 6. */
function chairSides(shape: TableGeom["shape"], w: number, h: number, seats: number) {
  const n = clamp(seats, 0, 14);
  const sides = [0, 0, 0, 0];
  if (shape === "rectangle" && n >= 3) {
    const ends = n >= 6 ? 1 : 0;
    const a = Math.ceil((n - ends * 2) / 2);
    const [long1, long2, end1, end2] = w >= h ? [0, 2, 1, 3] : [3, 1, 0, 2];
    sides[long1] = a; sides[long2] = n - ends * 2 - a; sides[end1] = ends; sides[end2] = ends;
    return sides;
  }
  [0, 2, 3, 1].forEach((side, i) => { for (let k = i; k < n; k += 4) sides[side]++; }); // top, bottom, left, right
  return sides;
}

/** Chair pills in table-local coordinates (table centred on 0,0), sized to the table like real chairs. */
function Chairs({ shape, w, h, seats }: { shape: TableGeom["shape"]; w: number; h: number; seats: number }) {
  const t = clamp(Math.min(w, h) * 0.17, 8, 16); // chair depth
  const gap = t * 0.55;                           // table edge to chair
  if (shape === "round") {
    // spread around the ellipse, each chair turned to face the table
    const n = clamp(seats, 0, 14);
    const rx = w / 2 + gap + t / 2;
    const ry = h / 2 + gap + t / 2;
    const len = Math.max(t * 1.6, Math.min(Math.min(w, h) * 0.55, (Math.PI * (rx + ry)) / Math.max(n, 1) - t));
    return <>{Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2;
      const turn = (Math.atan2(Math.sin(a) * rx, Math.cos(a) * ry) * 180) / Math.PI + 90;
      return <rect key={i} x={-len / 2} y={-t / 2} width={len} height={t} rx={t / 2} transform={`translate(${Math.cos(a) * rx} ${Math.sin(a) * ry}) rotate(${turn})`} />;
    })}</>;
  }
  return <>{chairSides(shape, w, h, seats).flatMap((k, side) => {
    const horizontal = side % 2 === 0;
    const span = horizontal ? w : h;
    const len = Math.max(t * 1.6, Math.min(span * 0.5, span / k - t));
    const off = (horizontal ? h : w) / 2 + gap; // top and left chairs sit before the edge, bottom and right after it
    return Array.from({ length: k }, (_, i) => {
      const along = -span / 2 + (span * (i + 0.5)) / k - len / 2;
      return horizontal
        ? <rect key={`${side}-${i}`} x={along} y={side === 0 ? -(off + t) : off} width={len} height={t} rx={t / 2} />
        : <rect key={`${side}-${i}`} x={side === 3 ? -(off + t) : off} y={along} width={t} height={len} rx={t / 2} />;
    });
  })}</>;
}

/** One table on the canvas: chairs, top, name and a second line (seats, a time, a timer). */
export function FloorTable({ table, canvasW, canvasH, state, selected, dim, line2, onPointerDown, onClick, children }: {
  table: TableGeom;
  canvasW: number;
  canvasH: number;
  state: TableState;
  selected?: boolean;
  dim?: boolean;
  line2?: string;
  onPointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
  onClick?: () => void;
  children?: React.ReactNode; // handles, drawn unrotated in canvas space
}) {
  const { x, y, w, h } = tableBox(table, canvasW, canvasH);
  const c = paint(state);
  const outline = state === "off" ? "var(--line)" : "none"; // not bookable = dashed outline only
  const top = { style: { fill: c.top, stroke: selected ? "var(--red)" : outline }, strokeWidth: selected ? 5 : 2.5, strokeDasharray: state === "off" && !selected ? "10 8" : undefined };
  const showLine2 = line2 && h >= 64 && w >= 80;
  return (
    <g data-floor-table="true" onPointerDown={onPointerDown} onClick={onClick} opacity={dim ? 0.35 : 1} style={{ cursor: onPointerDown || onClick ? "pointer" : undefined }}>
      <g transform={`translate(${x} ${y}) rotate(${table.rotation})`} style={{ fill: c.chair, stroke: outline, strokeWidth: 2 }}>
        <Chairs shape={table.shape} w={w} h={h} seats={table.max_capacity} />
        {table.shape === "round"
          ? <ellipse rx={w / 2} ry={h / 2} {...top} />
          : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.min(w, h) * 0.18} {...top} />}
      </g>
      <text x={x} y={showLine2 ? y - 2 : y + 10} textAnchor="middle" style={{ fill: c.ink, font: "500 28px var(--sans)" }} pointerEvents="none">{table.label}</text>
      {showLine2 && <text x={x} y={y + 24} textAnchor="middle" style={{ fill: c.ink, font: "400 19px var(--sans)", opacity: 0.8 }} pointerEvents="none">{line2}</text>}
      {children}
    </g>
  );
}

/** The same table as a card, for grid views (Live floor → Tables). Long tables take two columns. */
export function TableCard({ table, state, selected, title, chips, onClick }: {
  table: TableGeom;
  state: TableState;
  selected?: boolean;
  title?: string;
  chips: string[];
  onClick: () => void;
}) {
  const c = paint(state);
  const wide = table.shape === "rectangle";
  const sides = chairSides(wide ? "rectangle" : "square", wide ? 2 : 1, 1, table.max_capacity);
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`tcard ${wide ? "col-span-2" : ""}`} style={{ "--top": c.top, "--chair": c.chair, "--ink": c.ink } as React.CSSProperties}>
      {sides.map((k, side) => <span key={side} className={`tcard-chairs s${side}`} aria-hidden="true">{Array.from({ length: k }, (_, i) => <i key={i} />)}</span>)}
      <span className={`tcard-top ${table.shape === "round" ? "round" : ""}`}>
        <b>{table.label}</b>
        {title && <span className="tcard-title">{title}</span>}
        <span className="tcard-chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</span>
      </span>
    </button>
  );
}

/** The colour key for table states. */
export function FloorKey({ states }: { states: [TableState, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Key">
      {states.map(([state, label]) => (
        <span key={state} className="t-cap inline-flex items-center gap-1.5 text-(--ink-2)">
          <i className="swatch" style={{ "--top": paint(state).top } as React.CSSProperties} />{label}
        </span>
      ))}
    </div>
  );
}

// --- Room and canvas ---

/** Walls, areas and labels. Interactive only when `onPick` is given (the editor's Room mode). */
export function RoomItems({ items, selectedId, onPick }: {
  items: LayoutItem[];
  selectedId?: string;
  onPick?: (item: LayoutItem) => void;
}) {
  const props = (item: LayoutItem) => ({
    onPointerDown: onPick ? (event: React.PointerEvent) => { event.stopPropagation(); onPick(item); } : undefined,
    pointerEvents: onPick ? undefined : ("none" as const),
  });
  const tone = (item: LayoutItem, rest: string) => (selectedId === item.id ? "var(--red)" : rest); // selected = brand red
  const order = { zone: 0, wall: 1, label: 2 }; // areas under walls under labels
  return (
    <g style={{ cursor: onPick ? "pointer" : undefined }}>
      {[...items].sort((a, b) => order[a.kind] - order[b.kind]).map((item) => item.kind === "zone" ? (
        <g key={item.id} {...props(item)}>
          <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={28} style={{ fill: "var(--tint-2)", stroke: tone(item, "none") }} strokeWidth={4} />
          <text x={item.x + 24} y={item.y + 42} style={{ fill: "var(--ink-3)", font: "500 18px var(--sans)", letterSpacing: "0.08em", textTransform: "uppercase" }} pointerEvents="none">{item.label}</text>
        </g>
      ) : item.kind === "wall" ? (
        <g key={item.id} {...props(item)}>
          {onPick && <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke="transparent" strokeWidth={40} />}
          <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} style={{ stroke: tone(item, "var(--floor-wall)") }} strokeWidth={8} strokeLinecap="round" />
        </g>
      ) : (
        <text key={item.id} x={item.x} y={item.y} textAnchor="middle" {...props(item)} style={{ fill: tone(item, "var(--ink-3)"), font: "500 20px var(--sans)" }}>{item.text}</text>
      ))}
    </g>
  );
}

/** The canvas: frame, background (dots in the editor), tracing photo, room, then whatever tables you pass. */
export function FloorFrame({ box, W, H, referenceUrl, items, dots, roomSelected, onRoomPick, svgRef, cursor, children, ...pointer }: {
  box: ViewBox;
  W: number;
  H: number;
  referenceUrl?: string;
  items: LayoutItem[];
  dots?: boolean;
  roomSelected?: string;
  onRoomPick?: (item: LayoutItem) => void;
  svgRef?: React.Ref<SVGSVGElement>;
  cursor?: string;
  children: React.ReactNode;
} & Pick<React.SVGProps<SVGSVGElement>, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel">) {
  const tall = box.height > box.width * 1.2; // tall rooms use the card's full width and let the page scroll
  return (
    <div className="frame">
      <svg
        ref={svgRef}
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full touch-none select-none"
        style={{ aspectRatio: `${box.width} / ${box.height}`, maxHeight: tall ? undefined : "max(420px, calc(100svh - 240px))", cursor }}
        {...pointer}
      >
        {dots && <defs><pattern id="floor-dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.8" style={{ fill: "var(--floor-dot)" }} /></pattern></defs>}
        <rect width={W} height={H} style={{ fill: "var(--card)" }} />
        {dots && <rect width={W} height={H} fill="url(#floor-dots)" />}
        {referenceUrl && <image href={referenceUrl} width={W} height={H} opacity={0.2} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />}
        <RoomItems items={items} selectedId={roomSelected} onPick={onRoomPick} />
        {children}
      </svg>
    </div>
  );
}

export function ZoomButtons({ onZoom }: { onZoom: (factor: number) => void }) {
  return (
    <>
      <button type="button" onClick={() => onZoom(1.25)} aria-label="Zoom out" className="btn btn-grey btn-sm btn-icon">−</button>
      <button type="button" onClick={() => onZoom(0.8)} aria-label="Zoom in" className="btn btn-grey btn-sm btn-icon">+</button>
    </>
  );
}
