// ─────────────────────────────────────────────
//  CORRUPTOCRACY — Game Data v2
// ─────────────────────────────────────────────

// ── COMPANIES ────────────────────────────────
// Each company has upgrades and generates passive income per tick
export const COMPANIES = {
  bratwurst: {
    id: "bratwurst",
    name: "Bratwurst AG",
    icon: "🌭",
    desc: "Dein erstes legales Unternehmen. Überteuerte Würste, ehrliche Buchführung.",
    unlockEra: 1,
    unlockCost: 500,
    baseIncome: 50, // per tick (every 5s)
    upgrades: [
      { id: "bs_u1", name: "Zweiter Stand", desc: "Doppelter Umsatz, halb so viel Gewissen.", costMult: 2, incomeMult: 2, cost: 2000 },
      { id: "bs_u2", name: "Franchise-Modell", desc: "Andere arbeiten, du kassierst.", costMult: 4, incomeMult: 4, cost: 8000 },
      { id: "bs_u3", name: "Börsengang", desc: "Retail-Investoren finanzieren deine Reise.", costMult: 10, incomeMult: 10, cost: 30000 },
    ],
  },
  club: {
    id: "club",
    name: "FC Korruptia",
    icon: "⚽",
    desc: "Dein Fußballverein. Legales Geldwäscheinstrument mit Fanseele.",
    unlockEra: 1,
    unlockCost: 3000,
    baseIncome: 300,
    upgrades: [
      { id: "cl_u1", name: "Neues Stadion", desc: "Nennungsrecht verkauft: 'Schwarzgeld Arena'.", cost: 10000, incomeMult: 2.5 },
      { id: "cl_u2", name: "Internationaler Transfer", desc: "Spiele in der Champions League. Oder kaufe sie.", cost: 40000, incomeMult: 5 },
      { id: "cl_u3", name: "Eigener TV-Kanal", desc: "Jede Sendeminute: dein Content, deine Werbung.", cost: 120000, incomeMult: 12 },
    ],
  },
  island: {
    id: "island",
    name: "Ball-Tropica",
    icon: "🏝️",
    desc: "Dein Inselstaat. Flagge: ein Ball auf Goldgrund. Hymne: Chart-Nummer 1 (gekauft).",
    unlockEra: 2,
    unlockCost: 0, // unlocked by era transition
    baseIncome: 800,
    upgrades: [
      { id: "is_u1", name: "Steuergesetze 'optimieren'", desc: "0% Körperschaftssteuer. Multinationale danken es.", cost: 15000, incomeMult: 3 },
      { id: "is_u2", name: "Krypto-Regulierung: keine", desc: "Alle Coins sind hier legal. Besonders deine.", cost: 50000, incomeMult: 6 },
      { id: "is_u3", name: "UN-Mitgliedschaft erkaufen", desc: "1 Stimme. Ausreichend um alles zu blockieren.", cost: 200000, incomeMult: 15 },
    ],
  },
  bank: {
    id: "bank",
    name: "Zentralbank Ball-Tropica",
    icon: "🏦",
    desc: "Du druckst Geld. Du leihst dir Geld. Du zahlst dir Zinsen. Perfekter Kreislauf.",
    unlockEra: 3,
    unlockCost: 0,
    baseIncome: 5000,
    upgrades: [
      { id: "bk_u1", name: "Eigene Kryptowährung", desc: "FIFA-Coin. Backed by: Vertrauen in dich.", cost: 80000, incomeMult: 4 },
      { id: "bk_u2", name: "Internationale Filialen", desc: "Cayman Islands, Luxemburg, Vaduz.", cost: 300000, incomeMult: 10 },
      { id: "bk_u3", name: "Too Big To Fail", desc: "Der Staat rettet dich. Du bist der Staat.", cost: 1000000, incomeMult: 30 },
    ],
  },
  fifa: {
    id: "fifa",
    name: "FIFA Corp",
    icon: "🌍",
    desc: "Du hast die FIFA aufgekauft. Fußball ist jetzt ein Finanzprodukt.",
    unlockEra: 4,
    unlockCost: 0,
    baseIncome: 50000,
    upgrades: [
      { id: "fi_u1", name: "WM alle 2 Jahre", desc: "Doppelte Einnahmen. Spieler egal.", cost: 2000000, incomeMult: 5 },
      { id: "fi_u2", name: "Spielregeln patentieren", desc: "Jedes Tor: Lizenzgebühr an dich.", cost: 8000000, incomeMult: 15 },
      { id: "fi_u3", name: "Mondlizenz", desc: "Erste WM im All. Broadcast-Rechte: unbezahlbar.", cost: 30000000, incomeMult: 50 },
    ],
  },
};

