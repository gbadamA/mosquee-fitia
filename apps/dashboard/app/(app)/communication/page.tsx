"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessagesSquare,
  Send,
  Copy,
  Check,
  MessageCircle,
  Smartphone,
  Bell,
} from "lucide-react";
import {
  sendMessageSchema,
  composeText,
  whatsappLink,
  smsLink,
  formatPhoneCI,
  todayISO,
  CHANNEL_LABELS,
  AUDIENCE_LABELS,
  MESSAGE_TEMPLATES,
  formatEventDate,
  type MessageChannel,
  type MessageAudience,
  type Profile,
  type MosqueEvent,
} from "@fitia/shared";
import type { ContributionRow, EventRegistrationRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Diffusion vers les fidèles.
 *
 * Choix assumé : **pas d'API WhatsApp/SMS**. Elle exige un compte marchand que la
 * mosquée n'a pas, et attendre ce contrat bloquerait la mise en service. On génère
 * donc des liens pré-remplis, un par destinataire : le secrétaire clique, WhatsApp
 * s'ouvre avec le message déjà écrit. Le port `BulkMessenger` (packages/shared)
 * fige le contrat pour brancher un vrai fournisseur plus tard.
 */

type LogRow = {
  id: string;
  channel: MessageChannel;
  audience: MessageAudience;
  title: string;
  body: string;
  recipients_count: number;
  delivered_count: number | null;
  created_at: string;
};

const CHANNEL_ICONS: Record<MessageChannel, typeof Bell> = {
  push: Bell,
  whatsapp: MessageCircle,
  sms: Smartphone,
};

export default function CommunicationPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [events, setEvents] = useState<MosqueEvent[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistrationRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<MessageChannel>("whatsapp");
  const [audience, setAudience] = useState<MessageAudience>("tous");
  const [eventId, setEventId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const [{ data: p }, { data: c }, { data: e }, { data: r }, { data: l }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "fidele").order("full_name"),
      supabase.from("contributions").select("*").eq("status", "valide"),
      supabase
        .from("events")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at"),
      supabase.from("event_registrations").select("*"),
      supabase.from("message_log").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    setMembers((p as Profile[]) ?? []);
    setContributions((c as ContributionRow[]) ?? []);
    const evs = (e as MosqueEvent[]) ?? [];
    setEvents(evs);
    setEventId((current) => current || (evs[0]?.id ?? ""));
    setRegistrations((r as EventRegistrationRow[]) ?? []);
    setLogs((l as LogRow[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const period = todayISO().slice(0, 7);

  /** Destinataires selon l'audience choisie. */
  const recipients = useMemo(() => {
    if (audience === "retardataires") {
      const aJour = new Set(
        contributions.filter((c) => c.period === period).map((c) => c.member_id),
      );
      return members.filter((m) => !aJour.has(m.id));
    }
    if (audience === "evenement") {
      const inscrits = new Set(
        registrations.filter((r) => r.event_id === eventId).map((r) => r.member_id),
      );
      return members.filter((m) => inscrits.has(m.id));
    }
    return members;
  }, [audience, members, contributions, registrations, eventId, period]);

  /** Destinataires réellement joignables sur le canal choisi. */
  const reachable = useMemo(
    () => (channel === "push" ? recipients.filter((m) => m.push_token) : recipients.filter((m) => m.phone)),
    [recipients, channel],
  );

  const text = composeText(title, body);

  function applyTemplate(key: string) {
    const t = MESSAGE_TEMPLATES.find((m) => m.key === key);
    if (!t) return;
    setTitle(t.title);
    setBody(t.body);
    setAudience(t.audience);
  }

  async function logSend(delivered: number | null) {
    const parsed = sendMessageSchema.safeParse({
      title,
      body,
      channel,
      audience,
      event_id: audience === "evenement" ? eventId || null : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return false;
    }
    const { error: dbError } = await getSupabase().from("message_log").insert({
      channel: parsed.data.channel,
      audience: parsed.data.audience,
      event_id: parsed.data.event_id,
      title: parsed.data.title,
      body: parsed.data.body,
      recipients_count: reachable.length,
      delivered_count: delivered,
      sent_by: profile?.id ?? null,
    });
    if (dbError) {
      setError(dbError.message);
      return false;
    }
    load();
    return true;
  }

  /** Push : envoi réel via l'Edge Function. */
  async function sendPush() {
    setError(null);
    setMessage(null);
    setBusy(true);

    const { data, error: fnError } = await getSupabase().functions.invoke("send-push", {
      body: { title, body, member_ids: reachable.map((m) => m.id) },
    });
    setBusy(false);

    const failure = fnError?.message ?? (data as { error?: string } | null)?.error;
    if (failure) {
      setError(failure);
      return;
    }

    const sent = (data as { sent?: number } | null)?.sent ?? 0;
    if (await logSend(sent)) {
      setMessage(
        sent > 0
          ? `${sent} notification(s) envoyée(s).`
          : "Aucun fidèle n'a encore de jeton de notification. Les push distantes exigent un build EAS installé sur le téléphone.",
      );
    }
  }

  /** WhatsApp / SMS : envoi assisté, on journalise l'intention. */
  async function markAsSent() {
    setError(null);
    setMessage(null);
    if (await logSend(null)) {
      setMessage(`Envoi consigné pour ${reachable.length} destinataire(s).`);
    }
  }

  async function copyNumbers() {
    const numbers = reachable.map((m) => m.phone).filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(numbers);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible : autorisez le presse-papiers dans le navigateur.");
    }
  }

  const canSend = title.trim().length >= 3 && body.trim().length > 0 && reachable.length > 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <MessagesSquare className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Communication</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Relances, rappels et messages groupés
          </p>
        </div>
      </header>

      {message && (
        <div className="mb-6 rounded-md border border-success/40 bg-success/10 p-4 text-caption text-success">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-md border border-danger/40 bg-danger/10 p-4 text-caption text-danger">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface">
        {/* Modèles */}
        <p className="mb-2 text-caption text-light-muted dark:text-dark-muted">Modèle</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {MESSAGE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => applyTemplate(t.key)}
              className="rounded-full border border-light-border px-3.5 py-1.5 text-caption transition hover:border-primary hover:text-primary dark:border-dark-border"
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du message"
          className="mb-3 w-full rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Votre message aux fidèles…"
          className="mb-5 w-full resize-none rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
        />

        {/* Canal */}
        <p className="mb-2 text-caption text-light-muted dark:text-dark-muted">Canal</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {(Object.keys(CHANNEL_LABELS) as MessageChannel[]).map((c) => {
            const Icon = CHANNEL_ICONS[c];
            return (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-caption font-medium transition ${
                  channel === c
                    ? "bg-primary text-white"
                    : "border border-light-border text-light-muted hover:border-primary dark:border-dark-border dark:text-dark-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {CHANNEL_LABELS[c]}
              </button>
            );
          })}
        </div>

        {/* Audience */}
        <p className="mb-2 text-caption text-light-muted dark:text-dark-muted">Destinataires</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(AUDIENCE_LABELS) as MessageAudience[]).map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className={`rounded-full px-4 py-2 text-caption font-medium transition ${
                audience === a
                  ? "bg-secondary text-light-text"
                  : "border border-light-border text-light-muted hover:border-secondary dark:border-dark-border dark:text-dark-muted"
              }`}
            >
              {AUDIENCE_LABELS[a]}
            </button>
          ))}
        </div>

        {audience === "evenement" && (
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mb-3 w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} — {formatEventDate(e.starts_at)}
              </option>
            ))}
            {events.length === 0 && <option value="">Aucun événement à venir</option>}
          </select>
        )}

        <p className="mb-5 text-caption text-light-muted dark:text-dark-muted">
          {recipients.length} fidèle(s) dans cette audience ·{" "}
          <strong className={reachable.length === 0 ? "text-danger" : "text-primary"}>
            {reachable.length} joignable(s)
          </strong>{" "}
          {channel === "push" ? "avec l'application installée" : "avec un numéro renseigné"}
        </p>

        {/* Action */}
        {channel === "push" ? (
          <button
            onClick={sendPush}
            disabled={busy || !canSend}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {busy ? "Envoi…" : "Envoyer la notification"}
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyNumbers}
              disabled={reachable.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-light-border px-4 py-2.5 text-caption transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-border"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copié" : "Copier les numéros"}
            </button>
            <button
              onClick={markAsSent}
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Consigner l&apos;envoi
            </button>
          </div>
        )}
      </section>

      {/* Liste cliquable pour WhatsApp / SMS */}
      {channel !== "push" && canSend && (
        <>
          <h2 className="mb-2 mt-8 font-display text-h3">Envoyer un par un</h2>
          <p className="mb-3 text-caption text-light-muted dark:text-dark-muted">
            Chaque lien ouvre {CHANNEL_LABELS[channel]} avec le message déjà rédigé.
          </p>
          <ul className="space-y-2">
            {reachable.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-light-border bg-light-surface p-3 dark:border-dark-border dark:bg-dark-surface"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium">{m.full_name ?? "Fidèle"}</p>
                  <p className="text-caption text-light-muted dark:text-dark-muted">
                    {formatPhoneCI(m.phone)}
                  </p>
                </div>
                <a
                  href={
                    channel === "whatsapp"
                      ? whatsappLink(m.phone ?? "", text)
                      : smsLink(m.phone ?? "", text)
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-caption font-medium text-white transition hover:bg-primary-hover"
                >
                  <Send className="h-3.5 w-3.5" /> Ouvrir
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Historique */}
      <h2 className="mb-3 mt-10 font-display text-h3">Derniers envois</h2>
      <ul className="space-y-2">
        {logs.map((l) => {
          const Icon = CHANNEL_ICONS[l.channel];
          return (
            <li
              key={l.id}
              className="rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-caption text-light-muted dark:text-dark-muted">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span>{CHANNEL_LABELS[l.channel]}</span>
                <span>·</span>
                <span>{AUDIENCE_LABELS[l.audience]}</span>
                <span>·</span>
                <span>
                  {l.delivered_count !== null
                    ? `${l.delivered_count}/${l.recipients_count} remis`
                    : `${l.recipients_count} destinataire(s)`}
                </span>
                <span>·</span>
                <span>
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(l.created_at))}
                </span>
              </div>
              <p className="font-medium">{l.title}</p>
              <p className="text-body text-light-muted dark:text-dark-muted">{l.body}</p>
            </li>
          );
        })}
        {logs.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucun envoi pour le moment.
          </li>
        )}
      </ul>
    </main>
  );
}
