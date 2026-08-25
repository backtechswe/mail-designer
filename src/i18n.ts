import i18next from "i18next";
import type { i18n as I18nInstance } from "i18next";
import type { Locale } from "./types.js";

/**
 * Translations, on an instance of our own.
 *
 * The one thing that matters here: `i18next.createInstance()`, never the global singleton.
 * A library that grabs the singleton fights the host app over it — double initialisation,
 * clobbered namespaces, and the editor's language flipping when the app changes its own.
 * An isolated instance under the `mailDesigner` namespace has no such interaction.
 *
 * A consumer who does not care about i18next never has to touch it: pass `locale` for one
 * of the built-in languages, or `strings` to override individual labels.
 */

export const sv = {
  "block.section": "Sektion",
  "block.heading": "Rubrik",
  "block.text": "Text",
  "block.image": "Bild",
  "block.button": "Knapp",
  "block.columns": "Kolumner",
  "block.social": "Sociala länkar",
  "block.divider": "Avdelare",
  "block.spacer": "Mellanrum",
  "block.html": "HTML",

  "palette.title": "Block",
  "palette.hint": "Dra in ett block, eller klicka för att lägga till sist.",

  "canvas.empty": "Tomt mejl",
  "canvas.emptyHint": "Lägg till ett block från paletten till vänster.",
  "canvas.emptySection": "Tom sektion",
  "canvas.imagePlaceholder": "Ingen bild vald",
  "canvas.addSection": "Lägg till sektion",

  "inspector.title": "Egenskaper",
  "inspector.nothing": "Inget markerat",
  "inspector.nothingHint": "Klicka på ett block i mejlet för att ändra det.",
  "inspector.mail": "Mejlet",
  "inspector.block": "Block",

  "field.width": "Bredd",
  "field.backgroundColor": "Bakgrund",
  "field.contentBackgroundColor": "Innehållets bakgrund",
  "field.fontFamily": "Typsnitt",
  "field.fontSize": "Textstorlek",
  "field.lineHeight": "Radavstånd",
  "field.textColor": "Textfärg",
  "field.linkColor": "Länkfärg",
  "field.preheader": "Förhandsvisningstext",
  "field.preheaderHint": "Visas efter ämnesraden i inkorgen. Lämnas den tom visas början av brödtexten.",
  "field.padding": "Marginal",
  "field.paddingLinked": "Lås alla sidor",
  "field.align": "Justering",
  "field.color": "Färg",
  "field.level": "Nivå",
  "field.src": "Bildadress",
  "field.alt": "Alt-text",
  "field.altHint": "Beskriv bilden. Visas när bilder är blockerade — vilket de är som standard i många klienter.",
  "field.href": "Länk",
  "field.label": "Text",
  "field.borderRadius": "Hörnradie",
  "field.innerPadding": "Innermarginal",
  "field.buttonWidth": "Knappbredd",
  "field.buttonWidthHint": "Rundade hörn i Outlook kräver en bestämd bredd. Utan bredd blir knappen rak i Outlook, rundad i övriga.",
  "field.fullWidth": "Full bredd",
  "field.fullWidthSection": "Bakgrund i hela bredden",
  "field.thickness": "Tjocklek",
  "field.height": "Höjd",
  "field.gap": "Mellanrum",
  "field.stackOnMobile": "Stapla på mobil",
  "field.columnCount": "Antal kolumner",
  "field.html": "HTML",
  "field.auto": "Auto",
  "field.upload": "Ladda upp",
  "field.uploading": "Laddar upp …",

  "align.left": "Vänster",
  "align.center": "Mitten",
  "align.right": "Höger",

  "toolbar.undo": "Ångra",
  "toolbar.redo": "Gör om",
  "toolbar.desktop": "Dator",
  "toolbar.mobile": "Mobil",
  "toolbar.edit": "Redigera",
  "toolbar.preview": "Förhandsvisa",
  "toolbar.templates": "Mallar",
  "toolbar.save": "Spara mall",
  "toolbar.mailSettings": "Mejlets utseende",

  "action.delete": "Ta bort",
  "action.duplicate": "Duplicera",
  "action.moveUp": "Flytta upp",
  "action.moveDown": "Flytta ner",
  "action.add": "Lägg till",
  "action.close": "Stäng",
  "action.cancel": "Avbryt",
  "action.confirm": "Bekräfta",

  "text.bold": "Fet",
  "text.italic": "Kursiv",
  "text.underline": "Understruken",
  "text.link": "Länk",
  "text.unlink": "Ta bort länk",
  "text.color": "Textfärg",
  "text.mergeField": "Merge-fält",
  "text.linkPrompt": "Adress",

  "merge.title": "Merge-fält",
  "merge.hint": "Sätts in som [Fält] och ersätts per mottagare.",
  "merge.none": "Inga merge-fält angivna.",

  "templates.title": "Mallar",
  "templates.empty": "Inga sparade mallar.",
  "templates.presets": "Startmallar",
  "templates.saved": "Sparade",
  "templates.namePrompt": "Namn på mallen",
  "templates.replaceWarning": "Det här ersätter innehållet i mejlet.",
  "templates.loadError": "Kunde inte hämta mallarna.",
  "templates.saveError": "Kunde inte spara mallen.",
};