// ── ERAS ─────────────────────────────────────
export const ERAS = [
  {
    id: 1,
    label: "Der Hinterhof-Verein",
    subtitle: "Schmiere, manipuliere, kassiere.",
    flavor: "Die FIFA schaut noch weg. Nutze es.",
    intro: "Du bist Vereinspräsident eines Drittliga-Klubs in Wien. Das Konto: leer. Die Moral: verhandelbar. Der Plan: unklar — aber groß.",
    unlockCost: 15000,
    unlockLabel: "Pazifik-Insel kaufen",
    unlockDesc: "Die FIFA sperrt dich lebenslang. Zeit für Plan B.",
    unlocksCompanies: ["bratwurst", "club"],
    actions: [
      {
        id: "bribe_ref",
        name: "Schiedsrichter bestechen",
        desc: "Ergebnis am grünen Tisch entschieden.",
        gain: 900, cost: 0, repEffect: -1, cooldown: 0,
        risk: { chance: 0.1, penalty: 2000, msg: "Schiedsrichter spricht mit der Presse. Schadensbegrenzung kostet $2.000." },
      },
      {
        id: "transfer",
        name: "Transfermarkt manipulieren",
        desc: "Spieler fuer dreifachen Wert verkaufen.",
        gain: 5000, cost: 800, repEffect: -3, cooldown: 3,
        risk: { chance: 0.15, penalty: 5000, msg: "FIFA-Ermittlung eingeleitet. Anwaltskosten: $5.000." },
      },
      {
        id: "sponsor",
        name: "Sponsor erpressen",
        desc: "Freiwillige Zahlung fuer Markenschutz.",
        gain: 2500, cost: 0, repEffect: -2, cooldown: 2,
      },
      {
        id: "doping",
        name: "Doping-Kontrolle kaufen",
        desc: "Der Pruefer hat eine Hypothek.",
        gain: 1800, cost: 500, repEffect: -2, cooldown: 2,
        risk: { chance: 0.12, penalty: 3000, msg: "Positiver Test durchgesickert. PR-Kosten: $3.000." },
      },
      {
        id: "charity",
        name: "Charity-Spiel veranstalten",
        desc: "1% geht an Kinder. 99% verschwinden.",
        gain: 1200, cost: 200, repEffect: 3, cooldown: 1,
      },
    ],
  },
  {
    id: 2,
    label: "Der Inselstaat Ball-Tropica",
    subtitle: "Du bist jetzt Staatschef.",
    flavor: "Eigene Flagge, eigenes Recht, eigene Probleme.",
    intro: "Du hast eine Insel im Pazifik. 340 Einwohner, 0 Steuern, 1 Gesetz: was du sagst gilt. Das Problem: Infrastruktur ist teuer.",
    unlockCost: 80000,
    unlockLabel: "Zentralbank gruenden",
    unlockDesc: "Geld ist fast alle. Du erfindest neues.",
    unlocksCompanies: ["island"],
    actions: [
      {
        id: "passport",
        name: "Staatsbuergerschaft verkaufen",
        desc: "8.000 EUR fuer einen Ball-Tropica-Pass.",
        gain: 8000, cost: 0, repEffect: -1, cooldown: 1,
        risk: { chance: 0.1, penalty: 10000, msg: "Interpol ermittelt zu deinen Paessen. Anwaelte: $10.000." },
      },
      {
        id: "taxhaven",
        name: "Steueroase vermarkten",
        desc: "Multinationale stroemen herbei.",
        gain: 15000, cost: 3000, repEffect: -2, cooldown: 2,
      },
      {
        id: "currency",
        name: "Eigene Waehrung drucken",
        desc: "1 BTD = 1 BTD. Wechselkurs: beliebig.",
        gain: 12000, cost: 0, repEffect: -4, cooldown: 2,
        risk: { chance: 0.2, penalty: 8000, msg: "Inflation 400%. Staatsbuerger sind wuetend. Schadensbegrenzung: $8.000." },
      },
      {
        id: "un",
        name: "UN-Sitz erkaufen",
        desc: "Abstimmungen mit zwei Bier verhandelt.",
        gain: 5000, cost: 12000, repEffect: 6, cooldown: 3,
      },
      {
        id: "arms",
        name: "Waffenexporte legalisieren",
        desc: "Ball-Tropica wird Ruestungsstandort.",
        gain: 25000, cost: 5000, repEffect: -8, cooldown: 3,
        risk: { chance: 0.25, penalty: 30000, msg: "UN-Sanktionen drohen. Lobbying kostet $30.000." },
      },
    ],
  },
  {
    id: 3,
    label: "Das Zentralbank-Kartell",
    subtitle: "Geld drucken. Zins berechnen. Sich selbst retten.",
    flavor: "Zu gross zum Scheitern. Du bist das System.",
    intro: "Du kontrollierst die Geldmenge eines Staates. Inflation ist jetzt dein Werkzeug. Die anderen Zentralbanken beobachten dich nervoes.",
    unlockCost: 700000,
    unlockLabel: "FIFA aufkaufen",
    unlockDesc: "Genug Kapital. Zeit, alles aufzukaufen.",
    unlocksCompanies: ["bank"],
    actions: [
      {
        id: "crypto",
        name: "FIFA-Coin launchen",
        desc: "Krypto fuer den ehrlichen Korrupten.",
        gain: 100000, cost: 15000, repEffect: -2, cooldown: 2,
        risk: { chance: 0.3, penalty: 80000, msg: "FIFA-Coin crasht 80%. Investoren klagen: $80.000 Verlust." },
      },
      {
        id: "qe",
        name: "Quantitative Lockerung",
        desc: "Druckerpresse macht BRRR.",
        gain: 200000, cost: 0, repEffect: -5, cooldown: 2,
      },
      {
        id: "selfloan",
        name: "Sich selbst Kredit geben",
        desc: "Bank leiht Staat, Staat zahlt Bank, Bank = du.",
        gain: 400000, cost: 30000, repEffect: -3, cooldown: 3,
      },
      {
        id: "bailout",
        name: "Konkurrenten in Insolvenz draengen",
        desc: "Und dann guenstig aufkaufen.",
        gain: 300000, cost: 80000, repEffect: -5, cooldown: 3,
        risk: { chance: 0.2, penalty: 200000, msg: "Kartellamt ermittelt. Strafe: $200.000." },
      },
      {
        id: "ponzi",
        name: "Staatsfonds aufsetzen",
        desc: "Neue Investoren zahlen alte aus. Klassiker.",
        gain: 500000, cost: 50000, repEffect: -10, cooldown: 4,
        risk: { chance: 0.4, penalty: 500000, msg: "Schema fliegt auf. Staatsanwalt ermittelt: $500.000 Verlust." },
      },
    ],
  },
  {
    id: 4,
    label: "Absolute Weltherrschaft",
    subtitle: "Du besitzt die FIFA, eine Bank, ein Land.",
    flavor: "Was jetzt? Alles.",
    intro: "Du hast die FIFA fuer 600 Millionen gekauft. Fussball ist jetzt ein Finanzprodukt. Die Welt schaut zu. Und bezahlt.",
    unlockCost: null,
    unlocksCompanies: ["fifa"],
    actions: [
      {
        id: "rules",
        name: "Fussballregeln neu schreiben",
        desc: "Abseits legal (fuer dein Team).",
        gain: 1000000, cost: 0, repEffect: -8, cooldown: 2,
      },
      {
        id: "breathtax",
        name: "Atmen im Stadion besteuern",
        desc: "0,01 EUR / Atemzug. Bitte nicht hyperventilieren.",
        gain: 2000000, cost: 0, repEffect: -15, cooldown: 2,
      },
      {
        id: "wm",
        name: "WM 2030 auf Ball-Tropica",
        desc: "32 Teams. 1 Platz. 400m Strand.",
        gain: 10000000, cost: 3000000, repEffect: 60, cooldown: 5,
      },
      {
        id: "mars",
        name: "Mars-Kolonie fuer Steuern",
        desc: "Offshore war gestern. Outer Space.",
        gain: 25000000, cost: 8000000, repEffect: -20, cooldown: 6,
        risk: { chance: 0.15, penalty: 15000000, msg: "Rakete explodiert. Versicherung zahlt nicht: $15M Verlust." },
      },
      {
        id: "peace",
        name: "Weltfrieden stiften (PR-Stunt)",
        desc: "Nobel-Friedenspreis angestrebt.",
        gain: 5000000, cost: 1000000, repEffect: 80, cooldown: 6,
      },
    ],
  },
];

