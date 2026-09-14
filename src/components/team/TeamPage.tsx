import { useState } from 'react'
import { Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import SettingsNav from '@/components/layout/SettingsNav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGym } from '@/hooks/useGym'
import { useTeam, type TeamMember } from '@/hooks/useTeam'
import { formatDate } from '@/lib/format'

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  receptionist: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  trainer: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  member: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

export default function TeamPage({
  gymId,
  gymName,
  isSuperAdmin = false,
}: {
  gymId?: string
  gymName?: string
  isSuperAdmin?: boolean
}) {
  const { gym } = useGym()
  const team = useTeam(gymId)
  const [addOpen, setAddOpen] = useState(false)
  const [roleMember, setRoleMember] = useState<TeamMember | null>(null)
  const [newRole, setNewRole] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [addRole, setAddRole] = useState('')
  const [saving, setSaving] = useState(false)
  const roles = isSuperAdmin
    ? ['owner', 'admin', 'receptionist', 'trainer']
    : team.getAssignableRoles()
  const displayGymName = gymName ?? gym?.name ?? 'this gym'

  async function runAction(work: () => Promise<void>, success: string) {
    setSaving(true)
    try {
      await work()
      toast.success(success)
      return true
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not update team')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!phone || !name || !addRole) {
      toast.error('Phone, name, and role are required')
      return
    }
    const succeeded = await runAction(
      () => team.addTeamMember(phone, name, email, addRole),
      'Team member added',
    )
    if (!succeeded) return
    setAddOpen(false)
    setPhone('')
    setName('')
    setEmail('')
    setAddRole('')
  }

  async function toggleAccess(member: TeamMember) {
    const action = member.is_active ? 'Remove' : 'Restore'
    const message = member.is_active
      ? `Remove ${member.profiles.full_name}'s access? Past records will be preserved.`
      : `Restore ${member.profiles.full_name}'s access to ${displayGymName}?`
    if (!window.confirm(message)) return
    await runAction(
      () => member.is_active ? team.deactivateMember(member.id) : team.reactivateMember(member.id),
      `${action} access completed`,
    )
  }

  return (
    <div className="space-y-6">
      {!isSuperAdmin && <SettingsNav />}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Team</h1>
          <p className="mt-1 text-muted-foreground">Manage member and staff access for {displayGymName}.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={!roles.length || saving}>
          <Plus /> Add Team Member
        </Button>
      </div>

      {team.error && (
        <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {team.error}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Gym members</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.teamMembers.map(member => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{member.profiles.full_name}</td>
                    <td className="p-4">{member.profiles.email || '—'}</td>
                    <td className="p-4">{member.profiles.phone || '—'}</td>
                    <td className="p-4"><Badge className={roleColors[member.role] ?? ''}>{member.role}</Badge></td>
                    <td className="p-4"><Badge variant={member.is_active ? 'default' : 'destructive'}>{member.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="p-4">{formatDate(member.joined_at)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={!roles.length || saving} onClick={() => { setRoleMember(member); setNewRole('') }}>
                          <ShieldCheck /> Change Role
                        </Button>
                        <Button size="sm" variant="ghost" disabled={saving} aria-label={`${member.is_active ? 'Deactivate' : 'Reactivate'} ${member.profiles.full_name}`} onClick={() => void toggleAccess(member)}>
                          {member.is_active ? <UserX /> : <UserCheck />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {team.loading && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Loading team…</td></tr>}
                {!team.loading && !team.error && !team.teamMembers.length && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No gym members found.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="team-phone">Phone number *</Label><Input id="team-phone" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+91 98765 43210" /></div>
            <div><Label htmlFor="team-name">Full name *</Label><Input id="team-name" value={name} onChange={event => setName(event.target.value)} /></div>
            <div><Label htmlFor="team-email">Email</Label><Input id="team-email" value={email} onChange={event => setEmail(event.target.value)} type="email" /></div>
            <div><Label>Role *</Label><Select value={addRole} onValueChange={value => setAddRole(value ?? '')}><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{roles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void submit()}>{saving ? 'Adding…' : 'Add member'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleMember} onOpenChange={open => !open && setRoleMember(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change role</DialogTitle></DialogHeader>
          {roleMember && (
            <div className="space-y-4">
              <p>{roleMember.profiles.full_name} is currently <strong className="capitalize">{roleMember.role}</strong>.</p>
              <Select value={newRole} onValueChange={value => setNewRole(value ?? '')}><SelectTrigger><SelectValue placeholder="Select new role" /></SelectTrigger><SelectContent>{roles.filter(role => role !== roleMember.role).map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select>
              <Button className="w-full" disabled={!newRole || saving} onClick={() => void runAction(() => team.changeRole(roleMember.id, newRole), `${roleMember.profiles.full_name} is now ${newRole}`).then(succeeded => succeeded && setRoleMember(null))}>{saving ? 'Saving…' : 'Save role'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
