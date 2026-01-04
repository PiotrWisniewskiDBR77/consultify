/**
 * Organization Segment Service
 * Manages marketing/sales segments for organizations
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const OrganizationSegmentService = {
    /**
     * Get all segments for an organization
     */
    getSegments: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM organization_segments WHERE organization_id = ? ORDER BY assigned_at DESC',
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Assign a segment to an organization
     */
    assignSegment: (organizationId, segmentName, segmentType, assignedBy) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO organization_segments 
                 (id, organization_id, segment_name, segment_type, assigned_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, organizationId, segmentName, segmentType, assignedBy],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, organizationId, segmentName, segmentType, assignedBy });
                }
            );
        });
    },

    /**
     * Remove a segment from an organization
     */
    removeSegment: (segmentId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM organization_segments WHERE id = ?',
                [segmentId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Get organizations by segment
     */
    getOrganizationsBySegment: (segmentName, segmentType = null) => {
        return new Promise((resolve, reject) => {
            const query = segmentType
                ? `SELECT o.* FROM organizations o
                   INNER JOIN organization_segments s ON o.id = s.organization_id
                   WHERE s.segment_name = ? AND s.segment_type = ?`
                : `SELECT o.* FROM organizations o
                   INNER JOIN organization_segments s ON o.id = s.organization_id
                   WHERE s.segment_name = ?`;
            
            const params = segmentType ? [segmentName, segmentType] : [segmentName];
            
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }
};

export default OrganizationSegmentService;









