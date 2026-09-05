# Sathyagrahi Academy Communications Hub — Design

## Goal
Add a secure, admin-controlled communication layer to Sathyagrahi Academy `.com` that sends official Academy email and WhatsApp notifications without disturbing the existing Exam → Result → Performance flow.

## Locked Official Email Structure
Google Workspace remains the Academy mailbox system.

- `info@sathyagrahiacademy.com` — primary paid mailbox; general communication and Morning Study Plan
- `exams@sathyagrahiacademy.com` — Google Workspace alias; exam communication
- `results@sathyagrahiacademy.com` — Google Workspace alias; results and Daily Performance
- `support@sathyagrahiacademy.com` — Google Workspace alias; student support
- `admissions@sathyagrahiacademy.com` — Google Workspace alias; admissions/enquiries

Automatic website delivery uses a transactional delivery provider while presenting the locked Academy aliases as sender identities. Google Workspace remains the inbox/reply surface.

## Channels

### Email
- Delivery provider: Resend
- Credentials: Supabase Edge Function secret only; never browser-side
- Sender mapping:
  - Morning Study Plan → `info@...`
  - Exam Published → `exams@...`
  - Result / Daily Performance → `results@...`
- Student recipient: `profiles.email`

### WhatsApp
- Delivery provider: Meta WhatsApp Cloud API
- Credentials: Supabase Edge Function secrets only
- Student recipient: `profiles.phone`
- Business-initiated messages must use approved utility templates.
- WhatsApp content stays concise and links back to the Academy site for full detail where useful.

## Automatic Events

### 1. Morning Study Plan
Source: existing `preparation_tasks` rows where `target_date = current India date` and task belongs to the student.

Content:
- student name
- today’s assigned subjects / chapters / topics
- task type
- target minutes where available
- priority where available
- Academy portal link

Email sender: `info@...`
WhatsApp sender: Academy WhatsApp business number.

Scheduling is admin-controlled. Morning Study Plan automation remains disabled until the admin selects an enabled send time and channel.

### 2. Exam Published
Source: existing official exam publication flow and exam audience.

Content:
- exam title / type / code
- exam date
- duration / marks
- subject/scope summary
- student portal link

Email sender: `exams@...`
WhatsApp: short utility notification.

Trigger: after exam publication succeeds.

### 3. Result Published / Daily Performance
Source combines existing data only:
- `exam_results` for score, correct, wrong, unattempted and percentage
- `student_study_sessions` filtered by the student and the India calendar date for “Today Studied”
- existing Performance Intelligence for strong areas, priority weaknesses / revision, speed/retention signals, and next exam focus where evidence exists

Content:
- student name
- Today Studied summary
- exam title
- score and percentage
- correct / wrong / unattempted
- strong areas
- needs revision / weakness signal
- next focus
- full report link

Email sender: `results@...`
WhatsApp: compact performance summary + report link.

Trigger: after result publication succeeds.

## Admin Control
Create a dedicated `Admin → Communications` page instead of mixing secrets/configuration into public Academy Settings.

Controls:
- Email channel ON/OFF
- WhatsApp channel ON/OFF
- event toggles:
  - Morning Study Plan
  - Exam Published
  - Result / Daily Performance
- Morning Study Plan send time in Asia/Kolkata
- sender mapping display (`info@`, `exams@`, `results@`)
- provider status indicators: Configured / Needs Setup / Error
- Test Email action
- Test WhatsApp action
- recent delivery log with Student, Event, Channel, Status, Sent At, Failure Reason

No API keys, Meta tokens, Resend keys, or other private secrets are editable or displayed in the browser.

## Backend Architecture

### `academy-communications` Edge Function
One focused Edge Function owns communication actions.

Authenticated Admin actions:
- read communication status/settings
- update safe communication settings
- send test email / WhatsApp
- retry an explicitly selected failed delivery

Internal event actions:
- deliver exam publication event
- deliver result/daily performance event
- deliver scheduled morning plan event

Secrets are read from the Edge Function environment. Supabase current guidance is followed: browser uses publishable keys; controlled server code uses secret credentials; external provider tokens stay in project secrets.

## Database

### `academy_communication_settings`
Singleton configuration row storing only non-secret values:
- email_enabled
- whatsapp_enabled
- morning_plan_enabled
- exam_published_enabled
- result_performance_enabled
- morning_send_time
- timezone (`Asia/Kolkata`)
- updated_by / updated_at

RLS enabled. Only Admin-authorized server actions may change it.

### `academy_communication_deliveries`
Delivery audit and idempotency table:
- id
- event_type
- event_key
- student_id
- channel
- recipient_masked
- provider
- status (`pending`, `sent`, `failed`, `skipped`)
- provider_message_id
- failure_reason
- attempted_at
- sent_at
- created_at

Unique key: `(event_key, student_id, channel)` to prevent duplicate delivery.

This table is service-only through the communication Edge Function. No secret provider payloads are stored.

## Event Keys / Duplicate Prevention
Examples:
- `exam_published:<exam_id>`
- `result_published:<attempt_id>`
- `morning_plan:<student_id>:YYYY-MM-DD`

Repeated clicks, retries, page reloads, or repeated publish requests must not create duplicate successful messages.

## Reliability Rule
Communication is secondary to the core Academy workflow.

- Exam publication must remain successful even if email/WhatsApp fails.
- Result publication must remain successful even if email/WhatsApp fails.
- Delivery failure is logged and visible to Admin.
- Admin can retry failed delivery.
- Core grading/result data is never rolled back because a provider is unavailable.

## Existing Flow Changes

### Exam Publish
Existing `admin-exams` publish behavior remains authoritative. After successful publication, it invokes/queues a communication event for the eligible audience.

### Result Publish
Current browser-direct `exam_results.is_published` update must move behind an authenticated Admin server action so result publication and communication event generation have one secure backend boundary. The result itself is committed first; notification delivery follows independently.

## Data Accuracy
- India date calculations use `Asia/Kolkata` semantics.
- “Today Studied” comes from actual `student_study_sessions.session_date`, not inferred cumulative learning totals.
- Morning tasks come from actual `preparation_tasks.target_date`.
- Performance guidance is included only when current published evidence exists; no fabricated weakness/strength is generated.

## Security
- Resend and Meta credentials: Supabase secrets only.
- No service-role / secret keys in frontend JavaScript.
- Admin authorization checked server-side.
- Student PII is not exposed in general logs; recipient is masked in Admin delivery log.
- Communication tables use RLS and/or service-only grants according to their exposure model.
- WhatsApp utility messaging requires valid student phone data and approved templates.

## Provider Readiness
The code and Admin controls can be deployed independently, but actual external sending becomes `Configured` only after these production credentials exist:

Email:
- Resend API key
- verified `sathyagrahiacademy.com` sending domain / sender identities

WhatsApp:
- Meta WhatsApp Cloud API access token
- WhatsApp Phone Number ID
- approved utility template names / language codes used by each event

Missing credentials must show `Needs Setup`; they must never break the website.

## Testing
Tests must cover:
- correct sender alias per event
- correct student email / phone selection
- India-date filtering for Today Studied and Morning Plan
- no duplicate successful delivery
- failed provider call does not block exam/result publication
- disabled channel/event is skipped
- missing recipient is skipped safely
- provider secret never appears in frontend files or API responses
- Admin-only settings/test/retry actions
- result summary uses published result values and existing Performance Intelligence only

## Out of Scope
- SMS
- marketing/bulk campaigns
- admissions automation
- support ticket automation
- AI-generated study plans
- separate paid Google Workspace users for each alias

Those can be added later without changing this communication core.