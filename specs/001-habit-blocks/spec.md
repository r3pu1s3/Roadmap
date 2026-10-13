# Feature Specification: Habit Blocks

**Feature Branch**: `001-habit-blocks`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Build a feature that allows user to create habits. Habits are defined as a block of time where an activity is done. A habit can be scheduled on a calendar or timeline where they have clear beginning and end time interval. Scheduling is out of scope for this feature as we are just focusing on habit creation, update, retrieval, and deletion. Overall summary: there is a dedicated page that lists all the blocks. In the same page (view page), user can press an icon to transition a series of form pages to create habits (creation page). User can also update by clicking on a specific block to view and update (update page). User can also delete on the update page at the bottom where a delete button exists."

## Clarifications

### Session 2026-10-12

- Q: Is a habit's time block a length of time only, or a time of day with a start and end? → A: A length of time only. A habit has a name, a short optional description, and a length of time.
- Q: Are habits standalone, or does each one belong to a map or objective? → A: Habits will later be containers that can hold references to map nodes or standalone nodes. Those references are out of scope here, so habits are standalone in this feature.

### Session 2026-10-13

- Q: After you save changes on a habit's update page, where should you end up? → A: Back on the habits page, which shows the updated habit, the same as after create and delete.
- Q: In what order should habits appear on the habits page? → A: Alphabetically by name, ignoring upper/lower case. Habits with the same name are listed oldest first.
- Q: How should you enter a habit's length of time on its form step? → A: Two number fields, hours (0 to 24) and minutes (0 to 59).
- Q: How should you get to the habits page from the rest of the app? → A: Later, from a "Habits" link on a home page. The app has no home page yet, and building one is out of scope, so for now the habits page is opened directly at its own address.
- Q: If you leave the creation steps or the update page with changes you haven't saved, should the app warn you first? → A: No. Leaving always discards unsaved input immediately, with no prompt.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a habit block (Priority: P1)

From the habits page, the user presses an "add" icon and is taken through a short series of form steps that collect what the habit is (its activity) and how long a block of it lasts (its length of time). On finishing the last step, the habit is saved and the user is returned to the habits page, where the new block now appears.

**Why this priority**: Nothing else in this feature works without habits existing. Creating one is the core value: the user can start defining the blocks of time they will later schedule.

**Independent Test**: Starting from an empty habits page, press the add icon, complete every form step, and confirm that the new habit appears in the list and is still there after reloading the page.

**Acceptance Scenarios**:

1. **Given** the user is on the habits page, **When** they press the add icon, **Then** the first step of the creation form opens.
2. **Given** the user is on any creation step other than the first, **When** they choose to go back, **Then** the previous step opens with the values they already entered still filled in.
3. **Given** the user has filled in every required field, **When** they confirm on the final step, **Then** the habit is saved, the user returns to the habits page, and the new habit is shown in the list.
4. **Given** a required field on the current step is empty or invalid, **When** the user tries to move to the next step, **Then** they stay on that step and see a message explaining what to fix.
5. **Given** the user is part-way through the creation steps, **When** they cancel, **Then** no habit is saved, no confirmation prompt is shown, and they return to the habits page.

---

### User Story 2 - View all habit blocks (Priority: P1)

The user opens a dedicated habits page and sees every habit they have created as a list of blocks. Each block shows enough at a glance (its name and its length of time) to tell the habits apart.

**Why this priority**: This page is the entry point to every other action (create, update, delete). It is P1 together with creation because a created habit is only useful once the user can see it.

**Independent Test**: With some habits already saved, open the habits page and confirm that every saved habit appears exactly once with its name and length of time visible.

**Acceptance Scenarios**:

1. **Given** the user has saved habits, **When** they open the habits page, **Then** every saved habit is shown as a block with its name and its length of time, in alphabetical order by name.
2. **Given** the user has no saved habits, **When** they open the habits page, **Then** they see an empty-state message that points them to the add icon.
3. **Given** the habits cannot be loaded, **When** the user opens the habits page, **Then** they see an error message instead of an empty or broken list.

