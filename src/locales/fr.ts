/**
 * French.
 *
 * **Tu, not vous** — the same reasoning as German: the tools people compare this with address
 * their user informally, and a design tool that says "vous" reads like an insurance form. It
 * is applied consistently, which matters more than the choice itself.
 *
 * French is the longest of the three, and a few hints are shorter here than in English on
 * purpose: saying it in fewer words is better French than a faithful clause that wraps to four
 * lines in a 296px panel.
 *
 * Checked against what the industry actually writes: *marge intérieure* for padding, which is
 * what Figma's French uses. The preheader has no settled French label — Brevo's own French
 * material switches between *preheader* and *pré-header* without translating it, and Mailchimp
 * says *texte de prévisualisation* — so *texte d'aperçu* is the short form of the descriptive
 * one rather than the borrowed word.
 *
 * *Séparateur* and *espaceur* are the block names Stripo's French uses. The button's inner
 * padding is *marge du bouton* rather than a second *marge intérieure*, which is what it was
 * until a duplicate-label check caught the two sitting in the same panel.
 *
 * *Annuler* is both undo and cancel here, which is what macOS does in French and what a user
 * expects; they never appear together. And *champ de données* stands even though Brevo's
 * template language says *variables* — the panel is *Données*, so the field is a *champ de
 * données*.
 *
 * A past participle would have to agree with the block name interpolated into it, and the
 * gender varies — *une image*, *un bouton*, *une section*. The four history entries are built
 * as nouns ("Ajout de {{block}}") so nothing has to agree with anything.
 */
import type { Locale } from "./en.js";

