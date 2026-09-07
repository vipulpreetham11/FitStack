import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronLeft, UserCircle, Phone, Mail, Calendar as CalendarIcon, MapPin, Activity, CreditCard, Clock, Settings, FileText, Ban } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { useMembers } from '@/hooks/useMembers'
import { formatDate, formatCurrency } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdminMemberMembershipPanel } from '@/components/memberships/AdminMemberMembershipPanel'

const detailsSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  date_of_birth: z.string().optional().nullable().or(z.literal('')),
  gender: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  emergency_contact_name: z.string().optional().nullable().or(z.literal('')),
  emergency_contact_phone: z.string().optional().nullable().or(z.literal('')),
})

export default function MemberProfilePage() {
  const { memberId } = useParams<{ memberId: string }>()
  const { hasPermission } = useGym()
  const { fetchMember, recordManualAttendance, deactivateMember } = useMembers()
  
  const [memberData, setMemberData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const canEditDetails = hasPermission('members.create') // owner, admin, receptionist
  const canScan = hasPermission('attendance.scan')
  
  const form = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
  })

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!memberId) return
      try {
        setLoading(true)
        const data = await fetchMember(memberId)
        if (active) {
          setMemberData(data)
          form.reset({
            full_name: data.profiles.full_name,
            email: data.profiles.email || '',
            date_of_birth: data.profiles.date_of_birth || '',
            gender: data.profiles.gender || '',
            address: data.profiles.address || '',
            emergency_contact_name: data.profiles.emergency_contact_name || '',
            emergency_contact_phone: data.profiles.emergency_contact_phone || '',
          })
        }
      } catch (err: any) {
        if (active) toast.error('Failed to load member profile')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [memberId, fetchMember, form])

  const handleUpdateDetails = async (values: z.infer<typeof detailsSchema>) => {
    if (!memberData || !supabase) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: values.full_name,
          email: values.email || null,
          date_of_birth: values.date_of_birth || null,
          gender: values.gender || null,
          address: values.address || null,
          emergency_contact_name: values.emergency_contact_name || null,
          emergency_contact_phone: values.emergency_contact_phone || null
        })
        .eq('id', memberData.profile_id)
        
      if (error) throw error
      toast.success('Profile details updated')
      // Update local state lightly
      setMemberData((prev: any) => ({
        ...prev,
        profiles: { ...prev.profiles, ...values }
      }))
    } catch (err: any) {
      toast.error('Failed to update details')
    } finally {
      setIsSaving(false)
    }
  }

  const handleQuickAttendance = async () => {
    if (!memberId) return
    try {
      await recordManualAttendance(memberId)
      toast.success('Attendance recorded')
      // Refresh to get new attendance
      const data = await fetchMember(memberId)
      setMemberData(data)
    } catch (err: any) {
      toast.error(err.message || 'Failed to record attendance')
    }
  }

  const handleDeactivate = async () => {
    if (!memberId || !confirm('Are you sure you want to deactivate this member?')) return
    try {
      await deactivateMember(memberId)
      toast.success('Member deactivated')
      const data = await fetchMember(memberId)
      setMemberData(data)
    } catch (err: any) {
      toast.error('Failed to deactivate member')
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading member profile...</div>
  if (!memberData) return <div className="p-8 text-center text-destructive">Member not found</div>

  const profile = memberData.profiles
  const payments = memberData.payments?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
  const attendance = memberData.attendance?.sort((a: any, b: any) => new Date(b.checked_in_at ?? b.check_in_at).getTime() - new Date(a.checked_in_at ?? a.check_in_at).getTime()) || []

  // Calculate attendance stats
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const visitsThisMonth = attendance.filter((a: any) => {
    const d = new Date(a.checked_in_at ?? a.check_in_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  // Generate chart data (last 8 weeks)
  const chartData = []
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(now.getDate() - (i * 7 + 7))
    const end = new Date(now)
    end.setDate(now.getDate() - (i * 7))
    
    const count = attendance.filter((a: any) => {
      const d = new Date(a.checked_in_at ?? a.check_in_at).getTime()
      return d >= start.getTime() && d < end.getTime()
    }).length
    
    chartData.push({
      name: `W${8-i}`,
      visits: count
    })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/admin/members" className="hover:text-foreground transition-colors flex items-center">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Members
        </Link>
      </div>

      {/* HEADER SECTION */}
      <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-card to-muted/20">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-muted border-4 border-background shadow-sm flex items-center justify-center shrink-0 overflow-hidden relative">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground opacity-50" />
            )}
            {!memberData.is_active && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-sm">
                <Ban className="w-8 h-8 text-destructive" />
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-3 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{profile.full_name}</h1>
                  {memberData.role !== 'member' && (
                    <Badge variant={['owner','admin'].includes(memberData.role) ? "destructive" : "secondary"} className="uppercase">
                      {memberData.role}
                    </Badge>
                  )}
                  {!memberData.is_active && <Badge variant="outline" className="text-destructive border-destructive">Inactive</Badge>}
                </div>
                <div className="text-muted-foreground font-mono mt-1">{memberData.member_code || 'No Member Code'}</div>
              </div>
              <div className="flex gap-2">
                {canScan && memberData.is_active && (
                  <Button onClick={handleQuickAttendance} variant="outline" size="sm">
                    <Activity className="w-4 h-4 mr-2" /> Quick Scan
                  </Button>
                )}
                <Button size="sm" render={
                  <Link to={`https://wa.me/${profile.phone?.replace('+', '')}`} target="_blank" rel="noopener noreferrer">
                    Contact
                  </Link>
                } />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" /> 
                <span className="text-foreground">{profile.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" /> 
                <span className="text-foreground truncate">{profile.email || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="w-4 h-4" /> 
                <span className="text-foreground">Joined {formatDate(memberData.joined_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" /> 
                <span className="text-foreground truncate">{profile.city || profile.address ? 'Has Address' : '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* TABS */}
      <Tabs defaultValue="membership" className="w-full">
        <div className="overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <TabsList className="w-full justify-start md:w-auto h-auto p-1 bg-transparent border-b rounded-none">
            <TabsTrigger value="membership" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-2">
              <FileText className="w-4 h-4 mr-2" /> Membership
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-2">
              <CreditCard className="w-4 h-4 mr-2" /> Payments
            </TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-2">
              <Clock className="w-4 h-4 mr-2" /> Attendance
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-2">
              <Settings className="w-4 h-4 mr-2" /> Details
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB: MEMBERSHIP */}
        <TabsContent value="membership" className="space-y-6 focus-visible:outline-none">
          <AdminMemberMembershipPanel member={{ id: memberData.id, name: profile.full_name, phone: profile.phone }} />
        </TabsContent>

        {/* TAB: PAYMENTS */}
        <TabsContent value="payments" className="focus-visible:outline-none">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Payment History</CardTitle>
                <CardDescription>All transactions for this member.</CardDescription>
              </div>
              <Button size="sm">Record Payment</Button>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p>No payments recorded yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.created_at)}</TableCell>
                        <TableCell className="font-medium">{p.description || 'Membership Payment'}</TableCell>
                        <TableCell>{formatCurrency(p.total_amount)}</TableCell>
                        <TableCell className="uppercase text-xs">{p.payment_method || 'Online'}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'captured' || p.status === 'paid' ? 'default' : 'secondary'}
                                 className={p.status === 'captured' || p.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(Array.isArray(p.invoices) ? p.invoices[0]?.id : p.invoices?.id) ? (
                            <Button nativeButton={false} variant="ghost" size="sm" render={<Link to={`/admin/invoices/${Array.isArray(p.invoices) ? p.invoices[0].id : p.invoices.id}`}>View Invoice</Link>} />
                          ) : <span className="text-sm text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: ATTENDANCE */}
        <TabsContent value="attendance" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Visits This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{visitsThisMonth}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Visits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{attendance.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Last Visit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold mt-1">
                  {attendance.length > 0 ? formatDate(attendance[0].checked_in_at ?? attendance[0].check_in_at) : 'Never'}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Activity (Last 8 Weeks)</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="visits" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">Recent Scans</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <div className="divide-y max-h-[250px] overflow-y-auto">
                  {attendance.slice(0, 10).map((a: any) => {
                    const date = new Date(a.checked_in_at ?? a.check_in_at)
                    return (
                      <div key={a.id} className="px-6 py-3 flex justify-between items-center text-sm">
                        <div>
                          <p className="font-medium">{formatDate(date)}</p>
                          <p className="text-xs text-muted-foreground">{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase">{a.method}</Badge>
                      </div>
                    )
                  })}
                  {attendance.length === 0 && (
                    <div className="p-6 text-center text-muted-foreground text-sm">No attendance records.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: DETAILS */}
        <TabsContent value="details" className="focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
              <CardDescription>Update member's personal and contact information.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdateDetails)} className="space-y-6 max-w-2xl">
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl><Input {...field} disabled={!canEditDetails} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl><Input type="email" {...field} value={field.value || ''} disabled={!canEditDetails} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl><Input type="date" {...field} value={field.value || ''} disabled={!canEditDetails} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="gender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select disabled={!canEditDetails} onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl><Textarea {...field} value={field.value || ''} disabled={!canEditDetails} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium mb-4">Emergency Contact</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                      <FormField control={form.control} name="emergency_contact_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} disabled={!canEditDetails} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="emergency_contact_phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl><Input type="tel" {...field} value={field.value || ''} disabled={!canEditDetails} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  {canEditDetails && (
                    <div className="pt-4 flex justify-between items-center border-t">
                      <Button type="button" variant="destructive" onClick={handleDeactivate} disabled={!memberData.is_active}>
                        Deactivate Member
                      </Button>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
