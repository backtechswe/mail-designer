# Att spara och återanvända mallar

Paketet innehåller **ingen databas**. En mall är ett namn plus ett JSON-dokument, och varje
app har redan någonstans att lägga det. Därför definierar paketet ett kontrakt och levererar
de adaptrar som inte kräver några beroenden — resten är tio rader i din app.

## Kontraktet

```ts
interface TemplateStore {
  list(): Promise<MailTemplateSummary[]>;         // krävs
  load(id: string): Promise<MailTemplate | null>; // krävs
  save(input: SaveTemplateInput): Promise<MailTemplate>; // krävs
  remove?(id: string): Promise<void>;             // valfri
  rename?(id: string, name: string): Promise<MailTemplate>; // valfri
}
```

`remove` och `rename` är valfria med flit: utelämnar du dem gömmer redigeraren
motsvarande knappar, så en **läsbar katalog av företagsmallar** är en fullt giltig store.

Datamodellen:

```ts
interface MailTemplate {
  id: string;
  name: string;
  document: MailDocument;   // se ../schema/mail-document.v1.json
  createdAt?: string;       // ISO 8601 — sträng, inte Date, så den överlever JSON
  updatedAt?: string;
  meta?: Record<string, unknown>;  // ownerId, taggar, thumbnail-URL … ditt val
}
```

`list()` returnerar `MailTemplateSummary` — samma sak **utan** `document`. Det är inte
kosmetika: en katalog med hundra mallar ska kunna listas utan att dra hem hundra
dokumentträd.

## Färdiga adaptrar i paketet

| Adapter | När |
|---|---|
| `createMemoryTemplateStore(seed?)` | Playground, tester, och referensimplementationen att läsa när du skriver en egen |
| `createLocalStorageTemplateStore({ key?, storage? })` | Enanvändarverktyg och demos. Ärliga gränser: lämnar aldrig enheten, försvinner när webbläsaren rensas, några MB i kvot |
| `createRestTemplateStore({ baseUrl, fetch?, headers? })` | **Bryggan till vilken backend som helst** — Node, ASP.NET, PHP, vad som helst |

## REST-kontraktet

`createRestTemplateStore` talar fem endpoints. Bygger din backend dem så fungerar
redigeraren, oavsett språk.

| Metod | Väg | Kropp | Svar |
|---|---|---|---|
| `GET` | `{baseUrl}` | — | `MailTemplateSummary[]` |
| `GET` | `{baseUrl}/{id}` | — | `MailTemplate`, eller `404` |
| `POST` | `{baseUrl}` | `{ name, document, meta? }` | `MailTemplate` med serverns nya `id` |
| `PUT` | `{baseUrl}/{id}` | `{ name, document, meta? }` | `MailTemplate` |
| `DELETE` | `{baseUrl}/{id}` | — | `204` |

Två detaljer som är lätta att missa:

- **`404` betyder "finns inte", inte fel.** `load()` returnerar `null`. Allt annat än
  `2xx`/`404` kastar, så ett trasigt API blir synligt i stället för att se ut som en tom lista.
- **`POST` skickar aldrig ett `id`.** Servern äger id-generering.

```ts
const store = createRestTemplateStore({
  baseUrl: "/api/mail-templates",
  headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
});
```

## Firestore

Kan inte ligga i paketet — det skulle dra in hela `firebase`. Det är tjugo rader hos dig:

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
      // Firestore-Timestamps måste bli ISO-strängar; kontraktet är JSON.
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

Tre saker att göra i Firestore utöver koden:

1. **Regler.** Ett dokument kan bli stort; låt bara ägaren skriva.
   ```
   match /mailTemplates/{id} {
     allow read:   if request.auth != null && resource.data.ownerUid == request.auth.uid;
     allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
     allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
   }
   ```
2. **Index** på `(ownerUid ASC, updatedAt DESC)` — annars fungerar inte `list()`.
3. **Dokumentgränsen på 1 MiB.** Ett mail med många block och lång text kommer inte nära,
   men bäddar någon in bilder som `data:`-URI:er gör det. Ladda bilder till Storage och
   spara URL:en — vilket ändå krävs, eftersom Gmail blockerar `data:`-bilder.

## Att skicka en sparad mall

Mallen lagrar dokumentet, inte HTML. Rendera vid utskicket, en gång per mottagare:

```ts
import { toHtml } from "@backtech/mail-designer/render";

const template = await store.load(templateId);
for (const recipient of recipients) {
  const { html, text } = toHtml(template.document, {
    data: { Namn: recipient.namn, Ort: recipient.ort },
  });
  await sendEmail({ to: recipient.email, subject, html, text });
}
```

`extractDataFields(document)` säger vilka kolumner mallen kräver, inklusive de som
gömmer sig i en knapp-URL — precis de man glömmer att man är beroende av.

Att lagra den renderade HTML:en tillsammans med utskicket är ändå klokt: då kan du visa
exakt vad som skickades, även efter att mallen ändrats.
