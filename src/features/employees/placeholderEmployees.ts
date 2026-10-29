import type { EmployeeJob } from "./employees";

type PlaceholderWithdrawal = {
  amount: number;
  at: string;
  note: string;
  byName: string;
};

type PlaceholderEmployee = {
  matricule: string;
  name: string;
  job: EmployeeJob;
  phone: string;
  monthlySalary: number;
  startedOn: string;
  earned: number;
  withdrawals: readonly PlaceholderWithdrawal[];
};

export const placeholderEmployees: readonly PlaceholderEmployee[] = [
  {
    matricule: "EMP-001",
    name: "محمد ولد سيدي",
    job: "manager",
    phone: "+222 22 41 18 30",
    monthlySalary: 30000,
    startedOn: "2026-01-05",
    earned: 293000,
    withdrawals: [
      { amount: 30000, at: "2026-02-01T09:00:00Z", note: "راتب يناير", byName: "admin" },
      { amount: 30000, at: "2026-03-01T09:00:00Z", note: "راتب فبراير", byName: "admin" },
      { amount: 15000, at: "2026-04-10T11:30:00Z", note: "سلفة", byName: "admin" },
    ],
  },
  {
    matricule: "EMP-002",
    name: "Sidi Ahmed",
    job: "supervisor",
    phone: "+222 36 52 07 14",
    monthlySalary: 20000,
    startedOn: "2026-06-15",
    earned: 89000,
    withdrawals: [
      { amount: 20000, at: "2026-08-01T08:00:00Z", note: "", byName: "admin" },
      { amount: 20000, at: "2026-09-01T08:00:00Z", note: "", byName: "admin" },
    ],
  },
  {
    matricule: "EMP-003",
    name: "أحمد ولد إبراهيم",
    job: "refiner",
    phone: "+222 46 10 93 25",
    monthlySalary: 15000,
    startedOn: "2026-09-01",
    earned: 29000,
    withdrawals: [
      { amount: 25000, at: "2026-09-20T10:00:00Z", note: "سلفة", byName: "admin" },
      { amount: 10000, at: "2026-10-15T10:00:00Z", note: "سلفة ثانية", byName: "admin" },
    ],
  },
];
