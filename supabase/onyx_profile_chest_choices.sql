-- Keep the player profile choices aligned with every chest Onyx exposes.

begin;

alter table public.profiles
  drop constraint if exists profiles_favourite_chest_check;

alter table public.profiles
  add constraint profiles_favourite_chest_check
  check (
    favourite_chest is null
    or favourite_chest in (
      'gold',
      'platinum',
      'draconic',
      'freedom',
      'arcane',
      'super_sigil'
    )
  );

commit;
