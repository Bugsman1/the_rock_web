import { z } from "zod";
import type { ApiSchema, BackendFieldErrors, FieldErrors } from "@/lib/api/client";
import { isIsoDate, isTimeValue } from "@/lib/datetime";
import { fromDecimal, toMoneyDecimal } from "@/lib/format";
import type { IsoTimestamp } from "@/lib/format";
import { formatPhone, isValidPhone, phoneToApi } from "@/lib/phone";
import type { ProjectId } from "@/lib/projects";

export const jobTitles = [
  "ADM",
  "CHF",
  "ENG",
  "MOU",
  "MIN",
  "MEC",
  "SOU",
  "TEC",
  "SAF",
] as const satisfies readonly ApiSchema<"Employee">["job_title"][];

export type JobTitle = (typeof jobTitles)[number];

export function isJobTitle(value: string): value is JobTitle {
  return jobTitles.some((title) => title === value);
}

export type Salary = {
  id: string;
  monthlySalary: number;
  from: string;
};

export type Employee = {
  id: string;
  project: ProjectId;
  matricule: string;
  name: string;
  job: JobTitle;
  phone: string;
  monthlySalary: number;
  salaries: readonly Salary[];
  startedAt: IsoTimestamp;
  endedOn: string | undefined;
  accruedUntil: string;
  absentDays: number;
  earned: number;
  withdrawn: number;
  balance: number;
  accumulated: number;
  debt: number;
  debtLeft: number;
  salaryDebtLeft: number;
  otherDebtLeft: number;
};

export type Withdrawal = {
  id: string;
  employee: string;
  amount: number;
  at: IsoTimestamp;
  note: string;
  byName: string | null;
};

export type MonthlySalary = {
  id: string;
  monthName: string;
  amount: number;
  creditedOn: string;
};

const NOTE_MAX_LENGTH = 500;

const TEXT_MAX_LENGTH = 100;

export function requiredIsoDate(messages: { required: string; dateInvalid: string }) {
  return z
    .string()
    .min(1, { message: messages.required, abort: true })
    .refine(isIsoDate, messages.dateInvalid);
}

export function requiredTime(messages: { required: string; timeInvalid: string }) {
  return z
    .string()
    .min(1, { message: messages.required, abort: true })
    .refine(isTimeValue, messages.timeInvalid);
}

export function createEmployeeSchema(messages: {
  required: string;
  phoneInvalid: string;
  dateInvalid: string;
  timeInvalid: string;
  salaryInvalid: string;
  endBeforeStart: string;
}) {
  return z
    .object({
      name: z.string().trim().min(1, messages.required).max(TEXT_MAX_LENGTH),
      job: z.string().refine(isJobTitle, messages.required),
      phone: z
        .string()
        .trim()
        .min(1, { message: messages.required, abort: true })
        .refine(isValidPhone, messages.phoneInvalid),
      monthlySalary: z.number({ error: messages.salaryInvalid }).positive(messages.salaryInvalid),
      startedOn: requiredIsoDate(messages),
      startTime: requiredTime(messages),
      endedOn: z.string().refine((value) => value === "" || isIsoDate(value), messages.dateInvalid),
    })
    .refine((values) => values.endedOn === "" || values.endedOn >= values.startedOn, {
      message: messages.endBeforeStart,
      path: ["endedOn"],
    });
}

export type EmployeeInput = z.input<ReturnType<typeof createEmployeeSchema>>;

export type EmployeeValues = z.output<ReturnType<typeof createEmployeeSchema>>;

const employeeFields: readonly (keyof EmployeeValues)[] = [
  "name",
  "job",
  "phone",
  "monthlySalary",
  "startedOn",
  "startTime",
  "endedOn",
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
    date: requiredIsoDate(messages),
    time: requiredTime(messages),
    note: z.string().trim().max(NOTE_MAX_LENGTH),
  });
}

export type WithdrawalValues = z.infer<ReturnType<typeof createWithdrawalSchema>>;

const withdrawalFields: readonly (keyof WithdrawalValues)[] = ["amount", "date", "time", "note"];

export function isWithdrawalField(value: string): value is keyof WithdrawalValues {
  return withdrawalFields.some((field) => field === value);
}

export function createRaiseSchema(messages: {
  required: string;
  dateInvalid: string;
  salaryInvalid: string;
}) {
  return z.object({
    monthlySalary: z.number({ error: messages.salaryInvalid }).positive(messages.salaryInvalid),
    from: requiredIsoDate(messages),
  });
}

export type RaiseValues = z.infer<ReturnType<typeof createRaiseSchema>>;

