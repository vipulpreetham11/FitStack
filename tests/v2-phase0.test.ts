import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const db = new PGlite()
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const gym=id(1), otherGym=id(2), owner=id(10), admin=id(11), rec=id(12), trainer=id(13), trainer2=id(14), member=id(15), outsider=id(16), platform=id(17)
const ownerRow=id(20), adminRow=id(21), recRow=id(22), trainerRow=id(23), trainer2Row=id(24), memberRow=id(25), outsiderRow=id(26), plan=id(30), otherPlan=id(31)
const lead=id(40), otherLead=id(41), ownLead=id(42), hiddenLead=id(43), bill=id(50), payment=id(51), invoice=id(52)
const tables=['leads','lead_activities','follow_ups','staff_attendance','expenses','products','bill_orders','bill_order_items','bill_payments','bill_items','staff_earnings']

async function query(sql: string, role='postgres', uid='') {
  await db.exec('SAVEPOINT request_scope')
  try {
    await db.exec(`SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${uid}',true)`)
    const result=await db.query(sql)
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); RELEASE SAVEPOINT request_scope")
    return result.rows as Record<string, any>[]
  } catch (error) {
    await db.exec('ROLLBACK TO SAVEPOINT request_scope; RELEASE SAVEPOINT request_scope')
    throw error
  }
}
const user=(uid:string,sql:string)=>query(sql,'authenticated',uid)
const service=(sql:string)=>query(sql,'service_role')
async function scalar(sql:string) { return Object.values((await query(sql))[0])[0] }
async function createBill(memberId:string|null=memberRow) {
  await query(`INSERT INTO public.bill_orders(id,gym_id,member_id,customer_name,sold_by,created_by,subtotal,taxable_amount,gst_amount,total_amount)
    VALUES('${bill}','${gym}',${memberId ? `'${memberId}'` : 'NULL'},'Test Customer','${recRow}','${recRow}',100,100,5,105)`)
}
async function captureBill() {
  await query(`INSERT INTO public.bill_payments(id,gym_id,bill_order_id,status,amount,razorpay_order_id,razorpay_payment_id,captured_at)
    VALUES('${payment}','${gym}','${bill}','captured',105,'order_test','pay_test',now())`)
}
const invoiceSql=(memberId:string|null=memberRow,amount=105)=>`INSERT INTO public.invoices(id,gym_id,member_id,bill_payment_id,invoice_number,gym_name,member_name,customer_name,items,subtotal,taxable_amount,cgst_amount,sgst_amount,total_amount,sold_by,payment_ref)
  VALUES('${invoice}','${gym}',${memberId ? `'${memberId}'` : 'NULL'},'${payment}','V2-TEST','Test Gym','Test Customer','Test Customer','[]',100,100,2.5,2.5,${amount},'${recRow}','pay_test')`

