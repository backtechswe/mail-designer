import { useRef, useState } from "react";
import type {
  Align,
  Block,
  ButtonBlock,
  ColumnsBlock,
  DividerBlock,
  HeadingBlock,
  HtmlBlock,
  ImageBlock,
  MailSettings,
  SectionBlock,
  SocialBlock,
  SpacerBlock,
  TextBlock,
} from "../types.js";
import { clearOverrides, countOverrides, createBlock, createColumn, findBlock } from "../document.js";
import type { InheritableProperty } from "../document.js";
import { HEADING_SIZE } from "../blocks/canvasStyle.js";
import { computeWidths } from "../render/html/columns.js";
import { useEditor } from "./EditorContext.js";
import { Icon } from "./icons.js";
import {
  AlignField,
  CheckboxField,
  ColorField,
  Field,
  FieldRow,
  NumberField,
  Section,
  SelectField,
  SpacingField,
  TextAreaField,
  TextField,
} from "./fields/index.js";
import type { Inherit } from "./fields/index.js";
import type { Translate } from "../i18n.js";

/**
 * The right-hand panel. Two tabs, because there are genuinely two subjects: the email as a
 * whole (what every block inherits) and the selected block. Mixing them into one scroll is
 * how these panels become unreadable.
 */
export function Inspector() {
  const { doc, selectedId, permissions, t } = useEditor();
  const [tab, setTab] = useState<"mail" | "block">("block");
  const found = selectedId ? findBlock(doc, selectedId) : undefined;
  const wanted = permissions.mailSettings ? tab : "block";
  const active = found && wanted === "block" ? "block" : wanted === "mail" ? "mail" : "block";

  return (
    <aside className="md-inspector">
      <div className="md-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === "block"}
          onClick={() => setTab("block")}
        >
          {t("inspector.block")}
        </button>
        {permissions.mailSettings ? (
          <button
            type="button"
            role="tab"
            aria-selected={active === "mail"}
            onClick={() => setTab("mail")}
          >
            {t("inspector.mail")}
          </button>
        ) : null}
      </div>

      <div className="md-inspector-body">
        <p className="md-inspector-hint">
          {active === "mail" ? t("inspector.mailHint") : t("inspector.blockHint")}
        </p>
        {active === "mail" ? (
          <MailSettingsPanel />
        ) : found ? (
          <BlockPanel block={found.block} />
        ) : (
          <div className="md-empty md-empty--panel">
            <strong>{t("inspector.nothing")}</strong>
            <span>{t("inspector.nothingHint")}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Web-safe stacks only. A webfont needs a <link> that Outlook ignores and Gmail strips, so
 * offering one would promise something the renderer cannot deliver.
 */
const FONT_STACKS = [
  "Helvetica, Arial, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Trebuchet MS', Tahoma, sans-serif",
  "Verdana, Geneva, sans-serif",
  "'Courier New', Courier, monospace",
];

const fontLabel = (stack: string): string => stack.split(",")[0]!.replace(/'/g, "");

/** Builds the marker that tells a field whether it is inheriting or overriding. */
function inherit(t: Translate, isSet: boolean, onClear: () => void): Inherit {
  return {
    isSet,
    onClear,
    labels: {
      inherited: t("field.inherited"),
      overridden: t("field.overridden"),
      reset: t("field.resetToInherited"),
    },
  };
}

/**
 * Font picker for a single block. The first option clears the override rather than setting
 * a font — that is the only way back to following the email once you have left it.
 */
function BlockFontField({
  value,
  inheritedFrom,
  onChange,
}: {
  value: string | undefined;
  inheritedFrom: string;
  onChange: (value: string | undefined) => void;
}) {
  const { t } = useEditor();
  return (
    <SelectField
      label={t("field.fontFamily")}
      value={value ?? ""}
      inherit={inherit(t, value !== undefined, () => onChange(undefined))}
      options={[
        { value: "", label: `${t("field.inheritFont")} (${fontLabel(inheritedFrom)})` },
        ...FONT_STACKS.map((stack) => ({ value: stack, label: fontLabel(stack) })),
      ]}
      onChange={(next) => onChange(next === "" ? undefined : next)}
    />
  );
}

/**
 * The way out when a global change appears to do nothing: name how many blocks are ignoring
 * this setting, and offer to make them stop. Without it the only route is selecting every
 * block that happens to carry an override and clearing them one at a time.
 */
function OverrideEscape({ property }: { property: InheritableProperty }) {
  const { doc, replaceDocument, t } = useEditor();
  const count = countOverrides(doc, property);
  if (count === 0) return null;
  return (
    <p className="md-override-escape">
      <span>
        {count === 1
          ? t("field.overrideCount_one")
          : t("field.overrideCount_other", { count })}
      </span>
      <button type="button" onClick={() => replaceDocument(clearOverrides(doc, property))}>
        {t("field.clearOverrides")}
      </button>
    </p>
  );
}

function MailSettingsPanel() {
  const { doc, updateSettings, t } = useEditor();
  const s = doc.settings;
  const patch = (next: Partial<MailSettings>): void => updateSettings(next);

  return (
    <>
      <Section title={t("toolbar.mailSettings")}>
        <FieldRow>
          <NumberField
            label={t("field.width")}
            value={s.width}
            min={320}
            max={900}
            step={20}
            onChange={(width) => patch({ width: width ?? 600 })}
          />
          <NumberField
            label={t("field.fontSize")}
            value={s.fontSize}
            min={10}
            max={32}
            onChange={(fontSize) => patch({ fontSize: fontSize ?? 16 })}
          />
        </FieldRow>
        <OverrideEscape property="fontSize" />
        <SelectField
          label={t("field.fontFamily")}
          value={s.fontFamily}
          options={FONT_STACKS.map((stack) => ({ value: stack, label: fontLabel(stack) }))}
          onChange={(fontFamily) => patch({ fontFamily })}
        />
        <OverrideEscape property="fontFamily" />
        <NumberField
          label={t("field.lineHeight")}
          value={s.lineHeight}
          min={1}
          max={2.5}
          step={0.05}
          suffix="×"
          onChange={(lineHeight) => patch({ lineHeight: lineHeight ?? 1.5 })}
        />
        <ColorField
          label={t("field.backgroundColor")}
          value={s.backgroundColor}
          onChange={(backgroundColor) => patch({ backgroundColor: backgroundColor ?? "#ffffff" })}
        />
        <ColorField
          label={t("field.contentBackgroundColor")}
          value={s.contentBackgroundColor}
          onChange={(v) => patch({ contentBackgroundColor: v ?? "#ffffff" })}
        />
        <ColorField
          label={t("field.textColor")}
          value={s.textColor}
          onChange={(textColor) => patch({ textColor: textColor ?? "#000000" })}
        />
        <OverrideEscape property="color" />
        <ColorField
          label={t("field.linkColor")}
          value={s.linkColor}
          onChange={(linkColor) => patch({ linkColor: linkColor ?? "#0000ee" })}
        />
        <TextAreaField
          label={t("field.preheader")}
          hint={t("field.preheaderHint")}
          rows={2}
          value={s.preheader ?? ""}
          onChange={(preheader) => patch({ preheader })}
        />
      </Section>
    </>
  );
}

function BlockPanel({ block }: { block: Block }) {
  const { update, capabilities, t } = useEditor();
  const caps = capabilities(block);
  const alignLabels: Record<Align, string> = {
    left: t("align.left"),
    center: t("align.center"),
    right: t("align.right"),
  };
  const set = (patch: Partial<Block>): void => update(block.id, patch);

  return (
    <>
      {caps.locked && !caps.editContent && !caps.editAppearance ? (
        <p className="md-inspector-hint">{t("locked.content")}</p>
      ) : null}

      <Section title={t(`block.${block.type}` as "block.text")}>
        {block.type === "section" ? <SectionFields block={block} /> : null}
        {block.type === "columns" ? <ColumnsFields block={block} /> : null}
        {block.type === "heading" ? <HeadingFields block={block} labels={alignLabels} /> : null}
        {block.type === "text" ? <TextFields block={block} labels={alignLabels} /> : null}
        {block.type === "image" ? <ImageFields block={block} labels={alignLabels} /> : null}
        {block.type === "button" ? <ButtonFields block={block} labels={alignLabels} /> : null}
        {block.type === "social" ? <SocialFields block={block} labels={alignLabels} /> : null}
        {block.type === "divider" ? <DividerFields block={block} labels={alignLabels} /> : null}
        {block.type === "spacer" ? <SpacerFields block={block} /> : null}
        {block.type === "html" ? <HtmlFields block={block} /> : null}
      </Section>

      {block.type === "spacer" || !caps.editAppearance ? null : (
        <Section title={t("field.padding")}>
          <SpacingField
            label={t("field.padding")}
            lockLabel={t("field.paddingLinked")}
            value={block.padding}
            onChange={(padding) => set({ padding })}
          />
        </Section>
      )}
    </>
  );
}

function SectionFields({ block }: { block: SectionBlock }) {
  const { doc, update, t } = useEditor();
  return (
    <>
      <ColorField
        label={t("field.backgroundColor")}
        value={block.backgroundColor}
        allowEmpty
        fallback={doc.settings.contentBackgroundColor}
        inherit={inherit(t, block.backgroundColor !== undefined, () =>
          update(block.id, { backgroundColor: undefined }),
        )}
        onChange={(backgroundColor) => update(block.id, { backgroundColor })}
      />
      <CheckboxField
        label={t("field.fullWidthSection")}
        checked={block.fullWidth ?? false}
        onChange={(fullWidth) => update(block.id, { fullWidth })}
      />
    </>
  );
}

/** Two is a pair, six is an icon row. Beyond that a 600px email has nothing left to give. */
const MAX_COLUMNS = 6;

function ColumnsFields({ block }: { block: ColumnsBlock }) {
  const { doc, update, updateColumn, t } = useEditor();
  const count = block.columns.length;

  // What the renderer will actually produce, so the panel shows the truth rather than the
  // numbers that were typed.
  const resolved = computeWidths(block.columns);
  const explicitTotal = block.columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
  const anyExplicit = block.columns.some((c) => c.width !== undefined);
  const approxPx = Math.round(
    (doc.settings.width - 80 - block.gap * (count - 1)) / Math.max(1, count),
  );

  const setCount = (next: number): void => {
    const columns = [...block.columns];
    // Growing adds a column with a text block in it; shrinking drops trailing ones. Widths
    // are cleared either way — kept ones would no longer add up to a sensible row.
    while (columns.length < next) columns.push(createColumn([createBlock("text") as TextBlock]));
    while (columns.length > next) columns.pop();
    update(block.id, {
      columns: columns.map(({ width: _width, ...rest }) => rest),
    } as Partial<ColumnsBlock>);
  };

  return (
    <>
      <SelectField
        label={t("field.columnCount")}
        value={count}
        options={Array.from({ length: MAX_COLUMNS - 1 }, (_, i) => ({
          value: i + 2,
          label: String(i + 2),
        }))}
        {...(count >= 4
          ? { hint: t("field.columnsNarrowHint", { count, px: approxPx }) }
          : {})}
        onChange={setCount}
      />

      {/*
        Widths behave like a table: give a column a percentage and it keeps it, leave one
        blank and it shares whatever is left. That mix is the useful part — "sidebar at 30%,
        the rest splits the remainder" is one number, not three.
      */}
      <Field
        label={t("field.columnWidths")}
        {...(anyExplicit && explicitTotal > 100
          ? { hint: t("field.columnsOverHint", { total: Math.round(explicitTotal) }) }
          : {})}
      >
        <span className="md-colwidths">
          {block.columns.map((column, index) => (
            <label key={column.id}>
              <span>{index + 1}</span>
              <input
                type="number"
                min={5}
                max={95}
                value={column.width ?? ""}
                placeholder={String(Math.round(resolved[index] ?? 0))}
                aria-label={t("field.columnLabel", { n: index + 1 })}
                title={
                  column.width === undefined
                    ? `${t("field.shared")} · ${Math.round(resolved[index] ?? 0)} %`
                    : undefined
                }
                onChange={(e) =>
                  updateColumn(column.id, {
                    width: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </span>
      </Field>

      {anyExplicit ? (
        <button
          type="button"
          className="md-secondary-button"
          onClick={() =>
            update(block.id, {
              columns: block.columns.map(({ width: _w, ...rest }) => rest),
            } as Partial<ColumnsBlock>)
          }
        >
          <Icon name="columns" size={11} />
          {t("field.equalWidths")}
        </button>
      ) : null}

      <NumberField
        label={t("field.gap")}
        value={block.gap}
        min={0}
        max={64}
        step={4}
        onChange={(gap) => update(block.id, { gap: gap ?? 0 })}
      />
      <CheckboxField
        label={t("field.stackOnMobile")}
        checked={block.stackOnMobile}
        onChange={(stackOnMobile) => update(block.id, { stackOnMobile })}
      />
    </>
  );
}

function HeadingFields({
  block,
  labels,
}: {
  block: HeadingBlock;
  labels: Record<Align, string>;
}) {
  const { doc, update, t } = useEditor();
  return (
    <>
      <SelectField
        label={t("field.level")}
        value={block.level}
        options={[1, 2, 3].map((n) => ({ value: n as 1 | 2 | 3, label: `H${n}` }))}
        onChange={(level) => update(block.id, { level })}
      />
      <AlignField
        label={t("field.align")}
        value={block.align}
        labels={labels}
        onChange={(align) => update(block.id, { align })}
      />
      <BlockFontField
        value={block.fontFamily}
        inheritedFrom={doc.settings.fontFamily}
        onChange={(fontFamily) => update(block.id, { fontFamily })}
      />
      <FieldRow>
        <NumberField
          label={t("field.fontSize")}
          value={block.fontSize}
          // The placeholder is the size this level actually renders at, so an empty field
          // still tells you what you are going to get.
          autoLabel={String(HEADING_SIZE[block.level])}
          inherit={inherit(t, block.fontSize !== undefined, () =>
            update(block.id, { fontSize: undefined }),
          )}
          min={10}
          max={64}
          onChange={(fontSize) => update(block.id, { fontSize })}
        />
        <ColorField
          label={t("field.color")}
          value={block.color}
          allowEmpty
          fallback={doc.settings.textColor}
          inherit={inherit(t, block.color !== undefined, () =>
            update(block.id, { color: undefined }),
          )}
          onChange={(color) => update(block.id, { color })}
        />
      </FieldRow>
    </>
  );
}

function TextFields({ block, labels }: { block: TextBlock; labels: Record<Align, string> }) {
  const { doc, update, t } = useEditor();
  return (
    <>
      <AlignField
        label={t("field.align")}
        value={block.align}
        labels={labels}
        onChange={(align) => update(block.id, { align })}
      />
      <BlockFontField
        value={block.fontFamily}
        inheritedFrom={doc.settings.fontFamily}
        onChange={(fontFamily) => update(block.id, { fontFamily })}
      />
      <FieldRow>
        <NumberField
          label={t("field.fontSize")}
          value={block.fontSize}
          autoLabel={String(doc.settings.fontSize)}
          inherit={inherit(t, block.fontSize !== undefined, () =>
            update(block.id, { fontSize: undefined }),
          )}
          min={10}
          max={48}
          onChange={(fontSize) => update(block.id, { fontSize })}
        />
        <ColorField
          label={t("field.color")}
          value={block.color}
          allowEmpty
          fallback={doc.settings.textColor}
          inherit={inherit(t, block.color !== undefined, () =>
            update(block.id, { color: undefined }),
          )}
          onChange={(color) => update(block.id, { color })}
        />
      </FieldRow>
      <NumberField
        label={t("field.lineHeight")}
        value={block.lineHeight}
        autoLabel={String(doc.settings.lineHeight)}
        inherit={inherit(t, block.lineHeight !== undefined, () =>
          update(block.id, { lineHeight: undefined }),
        )}
        min={1}
        max={2.5}
        step={0.05}
        suffix="×"
        onChange={(lineHeight) => update(block.id, { lineHeight })}
      />
    </>
  );
}

function ImageFields({ block, labels }: { block: ImageBlock; labels: Record<Align, string> }) {
  const { update, onUploadImage, capabilities, t } = useEditor();
  const caps = capabilities(block);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {caps.editContent ? (
        <TextField
          label={t("field.src")}
          value={block.src}
          placeholder="https://"
          onChange={(src) => update(block.id, { src })}
        />
      ) : null}
      {onUploadImage && caps.editContent ? (
        <Field label={t("field.upload")} hint={error ?? undefined}>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError(null);
              try {
                const url = await onUploadImage(file);
                update(block.id, { src: url });
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setUploading(false);
                if (fileInput.current) fileInput.current.value = "";
              }
            }}
          />
          {uploading ? <span className="md-field-hint">{t("field.uploading")}</span> : null}
        </Field>
      ) : null}
      {caps.editContent ? (
        <>
          <TextField
            label={t("field.alt")}
            hint={t("field.altHint")}
            value={block.alt}
            onChange={(alt) => update(block.id, { alt })}
          />
          <TextField
            label={t("field.href")}
            value={block.href ?? ""}
            placeholder="https://"
            onChange={(href) => update(block.id, { href: href || undefined })}
          />
        </>
      ) : null}
      <AlignField
        label={t("field.align")}
        value={block.align}
        labels={labels}
        onChange={(align) => update(block.id, { align })}
      />
      <FieldRow>
        <NumberField
          label={t("field.width")}
          value={block.width}
          autoLabel={t("field.auto")}
          min={16}
          max={900}
          onChange={(width) => update(block.id, { width })}
        />
        <NumberField
          label={t("field.borderRadius")}
          value={block.borderRadius}
          autoLabel="0"
          min={0}
          max={64}
          onChange={(borderRadius) => update(block.id, { borderRadius })}
        />
      </FieldRow>
    </>
  );
}

function ButtonFields({ block, labels }: { block: ButtonBlock; labels: Record<Align, string> }) {
  const { doc, update, capabilities, t } = useEditor();
  const caps = capabilities(block);
  return (
    <>
      {caps.editContent ? (
        <>
          <TextField
            label={t("field.label")}
            value={block.label}
            onChange={(label) => update(block.id, { label })}
          />
          <TextField
            label={t("field.href")}
            value={block.href}
            placeholder="https://"
            onChange={(href) => update(block.id, { href })}
          />
        </>
      ) : null}
      <FieldRow>
        <ColorField
          label={t("field.backgroundColor")}
          value={block.backgroundColor}
          onChange={(backgroundColor) =>
            update(block.id, { backgroundColor: backgroundColor ?? "#2f54eb" })
          }
        />
        <ColorField
          label={t("field.color")}
          value={block.textColor}
          onChange={(textColor) => update(block.id, { textColor: textColor ?? "#ffffff" })}
        />
      </FieldRow>
      <FieldRow>
        <NumberField
          label={t("field.borderRadius")}
          value={block.borderRadius}
          min={0}
          max={48}
          onChange={(borderRadius) => update(block.id, { borderRadius: borderRadius ?? 0 })}
        />
        <NumberField
          label={t("field.fontSize")}
          value={block.fontSize}
          min={10}
          max={32}
          onChange={(fontSize) => update(block.id, { fontSize: fontSize ?? 16 })}
        />
      </FieldRow>
      <BlockFontField
        value={block.fontFamily}
        inheritedFrom={doc.settings.fontFamily}
        onChange={(fontFamily) => update(block.id, { fontFamily })}
      />
      <SpacingField
        label={t("field.innerPadding")}
        lockLabel={t("field.paddingLinked")}
        value={block.innerPadding}
        onChange={(innerPadding) => update(block.id, { innerPadding })}
      />
      <NumberField
        label={t("field.buttonWidth")}
        hint={t("field.buttonWidthHint")}
        value={block.width}
        autoLabel={t("field.auto")}
        min={40}
        max={600}
        onChange={(width) => update(block.id, { width })}
      />
      <CheckboxField
        label={t("field.fullWidth")}
        checked={block.fullWidth ?? false}
        onChange={(fullWidth) => update(block.id, { fullWidth })}
      />
      <AlignField
        label={t("field.align")}
        value={block.align}
        labels={labels}
        onChange={(align) => update(block.id, { align })}
      />
    </>
  );
}

function SocialFields({ block, labels }: { block: SocialBlock; labels: Record<Align, string> }) {
  const { update, resolveSocialIcon, t } = useEditor();
  return (
    <>
      <div className="md-social-items">
        {block.items.map((item, index) => (
          <div className="md-social-item" key={`${item.network}-${index}`}>
            <input
              type="text"
              value={item.network}
              placeholder="facebook"
              onChange={(e) => {
                const network = e.target.value;
                const items = [...block.items];
                items[index] = {
                  ...item,
                  network,
                  // Re-resolve the icon only while the host owns it, so a URL the user
                  // typed by hand is never overwritten.
                  ...(resolveSocialIcon ? { iconUrl: resolveSocialIcon(network) } : {}),
                };
                update(block.id, { items });
              }}
            />
            <input
              type="text"
              value={item.href}
              placeholder="https://"
              onChange={(e) => {
                const items = [...block.items];
                items[index] = { ...item, href: e.target.value };
                update(block.id, { items });
              }}
            />
            <input
              type="text"
              value={item.iconUrl}
              placeholder="https://…/icon.png"
              onChange={(e) => {
                const items = [...block.items];
                items[index] = { ...item, iconUrl: e.target.value };
                update(block.id, { items });
              }}
            />
            <button
              type="button"
              className="md-icon-button md-danger"
              title={t("action.delete")}
              onClick={() =>
                update(block.id, { items: block.items.filter((_, i) => i !== index) })
              }
            >
              <Icon name="trash" size={11} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="md-secondary-button"
        onClick={() =>
          update(block.id, {
            items: [
              ...block.items,
              {
                network: "facebook",
                href: "https://",
                iconUrl: resolveSocialIcon ? resolveSocialIcon("facebook") : "",
              },
            ],
          })
        }
      >
        <Icon name="plus" size={11} />
        {t("action.add")}
      </button>
      <FieldRow>
        <NumberField
          label={t("field.height")}
          value={block.iconSize}
          min={12}
          max={64}
          onChange={(iconSize) => update(block.id, { iconSize: iconSize ?? 24 })}
        />
        <NumberField
          label={t("field.gap")}
          value={block.spacing}
          min={0}
          max={40}
          onChange={(spacing) => update(block.id, { spacing: spacing ?? 8 })}
        />
      </FieldRow>
      <AlignField
        label={t("field.align")}
        value={block.align}
        labels={labels}
        onChange={(align) => update(block.id, { align })}
      />
    </>
  );
}

function DividerFields({ block, labels }: { block: DividerBlock; labels: Record<Align, string> }) {
  const { update, t } = useEditor();
  return (
    <>
      <ColorField
        label={t("field.color")}
        value={block.color}
        onChange={(color) => update(block.id, { color: color ?? "#e5e5e5" })}
      />
      <FieldRow>
        <NumberField
          label={t("field.thickness")}
          value={block.thickness}
          min={1}
          max={12}
          onChange={(thickness) => update(block.id, { thickness: thickness ?? 1 })}
        />
        <NumberField
          label={t("field.width")}
          value={block.width}
          min={10}
          max={100}
          suffix="%"
          onChange={(width) => update(block.id, { width: width ?? 100 })}
        />
      </FieldRow>
      <AlignField
        label={t("field.align")}
        value={block.align}
        labels={labels}
        onChange={(align) => update(block.id, { align })}
      />
    </>
  );
}

function SpacerFields({ block }: { block: SpacerBlock }) {
  const { update, t } = useEditor();
  return (
    <NumberField
      label={t("field.height")}
      value={block.height}
      min={1}
      max={200}
      step={4}
      onChange={(height) => update(block.id, { height: height ?? 24 })}
    />
  );
}

function HtmlFields({ block }: { block: HtmlBlock }) {
  const { update, capabilities, t } = useEditor();
  if (!capabilities(block).editContent) return null;
  return (
    <TextAreaField
      label={t("field.html")}
      rows={10}
      mono
      value={block.html}
      onChange={(html) => update(block.id, { html })}
    />
  );
}
