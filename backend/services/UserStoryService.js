const { pool } = require('../config/database');

class UserStoryService {

  static async createUserStory(groupId, data, createdBy) {
    const client = await pool.connect();
    try {
      const { title, description, priority, storyPoints, acceptanceCriteria, blockchainAddress } = data;

      const result = await client.query(`
        INSERT INTO user_stories (group_id, title, description, priority, story_points, acceptance_criteria, status, blockchain_address, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [groupId, title, description, priority || 0, storyPoints || 0, acceptanceCriteria, 'todo', blockchainAddress, createdBy]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }


  static async getUserStoriesByGroup(groupId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT us.*, 
               u.username as created_by_username,
               s.name as sprint_name,
               COUNT(bi.id) as backlog_items_count
        FROM user_stories us
        LEFT JOIN users u ON us.created_by = u.id
        LEFT JOIN sprints s ON us.sprint_id = s.id
        LEFT JOIN backlog_items bi ON us.id = bi.user_story_id
        WHERE us.group_id = $1
        GROUP BY us.id, u.username, s.name
        ORDER BY us.priority DESC, us.created_at ASC
      `, [groupId]);

      return result.rows;
    } finally {
      client.release();
    }
  }


  static async getUserStoryById(storyId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT us.*, 
               u.username as created_by_username,
               s.name as sprint_name,
               COUNT(bi.id) as backlog_items_count
        FROM user_stories us
        LEFT JOIN users u ON us.created_by = u.id
        LEFT JOIN sprints s ON us.sprint_id = s.id
        LEFT JOIN backlog_items bi ON us.id = bi.user_story_id
        WHERE us.id = $1
        GROUP BY us.id, u.username, s.name
      `, [storyId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async updateUserStory(storyId, data) {
    const client = await pool.connect();
    try {
      const { title, description, priority, storyPoints, acceptanceCriteria, status, blockchainAddress } = data;

      const result = await client.query(`
        UPDATE user_stories SET 
          title = COALESCE($2, title),
          description = COALESCE($3, description),
          priority = COALESCE($4, priority),
          story_points = COALESCE($5, story_points),
          acceptance_criteria = COALESCE($6, acceptance_criteria),
          status = COALESCE($7, status),
          blockchain_address = COALESCE($8, blockchain_address),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [storyId, title, description, priority, storyPoints, acceptanceCriteria, status, blockchainAddress]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }


  static async deleteUserStory(storyId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');


      await client.query(`
        UPDATE backlog_items 
        SET user_story_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE user_story_id = $1
      `, [storyId]);


      const result = await client.query(`
        DELETE FROM user_stories WHERE id = $1 RETURNING *
      `, [storyId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }


  static async assignToSprint(storyId, sprintId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE user_stories 
        SET sprint_id = $2, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [storyId, sprintId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }


  static async removeFromSprint(storyId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE user_stories 
        SET sprint_id = NULL, status = 'todo', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [storyId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }


  static async getUserStoriesBySprint(sprintId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT us.*, 
               u.username as created_by_username,
               COUNT(bi.id) as backlog_items_count
        FROM user_stories us
        LEFT JOIN users u ON us.created_by = u.id
        LEFT JOIN backlog_items bi ON us.id = bi.user_story_id
        WHERE us.sprint_id = $1
        GROUP BY us.id, u.username
        ORDER BY us.priority DESC, us.created_at ASC
      `, [sprintId]);

      return result.rows;
    } finally {
      client.release();
    }
  }


  static async getGroupStoryStats(groupId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_stories,
          COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_stories,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_stories,
          COUNT(CASE WHEN status = 'review' THEN 1 END) as review_stories,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as done_stories,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_stories,
          SUM(story_points) as total_story_points,
          SUM(CASE WHEN status = 'done' THEN story_points ELSE 0 END) as completed_story_points,
          COUNT(CASE WHEN sprint_id IS NOT NULL THEN 1 END) as assigned_to_sprint,
          COUNT(CASE WHEN sprint_id IS NULL THEN 1 END) as not_assigned
        FROM user_stories
        WHERE group_id = $1
      `, [groupId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }


  static async getSprintStoryStats(sprintId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_stories,
          COUNT(CASE WHEN status = 'todo' THEN 1 END) as todo_stories,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_stories,
          COUNT(CASE WHEN status = 'review' THEN 1 END) as review_stories,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as done_stories,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_stories,
          SUM(story_points) as total_story_points,
          SUM(CASE WHEN status = 'done' THEN story_points ELSE 0 END) as completed_story_points
        FROM user_stories
        WHERE sprint_id = $1
      `, [sprintId]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }


  static async getProductBacklog(groupId) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT us.*, 
               u.username as created_by_username,
               COUNT(bi.id) as backlog_items_count
        FROM user_stories us
        LEFT JOIN users u ON us.created_by = u.id
        LEFT JOIN backlog_items bi ON us.id = bi.user_story_id
        WHERE us.group_id = $1 AND us.sprint_id IS NULL AND us.status != 'cancelled'
        GROUP BY us.id, u.username
        ORDER BY us.priority DESC, us.created_at ASC
      `, [groupId]);

      return result.rows;
    } finally {
      client.release();
    }
  }


  static async updatePriority(storyId, priority) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE user_stories 
        SET priority = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [storyId, priority]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async updateStatus(storyId, status) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE user_stories 
        SET status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [storyId, status]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async getUserStoriesByPriority(groupId, priority) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT us.*, 
               u.username as created_by_username,
               s.name as sprint_name
        FROM user_stories us
        LEFT JOIN users u ON us.created_by = u.id
        LEFT JOIN sprints s ON us.sprint_id = s.id
        WHERE us.group_id = $1 AND us.priority = $2 AND us.status != 'cancelled'
        ORDER BY us.created_at ASC
      `, [groupId, priority]);

      return result.rows;
    } finally {
      client.release();
    }
  }
}

module.exports = UserStoryService;
