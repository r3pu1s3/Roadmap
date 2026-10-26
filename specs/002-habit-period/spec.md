# Feature Specification: Habit Period

**Feature Branch**: `002-habit-period`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "This is a modification to habit building and update. During creation and update user must now add a period i.e. how often the habit repeats. The user can select already common period i.e. daily, weekly, monthly yearly. The user can also create a custom period in hours. Now period is optional, and if it isn't filled out or left blank the period is assumed to be None and sets the Habit as a one-time occurrence."

This feature extends Habit Blocks (`specs/001-habit-blocks`). Everything in that spec still applies unless this spec changes it.

## Clarifications

### Session 2026-10-14

- Q: Should a custom period shorter than the habit's length of time be rejected? → A: No, it is allowed. The period and the length of time are independent: the period only says how often that length of time occurs.
- Q: Do Monthly and Yearly mean the same date each calendar month/year, or fixed lengths in hours? → A: The same date each calendar month/year, as people would expect.
- Q: How should the habits page show a long custom period, such as 168 or 720 hours? → A: Always as "Every N h" with the exact hours entered (e.g. "Every 720 h"), never converted to days.
- Q: Must a custom period be whole hours from 1 to 8,760? → A: No. Fractional hours are allowed, up to 8,766 hours (365.25 days).

### Session 2026-10-15

