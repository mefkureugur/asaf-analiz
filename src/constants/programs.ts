export const PROGRAMS = ["6", "7", "8", "11", "12", "Mezun", "Mood"] as const;

export type ProgramType = (typeof PROGRAMS)[number];
