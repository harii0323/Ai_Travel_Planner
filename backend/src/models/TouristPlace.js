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

const TouristPlace = {
  find(filter) {
    return new TouristPlaceQuery(filter);
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM tourist_places WHERE id = $1', [id]);
    return toDocument(result.rows[0]);
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
