import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import RouteGuard from '@/components/auth/RouteGuard'
import AdminLayout from '@/components/layout/AdminLayout'
import MemberLayout from '@/components/layout/MemberLayout'
import { ADMIN_ROLES } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { dashboardPath } from '@/lib/auth'
const NoGymPage = lazy(() => import('@/pages/auth/NoGymPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const Page0 = lazy(() => import('@/pages/auth/OnboardingPage'))
const Page1 = lazy(() => import('@/pages/join/JoinGymPage'))
const Page2 = lazy(() => import('@/pages/admin/DashboardPage'))
const Page3 = lazy(() => import('@/pages/admin/members/MemberListPage'))
const Page4 = lazy(() => import('@/pages/admin/members/MemberProfilePage'))
const Page5 = lazy(() => import('@/pages/admin/members/CreateMemberPage'))
const Page6 = lazy(() => import('@/pages/admin/memberships/MembershipListPage'))
const Page7 = lazy(() => import('@/pages/admin/plans/PlanListPage'))
const Page8 = lazy(() => import('@/pages/admin/plans/CreatePlanPage'))
const Page9 = lazy(() => import('@/pages/admin/plans/EditPlanPage'))
const Page10 = lazy(() => import('@/pages/admin/payments/PaymentListPage'))
const Page11 = lazy(() => import('@/pages/admin/invoices/InvoiceListPage'))
const Page12 = lazy(() => import('@/pages/admin/invoices/InvoiceViewPage'))
const Page13 = lazy(() => import('@/pages/admin/attendance/ScannerPage'))
const Page14 = lazy(() => import('@/pages/admin/attendance/AttendanceListPage'))
const Page15 = lazy(() => import('@/pages/admin/attendance/AttendanceHistoryPage'))
const Page16 = lazy(() => import('@/pages/admin/promos/PromoListPage'))
const Page17 = lazy(() => import('@/pages/admin/promos/CreatePromoPage'))
const Page18 = lazy(() => import('@/pages/admin/reports/RevenueReportPage'))
const Page19 = lazy(() => import('@/pages/admin/reports/MembershipReportPage'))
const Page20 = lazy(() => import('@/pages/admin/reports/AttendanceReportPage'))
const PaymentsReportPage = lazy(() => import('@/pages/admin/reports/PaymentsReportPage'))
const Page21 = lazy(() => import('@/pages/admin/settings/GymProfilePage'))
const Page22 = lazy(() => import('@/pages/admin/settings/BusinessHoursPage'))
const Page23 = lazy(() => import('@/pages/admin/settings/HolidaysPage'))
const Page24 = lazy(() => import('@/pages/admin/settings/PaymentSettingsPage'))
const Page25 = lazy(() => import('@/pages/admin/settings/InvoiceSettingsPage'))
const TeamPage = lazy(() => import('@/components/team/TeamPage'))
const Page26 = lazy(() => import('@/pages/member/MemberDashboard'))
const Page27 = lazy(() => import('@/pages/member/MemberProfilePage'))
const Page28 = lazy(() => import('@/pages/member/MemberMembershipPage'))
const Page29 = lazy(() => import('@/pages/member/MemberPaymentsPage'))
const Page30 = lazy(() => import('@/pages/member/MemberPlansPage'))
const Page31 = lazy(() => import('@/pages/member/MemberQRPage'))
const Page32 = lazy(() => import('@/pages/super-admin/GymListPage'))
const Page33 = lazy(() => import('@/pages/super-admin/GymDetailPage'))
const Page34 = lazy(() => import('@/pages/super-admin/CreateGymPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
function HomeRedirect() {
 const auth = useAuth(); const { gym, loading, isSuperAdmin } = useGym()
 if (auth.loading || loading) return <p className="p-8" role="status">Loading…</p>
 if (!auth.isAuthenticated || auth.error) return <Navigate to="/login" replace/>
 if (!auth.isOnboarded) return <Navigate to="/onboarding" replace/>
 return <Navigate to={dashboardPath(gym?.role ?? null,isSuperAdmin)} replace/>
}
export default function App() {
 const location = useLocation()
 useEffect(() => { if (location.state?.denied) toast.error("You don't have permission for this action", {id:'permission-denied'}) },[location])
 return <Suspense fallback={<div className="p-8" role="status">Loading workspace…</div>}><Routes>
 <Route path="/" element={<HomeRedirect/>}/><Route path="/login" element={<LoginPage/>}/>
 <Route element={<RouteGuard authOnly allowIncomplete/>}><Route path="/onboarding" element={<Page0/>} /></Route>
 <Route element={<RouteGuard authOnly/>}><Route path="/no-gym" element={<NoGymPage/>} /></Route>
<Route path="/join/:slug" element={<Page1/>} />
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="members.view"/>}><Route element={<AdminLayout/>}><Route path="/admin" element={<Page2/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="members.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/members" element={<Page3/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="members.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/members/:memberId" element={<Page4/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="members.create"/>}><Route element={<AdminLayout/>}><Route path="/admin/members/new" element={<Page5/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="memberships.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/memberships" element={<Page6/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="plans.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/plans" element={<Page7/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="plans.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/plans/new" element={<Page8/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="plans.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/plans/:planId/edit" element={<Page9/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="payments.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/payments" element={<Page10/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="invoices.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/invoices" element={<Page11/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="invoices.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/invoices/:invoiceId" element={<Page12/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="attendance.scan"/>}><Route element={<AdminLayout/>}><Route path="/admin/attendance/scanner" element={<Page13/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="attendance.scan"/>}><Route element={<AdminLayout/>}><Route path="/admin/attendance" element={<Page14/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="attendance.scan"/>}><Route element={<AdminLayout/>}><Route path="/admin/attendance/history" element={<Page15/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="promos.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/promos" element={<Page16/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="promos.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/promos/new" element={<Page17/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="promos.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/promos/:promoId/edit" element={<Page17/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="reports.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/reports/revenue" element={<Page18/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="reports.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/reports/memberships" element={<Page19/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="reports.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/reports/attendance" element={<Page20/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="reports.view"/>}><Route element={<AdminLayout/>}><Route path="/admin/reports" element={<Navigate to="/admin/reports/revenue" replace/>} /><Route path="/admin/reports/payments" element={<PaymentsReportPage/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="settings.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/settings" element={<Page21/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="settings.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/settings/hours" element={<Page22/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="holidays.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/settings/holidays" element={<Page23/>} /></Route></Route>
<Route element={<RouteGuard roles={['owner','admin']} permission="staff.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/settings/team" element={<TeamPage/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="credentials.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/settings/payments" element={<Page24/>} /></Route></Route>
<Route element={<RouteGuard roles={ADMIN_ROLES} permission="settings.manage"/>}><Route element={<AdminLayout/>}><Route path="/admin/settings/invoices" element={<Page25/>} /></Route></Route>
<Route element={<RouteGuard/>}><Route element={<MemberLayout/>}><Route path="/member" element={<Page26/>} /></Route></Route>
<Route element={<RouteGuard/>}><Route element={<MemberLayout/>}><Route path="/member/profile" element={<Page27/>} /></Route></Route>
<Route element={<RouteGuard/>}><Route element={<MemberLayout/>}><Route path="/member/membership" element={<Page28/>} /></Route></Route>
<Route element={<RouteGuard/>}><Route element={<MemberLayout/>}><Route path="/member/payments" element={<Page29/>} /></Route></Route>
<Route element={<RouteGuard/>}><Route element={<MemberLayout/>}><Route path="/member/invoices/:invoiceId" element={<Page12/>} /></Route></Route>
<Route element={<RouteGuard/>}><Route element={<MemberLayout/>}><Route path="/member/plans" element={<Page30/>} /></Route></Route>
<Route element={<RouteGuard/>}><Route element={<MemberLayout/>}><Route path="/member/qr" element={<Page31/>} /></Route></Route>
<Route element={<RouteGuard superAdminOnly/>}><Route path="/super-admin" element={<Page32/>} /></Route>
<Route element={<RouteGuard superAdminOnly/>}><Route path="/super-admin/gyms/:gymId" element={<Page33/>} /></Route>
<Route element={<RouteGuard superAdminOnly/>}><Route path="/super-admin/gyms/new" element={<Page34/>} /></Route>

 <Route path="*" element={<NotFoundPage/>}/>
 </Routes></Suspense>
}
