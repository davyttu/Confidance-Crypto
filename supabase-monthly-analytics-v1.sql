create or replace view public.monthly_payment_analytics_v1 as
select
  user_id,
  date_trunc('month', created_at) as month,
  count(*) as transactions_count,
  sum(coalesce((metadata->>'amount')::numeric, 0)) as total_volume,
  sum(coalesce((metadata->>'gas_fee')::numeric, 0)) as gas_fees_total,
  sum(coalesce((metadata->>'protocol_fee')::numeric, 0)) as protocol_fees_total,
  sum(
    coalesce((metadata->>'gas_fee')::numeric, 0) +
    coalesce((metadata->>'protocol_fee')::numeric, 0)
  ) as total_fees,
  case
    when sum(coalesce((metadata->>'amount')::numeric, 0)) > 0 then
      (
        sum(
          coalesce((metadata->>'gas_fee')::numeric, 0) +
          coalesce((metadata->>'protocol_fee')::numeric, 0)
        )
        / sum(coalesce((metadata->>'amount')::numeric, 0))
      ) * 100
    else 0
  end as real_cost_percentage
from public.payment_timeline_events
where event_type = 'payment_executed'
group by user_id, date_trunc('month', created_at);

create or replace view public.monthly_payment_breakdown_v1 as
select
  user_id,
  date_trunc('month', created_at) as month,
  coalesce(metadata->>'payment_type', 'scheduled') as payment_type,
  count(*) as transactions_count,
  sum(coalesce((metadata->>'amount')::numeric, 0)) as total_volume,
  avg(
    coalesce((metadata->>'gas_fee')::numeric, 0) +
    coalesce((metadata->>'protocol_fee')::numeric, 0)
  ) as avg_fees
from public.payment_timeline_events
where event_type = 'payment_executed'
group by user_id, date_trunc('month', created_at), coalesce(metadata->>'payment_type', 'scheduled');
