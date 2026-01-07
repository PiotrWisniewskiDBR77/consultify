/**
 * Geo-location and Mapping Tests
 * Tests for geographic utilities
 * 
 * @module tests/geo/geo-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Distance calculator
const createGeoCalculator = () => {
    const toRadians = (deg) => deg * (Math.PI / 180);

    return {
        // Haversine formula for distance between two points
        distance: (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth's radius in km
            const dLat = toRadians(lat2 - lat1);
            const dLon = toRadians(lon2 - lon1);

            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
                Math.sin(dLon / 2) ** 2;

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        },

        // Calculate bearing between two points
        bearing: (lat1, lon1, lat2, lon2) => {
            const dLon = toRadians(lon2 - lon1);
            const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
            const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
                Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);

            let bearing = Math.atan2(y, x) * (180 / Math.PI);
            return (bearing + 360) % 360;
        },

        // Point within radius
        isWithinRadius: (centerLat, centerLon, pointLat, pointLon, radiusKm) => {
            return this.distance(centerLat, centerLon, pointLat, pointLon) <= radiusKm;
        },

        // Bounding box
        boundingBox: (lat, lon, radiusKm) => {
            const latChange = radiusKm / 111;
            const lonChange = radiusKm / (111 * Math.cos(toRadians(lat)));

            return {
                minLat: lat - latChange,
                maxLat: lat + latChange,
                minLon: lon - lonChange,
                maxLon: lon + lonChange,
            };
        },
    };
};

// Geocoder mock
const createGeocoder = () => {
    const cache = new Map();

    return {
        geocode: async (address) => {
            if (cache.has(address)) return cache.get(address);

            // Mock geocoding
            const result = {
                lat: 40.7128 + Math.random() * 0.1,
                lon: -74.0060 + Math.random() * 0.1,
                formattedAddress: address,
                components: { city: 'New York', country: 'USA' },
            };

            cache.set(address, result);
            return result;
        },

        reverse: async (lat, lon) => {
            return {
                address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                lat,
                lon,
            };
        },

        clearCache: () => cache.clear(),
    };
};

// Location search
const createLocationSearch = (calculator) => {
    const locations = [];

    return {
        add: (id, lat, lon, data = {}) => {
            locations.push({ id, lat, lon, ...data });
        },

        findNearby: (lat, lon, radiusKm) => {
            return locations
                .filter(loc => calculator.isWithinRadius(lat, lon, loc.lat, loc.lon, radiusKm))
                .map(loc => ({
                    ...loc,
                    distance: calculator.distance(lat, lon, loc.lat, loc.lon),
                }))
                .sort((a, b) => a.distance - b.distance);
        },

        findNearest: (lat, lon, limit = 5) => {
            return locations
                .map(loc => ({
                    ...loc,
                    distance: calculator.distance(lat, lon, loc.lat, loc.lon),
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, limit);
        },

        clear: () => {
            locations.length = 0;
        },
    };
};

describe('Geo Calculator Tests', () => {
    let geo;

    beforeEach(() => {
        geo = createGeoCalculator();
    });

    it('should calculate distance', () => {
        // NYC to LA approximately 3944 km
        const distance = geo.distance(40.7128, -74.0060, 34.0522, -118.2437);
        expect(distance).toBeGreaterThan(3900);
        expect(distance).toBeLessThan(4000);
    });

    it('should calculate bearing', () => {
        const bearing = geo.bearing(40.7128, -74.0060, 34.0522, -118.2437);
        expect(bearing).toBeGreaterThan(0);
        expect(bearing).toBeLessThan(360);
    });

    it('should check within radius', () => {
        const inRadius = geo.isWithinRadius(40.7, -74.0, 40.71, -74.01, 5);
        expect(inRadius).toBe(true);
    });

    it('should calculate bounding box', () => {
        const box = geo.boundingBox(40.7128, -74.0060, 10);

        expect(box.minLat).toBeLessThan(40.7128);
        expect(box.maxLat).toBeGreaterThan(40.7128);
    });
});

describe('Geocoder Tests', () => {
    let geocoder;

    beforeEach(() => {
        geocoder = createGeocoder();
    });

    it('should geocode address', async () => {
        const result = await geocoder.geocode('123 Main St, NYC');

        expect(result.lat).toBeDefined();
        expect(result.lon).toBeDefined();
    });

    it('should cache results', async () => {
        await geocoder.geocode('Test Address');
        const cached = await geocoder.geocode('Test Address');

        expect(cached).toBeDefined();
    });

    it('should reverse geocode', async () => {
        const result = await geocoder.reverse(40.7128, -74.0060);

        expect(result.address).toBeTruthy();
    });
});

describe('Location Search Tests', () => {
    let search;

    beforeEach(() => {
        const calc = createGeoCalculator();
        search = createLocationSearch(calc);

        search.add('store-1', 40.7128, -74.0060, { name: 'NYC Store' });
        search.add('store-2', 40.7580, -73.9855, { name: 'Times Square' });
        search.add('store-3', 34.0522, -118.2437, { name: 'LA Store' });
    });

    it('should find nearby locations', () => {
        const nearby = search.findNearby(40.7128, -74.0060, 10);

        expect(nearby.length).toBeGreaterThanOrEqual(1);
        expect(nearby[0].name).toBe('NYC Store');
    });

    it('should find nearest locations', () => {
        const nearest = search.findNearest(40.7128, -74.0060, 2);

        expect(nearest).toHaveLength(2);
        expect(nearest[0].distance).toBeLessThan(nearest[1].distance);
    });

    it('should include distance in results', () => {
        const nearby = search.findNearby(40.7128, -74.0060, 100);

        expect(nearby[0].distance).toBeDefined();
    });
});
