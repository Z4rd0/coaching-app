"use client";

import { useParams } from "next/navigation";
import ProgramFormPage from "@/components/ProgramFormPage";
import { libraryProgramStore } from "@/lib/programStore";

export default function EditProgramPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ProgramFormPage
      mode="edit"
      programId={id}
      makeStore={libraryProgramStore}
      title="Modifica programma"
    />
  );
}
