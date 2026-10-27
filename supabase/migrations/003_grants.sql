-- Lets the server's secret key (service_role) use the Jace Games tables.
-- Supabase projects made with "Automatically expose new tables" off don't
-- grant tables created in SQL to any API role, so without this the server
-- can't read or write them. anon and authenticated still get nothing.

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function community_add_play(uuid) to service_role;

-- Tables added by later migrations get the same.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
