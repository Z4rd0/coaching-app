"use client";

import ProgramFormPage from "@/components/ProgramFormPage";
import { libraryProgramStore } from "@/lib/programStore";

export default function NewProgramPage() {
  return (
    <ProgramFormPage
      mode="create"
      makeStore={libraryProgramStore}
      title="Nuovo programma"
    />
  );
}
