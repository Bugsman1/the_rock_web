import { z } from "zod";
import { isIsoDate, isTimeValue } from "@/lib/datetime";
import type { IsoTimestamp } from "@/lib/format";
import { isValidPhone } from "@/lib/phone";
import type { ProjectId } from "@/lib/projects";

export const employeeJobs = ["manager", "supervisor", "refiner"] as const;

export type EmployeeJob = (typeof employeeJobs)[number];

export type Employee = {
  id: string;
  project: ProjectId;
  matricule: string;
  name: string;
  job: EmployeeJob;
  phone: string;
  monthlySalary: number;
  startedOn: string;
  earned: number;
  withdrawn: number;
  balance: number;
};

export type Withdrawal = {
  id: string;
  employee: string;
  amount: number;
  at: IsoTimestamp;
  note: string;
  byName: string;
};

export const NOTE_MAX_LENGTH = 500;

const TEXT_MAX_LENGTH = 100;

export function createEmployeeSchema(messages: {
  required: string;
  phoneInvalid: string;
  dateInvalid: string;
  salaryInvalid: string;
}) {
  return z.object({
    matricule: z.string().trim().min(1, messages.required).max(TEXT_MAX_LENGTH),
    name: z.string().trim().min(1, messages.required).max(TEXT_MAX_LENGTH),
    job: z.enum(employeeJobs, { error: messages.required }),
    phone: z
      .string()
      .trim()
      .min(1, { message: messages.required, abort: true })
      .refine(isValidPhone, messages.phoneInvalid),
    monthlySalary: z.number({ error: messages.salaryInvalid }).positive(messages.salaryInvalid),
    startedOn: z
      .string()
      .min(1, { message: messages.required, abort: true })
      .refine(isIsoDate, messages.dateInvalid),
  });
}

export type EmployeeValues = z.infer<ReturnType<typeof createEmployeeSchema>>;

const employeeFields: readonly (keyof EmployeeValues)[] = [
  "matricule",
  "name",
  "job",
  "phone",
  "monthlySalary",
  "startedOn",
];

export function isEmployeeField(value: string): value is keyof EmployeeValues {
  return employeeFields.some((field) => field === value);
}

export function createWithdrawalSchema(messages: {
  required: string;
  dateInvalid: string;
  timeInvalid: string;
  amountInvalid: string;
}) {
  return z.object({
    amount: z.number({ error: messages.amountInvalid }).positive(messages.amountInvalid),
    date: z
      .string()
      .min(1, { message: messages.required, abort: true })
      .refine(isIsoDate, messages.dateInvalid),
    time: z
      .string()
      .min(1, { message: messages.required, abort: true })
      .refine(isTimeValue, messages.timeInvalid),
    note: z.string().trim().max(NOTE_MAX_LENGTH),
  });
}

export type WithdrawalValues = z.infer<ReturnType<typeof createWithdrawalSchema>>;

const withdrawalFields: readonly (keyof WithdrawalValues)[] = ["amount", "date", "time", "note"];

export function isWithdrawalField(value: string): value is keyof WithdrawalValues {
  return withdrawalFields.some((field) => field === value);
}

export function projectEmployeesSummary(employees: readonly Employee[], project: ProjectId) {
  const own = employees.filter((employee) => employee.project === project);

  return {
    count: own.length,
    owed: own.reduce((total, employee) => total + employee.balance, 0),
  };
}
