"use client";

import { useParams } from "next/navigation";
import ProgramFormPage from "@/components/ProgramFormPage";
import { athleteProgramStore } from "@/lib/programStore";

export default function EditAthleteProgramPage() {
  const { id: athleteId, pid: programId } = useParams<{ id: string; pid: string }>();
  return (
    <ProgramFormPage
      mode="edit"
      programId={programId}
      makeStore={(coachId) => athleteProgramStore(coachId, athleteId)}
      title="Modifica programma"
    />
  );
}
