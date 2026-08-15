/**
 * Cotisations périodiques — logique pure, partagée mobile ↔ dashboard.
 *
 * Modèle retenu :
 *   - la mosquée fixe UN montant mensuel de référence (`mosque.contribution_amount`) ;
 *   - un fidèle doit une cotisation pour chaque mois depuis son adhésion (`joined_at`) —
 *     on ne réclame jamais les mois antérieurs à son arrivée ;
 *   - un mois est **couvert** quand la somme de ses cotisations VALIDÉES atteint le
 *     montant de référence. Les versements partiels s'additionnent, et un versement
 *     supérieur ne déborde PAS sur le mois suivant (il reste imputé au mois déclaré).
 *
 * Distinction volontaire entre deux situations que l'UI ne doit pas confondre :
 *   - **en retard** : mois échus non couverts → c'est l'arriéré à réclamer ;
 *   - **mois courant** : dû mais pas encore en retard → c'est un simple rappel.
 */

/** `2026-08` — période d'une date. */
export function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Ajoute `n` mois à une période `YYYY-MM`. */
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y ?? 1970, (m ?? 1) - 1 + n, 1);
  return periodOf(d);
}

/** `août 2026` — libellé lisible d'une période. */
export function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(y ?? 1970, (m ?? 1) - 1, 1),
  );
}

/**
 * Toutes les périodes dues, du mois d'adhésion au mois courant inclus.
 * Le mois courant est inclus : il est dû dès qu'on y entre — c'est ce qui
 * déclenche le rappel de début de mois.
 */
export function expectedPeriods(joinedAt: string, now: Date = new Date()): string[] {
  const joined = new Date(joinedAt);
  if (Number.isNaN(joined.getTime())) return [];

  const start = periodOf(joined);
  const end = periodOf(now);
  if (start > end) return [];

  const periods: string[] = [];
  let cursor = start;
  // Garde-fou : 600 mois = 50 ans, largement au-delà de tout cas réel.
  for (let i = 0; cursor <= end && i < 600; i += 1) {
    periods.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return periods;
}

export type ContributionLike = {
  period: string;
  amount: number;
  status: string;
};

export type CotisationStatus = {
  /** Montant mensuel de référence utilisé pour le calcul. */
  reference: number;
  /** Périodes échues non couvertes — l'arriéré proprement dit. */
  late: string[];
  /** Le mois courant s'il n'est pas encore couvert. */
  currentDue: string | null;
  /** Nombre de mois en retard (hors mois courant). */
  monthsLate: number;
  /** Somme réclamable au titre des mois en retard. */
  amountLate: number;
  /** Reste à payer sur le mois courant (tient compte d'un versement partiel). */
  remainingThisMonth: number;
  /** Période impayée la plus ancienne, mois courant compris. */
  oldestUnpaid: string | null;
  /** Vrai si tout est couvert, mois courant inclus. */
  upToDate: boolean;
};

/**
 * Situation de cotisation d'un fidèle.
 * `contributions` doit contenir SES cotisations ; seules les `valide` comptent —
 * une déclaration en attente n'est pas de l'argent encaissé.
 */
export function cotisationStatus(input: {
  joinedAt: string;
  contributions: ContributionLike[];
  reference: number;
  now?: Date;
}): CotisationStatus {
  const { joinedAt, contributions, reference } = input;
  const now = input.now ?? new Date();
  const current = periodOf(now);

  const paidByPeriod = new Map<string, number>();
  for (const c of contributions) {
    if (c.status !== "valide") continue;
    paidByPeriod.set(c.period, (paidByPeriod.get(c.period) ?? 0) + Number(c.amount));
  }

  const expected = expectedPeriods(joinedAt, now);
  const outstanding = expected.filter((p) => (paidByPeriod.get(p) ?? 0) < reference);

  const late = outstanding.filter((p) => p < current);
  const currentDue = outstanding.includes(current) ? current : null;

  return {
    reference,
    late,
    currentDue,
    monthsLate: late.length,
    amountLate: late.length * reference,
    remainingThisMonth: currentDue
      ? Math.max(0, reference - (paidByPeriod.get(current) ?? 0))
      : 0,
    oldestUnpaid: outstanding[0] ?? null,
    upToDate: outstanding.length === 0,
  };
}

/**
 * Phrase prête à afficher — évite que chaque écran réinvente sa formulation
 * et mélange « en retard » et « dû ce mois-ci ».
 */
export function cotisationSummary(status: CotisationStatus, formatAmount: (n: number) => string): string {
  if (status.upToDate) return "Vous êtes à jour de vos cotisations.";

  const parts: string[] = [];
  if (status.monthsLate > 0) {
    parts.push(
      `${status.monthsLate} mois de retard (${formatAmount(status.amountLate)})`,
    );
  }
  if (status.currentDue) {
    parts.push(
      status.remainingThisMonth < status.reference
        ? `reste ${formatAmount(status.remainingThisMonth)} pour ${formatPeriod(status.currentDue)}`
        : `${formatPeriod(status.currentDue)} à régler`,
    );
  }
  return parts.join(" · ");
}
