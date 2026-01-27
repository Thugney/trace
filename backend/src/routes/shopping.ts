/**
 * Shopping Gamification Routes
 * Allows parents to create shopping lists and reward kids for helping
 */

import { Router, Request, Response } from 'express';
import { db } from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { awardPoints } from '../services/economyControl';

const router = Router();

// Apply authentication and feature access check to all routes
router.use(authenticate, requireFeature('shopping'));

// Helper function to check if a child has shopping list creation permission
function canChildCreateLists(profileId: number): boolean {
  const profile: any = db.prepare('SELECT settings FROM profiles WHERE id = ?').get(profileId);
  if (!profile) return false;
  try {
    const settings = JSON.parse(profile.settings || '{}');
    return settings.can_create_shopping_lists === true;
  } catch {
    return false;
  }
}

// Helper to get parent ID for a child
function getParentIdForChild(childId: number): number | null {
  const profile: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(childId);
  return profile?.parent_id || null;
}

// ==================== SHOPPING CATEGORIES ====================

// Get all shopping categories
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = db.prepare(`
      SELECT * FROM shopping_categories ORDER BY sort_order ASC
    `).all();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SHOPPING LISTS ====================

// Get all shopping lists for a parent
router.get('/lists/:parentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;
    const { includeItems } = req.query;

    const lists: any[] = db.prepare(`
      SELECT sl.*,
        (SELECT COUNT(*) FROM shopping_items WHERE list_id = sl.id) as item_count,
        (SELECT COUNT(*) FROM shopping_trips WHERE list_id = sl.id) as trip_count
      FROM shopping_lists sl
      WHERE sl.parent_id = ?
      ORDER BY sl.updated_at DESC
    `).all(parentId);

    if (includeItems === 'true') {
      for (const list of lists) {
        list.items = db.prepare(`
          SELECT si.*, sc.display_name as category_name, sc.icon as category_icon
          FROM shopping_items si
          LEFT JOIN shopping_categories sc ON si.category = sc.name
          WHERE si.list_id = ?
          ORDER BY si.sort_order ASC, si.category ASC
        `).all(list.id);
      }
    }

    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single shopping list with items (by listId only)
router.get('/lists/detail/:listId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { listId } = req.params;

    const list: any = db.prepare(`
      SELECT * FROM shopping_lists WHERE id = ?
    `).get(listId);

    if (!list) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    list.items = db.prepare(`
      SELECT si.*, sc.id as category_id, sc.display_name as category_name, sc.icon as category_icon
      FROM shopping_items si
      LEFT JOIN shopping_categories sc ON si.category_id = sc.id
      WHERE si.list_id = ?
      ORDER BY si.sort_order ASC
    `).all(listId);

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new shopping list
router.post('/lists', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    // Check if user can create lists (parents/admins always can, children need permission)
    const isParentOrAdmin = userProfile.type === 'parent' || userProfile.type === 'admin';
    const isChildWithPermission = userProfile.type === 'child' && canChildCreateLists(userProfile.id);

    if (!isParentOrAdmin && !isChildWithPermission) {
      return res.status(403).json({ error: 'You do not have permission to create shopping lists' });
    }

    const {
      parent_id,
      name,
      description,
      store_name,
      storeName, // also accept camelCase
      budget,
      points_per_item = 5,
      pointsPerItem, // also accept camelCase
      bonus_for_completion = 20,
      bonusForCompletion, // also accept camelCase
      bonus_for_good_behavior = 15,
      bonusForGoodBehavior, // also accept camelCase
      items = []
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    // For children, use their parent's ID; for parents/admins, use their own ID
    let finalParentId: number;
    if (isChildWithPermission) {
      const parentId = getParentIdForChild(userProfile.id);
      if (!parentId) {
        return res.status(400).json({ error: 'Could not determine parent for this child' });
      }
      finalParentId = parentId;
    } else {
      finalParentId = parent_id || userProfile.id;
    }
    const finalStoreName = store_name || storeName || null;
    const finalPointsPerItem = points_per_item ?? pointsPerItem ?? 5;
    const finalBonusForCompletion = bonus_for_completion ?? bonusForCompletion ?? 20;
    const finalBonusForGoodBehavior = bonus_for_good_behavior ?? bonusForGoodBehavior ?? 15;

    // Create the list
    const result = db.prepare(`
      INSERT INTO shopping_lists (
        parent_id, name, description, store_name, budget,
        points_per_item, bonus_for_completion, bonus_for_good_behavior
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalParentId, name, description || null, finalStoreName, budget || null,
      finalPointsPerItem, finalBonusForCompletion, finalBonusForGoodBehavior
    );

    const listId = result.lastInsertRowid;

    // Add items if provided
    if (items.length > 0) {
      const insertItem = db.prepare(`
        INSERT INTO shopping_items (
          list_id, name, category, quantity, unit, estimated_price, notes, is_optional, points_value, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      items.forEach((item: any, index: number) => {
        insertItem.run(
          listId,
          item.name,
          item.category || 'other',
          item.quantity || 1,
          item.unit || null,
          item.estimatedPrice || null,
          item.notes || null,
          item.isOptional ? 1 : 0,
          item.pointsValue || null,
          item.sortOrder ?? index
        );
      });
    }

    const newList = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(listId);
    res.status(201).json(newList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a shopping list
router.put('/lists/:listId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { listId } = req.params;
    const {
      name,
      description,
      store_name,
      storeName,
      budget,
      points_per_item,
      pointsPerItem,
      bonus_for_completion,
      bonusForCompletion,
      bonus_for_good_behavior,
      bonusForGoodBehavior,
      is_active,
      isActive
    } = req.body;

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    const finalStoreName = store_name ?? storeName;
    if (finalStoreName !== undefined) { updates.push('store_name = ?'); values.push(finalStoreName); }
    if (budget !== undefined) { updates.push('budget = ?'); values.push(budget); }
    const finalPointsPerItem = points_per_item ?? pointsPerItem;
    if (finalPointsPerItem !== undefined) { updates.push('points_per_item = ?'); values.push(finalPointsPerItem); }
    const finalBonusForCompletion = bonus_for_completion ?? bonusForCompletion;
    if (finalBonusForCompletion !== undefined) { updates.push('bonus_for_completion = ?'); values.push(finalBonusForCompletion); }
    const finalBonusForGoodBehavior = bonus_for_good_behavior ?? bonusForGoodBehavior;
    if (finalBonusForGoodBehavior !== undefined) { updates.push('bonus_for_good_behavior = ?'); values.push(finalBonusForGoodBehavior); }
    const finalIsActive = is_active ?? isActive;
    if (finalIsActive !== undefined) { updates.push('is_active = ?'); values.push(finalIsActive ? 1 : 0); }

    values.push(listId);
    db.prepare(`UPDATE shopping_lists SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedList = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(listId);
    res.json(updatedList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a shopping list
router.delete('/lists/:listId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { listId } = req.params;
    db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(listId);
    res.json({ message: 'Shopping list deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SHOPPING ITEMS ====================

// Add item to a list
router.post('/lists/:listId/items', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { listId } = req.params;
    const {
      name,
      category_id,
      category,
      quantity,
      unit,
      estimated_price,
      estimatedPrice,
      notes,
      is_optional,
      isOptional,
      points_value,
      pointsValue,
      sort_order,
      sortOrder
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    // Get max sort order
    const maxOrder: any = db.prepare('SELECT MAX(sort_order) as max FROM shopping_items WHERE list_id = ?').get(listId);

    const finalCategoryId = category_id || null;
    const finalEstimatedPrice = estimated_price ?? estimatedPrice ?? null;
    const finalIsOptional = is_optional ?? isOptional ?? false;
    const finalPointsValue = points_value ?? pointsValue ?? null;
    const finalSortOrder = sort_order ?? sortOrder ?? (maxOrder?.max || 0) + 1;

    const result = db.prepare(`
      INSERT INTO shopping_items (
        list_id, name, category_id, quantity, unit, estimated_price, notes, is_optional, points_value, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      listId,
      name,
      finalCategoryId,
      quantity || 1,
      unit || null,
      finalEstimatedPrice,
      notes || null,
      finalIsOptional ? 1 : 0,
      finalPointsValue,
      finalSortOrder
    );

    const newItem = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(result.lastInsertRowid);

    // Update list timestamp
    db.prepare('UPDATE shopping_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(listId);

    res.status(201).json(newItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update an item
router.put('/items/:itemId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const { name, category, quantity, unit, estimatedPrice, notes, isOptional, pointsValue, sortOrder } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (quantity !== undefined) { updates.push('quantity = ?'); values.push(quantity); }
    if (unit !== undefined) { updates.push('unit = ?'); values.push(unit); }
    if (estimatedPrice !== undefined) { updates.push('estimated_price = ?'); values.push(estimatedPrice); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (isOptional !== undefined) { updates.push('is_optional = ?'); values.push(isOptional ? 1 : 0); }
    if (pointsValue !== undefined) { updates.push('points_value = ?'); values.push(pointsValue); }
    if (sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(sortOrder); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(itemId);
    db.prepare(`UPDATE shopping_items SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedItem = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(itemId);
    res.json(updatedItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an item
router.delete('/items/:itemId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    db.prepare('DELETE FROM shopping_items WHERE id = ?').run(itemId);
    res.json({ message: 'Item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SHOPPING TRIPS ====================

// Get active trips for a parent (planned or in_progress)
router.get('/trips/active/:parentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;

    const trips: any[] = db.prepare(`
      SELECT st.*, sl.name as list_name,
        (SELECT COUNT(*) FROM shopping_items WHERE list_id = st.list_id) as total_items,
        (SELECT COUNT(*) FROM shopping_item_completions WHERE trip_id = st.id) as items_found
      FROM shopping_trips st
      JOIN shopping_lists sl ON st.list_id = sl.id
      WHERE st.parent_id = ? AND st.status IN ('planned', 'in_progress')
      ORDER BY st.created_at DESC
    `).all(parentId);

    // Add helpers for each trip
    for (const trip of trips) {
      trip.helpers = db.prepare(`
        SELECT sh.*, p.name, p.avatar
        FROM shopping_helpers sh
        JOIN profiles p ON sh.profile_id = p.id
        WHERE sh.trip_id = ?
      `).all(trip.id);
    }

    res.json(trips);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get trips for a child helper
router.get('/trips/helper/:profileId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;

    const trips: any[] = db.prepare(`
      SELECT st.*, sl.name as list_name,
        sh.items_found, sh.points_earned, sh.bonus_earned, sh.behavior_rating,
        (SELECT COUNT(*) FROM shopping_items WHERE list_id = st.list_id) as total_items
      FROM shopping_helpers sh
      JOIN shopping_trips st ON sh.trip_id = st.id
      JOIN shopping_lists sl ON st.list_id = sl.id
      WHERE sh.profile_id = ?
      ORDER BY st.created_at DESC
    `).all(profileId);

    // Calculate points_earned for completed trips
    for (const trip of trips) {
      trip.points_earned = (trip.points_earned || 0) + (trip.bonus_earned || 0);
    }

    res.json(trips);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single trip by ID with full details
router.get('/trips/detail/:tripId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;

    const trip: any = db.prepare(`
      SELECT st.*, sl.name as list_name, sl.points_per_item, sl.bonus_for_completion, sl.bonus_for_good_behavior,
        (SELECT COUNT(*) FROM shopping_items WHERE list_id = st.list_id) as total_items,
        (SELECT COUNT(*) FROM shopping_item_completions WHERE trip_id = st.id) as items_found
      FROM shopping_trips st
      JOIN shopping_lists sl ON st.list_id = sl.id
      WHERE st.id = ?
    `).get(tripId);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get helpers with profile info
    trip.helpers = db.prepare(`
      SELECT sh.*, p.name, p.avatar
      FROM shopping_helpers sh
      JOIN profiles p ON sh.profile_id = p.id
      WHERE sh.trip_id = ?
    `).all(tripId);

    // Get items with completion status
    trip.items = db.prepare(`
      SELECT si.*, sc.id as category_id, sc.display_name as category_name, sc.icon as category_icon,
        sic.id as completion_id, sic.found_by, sic.completed_at,
        CASE WHEN sic.id IS NOT NULL THEN 1 ELSE 0 END as is_found,
        p.name as found_by_name
      FROM shopping_items si
      LEFT JOIN shopping_categories sc ON si.category_id = sc.id
      LEFT JOIN shopping_item_completions sic ON si.id = sic.item_id AND sic.trip_id = ?
      LEFT JOIN profiles p ON sic.found_by = p.id
      WHERE si.list_id = ?
      ORDER BY si.sort_order ASC
    `).all(tripId, trip.list_id);

    res.json(trip);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get trips for a parent
router.get('/trips/:parentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT st.*, sl.name as list_name,
        (SELECT COUNT(*) FROM shopping_helpers WHERE trip_id = st.id) as helper_count,
        (SELECT COUNT(*) FROM shopping_item_completions WHERE trip_id = st.id) as items_completed
      FROM shopping_trips st
      JOIN shopping_lists sl ON st.list_id = sl.id
      WHERE st.parent_id = ?
    `;
    const params: any[] = [parentId];

    if (status) {
      query += ' AND st.status = ?';
      params.push(status);
    }

    query += ' ORDER BY st.created_at DESC';

    const trips = db.prepare(query).all(...params);
    res.json(trips);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single trip with full details (legacy route)
router.get('/trips/:parentId/:tripId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;

    const trip: any = db.prepare(`
      SELECT st.*, sl.name as list_name, sl.points_per_item, sl.bonus_for_completion, sl.bonus_for_good_behavior
      FROM shopping_trips st
      JOIN shopping_lists sl ON st.list_id = sl.id
      WHERE st.id = ?
    `).get(tripId);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get helpers with profile info
    trip.helpers = db.prepare(`
      SELECT sh.*, p.name, p.avatar
      FROM shopping_helpers sh
      JOIN profiles p ON sh.profile_id = p.id
      WHERE sh.trip_id = ?
    `).all(tripId);

    // Get items with completion status
    trip.items = db.prepare(`
      SELECT si.*, sc.display_name as category_name, sc.icon as category_icon,
        sic.id as completion_id, sic.found_by, sic.actual_price, sic.quantity_bought,
        sic.was_substituted, sic.substitution_notes, sic.completed_at,
        p.name as found_by_name
      FROM shopping_items si
      LEFT JOIN shopping_categories sc ON si.category = sc.name
      LEFT JOIN shopping_item_completions sic ON si.id = sic.item_id AND sic.trip_id = ?
      LEFT JOIN profiles p ON sic.found_by = p.id
      WHERE si.list_id = ?
      ORDER BY si.sort_order ASC
    `).all(tripId, trip.list_id);

    res.json(trip);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new shopping trip
router.post('/trips', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    if (userProfile.type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can create shopping trips' });
    }

    const {
      list_id,
      listId,
      store_name,
      storeName,
      scheduled_date,
      scheduledAt,
      helpers = []
    } = req.body;

    const finalListId = list_id || listId;
    const finalStoreName = store_name || storeName || null;
    const finalScheduledDate = scheduled_date || scheduledAt || null;

    if (!finalListId) {
      return res.status(400).json({ error: 'List ID is required' });
    }

    // Create the trip
    const result = db.prepare(`
      INSERT INTO shopping_trips (list_id, parent_id, store_name, scheduled_at, status)
      VALUES (?, ?, ?, ?, 'planned')
    `).run(finalListId, userProfile.id, finalStoreName, finalScheduledDate);

    const tripId = result.lastInsertRowid;

    // Add helpers if provided
    if (helpers.length > 0) {
      const insertHelper = db.prepare(`
        INSERT INTO shopping_helpers (trip_id, profile_id) VALUES (?, ?)
      `);

      for (const helperId of helpers) {
        insertHelper.run(tripId, helperId);
      }
    }

    const newTrip = db.prepare('SELECT * FROM shopping_trips WHERE id = ?').get(tripId);
    res.status(201).json(newTrip);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start a shopping trip
router.post('/trips/:tripId/start', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;

    db.prepare(`
      UPDATE shopping_trips
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tripId);

    // Update helper status
    db.prepare(`
      UPDATE shopping_helpers SET status = 'participated' WHERE trip_id = ?
    `).run(tripId);

    const trip = db.prepare('SELECT * FROM shopping_trips WHERE id = ?').get(tripId);
    res.json(trip);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark an item as found during a trip
router.post('/trips/:tripId/items/:itemId/found', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId, itemId } = req.params;
    const {
      found_by_profile_id,
      foundBy,
      found,
      actualPrice,
      quantityBought,
      wasSubstituted,
      substitutionNotes
    } = req.body;

    const finalFoundBy = found_by_profile_id || foundBy || null;

    // Check if already completed
    const existing = db.prepare(`
      SELECT id FROM shopping_item_completions WHERE trip_id = ? AND item_id = ?
    `).get(tripId, itemId);

    // If found is explicitly false, delete the completion record
    if (found === false) {
      if (existing) {
        db.prepare(`DELETE FROM shopping_item_completions WHERE trip_id = ? AND item_id = ?`).run(tripId, itemId);

        // Update helper's items_found count
        if (finalFoundBy) {
          db.prepare(`
            UPDATE shopping_helpers
            SET items_found = (
              SELECT COUNT(*) FROM shopping_item_completions
              WHERE trip_id = ? AND found_by = ?
            )
            WHERE trip_id = ? AND profile_id = ?
          `).run(tripId, finalFoundBy, tripId, finalFoundBy);
        }
      }
      return res.json({ message: 'Item unmarked' });
    }

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE shopping_item_completions
        SET found_by = ?, actual_price = ?, quantity_bought = ?, was_substituted = ?, substitution_notes = ?
        WHERE trip_id = ? AND item_id = ?
      `).run(finalFoundBy, actualPrice || null, quantityBought || null, wasSubstituted ? 1 : 0, substitutionNotes || null, tripId, itemId);
    } else {
      // Create new completion
      db.prepare(`
        INSERT INTO shopping_item_completions (trip_id, item_id, found_by, actual_price, quantity_bought, was_substituted, substitution_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(tripId, itemId, finalFoundBy, actualPrice || null, quantityBought || null, wasSubstituted ? 1 : 0, substitutionNotes || null);
    }

    // Update helper's items_found count if finalFoundBy is specified
    if (finalFoundBy) {
      db.prepare(`
        UPDATE shopping_helpers
        SET items_found = (
          SELECT COUNT(*) FROM shopping_item_completions
          WHERE trip_id = ? AND found_by = ?
        )
        WHERE trip_id = ? AND profile_id = ?
      `).run(tripId, foundBy, tripId, foundBy);
    }

    res.json({ message: 'Item marked as found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete a shopping trip and award points
router.post('/trips/:tripId/complete', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const {
      totalSpent,
      total_spent,
      notes,
      behavior_rating, // Single rating for all helpers
      helperRatings = {} // Object mapping profileId -> rating
    } = req.body;

    const finalTotalSpent = total_spent ?? totalSpent;

    // Get trip details
    const trip: any = db.prepare(`
      SELECT st.*, sl.points_per_item, sl.bonus_for_completion, sl.bonus_for_good_behavior
      FROM shopping_trips st
      JOIN shopping_lists sl ON st.list_id = sl.id
      WHERE st.id = ?
    `).get(tripId);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get helpers
    const helpers: any[] = db.prepare(`
      SELECT * FROM shopping_helpers WHERE trip_id = ?
    `).all(tripId);

    // Get total items and completions
    const itemStats: any = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM shopping_items WHERE list_id = ?) as total_items,
        (SELECT COUNT(*) FROM shopping_item_completions WHERE trip_id = ?) as completed_items
    `).get(trip.list_id, tripId);

    const allItemsFound = itemStats.completed_items >= itemStats.total_items;

    // Calculate and award points for each helper
    const pointsAwarded: any[] = [];
    let totalPointsAwarded = 0;

    for (const helper of helpers) {
      let points = 0;
      let bonus = 0;

      // Points for items found
      points += (helper.items_found || 0) * trip.points_per_item;

      // Completion bonus (if all items found)
      if (allItemsFound && itemStats.total_items > 0) {
        bonus += trip.bonus_for_completion;
      }

      // Behavior bonus (based on rating) - use single rating or per-helper rating
      const rating = behavior_rating ?? helperRatings[helper.profile_id];
      if (rating && rating >= 4) {
        bonus += trip.bonus_for_good_behavior;
      }

      let totalPoints = points + bonus;
      totalPointsAwarded += totalPoints;

      // Update helper record
      db.prepare(`
        UPDATE shopping_helpers
        SET status = 'completed',
            points_earned = ?,
            bonus_earned = ?,
            behavior_rating = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(points, bonus, rating || null, helper.id);

      // Award points using centralized economy-controlled system
      if (totalPoints > 0) {
        const awardResult = awardPoints({
          profileId: helper.profile_id,
          basePoints: totalPoints,
          source: 'shopping',
          applyMultiplier: false,  // Shopping points are already calculated
          enforceRateLimit: false  // No cooldown for shopping completion
        });

        // Update totalPoints to reflect any capping
        if (awardResult.capped) {
          totalPoints = awardResult.awarded;
        }
      }

      pointsAwarded.push({
        profileId: helper.profile_id,
        itemsFound: helper.items_found,
        pointsEarned: points,
        bonusEarned: bonus,
        totalPoints,
        behaviorRating: rating
      });
    }

    // Complete the trip
    db.prepare(`
      UPDATE shopping_trips
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          total_spent = ?,
          notes = ?
      WHERE id = ?
    `).run(finalTotalSpent || null, notes || null, tripId);

    res.json({
      message: 'Shopping trip completed!',
      total_points_awarded: totalPointsAwarded,
      allItemsFound,
      totalItems: itemStats.total_items,
      completedItems: itemStats.completed_items,
      pointsAwarded
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel a trip
router.post('/trips/:tripId/cancel', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;

    db.prepare(`
      UPDATE shopping_trips SET status = 'cancelled' WHERE id = ?
    `).run(tripId);

    res.json({ message: 'Trip cancelled' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add helper to a trip
router.post('/trips/:tripId/helpers', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { profile_id, profileId } = req.body;

    const finalProfileId = profile_id || profileId;

    if (!finalProfileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO shopping_helpers (trip_id, profile_id) VALUES (?, ?)
    `).run(tripId, finalProfileId);

    res.json({ message: 'Helper added' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove helper from a trip
router.delete('/trips/:tripId/helpers/:profileId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { tripId, profileId } = req.params;

    db.prepare(`
      DELETE FROM shopping_helpers WHERE trip_id = ? AND profile_id = ?
    `).run(tripId, profileId);

    res.json({ message: 'Helper removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STATS ====================

// Get shopping stats for a child
router.get('/stats/:profileId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;

    const stats: any = db.prepare(`
      SELECT
        COUNT(DISTINCT sh.trip_id) as total_trips,
        COALESCE(SUM(sh.items_found), 0) as items_found,
        COALESCE(SUM(sh.points_earned), 0) + COALESCE(SUM(sh.bonus_earned), 0) as total_points,
        AVG(sh.behavior_rating) as avg_behavior_rating
      FROM shopping_helpers sh
      WHERE sh.profile_id = ? AND sh.status = 'completed'
    `).get(profileId);

    // Return flat stats object matching ShoppingStats interface
    res.json({
      total_trips: stats?.total_trips || 0,
      items_found: stats?.items_found || 0,
      total_points: stats?.total_points || 0,
      avg_behavior_rating: stats?.avg_behavior_rating || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get family shopping leaderboard
router.get('/leaderboard/:parentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;

    const leaderboard = db.prepare(`
      SELECT
        p.id as profile_id, p.name, p.avatar,
        COUNT(DISTINCT sh.trip_id) as trips_completed,
        COALESCE(SUM(sh.items_found), 0) as items_found,
        COALESCE(SUM(sh.points_earned), 0) + COALESCE(SUM(sh.bonus_earned), 0) as total_points,
        AVG(sh.behavior_rating) as avg_rating
      FROM profiles p
      JOIN shopping_helpers sh ON p.id = sh.profile_id
      JOIN shopping_trips st ON sh.trip_id = st.id
      WHERE p.parent_id = ? AND sh.status = 'completed'
      GROUP BY p.id
      ORDER BY total_points DESC
    `).all(parentId);

    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CHILD PERMISSIONS ====================

// Get shopping permissions for children (for parent view)
router.get('/permissions/:parentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;
    const userProfile = req.profile!;

    // Only parents can view permissions
    if (userProfile.type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can view permissions' });
    }

    const children: any[] = db.prepare(`
      SELECT id, name, avatar, settings FROM profiles WHERE parent_id = ? AND type = 'child'
    `).all(parentId);

    const result = children.map(child => {
      let canCreateLists = false;
      try {
        const settings = JSON.parse(child.settings || '{}');
        canCreateLists = settings.can_create_shopping_lists === true;
      } catch {}
      return {
        id: child.id,
        name: child.name,
        avatar: child.avatar,
        can_create_shopping_lists: canCreateLists
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle shopping list permission for a child
router.put('/permissions/:childId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { childId } = req.params;
    const { can_create_shopping_lists } = req.body;
    const userProfile = req.profile!;

    // Only parents can change permissions
    if (userProfile.type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can change permissions' });
    }

    // Verify the child belongs to this parent
    const child: any = db.prepare('SELECT id, parent_id, settings FROM profiles WHERE id = ? AND type = ?').get(childId, 'child');
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }
    if (child.parent_id !== userProfile.id && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'You can only change permissions for your own children' });
    }

    // Update the settings
    let settings = {};
    try {
      settings = JSON.parse(child.settings || '{}');
    } catch {}
    settings = { ...settings, can_create_shopping_lists: can_create_shopping_lists === true };

    db.prepare('UPDATE profiles SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(settings), childId);

    res.json({
      message: can_create_shopping_lists ? 'Shopping list creation enabled' : 'Shopping list creation disabled',
      can_create_shopping_lists: can_create_shopping_lists === true
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check if current profile can create shopping lists
router.get('/can-create-lists', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    if (userProfile.type === 'parent' || userProfile.type === 'admin') {
      return res.json({ canCreate: true, reason: 'parent' });
    }

    if (userProfile.type === 'child') {
      const canCreate = canChildCreateLists(userProfile.id);
      return res.json({ canCreate, reason: canCreate ? 'permission_granted' : 'permission_not_granted' });
    }

    res.json({ canCreate: false, reason: 'not_allowed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
