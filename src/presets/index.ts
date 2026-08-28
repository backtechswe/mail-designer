import type { MailPreset } from "../types.js";
import { doc, heading, resetIds, section, text } from "./builders.js";
import { newsletter } from "./newsletter.js";
import { invitation } from "./invitation.js";
import { campaign } from "./campaign.js";
import { welcome } from "./welcome.js";
import { receipt } from "./receipt.js";

/**
 * Starting points.
 *
 * Each is a designed piece rather than the same layout recoloured: its own palette, its own
 * measure, its own reason for the choices. That matters more than it sounds — a user who
 * opens a template and finds something worth keeping edits it, while a user who finds a grey
 * skeleton starts over, and the template has cost them time instead of saving it.
 *
 * Replace or extend the list with the `presets` prop on MailDesigner.
 */

function blank() {
  resetIds("bl");
  return doc([
    section([
      heading("Rubrik", { level: 1, fontSize: 30, padding: [0, 0, 14, 0] }),
      text("<p>Write your text here.</p>", { padding: [0, 0, 0, 0] }),
    ]),
  ]);
}

export const builtInPresets: MailPreset[] = [
  { id: "newsletter", name: "Newsletter", document: newsletter() },
  { id: "invitation", name: "Invitation", document: invitation() },
  { id: "campaign", name: "Campaign", document: campaign() },
  { id: "welcome", name: "Welcome", document: welcome() },
  { id: "receipt", name: "Confirmation", document: receipt() },
  { id: "blank", name: "Blank", document: blank() },
];

export function findPreset(presetId: string, presets: MailPreset[] = builtInPresets) {
  const wanted = presetId.trim().toLowerCase();
  // Also by display name, because that is the word the editor and the README show. The
  // Confirmation preset has the id `receipt`, so `new confirmation` failed for someone who
  // had only ever seen it called Confirmation — an id is an implementation detail to them.
  return (
    presets.find((p) => p.id.toLowerCase() === wanted) ??
    presets.find((p) => p.name.toLowerCase() === wanted)
  );
}

export { PHOTOS, photo, unsplash } from "./images.js";
export type { PhotoName } from "./images.js";
