
import { beforeAll,afterAll,describe,it,expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const db = new PGlite()
const id = (n:number) => '00000000-0000-4000-8000-'+n.toString().padStart(12,'0')
const gym=id(1), otherGym=id(2), owner=id(3), user=id(4), otherUser=id(5), rec=id(6), superUser=id(7), devUser=id(8)
const member=id(14), member2=id(15), ownerMember=id(13), recMember=id(16), otherMember=id(17), devMember=id(18), plan=id(20)
async function scalar(sql:string) { return Object.values((await db.query(sql)).rows[0] as object)[0] }
async function asUser(uid:string, sql:string) {
 await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','"+uid+"',false);")
 try { return await db.query(sql) } finally { await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false);") }
}
beforeAll(async()=>{
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
 GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;
 CREATE SCHEMA extensions;
 -- Test-only stand-in for pgcrypto random bytes (not used by security assertions).
 CREATE FUNCTION extensions.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(repeat('ab',n),'hex') $$;
 `)
 const sql=readFileSync(new URL('../supabase/fitstack-v1.sql',import.meta.url),'utf8')
 await db.exec(sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;','-- pgcrypto stubbed in embedded test only'))
 const devPaymentSql=readFileSync(new URL('../supabase/fitstack-dev-payment-simulation.sql',import.meta.url),'utf8')
 await db.exec(devPaymentSql)
 const ownPaymentsPolicySql=readFileSync(new URL('../supabase/migrations/20260913171840_members_read_own_payments.sql',import.meta.url),'utf8')
 await db.exec(ownPaymentsPolicySql)
 const consolidatedPaymentsPolicySql=readFileSync(new URL('../supabase/migrations/20260913172040_consolidate_payments_select_policy.sql',import.meta.url),'utf8')
 await db.exec(consolidatedPaymentsPolicySql)
 const lifecycleMigration=readFileSync(new URL('../supabase/migrations/20260916195535_deploy_membership_lifecycle_cron.sql',import.meta.url),'utf8')
 const lifecycleFunctions=lifecycleMigration.slice(
  lifecycleMigration.indexOf('CREATE OR REPLACE FUNCTION public.run_membership_lifecycle()'),
  lifecycleMigration.indexOf('CREATE OR REPLACE FUNCTION public.verify_membership_cron_secret')
 )
 await db.exec(lifecycleFunctions)
 await db.exec(`
 INSERT INTO auth.users(id) VALUES ('${owner}'),('${user}'),('${otherUser}'),('${rec}'),('${superUser}'),('${devUser}');
 INSERT INTO public.profiles(id,full_name,phone,is_super_admin) VALUES
 ('${owner}','Owner','+919876543210',false),('${user}','Alice','+919876543211',false),
 ('${otherUser}','Bob','+919876543212',false),('${rec}','Reception','+919876543213',false),
 ('${superUser}','Platform','+919876543214',true),('${devUser}','Dev Member','+919876543215',false);
 INSERT INTO public.gyms(id,name,slug,gstin) VALUES ('${gym}','Gym A','gym-a','TESTGST'),('${otherGym}','Gym B','gym-b',null);
 INSERT INTO public.gym_members(id,gym_id,profile_id,role) VALUES
 ('${ownerMember}','${gym}','${owner}','owner'),('${member}','${gym}','${user}','member'),
 ('${member2}','${gym}','${otherUser}','member'),('${recMember}','${gym}','${rec}','receptionist'),
 ('${otherMember}','${otherGym}','${otherUser}','member'),('${devMember}','${gym}','${devUser}','member');
 INSERT INTO public.membership_plans(id,gym_id,name,price,duration_type,duration_value) VALUES ('${plan}','${gym}','Monthly',100,'months',1);
 `)
},30000)
afterAll(()=>db.close())
describe('V1 SQL',()=>{
 it('creates exactly 16 public tables with RLS',async()=>{
 expect(await scalar("SELECT count(*)::int FROM pg_tables WHERE schemaname='public'")).toBe(16)
 expect(await scalar("SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND rowsecurity")).toBe(16)
 })
 it('keeps members isolated within and across gyms',async()=>{
 const own=await asUser(user,'SELECT id FROM public.gym_members')
 expect(own.rows.map(r=>(r as {id:string}).id)).toEqual([member])
 const directory=await asUser(rec,`SELECT * FROM public.get_member_directory('${gym}')`)
 expect(directory.rows).toHaveLength(5)
 await expect(asUser(user,`SELECT * FROM public.get_member_directory('${gym}')`)).rejects.toThrow()
 await expect(asUser(rec,`SELECT * FROM public.get_member_directory('${otherGym}')`)).rejects.toThrow()
 })
 it('protects QR secrets, credentials, escalation and privileged RPCs',async()=>{
 await expect(asUser(user,'SELECT qr_secret FROM public.gym_members')).rejects.toThrow()
 await expect(asUser(owner,'SELECT razorpay_key_secret_enc FROM public.gyms')).rejects.toThrow()
 await expect(asUser(user,`UPDATE public.profiles SET is_super_admin=true WHERE id='${user}'`)).rejects.toThrow()
 await expect(asUser(rec,`UPDATE public.gym_members SET role='owner' WHERE id='${recMember}'`)).rejects.toThrow()
 await expect(asUser(user,`SELECT public.generate_invoice_number('${gym}')`)).rejects.toThrow()
 await expect(asUser(user,"SELECT public.process_daily_memberships()")).rejects.toThrow()
 })
 it('permits own profile edits but prevents changes to another user',async()=>{
 const own=await asUser(user,`UPDATE public.profiles SET full_name='Alice updated' WHERE id='${user}' RETURNING full_name`)
 expect(own.rows).toHaveLength(1)
 const another=await asUser(user,`UPDATE public.profiles SET full_name='Hacked' WHERE id='${otherUser}' RETURNING id`)
 expect(another.rows).toHaveLength(0)
 })
 it('enforces same-tenant foreign keys even for server writes',async()=>{
 await expect(db.exec(`INSERT INTO public.payments(gym_id,member_id,plan_id,requested_start_date,amount,discount_amount,taxable_amount,cgst_amount,sgst_amount,total_amount) VALUES('${gym}','${otherMember}','${plan}',CURRENT_DATE,100,0,100,2.5,2.5,105)`)).rejects.toThrow()
 })
 it('allows active members to read only their own payments',async()=>{
 await db.exec(`INSERT INTO public.payments(id,gym_id,member_id,plan_id,requested_start_date,amount,taxable_amount,cgst_amount,sgst_amount,total_amount,status)
 VALUES('${id(40)}','${gym}','${member}','${plan}',CURRENT_DATE,5000,5000,125,125,5250,'captured'),
 ('${id(41)}','${gym}','${member2}','${plan}',CURRENT_DATE,1000,1000,25,25,1050,'captured')`)
 expect(await scalar("SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='members_read_own_payments'")).toBe(1)
 expect((await asUser(user,'SELECT id,total_amount,status FROM public.payments ORDER BY id')).rows).toEqual([{id:id(40),total_amount:'5250.00',status:'captured'}])
 expect((await asUser(otherUser,'SELECT id,total_amount,status FROM public.payments ORDER BY id')).rows).toEqual([{id:id(41),total_amount:'1050.00',status:'captured'}])
 })
 it('calculates inclusive durations',async()=>{
 expect(await scalar("SELECT public.calculate_membership_end_date('2026-01-15','months',1)::text")).toBe('2026-02-14')
 expect(await scalar("SELECT public.calculate_membership_end_date('2026-09-01','days',100)::text")).toBe('2026-12-09')
 expect(await scalar("SELECT public.calculate_membership_end_date('2026-01-01','years',1)::text")).toBe('2026-12-31')
 })
 it('resets invoice year atomically and never resets an in-use year',async()=>{
 await db.exec(`UPDATE public.gyms SET invoice_year=2000,invoice_counter=99 WHERE id='${gym}'`)
 const first=await scalar(`SELECT public.generate_invoice_number('${gym}')`)
 expect(first).toMatch(/INV-\d{4}-0001/)
 await db.exec('SELECT public.reset_invoice_counters()')
 expect(await scalar(`SELECT public.generate_invoice_number('${gym}')`)).toMatch(/INV-\d{4}-0002/)
 })
 it('atomically captures payment, snapshots invoice and handles event replay',async()=>{
 const pay=id(30),rp='pay_test',order='order_test',event='event_test'
 await db.exec(`INSERT INTO public.payments(id,gym_id,member_id,plan_id,requested_start_date,amount,taxable_amount,cgst_amount,sgst_amount,total_amount,razorpay_order_id,created_by)
 VALUES('${pay}','${gym}','${member}','${plan}',(now() AT TIME ZONE 'Asia/Kolkata')::date,100,100,2.5,2.5,105,'${order}','${recMember}')`)
 const payload=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:rp,order_id:order,amount:10500,currency:'INR'}}}})
 const call=`SELECT public.process_payment_capture('${pay}','${rp}','verified-signature','${plan}',(now() AT TIME ZONE 'Asia/Kolkata')::date,'${event}','${payload}'::jsonb)`
 await db.exec('SET ROLE service_role')
 try { await db.query(call); await db.query(call) } finally {await db.exec('RESET ROLE')}
 expect(await scalar(`SELECT count(*)::int FROM public.invoices WHERE payment_id='${pay}'`)).toBe(1)
 expect(await scalar(`SELECT count(*)::int FROM public.memberships WHERE payment_id='${pay}'`)).toBe(1)
 expect(await scalar(`SELECT processed FROM public.razorpay_webhook_events WHERE event_id='${event}'`)).toBe(true)
 expect((await asUser(otherUser,'SELECT id FROM public.invoices')).rows).toHaveLength(0)
 await expect(db.exec(`UPDATE public.invoices SET total_amount=0 WHERE payment_id='${pay}'`)).rejects.toThrow()
 })
 it('simulates a development checkout through one authorized transaction',async()=>{
  const preview=await asUser(devUser,`SELECT public.simulate_payment_checkout('${gym}','${devMember}','${plan}',CURRENT_DATE,NULL,true) AS result`)
  expect((preview.rows[0] as {result:{simulated:boolean;captured:boolean}}).result).toMatchObject({simulated:true,captured:false})
  expect(await scalar(`SELECT count(*)::int FROM public.payments WHERE member_id='${devMember}'`)).toBe(0)
  await expect(asUser(devUser,`SELECT public.simulate_payment_checkout('${gym}','${member}','${plan}',CURRENT_DATE,NULL,false)`)).rejects.toThrow(/only purchase a membership for yourself/i)
  const checkout=await asUser(devUser,`SELECT public.simulate_payment_checkout('${gym}','${devMember}','${plan}',CURRENT_DATE,NULL,false) AS result`)
  const result=(checkout.rows[0] as {result:{simulated:boolean;captured:boolean;paymentId:string;invoiceId:string;membershipId:string;orderId:string}}).result
  expect(result).toMatchObject({simulated:true,captured:true})
  expect(result.orderId).toMatch(/^dev_order_/)
  expect(await scalar(`SELECT status FROM public.payments WHERE id='${result.paymentId}'`)).toBe('captured')
  expect(await scalar(`SELECT count(*)::int FROM public.memberships WHERE id='${result.membershipId}' AND payment_id='${result.paymentId}'`)).toBe(1)
  expect(await scalar(`SELECT count(*)::int FROM public.invoices WHERE id='${result.invoiceId}' AND payment_id='${result.paymentId}'`)).toBe(1)
 })
 it('enforces one current and one renewal; rolls back all capture side effects on conflict',async()=>{
 const current=await scalar(`SELECT id FROM public.memberships WHERE member_id='${member}' AND status='active'`)
 expect(current).toBeTruthy()
 await expect(db.exec(`INSERT INTO public.memberships(gym_id,member_id,plan_id,status,start_date,end_date,original_end_date) VALUES('${gym}','${member}','${plan}','frozen',CURRENT_DATE,CURRENT_DATE+10,CURRENT_DATE+10)`)).rejects.toThrow()
 await db.exec(`INSERT INTO public.memberships(gym_id,member_id,plan_id,status,start_date,end_date,original_end_date) VALUES('${gym}','${member}','${plan}','scheduled',CURRENT_DATE+40,CURRENT_DATE+70,CURRENT_DATE+70)`)
 await expect(db.exec(`INSERT INTO public.memberships(gym_id,member_id,plan_id,status,start_date,end_date,original_end_date) VALUES('${gym}','${member}','${plan}','scheduled',CURRENT_DATE+80,CURRENT_DATE+100,CURRENT_DATE+100)`)).rejects.toThrow()
 const pay=id(31)
 await db.exec(`INSERT INTO public.payments(id,gym_id,member_id,plan_id,requested_start_date,amount,taxable_amount,cgst_amount,sgst_amount,total_amount,razorpay_order_id)
 VALUES('${pay}','${gym}','${member}','${plan}',CURRENT_DATE,100,100,2.5,2.5,105,'order_conflict')`)
 const payload=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_conflict',order_id:'order_conflict',amount:10500,currency:'INR'}}}})
 await expect(db.query(`SELECT public.process_payment_capture('${pay}','pay_conflict','sig','${plan}',CURRENT_DATE,'event_conflict','${payload}')`)).rejects.toThrow()
 expect(await scalar(`SELECT status FROM public.payments WHERE id='${pay}'`)).toBe('created')
 expect(await scalar("SELECT count(*)::int FROM public.razorpay_webhook_events WHERE event_id='event_conflict'")).toBe(0)
 })
 it('expires current membership before activating renewal',async()=>{
 await db.exec(`UPDATE public.memberships SET end_date=(now() AT TIME ZONE 'Asia/Kolkata')::date-1,start_date=(now() AT TIME ZONE 'Asia/Kolkata')::date-30 WHERE member_id='${member}' AND status='active';
 UPDATE public.memberships SET start_date=(now() AT TIME ZONE 'Asia/Kolkata')::date,end_date=(now() AT TIME ZONE 'Asia/Kolkata')::date+29 WHERE member_id='${member}' AND status='scheduled';`)
 const lifecycle=await db.query('SELECT public.run_membership_lifecycle() AS result')
 expect((lifecycle.rows[0] as {result:{expired:number;activated:number;resumed:number;errors:string[]}}).result).toMatchObject({expired:1,activated:1,resumed:0,errors:[]})
 expect(await scalar(`SELECT count(*)::int FROM public.memberships WHERE member_id='${member}' AND status='active'`)).toBe(1)
 expect(await scalar(`SELECT count(*)::int FROM public.memberships WHERE member_id='${member}' AND status='expired'`)).toBe(1)
 expect(await scalar(`SELECT details->>'reason' FROM public.membership_events WHERE membership_id IN (SELECT id FROM public.memberships WHERE member_id='${member}' AND status='expired') AND event_type='expired' ORDER BY created_at DESC LIMIT 1`)).toBe('Auto-expired by system')
 })
 it('auto-resumes a completed freeze without extending the end date twice',async()=>{
 const frozenMembership=id(50), freeze=id(51)
 await db.exec('BEGIN')
 try {
  await db.exec(`INSERT INTO public.memberships(id,gym_id,member_id,plan_id,status,start_date,end_date,original_end_date,frozen_at,frozen_until,freeze_count)
  VALUES('${frozenMembership}','${gym}','${member2}','${plan}','frozen',CURRENT_DATE-10,CURRENT_DATE+20,CURRENT_DATE+18,now()-interval '2 days',CURRENT_DATE,1);
  INSERT INTO public.membership_freezes(id,gym_id,membership_id,frozen_at,planned_days)
  VALUES('${freeze}','${gym}','${frozenMembership}',now()-interval '2 days',2);`)
  const lifecycle=await db.query('SELECT public.run_membership_lifecycle() AS result')
  expect((lifecycle.rows[0] as {result:{resumed:number;errors:string[]}}).result).toMatchObject({resumed:1,errors:[]})
  expect(await scalar(`SELECT status FROM public.memberships WHERE id='${frozenMembership}'`)).toBe('active')
  expect(await scalar(`SELECT end_date=CURRENT_DATE+20 FROM public.memberships WHERE id='${frozenMembership}'`)).toBe(true)
  expect(await scalar(`SELECT total_freeze_days FROM public.memberships WHERE id='${frozenMembership}'`)).toBe(2)
  expect(await scalar(`SELECT actual_days FROM public.membership_freezes WHERE id='${freeze}'`)).toBe(2)
  expect(await scalar(`SELECT details->>'reason' FROM public.membership_events WHERE membership_id='${frozenMembership}' AND event_type='resumed'`)).toBe('Auto-resumed by system after freeze ended')
 } finally {
  await db.exec('ROLLBACK')
 }
 })
 it('reschedules renewal after a long extension while preserving original history',async()=>{
 await db.exec(`INSERT INTO public.memberships(gym_id,member_id,plan_id,status,start_date,end_date,original_end_date) VALUES('${gym}','${member}','${plan}','scheduled',CURRENT_DATE+30,CURRENT_DATE+59,CURRENT_DATE+59);
 UPDATE public.memberships SET end_date=CURRENT_DATE+100 WHERE member_id='${member}' AND status='active';
 SELECT public.sync_scheduled_renewal('${member}');`)
 expect(await scalar(`SELECT start_date=(SELECT end_date+1 FROM public.memberships WHERE member_id='${member}' AND status='active') FROM public.memberships WHERE member_id='${member}' AND status='scheduled'`)).toBe(true)
 })
 it('free checkout is idempotent and creates a zero invoice',async()=>{
 const pay=id(32)
 await db.exec(`INSERT INTO public.payments(id,gym_id,member_id,plan_id,requested_start_date,amount,taxable_amount,cgst_amount,sgst_amount,total_amount) VALUES('${pay}','${gym}','${member2}','${plan}',CURRENT_DATE,0,0,0,0,0)`)
 const call=`SELECT public.process_payment_capture('${pay}',NULL,NULL,'${plan}',CURRENT_DATE)`
 await db.exec(call); await db.exec(call)
 expect(await scalar(`SELECT count(*)::int FROM public.invoices WHERE payment_id='${pay}' AND total_amount=0 AND payment_method='free'`)).toBe(1)
 })
 it('disabled gym is read-only to owner and inaccessible to members',async()=>{
 await db.exec(`UPDATE public.gyms SET is_active=false WHERE id='${gym}'`)
 expect((await asUser(user,'SELECT id FROM public.memberships')).rows).toHaveLength(0)
 expect((await asUser(owner,'SELECT id FROM public.gyms')).rows).toHaveLength(1)
 expect((await asUser(owner,`UPDATE public.gyms SET name='Changed' WHERE id='${gym}' RETURNING id`)).rows).toHaveLength(0)
 expect((await asUser(superUser,'SELECT id FROM public.gyms')).rows).toHaveLength(2)
 await db.exec(`UPDATE public.gyms SET is_active=true WHERE id='${gym}'`)
 })
})
