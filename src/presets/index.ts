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
      text("<p>Skriv din text här.</p>", { padding: [0, 0, 0, 0] }),
    ]),
  ]);
}

export const builtInPresets: MailPreset[] = [
  { id: "newsletter", name: "Nyhetsbrev", document: newsletter() },
  { id: "invitation", name: "Inbjudan", document: invitation() },
  { id: "campaign", name: "Kampanj", document: campaign() },
  { id: "welcome", name: "Välkomstmejl", document: welcome() },
  { id: "receipt", name: "Bekräftelse", document: receipt() },
  { id: "blank", name: "Tomt", document: blank() },
];

export function findPreset(presetId: string, presets: MailPreset[] = builtInPresets) {
  return presets.find((p) => p.id === presetId);
}

export { PHOTOS, photo, unsplash } from "./images.js";
export type { PhotoName } from "./images.js";
