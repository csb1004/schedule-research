"use client";

import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { getCalendarDateRange } from "@/lib/date-selection";
import {
  getHighlightColorName,
  HIGHLIGHT_COOKIE_NAME,
  parseHighlightStatusCookie,
  serializeHighlightStatuses,
} from "@/lib/highlight";
import { CALENDAR_MONTH_COOKIE_NAME } from "@/lib/month-preference";
import { STATUS_LABELS, STATUS_SLOTS, type Status } from "@/lib/status";

const LONG_PRESS_DELAY_MS = 450;

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
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const [highlightStatuses, setHighlightStatuses] = useState<Set<Status>>(
    new Set(),
  );
  const [pendingSpecialNote, setPendingSpecialNote] =
    useState<PendingSpecialNote | null>(null);
  const [specialReason, setSpecialReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSelectionAnchorDateRef = useRef<string | null>(null);
  const isDragSelectingRef = useRef(false);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    setHighlightStatuses(
      new Set(parseHighlightStatusCookie(readCookie(HIGHLIGHT_COOKIE_NAME))),
    );
  }, []);

  useEffect(() => {
    writeCalendarMonthCookie(schedule.selectedMonth);
  }, [schedule.selectedMonth]);

  useEffect(() => () => clearLongPressTimer(), []);

  useEffect(() => {
    function handleDocumentPointerMove(event: PointerEvent) {
      if (!isDragSelectingRef.current) {
        return;
      }

      const date = findDateFromPoint(event.clientX, event.clientY);

      if (date) {
        extendDragSelectionToDate(date);
      }
    }

    function handleDocumentPointerEnd(event: PointerEvent) {
      extendDragSelectionFromPoint(event.clientX, event.clientY);
      finishDragSelection();
    }

    function handleDocumentMouseMove(event: MouseEvent) {
      if (!isDragSelectingRef.current) {
        return;
      }

      const date = findDateFromPoint(event.clientX, event.clientY);

      if (date) {
        extendDragSelectionToDate(date);
      }
    }

    document.addEventListener("pointermove", handleDocumentPointerMove);
    document.addEventListener("pointerup", handleDocumentPointerEnd);
    document.addEventListener("pointercancel", handleDocumentPointerEnd);
    document.addEventListener("mousemove", handleDocumentMouseMove);
    function handleDocumentMouseEnd(event: MouseEvent) {
      extendDragSelectionFromPoint(event.clientX, event.clientY);
      finishDragSelection();
    }

    document.addEventListener("mouseup", handleDocumentMouseEnd);

    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove);
      document.removeEventListener("pointerup", handleDocumentPointerEnd);
      document.removeEventListener("pointercancel", handleDocumentPointerEnd);
      document.removeEventListener("mousemove", handleDocumentMouseMove);
      document.removeEventListener("mouseup", handleDocumentMouseEnd);
    };
  });

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

    writeCalendarMonthCookie(month);
    router.push(`/?month=${month}`);
  }

  function handleDateClick(day: ScheduleDay) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

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

  function handleDatePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    day: ScheduleDay,
  ) {
    if (event.button !== 0) {
      return;
    }

    if (!isSelectableDay(day)) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      suppressNextClickRef.current = true;
      isDragSelectingRef.current = true;
      dragSelectionAnchorDateRef.current = day.date;
      setReasonEntryId(null);
      setSelectedDates(new Set([day.date]));
    }, LONG_PRESS_DELAY_MS);
  }

  function handleDatePointerEnter(day: ScheduleDay) {
    if (!isDragSelectingRef.current) {
      return;
    }

    extendDragSelectionToDate(day.date);
  }

  function handleDatePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isDragSelectingRef.current) {
      return;
    }

    const date = findDateFromPoint(event.clientX, event.clientY);

    if (date) {
      extendDragSelectionToDate(date);
    }
  }

  function handleDatePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    clearLongPressTimer();
    extendDragSelectionFromPoint(event.clientX, event.clientY);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishDragSelection();
  }

  function finishDragSelection() {
    if (isDragSelectingRef.current) {
      setSelectionMode(true);
    }

    isDragSelectingRef.current = false;
    dragSelectionAnchorDateRef.current = null;
  }

  function extendDragSelectionToDate(date: string) {
    const anchorDate = dragSelectionAnchorDateRef.current;

    if (!anchorDate) {
      return;
    }

    const selectableDates = getCalendarDateRange(
      schedule.days,
      anchorDate,
      date,
    ).filter((rangeDate) => {
      const rangeDay = schedule.days.find((day) => day.date === rangeDate);
      return rangeDay ? isSelectableDay(rangeDay) : false;
    });

    setSelectedDates(new Set(selectableDates));
  }

  function isSelectableDay(day: ScheduleDay) {
    return day.inMonth && (day.isOpen || isAdmin);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function extendDragSelectionFromPoint(clientX: number, clientY: number) {
    if (!isDragSelectingRef.current) {
      return;
    }

    const date = findDateFromPoint(clientX, clientY);

    if (date) {
      extendDragSelectionToDate(date);
    }
  }

  function closeDetailPanel() {
    setSelectedDate(null);
    setReasonEntryId(null);
  }

  function updateHighlightStatuses(nextStatuses: Set<Status>) {
    setHighlightStatuses(nextStatuses);
    writeHighlightStatusCookie(nextStatuses);
  }

  function toggleHighlightStatus(status: Status) {
    const next = new Set(highlightStatuses);

    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }

    updateHighlightStatuses(next);
  }

  function clearHighlightStatuses() {
    updateHighlightStatuses(new Set());
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

  function downloadMonthJson() {
    const payload = {
      month: schedule.selectedMonth,
      downloadedAt: new Date().toISOString(),
      days: schedule.days
        .filter((day) => day.inMonth)
        .map((day) => ({
          date: day.date,
          isOpen: day.isOpen,
          isVisible: day.isVisible,
          counts: day.counts,
          entries: day.entries.map((entry) => ({
            userName: entry.userName,
            status: entry.status,
            reason: entry.reason,
          })),
        })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `schedule-${schedule.selectedMonth}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
              isDragSelectingRef.current = false;
              dragSelectionAnchorDateRef.current = null;
            }}
          >
            여러 날짜 선택
          </button>
          <div className="highlight-menu-wrap">
            <button
              type="button"
              className={
                highlightStatuses.size > 0
                  ? "toolbar-pill active"
                  : "toolbar-pill"
              }
              aria-expanded={highlightMenuOpen}
              onClick={() => setHighlightMenuOpen((open) => !open)}
            >
              {highlightStatuses.size > 0
                ? `하이라이트 ${highlightStatuses.size}`
                : "하이라이트 없음"}
            </button>
            {highlightMenuOpen ? (
              <div className="highlight-menu">
                <button
                  type="button"
                  className="highlight-clear"
                  onClick={clearHighlightStatuses}
                >
                  하이라이트 없음
                </button>
                <div className="highlight-option-list">
                  {STATUS_SLOTS.map((slot) => (
                    <label key={slot.status} className="highlight-option">
                      <input
                        type="checkbox"
                        checked={highlightStatuses.has(slot.status)}
                        onChange={() => toggleHighlightStatus(slot.status)}
                      />
                      <span
                        className={`highlight-swatch ${slot.colorName}`}
                        aria-hidden="true"
                      />
                      <span>{slot.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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

      {isAdmin ? (
        <AdminMonthControls
          selectedMonth={schedule.selectedMonth}
          days={schedule.days}
          isPending={isPending}
          onSetMonthOpen={setMonthOpen}
          onDownloadMonthJson={downloadMonthJson}
        />
      ) : null}

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
                highlightStatuses={highlightStatuses}
                onClick={() => handleDateClick(day)}
                onPointerDown={(event) => handleDatePointerDown(event, day)}
                onPointerEnter={() => handleDatePointerEnter(day)}
                onPointerMove={handleDatePointerMove}
                onPointerUp={handleDatePointerUp}
                onPointerCancel={handleDatePointerUp}
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
  highlightStatuses,
  onClick,
  onPointerDown,
  onPointerEnter,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  day: ScheduleDay;
  selected: boolean;
  multiSelected: boolean;
  isAdmin: boolean;
  currentUserId: string;
  highlightStatuses: Set<Status>;
  onClick: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: () => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const disabled = !day.inMonth || (!day.isOpen && !isAdmin);
  const currentUserEntry = findCurrentUserEntry(day, currentUserId);
  const ownStatusColor = currentUserEntry
    ? statusColor(currentUserEntry.status)
    : null;
  const highlightColorName = getHighlightColorName(
    day.counts,
    highlightStatuses,
  );
  const className = [
    "date-cell",
    !day.inMonth ? "outside" : "",
    !day.isOpen ? "closed" : "",
    selected ? "selected" : "",
    multiSelected ? "multi-selected" : "",
    highlightColorName ? `highlight-${highlightColorName}` : "",
    currentUserEntry ? "own-status" : "",
    ownStatusColor ? `own-${ownStatusColor}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      data-date={day.date}
      disabled={disabled}
      aria-pressed={Boolean(currentUserEntry)}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(event) => event.preventDefault()}
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

function AdminMonthControls({
  selectedMonth,
  days,
  isPending,
  onSetMonthOpen,
  onDownloadMonthJson,
}: {
  selectedMonth: string;
  days: ScheduleDay[];
  isPending: boolean;
  onSetMonthOpen: (isOpen: boolean) => void;
  onDownloadMonthJson: () => void;
}) {
  const inMonthDays = days.filter((day) => day.inMonth);
  const openCount = inMonthDays.filter((day) => day.isOpen).length;
  const totalCount = inMonthDays.length;
  const allOpen = totalCount > 0 && openCount === totalCount;

  return (
    <section className="admin-month-controls">
      <strong>{formatMonthLabel(selectedMonth)}</strong>
      <span>{allOpen ? "열림" : `닫힘 ${totalCount - openCount}일`}</span>
      <div>
        <button
          type="button"
          disabled={isPending || allOpen}
          onClick={() => onSetMonthOpen(true)}
        >
          이 달 열기
        </button>
        <button
          type="button"
          disabled={isPending || openCount === 0}
          onClick={() => onSetMonthOpen(false)}
        >
          이 달 닫기
        </button>
        <button type="button" onClick={onDownloadMonthJson}>
          JSON 다운로드
        </button>
      </div>
    </section>
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

function readCookie(name: string): string {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

function writeHighlightStatusCookie(statuses: Iterable<Status>) {
  const value = serializeHighlightStatuses(statuses);

  if (!value) {
    document.cookie = `${HIGHLIGHT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    return;
  }

  document.cookie = `${HIGHLIGHT_COOKIE_NAME}=${encodeURIComponent(
    value,
  )}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function writeCalendarMonthCookie(month: string) {
  document.cookie = `${CALENDAR_MONTH_COOKIE_NAME}=${encodeURIComponent(
    month,
  )}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function findDateFromPoint(clientX: number, clientY: number): string | null {
  const directTarget = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLButtonElement>("[data-date]");

  if (directTarget?.dataset.date) {
    return directTarget.dataset.date;
  }

  for (const cell of document.querySelectorAll<HTMLButtonElement>("[data-date]")) {
    const rect = cell.getBoundingClientRect();

    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return cell.dataset.date ?? null;
    }
  }

  return null;
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