export const en: Record<keyof typeof sv, string> = {
  "block.section": "Section",
  "block.heading": "Heading",
  "block.text": "Text",
  "block.image": "Image",
  "block.button": "Button",
  "block.columns": "Columns",
  "block.social": "Social links",
  "block.divider": "Divider",
  "block.spacer": "Spacer",
  "block.html": "HTML",

  "palette.title": "Blocks",
  "palette.hint": "Drag a block in, or click to append it.",

  "canvas.empty": "Empty email",
  "canvas.emptyHint": "Add a block from the palette on the left.",
  "canvas.emptySection": "Empty section",
  "canvas.imagePlaceholder": "No image selected",
  "canvas.addSection": "Add section",

  "inspector.title": "Properties",
  "inspector.nothing": "Nothing selected",
  "inspector.nothingHint": "Click a block in the email to edit it.",
  "inspector.mail": "Email",
  "inspector.block": "Block",

  "field.width": "Width",
  "field.backgroundColor": "Background",
  "field.contentBackgroundColor": "Content background",
  "field.fontFamily": "Font",
  "field.fontSize": "Text size",
  "field.lineHeight": "Line height",
  "field.textColor": "Text colour",
  "field.linkColor": "Link colour",
  "field.preheader": "Preview text",
  "field.preheaderHint": "Shown after the subject line in the inbox. Left empty, clients show the start of the body.",
  "field.padding": "Padding",
  "field.paddingLinked": "Lock all sides",
  "field.align": "Alignment",
  "field.color": "Colour",
  "field.level": "Level",
  "field.src": "Image URL",
  "field.alt": "Alt text",
  "field.altHint": "Describe the image. Shown when images are blocked — which they are by default in many clients.",
  "field.href": "Link",
  "field.label": "Label",
  "field.borderRadius": "Corner radius",
  "field.innerPadding": "Inner padding",
  "field.buttonWidth": "Button width",
  "field.buttonWidthHint": "Rounded corners in Outlook need a fixed width. Without one the button is square in Outlook and rounded elsewhere.",
  "field.fullWidth": "Full width",
  "field.fullWidthSection": "Background spans full width",
  "field.thickness": "Thickness",
  "field.height": "Height",
  "field.gap": "Gap",
  "field.stackOnMobile": "Stack on mobile",
  "field.columnCount": "Columns",
  "field.html": "HTML",
  "field.auto": "Auto",
  "field.upload": "Upload",
  "field.uploading": "Uploading …",

  "align.left": "Left",
  "align.center": "Center",
  "align.right": "Right",

  "toolbar.undo": "Undo",
  "toolbar.redo": "Redo",
  "toolbar.desktop": "Desktop",
  "toolbar.mobile": "Mobile",
  "toolbar.edit": "Edit",
  "toolbar.preview": "Preview",
  "toolbar.templates": "Templates",
  "toolbar.save": "Save template",
  "toolbar.mailSettings": "Email appearance",

  "action.delete": "Delete",
  "action.duplicate": "Duplicate",
  "action.moveUp": "Move up",
  "action.moveDown": "Move down",
  "action.add": "Add",
  "action.close": "Close",
  "action.cancel": "Cancel",
  "action.confirm": "Confirm",

  "text.bold": "Bold",
  "text.italic": "Italic",
  "text.underline": "Underline",
  "text.link": "Link",
  "text.unlink": "Remove link",
  "text.color": "Text colour",
  "text.mergeField": "Merge field",
  "text.linkPrompt": "URL",

  "merge.title": "Merge fields",
  "merge.hint": "Inserted as [Field] and replaced per recipient.",
  "merge.none": "No merge fields provided.",

  "templates.title": "Templates",
  "templates.empty": "No saved templates.",
  "templates.presets": "Starting points",
  "templates.saved": "Saved",
  "templates.namePrompt": "Template name",
  "templates.replaceWarning": "This replaces the contents of the email.",
  "templates.loadError": "Could not load templates.",
  "templates.saveError": "Could not save the template.",
};

export type StringKey = keyof typeof sv;
export type Strings = Partial<Record<StringKey, string>>;
export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

const NAMESPACE = "mailDesigner";

export function createI18n(locale: Locale, overrides?: Strings): I18nInstance {
  const instance = i18next.createInstance();
  // initImmediate: false keeps init synchronous, so the first render already has strings
  // and nothing flashes an untranslated key.
  void instance.init({
    lng: locale,
    fallbackLng: "en",
    ns: [NAMESPACE],
    defaultNS: NAMESPACE,
    // Our keys contain dots ("field.width"); without this i18next would read them as nesting.
    keySeparator: false,
    nsSeparator: false,
    initImmediate: false,
    resources: {
      sv: { [NAMESPACE]: { ...sv, ...(locale === "sv" ? overrides : undefined) } },
      en: { [NAMESPACE]: { ...en, ...(locale === "en" ? overrides : undefined) } },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
}

export function createTranslate(instance: I18nInstance): Translate {
  return (key, vars) => instance.t(key, vars ?? {}) as string;
}
