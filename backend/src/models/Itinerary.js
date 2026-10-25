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
    this.rentalBooking = row.rental_booking || {};
    this.rentalVehicle = row.rental_vehicle || {};
  }

  async save() {
    this.updatedAt = this.updatedAt || new Date().toISOString();
    if (db.isConnected()) {
      try {
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
            this.updatedAt
          ]
        );
        if (result.rows[0]) {
          Object.assign(this, new ItineraryDocument(result.rows[0]));
        }
      } catch (err) {
        console.warn('DB error in Itinerary.save:', err.message);
      }
    }

    const mem = memoryItineraries.get(this._id);
    if (mem) {
      mem.title = this.title;
      mem.description = this.description;
      mem.status = this.status;
      mem.tags = this.tags;
      mem.planned_travel_date = this.plannedTravelDate;
      mem.updated_at = this.updatedAt;
    }
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

    if (this.filter.userId && typeof db.withUserContext === 'function') {
      return db.withUserContext(this.filter.userId, async (client) => {
        const result = await client.query(sql, params);
        return result.rows.map(toDocument);
      });
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

const memoryItineraries = new Map();

const Itinerary = {
  async create(data) {
    const id = crypto.randomUUID();
    const docData = {
      id,
      user_id: data.userId,
      title: data.title,
      description: data.description,
      destination: data.destination,
      start_location: data.startLocation,
      start_date: data.startDate,
      end_date: data.endDate,
      total_days: data.totalDays,
      budget: data.budget,
      estimated_cost: data.estimatedCost,
      without_budget: Boolean(data.withoutBudget),
      activities: data.activities || [],
      accommodation: data.accommodation,
      transport: data.transport,
      travel_companion_type: data.travelCompanionType || 'solo',
      number_of_travelers: data.numberOfTravelers || 1,
      estimated_costs: data.estimatedCosts || {},
      day_plans: data.dayPlans || [],
      money_tips: data.moneyTips || [],
      recommendations: data.recommendations || {},
      planned_travel_date: data.plannedTravelDate || null,
      tags: data.tags || [],
      rental_booking: data.rentalBooking || {},
      rental_vehicle: data.rentalVehicle || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryItineraries.set(id, docData);

    if (db.isConnected()) {
      try {
        const insertSql = `INSERT INTO itineraries (
            id, user_id, title, description, destination, start_location, start_date, end_date,
            total_days, budget, estimated_cost, without_budget, activities, accommodation,
            transport, travel_companion_type, number_of_travelers, estimated_costs, day_plans,
            money_tips, recommendations, planned_travel_date, tags, rental_booking, rental_vehicle
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
          )
          RETURNING *`;
        const insertParams = [
          id,
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
          JSON.stringify(data.tags || []),
          JSON.stringify(data.rentalBooking || {}),
          JSON.stringify(data.rentalVehicle || {})
        ];

        let result;
        if (data.userId && typeof db.withUserContext === 'function') {
          result = await db.withUserContext(data.userId, async (client) => {
            return client.query(insertSql, insertParams);
          });
        } else {
          result = await db.query(insertSql, insertParams);
        }
        return toDocument(result.rows[0]);
      } catch (err) {
        console.warn('DB insert error in Itinerary.create, using memory store fallback:', err.message);
      }
    }

    return toDocument(docData);
  },

  find(filter) {
    if (db.isConnected()) {
      return new ItineraryQuery(filter);
    }
    // In-memory query handler
    return {
      sort: function() { return this; },
      select: function() { return this; },
      limit: function(n) { this._limit = n; return this; },
      async exec() {
        let results = Array.from(memoryItineraries.values());
        if (filter?.userId) {
          results = results.filter(it => it.user_id === filter.userId);
        }
        if (filter?.status) {
          results = results.filter(it => it.status === filter.status);
        }
        return results.map(toDocument);
      },
      then(res, rej) { return this.exec().then(res, rej); },
      catch(rej) { return this.exec().catch(rej); }
    };
  },

  async findById(id, userId = null) {
    if (db.isConnected()) {
      try {
        if (userId && typeof db.withUserContext === 'function') {
          const doc = await db.withUserContext(userId, async (client) => {
            const result = await client.query('SELECT * FROM itineraries WHERE id = $1', [id]);
            return result.rows[0] ? toDocument(result.rows[0]) : null;
          });
          if (doc) return doc;
        } else {
          const result = await db.query('SELECT * FROM itineraries WHERE id = $1', [id]);
          if (result.rows[0]) return toDocument(result.rows[0]);
        }
      } catch (err) {
        console.warn('DB query error in Itinerary.findById, using memory store:', err.message);
      }
    }
    const mem = memoryItineraries.get(id);
    return mem ? toDocument(mem) : null;
  },

  async findByIdAndDelete(id, userId = null) {
    memoryItineraries.delete(id);
    if (db.isConnected()) {
      try {
        if (userId && typeof db.withUserContext === 'function') {
          return await db.withUserContext(userId, async (client) => {
            const result = await client.query('DELETE FROM itineraries WHERE id = $1 RETURNING *', [id]);
            return result.rows[0] ? toDocument(result.rows[0]) : null;
          });
        }
        const result = await db.query('DELETE FROM itineraries WHERE id = $1 RETURNING *', [id]);
        return toDocument(result.rows[0]);
      } catch (err) {
        console.warn('DB error in findByIdAndDelete:', err.message);
      }
    }
    return null;
  }
};

module.exports = Itinerary;
