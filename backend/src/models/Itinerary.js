const crypto = require('crypto');
const db = require('../config/database');

const toNumber = (value) => value === null || value === undefined ? value : Number(value);

class ItineraryDocument {
  constructor(row) {
    this._id = row.id;
    this.id = row.id;
    this.userId = row.user_id;
    this.title = row.title;
    this.description = row.description;
    this.destination = row.destination;
    this.startLocation = row.start_location;
    this.startDate = row.start_date;
    this.endDate = row.end_date;
    this.totalDays = row.total_days;
    this.budget = toNumber(row.budget);
    this.estimatedCost = toNumber(row.estimated_cost);
    this.withoutBudget = row.without_budget;
    this.activities = row.activities || [];
    this.accommodation = row.accommodation;
    this.transport = row.transport;
    this.travelCompanionType = row.travel_companion_type;
    this.numberOfTravelers = row.number_of_travelers;
    this.estimatedCosts = row.estimated_costs || {};
    this.dayPlans = row.day_plans || [];
    this.moneyTips = row.money_tips || [];
    this.recommendations = row.recommendations || {};
    this.status = row.status;
    this.tags = row.tags || [];
    this.createdAt = row.created_at;
    this.updatedAt = row.updated_at;
    this.plannedTravelDate = row.planned_travel_date;
  }

  async save() {
    const result = await db.query(
      `UPDATE itineraries
       SET title = $2, description = $3, status = $4, tags = $5, planned_travel_date = $6, updated_at = $7
       WHERE id = $1
       RETURNING *`,
      [
        this._id,
        this.title,
        this.description,
        this.status,
        JSON.stringify(this.tags || []),
        this.plannedTravelDate,
        this.updatedAt || new Date()
      ]
    );

    Object.assign(this, new ItineraryDocument(result.rows[0]));
    return this;
  }
}

const toDocument = (row) => row ? new ItineraryDocument(row) : null;

class ItineraryQuery {
  constructor(filter) {
    this.filter = filter || {};
    this.sortBy = { createdAt: -1 };
    this.limitCount = null;
  }

  sort(sortBy) {
    this.sortBy = sortBy;
    return this;
  }

  select() {
    return this;
  }

  limit(limitCount) {
    this.limitCount = limitCount;
    return this;
  }

  async exec() {
    const where = [];
    const params = [];

    if (this.filter.userId) {
      params.push(this.filter.userId);
      where.push(`user_id = $${params.length}`);
    }

    if (this.filter.status) {
      params.push(this.filter.status);
      where.push(`status = $${params.length}`);
    }

    if (this.filter.destination instanceof RegExp) {
      params.push(this.filter.destination.source.replace(/^\^|\$$/g, ''));
      where.push(`destination ILIKE '%' || $${params.length} || '%'`);
    } else if (this.filter.destination) {
      params.push(this.filter.destination);
      where.push(`destination = $${params.length}`);
    }

    const orderDirection = this.sortBy.createdAt === 1 ? 'ASC' : 'DESC';
    let sql = `SELECT * FROM itineraries${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ${orderDirection}`;

    if (this.limitCount) {
      params.push(this.limitCount);
      sql += ` LIMIT $${params.length}`;
    }

    const result = await db.query(sql, params);
    return result.rows.map(toDocument);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

const Itinerary = {
  async create(data) {
    const result = await db.query(
      `INSERT INTO itineraries (
        id, user_id, title, description, destination, start_location, start_date, end_date,
        total_days, budget, estimated_cost, without_budget, activities, accommodation,
        transport, travel_companion_type, number_of_travelers, estimated_costs, day_plans,
        money_tips, recommendations, planned_travel_date, tags
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23
      )
      RETURNING *`,
      [
        crypto.randomUUID(),
        data.userId,
        data.title,
        data.description,
        data.destination,
        data.startLocation,
        data.startDate,
        data.endDate,
        data.totalDays,
        data.budget,
        data.estimatedCost,
        Boolean(data.withoutBudget),
        JSON.stringify(data.activities || []),
        data.accommodation,
        data.transport,
        data.travelCompanionType || 'solo',
        data.numberOfTravelers || 1,
        JSON.stringify(data.estimatedCosts || {}),
        JSON.stringify(data.dayPlans || []),
        JSON.stringify(data.moneyTips || []),
        JSON.stringify(data.recommendations || {}),
        data.plannedTravelDate || null,
        JSON.stringify(data.tags || [])
      ]
    );

    return toDocument(result.rows[0]);
  },

  find(filter) {
    return new ItineraryQuery(filter);
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM itineraries WHERE id = $1', [id]);
    return toDocument(result.rows[0]);
  },

  async findByIdAndDelete(id) {
    const result = await db.query('DELETE FROM itineraries WHERE id = $1 RETURNING *', [id]);
    return toDocument(result.rows[0]);
  }
};

module.exports = Itinerary;
