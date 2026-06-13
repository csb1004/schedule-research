"use client";

import { isDatabaseConnectionError } from "@/lib/db-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const databaseError = isDatabaseConnectionError(error);

  return (
    <main className="entry-page">
      <section className="entry-panel">
        <p className="eyebrow">
          {databaseError ? "Database connection" : "Application error"}
        </p>
        <h1>{databaseError ? "DB 연결이 끊겼습니다" : "문제가 발생했습니다"}</h1>
        <p className="error-copy">
          {databaseError
            ? "로컬 개발 중이라면 Prisma dev 데이터베이스가 실행 중인지 확인한 뒤 다시 시도해주세요. Railway에서는 PostgreSQL 서비스와 DATABASE_URL 변수를 확인하면 됩니다."
            : "잠시 후 다시 시도해주세요."}
        </p>
        <button type="button" onClick={reset}>
          다시 시도
        </button>
      </section>
    </main>
  );
}

