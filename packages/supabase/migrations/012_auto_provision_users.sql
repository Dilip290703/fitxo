-- Migration 012: auto-provision public.users (+ a riders row for riders) on signup.
-- Run once in the Supabase SQL Editor.
--
-- WHY: signup only writes to auth.users. The customer app back-fills its public.users
-- row in the OAuth callback, but the agent app can't (with email-confirm on there's no
-- session right after signUp, so RLS blocks a client insert) — so a freshly-signed-up
-- rider had NO public.users row and NO riders row, was invisible in Admin > Riders, and
-- could only be onboarded by hand-writing SQL. This trigger removes that manual step:
-- anyone who signs up immediately gets the right rows, and a rider shows up in Admin
-- ready to be verified with one click. (Standard Supabase handle_new_user pattern.)

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role;
  v_name text;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer');
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    ''
  );

  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role)
  ON CONFLICT (id) DO NOTHING;

  IF v_role = 'rider' THEN
    INSERT INTO public.riders (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- One-time back-fill: provision rows for anyone who already signed up before this
-- migration (e.g. the test rider that previously needed a manual INSERT).
INSERT INTO public.users (id, email, name, role)
SELECT au.id, au.email,
       COALESCE(NULLIF(au.raw_user_meta_data->>'name',''), NULLIF(au.raw_user_meta_data->>'full_name',''), ''),
       COALESCE((au.raw_user_meta_data->>'role')::user_role, 'customer')
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.riders (user_id)
SELECT u.id FROM public.users u
WHERE u.role = 'rider'
ON CONFLICT (user_id) DO NOTHING;