export const fr: Locale = {
  "block.section": "Section",
  "block.heading": "Titre",
  "block.text": "Texte",
  "block.image": "Image",
  "block.button": "Bouton",
  "block.columns": "Colonnes",
  "block.social": "Liens sociaux",
  "block.divider": "Séparateur",
  "block.spacer": "Espaceur",
  "block.html": "HTML",

  "palette.title": "Blocs",
  "palette.hint": "Fais glisser un bloc, ou clique pour l'ajouter à la fin.",

  "canvas.empty": "E-mail vide",
  "canvas.emptyHint": "Ajoute un bloc depuis la palette à gauche.",
  "canvas.emptySection": "Section vide",
  "canvas.imagePlaceholder": "Aucune image choisie",
  "canvas.addSection": "Ajouter une section",

  "inspector.selection": "Sélection",
  "inspector.selectParent": "Sélectionner ce qui entoure ce bloc",
  "shortcuts.selectParent": "Sélectionner ce qui entoure le bloc, puis désélectionner",
  "inspector.title": "Propriétés",
  "inspector.nothing": "Rien de sélectionné",
  "inspector.nothingHint": "Clique un bloc dans l'e-mail pour le modifier.",
  "inspector.mail": "E-mail",
  "inspector.block": "Bloc",

  "field.width": "Largeur",
  "field.backgroundColor": "Arrière-plan",
  "field.contentBackgroundColor": "Arrière-plan du contenu",
  "field.fontFamily": "Police",
  "field.fontSize": "Taille du texte",
  "field.lineHeight": "Interligne",
  "field.textColor": "Couleur du texte",
  "field.linkColor": "Couleur des liens",
  "field.preheader": "Texte d'aperçu",
  "field.preheaderHint":
    "S'affiche après l'objet dans la boîte de réception. Laissé vide, les clients montrent le début du texte.",
  "field.padding": "Marge intérieure",
  "field.mobilePadding": "Marge sur mobile",
  "field.addMobilePadding": "Marge distincte sur mobile",
  "field.mobilePaddingHint":
    "Livrée par une media query. Outlook pour ordinateur prend toujours la valeur bureau, et quelques clients suppriment <style> entièrement — la valeur bureau doit donc être celle qui fonctionne.",
  "field.paddingLinked": "Lier les quatre côtés",
  "field.align": "Alignement",
  "field.color": "Couleur",
  "field.level": "Niveau",
  "field.src": "URL de l'image",
  "field.alt": "Texte alternatif",
  "field.altHint":
    "Décris l'image. S'affiche quand les images sont bloquées — ce qui est le cas par défaut dans beaucoup de clients.",
  "field.href": "Lien",
  "field.label": "Libellé",
  "field.borderRadius": "Rayon des angles",
  "field.innerPadding": "Marge du bouton",
  "field.buttonWidth": "Largeur du bouton",
  "field.buttonWidthHint":
    "Les angles arrondis exigent une largeur fixe dans Outlook. Sans elle, le bouton y reste carré et arrondi ailleurs.",
  "field.fullWidth": "Pleine largeur",
  "field.fullWidthSection": "Arrière-plan sur toute la largeur",
  "field.thickness": "Épaisseur",
  "field.height": "Hauteur",
  "field.gap": "Écart",
  "field.stackOnMobile": "Empiler sur mobile",
  "field.verticalAlign": "Alignement vertical",
  "field.verticalAlignHint": "Visible seulement si les colonnes n'ont pas la même hauteur.",
  "align.top": "Haut",
  "align.middle": "Milieu",
  "align.bottom": "Bas",
  "field.columnWidths": "Largeur des colonnes",
  "field.columnLabel": "Colonne {{n}}",
  "field.equalWidths": "Égaliser",
  "field.shared": "Égales",
  "field.columnsNarrowHint":
    "Avec {{count}} colonnes, chacune fait environ {{px}} px. Laisse « Empiler sur mobile » activé.",
  "field.columnsOverHint":
    "Les largeurs totalisent {{total}} %. La dernière colonne est réduite pour que la ligne tienne.",
  "field.columnCount": "Colonnes",
  "field.html": "HTML",
  "field.auto": "Auto",
  "field.inherited": "Hérité",
  "field.overridden": "Personnalisé",
  "field.resetToInherited": "Revenir à la valeur de l'e-mail",
  "field.inheritFont": "Hériter de l'e-mail",
  "field.overrideCount_one": "1 bloc a sa propre valeur",
  "field.overrideCount_other": "{{count}} blocs ont leur propre valeur",
  "field.clearOverrides": "Tout aligner sur l'e-mail",
  "inspector.mailHint":
    "S'applique à tout l'e-mail. Un bloc ayant sa propre valeur l'emporte.",
  "inspector.blockHint": "Les champs vides héritent de l'e-mail.",
  "field.upload": "Téléverser",
  "field.dropHint": "Dépose une image ici, ou clique pour en choisir une",
  "field.quality": "Qualité",
  "field.maxWidth": "Largeur max.",
  "field.originalSize": "Taille d'origine",
  "field.compressGrew": "La compression a alourdi le fichier — l'original est conservé.",
  "field.compressed": "Compressé : {{before}} → {{after}} ({{width}} px de large)",
  "field.uploading": "Téléversement …",

  "align.left": "Gauche",
  "align.center": "Centré",
  "align.right": "Droite",

  "session.untitled": "Brouillon {{date}}",
  "session.name": "Nom du document",
  "session.saved": "Enregistré {{time}}",
  "session.saving": "Enregistrement …",
  "session.dirty": "Non enregistré",
  "session.error": "Enregistrement impossible",
  "session.retry": "Réessayer",
  "session.saveNow": "Enregistrer",
  "session.documents": "Documents",
  "session.newDocument": "Nouveau document",
  "session.noDocuments": "Aucun document enregistré.",
  "session.openFailed": "Impossible d'ouvrir ce document.",
  "session.current": "Ouvert",
  "confirm.title": "Confirmer ?",
  "confirm.cancel": "Annuler",
  "confirm.switchTemplateTitle": "Utiliser le modèle {{name}} ?",
  "confirm.switchTemplateBody":
    "Cela remplace tout le document ouvert. Tu peux revenir en arrière avec Cmd+Z juste après.",
  "confirm.switchTemplateOk": "Utiliser le modèle",
  "confirm.switchDocumentTitle": "Ouvrir {{name}} ?",
  "confirm.switchDocumentBody":
    "Le document ouvert a des modifications non enregistrées. En ouvrir un autre maintenant peut les perdre, et changer de document ne s'annule pas.",
  "confirm.switchDocumentOk": "Ouvrir quand même",
  "confirm.newDocumentTitle": "Créer un document ?",
  "confirm.newDocumentBody": "Le document ouvert a des modifications non enregistrées.",
  "confirm.newDocumentOk": "Créer",
  "confirm.deleteDocumentTitle": "Supprimer {{name}} ?",
  "confirm.deleteDocumentBody": "Le document est supprimé définitivement. C'est irréversible.",
  "confirm.deleteDocumentOk": "Supprimer",
  "confirm.leaveBody": "Tu as des modifications qui ne sont pas encore enregistrées.",
  "shortcuts.title": "Raccourcis clavier",
  "shortcuts.open": "Afficher les raccourcis clavier",
  "shortcuts.undo": "Annuler",
  "shortcuts.redo": "Rétablir",
  "shortcuts.save": "Enregistrer",
  "shortcuts.duplicate": "Dupliquer le bloc sélectionné",
  "shortcuts.delete": "Supprimer le bloc sélectionné",
  "shortcuts.deselect": "Désélectionner",
  "shortcuts.move": "Déplacer le bloc vers le haut ou le bas",
  "shortcuts.moveAcross": "Entrer dans une colonne ou en sortir",
  "shortcuts.preview": "Basculer l'aperçu",
  "client.inbox": "Boîte de réception",
  "client.sent": "Envoyés",
  "client.drafts": "Brouillons",
  "client.archive": "Archives",
  "client.trash": "Corbeille",
  "client.sender": "L'expéditeur",
  "client.senderEmail": "mail@example.com",
  "client.toMe": "à moi",
  "client.noSubject": "(sans objet)",
  "client.date": "Aujourd'hui 09:41",
  "client.time": "09:41",
  "client.search": "Rechercher",
  "client.snippetFallback":
    "Aucun texte d'aperçu n'est défini, alors le client affiche ici le début du texte.",
  "toolbar.code": "Code",
  "code.html": "HTML",
  "code.text": "Texte brut",
  "code.json": "Document",
  "code.withData": "Avec les données d'exemple",
  "code.pretty": "Formater",
  "code.copy": "Copier",
  "code.copied": "Copié",
  "code.download": "Télécharger",
  "code.apply": "Appliquer",
  "code.invalidJson": "Ce n'est pas du JSON valide.",
  "code.invalidDocument": "Document non valide — {{issue}}",
  "code.size": "{{size}} ko",
  "shortcuts.viewport": "Ordinateur, tablette ou téléphone",
  "shortcuts.mockup": "Afficher ou masquer le cadre d'appareil",
  "shortcuts.help": "Cette liste",
  "history.edit": "Contenu modifié",
  "history.style": "Apparence modifiée",
  "history.settings": "Réglages de l'e-mail modifiés",
  "history.column": "Colonne modifiée",
  "history.insert": "Ajout de {{block}}",
  "history.remove": "Suppression de {{block}}",
  "history.duplicate": "Duplication de {{block}}",
  "history.move": "Déplacement de {{block}}",
  "history.replace": "Contenu remplacé",
  "history.undoNothing": "Rien à annuler",
  "history.redoNothing": "Rien à rétablir",
  "history.undoAction": "Annuler : {{action}}",
  "history.redoAction": "Rétablir : {{action}}",
  "history.undoMenu": "Annuler jusqu'à",
  "history.redoMenu": "Rétablir jusqu'à",
  "history.undoHint": "Choisis une étape pour annuler tout jusqu'à elle incluse.",
  "history.redoHint": "Choisis une étape pour rétablir tout jusqu'à elle incluse.",
  "history.unnamed": "Modification",
  "history.title": "Historique",
  "toolbar.undo": "Annuler",
  "toolbar.redo": "Rétablir",
  "toolbar.tablet": "Tablette",
  "toolbar.phone": "Téléphone",
  "toolbar.mockup": "Afficher le cadre d'appareil",
  "toolbar.desktop": "Ordinateur",
  "toolbar.mobile": "Mobile",
  "toolbar.edit": "Modifier",
  "toolbar.preview": "Aperçu",
  "toolbar.templates": "Modèles",
  "toolbar.save": "Enregistrer le modèle",
  "toolbar.mailSettings": "Apparence de l'e-mail",

  "action.delete": "Supprimer",
  "action.duplicate": "Dupliquer",
  "action.moveUp": "Monter",
  "action.moveDown": "Descendre",
  "action.add": "Ajouter",
  "action.close": "Fermer",
  "action.cancel": "Annuler",
  "action.confirm": "Confirmer",

  "text.bold": "Gras",
  "text.italic": "Italique",
  "text.underline": "Souligné",
  "text.link": "Lien",
  "text.unlink": "Retirer le lien",
  "text.color": "Couleur du texte",
  "text.dataField": "Champ de données",
  "text.linkPrompt": "URL",

  "locked.content": "Le contenu de ce bloc vient de l'application.",
  "field.darkMode": "Mode sombre",
  "field.darkModeOn": "Couleurs propres en mode sombre",
  "field.darkModeHint":
    "Sans elles, Apple Mail et Outlook.com inversent l'e-mail d'eux-mêmes.",
  "field.darkModeImages":
    "Les images ne sont pas inversées. Un logo sur fond blanc devient un rectangle blanc éclatant — utilise-en un avec transparence.",
  "warn.title": "À vérifier avant d'envoyer",
  "warn.gmail-clipping":
    "L'e-mail pèse {{kb}} ko. Gmail coupe au-delà de 100 ko et cache le reste derrière un lien.",
  "warn.data-uri-image":
    "Une image intégrée ({{count}}) — Gmail refuse de l'afficher. Téléverse-la et fais un lien à la place.",
  "warn.background-image":
    "Une image de fond de section ({{count}}) ne s'affichera pas dans Outlook. Mets aussi une couleur de fond.",
  "warn.missing-alt":
    "{{count}} image(s) sans texte alternatif. Les images sont bloquées par défaut dans beaucoup de clients.",
  "warn.no-preheader":
    "Pas de texte d'aperçu. La boîte de réception montrera le début du texte à la place.",
  "warn.wide-content":
    "{{width}} px, c'est large — plusieurs volets d'aperçu sont plus étroits que ça.",
  "warn.no-plain-text": "Pas de partie texte brut. Les filtres antispam le retiennent contre toi.",
  "warn.no-dark-mode":
    "Aucune couleur sombre définie. Apple Mail et Outlook.com inverseront l'e-mail eux-mêmes — et un logo sur fond blanc devient un rectangle blanc éclatant.",
  "warn.conditional-without-data":
    "{{count}} bloc(s) masqué(s) faute de données dans cet aperçu. Ils sont décidés au rendu : un e-mail rendu sans données ne les contient pour personne.",
  "data.pickerHint": "Choisis un champ · flèches et Entrée",
  "data.noMatch": "Aucun champ ne correspond à « {{query}} »",
  "data.insert": "Champ de données",
  "data.insertHint": "Tape @ dans le texte pour ouvrir cette liste",
  "data.panel": "Données",
  "data.panelHint":
    "Données d'exemple pour l'aperçu. Ajoute un champ ici et tu pourras l'insérer dans l'e-mail avec @.",
  "data.fieldsView": "Champs",
  "data.jsonView": "JSON",
  "data.addField": "Ajouter un champ",
  "data.fieldName": "Nom du champ",
  "data.fieldValue": "Valeur",
  "data.jsonInvalid": "JSON invalide — les modifications reprennent dès qu'il est correct.",
  "data.readonly": "Ces données viennent de l'application et ne se modifient pas ici.",
  "data.used": "Visible dans l'e-mail",
  "data.unused": "Absent de l'e-mail",
  "data.noValue": "Aucune valeur",
  "data.open": "Données",
  "data.coverageOk": "Toutes les données sont visibles dans l'e-mail.",
  "data.coverageMissingOne": "1 champ est absent de l'e-mail : {{fields}}",
  "data.coverageMissingMany": "{{count}} champs sont absents de l'e-mail : {{fields}}",
  "data.coverageRequired": "Un champ obligatoire est absent de l'e-mail : {{fields}}",
  "data.insertField": "Insérer {{field}} dans le bloc sélectionné",
  "session.reset": "Revenir au modèle par défaut",
  "confirm.resetTitle": "Revenir à l'e-mail par défaut ?",
  "confirm.resetBody":
    "Tout ce que tu as changé dans ce document est remplacé. Tu peux revenir en arrière avec Cmd+Z juste après.",
  "confirm.resetOk": "Réinitialiser",
  "data.title": "Champs de données",
  "data.hint": "Insérés sous la forme [Champ] et remplacés par les données du destinataire.",
  "data.none": "Aucun champ de données fourni.",

  "templates.title": "Modèles",
  "templates.empty": "Aucun modèle enregistré.",
  "templates.presets": "Points de départ",
  "templates.saved": "Enregistrés",
  "templates.namePrompt": "Nom du modèle",
  "templates.replaceWarning": "Cela remplace le contenu de l'e-mail.",
  "templates.loadError": "Impossible de charger les modèles.",
  "templates.saveError": "Impossible d'enregistrer le modèle.",
};
