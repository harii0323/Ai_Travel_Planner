const crypto = require('crypto');
const db = require('../config/database');

class TouristPlaceDocument {
  constructor(row) {
    this._id = row.id;
    this.id = row.id;
    this.name = row.name;
    this.city = row.city;
    this.state = row.state;
    this.region = row.region;
    this.coordinates = row.coordinates || {};
    this.categories = row.categories || [];
    this.bestTimeToVisit = row.best_time_to_visit || {};
    this.suitableFor = row.suitable_for || [];
    this.recommendedTransport = row.recommended_transport || [];
    this.isActive = row.is_active;
    this.createdAt = row.created_at;
    this.updatedAt = row.updated_at;
  }
}

const toDocument = (row) => row ? new TouristPlaceDocument(row) : null;

const addIlikeCondition = (where, params, column, regex) => {
  params.push(regex.source.replace(/^\^|\$$/g, ''));
  where.push(`${column} ILIKE $${params.length}`);
};

class TouristPlaceQuery {
  constructor(filter) {
    this.filter = filter || {};
    this.sortBy = { region: 1, state: 1, name: 1 };
    this.limitCount = null;
  }

  sort(sortBy) {
    this.sortBy = sortBy;
    return this;
  }

  limit(limitCount) {
    this.limitCount = limitCount;
    return this;
  }

  async exec() {
    const where = [];
    const params = [];

    if (this.filter.isActive !== undefined) {
      params.push(this.filter.isActive);
      where.push(`is_active = $${params.length}`);
    }

    if (this.filter.$or) {
      const orConditions = [];
      this.filter.$or.forEach((condition) => {
        Object.entries(condition).forEach(([field, regex]) => {
          const column = field === 'name' ? 'name' : field === 'city' ? 'city' : 'state';
          params.push(`%${regex.source}%`);
          orConditions.push(`${column} ILIKE $${params.length}`);
        });
      });
      where.push(`(${orConditions.join(' OR ')})`);
    }

    if (this.filter.state instanceof RegExp) addIlikeCondition(where, params, 'state', this.filter.state);
    if (this.filter.region instanceof RegExp) addIlikeCondition(where, params, 'region', this.filter.region);

    if (this.filter.categories) {
      params.push(JSON.stringify([this.filter.categories]));
      where.push(`categories @> $${params.length}::jsonb`);
    }

    if (this.filter.suitableFor) {
      params.push(JSON.stringify([this.filter.suitableFor]));
      where.push(`suitable_for @> $${params.length}::jsonb`);
    }

    if (this.filter.recommendedTransport) {
      params.push(JSON.stringify([this.filter.recommendedTransport]));
      where.push(`recommended_transport @> $${params.length}::jsonb`);
    }

    let sql = `SELECT * FROM tourist_places${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY region ASC, state ASC, name ASC`;

    if (this.limitCount) {
      params.push(this.limitCount);
      sql += ` LIMIT $${params.length}`;
    }

    if (db.isConnected()) {
      try {
        const result = await db.query(sql, params);
        if (result.rows && result.rows.length > 0) {
          return result.rows.map(toDocument);
        }
      } catch (err) {
        console.warn('DB query error in TouristPlace, falling back to local dataset:', err.message);
      }
    }

    // Local dataset fallback for offline / testing environments
    const fallbackPlaces = require('../data/indiaTouristPlaces');
    let results = [...fallbackPlaces];

    if (this.filter.state instanceof RegExp) {
      const re = this.filter.state;
      results = results.filter(p => re.test(p.state));
    }
    if (this.filter.region instanceof RegExp) {
      const re = this.filter.region;
      results = results.filter(p => re.test(p.region));
    }
    if (this.filter.categories) {
      results = results.filter(p => (p.categories || []).includes(this.filter.categories));
    }
    if (this.filter.suitableFor) {
      results = results.filter(p => (p.suitableFor || []).includes(this.filter.suitableFor));
    }
    if (this.filter.recommendedTransport) {
      results = results.filter(p => (p.recommendedTransport || []).includes(this.filter.recommendedTransport));
    }
    if (this.filter.$or) {
      results = results.filter(p => {
        return this.filter.$or.some(cond => {
          if (cond.name && cond.name.test(p.name)) return true;
          if (cond.city && cond.city.test(p.city)) return true;
          if (cond.state && cond.state.test(p.state)) return true;
          return false;
        });
      });
    }

    if (this.limitCount) {
      results = results.slice(0, this.limitCount);
    }

    return results.map(p => new TouristPlaceDocument({
      id: p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: p.name,
      city: p.city,
      state: p.state,
      region: p.region,
      coordinates: p.coordinates,
      categories: p.categories,
      best_time_to_visit: p.bestTimeToVisit,
      suitable_for: p.suitableFor,
      recommended_transport: p.recommendedTransport,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

const TouristPlace = {
  find(filter) {
    return new TouristPlaceQuery(filter);
  },

  async findById(id) {
    if (db.isConnected()) {
      try {
        const result = await db.query('SELECT * FROM tourist_places WHERE id = $1', [id]);
        if (result.rows[0]) return toDocument(result.rows[0]);
      } catch (err) {
        console.warn('DB query error in TouristPlace.findById:', err.message);
      }
    }
    const fallbackPlaces = require('../data/indiaTouristPlaces');
    const place = fallbackPlaces.find(p => (p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')) === id);
    return place ? new TouristPlaceDocument({
      id: place.id || place.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: place.name,
      city: place.city,
      state: place.state,
      region: place.region,
      coordinates: place.coordinates,
      categories: place.categories,
      best_time_to_visit: place.bestTimeToVisit,
      suitable_for: place.suitableFor,
      recommended_transport: place.recommendedTransport,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }) : null;
  },

  async deleteMany() {
    await db.query('DELETE FROM tourist_places');
  },

  async insertMany(places) {
    const inserted = [];

    for (const place of places) {
      const result = await db.query(
        `INSERT INTO tourist_places (
          id, name, city, state, region, coordinates, categories, best_time_to_visit,
          suitable_for, recommended_transport, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (name) DO UPDATE SET
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          region = EXCLUDED.region,
          coordinates = EXCLUDED.coordinates,
          categories = EXCLUDED.categories,
          best_time_to_visit = EXCLUDED.best_time_to_visit,
          suitable_for = EXCLUDED.suitable_for,
          recommended_transport = EXCLUDED.recommended_transport,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING *`,
        [
          crypto.randomUUID(),
          place.name,
          place.city,
          place.state,
          place.region,
          JSON.stringify(place.coordinates),
          JSON.stringify(place.categories || []),
          JSON.stringify(place.bestTimeToVisit || {}),
          JSON.stringify(place.suitableFor || []),
          JSON.stringify(place.recommendedTransport || []),
          place.isActive !== false
        ]
      );
      inserted.push(toDocument(result.rows[0]));
    }

    return inserted;
  }
};

module.exports = TouristPlace;
