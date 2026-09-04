-- Allow trusted Edge Functions to read the canonical NEET syllabus hierarchy.
-- The browser still reaches exam scope data through protected admin Edge Functions.

grant select on public.neet_syllabus_units to service_role;
grant select on public.neet_syllabus_topics to service_role;
