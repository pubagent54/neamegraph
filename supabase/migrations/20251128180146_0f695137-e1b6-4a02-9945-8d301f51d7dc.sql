-- Enable realtime for wizmode_run_items table
ALTER TABLE wizmode_run_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE wizmode_run_items;

-- Enable realtime for wizmode_runs table  
ALTER TABLE wizmode_runs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE wizmode_runs;