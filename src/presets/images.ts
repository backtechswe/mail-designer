/**
 * Sample photography for the built-in presets.
 *
 * These are **hotlinked** from Unsplash's CDN, never bundled — the package stays small, and
 * an email has to reference remote images anyway (Gmail blocks data: URIs in <img>, so
 * inlining is not an option even if we wanted it).
 *
 * Every id below was verified to resolve at the time of writing. They are placeholders in a
 * starting point: the expectation is that a user swaps them for their own photography, and
 * nothing breaks if one is eventually removed upstream — the block simply shows its alt text.
 *
 * Photos from Unsplash (https://unsplash.com), free to use under the Unsplash License.
 */

const CDN = "https://images.unsplash.com/";

export interface ImageSize {
  /** Delivered pixel width. Use roughly 2× the display width so it stays sharp on retina. */
  w: number;
  /** Delivered pixel height. Omit to keep the photo's own aspect ratio. */
  h?: number;
}

/**
 * `crop=entropy` picks the busiest region rather than the centre, which is what keeps a
 * subject in frame when a wide photo is cropped to a square for a column.
 */
export function unsplash(id: string, { w, h }: ImageSize): string {
  const params = [`w=${w}`];
  if (h) params.push(`h=${h}`, "fit=crop", "crop=entropy");
  params.push("q=80", "auto=format");
  return `${CDN}${id}?${params.join("&")}`;
}

export const PHOTOS = {
  /** People at computers in a bright open-plan office. */
  officeTeam: "photo-1758762641372-e3b52bf061d4",
  /** Tidy desk with keyboard and monitor, shot from above. */
  desk: "photo-1742198865450-cf9ce4335a33",
  /** Hands on a laptop at a wooden table. */
  laptopTable: "photo-1749880164389-e14710d2f397",
  /** Sunlit home office, plants, warm light. */
  homeOffice: "photo-1742827871494-3a34fc06b69f",
  /** Sleek workstation with several screens. */
  workstation: "photo-1742199009963-c028d0c5a603",
  /** Contemporary hotel lobby, wood and soft lighting. */
  lobby: "photo-1621293954908-907159247fc8",
  /** Curved wooden staircase under warm ambient light. */
  staircase: "photo-1758801304977-fbb605f3858f",
  /** Concrete stairwell, cool grey, strong geometry. */
  concreteStairs: "photo-1578609481031-c70232cf5112",
  /** Iced coffee in a tall glass. */
  icedCoffee: "photo-1756260897470-f5b9f4af80c7",
  /** Breakfast bowl, overhead. */
  breakfastBowl: "photo-1756383254040-d19dbc1d4cb1",
  /** Slice of coffee cake on a plate. */
  coffeeCake: "photo-1756395194652-96bc660d0a50",
  /** Slice of pie, close up. */
  pie: "photo-1758221055840-be5dfa05699d",
  /** Fresh salad, bright and green. */
  salad: "photo-1756334830608-32905156d724",
  /** Wooden serving tray, rustic. */
  tray: "photo-1756551399655-207569477340",
  /** Person working at a computer desk, side light. */
  atDesk: "photo-1743343852416-e5eec987a627",
} as const;

export type PhotoName = keyof typeof PHOTOS;

/** Convenience: `photo("icedCoffee", { w: 1200, h: 675 })`. */
export function photo(name: PhotoName, size: ImageSize): string {
  return unsplash(PHOTOS[name], size);
}
