import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PlanCheckout } from '@/components/payments/PlanCheckout'
import { useMemberships, type Membership } from '@/hooks/useMemberships'

type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void | Promise<void>
}

export function CreateMembershipModal({ open, onOpenChange, onSuccess, member }: ModalProps & { member: { id: string; name: string; phone: string | null } }) {
  return <PlanCheckout open={open} onOpenChange={onOpenChange} member={member} membershipPath={`/admin/members/${member.id}`} onSuccess={onSuccess} />
}

const freezeSchema = z.object({
  days: z.number({ error: 'Enter freeze days' }).int().min(1, 'Freeze must be at least 1 day'),
  reason: z.string(),
})

export function FreezeMembershipModal({ open, onOpenChange, onSuccess, membership }: ModalProps & { membership: Membership }) {
  const { freezeMembership } = useMemberships()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<z.infer<typeof freezeSchema>>({ resolver: zodResolver(freezeSchema), defaultValues: { days: 1, reason: '' } })
  useEffect(() => { if (open) form.reset({ days: 1, reason: '' }) }, [form, open])

  async function submit(values: z.infer<typeof freezeSchema>) {
    setSubmitting(true)
    try {
      await freezeMembership(membership.id, values.days, values.reason)
      toast.success(`Membership frozen for ${values.days} days`)
      onOpenChange(false)
      await onSuccess?.()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not freeze membership')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Freeze membership</DialogTitle><DialogDescription>The membership end date will be extended by the freeze duration.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField control={form.control} name="days" render={({ field }) => (
              <FormItem><FormLabel>Freeze duration (days) *</FormLabel><FormControl><Input type="number" min="1" inputMode="numeric" {...field} onChange={event => field.onChange(event.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? 'Freezing…' : 'Freeze membership'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

const extendSchema = z.object({
  days: z.number({ error: 'Enter extension days' }).int().min(1, 'Extension must be at least 1 day'),
  reason: z.string().trim().min(2, 'Tell us why this membership is being extended'),
})

export function ExtendMembershipModal({ open, onOpenChange, onSuccess, membership }: ModalProps & { membership: Membership }) {
  const { extendMembership } = useMemberships()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<z.infer<typeof extendSchema>>({ resolver: zodResolver(extendSchema), defaultValues: { days: 1, reason: '' } })
  useEffect(() => { if (open) form.reset({ days: 1, reason: '' }) }, [form, open])

  async function submit(values: z.infer<typeof extendSchema>) {
    setSubmitting(true)
    try {
      await extendMembership(membership.id, values.days, values.reason)
      toast.success(`Membership extended by ${values.days} days`)
      onOpenChange(false)
      await onSuccess?.()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not extend membership')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Extend membership</DialogTitle><DialogDescription>Add goodwill or closure days to the current end date.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField control={form.control} name="days" render={({ field }) => (
              <FormItem><FormLabel>Extension days *</FormLabel><FormControl><Input type="number" min="1" inputMode="numeric" {...field} onChange={event => field.onChange(event.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem><FormLabel>Reason *</FormLabel><FormControl><Textarea placeholder="Gym closure compensation" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? 'Extending…' : 'Extend membership'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

const cancelSchema = z.object({
  reason: z.string().trim().min(2, 'A cancellation reason is required'),
  confirmed: z.boolean().refine(Boolean, 'Confirm that remaining days will be forfeited'),
})

export function CancelMembershipModal({ open, onOpenChange, onSuccess, membership }: ModalProps & { membership: Membership }) {
  const { cancelMembership } = useMemberships()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<z.infer<typeof cancelSchema>>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: '', confirmed: false } })
  useEffect(() => { if (open) form.reset({ reason: '', confirmed: false }) }, [form, open])

  async function submit(values: z.infer<typeof cancelSchema>) {
    setSubmitting(true)
    try {
      await cancelMembership(membership.id, values.reason)
      toast.success('Membership cancelled')
      onOpenChange(false)
      await onSuccess?.()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not cancel membership')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancel membership</DialogTitle><DialogDescription>This action ends access and cannot be undone from this screen.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem><FormLabel>Cancellation reason *</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="confirmed" render={({ field }) => (
              <FormItem>
                <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <span>I understand this will forfeit remaining days with no refund</span>
                </label>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Keep membership</Button><Button type="submit" variant="destructive" disabled={submitting}>{submitting ? 'Cancelling…' : 'Cancel membership'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function ResumeMembershipButton({ membership, onSuccess }: { membership: Membership; onSuccess?: () => void | Promise<void> }) {
  const { resumeMembership } = useMemberships()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  async function resume() {
    setSubmitting(true)
    try {
      await resumeMembership(membership.id)
      toast.success('Membership resumed')
      setOpen(false)
      await onSuccess?.()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not resume membership')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Resume</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resume membership?</DialogTitle><DialogDescription>Unused freeze days will be removed from the extended end date.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Not yet</Button><Button onClick={() => void resume()} disabled={submitting}>{submitting ? 'Resuming…' : 'Resume membership'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