---

### User Story 3 - Update a habit block (Priority: P2)

The user clicks a habit block on the habits page and opens its update page. The page shows the habit's current details, which the user can change and save.

**Why this priority**: Fixing a mistake or adjusting a habit matters, but the user still gets value from creating and viewing habits without it.

**Independent Test**: Click an existing habit, change its name and its length of time, save, and confirm that the habits page shows the new values and that they are still there after a reload.

**Acceptance Scenarios**:

1. **Given** a habit is listed on the habits page, **When** the user clicks its block, **Then** the update page opens with all of that habit's current details filled in.
2. **Given** the user has changed one or more fields to valid values, **When** they save, **Then** the changes are stored, the user returns to the habits page, and it shows the updated habit.
3. **Given** the user has made an invalid change (for example, cleared the name), **When** they try to save, **Then** nothing is stored and they see a message explaining what to fix.
4. **Given** the user has made changes, **When** they leave the update page without saving, **Then** the habit is unchanged.

---

### User Story 4 - Delete a habit block (Priority: P3)

At the bottom of a habit's update page there is a delete button. The user presses it, confirms, and the habit is permanently removed.

**Why this priority**: Deletion is needed to keep the list tidy, but it is the least frequent action and the rest of the feature works without it.

**Independent Test**: Open a habit's update page, press delete, confirm, and check that the user is back on the habits page and the habit no longer appears, even after a reload.

**Acceptance Scenarios**:

1. **Given** the user is on a habit's update page, **When** they press the delete button at the bottom, **Then** they are asked to confirm the deletion.
2. **Given** the confirmation prompt is shown, **When** the user confirms, **Then** the habit is permanently removed and the user returns to the habits page, which no longer lists it.
3. **Given** the confirmation prompt is shown, **When** the user cancels, **Then** the habit is not deleted and the user stays on the update page.

---

### Edge Cases

- A user opens the update page for a habit that no longer exists (for example, through an old link or after deleting it elsewhere). They see a "habit not found" message and a way back to the habits page.
- A save or delete fails partway (for example, the server cannot be reached). The user sees an error, the data they entered stays in the form, and nothing is reported as saved when it was not.
- A habit name is very long. The block on the habits page still shows it readably (for example, cut short with the full name on the update page), and the layout does not break.
- The user enters a length of time that is invalid. This is rejected with a clear message. Invalid means any of the following:
  - both fields are empty, or both are zero
  - either field is negative or not a whole number
  - minutes is above 59
  - hours is above 24
  - the hours are 24 and the minutes are above zero
