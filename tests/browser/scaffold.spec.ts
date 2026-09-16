import { test,expect } from '@playwright/test'
const routes = [
  {
    "path": "auth/OnboardingPage",
    "title": "Complete your profile",
    "url": "/onboarding"
  },
  {
    "path": "join/JoinGymPage",
    "title": "Join your gym",
    "url": "/join/example"
  },
  {
    "path": "admin/DashboardPage",
    "title": "Overview",
    "url": "/admin"
  },
  {
    "path": "admin/members/MemberListPage",
    "title": "Members",
    "url": "/admin/members"
  },
  {
    "path": "admin/members/MemberProfilePage",
    "title": "Member profile",
    "url": "/admin/members/example"
  },
  {
    "path": "admin/members/CreateMemberPage",
    "title": "Add member",
    "url": "/admin/members/new"
  },
  {
    "path": "admin/memberships/MembershipListPage",
    "title": "Memberships",
    "url": "/admin/memberships"
  },
  {
    "path": "admin/plans/PlanListPage",
    "title": "Membership plans",
    "url": "/admin/plans"
  },
  {
    "path": "admin/plans/CreatePlanPage",
    "title": "Create plan",
    "url": "/admin/plans/new"
  },
  {
    "path": "admin/plans/EditPlanPage",
    "title": "Edit plan",
    "url": "/admin/plans/example/edit"
  },
  {
    "path": "admin/payments/PaymentListPage",
    "title": "Payments",
    "url": "/admin/payments"
  },
  {
    "path": "admin/invoices/InvoiceListPage",
    "title": "Invoices",
    "url": "/admin/invoices"
  },
  {
    "path": "admin/invoices/InvoiceViewPage",
    "title": "Invoice",
    "url": "/admin/invoices/example"
  },
  {
    "path": "admin/attendance/ScannerPage",
    "title": "QR scanner",
    "url": "/admin/attendance/scanner"
  },
  {
    "path": "admin/attendance/AttendanceListPage",
    "title": "Attendance",
    "url": "/admin/attendance"
  },
  {
    "path": "admin/attendance/AttendanceHistoryPage",
    "title": "Attendance history",
    "url": "/admin/attendance/history"
  },
  {
    "path": "admin/promos/PromoListPage",
    "title": "Promo codes",
    "url": "/admin/promos"
  },
  {
    "path": "admin/promos/CreatePromoPage",
    "title": "Create promo code",
    "url": "/admin/promos/new"
  },
  {
    "path": "admin/reports/RevenueReportPage",
    "title": "Reports",
    "url": "/admin/reports/revenue"
  },
  {
    "path": "admin/reports/MembershipReportPage",
    "title": "Reports",
    "url": "/admin/reports/memberships"
  },
  {
    "path": "admin/reports/AttendanceReportPage",
    "title": "Reports",
    "url": "/admin/reports/attendance"
  },
  {
    "path": "admin/reports/PaymentsReportPage",
    "title": "Reports",
    "url": "/admin/reports/payments"
  },
  {
    "path": "admin/settings/GymProfilePage",
    "title": "Gym settings",
    "url": "/admin/settings"
  },
  {
    "path": "admin/settings/BusinessHoursPage",
    "title": "Business hours",
    "url": "/admin/settings/hours"
  },
  {
    "path": "admin/settings/HolidaysPage",
    "title": "Holidays",
    "url": "/admin/settings/holidays"
  },
  {
    "path": "admin/settings/TeamPage",
    "title": "Team",
    "url": "/admin/settings/team"
  },
  {
    "path": "admin/settings/PaymentSettingsPage",
    "title": "Payment settings",
    "url": "/admin/settings/payments"
  },
  {
    "path": "admin/settings/InvoiceSettingsPage",
    "title": "Invoice settings",
    "url": "/admin/settings/invoices"
  },
  {
    "path": "member/MemberDashboard",
    "title": "Your gym",
    "url": "/member"
  },
  {
    "path": "member/MemberProfilePage",
    "title": "Your profile",
    "url": "/member/profile"
  },
  {
    "path": "member/MemberMembershipPage",
    "title": "Your membership",
    "url": "/member/membership"
  },
  {
    "path": "member/MemberPaymentsPage",
    "title": "Your payments",
    "url": "/member/payments"
  },
  {
    "path": "member/MemberPlansPage",
    "title": "Explore plans",
    "url": "/member/plans"
  },
  {
    "path": "member/MemberQRPage",
    "title": "Your entry QR",
    "url": "/member/qr"
  },
  {
    "path": "super-admin/GymListPage",
    "title": "Gyms",
    "url": "/super-admin"
  },
  {
    "path": "super-admin/GymDetailPage",
    "title": "FitStack Studio",
    "url": "/super-admin/gyms/example"
  },
  {
    "path": "super-admin/CreateGymPage",
    "title": "Onboard New Gym",
    "url": "/super-admin/gyms/new"
  }
]
test.beforeEach(async({page})=>{
 await page.route('https://checkout.razorpay.com/v1/checkout.js',route=>route.fulfill({contentType:'application/javascript',body:''}))
})
test('all routes, guards, mobile navigation and themes',async({page})=>{
 test.setTimeout(90000)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/admin/members')
 await expect(page).toHaveURL(/\/login$/)
 await expect(page.getByRole('heading',{level:1})).toHaveText('Sign in to FitStack')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'owner',exact:true}).click()
 for(const route of routes.filter(r=>r.path.startsWith('admin/'))) {
  await page.evaluate(url=>{history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'))},route.url)
  await expect(page.locator('main')).toBeVisible()
 }
 await page.evaluate(()=>{history.pushState({},'','/admin');window.dispatchEvent(new PopStateEvent('popstate'))})
 await page.setViewportSize({width:1280,height:900})
 await page.screenshot({path:'test-results/admin-desktop.png',fullPage:true,animations:'disabled'})
 await page.getByRole('button',{name:'Switch to dark mode'}).click()
 await expect(page.locator('html')).toHaveClass(/dark/)
 await page.screenshot({path:'test-results/admin-dark.png',fullPage:true,animations:'disabled'})
 await page.reload()
 await expect(page.locator('html')).toHaveClass(/dark/)
 await page.locator('summary').click()
 await page.getByRole('button',{name:'owner',exact:true}).click()
 await page.setViewportSize({width:375,height:812})
 await page.getByRole('button',{name:'Open navigation'}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByRole('dialog').getByRole('link',{name:'Members',exact:true}).click()
 await expect(page).toHaveURL(/\/admin\/members$/)
 await expect(page.getByRole('dialog')).not.toBeVisible()
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true,animations:'disabled'})
 await page.getByRole('button',{name:'Account menu'}).click()
 await page.getByRole('menuitem',{name:'Exit preview'}).click()
 await expect(page).toHaveURL(/\/login$/)
 await page.locator('summary').click()
 await page.getByRole('button',{name:'member',exact:true}).click()
 for(const route of routes.filter(r=>r.path.startsWith('member/'))) {
  await page.evaluate(url=>{history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'))},route.url)
  await expect(page.locator('main')).toBeVisible()
 }
 await page.screenshot({path:'test-results/member-mobile.png',fullPage:true,animations:'disabled'})
 await page.evaluate(()=>{history.pushState({},'','/admin/payments');window.dispatchEvent(new PopStateEvent('popstate'))})
 await expect(page).toHaveURL(/\/member$/)
 await page.getByRole('button',{name:'Account menu'}).click()
 await page.getByRole('menuitem',{name:'Exit preview'}).click()
 await expect(page).toHaveURL(/\/login$/)
 await page.locator('summary').click()
 await page.getByRole('button',{name:'super admin',exact:true}).click()
 for(const route of routes.filter(r=>r.path.startsWith('super-admin/'))) {
  await page.evaluate(url=>{history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'))},route.url)
  await expect(page.locator('main')).toBeVisible()
 }
 for(const route of routes.filter(r=>r.path.startsWith('auth/')||r.path.startsWith('join/'))) {
  await page.goto(route.url)
  await expect(page.locator('main')).toBeVisible()
 }
 expect(errors).toEqual([])
})

test('final reports, super admin and PWA surfaces', async ({ page }) => {
 test.setTimeout(60000)
 const errors:string[]=[]; page.on('pageerror', error => errors.push(error.message))
 await page.route('**/rest/v1/rpc/get_super_admin_gyms', route => route.fulfill({
  contentType:'application/json',
  body:JSON.stringify([{id:'00000000-0000-4000-8000-000000000001',name:'FitStack Studio',slug:'preview',city:'Hyderabad',is_active:true,members_count:3,active_memberships:1,revenue_this_month:0,created_at:'2026-01-01T00:00:00Z'}]),
 }))
 await page.route('**/rest/v1/rpc/get_super_admin_gym_detail', route => route.fulfill({
  contentType:'application/json',
  body:JSON.stringify({gym:{id:'00000000-0000-4000-8000-000000000001',name:'FitStack Studio',slug:'preview',logo_url:null,brand_color:'#171717',address:null,city:'Hyderabad',state:'Telangana',pincode:null,phone:null,email:null,website:null,gstin:null,is_active:true,razorpay_configured:false,created_at:'2026-01-01T00:00:00Z'},members:[],financials:{revenue_this_month:0,captured_payments:0,failed_payments:0,pending_payments:0},recent_payments:[]}),
 }))
 await page.setViewportSize({ width:375, height:812 })
 await page.goto('/admin/reports/revenue')
 await page.locator('summary').click(); await page.getByRole('button',{name:'owner',exact:true}).click()
 await expect(page.getByRole('navigation',{name:'Report types'}).getByRole('link')).toHaveCount(4)
 await expect(page.getByText('Total revenue',{exact:true})).toBeVisible(); await expect(page.getByText('Revenue trend')).toBeVisible()
 for (const name of ['Memberships','Attendance','Payments']) { await page.getByRole('navigation',{name:'Report types'}).getByRole('link',{name,exact:true}).click(); await expect(page.getByRole('heading',{name:'Reports'})).toBeVisible() }
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.reload(); await page.locator('summary').click(); await page.getByRole('button',{name:'super admin',exact:true}).click()
 await page.goto('/super-admin'); await page.locator('summary').click(); await page.getByRole('button',{name:'super admin',exact:true}).click()
 await expect(page.getByText('Platform administration')).toBeVisible(); await expect(page.getByText('FitStack Studio',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'View'}).click(); await expect(page.getByRole('tab',{name:'Overview'})).toBeVisible(); await expect(page.getByRole('tab',{name:'Members'})).toBeVisible(); await expect(page.getByRole('tab',{name:'Team'})).toBeVisible(); await expect(page.getByRole('tab',{name:'Financials'})).toBeVisible(); await page.getByRole('tab',{name:'Team'}).click(); await expect(page.getByRole('heading',{name:'Team'})).toBeVisible()
 await page.getByRole('button',{name:'New gym'}).click(); await expect(page.getByRole('heading',{name:'Onboard New Gym'})).toBeVisible()
 const manifest = await page.request.get('/manifest.json'); expect(manifest.ok()).toBe(true); expect((await manifest.json()).display).toBe('standalone')
 await page.goto('/not-a-real-page'); await expect(page.getByRole('heading',{name:'This page took a rest day'})).toBeVisible()
 expect(errors).toEqual([])
})

test('members remain visible when membership enrichment fails', async ({ page }) => {
 const member={
   id:'00000000-0000-4000-8000-000000000099',
   profile_id:'00000000-0000-4000-8000-000000000098',
   member_code:null,
   role:'member',
   is_active:true,
   joined_at:'2026-09-13T10:00:00Z',
   profiles:{id:'00000000-0000-4000-8000-000000000098',full_name:'padmanabha simha Pilli',email:null,phone:null,avatar_url:null},
  }
 await page.route('**/rest/v1/gym_members*', route => {
  const requestUrl=new URL(route.request().url())
  const select=requestUrl.searchParams.get('select') ?? ''
  expect(select).not.toContain('*')
  expect(select).not.toContain('qr_secret')
  expect(select).not.toContain('metadata')
  const isProfileRequest=requestUrl.searchParams.has('id')
  if(isProfileRequest){
   expect(select).toContain('memberships!memberships_member_id_fkey')
   expect(select).toContain('membership_plans!memberships_plan_id_fkey')
   expect(select).toContain('payments!payments_member_id_fkey')
   expect(select).toContain('invoices!invoices_payment_id_fkey')
   expect(select).toContain('attendance!attendance_member_id_fkey')
  }
  return route.fulfill({
   contentType:'application/json',
   body:JSON.stringify(isProfileRequest?{
    ...member,
    gym_id:'preview',
    created_at:'2026-09-13T10:00:00Z',
    updated_at:'2026-09-13T10:00:00Z',
    profiles:{...member.profiles,date_of_birth:null,gender:null,address:null,emergency_contact_name:null,emergency_contact_phone:null},
    memberships:[],payments:[],attendance:[],
   }:[member]),
  })
 })
 await page.route('**/rest/v1/memberships*', route => route.fulfill({
  status:403,
  contentType:'application/json',
  body:JSON.stringify({code:'42501',message:'permission denied for table memberships'}),
 }))

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'owner',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/admin/members');window.dispatchEvent(new PopStateEvent('popstate'))})

 await expect(page.getByText('padmanabha simha Pilli',{exact:true}).first()).toBeVisible()
 await expect(page.getByText('No Plan',{exact:true}).first()).toBeVisible()
 await page.getByText('padmanabha simha Pilli',{exact:true}).first().click()
 await expect(page).toHaveURL(/\/admin\/members\/00000000-0000-4000-8000-000000000099$/)
 await expect(page.getByRole('heading',{name:'padmanabha simha Pilli'})).toBeVisible()
 await expect(page.getByText('Member not found')).toHaveCount(0)
})

test('member payment history requests only the current gym-member payments', async ({ page }) => {
 let paymentRequests=0
 await page.route('**/rest/v1/payments*', route => {
  paymentRequests++
  const requestUrl=new URL(route.request().url())
  const select=requestUrl.searchParams.get('select') ?? ''
  expect(select).not.toContain('*')
  expect(select).not.toContain('razorpay_signature')
  expect(select).not.toContain('metadata')
  expect(requestUrl.searchParams.get('gym_id')).toBe('eq.preview')
  expect(requestUrl.searchParams.get('member_id')).toBe('eq.preview')
  return route.fulfill({contentType:'application/json',body:JSON.stringify([{
   id:'00000000-0000-4000-8000-000000000140',gym_id:'preview',member_id:'preview',plan_id:'00000000-0000-4000-8000-000000000120',
   requested_start_date:'2026-09-13',amount:5000,discount_amount:0,taxable_amount:5000,gst_rate:5,cgst_amount:125,sgst_amount:125,
   total_amount:5250,currency:'INR',razorpay_order_id:'dev_order_member_payment',razorpay_payment_id:'dev_payment_member_payment',status:'captured',
   promo_code_id:null,description:'Premium membership',created_by:null,created_at:'2026-09-13T15:43:58Z',updated_at:'2026-09-13T15:43:58Z',
   member:{id:'preview',profiles:{full_name:'padmanabha simha Pilli',phone:null,email:null}},invoice:{id:'00000000-0000-4000-8000-000000000141',invoice_number:'AFT-2026-0001'},
  }])})
 })

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'member',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/member/payments');window.dispatchEvent(new PopStateEvent('popstate'))})
 await expect(page.getByRole('heading',{name:'Your payments'})).toBeVisible()
 await expect(page.getByText('Premium membership')).toBeVisible()
 await expect(page.getByText(/5,250/)).toBeVisible()
 await expect(page.getByText(/permission denied/i)).toHaveCount(0)
 expect(paymentRequests).toBeGreaterThan(0)
})

test('quick check-in searches members and records an authorized manual attendance', async ({ page }) => {
 const memberId='00000000-0000-4000-8000-000000000160'
 const functionCalls:{p_gym_id:string;p_member_id:string}[]=[]
 let checkedIn=false
 await page.route('**/rest/v1/gym_members*', route => {
  const requestUrl=new URL(route.request().url())
  const select=requestUrl.searchParams.get('select') ?? ''
  expect(select).not.toContain('*')
  expect(select).not.toContain('qr_secret')
  expect(requestUrl.searchParams.get('gym_id')).toBe('eq.preview')
  expect(requestUrl.searchParams.get('role')).toBe('eq.member')
  expect(requestUrl.searchParams.get('is_active')).toBe('eq.true')
  expect(requestUrl.searchParams.get('profiles.or')).toContain('full_name.ilike.%pad%')
  return route.fulfill({contentType:'application/json',body:JSON.stringify([{
   id:memberId,role:'member',is_active:true,
   profiles:{full_name:'Padmanabha Simha Pilli',phone:'9876543210',avatar_url:null},
   memberships:[{id:'00000000-0000-4000-8000-000000000161',status:'active',start_date:'2026-09-01',end_date:'2026-10-01',plan_id:'00000000-0000-4000-8000-000000000162',membership_plans:{name:'Premium'}}],
  }])})
 })
 await page.route('**/rest/v1/attendance*', route => route.fulfill({contentType:'application/json',body:JSON.stringify(checkedIn?[{
  id:'00000000-0000-4000-8000-000000000163',gym_id:'preview',member_id:memberId,check_in_at:new Date().toISOString(),check_out_at:null,
  method:'manual',device_id:null,checked_in_by:'preview',created_at:new Date().toISOString(),
  member:{id:memberId,member_code:'PAD0160',profiles:{full_name:'Padmanabha Simha Pilli',avatar_url:null}},
 }]:[]) }))
 await page.route('**/rest/v1/rpc/manual_member_checkin', async route => {
  functionCalls.push(route.request().postDataJSON())
  checkedIn=true
  return route.fulfill({contentType:'application/json',body:JSON.stringify({result:'allowed',attendance_id:'00000000-0000-4000-8000-000000000163',checked_in_at:new Date().toISOString()})})
 })

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'owner',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/admin/attendance');window.dispatchEvent(new PopStateEvent('popstate'))})
 await expect(page.getByText('Quick Check-In',{exact:true})).toBeVisible()
 await page.getByLabel('Search members for check-in').fill('pad')
 await expect(page.getByText('Padmanabha Simha Pilli').first()).toBeVisible()
 await expect(page.getByText('Premium').first()).toBeVisible()
 await page.getByRole('button',{name:'Check In'}).click()
 await expect(page.getByText('Checked in ✓')).toBeVisible()
 await expect(page.getByText('Currently Checked In',{exact:true})).toBeVisible()
 expect(functionCalls).toEqual([{p_gym_id:'preview',p_member_id:memberId}])
})

test('payment settings save credentials through the authorized Edge Function', async ({ page }) => {
 let directGymWrites=0
 const functionCalls:{gym_id:string;key_id?:string;key_secret?:string;webhook_secret?:string}[]=[]
 await page.route('**/rest/v1/gyms*', route => {
  if(route.request().method()==='PATCH') directGymWrites++
  return route.fulfill({contentType:'application/json',body:'[]'})
 })
 await page.route('**/functions/v1/save-razorpay-credentials', async route => {
  functionCalls.push(route.request().postDataJSON())
  return route.fulfill({contentType:'application/json',body:JSON.stringify({saved:true})})
 })

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'owner',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/admin/settings/payments');window.dispatchEvent(new PopStateEvent('popstate'))})
 await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible()
 await page.getByLabel('Razorpay Key ID').fill('rzp_test_fitstack')
 await page.getByLabel('Razorpay Key Secret').fill('test_key_secret')
 await page.getByLabel('Razorpay Webhook Secret').fill('test_webhook_secret')
 await page.getByRole('button',{name:'Save Credentials'}).click()

 await expect(page.getByText('Payment credentials updated successfully')).toBeVisible()
 expect(functionCalls).toEqual([{
  gym_id:'preview',
  key_id:'rzp_test_fitstack',
  key_secret:'test_key_secret',
  webhook_secret:'test_webhook_secret',
 }])
 expect(directGymWrites).toBe(0)
})

test('missing Razorpay credentials fall back to the development checkout RPC', async ({ page }) => {
 const plan={
  id:'00000000-0000-4000-8000-000000000120',gym_id:'preview',name:'Monthly',description:null,
  price:1000,duration_type:'months',duration_value:1,features:[],max_freezes:0,max_freeze_days:null,
  allow_future_start:true,is_active:true,sort_order:0,created_by:null,created_at:'2026-09-13T10:00:00Z',updated_at:'2026-09-13T10:00:00Z',
 }
 let edgeCalls=0
 const rpcCalls:{p_preview:boolean;p_member_id:string}[]=[]
 await page.route('**/functions/v1/create-razorpay-order', route => {
  edgeCalls++
  return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Razorpay credentials are not configured'})})
 })
 await page.route('**/rest/v1/membership_plans*', route => route.fulfill({contentType:'application/json',body:JSON.stringify([plan])}))
 await page.route('**/rest/v1/payments*', route => route.fulfill({contentType:'application/json',body:'[]'}))
 await page.route('**/rest/v1/rpc/simulate_payment_checkout', async route => {
  const body=route.request().postDataJSON() as {p_preview:boolean;p_member_id:string}
  rpcCalls.push(body)
  const pricing={amount:1000,discountAmount:0,taxableAmount:1000,gstRate:0,cgstAmount:0,sgstAmount:0,totalAmount:1000,totalPaise:100000,promoCodeId:null,promoCode:null,currency:'INR',simulated:true}
  return route.fulfill({contentType:'application/json',body:JSON.stringify(body.p_preview?{
   ...pricing,orderId:null,paymentId:null,razorpayKeyId:null,captured:false,
  }:{
   ...pricing,orderId:'dev_order_browser',paymentId:'00000000-0000-4000-8000-000000000121',razorpayKeyId:null,captured:true,
   membershipId:'00000000-0000-4000-8000-000000000122',invoiceId:'00000000-0000-4000-8000-000000000123',
  })})
 })

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'member',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/member/plans');window.dispatchEvent(new PopStateEvent('popstate'))})
 await expect(page.getByRole('heading',{name:'Explore plans'})).toBeVisible()
 await page.getByRole('button',{name:'Buy Now'}).click()
 await expect(page.getByText('Development mode',{exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:/^Pay /}).click()
 await expect(page.getByText('Payment successful! Membership activated.')).toBeVisible()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(rpcCalls.filter(call=>call.p_preview)).not.toHaveLength(0)
 expect(rpcCalls.filter(call=>!call.p_preview)).toHaveLength(1)
 expect(rpcCalls.at(-1)?.p_preview).toBe(false)
 expect(rpcCalls.every(call=>call.p_member_id==='preview')).toBe(true)
 expect(edgeCalls).toBe(1)
})

test('configured Razorpay checkout uses the Edge Function and opens the real modal', async ({ page }) => {
 const plan={
  id:'00000000-0000-4000-8000-000000000125',gym_id:'preview',name:'Premium',description:null,
  price:5000,duration_type:'months',duration_value:1,features:[],max_freezes:0,max_freeze_days:null,
  allow_future_start:true,is_active:true,sort_order:0,created_by:null,created_at:'2026-09-13T10:00:00Z',updated_at:'2026-09-13T10:00:00Z',
 }
 const paymentId='00000000-0000-4000-8000-000000000126'
 const edgeCalls:Record<string,unknown>[]=[]
 await page.addInitScript(()=>{
  ;(window as any).Razorpay=function(options:any){
   ;(window as any).__fitstackRazorpayOptions=options
   return {on:()=>undefined,open:()=>options.handler({razorpay_payment_id:'pay_test',razorpay_order_id:options.order_id,razorpay_signature:'signature_test'})}
  }
 })
 await page.route('**/rest/v1/membership_plans*', route => route.fulfill({contentType:'application/json',body:JSON.stringify([plan])}))
 await page.route('**/rest/v1/payments*', route => {
  const select=new URL(route.request().url()).searchParams.get('select')
  return route.fulfill({contentType:'application/json',body:select==='status'?JSON.stringify({status:'captured'}):'[]'})
 })
 await page.route('**/rest/v1/rpc/simulate_payment_checkout', async route => {
  const body=route.request().postDataJSON() as {p_preview:boolean}
  expect(body.p_preview).toBe(true)
  return route.fulfill({contentType:'application/json',body:JSON.stringify({
   amount:5000,discountAmount:0,taxableAmount:5000,gstRate:5,cgstAmount:125,sgstAmount:125,
   totalAmount:5250,totalPaise:525000,promoCodeId:null,promoCode:null,currency:'INR',simulated:false,
   orderId:null,paymentId:null,razorpayKeyId:null,captured:false,
  })})
 })
 await page.route('**/functions/v1/create-razorpay-order', async route => {
  edgeCalls.push(route.request().postDataJSON())
  return route.fulfill({contentType:'application/json',body:JSON.stringify({
   free:false,orderId:'order_fitstack_test',amount:525000,totalPaise:525000,currency:'INR',
   keyId:'rzp_test_fitstack',paymentId,
  })})
 })

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'member',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/member/plans');window.dispatchEvent(new PopStateEvent('popstate'))})
 await page.getByRole('button',{name:'Buy Now'}).click()
 await page.getByRole('button',{name:/^Pay /}).click()
 await expect(page.getByText('Payment successful! Membership activated.')).toBeVisible()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Payment not completed'})).toHaveCount(0)
 expect(edgeCalls).toEqual([{
  gym_id:'preview',member_id:'preview',plan_id:plan.id,start_date:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),promo_code:null,
 }])
 const options=await page.evaluate(()=>(window as any).__fitstackRazorpayOptions)
 expect(options).toMatchObject({
  key:'rzp_test_fitstack',amount:525000,currency:'INR',order_id:'order_fitstack_test',
  name:'FitStack Studio',description:'Premium',theme:{color:'#171717'},
 })
})

test('dismissed Razorpay checkout shows a failure toast and keeps a retry path', async ({ page }) => {
 const plan={
  id:'00000000-0000-4000-8000-000000000135',gym_id:'preview',name:'Premium',description:null,
  price:5000,duration_type:'months',duration_value:1,features:[],max_freezes:0,max_freeze_days:null,
  allow_future_start:true,is_active:true,sort_order:0,created_by:null,created_at:'2026-09-13T10:00:00Z',updated_at:'2026-09-13T10:00:00Z',
 }
 await page.addInitScript(()=>{
  ;(window as any).Razorpay=function(options:any){return {on:()=>undefined,open:()=>options.modal.ondismiss()}}
 })
 await page.route('**/rest/v1/membership_plans*', route => route.fulfill({contentType:'application/json',body:JSON.stringify([plan])}))
 await page.route('**/rest/v1/payments*', route => route.fulfill({contentType:'application/json',body:'[]'}))
 await page.route('**/rest/v1/rpc/simulate_payment_checkout', route => route.fulfill({contentType:'application/json',body:JSON.stringify({
  amount:5000,discountAmount:0,taxableAmount:5000,gstRate:5,cgstAmount:125,sgstAmount:125,
  totalAmount:5250,totalPaise:525000,promoCodeId:null,promoCode:null,currency:'INR',simulated:false,
  orderId:null,paymentId:null,razorpayKeyId:null,captured:false,
 })}))
 await page.route('**/functions/v1/create-razorpay-order', route => route.fulfill({contentType:'application/json',body:JSON.stringify({
  free:false,orderId:'order_fitstack_dismissed',amount:525000,totalPaise:525000,currency:'INR',
  keyId:'rzp_test_fitstack',paymentId:'00000000-0000-4000-8000-000000000136',
 })}))

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'member',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/member/plans');window.dispatchEvent(new PopStateEvent('popstate'))})
 await page.getByRole('button',{name:'Buy Now'}).click()
 await page.getByRole('button',{name:/^Pay /}).click()

 const message='Checkout was closed before payment. You can try again when ready.'
 await expect(page.getByText(message).last()).toBeVisible()
 await expect(page.getByRole('heading',{name:'Payment not completed'})).toBeVisible()
 await expect(page.getByRole('button',{name:/Try again/})).toBeVisible()
})

test('a free Edge Function checkout succeeds without opening Razorpay', async ({ page }) => {
 const plan={
  id:'00000000-0000-4000-8000-000000000127',gym_id:'preview',name:'Complimentary',description:null,
  price:0,duration_type:'months',duration_value:1,features:[],max_freezes:0,max_freeze_days:null,
  allow_future_start:true,is_active:true,sort_order:0,created_by:null,created_at:'2026-09-13T10:00:00Z',updated_at:'2026-09-13T10:00:00Z',
 }
 await page.addInitScript(()=>{
  ;(window as any).__fitstackRazorpayOpened=0
  ;(window as any).Razorpay=function(){return {on:()=>undefined,open:()=>{;(window as any).__fitstackRazorpayOpened++}}}
 })
 await page.route('**/rest/v1/membership_plans*', route => route.fulfill({contentType:'application/json',body:JSON.stringify([plan])}))
 await page.route('**/rest/v1/payments*', route => route.fulfill({contentType:'application/json',body:'[]'}))
 await page.route('**/rest/v1/rpc/simulate_payment_checkout', route => route.fulfill({contentType:'application/json',body:JSON.stringify({
  amount:0,discountAmount:0,taxableAmount:0,gstRate:0,cgstAmount:0,sgstAmount:0,totalAmount:0,totalPaise:0,
  promoCodeId:null,promoCode:null,currency:'INR',simulated:false,orderId:null,paymentId:null,razorpayKeyId:null,captured:false,
 })}))
 await page.route('**/functions/v1/create-razorpay-order', route => route.fulfill({contentType:'application/json',body:JSON.stringify({
  free:true,paymentId:'00000000-0000-4000-8000-000000000128',membershipId:'00000000-0000-4000-8000-000000000129',invoiceId:'00000000-0000-4000-8000-000000000130',
 })}))

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'member',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/member/plans');window.dispatchEvent(new PopStateEvent('popstate'))})
 await page.getByRole('button',{name:'Buy Now'}).click()
 await page.getByRole('button',{name:'Activate free plan'}).click()
 await expect(page.getByText('Payment successful! Membership activated.')).toBeVisible()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(await page.evaluate(()=>(window as any).__fitstackRazorpayOpened)).toBe(0)
})

test('a lost checkout response reconciles an active membership instead of showing payment failure', async ({ page }) => {
 const plan={
  id:'00000000-0000-4000-8000-000000000130',gym_id:'preview',name:'Quarterly',description:null,
  price:5000,duration_type:'months',duration_value:3,features:[],max_freezes:0,max_freeze_days:null,
  allow_future_start:true,is_active:true,sort_order:0,created_by:null,created_at:'2026-09-13T10:00:00Z',updated_at:'2026-09-13T10:00:00Z',
 }
 let mutationCalls=0
 await page.route('**/rest/v1/membership_plans*', route => route.fulfill({contentType:'application/json',body:JSON.stringify([plan])}))
 await page.route('**/rest/v1/payments*', route => route.fulfill({contentType:'application/json',body:'[]'}))
 await page.route('**/rest/v1/memberships*', route => route.fulfill({
  contentType:'application/json',
  body:JSON.stringify({id:'00000000-0000-4000-8000-000000000131',status:'active'}),
 }))
 await page.route('**/rest/v1/rpc/simulate_payment_checkout', async route => {
  const body=route.request().postDataJSON() as {p_preview:boolean}
  expect(body.p_preview).toBe(true)
  return route.fulfill({contentType:'application/json',body:JSON.stringify({
   amount:5000,discountAmount:0,taxableAmount:5000,gstRate:5,cgstAmount:125,sgstAmount:125,
   totalAmount:5250,totalPaise:525000,promoCodeId:null,promoCode:null,currency:'INR',simulated:true,
   orderId:null,paymentId:null,razorpayKeyId:null,captured:false,
  })})
 })
 await page.route('**/functions/v1/create-razorpay-order', route => {
  mutationCalls++
  return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Checkout response was lost'})})
 })

 await page.goto('/login')
 await page.locator('summary').click()
 await page.getByRole('button',{name:'member',exact:true}).click()
 await page.evaluate(()=>{history.pushState({},'','/member/plans');window.dispatchEvent(new PopStateEvent('popstate'))})
 await page.getByRole('button',{name:'Buy Now'}).click()
 await page.getByRole('button',{name:/^Pay /}).click()
 await expect(page.getByText('Payment successful! Membership activated.')).toBeVisible()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Payment not completed'})).toHaveCount(0)
 expect(mutationCalls).toBeGreaterThan(0)
})
