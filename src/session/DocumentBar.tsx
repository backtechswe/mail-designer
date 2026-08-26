import { useEffect, useRef, useState } from "react";
import type { DocumentSession } from "./useDocumentSession.js";
import { useEditor } from "../editor/EditorContext.js";
import { Icon } from "../editor/icons.js";
import { useSlot } from "../editor/customise.js";

/**
 * Which document is open, whether it is saved, and how to get to another one.
 *
 * Its own strip above the toolbar, because it answers a different question. The toolbar is
 * about what to do with the mail in front of you; this is about which mail that is. Mixing
 * the two would put "switch to another document" next to "undo", and those should never be
 * one slip apart.
 */
export function DocumentBar({
  session,
  onOpen,
  onNew,
  onDelete,
  onReset,
  canManage = true,
}: {
  session: DocumentSession;
  /** Routed through MailDesigner so the unsaved-work prompt can intervene. */
  onOpen: (id: string, name: string) => void;
  onNew: () => void;
  onDelete: (id: string, name: string) => void;
  /** Present when the host gave a default document to fall back to. */
  onReset?: () => void;
  /**
   * False hides creating and deleting. Which documents exist is the store's business — it
   * can return exactly the two an application wants edited — and this decides whether the
   * user may add to or remove from that set.
   */
  canManage?: boolean;
}) {
  const { t } = useEditor();
  const slot = useSlot();
  const { status } = session;
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const savedTime = status.savedAt
    ? new Date(status.savedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={slot("documentBar", "md-docbar")}>
      {/* The name is the document's identity, so it is edited in place rather than behind a
          rename dialog. */}
      <input
        type="text"
        className="md-docname"
        value={draftName ?? status.name}
        aria-label={t("session.name")}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={() => {
          if (draftName !== null && draftName.trim() && draftName !== status.name) {
            session.rename(draftName.trim());
          }
          setDraftName(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraftName(null);
            e.currentTarget.blur();
          }
        }}
      />

      <SaveStatus session={session} savedTime={savedTime} />

      <div className="md-docbar-spacer" />

      {onReset ? (
        <button type="button" className="md-docbar-reset" onClick={onReset}>
          <Icon name="undo" size={11} />
          {t("session.reset")}
        </button>
      ) : null}

      <div className="md-menu" ref={root}>
        <button type="button" className="md-menu-trigger" onClick={() => setOpen((v) => !v)}>
          <Icon name="templates" size={13} />
          {t("session.documents")}
          <Icon name={open ? "up" : "down"} size={10} />
        </button>

        {open ? (
          <div className="md-menu-panel" role="menu">
            {canManage ? (
              <button
                type="button"
                className="md-secondary-button"
                onClick={() => {
                  setOpen(false);
                  onNew();
                }}
              >
                <Icon name="plus" size={11} />
                {t("session.newDocument")}
              </button>
            ) : null}

            {session.documents.length === 0 ? (
              <p className="md-menu-empty">{t("session.noDocuments")}</p>
            ) : (
              <ul>
                {session.documents.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={row.id === status.id}
                      title={row.id === status.id ? t("session.current") : undefined}
                      onClick={() => {
                        setOpen(false);
                        onOpen(row.id, row.name);
                      }}
                    >
                      {row.name}
                      {row.id === status.id ? <span className="md-menu-tick">•</span> : null}
                    </button>
                    {canManage ? (
                      <button
                        type="button"
                        className="md-icon-button md-danger"
                        title={t("confirm.deleteDocumentOk")}
                        onClick={() => {
                          setOpen(false);
                          onDelete(row.id, row.name);
                        }}
                      >
                        <Icon name="trash" size={11} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SaveStatus({
  session,
  savedTime,
}: {
  session: DocumentSession;
  savedTime: string;
}) {
  const { t } = useEditor();
  const { status } = session;

  if (status.state === "error") {
    return (
      <span className="md-savestate md-savestate--error">
        {t("session.error")}
        <button type="button" onClick={() => void session.saveNow()}>
          {t("session.retry")}
        </button>
      </span>
    );
  }
  if (status.state === "saving") {
    return <span className="md-savestate">{t("session.saving")}</span>;
  }
  if (status.state === "dirty" || status.state === "new") {
    return <span className="md-savestate md-savestate--dirty">{t("session.dirty")}</span>;
  }
  return <span className="md-savestate">{t("session.saved", { time: savedTime })}</span>;
}
