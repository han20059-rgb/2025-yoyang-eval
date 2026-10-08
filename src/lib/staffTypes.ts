import type { RoleId } from "@/data/duties";

export type StaffIdentity = {
  leaveRecordId: number;
  name: string;
  jobType: string;
  evalRole: RoleId | null;
  roleStatus: "mapped" | "review";
  roleNote: string;
  isAdmin?: boolean;
};