- Q: Is a custom period below 1 hour, including 0, allowed? → A: No. The minimum is 1 hour; anything below, including 0, is rejected, because a user who wants no repeats can simply choose None. (This replaces an earlier decision that 0 meant one-time, with a 1-minute minimum.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set a period when creating a habit (Priority: P1)

While creating a habit, the user reaches a new "period" step that asks how often the habit repeats. They can pick one of the common periods (Daily, Weekly, Monthly, Yearly), enter a custom period as a number of hours, or leave it as "None" so the habit happens only once. The review step shows the chosen period, and after confirming, the habits page shows the new habit with its period.

**Why this priority**: The period is the new information this feature adds. Without a way to set it at creation, nothing else in the feature has a value to show or change.

**Independent Test**: Create three habits, one with "Weekly", one with a custom period of 36 hours, and one with no period. Confirm the habits page shows "Weekly", "Every 36 h", and "One-time" for them, and that this is still true after a reload.

**Acceptance Scenarios**:

1. **Given** the user has completed the length-of-time step, **When** they move to the next step, **Then** the period step opens with "None" selected.
2. **Given** the user is on the period step, **When** they pick Daily, Weekly, Monthly, or Yearly and move on, **Then** the review step shows that period.
3. **Given** the user is on the period step, **When** they choose "Custom" and enter a valid number of hours (fractions allowed, e.g. 1.5), **Then** they can move on and the review step shows "Every N h".
4. **Given** the user is on the period step, **When** they leave "None" selected (or choose "Custom" and leave the hours empty) and move on, **Then** the review step shows the habit as one-time.
5. **Given** the user chose "Custom" and entered an invalid number of hours (for example, 0 or 0.5), **When** they try to move on, **Then** they stay on the period step and see a message explaining what to fix.
6. **Given** the user goes back from the review step to the period step, **When** the period step opens, **Then** their earlier choice is still selected.

---

### User Story 2 - See each habit's period on the habits page (Priority: P1)

On the habits page, each habit block shows its period next to its name and length of time, so the user can tell repeating habits from one-time ones at a glance.

**Why this priority**: A period that is saved but never shown gives the user no value. Showing it is the smallest proof that the period was stored.

**Independent Test**: With habits saved using each kind of period (each preset, a custom one, and none), open the habits page and confirm each block shows the right period label.

**Acceptance Scenarios**:

1. **Given** a habit with a preset period, **When** the habits page loads, **Then** its block shows "Daily", "Weekly", "Monthly", or "Yearly".
2. **Given** a habit with a custom period of N hours, **When** the habits page loads, **Then** its block shows "Every N h".
3. **Given** a habit with no period, including every habit created before this feature, **When** the habits page loads, **Then** its block shows "One-time".

---

### User Story 3 - Change a habit's period on the update page (Priority: P2)

On a habit's update page, the user sees the habit's current period and can change it to another preset, to a custom number of hours, or back to "None", then save.

**Why this priority**: Fixing or adjusting a period matters, but the user already gets value from setting it at creation and seeing it on the list.

**Independent Test**: Open a "Daily" habit, change its period to a custom 12 hours, save, and check the habits page shows "Every 12 h". Then change it to "None", save, and check it shows "One-time".

**Acceptance Scenarios**:

1. **Given** a habit with a period, **When** the user opens its update page, **Then** the period field shows that period already selected (including the hours for a custom period).
2. **Given** the user changes the period to a valid value, **When** they save, **Then** the new period is stored and shown on the habits page.
3. **Given** the user sets the period to "None" (or clears the custom hours), **When** they save, **Then** the habit becomes one-time.
4. **Given** the user enters an invalid custom period, **When** they try to save, **Then** nothing is stored and they see a message explaining what to fix.

---

### Edge Cases

- The custom period is invalid. This is rejected with a clear message. Invalid means any of the following:
  - it is not a number
  - it is less than 1 hour, including 0 and negative numbers
  - it is more than 8,766 hours (365.25 days)
- A custom period is shorter than the habit's length of time (for example, a 2-hour habit every 1 hour). This is allowed: the period only says how often the habit occurs and is not checked against its length of time.
- The user picks "Custom" and then switches to a preset or to "None". Any custom hours they typed are ignored and are not saved.
- The user picks "Custom" and leaves the hours empty. This counts as no period, the same as "None".
- The user picks "Custom" and enters 0. This is rejected like any value under 1 hour; to have no repeats, the user chooses None.
- A custom period equals a preset (for example, 24 hours). It is saved and shown as a custom period ("Every 24 h"), not converted to "Daily".
- Habits that existed before this feature have no period and are shown as one-time.
- A Monthly habit whose date does not exist in a given month (for example, the 31st) and a Yearly habit on 29 February are cases for the later scheduling feature to handle. This feature only stores and shows the period.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A habit's period MUST be exactly one of: None (one-time), Daily, Weekly, Monthly, Yearly, or Custom with a number of hours.
- **FR-002**: The period MUST be optional. If the user does not choose one, or chooses Custom and leaves the hours empty, the period MUST be None and the habit is treated as a one-time occurrence.
- **FR-003**: Habit creation MUST add a period step after the length-of-time step and before the review step, so the order becomes: (1) activity details, (2) length of time, (3) period, (4) review. The period step MUST start with "None" selected.
- **FR-004**: The period step and the update page MUST offer the same choices: None, Daily, Weekly, Monthly, Yearly, and Custom. Choosing Custom MUST show a field for the number of hours.
- **FR-005**: A custom period MUST be a number of hours, fractions allowed (e.g. 1.5), at least 1 hour and no more than 8,766 hours (365.25 days). 0 and anything below 1 hour MUST be rejected.
- **FR-006**: The system MUST check the period before the user can leave the period step, and MUST check it again, with every other field, before any save on creation or update.
- **FR-007**: The review step MUST show the chosen period, using the same labels as the habits page.
- **FR-008**: Each block on the habits page MUST show the habit's period as "Daily", "Weekly", "Monthly", "Yearly", "Every N h" for a custom period, or "One-time" when there is no period. For a custom period, N MUST be the exact number of hours entered, however large (e.g. "Every 720 h"), and MUST NOT be converted to days or any other unit.
- **FR-009**: The update page MUST show the habit's current period and let the user change it to any other valid choice, including None, under the same rules as creation.
- **FR-010**: Moving back and forth between creation steps MUST keep the period choice and any custom hours the user entered.
- **FR-011**: Habits that existed before this feature MUST keep all their other details and MUST have no period (one-time).
- **FR-012**: Monthly and Yearly MUST mean "on the same date each calendar month" and "on the same date each calendar year". They MUST NOT be stored or treated as a fixed number of hours, since their length varies (28–31 days, 365–366 days). Daily and Weekly are likewise stored as named periods, not as hours.
- **FR-013**: The period MUST only describe how often the habit repeats. This feature MUST NOT place habits or their repeats on a calendar or timeline; scheduling stays out of scope.
- **FR-014**: A habit's period and its length of time MUST be independent. The period MUST NOT be checked against, or limited by, the length of time, and changing one MUST NOT change or invalidate the other.

### Key Entities *(include if feature involves data)*

- **Habit** (changed): Gains one attribute, a period. Its attributes are now a name (required), a short description (optional), a length of time in minutes (required), and a period (optional).
- **Period**: How often a habit repeats. It is either one of the named periods (Daily, Weekly, Monthly, Yearly), a custom number of hours (fractions allowed), or absent, which means the habit happens once.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a habit with a period, through every form step, in under 1 minute 15 seconds.
- **SC-002**: A user can tell from the habits page alone, without opening any habit, which habits repeat and how often.
- **SC-003**: 100% of periods set on create or update appear correctly on the habits page after a reload.
- **SC-004**: Every invalid custom period listed in FR-005 and the Edge Cases is rejected with a message that tells the user what to fix, and no habit with an invalid period is ever saved.
- **SC-005**: Every habit that existed before this feature is still listed after the change, with its other details unchanged, and is shown as "One-time".

## Assumptions

- The user said the period "must" be added during creation and update and also that it is optional. This spec reads that as: the period field is always presented, but leaving it blank is allowed and means one-time.
- The period gets its own creation step rather than sharing the length-of-time step, matching the one-topic-per-step pattern of Habit Blocks. The update page stays a single page, with the period field added to it.
- The upper limit for a custom period (8,766 hours, an average 365.25-day year) keeps a custom period from being longer than a year. Anything that repeats less often than that is better served by the Yearly preset. The 1-hour lower limit stops meaningless tiny values; a user who wants no repeats chooses None instead.
- A custom period equal to a preset's length is kept as custom; the app does not rewrite the user's choice.
- A custom period is entered in hours only (fractions allowed). Entering it in days, weeks, or minutes, and patterns like "weekdays only" or "3× per week", are out of scope.
- Start dates, end dates, reminders, streaks, and completion tracking for repeating habits are all out of scope. The period is stored now so a later scheduling feature can use it.
