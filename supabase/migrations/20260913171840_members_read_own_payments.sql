DROP POLICY IF EXISTS "members_read_own_payments" ON public.payments;

CREATE POLICY "members_read_own_payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  member_id IN (
    SELECT id
    FROM public.gym_members
    WHERE gym_id = payments.gym_id
      AND profile_id = auth.uid()
      AND is_active = true
  )
);
