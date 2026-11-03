-- ============================================================================
-- 0004 — Staff directory read access
--
-- The original RLS allowed a staff member to read only their own row (or an
-- administrator to read every row). Reception and the appointment tables embed
-- `staff` to display the clinician's name, and the reception booking flow needs
-- the list of dentists/optometrists. Without this policy those reads return no
-- rows, so names show as "Unknown clinician" and the doctor picker is empty.
--
-- Any active staff member may read the staff directory. The public boundary is
-- still the `public_staff` view, which exposes only name/role/title and is the
-- only staff data available to anonymous visitors.
-- ============================================================================

drop policy if exists staff_select_directory on public.staff;
create policy staff_select_directory on public.staff
  for select to authenticated
  using (public.current_staff_role() is not null);
