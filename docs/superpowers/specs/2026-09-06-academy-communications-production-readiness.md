# Academy Communications Hub — Production Readiness

Date: 2026-09-06

## Implemented and verified

- Admin Communications page and controls
- Locked Academy sender aliases:
  - info@sathyagrahiacademy.com
  - exams@sathyagrahiacademy.com
  - results@sathyagrahiacademy.com
- Resend email provider adapter
- Meta WhatsApp Cloud API template adapter
- Morning Study Plan dispatcher using pending `preparation_tasks` for the India calendar date
- Exam Published best-effort communication hook
- Result Published / Daily Performance best-effort communication hook
- Server-side result publication through `admin-exams`
- Delivery masking, idempotency, failure logging and retry support
- Morning Plan retry support
- Service-role-only communication tables protected with RLS
- Communication settings default OFF
- Asia/Kolkata morning scheduling policy
- Communication CI plus full root regression, JavaScript syntax and Edge TypeScript parsing

## Production Supabase state

- `academy_communications_hub` migration applied
- `academy_communications_settings_updated_by_index` follow-up migration applied
- `academy-communications` Edge Function deployed with custom dual authentication
- `admin-exams` production Edge Function updated with best-effort communication integration
- All Email / WhatsApp / Morning / Exam / Result toggles remain OFF
- Communication delivery log remains empty until channels are deliberately activated

## Deliberately not activated yet

External messaging is **not live yet**. The following must be configured and verified before enabling channels:

1. Resend API key and verified `sathyagrahiacademy.com` sender domain
2. Meta WhatsApp Cloud API access token and phone-number ID
3. Approved WhatsApp utility templates and template names
4. Shared `ACADEMY_COMMUNICATIONS_INTERNAL_KEY` for server-to-server events
5. Secure morning scheduler invocation
6. Controlled test delivery to an Academy test/student contact before broad activation

No provider secret belongs in browser JavaScript or public database rows.
