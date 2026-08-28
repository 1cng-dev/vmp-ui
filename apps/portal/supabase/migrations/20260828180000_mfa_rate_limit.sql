-- Track failed MFA verification attempts per user for account lockout
CREATE TABLE IF NOT EXISTS public.mfa_failed_attempts (
  user_id uuid NOT NULL PRIMARY KEY,
  factor_id uuid,
  ip_address text,
  attempt_count int NOT NULL DEFAULT 0,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

GRANT ALL ON public.mfa_failed_attempts TO supabase_auth_admin;

-- Hook called by GoTrue on every MFA verification attempt
CREATE OR REPLACE FUNCTION public.hook_mfa_verification_attempt(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_attempt public.mfa_failed_attempts%ROWTYPE;
  v_remaining_seconds int;
  max_attempts int := 5;
  lockout_minutes int := 5;
  window_minutes int := 15;
BEGIN
  v_user_id := (event->>'user_id')::uuid;

  SELECT * INTO v_attempt
    FROM public.mfa_failed_attempts
    WHERE user_id = v_user_id;

  -- If this account is currently locked, reject everything (correct or wrong)
  IF v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN
    v_remaining_seconds := CEIL(EXTRACT(EPOCH FROM (v_attempt.locked_until - now())))::int;
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 429,
        'message', format('Account locked. Try again in %s minutes %s seconds.', v_remaining_seconds / 60, v_remaining_seconds % 60)
      )
    );
  END IF;

  -- Successful attempt: clear the failed attempt / lock record
  IF (event->>'valid')::boolean THEN
    DELETE FROM public.mfa_failed_attempts WHERE user_id = v_user_id;
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.mfa_failed_attempts
      (user_id, factor_id, ip_address, attempt_count, first_failed_at, last_failed_at)
    VALUES
      (v_user_id, (event->>'factor_id')::uuid, event->'metadata'->>'ip_address', 1, now(), now());
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  -- Reset counter if the lock has expired or the failure window has passed
  IF (v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until <= now()) OR
     (v_attempt.last_failed_at < now() - (window_minutes || ' minutes')::interval) THEN
    UPDATE public.mfa_failed_attempts
      SET factor_id = (event->>'factor_id')::uuid,
          ip_address = event->'metadata'->>'ip_address',
          attempt_count = 1,
          first_failed_at = now(),
          last_failed_at = now(),
          locked_until = NULL
      WHERE user_id = v_user_id;
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  -- Normal case: increment failed attempt counter
  UPDATE public.mfa_failed_attempts
    SET attempt_count = v_attempt.attempt_count + 1,
        last_failed_at = now(),
        factor_id = (event->>'factor_id')::uuid,
        ip_address = event->'metadata'->>'ip_address'
    WHERE user_id = v_user_id;

  -- When max attempts reached, lock the account for the configured lockout duration
  IF v_attempt.attempt_count + 1 >= max_attempts THEN
    UPDATE public.mfa_failed_attempts
      SET locked_until = now() + (lockout_minutes || ' minutes')::interval
      WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 429,
        'message', format('Account temporarily locked for %s minutes due to too many failed attempts.', lockout_minutes)
      )
    );
  END IF;

  RETURN jsonb_build_object('decision', 'continue');
END;
$$;

GRANT EXECUTE ON FUNCTION public.hook_mfa_verification_attempt(jsonb) TO supabase_auth_admin;
