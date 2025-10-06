const addBacklogColumnQuery = `
  DO $$
  BEGIN
    -- Adicionar coluna backlog_id se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sprints' AND column_name = 'backlog_id'
    ) THEN
      ALTER TABLE sprints ADD COLUMN backlog_id INTEGER;
      ALTER TABLE sprints ADD CONSTRAINT fk_sprints_backlog 
        FOREIGN KEY (backlog_id) REFERENCES backlog_items(id) ON DELETE SET NULL;
    END IF;
  END
  $$;
`;

module.exports = { addBacklogColumnQuery };