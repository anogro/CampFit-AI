update public.campfit_v2_question_bank
set helper_text = '학년보다 실제 만 나이를 기준으로 캠프 조건을 확인합니다.',
    updated_at = now()
where question_key = 'child_age_at_start';

update public.campfit_v2_question_bank
set helper_text = '최소·최대 기간을 정해주시면 검토 범위를 더 좁힐 수 있어요.',
    updated_at = now()
where question_key = 'duration_weeks';

update public.campfit_v2_question_bank
set helper_text = '여러 지역을 함께 고르거나, 아직 미정으로 남겨두셔도 괜찮아요.',
    updated_at = now()
where question_key = 'preferred_regions';

update public.campfit_v2_question_bank
set title = '이번 캠프에서 꼭 피하고 싶은 결과가 있다면 적어주세요.',
    updated_at = now()
where question_key = 'unacceptable_outcome';

update public.campfit_v2_question_bank
set options = jsonb_set(
      options,
      '{7,label}',
      to_jsonb('조건이 안 맞으면 추천 대신 확인이 필요하다고 알려주시면 좋겠습니다.'::text),
      false
    ),
    updated_at = now()
where question_key = 'flexibility'
  and options->7->>'value' = 'prefer_no_recommendation';

update public.campfit_v2_question_bank
set options = jsonb_set(
      options,
      '{5,label}',
      to_jsonb('조건에 안 맞으면 추천보다 확인이 필요하다고 표시해주세요.'::text),
      false
    ),
    updated_at = now()
where question_key = 'mismatch_tolerance'
  and options->5->>'value' = 'no_mismatch';
