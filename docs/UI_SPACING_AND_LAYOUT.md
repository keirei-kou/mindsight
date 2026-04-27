# UI Spacing And Layout Rules

## Purpose

Use this document as the default reference for improving UI spacing, alignment, hierarchy, and layout consistency across the app. Prioritize clarity, rhythm, and maintainability over decorative styling.

## Core Principle

Good UI spacing comes from systems, not random pixel choices.

Use consistent spacing tokens and reusable layout patterns.

## Approved Spacing Scale

Only use these values unless there is a strong reason otherwise:

- 4
- 8
- 12
- 16
- 24
- 32
- 48
- 64

### Meaning

- **4**: tight internal spacing for tiny elements
- **8**: default gap between related small items
- **12**: medium gap inside components
- **16**: default card/input/button padding
- **24**: separation between groups inside a section
- **32**: separation between major sections
- **48-64**: page-level breathing room

## Hard Rules

1. Replace arbitrary spacing values with approved scale values.
2. Related items stay visually close.
3. Unrelated groups need stronger separation.
4. Container padding should usually be larger than internal item gaps.
5. Use parent `gap` instead of child margins when possible.
6. Repeated components must share spacing values.
7. Remove double padding caused by nested wrappers.
8. Headings belong to content below them.
9. Use spacing for hierarchy before adding borders or colors.
10. Keep layouts compact but breathable.
11. Align controls to shared heights and edges.
12. Prefer clean vertical rhythm across forms and panels.

## Three Levels Of Spacing

Every screen should visibly use:

- **Micro**: 4-8 for labels, icons, and tight rows.
- **Component**: 12-16 for cards, controls, and groups.
- **Section**: 24-32+ for page regions and large content blocks.

## Component Standards

### Cards

- Padding: 16
- Label to value gap: 4 or 8
- Group gap: 12
- Section gap inside large cards: 16 or 24

### Buttons

- Shared height across same row
- Shared horizontal padding
- Inline button gap: 8

### Inputs / Selects

- Shared height system
- Consistent label spacing
- Gap between controls: 8 or 12

### Grids / Tables

- Horizontal clarity first
- Use 12-16 column gaps
- Avoid cramped rows

## Hierarchy Rules

1. Most important content should scan first.
2. Title > subtitle > controls > content > secondary info.
3. Bigger spacing between hierarchy levels than within a level.
4. Headings should sit closer to their content than to previous sections.
5. Metrics should appear in digestible groups.
6. If two things look equally important but are not, fix spacing first.

## Cleanup Instructions For Codex

When revising any screen:

1. Identify inconsistent spacing values.
2. Normalize values to approved scale.
3. Replace sibling margins with flex/grid gap.
4. Remove unnecessary wrappers.
5. Standardize card padding.
6. Standardize control heights.
7. Improve grouping of related elements.
8. Improve separation of unrelated elements.
9. Preserve functionality and logic.
10. Improve layout only unless asked otherwise.

## Default App Baseline

Use these defaults unless context requires changes:

- Page padding: 32
- Section gap: 32
- Card padding: 16
- Grid gap: 16
- Component gap: 12
- Tight inline gap: 8
- Tiny label gap: 4

## Final Design Philosophy

Calm spacing beats clever spacing.
Consistency beats improvisation.
Structure beats clutter.
