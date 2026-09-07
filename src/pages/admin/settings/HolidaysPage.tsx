import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { MoreHorizontal, Plus, CalendarIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import SettingsNav from '@/components/layout/SettingsNav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Database } from '@/types/database'

type Holiday = Database['public']['Tables']['gym_holidays']['Row']

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  date: z.date(),
  reason: z.string().optional(),
  affects_membership: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

export default function HolidaysPage() {
  const { gym, hasPermission } = useGym()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const canEdit = hasPermission('holidays.manage')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      reason: '',
      affects_membership: false,
      date: new Date(),
    },
  })

  useEffect(() => {
    if (!gym || !supabase) return
    let active = true

    const fetchHolidays = async () => {
      if (!supabase) return
      setLoading(true)
      const { data, error } = await supabase
        .from('gym_holidays')
        .select('*')
        .eq('gym_id', gym.gym_id)
        .eq('is_active', true)
        .order('date', { ascending: false })

      if (error) {
        toast.error('Failed to load holidays')
      } else if (active) {
        setHolidays(data || [])
      }
      if (active) setLoading(false)
    }

    fetchHolidays()
    return () => { active = false }
  }, [gym])

  const openDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday)
      form.reset({
        name: holiday.name,
        date: new Date(holiday.date),
        reason: holiday.reason || '',
        affects_membership: holiday.affects_membership,
      })
    } else {
      setEditingHoliday(null)
      form.reset({
        name: '',
        date: undefined,
        reason: '',
        affects_membership: false,
      })
    }
    setIsDialogOpen(true)
  }

  const handleDelete = async (holiday: Holiday) => {
    if (!confirm(`Are you sure you want to delete the holiday "${holiday.name}"?`)) return
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('gym_holidays')
        .update({ is_active: false })
        .eq('id', holiday.id)

      if (error) throw error
      
      setHolidays(prev => prev.filter(h => h.id !== holiday.id))
      toast.success('Holiday deleted')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete holiday')
    }
  }

  const onSubmit = async (data: FormValues) => {
    if (!gym || !supabase) return
    
    if (data.affects_membership && !editingHoliday) {
      if (!confirm('This will eventually extend all active memberships by 1 day. (Note: extension logic will be implemented in a future update). Continue?')) {
        return
      }
    }

    setIsSaving(true)
    try {
      const dateStr = format(data.date, 'yyyy-MM-dd')
      
      const payload = {
        gym_id: gym.gym_id,
        name: data.name,
        date: dateStr,
        reason: data.reason || null,
        affects_membership: data.affects_membership,
      }

      if (editingHoliday) {
        const { data: updated, error } = await supabase
          .from('gym_holidays')
          .update(payload)
          .eq('id', editingHoliday.id)
          .select()
          .single()
          
        if (error) throw error
        setHolidays(prev => prev.map(h => h.id === updated.id ? updated : h))
        toast.success('Holiday updated')
      } else {
        const { data: inserted, error } = await supabase
          .from('gym_holidays')
          .insert(payload)
          .select()
          .single()
          
        if (error) throw error
        setHolidays(prev => [inserted, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        toast.success('Holiday created')
      }
      setIsDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save holiday')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your gym's configuration and preferences.</p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Holidays</CardTitle>
            <CardDescription>Manage gym closure days and membership extensions.</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Add Holiday
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading holidays...</div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No holidays configured yet.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Affects Membership</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">
                        {holiday.name}
                        {holiday.reason && <div className="text-xs text-muted-foreground">{holiday.reason}</div>}
                      </TableCell>
                      <TableCell>{formatDate(holiday.date)}</TableCell>
                      <TableCell>
                        {holiday.affects_membership ? (
                          <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            } />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openDialog(holiday)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => handleDelete(holiday)}>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
            <DialogDescription>
              {editingHoliday ? 'Update holiday details.' : 'Add a new closure day for your gym.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Diwali, Christmas" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger render={
                      <FormControl>
                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    } />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="affects_membership" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Affects Membership</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Extend all active memberships by 1 day.
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