// ── DECISIONS ─────────────────────────────────
// Long-term choices with tradeoffs — shown as modal cards
export const DECISIONS = [
  {
    id: "dec_media",
    triggerEra: 1,
    triggerMoney: 5000,
    title: "Der Journalist klingelt",
    desc: "Ein Reporter der APA hat Beweise fuer deine Schiedsrichter-Bestechung. Er bietet an, die Story gegen Bezahlung zu begraben. Oder du kooperierst und wirst zum 'Whistleblower'.",
    options: [
      {
        id: "pay_off",
        label: "Mund stopfen",
        desc: "Du zahlst. Kurzfristig teuer, langfristig sicher.",
        immediate: { money: -3000 },
        longterm: { passiveBonus: 0, repEffect: 0 },
        flavor: "Der Journalist kauft sich ein Boot. Beide schweigen.",
      },
      {
        id: "whistleblow",
        label: "Als Whistleblower auftreten",
        desc: "Du verraetst einen Konkurrenten statt dich selbst. Ruf steigt, aber Feinde auch.",
        immediate: { rep: 8 },
        longterm: { repPenaltyPerEra: -5 },
        flavor: "Du zeigst mit dem Finger auf andere. Die Presse liebt dich kurz.",
      },
      {
        id: "ignore",
        label: "Ignorieren",
        desc: "Story erscheint. Schaden unbekannt.",
        immediate: { rep: -15, money: -1000 },
        longterm: {},
        flavor: "Titelseite. Foto nicht schmeichelhaft.",
        isRisky: true,
      },
    ],
  },
  {
    id: "dec_partner",
    triggerEra: 2,
    triggerMoney: 30000,
    title: "Angebot eines Scheichs",
    desc: "Ein Scheich aus einem Golfstaat bietet 50.000 EUR Investition in Ball-Tropica — aber will 40% der Staatseinnahmen. Unabhaengigkeit oder Kapital?",
    options: [
      {
        id: "accept_sheikh",
        label: "Deal annehmen",
        desc: "Sofortiges Kapital, aber du verlierst Kontrolle ueber 40% der Einnahmen.",
        immediate: { money: 50000 },
        longterm: { incomeMultiplier: 0.6 },
        flavor: "Der Scheich schickt einen Berater. Der Berater schickt Rechnungen.",
      },
      {
        id: "reject_sheikh",
        label: "Ablehnen",
        desc: "Unabhaengigkeit bleibt. Kein Geld jetzt.",
        immediate: {},
        longterm: { incomeMultiplier: 1.2 },
        flavor: "Alleine, aber frei. Zumindest von diesem Scheich.",
      },
      {
        id: "counter_sheikh",
        label: "Gegenverhandeln: 15%",
        desc: "Du versuchst auf 15% runterzuhandeln. Koennte scheitern.",
        immediate: {},
        longterm: {},
        flavor: "Riskant, aber wer nicht wagt...",
        isRisky: true,
        successRate: 0.5,
        onSuccess: { money: 50000, longterm: { incomeMultiplier: 0.85 } },
        onFail: { rep: -5, flavor: "Der Scheich geht. Beleidigte Stille." },
      },
    ],
  },
  {
    id: "dec_investigation",
    triggerEra: 3,
    triggerMoney: 200000,
    title: "Interpol-Ermittlung",
    desc: "Interpol hat eine Akte ueber dich. Ein Insider bietet dir die Akte fuer $100.000 — oder du fliechtst temporaer nach Ball-Tropica.",
    options: [
      {
        id: "buy_file",
        label: "Akte kaufen & vernichten",
        desc: "Teuer, aber die Akte verschwindet.",
        immediate: { money: -100000 },
        longterm: { repEffect: 5 },
        flavor: "Papier brennt gut.",
      },
      {
        id: "flee",
        label: "Nach Ball-Tropica fliehen",
        desc: "Du bist in deinem eigenen Staat. Keine Auslieferung.",
        immediate: { rep: -10 },
        longterm: { passiveBonus: 500 },
        flavor: "Der Sonnenschirm ist dein Buero. Gesetze: selbst geschrieben.",
      },
      {
        id: "lawyer",
        label: "Star-Anwalt engagieren",
        desc: "Teuer aber legal. Eventuell erfolgreich.",
        immediate: { money: -50000, rep: 5 },
        longterm: {},
        flavor: "Der Anwalt erscheint im Fernsehen. Oefters als noetig.",
        isRisky: true,
        successRate: 0.65,
        onSuccess: { rep: 15, flavor: "Freigesprochen. Champagner." },
        onFail: { money: -80000, flavor: "Verurteilt. Berufung laeuft. Weitere Rechnung." },
      },
    ],
  },
  {
    id: "dec_legacy",
    triggerEra: 4,
    triggerMoney: 5000000,
    title: "Was bleibt von dir?",
    desc: "Du hast alles. Ein Biograph moechte dein Leben dokumentieren. Wie willst du erinnert werden?",
    options: [
      {
        id: "villain",
        label: "Als genialer Schuft",
        desc: "Ehrlich ueber alles. Buecher verkaufen sich gut.",
        immediate: { money: 2000000, rep: -20 },
        longterm: {},
        flavor: "Bestseller. Verfilmung. Netflix zahlt gut.",
      },
      {
        id: "hero",
        label: "Als Wohltaeter",
        desc: "Eine Stiftung gruenden, alles umschreiben.",
        immediate: { money: -1000000, rep: 40 },
        longterm: { passiveBonus: 5000 },
        flavor: "Das Krankenhaus traegt deinen Namen. Die Leichen auch, aber das steht nicht im Buch.",
      },
      {
        id: "ghost",
        label: "Verschwinden",
        desc: "Alle Konten leeren, neue Identitaet.",
        immediate: { money: 10000000 },
        longterm: {},
        flavor: "Lorenz aus Wien? Nie gehoert.",
        isRisky: true,
      },
    ],
  },
];

