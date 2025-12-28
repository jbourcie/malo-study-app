// src/taxonomy/tagCatalog.ts
// Catalogue d'affichage des tags (IDs techniques stables -> labels FR + regroupements UI)

export type SubjectId = "fr" | "math" | "en" | "es" | "hist";

export type TagMeta = {
  id: string;                 // ID technique stable (utilisé en Firestore)
  label: string;              // Libellé FR court
  description?: string;       // 1 phrase max
  subject: SubjectId;         // matière
  theme: string;              // regroupement UI
  order?: number;             // tri (plus petit = plus haut)
};

export type MasteryState = "discovering" | "progressing" | "mastered";

export const SUBJECT_LABEL_FR: Record<SubjectId, string> = {
  fr: "Français",
  math: "Mathématiques",
  en: "Anglais",
  es: "Espagnol",
  hist: "Histoire-Géographie",
};

export const MASTERY_LABEL_FR: Record<MasteryState, string> = {
  discovering: "En découverte",
  progressing: "En progrès",
  mastered: "Maîtrisé",
};

export const MASTERY_HELP_FR: Record<MasteryState, string> = {
  discovering: "Tu commences",
  progressing: "Tu consolides",
  mastered: "C’est acquis",
};

// --- Helpers UI ---

export function prettifyTagId(tagId: string): string {
  // ex: "fr_comprehension_idee_principale" -> "Compréhension idée principale"
  return tagId
    .replace(/^(fr|math|en|es|hist)_/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function inferSubject(tagId: string): SubjectId {
  const lower = tagId.toLowerCase();
  if (lower.startsWith("math_")) return "math";
  if (lower.startsWith("en_")) return "en";
  if (lower.startsWith("es_")) return "es";
  if (lower.startsWith("hist_")) return "hist";
  return "fr";
}

export function getTagMeta(tagId: string): TagMeta {
  return (
    TAG_CATALOG[tagId] ?? {
      id: tagId,
      label: prettifyTagId(tagId),
      subject: inferSubject(tagId),
      theme: "Autres",
      order: 9999,
      description: "Tag non catalogué (affichage automatique).",
    }
  );
}

// --- Catalogue (IDs -> métadonnées) ---
// Note: ajoute/édite librement les labels sans casser l'historique (les IDs restent stables).

export const TAG_CATALOG: Record<string, TagMeta> = {
  // =========================
  // FRANÇAIS — Compréhension
  // =========================
  fr_comprehension_idee_principale: {
    id: "fr_comprehension_idee_principale",
    label: "Idée principale",
    description: "Trouver le message global du texte.",
    subject: "fr",
    theme: "Compréhension",
    order: 10,
  },
  fr_comprehension_detail: {
    id: "fr_comprehension_detail",
    label: "Informations explicites",
    description: "Repérer une info donnée directement.",
    subject: "fr",
    theme: "Compréhension",
    order: 20,
  },
  fr_comprehension_inference: {
    id: "fr_comprehension_inference",
    label: "Inférences",
    description: "Déduire une info implicite.",
    subject: "fr",
    theme: "Compréhension",
    order: 30,
  },
  fr_comprehension_vocabulaire_contexte: {
    id: "fr_comprehension_vocabulaire_contexte",
    label: "Vocabulaire en contexte",
    description: "Comprendre un mot grâce au contexte.",
    subject: "fr",
    theme: "Compréhension",
    order: 40,
  },
  fr_comprehension_pronom_referent: {
    id: "fr_comprehension_pronom_referent",
    label: "Référents des pronoms",
    description: "Identifier à qui/quoi renvoie un pronom.",
    subject: "fr",
    theme: "Compréhension",
    order: 50,
  },
  fr_comprehension_connecteurs_logiques: {
    id: "fr_comprehension_connecteurs_logiques",
    label: "Connecteurs logiques",
    description: "Comprendre le lien entre les idées (cause, conséquence…).",
    subject: "fr",
    theme: "Compréhension",
    order: 60,
  },
  fr_comprehension_chronologie: {
    id: "fr_comprehension_chronologie",
    label: "Chronologie",
    description: "Reconstituer l’ordre des événements.",
    subject: "fr",
    theme: "Compréhension",
    order: 70,
  },
  fr_comprehension_point_de_vue: {
    id: "fr_comprehension_point_de_vue",
    label: "Point de vue / narrateur",
    description: "Identifier qui parle et comment.",
    subject: "fr",
    theme: "Compréhension",
    order: 80,
  },
  fr_comprehension_intention_auteur: {
    id: "fr_comprehension_intention_auteur",
    label: "Intention du texte",
    description: "Informer, convaincre, raconter, expliquer…",
    subject: "fr",
    theme: "Compréhension",
    order: 90,
  },

  // =========================
  // FRANÇAIS — Lexique
  // =========================
  fr_lexique_synonyme: {
    id: "fr_lexique_synonyme",
    label: "Synonymes",
    description: "Choisir le mot de sens proche.",
    subject: "fr",
    theme: "Lexique",
    order: 110,
  },
  fr_lexique_antonyme: {
    id: "fr_lexique_antonyme",
    label: "Antonymes",
    description: "Trouver le mot de sens contraire.",
    subject: "fr",
    theme: "Lexique",
    order: 120,
  },
  fr_lexique_famille_mots: {
    id: "fr_lexique_famille_mots",
    label: "Familles de mots",
    description: "Reconnaître des mots de même famille.",
    subject: "fr",
    theme: "Lexique",
    order: 130,
  },
  fr_lexique_niveaux_langue: {
    id: "fr_lexique_niveaux_langue",
    label: "Niveaux de langue",
    description: "Soutenu, courant, familier.",
    subject: "fr",
    theme: "Lexique",
    order: 140,
  },
  fr_lexique_sens_propre_figure: {
    id: "fr_lexique_sens_propre_figure",
    label: "Sens propre / figuré",
    description: "Distinguer sens littéral et image.",
    subject: "fr",
    theme: "Lexique",
    order: 150,
  },

  // =========================
  // FRANÇAIS — Grammaire
  // =========================
  fr_grammaire_classes_mots: {
    id: "fr_grammaire_classes_mots",
    label: "Classes de mots",
    description: "Nom, verbe, adjectif, pronom, déterminant…",
    subject: "fr",
    theme: "Grammaire",
    order: 210,
  },
  fr_grammaire_fonctions: {
    id: "fr_grammaire_fonctions",
    label: "Fonctions",
    description: "Sujet, COD/COI, compléments, attribut…",
    subject: "fr",
    theme: "Grammaire",
    order: 220,
  },
  fr_grammaire_fonction_cod: {
    id: "fr_grammaire_fonction_cod",
    label: "Fonction : COD",
    description: "Repérer le complément d’objet direct (quoi/qui).",
    subject: "fr",
    theme: "Grammaire",
    order: 225,
  },
  fr_grammaire_gn_gv: {
    id: "fr_grammaire_gn_gv",
    label: "Groupe nominal / verbal",
    description: "Identifier GN et GV.",
    subject: "fr",
    theme: "Grammaire",
    order: 230,
  },
  fr_grammaire_phrase_simple_complexe: {
    id: "fr_grammaire_phrase_simple_complexe",
    label: "Phrase simple / complexe",
    description: "Nombre de verbes conjugués, propositions.",
    subject: "fr",
    theme: "Grammaire",
    order: 240,
  },
  fr_grammaire_propositions: {
    id: "fr_grammaire_propositions",
    label: "Propositions",
    description: "Identifier proposition principale et subordonnée.",
    subject: "fr",
    theme: "Grammaire",
    order: 250,
  },
  fr_grammaire_coordination_juxtaposition: {
    id: "fr_grammaire_coordination_juxtaposition",
    label: "Coordination / juxtaposition",
    description: "Et/mais/donc… ou virgules/point-virgule.",
    subject: "fr",
    theme: "Grammaire",
    order: 260,
  },
  fr_grammaire_subordination: {
    id: "fr_grammaire_subordination",
    label: "Subordination",
    description: "Introduite par une conjonction / pronom relatif.",
    subject: "fr",
    theme: "Grammaire",
    order: 270,
  },
  fr_grammaire_proposition_relative: {
    id: "fr_grammaire_proposition_relative",
    label: "Proposition relative",
    description: "Relative introduite par qui/que/dont/où…",
    subject: "fr",
    theme: "Grammaire",
    order: 280,
  },
  fr_grammaire_completive: {
    id: "fr_grammaire_completive",
    label: "Subordonnée complétive",
    description: "Introduite par que/si, complète un verbe.",
    subject: "fr",
    theme: "Grammaire",
    order: 290,
  },
  fr_grammaire_circonstancielle: {
    id: "fr_grammaire_circonstancielle",
    label: "Subordonnée circonstancielle",
    description: "Temps, cause, conséquence, but, condition…",
    subject: "fr",
    theme: "Grammaire",
    order: 300,
  },
  fr_grammaire_negation: {
    id: "fr_grammaire_negation",
    label: "Négation",
    description: "Ne… pas / jamais / plus / rien / personne…",
    subject: "fr",
    theme: "Grammaire",
    order: 310,
  },
  fr_grammaire_interrogation: {
    id: "fr_grammaire_interrogation",
    label: "Interrogation",
    description: "Totale / partielle, formes et mots interrogatifs.",
    subject: "fr",
    theme: "Grammaire",
    order: 320,
  },
  fr_grammaire_voix_active_passive: {
    id: "fr_grammaire_voix_active_passive",
    label: "Voix active / passive",
    description: "Transformer une phrase.",
    subject: "fr",
    theme: "Grammaire",
    order: 330,
  },
  fr_grammaire_discours_direct_indirect: {
    id: "fr_grammaire_discours_direct_indirect",
    label: "Discours direct / indirect",
    description: "Transformer une parole rapportée.",
    subject: "fr",
    theme: "Grammaire",
    order: 340,
  },

  // =========================
  // FRANÇAIS — Conjugaison
  // =========================
  fr_conjugaison_present: {
    id: "fr_conjugaison_present",
    label: "Présent",
    subject: "fr",
    theme: "Conjugaison",
    order: 410,
  },
  fr_conjugaison_imparfait: {
    id: "fr_conjugaison_imparfait",
    label: "Imparfait",
    subject: "fr",
    theme: "Conjugaison",
    order: 420,
  },
  fr_conjugaison_passe_simple: {
    id: "fr_conjugaison_passe_simple",
    label: "Passé simple",
    subject: "fr",
    theme: "Conjugaison",
    order: 430,
  },
  fr_conjugaison_futur_simple: {
    id: "fr_conjugaison_futur_simple",
    label: "Futur simple",
    subject: "fr",
    theme: "Conjugaison",
    order: 440,
  },
  fr_conjugaison_passe_compose: {
    id: "fr_conjugaison_passe_compose",
    label: "Passé composé",
    subject: "fr",
    theme: "Conjugaison",
    order: 450,
  },
  fr_conjugaison_plus_que_parfait: {
    id: "fr_conjugaison_plus_que_parfait",
    label: "Plus-que-parfait",
    subject: "fr",
    theme: "Conjugaison",
    order: 460,
  },
  fr_conjugaison_conditionnel_present: {
    id: "fr_conjugaison_conditionnel_present",
    label: "Conditionnel présent",
    subject: "fr",
    theme: "Conjugaison",
    order: 470,
  },
  fr_conjugaison_imperatif: {
    id: "fr_conjugaison_imperatif",
    label: "Impératif",
    subject: "fr",
    theme: "Conjugaison",
    order: 480,
  },
  fr_conjugaison_subjonctif_present: {
    id: "fr_conjugaison_subjonctif_present",
    label: "Subjonctif présent",
    subject: "fr",
    theme: "Conjugaison",
    order: 490,
  },
  fr_conjugaison_valeurs_temps: {
    id: "fr_conjugaison_valeurs_temps",
    label: "Valeurs des temps",
    description: "Imparfait (description/habitude), passé simple (actions)…",
    subject: "fr",
    theme: "Conjugaison",
    order: 500,
  },
  fr_conjugaison_accord_participe_passe: {
    id: "fr_conjugaison_accord_participe_passe",
    label: "Accord du participe passé",
    description: "Avec être/avoir (règles de base).",
    subject: "fr",
    theme: "Conjugaison",
    order: 510,
  },

  // =========================
  // FRANÇAIS — Orthographe
  // =========================
  fr_orthographe_accord_gn: {
    id: "fr_orthographe_accord_gn",
    label: "Accords dans le GN",
    description: "Déterminant/nom/adjectif.",
    subject: "fr",
    theme: "Orthographe",
    order: 610,
  },
  fr_orthographe_accord_sujet_verbe: {
    id: "fr_orthographe_accord_sujet_verbe",
    label: "Accord sujet-verbe",
    subject: "fr",
    theme: "Orthographe",
    order: 620,
  },
  fr_orthographe_homophones_grammaticaux: {
    id: "fr_orthographe_homophones_grammaticaux",
    label: "Homophones grammaticaux",
    description: "a/à, et/est, son/sont, ces/ses…",
    subject: "fr",
    theme: "Orthographe",
    order: 630,
  },
  fr_orthographe_punctuation: {
    id: "fr_orthographe_punctuation",
    label: "Ponctuation",
    subject: "fr",
    theme: "Orthographe",
    order: 640,
  },

  // =========================
  // MATHS — Fractions (priorité Malo)
  // =========================
  math_fractions_vocabulaire: {
    id: "math_fractions_vocabulaire",
    label: "Vocabulaire des fractions",
    description: "Numérateur/dénominateur, fraction d’une quantité…",
    subject: "math",
    theme: "Fractions",
    order: 10,
  },
  math_fractions_representer: {
    id: "math_fractions_representer",
    label: "Représenter une fraction",
    description: "Sur une figure / droite graduée.",
    subject: "math",
    theme: "Fractions",
    order: 20,
  },
  math_fractions_equivalentes: {
    id: "math_fractions_equivalentes",
    label: "Fractions équivalentes",
    subject: "math",
    theme: "Fractions",
    order: 30,
  },
  math_fractions_simplifier: {
    id: "math_fractions_simplifier",
    label: "Simplifier une fraction",
    subject: "math",
    theme: "Fractions",
    order: 40,
  },
  math_fractions_comparer: {
    id: "math_fractions_comparer",
    label: "Comparer des fractions",
    subject: "math",
    theme: "Fractions",
    order: 50,
  },
  math_fractions_ordonner: {
    id: "math_fractions_ordonner",
    label: "Ordonner des fractions",
    subject: "math",
    theme: "Fractions",
    order: 60,
  },
  math_fractions_addition: {
    id: "math_fractions_addition",
    label: "Addition de fractions",
    subject: "math",
    theme: "Fractions",
    order: 70,
  },
  math_fractions_soustraction: {
    id: "math_fractions_soustraction",
    label: "Soustraction de fractions",
    subject: "math",
    theme: "Fractions",
    order: 80,
  },
  math_fractions_multiplication: {
    id: "math_fractions_multiplication",
    label: "Multiplication de fractions",
    subject: "math",
    theme: "Fractions",
    order: 90,
  },
  math_fractions_division: {
    id: "math_fractions_division",
    label: "Division par une fraction",
    subject: "math",
    theme: "Fractions",
    order: 100,
  },
  math_fractions_problemes: {
    id: "math_fractions_problemes",
    label: "Problèmes avec fractions",
    subject: "math",
    theme: "Fractions",
    order: 110,
  },

  // =========================
  // MATHS — Nombres & calcul
  // =========================
  math_nombres_entiers: {
    id: "math_nombres_entiers",
    label: "Nombres entiers",
    subject: "math",
    theme: "Nombres & calcul",
    order: 210,
  },
  math_nombres_decimaux: {
    id: "math_nombres_decimaux",
    label: "Nombres décimaux",
    subject: "math",
    theme: "Nombres & calcul",
    order: 220,
  },
  math_priorites_operatoires: {
    id: "math_priorites_operatoires",
    label: "Priorités opératoires",
    subject: "math",
    theme: "Nombres & calcul",
    order: 230,
  },
  math_calcul_mental: {
    id: "math_calcul_mental",
    label: "Calcul mental",
    subject: "math",
    theme: "Nombres & calcul",
    order: 240,
  },
  math_puissances_base: {
    id: "math_puissances_base",
    label: "Puissances (bases)",
    subject: "math",
    theme: "Nombres & calcul",
    order: 250,
  },

  // =========================
  // MATHS — Géométrie
  // =========================
  math_geometrie_angles: {
    id: "math_geometrie_angles",
    label: "Angles",
    subject: "math",
    theme: "Géométrie",
    order: 310,
  },
  math_geometrie_triangles: {
    id: "math_geometrie_triangles",
    label: "Triangles",
    subject: "math",
    theme: "Géométrie",
    order: 320,
  },
  math_geometrie_paralleles: {
    id: "math_geometrie_paralleles",
    label: "Droites parallèles/perpendiculaires",
    subject: "math",
    theme: "Géométrie",
    order: 330,
  },
  math_geometrie_symetrie_axiale: {
    id: "math_geometrie_symetrie_axiale",
    label: "Symétrie axiale",
    subject: "math",
    theme: "Géométrie",
    order: 340,
  },
  math_geometrie_cercle: {
    id: "math_geometrie_cercle",
    label: "Cercle",
    subject: "math",
    theme: "Géométrie",
    order: 350,
  },

  // =========================
  // MATHS — Grandeurs & mesures
  // =========================
  math_mesures_perimetre: {
    id: "math_mesures_perimetre",
    label: "Périmètre",
    subject: "math",
    theme: "Grandeurs & mesures",
    order: 410,
  },
  math_mesures_aire: {
    id: "math_mesures_aire",
    label: "Aire",
    subject: "math",
    theme: "Grandeurs & mesures",
    order: 420,
  },
  math_mesures_volumes: {
    id: "math_mesures_volumes",
    label: "Volumes (bases)",
    subject: "math",
    theme: "Grandeurs & mesures",
    order: 430,
  },
  math_mesures_unites_conversions: {
    id: "math_mesures_unites_conversions",
    label: "Conversions d’unités",
    subject: "math",
    theme: "Grandeurs & mesures",
    order: 440,
  },

  // =========================
  // MATHS — Proportionnalité / % (début collège)
  // =========================
  math_proportionnalite_tableaux: {
    id: "math_proportionnalite_tableaux",
    label: "Tableaux de proportionnalité",
    subject: "math",
    theme: "Proportionnalité",
    order: 510,
  },
  math_proportionnalite_pourcentages: {
    id: "math_proportionnalite_pourcentages",
    label: "Pourcentages (bases)",
    subject: "math",
    theme: "Proportionnalité",
    order: 520,
  },
  math_proportionnalite_echelles: {
    id: "math_proportionnalite_echelles",
    label: "Échelles (bases)",
    subject: "math",
    theme: "Proportionnalité",
    order: 530,
  },

  // =========================
  // ANGLAIS — Bases + compréhension
  // =========================
  en_vocab_daily_life: {
    id: "en_vocab_daily_life",
    label: "Vocabulaire du quotidien",
    subject: "en",
    theme: "Vocabulaire",
    order: 10,
  },
  en_vocab_school: {
    id: "en_vocab_school",
    label: "Vocabulaire de l’école",
    subject: "en",
    theme: "Vocabulaire",
    order: 20,
  },
  en_grammar_pronouns: {
    id: "en_grammar_pronouns",
    label: "Pronoms",
    subject: "en",
    theme: "Grammaire",
    order: 110,
  },
  en_grammar_present_simple: {
    id: "en_grammar_present_simple",
    label: "Present simple",
    subject: "en",
    theme: "Grammaire",
    order: 120,
  },
  en_grammar_present_continuous: {
    id: "en_grammar_present_continuous",
    label: "Present continuous",
    subject: "en",
    theme: "Grammaire",
    order: 130,
  },
  en_grammar_past_simple: {
    id: "en_grammar_past_simple",
    label: "Past simple",
    subject: "en",
    theme: "Grammaire",
    order: 140,
  },
  en_grammar_future: {
    id: "en_grammar_future",
    label: "Future (will / be going to)",
    subject: "en",
    theme: "Grammaire",
    order: 150,
  },
  en_comprehension_short_text: {
    id: "en_comprehension_short_text",
    label: "Compréhension de texte court",
    subject: "en",
    theme: "Compréhension",
    order: 210,
  },
  en_comprehension_inference: {
    id: "en_comprehension_inference",
    label: "Inférences (anglais)",
    subject: "en",
    theme: "Compréhension",
    order: 220,
  },

  // =========================
  // ESPAGNOL — Bases + compréhension
  // =========================
  es_vocab_daily_life: {
    id: "es_vocab_daily_life",
    label: "Vocabulaire du quotidien",
    subject: "es",
    theme: "Vocabulaire",
    order: 10,
  },
  es_vocab_school: {
    id: "es_vocab_school",
    label: "Vocabulaire de l’école",
    subject: "es",
    theme: "Vocabulaire",
    order: 20,
  },
  es_grammar_pronouns: {
    id: "es_grammar_pronouns",
    label: "Pronoms",
    subject: "es",
    theme: "Grammaire",
    order: 110,
  },
  es_grammar_present: {
    id: "es_grammar_present",
    label: "Présent de l’indicatif",
    subject: "es",
    theme: "Grammaire",
    order: 120,
  },
  es_grammar_past: {
    id: "es_grammar_past",
    label: "Passé (bases)",
    subject: "es",
    theme: "Grammaire",
    order: 130,
  },
  es_comprehension_short_text: {
    id: "es_comprehension_short_text",
    label: "Compréhension de texte court",
    subject: "es",
    theme: "Compréhension",
    order: 210,
  },

  // =========================
  // HISTOIRE-GÉO — Repères & méthodes
  // =========================
  hist_methodes_chronologie: {
    id: "hist_methodes_chronologie",
    label: "Chronologie",
    description: "Situer et ordonner des événements.",
    subject: "hist",
    theme: "Méthodes",
    order: 10,
  },
  hist_methodes_documents: {
    id: "hist_methodes_documents",
    label: "Lire un document",
    description: "Identifier nature, auteur, contexte, intention.",
    subject: "hist",
    theme: "Méthodes",
    order: 20,
  },
  hist_geo_cartes: {
    id: "hist_geo_cartes",
    label: "Lire une carte",
    description: "Légende, échelle, orientation.",
    subject: "hist",
    theme: "Géographie",
    order: 110,
  },
  hist_geo_paysages: {
    id: "hist_geo_paysages",
    label: "Étudier un paysage",
    subject: "hist",
    theme: "Géographie",
    order: 120,
  },

  // Repères (généraux/5e – volontairement “basiques”)
  hist_reperes_ancien_regime: {
    id: "hist_reperes_ancien_regime",
    label: "Repères historiques (bases)",
    description: "Placer quelques périodes/siècles.",
    subject: "hist",
    theme: "Repères",
    order: 210,
  },
  hist_reperes_moyen_age: {
    id: "hist_reperes_moyen_age",
    label: "Moyen Âge (repères)",
    subject: "hist",
    theme: "Repères",
    order: 220,
  },
  hist_reperes_islam_moyen_age: {
    id: "hist_reperes_islam_moyen_age",
    label: "Islam médiéval (repères)",
    subject: "hist",
    theme: "Repères",
    order: 230,
  },
  hist_reperes_renaissance: {
    id: "hist_reperes_renaissance",
    label: "Renaissance (repères)",
    subject: "hist",
    theme: "Repères",
    order: 240,
  },

  // =========================
  // META (optionnel) — Transversal
  // =========================
  meta_transfert: {
    id: "meta_transfert",
    label: "Transfert de méthode",
    description: "Réutiliser une stratégie dans un autre contexte.",
    subject: "fr",
    theme: "Méthode",
    order: 900,
  },
};
