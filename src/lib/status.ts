export type Status = "UNAVAILABLE" | "MAYBE" | "SPECIAL" | "AVAILABLE";

export type StatusSlot = {
  status: Status;
  label: string;
  shortLabel: string;
  colorName: "red" | "yellow" | "blue" | "green";
  slot: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

export const STATUS_SLOTS: StatusSlot[] = [
  {
    status: "UNAVAILABLE",
    label: "불가",
    shortLabel: "불",
    colorName: "red",
    slot: "top-left",
  },
  {
    status: "MAYBE",
    label: "애매함",
    shortLabel: "애",
    colorName: "yellow",
    slot: "top-right",
  },
  {
    status: "SPECIAL",
    label: "특이사항",
    shortLabel: "특",
    colorName: "blue",
    slot: "bottom-left",
  },
  {
    status: "AVAILABLE",
    label: "가능",
    shortLabel: "가",
    colorName: "green",
    slot: "bottom-right",
  },
];

export const STATUS_LABELS = Object.fromEntries(
  STATUS_SLOTS.map((slot) => [slot.status, slot.label]),
) as Record<Status, string>;

