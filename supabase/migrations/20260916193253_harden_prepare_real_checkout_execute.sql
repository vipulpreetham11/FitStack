begin;

revoke all on function public.prepare_real_checkout(uuid, uuid, uuid, date, text)
from public, anon;

grant execute on function public.prepare_real_checkout(uuid, uuid, uuid, date, text)
to authenticated, service_role;

commit;