- Two habits have the same name. This is allowed; habits are told apart by identity, not by name.
- The user presses the final "create" button twice quickly. Only one habit is created.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated habits page that lists every saved habit as a block, sorted alphabetically by name, ignoring upper/lower case. Habits with the same name are listed in the order they were created, oldest first, so the order never changes between reloads. The habits page MUST be reachable at its own address. Linking to it from other pages is out of scope (see Assumptions).
- **FR-002**: Each block on the habits page MUST show at least the habit's name and its length of time (for example, "30 min" or "1 h 15 min"). A habit's length of time is a length only. It has no time of day, start, or end.
- **FR-003**: The habits page MUST show an empty-state message, pointing to the add icon, when no habits exist.
- **FR-004**: The habits page MUST provide an add icon that starts the habit creation flow.
- **FR-005**: Habit creation MUST be a series of form steps, in this order: (1) activity details (name, plus an optional description), (2) length of time, and (3) review of all entered values before confirming.
- **FR-006**: Users MUST be able to move back to earlier creation steps without losing values they have already entered, and to cancel creation at any step without saving anything. Cancelling creation, or leaving the update page without saving, MUST discard unsaved input immediately, without a confirmation prompt.
- **FR-007**: The system MUST check each creation step's fields before the user can move on, and MUST check all fields again before saving.
- **FR-008**: A habit name MUST be required, MUST NOT be blank or only whitespace, and MUST be no longer than 100 characters.
- **FR-009**: A habit's description MUST be optional, short, and no longer than 280 characters.
- **FR-010**: A habit's length of time MUST be entered as two whole-number fields: hours (0 to 24) and minutes (0 to 59). Together they MUST total at least 1 minute and no more than 24 hours (1440 minutes). The same two fields are used on the creation step and on the update page.
- **FR-011**: Clicking a habit block on the habits page MUST open that habit's update page, showing all of its current details.
- **FR-012**: Users MUST be able to edit any of a habit's details on the update page and save the changes, under the same rules as creation (FR-008 to FR-010).
- **FR-013**: The update page MUST have a delete button at the bottom of the page.
- **FR-014**: Deleting a habit MUST require an explicit confirmation step, and confirmed deletion MUST permanently remove the habit.
- **FR-015**: After a successful create, update, or delete, the user MUST be returned to the habits page, which reflects the change.
- **FR-016**: Saved habits MUST persist across page reloads and app restarts.
- **FR-017**: When a load, save, or delete fails, the system MUST show the user an error message and MUST NOT claim the action succeeded.
- **FR-018**: Opening the update page for a habit that does not exist MUST show a "habit not found" message with a way back to the habits page.
- **FR-019**: Habits MUST NOT be placed on a calendar or timeline by this feature. Habits are only defined here; scheduling them is a separate, later feature.
- **FR-020**: Habits MUST be standalone in this feature: there is one list of habits for the whole app, and a habit does not belong to, or depend on, any map or objective. Creating, updating, or deleting a habit MUST NOT affect any map or objective, and the reverse.

### Key Entities *(include if feature involves data)*

- **Habit**: A reusable definition of an activity done over a block of time. It has exactly three attributes: a name (required), a short description (optional), and a length of time in minutes (required). A habit is not tied to a date or a time of day: placing it on a calendar or timeline is out of scope, and a later scheduling feature will create occurrences of a habit rather than change the habit itself. In future, a habit will act as a container that can hold references to nodes in a map or to standalone nodes. Those references are out of scope here, and this feature gives a habit no link to anything.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a new habit from the habits page, through every form step, in under 1 minute.
- **SC-002**: A user can find and open any habit's update page from the habits page with a single click on its block.
- **SC-003**: 100% of habits that are created, updated, or deleted are reflected correctly on the habits page after a reload. No lost edits and no "ghost" habits.
- **SC-004**: Every invalid input listed in FR-008 to FR-010 is rejected with a message that tells the user what to fix, and no invalid habit is ever saved.
- **SC-005**: No habit is ever deleted without the user explicitly confirming the deletion.
- **SC-006**: The habits page shows a list of up to 100 habits within 2 seconds of being opened.

## Assumptions

- The app has a single user and no accounts or login, matching the rest of the app today. Every habit belongs to that one user.
- The habits page is a new top-level page with its own address, which you open directly. The app has no home page yet. Building one, and adding a "Habits" link to it (with a way back), is a separate, later feature. Until then, no other page in the app links to the habits page.
- Habit fields for this version are limited to name, optional description, and length of time. Extras such as colour, icon, category, a frequency ("3× per week"), or a usual time of day are out of scope until scheduling is designed.
- Habits are standalone for now. Letting a habit hold references to map nodes or standalone nodes is planned as a separate, later feature.
- The length of time is entered as hours and minutes, kept as a total number of whole minutes, and shown to the user in hours and minutes. An empty hours or minutes field counts as zero, as long as the other field makes the total at least 1 minute.
- The creation steps follow the grouping in FR-005. The update page is one page showing all fields rather than a series of steps, since the user is editing a habit that already exists.
- Deletion is permanent. There is no undo and no archive.
- Duplicate habit names are allowed.
- Scheduling, calendar or timeline views, reminders, streaks, and completion tracking are all out of scope.
