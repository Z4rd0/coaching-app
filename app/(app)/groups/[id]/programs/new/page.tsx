"use client";

import { useParams } from "next/navigation";
import ProgramFormPage from "@/components/ProgramFormPage";
import { groupProgramStore } from "@/lib/programStore";

export default function NewGroupProgramPage() {
  const { id: groupId } = useParams<{ id: string }>();
  return (
    <ProgramFormPage
      mode="create"
      makeStore={(coachId) => groupProgramStore(coachId, groupId)}
      title="Nuovo programma di gruppo"
      allowTemplateCopy
    />
  );
}
