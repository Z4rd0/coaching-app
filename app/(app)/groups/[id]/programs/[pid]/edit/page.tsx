"use client";

import { useParams } from "next/navigation";
import ProgramFormPage from "@/components/ProgramFormPage";
import { groupProgramStore } from "@/lib/programStore";

export default function EditGroupProgramPage() {
  const { id: groupId, pid: programId } = useParams<{ id: string; pid: string }>();
  return (
    <ProgramFormPage
      mode="edit"
      programId={programId}
      makeStore={(coachId) => groupProgramStore(coachId, groupId)}
      title="Modifica programma di gruppo"
    />
  );
}
