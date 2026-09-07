import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, UserCircle, MoreHorizontal, FileDown } from 'lucide-react'
import { useMembers, type MemberListItem, type MemberRole } from '@/hooks/useMembers'
import { useGym } from '@/hooks/useGym'
import { formatDate } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { CreateMembershipModal } from '@/components/memberships/MembershipActions'

export default function MemberListPage() {
  const { hasPermission } = useGym()
  const { members, loading, fetchMembers, recordManualAttendance } = useMembers()
  
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name_asc')
  const [membershipMember, setMembershipMember] = useState<MemberListItem | null>(null)
  
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleQuickAttendance = async (member: MemberListItem) => {
    try {
      await recordManualAttendance(member.id)
      toast.success(`Recorded attendance for ${member.profile.full_name}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to record attendance')
    }
  }

  const filteredMembers = useMemo(() => {
    let result = [...members]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(m => 
        m.profile.full_name.toLowerCase().includes(q) ||
        (m.profile.phone && m.profile.phone.includes(q)) ||
        (m.member_code && m.member_code.toLowerCase().includes(q))
      )
    }

    if (roleFilter !== 'all') {
      if (roleFilter === 'staff') {
        result = result.filter(m => ['owner', 'admin', 'receptionist'].includes(m.role))
      } else {
        result = result.filter(m => m.role === roleFilter)
      }
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active') result = result.filter(m => m.active_membership?.status === 'active')
      if (statusFilter === 'frozen') result = result.filter(m => m.active_membership?.status === 'frozen')
      if (statusFilter === 'none') result = result.filter(m => !m.active_membership)
    }

    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.profile.full_name.localeCompare(b.profile.full_name)
      if (sortBy === 'name_desc') return b.profile.full_name.localeCompare(a.profile.full_name)
      if (sortBy === 'joined_desc') return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
      if (sortBy === 'expiry_asc') {
        const d1 = a.active_membership?.end_date ? new Date(a.active_membership.end_date).getTime() : Infinity
        const d2 = b.active_membership?.end_date ? new Date(b.active_membership.end_date).getTime() : Infinity
        return d1 - d2
      }
      return 0
    })

    return result
  }, [members, search, roleFilter, statusFilter, sortBy])

  const canCreate = hasPermission('members.create')
  const canScan = hasPermission('attendance.scan')
  const canManageMemberships = hasPermission('memberships.manage')

  const getStatusBadge = (member: MemberListItem) => {
    const status = member.active_membership?.status
    if (status === 'active') return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">Active</Badge>
    if (status === 'frozen') return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Frozen</Badge>
    if (status === 'scheduled') return <Badge variant="outline">Scheduled</Badge>
    return <Badge variant="outline" className="text-muted-foreground">No Plan</Badge>
  }

  const getRoleBadge = (role: MemberRole) => {
    if (role === 'member') return null
    if (role === 'owner' || role === 'admin') return <Badge variant="destructive" className="ml-2 text-[10px] uppercase h-5">{role}</Badge>
    return <Badge variant="secondary" className="ml-2 text-[10px] uppercase h-5">{role}</Badge>
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-2">Manage your gym members, staff, and trainers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><FileDown className="w-4 h-4 mr-2" /> Export</Button>
          {canCreate && (
            <Button nativeButton={false} render={<Link to="/admin/members/new"><Plus className="w-4 h-4 mr-2" /> New Member</Link>} />
          )}
        </div>
      </div>

      <Card>
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, phone, or ID..." 
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val || 'all')}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="trainer">Trainers</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Plan</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
                <SelectItem value="none">No Plan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val || 'name_asc')}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                <SelectItem value="joined_desc">Newest First</SelectItem>
                <SelectItem value="expiry_asc">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading members...</div>
          ) : filteredMembers.length === 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead><TableHead>Membership</TableHead><TableHead>Joined</TableHead><TableHead className="w-[80px]" /></TableRow></TableHeader>
                  <TableBody><TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">{search || roleFilter !== 'all' || statusFilter !== 'all' ? 'No members match these filters.' : 'No members yet.'}</TableCell></TableRow></TableBody>
                </Table>
              </div>
              <div className="p-12 text-center flex flex-col items-center md:hidden">
                <UserCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No members found</h3>
                <p className="text-muted-foreground max-w-sm mt-2 mb-4">
                  {search || roleFilter !== 'all' || statusFilter !== 'all' 
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "You haven't added any members yet. Get started by adding your first member."}
                </p>
                {!search && statusFilter === 'all' && canCreate && (
                  <Button nativeButton={false} render={<Link to="/admin/members/new">Add Member</Link>} />
                )}
              </div>
            </>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Membership</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id} className="cursor-pointer group" onClick={() => window.location.href = `/admin/members/${member.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {member.profile.avatar_url ? (
                                <img src={member.profile.avatar_url} alt={member.profile.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <UserCircle className="w-6 h-6 text-muted-foreground opacity-50" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-foreground flex items-center">
                                {member.profile.full_name}
                                {getRoleBadge(member.role)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{member.member_code || 'No Code'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{member.profile.phone || '-'}</TableCell>
                        <TableCell>{getStatusBadge(member)}</TableCell>
                        <TableCell>
                          {member.active_membership ? (
                            <div>
                              <div className="font-medium text-sm">{member.active_membership.plan_name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">Exp: {formatDate(member.active_membership.end_date)}</div>
                            </div>
                          ) : <span className="text-muted-foreground text-sm">-</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(member.joined_at)}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            } />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem render={<Link to={`/admin/members/${member.id}`}>View Profile</Link>} />
                              {canManageMemberships && <DropdownMenuItem onSelect={() => setMembershipMember(member)}>Sell membership</DropdownMenuItem>}
                              {canScan && <DropdownMenuItem onSelect={() => handleQuickAttendance(member)}>Quick Attendance</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="p-4 flex items-start justify-between">
                    <Link to={`/admin/members/${member.id}`} className="flex-1 flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {member.profile.avatar_url ? (
                          <img src={member.profile.avatar_url} alt={member.profile.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle className="w-6 h-6 text-muted-foreground opacity-50" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium leading-none flex items-center flex-wrap gap-1">
                          {member.profile.full_name}
                          {getRoleBadge(member.role)}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.profile.phone}</div>
                        <div className="flex gap-2 items-center mt-2">
                          {getStatusBadge(member)}
                          {member.active_membership && (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{member.active_membership.plan_name}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="pl-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link to={`/admin/members/${member.id}`}>View Profile</Link>} />
                          {canManageMemberships && <DropdownMenuItem onSelect={() => setMembershipMember(member)}>Sell membership</DropdownMenuItem>}
                          {canScan && <DropdownMenuItem onSelect={() => handleQuickAttendance(member)}>Quick Attendance</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {membershipMember && (
        <CreateMembershipModal
          open
          onOpenChange={open => { if (!open) setMembershipMember(null) }}
          member={{ id: membershipMember.id, name: membershipMember.profile.full_name, phone: membershipMember.profile.phone }}
          onSuccess={fetchMembers}
        />
      )}
    </div>
  )
}
