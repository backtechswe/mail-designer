import type { CSSProperties, ReactNode } from "react";
import type { MailDocument } from "../types.js";
import type { Viewport } from "./Toolbar.js";
import { useEditor } from "./EditorContext.js";
import { messageSummary } from "./message.js";
import { Icon } from "./icons.js";

/**
 * The mail client around the preview.
 *
 * Without it the preview answers the wrong question. A mail is never opened full-screen on a
 * blank page: on a phone a status bar, a nav bar and a toolbar take about 180 of 852 points
 * before the body starts, and on a desktop the reading pane is a fraction of the window. The
 * chrome is what makes "above the fold" mean anything, and the list column is the only place
 * an editor can show what the preheader is actually for.
 *
 * Deliberately generic: the parts every client has, in no client's brand. Colours come from
 * --md-client-* so an integrator can match their own product if they want to.
 */
export function MailClient({
  viewport,
  doc,
  identity,
  children,
}: {
  viewport: Viewport;
  doc: MailDocument;
  identity: { name: string; email: string; date: string };
  children: ReactNode;
}) {
  const { t } = useEditor();
  const summary = messageSummary(doc);
  const subject = summary.subject || t("client.noSubject");
  const initial = identity.name.trim().charAt(0).toUpperCase() || "A";

  /* The mail's own page colour continues behind it, as it does in a real client. */
  const body: CSSProperties = { background: doc.settings.backgroundColor };

  const header = (compact: boolean): ReactNode => (
    <div className={compact ? "md-msg md-msg--compact" : "md-msg"} style={body}>
      <div className="md-msg-avatar" aria-hidden="true">
        {initial}
      </div>
      <div className="md-msg-lines">
        {/* Subject first and loudest: that is the line the reader's eye lands on. */}
        <div className="md-msg-top">
          <span className="md-msg-subject">{subject}</span>
          <span className="md-msg-date">{identity.date}</span>
        </div>
        <div className="md-msg-from">
          {identity.name}
          {compact ? null : <span className="md-msg-email">{identity.email}</span>}
        </div>
        <div className="md-msg-to">{t("client.toMe")}</div>
      </div>
    </div>
  );

  if (viewport === "desktop") {
    const folders = [
      ["inbox", "client.inbox"],
      ["sent", "client.sent"],
      ["drafts", "client.drafts"],
      ["archive", "client.archive"],
      ["trash", "client.trash"],
    ] as const;

    return (
      <div className="md-client md-client--desktop">
        <div className="md-client-titlebar">
          <span className="md-client-dot" />
          <span className="md-client-dot" />
          <span className="md-client-dot" />
          <div className="md-client-search">
            <Icon name="search" size={11} />
            <span>{t("client.search")}</span>
          </div>
        </div>

        <div className="md-client-columns">
          <nav className="md-client-folders">
            {folders.map(([icon, label], index) => (
              <div
                key={icon}
                className={index === 0 ? "md-client-folder is-current" : "md-client-folder"}
              >
                <Icon name={icon} size={12} />
                <span>{t(label)}</span>
                {index === 0 ? <em>12</em> : null}
              </div>
            ))}
          </nav>

          <div className="md-client-list">
            <div className="md-client-list-head">{t("client.inbox")}</div>
            {/*
              The selected row is the real mail; the rest are placeholder bars rather than
              invented messages. A mock that puts fake text in an inbox invites reading it.
            */}
            <div className="md-client-row is-current">
              <div className="md-client-row-top">
                <span className="md-client-row-from">{identity.name}</span>
                <span className="md-client-row-date">{t("client.time")}</span>
              </div>
              <div className="md-client-row-subject">{subject}</div>
              <div
                className={
                  summary.snippetIsFallback
                    ? "md-client-row-snippet is-fallback"
                    : "md-client-row-snippet"
                }
                title={summary.snippetIsFallback ? t("client.snippetFallback") : undefined}
              >
                {summary.snippet}
              </div>
            </div>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="md-client-row is-blank" aria-hidden="true">
                <span style={{ width: "38%" }} />
                <span style={{ width: "72%" }} />
                <span style={{ width: "58%" }} />
              </div>
            ))}
          </div>

          <div className="md-client-reading">
            <div className="md-client-actions">
              {(["archive", "trash", "flag", "reply", "replyAll", "forward"] as const).map(
                (icon) => (
                  <span key={icon} className="md-client-action">
                    <Icon name={icon} size={12} />
                  </span>
                ),
              )}
              <span className="md-client-action md-client-action--end">
                <Icon name="ellipsis" size={12} />
              </span>
            </div>
            <div className="md-device-viewport" style={body}>
              {header(false)}
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = (
    <div className="md-ios-status">
      <span className="md-ios-time">{t("client.time")}</span>
      <span className="md-ios-icons">
        <Icon name="signal" size={11} />
        <Icon name="wifi" size={11} />
        <Icon name="battery" size={13} />
      </span>
    </div>
  );

  if (viewport === "tablet") {
    return (
      <div className="md-client md-client--tablet">
        {status}
        <div className="md-ios-nav">
          <span className="md-ios-back">
            <Icon name="sidebar" size={13} />
          </span>
          <span className="md-ios-nav-actions">
            {(["flag", "archive", "trash", "reply", "compose"] as const).map((icon) => (
              <Icon key={icon} name={icon} size={13} />
            ))}
          </span>
        </div>
        <div className="md-device-viewport" style={body}>
          {header(false)}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="md-client md-client--phone">
      {status}
      <div className="md-ios-nav">
        <span className="md-ios-back">
          <Icon name="left" size={12} />
          <span>{t("client.inbox")}</span>
        </span>
        <span className="md-ios-nav-actions">
          <Icon name="up" size={12} />
          <Icon name="down" size={12} />
        </span>
      </div>
      <div className="md-device-viewport" style={body}>
        {header(true)}
        {children}
      </div>
      <div className="md-ios-toolbar">
        {(["flag", "folder", "trash", "reply", "compose"] as const).map((icon) => (
          <Icon key={icon} name={icon} size={15} />
        ))}
      </div>
    </div>
  );
}
