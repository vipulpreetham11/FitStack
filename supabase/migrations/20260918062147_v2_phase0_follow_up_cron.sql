-- 18:40 UTC = 00:10 IST, after the existing midnight membership lifecycle job.
-- cron.schedule updates a same-name job and leaves all V1 jobs unchanged.
SELECT cron.schedule(
  'fitstack-v2-auto-follow-ups',
  '40 18 * * *',
  'SELECT public.generate_auto_follow_ups();'
);
