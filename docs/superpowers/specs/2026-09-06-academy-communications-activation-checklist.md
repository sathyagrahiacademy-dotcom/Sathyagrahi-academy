# Academy Communications Activation Checklist

Keep all communication switches OFF until every applicable item below is complete.

## Email
- Resend account/API key configured as an Edge Function secret
- `sathyagrahiacademy.com` verified for sending
- SPF/DKIM checks complete
- `info@`, `exams@`, `results@` sender identities accepted by provider
- Test Email sent to a controlled Academy contact and delivery verified

## WhatsApp
- Meta WhatsApp Cloud API token configured as an Edge Function secret
- Phone Number ID configured
- Graph API version configured
- Morning, Exam Published and Result Published utility templates approved
- Template names/language configured as Edge Function secrets
- Test WhatsApp sent to a controlled Academy contact and delivery verified

## Server-to-server / Scheduler
- `ACADEMY_COMMUNICATIONS_INTERNAL_KEY` configured securely for both caller and Communications Edge Function
- Secure morning scheduler configured to invoke `morning_dispatch`
- Scheduler cadence covers the configured five-minute India-time send window

## Activation
1. Verify student email/phone records.
2. Test one controlled recipient first.
3. Enable only the intended channel.
4. Enable one event type at a time.
5. Confirm delivery log status and masked recipient.
6. Enable Morning Plan only after scheduler verification.
