import { createShortCode } from "./user";

export type IdentityUser = {
  id: string;
  displayName: string;
  shortCode: string;
  createdAt: Date;
};

export type UserIdentityStore = {
  findFirst(args: {
    where: { displayName: string };
    orderBy: { createdAt: "asc" };
  }): Promise<IdentityUser | null>;
  create(args: {
    data: { displayName: string; shortCode: string };
  }): Promise<IdentityUser>;
};

export type GetOrCreateUserResult = {
  user: IdentityUser;
  created: boolean;
};

export function normalizeDisplayName(displayName: string): string {
  const normalizedName = displayName.trim();

  if (!normalizedName) {
    throw new Error("이름을 입력해주세요.");
  }

  return normalizedName;
}

export async function getOrCreateUserByDisplayName(
  userStore: UserIdentityStore,
  displayName: string,
  createCode = createShortCode,
): Promise<GetOrCreateUserResult> {
  const normalizedName = requireDisplayName(displayName);
  const existingUser = await findOldestUserByDisplayName(
    userStore,
    normalizedName,
  );

  if (existingUser) {
    return { user: existingUser, created: false };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const user = await userStore.create({
        data: {
          displayName: normalizedName,
          shortCode: createCode(),
        },
      });

      return { user, created: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("사용자 코드를 생성하지 못했습니다.");
}

export async function validateDisplayNameRename(
  userStore: UserIdentityStore,
  displayName: string,
  currentUserId: string,
): Promise<string> {
  const normalizedName = requireDisplayName(displayName);
  const existingUser = await findOldestUserByDisplayName(
    userStore,
    normalizedName,
  );

  if (existingUser && existingUser.id !== currentUserId) {
    throw new Error("이미 사용 중인 이름입니다.");
  }

  return normalizedName;
}

function requireDisplayName(displayName: string): string {
  return normalizeDisplayName(displayName);
}

function findOldestUserByDisplayName(
  userStore: UserIdentityStore,
  displayName: string,
): Promise<IdentityUser | null> {
  return userStore.findFirst({
    where: { displayName },
    orderBy: { createdAt: "asc" },
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
