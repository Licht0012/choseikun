import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    memo: text("memo").notNull().default(""),
    deadlineDate: text("deadline_date").notNull(),
    adminTokenHash: text("admin_token_hash").notNull(),
    lineGroupId: text("line_group_id"),
    lineGroupName: text("line_group_name"),
    lineLinkCodeHash: text("line_link_code_hash"),
    lineLinkExpiresAt: text("line_link_expires_at"),
    reminderEnabled: integer("reminder_enabled").notNull().default(1),
    reminderSentAt: text("reminder_sent_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("events_slug_unique").on(table.slug),
    uniqueIndex("events_admin_token_unique").on(table.adminTokenHash),
    index("events_deadline_idx").on(table.deadlineDate),
  ],
);

export const candidateDates = sqliteTable(
  "candidate_dates",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("candidate_dates_event_date_unique").on(table.eventId, table.date),
    index("candidate_dates_event_idx").on(table.eventId),
  ],
);

export const timeOptions = sqliteTable(
  "time_options",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("time_options_event_range_unique").on(table.eventId, table.startTime, table.endTime),
    index("time_options_event_idx").on(table.eventId),
  ],
);

export const slots = sqliteTable(
  "slots",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    candidateDateId: text("candidate_date_id").notNull().references(() => candidateDates.id, { onDelete: "cascade" }),
    timeOptionId: text("time_option_id").notNull().references(() => timeOptions.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("slots_event_date_time_unique").on(table.eventId, table.candidateDateId, table.timeOptionId),
    index("slots_event_idx").on(table.eventId),
  ],
);

export const responses = sqliteTable(
  "responses",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    comment: text("comment").notNull().default(""),
    editTokenHash: text("edit_token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("responses_edit_token_unique").on(table.editTokenHash),
    index("responses_event_idx").on(table.eventId),
  ],
);

export const availability = sqliteTable(
  "availability",
  {
    responseId: text("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
    slotId: text("slot_id").notNull().references(() => slots.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["yes", "maybe", "no"] }).notNull(),
  },
  (table) => [
    uniqueIndex("availability_response_slot_unique").on(table.responseId, table.slotId),
    index("availability_slot_idx").on(table.slotId),
  ],
);


// Additive metadata for monthly automation; regular events use existing tables.
export const monthlyEvents = sqliteTable("monthly_events", {
  eventId: text("event_id").primaryKey().references(() => events.id),
  targetMonth: text("target_month").notNull().unique(),
  createdMonth: text("created_month").notNull(),
  holidayCsv: text("holiday_csv").notNull(),
  createdAt: text("created_at").notNull(),
});
export const monthlyNotifications = sqliteTable("monthly_notifications", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => monthlyEvents.eventId),
  kind: text("kind", {enum:["created","reminder","final","provisional"]}).notNull(),
  payload: text("payload").notNull(),
  retryKey: text("retry_key").notNull().unique(),
  createdAt: text("created_at").notNull(),
  firstAttemptAt: text("first_attempt_at"),
  leaseUntil: text("lease_until"),
  leaseOwner: text("lease_owner"),
  sentAt: text("sent_at"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
  blocked: integer("blocked").notNull().default(0),
}, table => [uniqueIndex("monthly_notifications_event_kind").on(table.eventId,table.kind)]);
export const monthlyErrors = sqliteTable("monthly_errors", {
  id: text("id").primaryKey(), eventId: text("event_id"), kind: text("kind").notNull(),
  message: text("message").notNull(), createdAt: text("created_at").notNull(),
});
export const monthlySettings = sqliteTable("monthly_settings", {
  key: text("key").primaryKey(), value: text("value").notNull(),
});