beforeAll(async()=>{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(repeat('ab',n),'hex') $$;`)
  await db.exec(readFileSync(new URL('../supabase/fitstack-v1.sql',import.meta.url),'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',''))
  await db.exec(readFileSync(new URL('../supabase/migrations/20260918062134_v2_phase0_foundation.sql',import.meta.url),'utf8'))
  await db.exec(`INSERT INTO auth.users(id) VALUES ${[owner,admin,rec,trainer,trainer2,member,outsider,platform].map(v=>`('${v}')`).join(',')};
    INSERT INTO public.profiles(id,full_name,is_super_admin) VALUES ${[owner,admin,rec,trainer,trainer2,member,outsider,platform].map((v,i)=>`('${v}','User ${i}',${v===platform})`).join(',')};
    INSERT INTO public.gyms(id,name,slug) VALUES('${gym}','Gym A','v2-gym-a'),('${otherGym}','Gym B','v2-gym-b');
    INSERT INTO public.gym_members(id,gym_id,profile_id,role) VALUES
      ('${ownerRow}','${gym}','${owner}','owner'),('${adminRow}','${gym}','${admin}','admin'),('${recRow}','${gym}','${rec}','receptionist'),
      ('${trainerRow}','${gym}','${trainer}','trainer'),('${trainer2Row}','${gym}','${trainer2}','trainer'),('${memberRow}','${gym}','${member}','member'),('${outsiderRow}','${otherGym}','${outsider}','owner');
    INSERT INTO public.membership_plans(id,gym_id,name,price,duration_type,duration_value) VALUES('${plan}','${gym}','Monthly',100,'months',1),('${otherPlan}','${otherGym}','Other',100,'months',1);
    INSERT INTO public.leads(id,gym_id,name,source,assigned_to) VALUES('${lead}','${gym}','Unassigned','walk_in',NULL),('${otherLead}','${otherGym}','Other Gym','walk_in','${outsiderRow}'),('${ownLead}','${gym}','Trainer Lead','google','${trainerRow}'),('${hiddenLead}','${gym}','Other Trainer Lead','google','${trainer2Row}');`)
},30000)
beforeEach(()=>db.exec('BEGIN'))
afterEach(()=>db.exec('ROLLBACK'))
afterAll(()=>db.close())

describe('V2 Phase 0 tenant and role boundaries',()=>{
  it('enables RLS and four explicit operation policies on every new table',async()=>{
    for(const table of tables) {
      expect(await scalar(`SELECT relrowsecurity FROM pg_class WHERE oid='public.${table}'::regclass`)).toBe(true)
      expect(await scalar(`SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='${table}'`)).toBe(4)
      await expect(query(`SELECT id FROM public.${table}`,'anon')).rejects.toThrow()
      expect(await user(member,`SELECT id FROM public.${table}`)).toHaveLength(0)
    }
  })
  it('isolates CRM by gym and restricts trainers to assigned leads',async()=>{
    expect(await user(owner,`SELECT id FROM public.leads WHERE gym_id='${gym}'`)).toHaveLength(3)
    expect(await user(outsider,`SELECT id FROM public.leads WHERE gym_id='${gym}'`)).toHaveLength(0)
    expect(await user(trainer,`SELECT id FROM public.leads WHERE gym_id='${gym}'`)).toEqual([{id:ownLead}])
    expect(await user(platform,`SELECT id FROM public.leads WHERE gym_id='${otherGym}'`)).toHaveLength(1)
    await expect(user(rec,`INSERT INTO public.leads(gym_id,name,source) VALUES('${otherGym}','Intruder','phone')`)).rejects.toThrow()
  })
  it('attributes lead creation to the JWT user and rejects forged identities',async()=>{
    const rows=await user(rec,`INSERT INTO public.leads(gym_id,name,source) VALUES('${gym}','New Lead','phone') RETURNING created_by`)
    expect(rows).toEqual([{created_by:recRow}])
    await expect(user(rec,`INSERT INTO public.leads(gym_id,name,source,created_by) VALUES('${gym}','Forged','phone','${ownerRow}')`)).rejects.toThrow()
    await expect(user(rec,`UPDATE public.leads SET gym_id='${otherGym}' WHERE id='${lead}' AND gym_id='${gym}'`)).rejects.toThrow()
    await expect(user(rec,`UPDATE public.leads SET stage='converted' WHERE id='${lead}' AND gym_id='${gym}'`)).rejects.toThrow()
  })
  it('requires same-gym references even for privileged server writes',async()=>{
    await expect(service(`INSERT INTO public.lead_activities(gym_id,lead_id,activity_type) VALUES('${gym}','${otherLead}','note')`)).rejects.toThrow()
    await expect(service(`INSERT INTO public.follow_ups(gym_id,follow_up_type,related_type,related_id,due_date) VALUES('${gym}','manual','member','${outsiderRow}',CURRENT_DATE)`)).rejects.toThrow()
    await expect(service(`INSERT INTO public.follow_ups(gym_id,follow_up_type,related_type,related_id,due_date) VALUES('${gym}','manual','lead','${otherLead}',CURRENT_DATE)`)).rejects.toThrow()
  })
  it('allows trainer activity only on assigned leads and keeps audit rows append-only',async()=>{
    const rows=await user(trainer,`INSERT INTO public.lead_activities(gym_id,lead_id,activity_type,notes) VALUES('${gym}','${ownLead}','call','Called') RETURNING created_by`)
    expect(rows).toEqual([{created_by:trainerRow}])
    await expect(user(trainer,`INSERT INTO public.lead_activities(gym_id,lead_id,activity_type) VALUES('${gym}','${hiddenLead}','call')`)).rejects.toThrow()
    await expect(user(trainer,`INSERT INTO public.lead_activities(gym_id,lead_id,activity_type) VALUES('${gym}','${ownLead}','stage_change')`)).rejects.toThrow()
    await expect(service(`UPDATE public.lead_activities SET notes='Changed' WHERE gym_id='${gym}'`)).rejects.toThrow(/immutable/)
  })
  it('records follow-up completion and snooze without permitting assignment theft',async()=>{
    const [row]=await user(owner,`INSERT INTO public.follow_ups(gym_id,follow_up_type,related_type,related_id,assigned_to,due_date) VALUES('${gym}','manual','lead','${ownLead}','${trainerRow}',CURRENT_DATE) RETURNING id`)
    expect(await user(trainer2,`SELECT id FROM public.follow_ups WHERE gym_id='${gym}'`)).toHaveLength(0)
    await user(trainer,`UPDATE public.follow_ups SET status='completed' WHERE gym_id='${gym}' AND id='${row.id}'`)
    expect(await scalar(`SELECT completed_by FROM public.follow_ups WHERE gym_id='${gym}' AND id='${row.id}'`)).toBe(trainerRow)
    expect(await scalar(`SELECT completed_at IS NOT NULL FROM public.follow_ups WHERE gym_id='${gym}' AND id='${row.id}'`)).toBe(true)
    await user(trainer,`UPDATE public.follow_ups SET status='pending',due_date=CURRENT_DATE+1 WHERE gym_id='${gym}' AND id='${row.id}'`)
    expect(await scalar(`SELECT completed_at IS NULL AND completed_by IS NULL FROM public.follow_ups WHERE gym_id='${gym}' AND id='${row.id}'`)).toBe(true)
    await expect(user(trainer,`UPDATE public.follow_ups SET assigned_to='${trainer2Row}' WHERE gym_id='${gym}' AND id='${row.id}'`)).rejects.toThrow()
  })
  it('gives receptionist staff-attendance read access without marking rights',async()=>{
    await user(owner,`INSERT INTO public.staff_attendance(gym_id,staff_member_id,check_in_at) VALUES('${gym}','${trainerRow}',now())`)
    expect(await user(rec,`SELECT staff_member_id,marked_by FROM public.staff_attendance WHERE gym_id='${gym}'`)).toEqual([{staff_member_id:trainerRow,marked_by:ownerRow}])
    expect(await user(trainer,`SELECT id FROM public.staff_attendance WHERE gym_id='${gym}'`)).toHaveLength(1)
    expect(await user(trainer2,`SELECT id FROM public.staff_attendance WHERE gym_id='${gym}'`)).toHaveLength(0)
    await expect(user(rec,`INSERT INTO public.staff_attendance(gym_id,staff_member_id) VALUES('${gym}','${recRow}')`)).rejects.toThrow()
    await expect(user(owner,`INSERT INTO public.staff_attendance(gym_id,staff_member_id) VALUES('${gym}','${memberRow}')`)).rejects.toThrow()
  })
  it('allows expense creator edits, manager edits, and archival but never deletion',async()=>{
    const [row]=await user(rec,`INSERT INTO public.expenses(gym_id,category,amount,description) VALUES('${gym}','supplies',100,'Towels') RETURNING id`)
    await user(rec,`UPDATE public.expenses SET amount=120 WHERE gym_id='${gym}' AND id='${row.id}'`)
    await user(owner,`INSERT INTO public.expenses(gym_id,category,amount,description) VALUES('${gym}','rent',500,'Rent')`)
    expect(await user(rec,`UPDATE public.expenses SET amount=1 WHERE gym_id='${gym}' AND category='rent' RETURNING id`)).toHaveLength(0)
    await user(admin,`UPDATE public.expenses SET is_active=false WHERE gym_id='${gym}' AND id='${row.id}'`)
    expect(await scalar(`SELECT is_active FROM public.expenses WHERE gym_id='${gym}' AND id='${row.id}'`)).toBe(false)
    await expect(user(owner,`DELETE FROM public.expenses WHERE gym_id='${gym}'`)).rejects.toThrow()
    await expect(service(`DELETE FROM public.expenses WHERE gym_id='${gym}'`)).rejects.toThrow()
  })
  it('keeps salary, commission and protected V1 columns inaccessible to browser SQL',async()=>{
    for(const uid of [member,trainer,rec,owner]) {
      await expect(user(uid,`SELECT base_salary,commission_rate FROM public.gym_members WHERE gym_id='${gym}'`)).rejects.toThrow()
      await expect(user(uid,`UPDATE public.gym_members SET base_salary=50000 WHERE gym_id='${gym}'`)).rejects.toThrow()
      await expect(user(uid,`SELECT qr_secret FROM public.gym_members WHERE gym_id='${gym}'`)).rejects.toThrow()
    }
    await user(owner,`UPDATE public.gym_members SET date_of_birth='1990-01-01' WHERE gym_id='${gym}' AND id='${memberRow}'`)
    expect(await scalar(`SELECT date_of_birth::text FROM public.gym_members WHERE gym_id='${gym}' AND id='${memberRow}'`)).toBe('1990-01-01')
  })
  it('keeps all public V2 privileged functions service-only',async()=>{
    const rows=await query(`SELECT p.proname,has_function_privilege('authenticated',p.oid,'EXECUTE') auth,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('service_role',p.oid,'EXECUTE') service,p.prosecdef
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'v2_%' OR p.proname='generate_auto_follow_ups')`)
    expect(rows.length).toBeGreaterThanOrEqual(6)
    for(const row of rows) expect(row).toMatchObject({auth:false,anon:false,service:true,prosecdef:false})
    await expect(user(owner,`SELECT public.v2_update_staff_compensation('${gym}','${owner}','${trainerRow}',1000,5)`)).rejects.toThrow()
    await expect(service(`SELECT public.v2_update_staff_compensation('${gym}','${rec}','${trainerRow}',1000,5)`)).rejects.toThrow(/Owner or admin/)
    await expect(service(`SELECT public.v2_update_staff_compensation('${gym}','${outsider}','${trainerRow}',1000,5)`)).rejects.toThrow()
  })
})

describe('V2 billing, payroll and scheduling integrity',()=>{
  it('permits named walk-in invoices only after a matching capture',async()=>{
    await createBill(null)
    await query(`INSERT INTO public.bill_payments(id,gym_id,bill_order_id,amount) VALUES('${payment}','${gym}','${bill}',105)`)
    await expect(service(invoiceSql(null))).rejects.toThrow(/captured/)
    await service(`UPDATE public.bill_payments SET status='captured',razorpay_order_id='order_test',razorpay_payment_id='pay_test',captured_at=now() WHERE gym_id='${gym}' AND id='${payment}'`)
    await service(invoiceSql(null))
    expect(await user(rec,`SELECT customer_name,member_id FROM public.invoices WHERE gym_id='${gym}'`)).toEqual([{customer_name:'Test Customer',member_id:null}])
    expect(await user(member,`SELECT id FROM public.invoices WHERE gym_id='${gym}'`)).toHaveLength(0)
    await expect(service(`UPDATE public.invoices SET customer_name='Changed' WHERE gym_id='${gym}' AND id='${invoice}'`)).rejects.toThrow(/immutable/)
  })
  it('rejects duplicate captures and invoice replay',async()=>{
    await createBill(); await captureBill(); await service(invoiceSql())
    await expect(service(`INSERT INTO public.bill_payments(gym_id,bill_order_id,status,amount,razorpay_order_id,razorpay_payment_id,captured_at) VALUES('${gym}','${bill}','captured',105,'order_other','pay_other',now())`)).rejects.toThrow()
    await expect(service(invoiceSql().replace(invoice,id(53)).replace('V2-TEST','V2-OTHER'))).rejects.toThrow()
    await expect(service(`UPDATE public.bill_payments SET status='failed' WHERE gym_id='${gym}' AND id='${payment}'`)).rejects.toThrow(/immutable/)
  })
  it('rejects anonymous membership purchases and cross-gym item references',async()=>{
    await createBill(null)
    const sql=(planId:string)=>`INSERT INTO public.bill_order_items(gym_id,bill_order_id,item_type,item_id,requested_start_date,description,unit_price,taxable_amount,total_amount) VALUES('${gym}','${bill}','membership_plan','${planId}',CURRENT_DATE,'Plan',100,100,100)`
    await expect(service(sql(plan))).rejects.toThrow(/require a member/)
    await service(`UPDATE public.bill_orders SET member_id='${memberRow}' WHERE gym_id='${gym}' AND id='${bill}'`)
    await expect(service(sql(otherPlan))).rejects.toThrow()
    await service(sql(plan))
    await service(`UPDATE public.bill_orders SET status='pending' WHERE gym_id='${gym}' AND id='${bill}'`)
    await expect(service(`UPDATE public.bill_order_items SET description='Changed' WHERE gym_id='${gym}' AND bill_order_id='${bill}'`)).rejects.toThrow(/draft/)
  })
  it('denies direct browser billing and earnings writes',async()=>{
    await createBill()
    await expect(user(owner,`UPDATE public.bill_orders SET status='paid' WHERE gym_id='${gym}' AND id='${bill}'`)).rejects.toThrow()
    await expect(user(rec,`INSERT INTO public.bill_payments(gym_id,bill_order_id,amount) VALUES('${gym}','${bill}',105)`)).rejects.toThrow()
    await expect(user(owner,`INSERT INTO public.staff_earnings(gym_id,staff_member_id,month) VALUES('${gym}','${trainerRow}',date_trunc('month',CURRENT_DATE)::date)`)).rejects.toThrow()
  })
  it('calculates commission from invoice total_amount and freezes paid snapshots',async()=>{
    await createBill(); await captureBill(); await service(invoiceSql())
    await service(`SELECT public.v2_update_staff_compensation('${gym}','${owner}','${recRow}',1000,5)`)
    const month="date_trunc('month',(now() AT TIME ZONE 'Asia/Kolkata')::date)::date"
    await service(`SELECT public.v2_refresh_staff_earnings('${gym}','${owner}',${month})`)
    expect(await user(rec,`SELECT total_sales,commission_amount,total_earnings FROM public.staff_earnings WHERE gym_id='${gym}'`)).toEqual([{total_sales:'105.00',commission_amount:'5.25',total_earnings:'1005.25'}])
    expect(await user(trainer,`SELECT staff_member_id FROM public.staff_earnings WHERE gym_id='${gym}'`)).toEqual([{staff_member_id:trainerRow}])
    await service(`SELECT public.v2_mark_staff_earnings_paid('${gym}','${owner}','${recRow}',${month})`)
    await service(`SELECT public.v2_update_staff_compensation('${gym}','${owner}','${recRow}',2000,10)`)
    await service(`SELECT public.v2_refresh_staff_earnings('${gym}','${owner}',${month})`)
    expect(await scalar(`SELECT total_earnings FROM public.staff_earnings WHERE gym_id='${gym}' AND staff_member_id='${recRow}'`)).toBe('1005.25')
    await expect(service(`UPDATE public.staff_earnings SET notes='Changed' WHERE gym_id='${gym}' AND staff_member_id='${recRow}'`)).rejects.toThrow(/immutable/)
    await service(`SELECT public.v2_mark_staff_earnings_paid('${gym}','${owner}','${recRow}',${month})`)
  })
  it('caps credits across multiple notes and checks redemption balances',async()=>{
    await createBill(); await captureBill(); await service(invoiceSql())
    const [row]=await service(`SELECT public.v2_issue_credit_note('${gym}','${owner}','${invoice}',60,'Cancellation',CURRENT_DATE) AS id`)
    await expect(service(`SELECT public.v2_issue_credit_note('${gym}','${owner}','${invoice}',50,'Cancellation',CURRENT_DATE)`)).rejects.toThrow(/exceeds/)
    await service(`SELECT public.v2_redeem_credit_note('${gym}','${owner}','${row.id}',20)`)
    expect(await scalar(`SELECT status FROM public.credit_notes WHERE gym_id='${gym}' AND id='${row.id}'`)).toBe('partially_redeemed')
    await expect(service(`SELECT public.v2_redeem_credit_note('${gym}','${owner}','${row.id}',50)`)).rejects.toThrow(/exceeded/)
    await service(`SELECT public.v2_redeem_credit_note('${gym}','${owner}','${row.id}',40)`)
    expect(await scalar(`SELECT status FROM public.credit_notes WHERE gym_id='${gym}' AND id='${row.id}'`)).toBe('redeemed')
  })
  it('generates IST reminders once per source and marks overdue follow-ups missed',async()=>{
    const today="(now() AT TIME ZONE 'Asia/Kolkata')::date"
    await query(`INSERT INTO public.memberships(gym_id,member_id,plan_id,status,start_date,end_date,original_end_date) VALUES('${gym}','${memberRow}','${plan}','active',${today}-14,${today}+15,${today}+15)`)
    await createBill()
    await service(`UPDATE public.bill_orders SET status='pending',due_date=${today}+7 WHERE gym_id='${gym}' AND id='${bill}'`)
    await query(`INSERT INTO public.follow_ups(gym_id,follow_up_type,related_type,related_id,due_date) VALUES('${gym}','manual','lead','${lead}',${today}-1)`)
    await service('SELECT public.generate_auto_follow_ups()')
    await service('SELECT public.generate_auto_follow_ups()')
    expect(await scalar(`SELECT count(*)::int FROM public.follow_ups WHERE gym_id='${gym}' AND follow_up_type='renewal'`)).toBe(1)
    expect(await scalar(`SELECT count(*)::int FROM public.follow_ups WHERE gym_id='${gym}' AND follow_up_type='payment_due'`)).toBe(1)
    expect(await scalar(`SELECT status FROM public.follow_ups WHERE gym_id='${gym}' AND follow_up_type='manual'`)).toBe('missed')
    await user(rec,`UPDATE public.follow_ups SET status='completed' WHERE gym_id='${gym}' AND follow_up_type='renewal'`)
    await service('SELECT public.generate_auto_follow_ups()')
    expect(await scalar(`SELECT count(*)::int FROM public.follow_ups WHERE gym_id='${gym}' AND follow_up_type='renewal'`)).toBe(1)
  })
  it('preserves V1 invoice issuance and original immutability',async()=>{
    await query(`INSERT INTO public.payments(id,gym_id,member_id,plan_id,requested_start_date,amount,taxable_amount,cgst_amount,sgst_amount,total_amount,status) VALUES('${payment}','${gym}','${memberRow}','${plan}',CURRENT_DATE,100,100,2.5,2.5,105,'captured')`)
    await service(`INSERT INTO public.invoices(id,gym_id,member_id,payment_id,invoice_number,gym_name,member_name,items,subtotal,taxable_amount,cgst_amount,sgst_amount,total_amount) VALUES('${invoice}','${gym}','${memberRow}','${payment}','V1-TEST','Gym A','Member','[]',100,100,2.5,2.5,105)`)
    expect(await user(member,`SELECT payment_id,customer_name FROM public.invoices WHERE gym_id='${gym}'`)).toEqual([{payment_id:payment,customer_name:null}])
    await expect(service(`UPDATE public.invoices SET notes='Updated' WHERE gym_id='${gym}' AND id='${invoice}'`)).rejects.toThrow(/immutable/)
  })
})
