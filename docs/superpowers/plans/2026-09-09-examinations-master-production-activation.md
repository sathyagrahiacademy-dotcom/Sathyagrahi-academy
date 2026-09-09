# Examinations Master Production Activation

## Safety sequence

1. Apply Phase 1 foundation migration.
2. Apply Phase 2 migration and blueprint invalidation triggers.
3. Deploy `admin-exam-wizard`.
4. Upgrade `admin-exams` while preserving legacy create/update/publish compatibility.
5. Upgrade `student-exam-access` and `admin-exam-blueprint`.
6. Run database/advisor/smoke checks.
7. Enable the Master frontend only on `admin-exams.html` through `supabase-config.js`.
8. Require full CI before merge.
9. Verify the live static page after Pages deployment.

## Rollback

If the Master UI has a live issue, set `window.SGA_EXAMINATIONS_MASTER_PHASE1_ENABLED` back to false / remove the page-scoped activation. The legacy Exams enhancement remains present as the fallback path. Backend schema changes are additive and should not be rolled back during an incident unless a separate migration review requires it.