// ── RANDOM EVENTS ─────────────────────────────
export const RANDOM_EVENTS = [
  { id: "taxraid", text: "Steuerfahnder entdeckt Offshore-Konten", detail: "15% deines Kapitals als Strafe", effect: (s) => ({ money: -Math.floor(s.money * 0.15) }), type: "danger" },
  { id: "journalist", text: "Investigativjournalistin veroeffentlicht Artikel", detail: "Ruf -8", effect: () => ({ rep: -8 }), type: "danger" },
  { id: "ally", text: "Politischer Verbuendeter schickt Koffer", detail: "12% Bonus auf aktuelles Kapital", effect: (s) => ({ money: Math.floor(s.money * 0.12) }), type: "success" },
  { id: "crypto_crash", text: "FIFA-Coin crasht 80%", detail: "8% Kapitalverlust", effect: (s) => ({ money: -Math.floor(s.money * 0.08) }), type: "danger" },
  { id: "leak", text: "Whistleblower leakt interne Dokumente", detail: "Ruf -12", effect: () => ({ rep: -12 }), type: "danger" },
  { id: "boon", text: "Konkurrent geht spektakulaer bankrott", detail: "20% Kapitalbonus", effect: (s) => ({ money: Math.floor(s.money * 0.2) }), type: "success" },
  { id: "pr", text: "Spontane PR-Kampagne geht viral", detail: "1 EUR Spende. Ruf +10.", effect: () => ({ rep: 10 }), type: "success" },
  { id: "recession", text: "Globale Rezession trifft deine Unternehmen", detail: "Passive Einkommen -50% fuer 30 Sekunden", effect: () => ({ tempDebuff: true }), type: "danger" },
  { id: "windfall", text: "Steuerrueckerstattung (irrtuemlicherweise)", detail: "Unerwartete $50.000 vom Finanzamt", effect: () => ({ money: 50000 }), type: "success" },
];

