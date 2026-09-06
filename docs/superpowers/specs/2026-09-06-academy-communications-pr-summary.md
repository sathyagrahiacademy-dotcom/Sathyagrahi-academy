# Academy Communications Hub — Pull Request Summary

## Scope

Adds a safe, disabled-by-default Communications Hub for Sathyagrahi Academy student messaging.

## Included

- Admin Communications page with channel/event switches, provider readiness, test controls and masked delivery logs
- Locked sender identities for info/exams/results@sathyagrahiacademy.com
- Resend email adapter and Meta WhatsApp Cloud API template adapter
- Morning Study Plan dispatcher using existing preparation tasks and Asia/Kolkata time
- Exam Published best-effort communication hook
- Result Published / Daily Performance communication using result data, study sessions and Performance Intelligence
- Server-side result publication through the authenticated Admin Exams Edge Function
- Idempotent per-event/per-student/per-channel delivery storage
- Failure logging and retry support, including Morning Plan retries
- Service-role-only RLS-protected communication tables
- Dedicated CI plus existing regression/syntax/Edge parse verification

## Production safety

- Production database migration has been applied.
- Communication switches remain OFF.
- No external delivery has been sent by this feature.
- Provider credentials, domain/template verification, internal server key and morning scheduler must be configured before activation.
