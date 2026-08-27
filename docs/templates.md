# Saving and reusing templates

The package contains **no database**. A template is a name plus a JSON document, and every
application already has somewhere to put that. So the package defines a contract and ships
the adapters that need no dependencies — the rest is ten lines in your app.

## The contract

```ts
interface TemplateStore {
  list(): Promise<MailTemplateSummary[]>;         // required
  load(id: string): Promise<MailTemplate | null>; // required
  save(input: SaveTemplateInput): Promise<MailTemplate>; // required
  remove?(id: string): Promise<void>;             // optional
  rename?(id: string, name: string): Promise<MailTemplate>; // optional
}
```

`remove` and `rename` are optional on purpose: leave them out and the editor hides the
matching buttons, which makes a **read-only catalogue of company templates** a perfectly
valid store.

The data model:

```ts
interface MailTemplate {
  id: string;
  name: string;
  document: MailDocument;   // see ../schema/mail-document.v1.json
  createdAt?: string;       // ISO 8601 — a string, not a Date, so it survives JSON
  updatedAt?: string;
  meta?: Record<string, unknown>;  // ownerId, tags, thumbnail URL … your call
}
```

`list()` returns `MailTemplateSummary` — the same thing **without** `document`. That is not
cosmetic: a catalogue of a hundred templates should list without pulling down a hundred
document trees.

## Adapters in the package

| Adapter | When |
|---|---|
| `createMemoryTemplateStore(seed?)` | Playground, tests, and the reference implementation to read while writing your own |
| `createLocalStorageTemplateStore({ key?, storage? })` | Single-user tools and demos. Honest limits: never leaves the device, disappears when the browser is cleared, a few MB of quota |
| `createRestTemplateStore({ baseUrl, fetch?, headers? })` | **The bridge to any backend** — Node, ASP.NET, PHP, whatever you run |

## The REST contract

`createRestTemplateStore` speaks five endpoints. Build them in your backend and the editor
works, whatever language they are written in.

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `{baseUrl}` | — | `MailTemplateSummary[]` |
| `GET` | `{baseUrl}/{id}` | — | `MailTemplate`, or `404` |
| `POST` | `{baseUrl}` | `{ name, document, meta? }` | `MailTemplate` with the server's new `id` |
| `PUT` | `{baseUrl}/{id}` | `{ name, document, meta? }` | `MailTemplate` |
| `DELETE` | `{baseUrl}/{id}` | — | `204` |

Two details that are easy to miss:

- **`404` means "does not exist", not "error".** `load()` returns `null`. Anything other than
  `2xx`/`404` throws, so a broken API is visible instead of looking like an empty list.
- **`POST` never sends an `id`.** The server owns id generation.

```ts
const store = createRestTemplateStore({
  baseUrl: "/api/mail-templates",
  headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
});
```

## Firestore

This cannot live in the package — it would pull in all of `firebase`. It is twenty lines at
your end:

```ts
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, type Firestore,
} from "firebase/firestore";
import { parseTemplate, assertSavable, type TemplateStore } from "@backtech/mail-designer";

export function createFirestoreTemplateStore(db: Firestore, ownerUid: string): TemplateStore {
  const col = collection(db, "mailTemplates");
  const toRow = (id: string, data: any) =>
    parseTemplate({
      id,
      name: data.name,
      document: data.document,
      // Firestore Timestamps have to become ISO strings; the contract is JSON.
      createdAt: data.createdAt?.toDate?.().toISOString(),
      updatedAt: data.updatedAt?.toDate?.().toISOString(),
      meta: data.meta,
    });

  return {
    async list() {
      const snap = await getDocs(
        query(col, where("ownerUid", "==", ownerUid), orderBy("updatedAt", "desc")),
      );
      return snap.docs
        .map((d) => toRow(d.id, d.data()))
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .map(({ document, ...summary }) => summary);
    },
    async load(id) {
      const snap = await getDoc(doc(col, id));
      return snap.exists() ? toRow(snap.id, snap.data()) : null;
    },
    async save(input) {
      assertSavable(input);
      const payload = {
        ownerUid,
        name: input.name.trim(),
        document: input.document,
        meta: input.meta ?? null,
        updatedAt: serverTimestamp(),
      };
      if (input.id) {
        await setDoc(doc(col, input.id), payload, { merge: true });
        return (await this.load(input.id))!;
      }
      const ref = await addDoc(col, { ...payload, createdAt: serverTimestamp() });
      return (await this.load(ref.id))!;
    },
    async remove(id) {
      await deleteDoc(doc(col, id));
    },
  };
}
```

Three things to do in Firestore beyond the code:

1. **Rules.** A document can get large; let only the owner write.
   ```
   match /mailTemplates/{id} {
     allow read:   if request.auth != null && resource.data.ownerUid == request.auth.uid;
     allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
     allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
   }
   ```
2. **An index** on `(ownerUid ASC, updatedAt DESC)` — without it `list()` does not work.
3. **The 1 MiB document limit.** An email with many blocks and long text comes nowhere near
   it, but embedding images as `data:` URIs will. Upload images to Storage and save the URL —
   which you need to do anyway, since Gmail blocks `data:` images.

## Sending a saved template

The template stores the document, not HTML. Render at send time, once per recipient:

```ts
import { toHtml } from "@backtech/mail-designer/render";

const template = await store.load(templateId);
for (const recipient of recipients) {
  const { html, text } = toHtml(template.document, {
    data: { Name: recipient.name, City: recipient.city },
  });
  await sendEmail({ to: recipient.email, subject, html, text });
}
```

`extractDataFields(document)` tells you which columns the template needs, including the ones
hiding in a button URL — exactly the ones you forget you depend on.

Storing the rendered HTML alongside the send is still worth doing: it lets you show exactly
what went out, even after the template has changed.
