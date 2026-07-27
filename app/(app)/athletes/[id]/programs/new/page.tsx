"use client";

import { useParams } from "next/navigation";
import ProgramFormPage from "@/components/ProgramFormPage";
import { athleteProgramStore } from "@/lib/programStore";

export default function NewAthleteProgramPage() {
  const { id: athleteId } = useParams<{ id: string }>();
  return (
    <ProgramFormPage
      mode="create"
      makeStore={(coachId) => athleteProgramStore(coachId, athleteId)}
      title="Nuovo programma"
      allowTemplateCopy
    />
  );
}
