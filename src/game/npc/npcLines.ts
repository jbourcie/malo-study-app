import { NpcId } from './npcCatalog'

export type ReasonCode = 'repair' | 'priority' | 'spaced' | 'craft'

type NpcLines = Record<'scout' | 'robot' | 'goblin', Record<ReasonCode, string[]>>

export const NPC_LINES: NpcLines = {
  scout: {
    repair: [
      "Ton bloc craque. On le répare ensemble ?",
      "Je vois une fissure ici. On retourne l solidifier.",
      "Un pas en arrière pour repartir plus fort : mission réparation.",
      "On revient sur ce bloc : je t’accompagne, c’est rapide.",
      "Rafistolage express : on comble les brèches.",
      "Revoir calmement, c’est la clé. Partons réparer.",
      "On renforce les bases : mission réparation en vue.",
      "Je trace la route vers un bloc fissuré. On y va ?",
      "On rebouche les trous, puis on reprendra l’ascension.",
      "Une courte halte pour ajuster ce bloc.",
      "Je détecte un bloc fragile. On s’en occupe d’abord.",
      "Réparer, puis repartir : c’est notre plan du jour.",
      "Mission soin : on remet ce bloc en forme.",
      "On revisite ce point faible avec méthode.",
      "On resserre les boulons et on passe à la suite.",
      "Une réparation vaut mieux qu’un effondrement. Prêt ?",
      "On vérifie, on corrige, on sécurise. En avant.",
      "Rappel express, puis on grimpe : mission réparation.",
    ],
    priority: [
      "Mission prioritaire repérée : c’est le moment.",
      "Je pointe un bloc clé pour aujourd’hui.",
      "Ce bloc t’ouvrira la suite. On y va.",
      "Objectif du jour : consolider ce bloc essentiel.",
      "Je te propose la voie rapide vers le prochain palier.",
      "Ce bloc doit passer devant. Je t’emmène.",
      "Cap sur un bloc important pour tes progrès.",
      "On prend l’itinéraire optimal : ce bloc d’abord.",
      "Je privilégie ce bloc pour t’aider à avancer.",
      "Un bloc décisif t’attend. Partons.",
      "Cible prioritaire, effort concentré.",
      "Je te guide sur le meilleur gain du jour.",
      "On choisit la piste la plus rentable.",
      "Ce bloc débloquera la suite : fonçons.",
      "Sélection du jour : ce bloc mérite ton focus.",
      "Je réduis le chemin : ce bloc est la clé.",
      "Mission directe sur un bloc stratégique.",
      "On sécurise ce point, puis on explorera plus loin.",
    ],
    spaced: [
      "On revisite un bloc oublié depuis quelques jours.",
      "Petit rappel lointain : on remet ce bloc en tête.",
      "Je ressors une balise ancienne, on la réactive.",
      "Un peu de révision espacée pour rester solide.",
      "On dépoussière ce bloc. Ça sera vite fait.",
      "Rappel doux : ce bloc mérite un coup d’œil.",
      "On renforce la mémoire : passage éclair ici.",
      "Retour à un bloc croisé il y a quelque temps.",
      "Je propose une session courte sur un ancien bloc.",
      "On réactive ce savoir, sans stress.",
      "Un flashback utile pour rester au top.",
      "On refait surface sur ce bloc discret.",
      "Mission rappel : on vérifie que tout tient.",
      "Révision espacée : juste ce qu’il faut.",
      "On ancre durablement en repassant ici.",
      "On fait un tour sur ce bloc en sommeil.",
      "Je t’emmène revoir un repère éloigné.",
      "Courte escale mémoire sur ce bloc.",
    ],
    craft: [
      "On combine deux blocs, prêt à crafter ?",
      "Atelier express : on mélange deux notions.",
      "Défi création : assembler deux blocs solides.",
      "On tisse un lien entre ces blocs, façon craft.",
      "On fabrique une avancée avec deux éléments.",
      "Je propose un duo de blocs pour progresser.",
      "On fusionne les compétences : mission craft.",
      "Construisons un pont entre ces blocs.",
      "On forge une nouvelle maîtrise avec ce duo.",
      "Mélange malin : deux blocs, une mission.",
      "Je te guide pour assembler ces savoirs.",
      "On crée un combo gagnant aujourd’hui.",
      "Deux blocs alliés pour une expédition.",
      "On passe en mode atelier : craft rapide.",
      "On sculpte une mission à deux blocs.",
      "On associe, on consolide, on avance.",
      "Laboratoire du jour : fusion de blocs.",
      "Recette du jour : craft efficace.",
    ],
  },
  robot: {
    repair: [
      "Analyse : bloc instable. Correction recommandée.",
      "Protocole réparation : cible détectée.",
      "Priorité système : combler les erreurs.",
      "Retour sur un échec récent pour stabiliser.",
      "Réglage fin requis. Lancement correction.",
      "On patch le bloc avant nouvelle montée.",
      "Erreur repérée. Séquence de réparation.",
      "Module réparation actif pour ce bloc.",
      "On réduit le risque en corrigeant ici.",
      "Cycle court de correction conseillé.",
      "Stabilisation nécessaire : bloc fissuré.",
      "Plan : corriger, vérifier, valider.",
      "On ferme la faille et on continue.",
      "Bloc fragile identifié. Fix en cours.",
      "Process rapide : correction ciblée.",
      "On élimine cette faiblesse maintenant.",
      "Réparer avant d’ajouter de la complexité.",
      "Calibration du bloc en priorité.",
    ],
    priority: [
      "Priorité calculée : ce bloc maximise ton gain.",
      "Sélection optimisée : travaille ce bloc.",
      "Chemin le plus court : ce bloc d’abord.",
      "Optimisation : focus sur ce bloc clé.",
      "Je te dirige vers le meilleur ROI du jour.",
      "Bloc stratégique identifié pour progresser.",
      "Plan efficace : ce bloc en première position.",
      "Priorité système : renforcer ce bloc.",
      "Séquence optimale : ce bloc avant les autres.",
      "Ce bloc débloquera plus de points. Exécutons.",
      "Je choisis la cible la plus rentable.",
      "Cible prioritaire : gain attendu maximal.",
      "Ce bloc est ton accélérateur du jour.",
      "Alignement optimal : commence ici.",
      "Je simplifie : un bloc, un progrès net.",
      "Route minimale : ce bloc au centre.",
      "Paramétrage : mission sur ce bloc clé.",
      "Processus : priorité haute sur ce bloc.",
    ],
    spaced: [
      "Révision espacée programmée : bloc oublié.",
      "Rappel mémoire : revisitons ce bloc.",
      "Intervalle détecté >5 jours. Rafraîchissons.",
      "On relit ce bloc pour consolider.",
      "Maintenance mémoire : passage rapide ici.",
      "Réactivation nécessaire : bloc ancien.",
      "Boucle de rappel : courte session.",
      "Je déclenche une vérification périodique.",
      "On recharge ce savoir pour éviter la perte.",
      "Séance courte : renforcement espacé.",
      "Ancrage long terme : revoir ce bloc.",
      "Routine spaced repetition : ce bloc.",
      "On valide que ce bloc reste stable.",
      "Ping mémoire : ce bloc en attente.",
      "Refresh programmé pour ce bloc.",
      "Cycle espacé : contrôle rapide.",
      "Stabilité mémoire : test sur ce bloc.",
      "Révision chronologique : on y retourne.",
    ],
    craft: [
      "Fusion de compétences : mission craft.",
      "Assemblage logique : deux blocs, une cible.",
      "On combine deux notions pour créer un lien.",
      "Atelier synthèse : craft calculé.",
      "Je propose un binôme de blocs complémentaires.",
      "Construction avancée : fusion de savoirs.",
      "On mixe ces blocs pour renforcer la structure.",
      "Plan duo : mission craft à deux blocs.",
      "On établit une passerelle entre deux notions.",
      "Craft contrôlé : assembler et vérifier.",
      "On teste une combinaison pour progresser.",
      "Synthèse : deux blocs, progression unique.",
      "On code une mission craft précise.",
      "Expérience combinatoire : allons-y.",
      "Deux blocs corrélés, une mission claire.",
      "On structure un combo pour t’élever.",
      "Mélange optimisé : craft de précision.",
      "On valide un duo de blocs maîtrisés.",
    ],
  },
  goblin: {
    repair: [
      "Oups, un bloc fissuré ! On va le rafistoler.",
      "Je chipote, mais ça craque ici. On répare ?",
      "Gobelin détecte une bêtise : on la corrige vite.",
      "On repart sur ce bloc pour le rendre costaud.",
      "Petit soin gobelin : on bouche les trous.",
      "Revenons sur cet échec, sans panique.",
      "Je t’aide à recoller les morceaux de ce bloc.",
      "On tire sur ce fil, puis on le renforce.",
      "Un bloc cabossé ? On le polit ensemble.",
      "On efface les griffures : mission réparation.",
      "Je fais une grimace, mais on va y arriver.",
      "Pause bricolage : on consolide ce bloc.",
      "Je t’épaule pour réparer cette faille.",
      "Réparer maintenant, fanfaronner après.",
      "On corrige, on rigole, on repart.",
      "Mission rustine : rapide et indolore.",
      "On remet ce bloc en forme avec malice.",
      "Une réparation gobeline, et on continue.",
    ],
    priority: [
      "Je parie que ce bloc te fera gagner vite.",
      "Celui-ci est juteux : on fonce !",
      "Bloc prioritaire repéré par le gobelin malin.",
      "Je mise sur ce bloc : jackpot d’apprentissage.",
      "On attaque ce bloc, il en vaut la peine.",
      "Prends ce raccourci : ce bloc d’abord.",
      "Je pointe mon doigt gobelin : commence ici.",
      "Ce bloc va te propulser, promis.",
      "Focus gobelin : ce bloc est la clé.",
      "Cible dorée repérée. On y va ?",
      "On grille la file : ce bloc passe en priorité.",
      "Je te chuchote : c’est le bon choix du jour.",
      "Un bloc vip t’attend. Prêt ?",
      "J’ai flairé le meilleur coup : ce bloc.",
      "On saute dessus, il est top pour toi.",
      "Plan malin : ce bloc, puis le reste.",
      "Ce bloc ouvre la porte. On le débloque.",
      "Priorité gobeline activée sur ce bloc.",
    ],
    spaced: [
      "Hé, on n’a pas vu ce bloc depuis longtemps !",
      "Petit rappel malin : revisitons ce bloc.",
      "On dépoussière un vieux bloc. Rapide !",
      "Un saut dans le passé : ce bloc revient.",
      "Je remets ce bloc sur la table. Go !",
      "Rappel malin : on va le rendre frais.",
      "On réveille ce bloc qui dormait.",
      "Le gobelin aime les surprises : retour ici.",
      "On refait un tour sur ce bloc ancien.",
      "Révision éclair pour garder la main.",
      "On ranime ce bloc, sans stress.",
      "Piqûre de rappel : ce bloc a besoin d’amour.",
      "On fait un coucou à ce bloc oublié.",
      "Un clin d’œil au passé : on repasse là.",
      "Rappel gobelin : ce bloc veut revenir.",
      "On vérifie que ce bloc tient toujours.",
      "Réactivation rapide : on s’amuse aussi.",
      "On revisite ce bloc, version malice.",
    ],
    craft: [
      "On mélange deux blocs, façon potion gobeline.",
      "Atelier bricolage : on combine des notions.",
      "Je te propose un duo étonnant. Prêt ?",
      "On tisse deux blocs pour un truc génial.",
      "Défi : fusionner ces deux blocs solides.",
      "On assemble et on crée, easy.",
      "Recette gobeline : deux blocs, une mission.",
      "On fait un mix malin : craft du jour.",
      "On associe ces blocs pour briller.",
      "Combo fun : deux blocs main dans la main.",
      "On bidouille un craft efficace.",
      "On crée un pont entre ces deux idées.",
      "Mission atelier : on teste ce mélange.",
      "On bricole un duo gagnant.",
      "Deux blocs, double fun, une mission.",
      "On fait danser deux blocs ensemble.",
      "On invente un craft rapide et malin.",
      "On combine et on s’amuse : mission craft.",
    ],
  },
}

function storageKey(npcId: NpcId, reason: ReasonCode) {
  return `malocraft.npc.lastLines.${npcId}.${reason}`
}

function loadRecent(npcId: NpcId, reason: ReasonCode): number[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(npcId, reason))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((n: any) => typeof n === 'number') : []
  } catch {
    return []
  }
}

function saveRecent(npcId: NpcId, reason: ReasonCode, indices: number[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(storageKey(npcId, reason), JSON.stringify(indices.slice(-5)))
}

export function pickNpcLine(params: { npcId: NpcId, reason: ReasonCode, dateKey: string }): string {
  const pool = NPC_LINES[params.npcId][params.reason]
  if (!pool.length) return ''
  const recent = loadRecent(params.npcId, params.reason)
  let chosenIdx = 0
  for (let attempt = 0; attempt < 6; attempt++) {
    const idx = Math.floor(Math.random() * pool.length)
    if (!recent.includes(idx) || attempt === 5) {
      chosenIdx = idx
      break
    }
  }
  saveRecent(params.npcId, params.reason, [...recent, chosenIdx])
  return pool[chosenIdx]
}
