-- ONYX open email/password registration
-- Remove the retired invitation bootstrap path. New accounts are created by
-- noir-register and approved as ordinary players by register_new_noir_player.

begin;

drop trigger if exists approve_new_noir_invitation
  on auth.users;
drop trigger if exists approve_updated_noir_invitation
  on auth.users;

drop function if exists public.approve_invited_noir_user();

commit;
