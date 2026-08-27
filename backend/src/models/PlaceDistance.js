const crypto = require('crypto');
const db = require('../config/database');
const TouristPlace = require('./TouristPlace');

const toNumber = (value) => value === null || value === undefined ? value : Number(value);

class PlaceDistanceDocument {
  constructor(row) {
    this._id = row.id;
    this.id = row.id;
    this.fromPlace = row.from_place;
    this.toPlace = row.to_place;
    this.fromName = row.from_name;
    this.toName = row.to_name;
    this.straightLineDistanceKm = toNumber(row.straight_line_distance_km);
    this.estimatedRoadDistanceKm = toNumber(row.estimated_road_distance_km);
    this.recommendedModes = row.recommended_modes || [];
    this.distanceSource = row.distance_source;
    this.createdAt = row.created_at;
    this.updatedAt = row.updated_at;
  }
}

const toDocument = (row) => row ? new PlaceDistanceDocument(row) : null;

class PlaceDistanceQuery {
  constructor(filter, single = false) {
    this.filter = filter || {};
    this.single = single;
    this.sortBy = null;
    this.limitCount = single ? 1 : null;
    this.populateFields = [];
  }

  sort(sortBy) {
    this.sortBy = sortBy;
    return this;
  }

  limit(limitCount) {
    this.limitCount = limitCount;
    return this;
  }

  populate(field) {
    this.populateFields.push(field);
    return this;
  }

  async exec() {
    const where = [];
    const params = [];

    if (this.filter.fromPlace) {
      params.push(this.filter.fromPlace);
      where.push(`from_place = $${params.length}`);
    }

    if (this.filter.fromName instanceof RegExp) {
      params.push(this.filter.fromName.source.replace(/^\^|\$$/g, ''));
      where.push(`from_name ILIKE $${params.length}`);
    }

    if (this.filter.toName instanceof RegExp) {
      params.push(this.filter.toName.source.replace(/^\^|\$$/g, ''));
      where.push(`to_name ILIKE $${params.length}`);
    }

    let sql = `SELECT * FROM place_distances${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;

    if (this.sortBy?.estimatedRoadDistanceKm) {
      sql += ` ORDER BY estimated_road_distance_km ${this.sortBy.estimatedRoadDistanceKm === 1 ? 'ASC' : 'DESC'}`;
    }

    if (this.limitCount) {
      params.push(this.limitCount);
      sql += ` LIMIT $${params.length}`;
    }

    const result = await db.query(sql, params);
    const docs = result.rows.map(toDocument);

    for (const doc of docs) {
      if (this.populateFields.includes('fromPlace')) {
        doc.fromPlace = await TouristPlace.findById(doc.fromPlace);
      }

      if (this.populateFields.includes('toPlace')) {
        doc.toPlace = await TouristPlace.findById(doc.toPlace);
      }
    }

    return this.single ? (docs[0] || null) : docs;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

const PlaceDistance = {
  find(filter) {
    return new PlaceDistanceQuery(filter);
  },

  findOne(filter) {
    return new PlaceDistanceQuery(filter, true);
  },

  async deleteMany() {
    await db.query('DELETE FROM place_distances');
  },

  async insertMany(distances) {
    const inserted = [];

    for (const distance of distances) {
      const result = await db.query(
        `INSERT INTO place_distances (
          id, from_place, to_place, from_name, to_name, straight_line_distance_km,
          estimated_road_distance_km, recommended_modes, distance_source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (from_place, to_place) DO UPDATE SET
          from_name = EXCLUDED.from_name,
          to_name = EXCLUDED.to_name,
          straight_line_distance_km = EXCLUDED.straight_line_distance_km,
          estimated_road_distance_km = EXCLUDED.estimated_road_distance_km,
          recommended_modes = EXCLUDED.recommended_modes,
          distance_source = EXCLUDED.distance_source,
          updated_at = NOW()
        RETURNING *`,
        [
          crypto.randomUUID(),
          distance.fromPlace,
          distance.toPlace,
          distance.fromName,
          distance.toName,
          distance.straightLineDistanceKm,
          distance.estimatedRoadDistanceKm,
          JSON.stringify(distance.recommendedModes || []),
          distance.distanceSource || 'coordinate_estimate'
        ]
      );
      inserted.push(toDocument(result.rows[0]));
    }

    return inserted;
  }
};

module.exports = PlaceDistance;
