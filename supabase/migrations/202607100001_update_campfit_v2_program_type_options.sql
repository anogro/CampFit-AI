update public.campfit_v2_question_bank
set
  options = options || jsonb_build_array(
    jsonb_build_object(
      'value', 'culture_activity',
      'label', '문화·액티비티 결합형'
    )
  ),
  updated_at = now()
where question_key = 'preferred_program_types'
  and not exists (
    select 1
    from jsonb_array_elements(options) as option
    where option ->> 'value' = 'culture_activity'
  );