// ── TUTORIAL STEPS ────────────────────────────
export const TUTORIAL_STEPS = [
  {
    id: "t1",
    title: "Willkommen in der Schattenwirtschaft",
    body: "Du bist Praesidenten eines Drittliga-Vereins in Wien. Konto: leer. Moral: optional. Klicke auf Aktionen um Geld zu verdienen.",
    highlight: "actions",
    arrow: "down",
  },
  {
    id: "t2",
    title: "Passives Einkommen",
    body: "Unternehmen generieren automatisch Geld alle 5 Sekunden. Kaufe den Bratwurststand um sofort passives Einkommen zu starten.",
    highlight: "companies",
    arrow: "right",
  },
  {
    id: "t3",
    title: "Upgrades sind Langzeitinvestitionen",
    body: "Jedes Unternehmen hat 3 Upgrades. Sie multiplizieren das passive Einkommen — teuer, aber der ROI ist massiv.",
    highlight: "companies",
    arrow: "right",
  },
  {
    id: "t4",
    title: "Entscheidungen veraendern alles",
    body: "Manchmal erscheinen Entscheidungskarten. Diese sind nicht reversibel und haben Langzeiteffekte. Lies sorgfaeltig.",
    highlight: "none",
    arrow: "none",
  },
  {
    id: "t5",
    title: "Risiko und Strafe",
    body: "Manche Aktionen haben ein Risikoprozent. Wenn es schief geht, zahlst du eine Strafe. Hoeherer Gain = hoehere Gefahr.",
    highlight: "actions",
    arrow: "down",
  },
  {
    id: "t6",
    title: "Ruf ist nicht egal",
    body: "Sehr schlechter Ruf loest haertere Zufallsevents aus. Sehr guter Ruf gibt Boni. Balance ist alles.",
    highlight: "stats",
    arrow: "left",
  },
];

