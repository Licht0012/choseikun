export type AvailabilityStatus = "yes" | "maybe" | "no";

export interface TimeOptionInput {
  startTime: string;
  endTime: string;
}

export interface CreateEventInput {
  name: string;
  memo?: string;
  dates: string[];
  timeOptions: TimeOptionInput[];
  deadlineDate: string;
  reminderEnabled?: boolean;
}

export interface SlotView {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  sortOrder: number;
}

export interface ResponseView {
  id: string;
  name: string;
  comment: string;
  availability: Record<string, AvailabilityStatus>;
  updatedAt: string;
}

export interface PublicEventView {
  id: string;
  slug: string;
  name: string;
  memo: string;
  deadlineDate: string;
  reminderEnabled: boolean;
  lineConnected: boolean;
  isOpen: boolean;
  slots: SlotView[];
  responses: ResponseView[];
}

export interface EventHistoryItem {
  id: string;
  slug: string;
  name: string;
  deadlineDate: string;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  slotCount: number;
  isOpen: boolean;
  shareUrl: string;
  manageUrl: string;
}
