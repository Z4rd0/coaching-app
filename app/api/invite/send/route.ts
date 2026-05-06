import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAthlete, createInvite, getCoach } from "@/lib/firestore";

export async function POST(req: NextRequest) {
  // Lazy init to avoid build-time crash when env vars are not set
  const resend = new Resend(process.env.RESEND_API_KEY);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { coachId, name, email, sport, goals, notes } = await req.json();

    if (!coachId || !name || !email) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    // 1. Get coach info for the email
    const coach = await getCoach(coachId);
    if (!coach) {
      return NextResponse.json({ error: "Coach non trovato" }, { status: 404 });
    }

    // 2. Create athlete profile (status: "invited")
    const athleteRef = await createAthlete(coachId, {
      name,
      email,
      sport: sport ?? "",
      goals: goals ?? "",
      notes: notes ?? "",
      status: "invited",
      garminConnected: false,
    });
    const athleteId = athleteRef.id;

    // 3. Create invite record
    const { ref: inviteRef } = await createInvite(coachId, {
      athleteId,
      email,
      coachId,
      coachName: coach.name,
      status: "pending",
    });
    const token = inviteRef.id; // use doc ID as token (Firestore generates a random 20-char ID)

    // 4. Send email via Resend
    const acceptUrl = `${APP_URL}/invite/accept?token=${token}&coach=${coachId}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@coachapp.it",
      to: email,
      subject: `${coach.name} ti ha invitato su Coach App`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #f1f5f9; padding: 32px; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: #1D9E75; border-radius: 14px; margin-bottom: 12px;">
              <span style="font-size: 28px;">⚡</span>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Coach App</h1>
          </div>

          <p style="font-size: 16px; color: #94a3b8; margin-bottom: 8px;">Ciao ${name} 👋</p>
          <p style="font-size: 18px; font-weight: 600; color: #f1f5f9; margin-bottom: 24px;">
            <strong style="color: #1D9E75;">${coach.name}</strong> ti ha invitato come atleta sulla sua piattaforma di coaching.
          </p>

          <p style="color: #94a3b8; margin-bottom: 32px; font-size: 14px; line-height: 1.6;">
            Accetta l'invito per accedere ai tuoi programmi di allenamento, loggare le sessioni e ricevere feedback dal tuo coach.
          </p>

          <a href="${acceptUrl}"
             style="display: block; background: #1D9E75; color: white; text-align: center; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
            Accetta invito →
          </a>

          <p style="color: #475569; font-size: 12px; text-align: center;">
            Questo link scade tra 7 giorni. Se non conosci ${coach.name}, ignora questa email.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, athleteId, inviteId: inviteRef.id });
  } catch (err) {
    console.error("invite/send error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
