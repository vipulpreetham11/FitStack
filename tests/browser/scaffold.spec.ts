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
 await page.reload()
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
 await page.reload()
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
 await page.getByRole('button',{name:'View'}).click(); await expect(page.getByRole('tab',{name:'Overview'})).toBeVisible(); await expect(page.getByRole('tab',{name:'Members'})).toBeVisible(); await expect(page.getByRole('tab',{name:'Financials'})).toBeVisible()
 await page.getByRole('button',{name:'New gym'}).click(); await expect(page.getByRole('heading',{name:'Onboard New Gym'})).toBeVisible()
 const manifest = await page.request.get('/manifest.json'); expect(manifest.ok()).toBe(true); expect((await manifest.json()).display).toBe('standalone')
 await page.goto('/not-a-real-page'); await expect(page.getByRole('heading',{name:'This page took a rest day'})).toBeVisible()
 expect(errors).toEqual([])
})