const raiseFields: readonly (keyof RaiseValues)[] = ["monthlySalary", "from"];

export function isRaiseField(value: string): value is keyof RaiseValues {
  return raiseFields.some((field) => field === value);
}

export function employeeCount(employees: readonly Employee[], project: ProjectId): number {
  return employees.filter((employee) => employee.project === project).length;
}

export function employeeFromApi(employee: ApiSchema<"Employee">): Employee {
  return {
    id: String(employee.id),
    project: String(employee.project),
    matricule: employee.matricule,
    name: employee.full_name,
    job: employee.job_title,
    phone: formatPhone(employee.phone),
    monthlySalary: fromDecimal(employee.monthly_salary),
    salaries: employee.salaries.map((salary) => ({
      id: String(salary.id),
      monthlySalary: fromDecimal(salary.monthly_salary),
      from: salary.effective_from,
    })),
    startedAt: employee.start_date,
    endedOn: employee.end_date ?? undefined,
    accruedUntil: employee.accrued_until,
    absentDays: employee.absent_days,
    earned: fromDecimal(employee.accrued_salary),
    withdrawn: fromDecimal(employee.withdrawn_amount),
    balance: fromDecimal(employee.balance),
    accumulated: fromDecimal(employee.accumulated_salary),
    debt: fromDecimal(employee.debt),
    debtLeft: fromDecimal(employee.remaining_debt),
    salaryDebtLeft: fromDecimal(employee.remaining_salary_debt),
    otherDebtLeft: fromDecimal(employee.remaining_other_debt),
  };
}

export function employeeToApi(values: EmployeeValues, startedAt: IsoTimestamp) {
  return {
    full_name: values.name,
    job_title: values.job,
    phone: phoneToApi(values.phone),
    start_date: startedAt,
    end_date: values.endedOn === "" ? null : values.endedOn,
  };
}

export function newEmployeeToApi(
  project: ProjectId,
  values: EmployeeValues,
  startedAt: IsoTimestamp,
) {
  return {
    ...employeeToApi(values, startedAt),
    project: Number(project),
    monthly_salary: toMoneyDecimal(values.monthlySalary),
  };
}

export function employeeErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof EmployeeValues> {
  return {
    ...(errors.full_name === undefined ? {} : { name: errors.full_name }),
    ...(errors.job_title === undefined ? {} : { job: errors.job_title }),
    ...(errors.phone === undefined ? {} : { phone: errors.phone }),
    ...(errors.monthly_salary === undefined ? {} : { monthlySalary: errors.monthly_salary }),
    ...(errors.start_date === undefined ? {} : { startedOn: errors.start_date }),
    ...(errors.end_date === undefined ? {} : { endedOn: errors.end_date }),
  };
}

export function withdrawalFromApi(withdrawal: ApiSchema<"EmployeeWithdrawal">): Withdrawal {
  return {
    id: String(withdrawal.id),
    employee: String(withdrawal.employee),
    amount: fromDecimal(withdrawal.amount),
    at: withdrawal.withdrawal_date ?? withdrawal.created_at,
    note: withdrawal.notes ?? "",
    byName: withdrawal.created_by_name,
  };
}

export function withdrawalToApi(values: WithdrawalValues, at: IsoTimestamp) {
  return {
    amount: toMoneyDecimal(values.amount),
    withdrawal_date: at,
    notes: values.note,
  };
}

export function withdrawalErrorsFromApi(
  errors: BackendFieldErrors,
): FieldErrors<keyof WithdrawalValues> {
  return {
    ...(errors.amount === undefined ? {} : { amount: errors.amount }),
    ...(errors.withdrawal_date === undefined ? {} : { date: errors.withdrawal_date }),
    ...(errors.notes === undefined ? {} : { note: errors.notes }),
  };
}

export function monthlySalaryFromApi(salary: ApiSchema<"EmployeeMonthlySalary">): MonthlySalary {
  return {
    id: String(salary.id),
    monthName: salary.month_name,
    amount: fromDecimal(salary.amount),
    creditedOn: salary.credited_on,
  };
}

export function raiseToApi(employee: string, values: RaiseValues) {
  return {
    employee: Number(employee),
    monthly_salary: toMoneyDecimal(values.monthlySalary),
    effective_from: values.from,
  };
}

export function raiseErrorsFromApi(errors: BackendFieldErrors): FieldErrors<keyof RaiseValues> {
  return {
    ...(errors.monthly_salary === undefined ? {} : { monthlySalary: errors.monthly_salary }),
    ...(errors.effective_from === undefined ? {} : { from: errors.effective_from }),
  };
}
