import type { ImportedRecord } from "../services/excelImport.service";

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'manager' | 'unauthorized';
  branchId: string;
  displayName: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  updateMyPassword: (newPass: string) => Promise<void>;
  updateMyEmail: (newEmail: string) => Promise<void>;
}

export interface DataContextType {
  allRecords: ImportedRecord[];
  loading: boolean;
}
