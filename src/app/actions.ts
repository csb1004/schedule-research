"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  parseAdminNames,
  signAdminSession,
  verifyAdminSession,
} from "@/lib/admin";
import {
  enumerateDateRange,
  getMonthDateRange,
  parseDateKey,
} from "@/lib/calendar";
import {
  getOrCreateUserByDisplayName,
  normalizeDisplayName,
  validateDisplayNameRename,
} from "@/lib/identity";

const USER_COOKIE = "schedule_user_id";
const ADMIN_COOKIE = "schedule_admin";
const ADMIN_TTL_SECONDS = 60 * 60 * 24 * 7;

const statusSchema = z.enum([
  "UNAVAILABLE",
  "MAYBE",
  "SPECIAL",
  "AVAILABLE",
]);
type AvailabilityStatus = z.infer<typeof statusSchema>;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export type EntryState = {
  ok: boolean;
  error?: string;
  requiresPassword?: boolean;
  adminName?: string;
};

export async function enterName(
  _previousState: EntryState,
  formData: FormData,
): Promise<EntryState> {
  let displayName: string;

  try {
    displayName = normalizeDisplayName(
      String(formData.get("displayName") ?? ""),
    );
  } catch (error) {
    return { ok: false, error: getActionErrorMessage(error) };
  }

  const password = String(formData.get("adminPassword") ?? "");

  const adminNames = parseAdminNames(process.env.ADMIN_NAMES);
  const isAdminName = adminNames.includes(displayName);

  if (isAdminName && !password) {
    return { ok: false, requiresPassword: true, adminName: displayName };
  }

  if (isAdminName && password !== process.env.ADMIN_PASSWORD) {
    return {
      ok: false,
      error: "관리자 비밀번호가 올바르지 않습니다.",
      requiresPassword: true,
      adminName: displayName,
    };
  }

  const { user } = await getOrCreateUserByDisplayName(prisma.user, displayName);
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, user.id, cookieOptions());

  if (isAdminName) {
    const secret = requireAdminSecret();
    const token = await signAdminSession(user.id, secret, ADMIN_TTL_SECONDS);
    cookieStore.set(ADMIN_COOKIE, token, cookieOptions());
  }

  revalidatePath("/");
  return { ok: true };
}

export async function updateDisplayName(formData: FormData): Promise<EntryState> {
  const user = await requireCurrentUser();
  let displayName: string;

  try {
    displayName = await validateDisplayNameRename(
      prisma.user,
      String(formData.get("displayName") ?? ""),
      user.id,
    );
  } catch (error) {
    return { ok: false, error: getActionErrorMessage(error) };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { displayName },
  });

  revalidatePath("/");
  return { ok: true };
}

export async function setAvailability(input: unknown) {
  const user = await requireCurrentUser();
  const parsed = availabilityInputSchema().parse(input);
  await ensureEditableDate(parsed.date, false);
  await upsertAvailability(user.id, parsed.date, parsed.status, parsed.reason);
  revalidatePath("/");
}

export async function bulkSetAvailability(input: unknown) {
  const user = await requireCurrentUser();
  const parsed = bulkAvailabilityInputSchema().parse(input);

  for (const date of parsed.dates) {
    await ensureEditableDate(date, false);
    await upsertAvailability(user.id, date, parsed.status, parsed.reason);
  }

  revalidatePath("/");
}

export async function adminSetAvailability(input: unknown) {
  await requireAdmin();
  const parsed = adminAvailabilityInputSchema().parse(input);
  await ensureDay(parsed.date);
  await upsertAvailability(
    parsed.userId,
    parsed.date,
    parsed.status,
    parsed.reason,
  );
  revalidatePath("/");
}

export async function adminSetDayOpen(date: string, isOpen: boolean) {
  await requireAdmin();
  const parsedDate = dateSchema.parse(date);
  await prisma.day.upsert({
    where: { date: parseDateKey(parsedDate) },
    update: { isOpen, isVisible: true },
    create: { date: parseDateKey(parsedDate), isOpen, isVisible: true },
  });
  revalidatePath("/");
}

export async function adminSetMonthOpen(month: string, isOpen: boolean) {
  await requireAdmin();
  const parsedMonth = monthSchema.parse(month);
  const { start, end } = getMonthDateRange(parsedMonth);
  const dates = enumerateDateRange(start, end);

  await prisma.$transaction(
    dates.map((date) =>
      prisma.day.upsert({
        where: { date: parseDateKey(date) },
        update: { isOpen, isVisible: true },
        create: { date: parseDateKey(date), isOpen, isVisible: true },
      }),
    ),
  );

  revalidatePath("/");
}

export async function adminAddVisibleRange(startDate: string, endDate: string) {
  await requireAdmin();
  const dates = enumerateDateRange(
    dateSchema.parse(startDate),
    dateSchema.parse(endDate),
  );

  await prisma.$transaction(
    dates.map((date) =>
      prisma.day.upsert({
        where: { date: parseDateKey(date) },
        update: { isVisible: true },
        create: {
          date: parseDateKey(date),
          isOpen: true,
          isVisible: true,
        },
      }),
    ),
  );

  revalidatePath("/");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value;

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({ where: { id: userId } });
}

export async function getIsAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const verified = await verifyAdminSession(token, process.env.ADMIN_SESSION_SECRET);
  const user = await getCurrentUser();

  return Boolean(verified && user && verified.userId === user.id);
}

async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
}

async function requireAdmin() {
  const isAdmin = await getIsAdmin();

  if (!isAdmin) {
    throw new Error("관리자 권한이 필요합니다.");
  }
}

async function ensureEditableDate(date: string, isAdmin: boolean) {
  const day = await prisma.day.findUnique({
    where: { date: parseDateKey(date) },
  });

  if (day && !day.isOpen && !isAdmin) {
    throw new Error("닫힌 날짜는 수정할 수 없습니다.");
  }

  await ensureDay(date);
}

async function ensureDay(date: string) {
  await prisma.day.upsert({
    where: { date: parseDateKey(date) },
    update: {},
    create: { date: parseDateKey(date), isOpen: true, isVisible: true },
  });
}

async function upsertAvailability(
  userId: string,
  date: string,
  status: AvailabilityStatus,
  reason?: string,
) {
  const cleanReason = status === "SPECIAL" ? reason?.trim() : null;

  if (status === "SPECIAL" && !cleanReason) {
    throw new Error("특이사항 사유를 입력해주세요.");
  }

  await ensureDay(date);
  await prisma.availability.upsert({
    where: {
      userId_date: {
        userId,
        date: parseDateKey(date),
      },
    },
    update: {
      status,
      reason: cleanReason,
    },
    create: {
      userId,
      date: parseDateKey(date),
      status,
      reason: cleanReason,
    },
  });
}

function requireAdminSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is required.");
  }

  return secret;
}

function getActionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  };
}

function availabilityInputSchema() {
  return z.object({
    date: dateSchema,
    status: statusSchema,
    reason: z.string().optional(),
  });
}

function bulkAvailabilityInputSchema() {
  return z.object({
    dates: z.array(dateSchema).min(1),
    status: statusSchema,
    reason: z.string().optional(),
  });
}

function adminAvailabilityInputSchema() {
  return availabilityInputSchema().extend({
    userId: z.string().min(1),
  });
}