// ── HELPERS ───────────────────────────────────
export const REP_LEVELS = [
  { min: 60, label: "Weltheld", icon: "🏆", color: "#27ae60" },
  { min: 25, label: "Staatsmann", icon: "🤝", color: "#2980b9" },
  { min: 5, label: "Respektiert", icon: "😏", color: "#8e44ad" },
  { min: -10, label: "Verdaechtig", icon: "⚠️", color: "#e67e22" },
  { min: -30, label: "Gesucht", icon: "🚨", color: "#c0392b" },
  { min: -Infinity, label: "Weltfeind", icon: "💀", color: "#922b21" },
];

export function getRepLabel(rep) {
  return REP_LEVELS.find((r) => rep >= r.min) || REP_LEVELS[REP_LEVELS.length - 1];
}

export function formatMoney(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return sign + "$" + (abs / 1_000_000_000).toFixed(2) + "B";
  if (abs >= 1_000_000) return sign + "$" + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return sign + "$" + Math.round(abs / 1_000) + "K";
  return sign + "$" + Math.round(abs);
}

export function getPassiveIncome(companies, ownedCompanies, upgradesOwned, incomeMultiplier = 1, tempDebuff = false) {
  let total = 0;
  for (const [cid, company] of Object.entries(companies)) {
    if (!ownedCompanies.includes(cid)) continue;
    let income = company.baseIncome;
    const upgrades = company.upgrades.filter((u) => upgradesOwned.includes(u.id));
    for (const u of upgrades) {
      income = income * (u.incomeMult || 1);
    }
    total += income;
  }
  return Math.floor(total * incomeMultiplier * (tempDebuff ? 0.5 : 1));
}
