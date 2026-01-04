import express from 'express';
import axios from 'axios';
import db from '../database/init';

const router = express.Router();

// Search Norwegian foods (Matvaretabellen API or OpenFoodFacts)
router.get('/foods/search', async (req, res) => {
  try {
    const { query, source = 'openfoodfacts' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    let foods: any[] = [];

    // Search in local database first
    const localFoods = db.prepare(`
      SELECT * FROM food_items
      WHERE name LIKE ? OR name_no LIKE ?
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`);

    foods = localFoods.map((food: any) => ({
      id: food.id,
      name: food.name,
      name_no: food.name_no,
      brand: food.brand,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      serving_size: food.serving_size,
      serving_unit: food.serving_unit,
      source: 'local'
    }));

    // If not enough results, search OpenFoodFacts (Norway)
    if (foods.length < 5 && source === 'openfoodfacts') {
      try {
        const response = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
          params: {
            search_terms: query,
            countries: 'Norway',
            json: true,
            page_size: 20
          }
        });

        const externalFoods = response.data.products?.map((product: any) => ({
          id: `off_${product.code}`,
          name: product.product_name || product.product_name_no,
          name_no: product.product_name_no,
          brand: product.brands,
          calories: Math.round(product.nutriments?.['energy-kcal_100g'] || 0),
          protein: product.nutriments?.proteins_100g || 0,
          carbs: product.nutriments?.carbohydrates_100g || 0,
          fat: product.nutriments?.fat_100g || 0,
          fiber: product.nutriments?.fiber_100g || 0,
          serving_size: '100',
          serving_unit: 'g',
          barcode: product.code,
          source: 'openfoodfacts',
          is_norwegian: true
        })) || [];

        foods = [...foods, ...externalFoods];
      } catch (error) {
        console.error('OpenFoodFacts API error:', error);
      }
    }

    res.json(foods.slice(0, 20));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get food by ID
router.get('/foods/:id', (req, res) => {
  try {
    const food = db.prepare('SELECT * FROM food_items WHERE id = ?').get(req.params.id);
    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }
    res.json(food);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add custom food
router.post('/foods', (req, res) => {
  try {
    const {
      name,
      name_no,
      brand,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      serving_size,
      serving_unit,
      barcode
    } = req.body;

    if (!name || calories === undefined) {
      return res.status(400).json({ error: 'Name and calories are required' });
    }

    const result = db.prepare(`
      INSERT INTO food_items (
        name, name_no, brand, calories, protein, carbs, fat, fiber,
        serving_size, serving_unit, barcode, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom')
    `).run(
      name,
      name_no || name,
      brand || null,
      calories,
      protein || 0,
      carbs || 0,
      fat || 0,
      fiber || 0,
      serving_size || '100',
      serving_unit || 'g',
      barcode || null
    );

    const newFood = db.prepare('SELECT * FROM food_items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newFood);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Log meal
router.post('/log', (req, res) => {
  try {
    const {
      profile_id,
      food_id,
      meal_type,
      portion_size,
      portion_unit,
      notes
    } = req.body;

    if (!profile_id || !food_id || !portion_size) {
      return res.status(400).json({ error: 'profile_id, food_id, and portion_size are required' });
    }

    // Get food nutritional info
    const food: any = db.prepare('SELECT * FROM food_items WHERE id = ?').get(food_id);
    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }

    // Calculate nutrition based on portion
    const multiplier = portion_size / parseFloat(food.serving_size || 100);
    const calories = Math.round(food.calories * multiplier);
    const protein = (food.protein * multiplier).toFixed(1);
    const carbs = (food.carbs * multiplier).toFixed(1);
    const fat = (food.fat * multiplier).toFixed(1);

    const result = db.prepare(`
      INSERT INTO meal_logs (
        profile_id, food_id, meal_type, portion_size, portion_unit,
        calories_consumed, protein_consumed, carbs_consumed, fat_consumed, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profile_id,
      food_id,
      meal_type || 'snack',
      portion_size,
      portion_unit || food.serving_unit || 'g',
      calories,
      protein,
      carbs,
      fat,
      notes || null
    );

    const mealLog = db.prepare(`
      SELECT ml.*, fi.name as food_name, fi.name_no
      FROM meal_logs ml
      JOIN food_items fi ON ml.food_id = fi.id
      WHERE ml.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(mealLog);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update meal log
router.put('/log/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      meal_type,
      portion_size,
      portion_unit,
      notes
    } = req.body;

    // Get existing log
    const existingLog: any = db.prepare(`
      SELECT ml.*, fi.calories, fi.protein, fi.carbs, fi.fat, fi.serving_size
      FROM meal_logs ml
      JOIN food_items fi ON ml.food_id = fi.id
      WHERE ml.id = ?
    `).get(id);

    if (!existingLog) {
      return res.status(404).json({ error: 'Meal log not found' });
    }

    // Recalculate nutrition if portion changed
    let calories = existingLog.calories_consumed;
    let protein = existingLog.protein_consumed;
    let carbs = existingLog.carbs_consumed;
    let fat = existingLog.fat_consumed;

    if (portion_size !== undefined && portion_size !== existingLog.portion_size) {
      const multiplier = portion_size / parseFloat(existingLog.serving_size || 100);
      calories = Math.round(existingLog.calories * multiplier);
      protein = (existingLog.protein * multiplier).toFixed(1);
      carbs = (existingLog.carbs * multiplier).toFixed(1);
      fat = (existingLog.fat * multiplier).toFixed(1);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (meal_type !== undefined) {
      updates.push('meal_type = ?');
      values.push(meal_type);
    }
    if (portion_size !== undefined) {
      updates.push('portion_size = ?');
      values.push(portion_size);
      updates.push('calories_consumed = ?');
      values.push(calories);
      updates.push('protein_consumed = ?');
      values.push(protein);
      updates.push('carbs_consumed = ?');
      values.push(carbs);
      updates.push('fat_consumed = ?');
      values.push(fat);
    }
    if (portion_unit !== undefined) {
      updates.push('portion_unit = ?');
      values.push(portion_unit);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    db.prepare(`
      UPDATE meal_logs SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    const updatedLog = db.prepare(`
      SELECT ml.*, fi.name as food_name, fi.name_no
      FROM meal_logs ml
      JOIN food_items fi ON ml.food_id = fi.id
      WHERE ml.id = ?
    `).get(id);

    res.json(updatedLog);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete meal log
router.delete('/log/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM meal_logs WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Meal log not found' });
    }

    res.json({ message: 'Meal log deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get meal logs for profile
router.get('/logs/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { date, meal_type } = req.query;

    let query = `
      SELECT ml.*, fi.name as food_name, fi.name_no
      FROM meal_logs ml
      JOIN food_items fi ON ml.food_id = fi.id
      WHERE ml.profile_id = ?
    `;
    const params: any[] = [profileId];

    if (date) {
      query += ` AND DATE(ml.logged_at) = DATE(?)`;
      params.push(date);
    }

    if (meal_type) {
      query += ` AND ml.meal_type = ?`;
      params.push(meal_type);
    }

    query += ` ORDER BY ml.logged_at DESC LIMIT 100`;

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get nutrition summary for profile
router.get('/nutrition/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const summary = db.prepare(`
      SELECT
        SUM(calories_consumed) as total_calories,
        SUM(protein_consumed) as total_protein,
        SUM(carbs_consumed) as total_carbs,
        SUM(fat_consumed) as total_fat,
        COUNT(*) as meals_logged,
        meal_type
      FROM meal_logs
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
      GROUP BY meal_type
    `).all(profileId, date);

    const totals = db.prepare(`
      SELECT
        SUM(calories_consumed) as total_calories,
        SUM(protein_consumed) as total_protein,
        SUM(carbs_consumed) as total_carbs,
        SUM(fat_consumed) as total_fat
      FROM meal_logs
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
    `).get(profileId, date);

    // Get goals
    const goals: any = db.prepare(`
      SELECT * FROM diet_goals WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(profileId);

    res.json({
      date,
      summary,
      totals: totals || { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 },
      goals: goals || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set/update diet goals
router.post('/goals', (req, res) => {
  try {
    const {
      profile_id,
      calories_target,
      protein_target,
      carbs_target,
      fat_target,
      weight_goal
    } = req.body;

    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id is required' });
    }

    const result = db.prepare(`
      INSERT INTO diet_goals (
        profile_id, calories_target, protein_target, carbs_target, fat_target, weight_goal
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      profile_id,
      calories_target || null,
      protein_target || null,
      carbs_target || null,
      fat_target || null,
      weight_goal || null
    );

    const goals = db.prepare('SELECT * FROM diet_goals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Meal plans
router.get('/meal-plans', (req, res) => {
  try {
    const { profile_id, is_family_plan } = req.query;

    let query = 'SELECT * FROM meal_plans WHERE 1=1';
    const params: any[] = [];

    if (profile_id) {
      query += ' AND (profile_id = ? OR is_family_plan = 1)';
      params.push(profile_id);
    } else if (is_family_plan) {
      query += ' AND is_family_plan = 1';
    }

    query += ' ORDER BY day_of_week, meal_type';

    const plans = db.prepare(query).all(...params);
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/meal-plans', (req, res) => {
  try {
    const {
      profile_id,
      name,
      description,
      day_of_week,
      meal_type,
      recipe_data,
      is_family_plan
    } = req.body;

    if (!name || !meal_type) {
      return res.status(400).json({ error: 'name and meal_type are required' });
    }

    const result = db.prepare(`
      INSERT INTO meal_plans (
        profile_id, name, description, day_of_week, meal_type, recipe_data, is_family_plan
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      profile_id || null,
      name,
      description || null,
      day_of_week || null,
      meal_type,
      JSON.stringify(recipe_data || {}),
      is_family_plan ? 1 : 0
    );

    const plan = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
