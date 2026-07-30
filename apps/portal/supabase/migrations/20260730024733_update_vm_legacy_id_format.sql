-- Drop existing trigger if any
drop trigger if exists trg_vms_code on public.vms;

-- Drop existing sequence if any
drop sequence if exists public.vm_code_seq;

-- Create new sequence starting from 3000
create sequence public.vm_code_seq start 3000;

-- Create trigger function to generate format qemu/3xxx
create or replace function public.assign_vm_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id := 
      'qemu/' || to_char(
        nextval('public.vm_code_seq'),
        'FM0000'
      );
  end if;

  return new;
end;
$$;

-- Create trigger
create trigger trg_vms_code
before insert on public.vms
for each row execute function public.assign_vm_code();