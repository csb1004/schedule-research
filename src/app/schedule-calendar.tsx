"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminSetAvailability,
  adminSetDayOpen,
  adminSetMonthOpen,
  bulkSetAvailability,
  setAvailability,
  updateDisplayName,
} from "@/app/actions";
import type {
  ScheduleData,
  ScheduleDay,
  ScheduleEntry,
  ScheduleUser,
} from "@/lib/schedule-data";
import { STATUS_LABELS, STATUS_SLOTS, type Status } from "@/lib/status";

type ScheduleCalendarProps = {
  currentUser: ScheduleUser;
  isAdmin: boolean;
  schedule: ScheduleData;
};

type PendingSpecialNote =
  | { mode: "single"; date: string }
  | { mode: "bulk"; dates: string[] }
  | { mode: "admin"; date: string; entry: ScheduleEntry };

export function ScheduleCalendar({
  currentUser,
  isAdmin,
  schedule,
}: ScheduleCalendarProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(
    schedule.days.find((day) => day.inMonth && (day.isOpen || isAdmin))?.date ??
      schedule.days.find((day) => day.inMonth)?.date ??
      schedule.days[0]?.date ??
      null,
  );
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [reasonEntryId, setReasonEntryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsRequiresPassword, setSettingsRequiresPassword] =
    useState(false);
  const [settingsAdminName, setSettingsAdminName] = useState<string | null>(
    null,
  );
  const [pendingSpecialNote, setPendingSpecialNote] =
    useState<PendingSpecialNote | null>(null);
  const [specialReason, setSpecialReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedDay = useMemo(
    () =>
      selectedDate
        ? schedule.days.find((day) => day.date === selectedDate) ?? null
        : null,
    [schedule.days, selectedDate],
  );
  const selectedMonthIndex = schedule.months.indexOf(schedule.selectedMonth);
  const previousMonth = schedule.months[selectedMonthIndex - 1];
  const nextMonth = schedule.months[selectedMonthIndex + 1];
  const selectedDateCount = selectedDates.size;

  function moveToMonth(month: string | undefined) {
    if (!month) {
      return;
    }

    router.push(`/?month=${month}`);
  }

  function handleDateClick(day: ScheduleDay) {
    if (!day.inMonth || (!day.isOpen && !isAdmin)) {
      return;
    }

    if (selectionMode) {
      setSelectedDates((current) => {
        const next = new Set(current);

        if (next.has(day.date)) {
          next.delete(day.date);
        } else {
          next.add(day.date);
        }

        return next;
      });
      return;
    }

    setSelectedDate(day.date);
    setReasonEntryId(null);
  }

  function closeDetailPanel() {
    setSelectedDate(null);
    setReasonEntryId(null);
  }

  function applyStatus(status: Status) {
    if (!selectedDay || (!selectedDay.isOpen && !isAdmin)) {
      return;
    }

    const currentUserEntry = findCurrentUserEntry(selectedDay, currentUser.id);

    if (currentUserEntry?.status === status) {
      startTransition(async () => {
        await setAvailability({ date: selectedDay.date, status });
        router.refresh();
      });
      return;
    }

    if (status === "SPECIAL") {
      setSpecialReason("");
      setPendingSpecialNote({ mode: "single", date: selectedDay.date });
      return;
    }

    startTransition(async () => {
      await setAvailability({ date: selectedDay.date, status });
      router.refresh();
    });
  }

  function applyBulkStatus(status: Status) {
    if (selectedDates.size === 0) {
      return;
    }

    if (status === "SPECIAL") {
      setSpecialReason("");
      setPendingSpecialNote({ mode: "bulk", dates: [...selectedDates] });
      return;
    }

    startTransition(async () => {
      await bulkSetAvailability({
        dates: [...selectedDates],
        status,
      });
      setSelectedDates(new Set());
      setSelectionMode(false);
      router.refresh();
    });
  }

  function applyAdminStatus(entry: ScheduleEntry, status: Status) {
    if (!isAdmin || !selectedDay) {
      return;
    }

    if (status === "SPECIAL") {
      setSpecialReason(entry.reason ?? "");
      setPendingSpecialNote({ mode: "admin", date: selectedDay.date, entry });
      return;
    }

    startTransition(async () => {
      await adminSetAvailability({
        userId: entry.userId,
        date: selectedDay.date,
        status,
      });
      router.refresh();
    });
  }

  function cancelSpecialNote() {
    setPendingSpecialNote(null);
    setSpecialReason("");
  }

  function submitSpecialNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingSpecialNote) {
      return;
    }

    const reason = specialReason.trim();

    if (!reason) {
      return;
    }

    startTransition(async () => {
      if (pendingSpecialNote.mode === "single") {
        await setAvailability({
          date: pendingSpecialNote.date,
          status: "SPECIAL",
          reason,
        });
      }

      if (pendingSpecialNote.mode === "bulk") {
        await bulkSetAvailability({
          dates: pendingSpecialNote.dates,
          status: "SPECIAL",
          reason,
        });
        setSelectedDates(new Set());
        setSelectionMode(false);
      }

      if (pendingSpecialNote.mode === "admin") {
        await adminSetAvailability({
          userId: pendingSpecialNote.entry.userId,
          date: pendingSpecialNote.date,
          status: "SPECIAL",
          reason,
        });
      }

      setPendingSpecialNote(null);
      setSpecialReason("");
      router.refresh();
    });
  }

  function setDayOpen(isOpen: boolean) {
    if (!isAdmin || !selectedDay) {
      return;
    }

    startTransition(async () => {
      await adminSetDayOpen(selectedDay.date, isOpen);
      router.refresh();
    });
  }

  function setMonthOpen(isOpen: boolean) {
    if (!isAdmin) {
      return;
    }

    startTransition(async () => {
      await adminSetMonthOpen(schedule.selectedMonth, isOpen);
      router.refresh();
    });
  }

  function submitDisplayName(formData: FormData) {
    startTransition(async () => {
      const result = await updateDisplayName(formData);

      if (!result.ok) {
        if (result.requiresPassword) {
          setSettingsRequiresPassword(true);
          setSettingsAdminName(
            result.adminName ?? String(formData.get("displayName") ?? ""),
          );
          setSettingsError(result.error ?? null);
          return;
        }

        setSettingsError(result.error ?? "이름을 변경하지 못했습니다.");
        return;
      }

      setSettingsError(null);
      setSettingsRequiresPassword(false);
      setSettingsAdminName(null);
      setSettingsOpen(false);
      router.refresh();
    });
  }

  return (
    <main className="app-shell">
      <header className="calendar-topbar">
        <div className="month-switcher">
          <button
            type="button"
            className="icon-button"
            aria-label="이전 달"
            disabled={!previousMonth}
            onClick={() => moveToMonth(previousMonth)}
          >
            ‹
          </button>
          <div className="month-menu-wrap">
            <button
              type="button"
              className="month-title"
              onClick={() => setMonthMenuOpen((open) => !open)}
            >
              {formatMonthLabel(schedule.selectedMonth)}
            </button>
            {monthMenuOpen ? (
              <div className="month-menu">
                {schedule.months.map((month) => (
                  <button
                    type="button"
                    key={month}
                    className={month === schedule.selectedMonth ? "active" : ""}
                    onClick={() => moveToMonth(month)}
                  >
                    {formatMonthLabel(month)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="다음 달"
            disabled={!nextMonth}
            onClick={() => moveToMonth(nextMonth)}
          >
            ›
          </button>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className={selectionMode ? "toolbar-pill active" : "toolbar-pill"}
            onClick={() => {
              setSelectionMode((enabled) => !enabled);
              setSelectedDates(new Set());
            }}
          >
            여러 날짜 선택
          </button>
          <button
            type="button"
            className="toolbar-pill"
            onClick={() => {
              setSettingsError(null);
              setSettingsRequiresPassword(false);
              setSettingsAdminName(null);
              setSettingsOpen(true);
            }}
          >
            {currentUser.displayName}
          </button>
          {isAdmin ? <span className="toolbar-pill admin">관리자</span> : null}
        </div>
      </header>

      {selectionMode ? (
        <section className="bulk-bar">
          <strong>{selectedDateCount}개 선택</strong>
          <div className="status-button-row compact">
            {STATUS_SLOTS.map((slot) => (
              <button
                type="button"
                key={slot.status}
                className={`status-button ${slot.colorName}`}
                disabled={selectedDateCount === 0 || isPending}
                onClick={() => applyBulkStatus(slot.status)}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div
        className={
          selectedDay ? "calendar-workspace" : "calendar-workspace detail-closed"
        }
      >
        <section className="calendar-panel">
          <div className="weekday-grid">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-grid">
            {schedule.days.map((day) => (
              <DateCell
                key={day.date}
                day={day}
                selected={day.date === selectedDate}
                multiSelected={selectedDates.has(day.date)}
                isAdmin={isAdmin}
                currentUserId={currentUser.id}
                onClick={() => handleDateClick(day)}
              />
            ))}
          </div>
        </section>

        {selectedDay ? (
          <DetailPanel
            day={selectedDay}
            isAdmin={isAdmin}
            isPending={isPending}
            currentUserId={currentUser.id}
            reasonEntryId={reasonEntryId}
            onSelectReason={setReasonEntryId}
            onApplyStatus={applyStatus}
            onAdminStatus={applyAdminStatus}
            onSetDayOpen={setDayOpen}
            onSetMonthOpen={setMonthOpen}
            onClose={closeDetailPanel}
          />
        ) : null}
      </div>

      {settingsOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <form action={submitDisplayName} className="settings-dialog">
            <h2>이름 설정</h2>
            <label>
              이름
              <input
                key={settingsAdminName ?? currentUser.displayName}
                name="displayName"
                defaultValue={settingsAdminName ?? currentUser.displayName}
                required
              />
            </label>
            {settingsRequiresPassword ? (
              <label>
                관리자 비밀번호
                <input
                  name="adminPassword"
                  type="password"
                  autoComplete="current-password"
                />
              </label>
            ) : null}
            {settingsError ? (
              <p className="form-error">{settingsError}</p>
            ) : null}
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setSettingsError(null);
                  setSettingsRequiresPassword(false);
                  setSettingsAdminName(null);
                  setSettingsOpen(false);
                }}
              >
                취소
              </button>
              <button type="submit" disabled={isPending}>
                저장
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingSpecialNote ? (
        <div className="dialog-backdrop" role="presentation">
          <form
            className="settings-dialog note-dialog"
            onSubmit={submitSpecialNote}
          >
            <h2>특이사항 사유</h2>
            <label>
              사유
              <textarea
                value={specialReason}
                onChange={(event) => setSpecialReason(event.target.value)}
                required
                autoFocus
                rows={4}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={cancelSpecialNote}>
                취소
              </button>
              <button type="submit" disabled={isPending || !specialReason.trim()}>
                저장
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function DateCell({
  day,
  selected,
  multiSelected,
  isAdmin,
  currentUserId,
  onClick,
}: {
  day: ScheduleDay;
  selected: boolean;
  multiSelected: boolean;
  isAdmin: boolean;
  currentUserId: string;
  onClick: () => void;
}) {
  const disabled = !day.inMonth || (!day.isOpen && !isAdmin);
  const currentUserEntry = findCurrentUserEntry(day, currentUserId);
  const ownStatusColor = currentUserEntry
    ? statusColor(currentUserEntry.status)
    : null;
  const className = [
    "date-cell",
    !day.inMonth ? "outside" : "",
    !day.isOpen ? "closed" : "",
    selected ? "selected" : "",
    multiSelected ? "multi-selected" : "",
    currentUserEntry ? "own-status" : "",
    ownStatusColor ? `own-${ownStatusColor}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-pressed={Boolean(currentUserEntry)}
      onClick={onClick}
    >
      <span className="date-cell-heading">
        <span className="day-number">{day.day}</span>
      </span>
      <div className="status-slot-grid" aria-hidden={!day.isOpen && !isAdmin}>
        {STATUS_SLOTS.map((slot) => {
          return day.counts[slot.status] > 0 ? (
            <span
              key={slot.status}
              className={`status-slot ${slot.colorName}`}
              title={`${slot.label} ${day.counts[slot.status]}`}
            >
              {day.counts[slot.status]}
            </span>
          ) : (
            <span key={slot.status} className="status-slot empty" />
          );
        })}
      </div>
    </button>
  );
}

function DetailPanel({
  day,
  isAdmin,
  isPending,
  currentUserId,
  reasonEntryId,
  onSelectReason,
  onApplyStatus,
  onAdminStatus,
  onSetDayOpen,
  onSetMonthOpen,
  onClose,
}: {
  day: ScheduleDay;
  isAdmin: boolean;
  isPending: boolean;
  currentUserId: string;
  reasonEntryId: string | null;
  onSelectReason: (entryId: string | null) => void;
  onApplyStatus: (status: Status) => void;
  onAdminStatus: (entry: ScheduleEntry, status: Status) => void;
  onSetDayOpen: (isOpen: boolean) => void;
  onSetMonthOpen: (isOpen: boolean) => void;
  onClose: () => void;
}) {
  const activeReason = day.entries.find((entry) => entry.id === reasonEntryId);
  const currentUserEntry = findCurrentUserEntry(day, currentUserId);

  return (
    <aside className="detail-panel">
      <div className="detail-heading">
        <div>
          <h2>{formatDateLabel(day.date)}</h2>
          <p>{formatSummary(day)}</p>
        </div>
        <div className="detail-heading-actions">
          {!day.isOpen ? <span className="closed-badge">닫힘</span> : null}
          <button
            type="button"
            className="detail-close-button"
            aria-label="상세 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      {day.isOpen || isAdmin ? (
        <div className="status-button-row">
          {STATUS_SLOTS.map((slot) => (
            <button
              type="button"
              key={slot.status}
              className={`status-button ${slot.colorName} ${
                currentUserEntry?.status === slot.status ? "active" : ""
              }`}
              aria-pressed={currentUserEntry?.status === slot.status}
              disabled={isPending || (!day.isOpen && !isAdmin)}
              onClick={() => onApplyStatus(slot.status)}
            >
              {slot.label}
            </button>
          ))}
        </div>
      ) : null}

      {isAdmin ? (
        <div className="admin-controls">
          <button type="button" onClick={() => onSetDayOpen(!day.isOpen)}>
            날짜 {day.isOpen ? "닫기" : "열기"}
          </button>
          <button type="button" onClick={() => onSetMonthOpen(true)}>
            이번 달 열기
          </button>
          <button type="button" onClick={() => onSetMonthOpen(false)}>
            이번 달 닫기
          </button>
        </div>
      ) : null}

      <div className="user-list">
        {day.entries.length === 0 ? (
          <p className="empty-list">표시한 사람이 없습니다.</p>
        ) : (
          day.entries.map((entry) => (
            <div key={entry.id} className="user-row">
              <button
                type="button"
                className="user-name"
                onClick={() =>
                  onSelectReason(reasonEntryId === entry.id ? null : entry.id)
                }
              >
                <strong>{entry.userName}</strong>
              </button>
              <span className={`status-badge ${statusColor(entry.status)}`}>
                {STATUS_LABELS[entry.status]}
              </span>
              {isAdmin ? (
                <div className="admin-status-buttons">
                  {STATUS_SLOTS.map((slot) => (
                    <button
                      type="button"
                      key={slot.status}
                      className={slot.colorName}
                      onClick={() => onAdminStatus(entry, slot.status)}
                    >
                      {slot.shortLabel}
                    </button>
                  ))}
                </div>
              ) : null}
              {activeReason?.id === entry.id && entry.status === "SPECIAL" ? (
                <p className="reason-text">{entry.reason}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function statusColor(status: Status): string {
  return STATUS_SLOTS.find((slot) => slot.status === status)?.colorName ?? "green";
}

function findCurrentUserEntry(
  day: ScheduleDay,
  currentUserId: string,
): ScheduleEntry | null {
  return day.entries.find((entry) => entry.userId === currentUserId) ?? null;
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${year}년 ${Number(monthNumber)}월`;
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return `${parsed.getUTCMonth() + 1}월 ${parsed.getUTCDate()}일`;
}

function formatSummary(day: ScheduleDay): string {
  return STATUS_SLOTS.map(
    (slot) => `${slot.label} ${day.counts[slot.status]}`,
  ).join(" · ");
}
