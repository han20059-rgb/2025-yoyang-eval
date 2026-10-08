-- Serialize last-admin revoke on eval_admins only. Does not touch staff passwords or leave balances.

-- Active admin rows are locked (FOR UPDATE) before counting, so two concurrent
-- revokes cannot both pass the last-admin check.
