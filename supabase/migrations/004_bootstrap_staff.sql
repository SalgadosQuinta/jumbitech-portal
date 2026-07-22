-- =============================================================================
-- Migration 003: bootstrap the first staff account.
--
-- Every new signup defaults to 'candidate'. To run the platform you need one
-- staff account. AFTER you have signed up once through the app with your own
-- email, run this (replace the email) in the Supabase SQL editor to promote
-- yourself to staff. Delete or ignore this file thereafter.
-- =============================================================================

-- update public.profiles
-- set role = 'staff'
-- where email = 'you@jumbitech.com';

-- To attach a client user to their organisation once created:
-- update public.profiles
-- set role = 'client', client_id = '<client-uuid>'
-- where email = 'contact@theclient.com';
