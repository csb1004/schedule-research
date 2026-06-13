"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { enterName, type EntryState } from "@/app/actions";

const initialState: EntryState = { ok: false };

export function NameEntryForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(enterName, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <form action={formAction} className="entry-form">
      <label>
        이름
        <input
          name="displayName"
          autoComplete="name"
          defaultValue={state.adminName ?? ""}
          required
        />
      </label>
      {state.requiresPassword ? (
        <label>
          관리자 비밀번호
          <input
            name="adminPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
      ) : null}
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        입장
      </button>
    </form>
  );
}

