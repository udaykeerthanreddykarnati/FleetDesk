import { z } from 'zod';

const shortText = (max: number, min = 1) => z.string().trim().min(min).max(max);
const numeric = (min = 0, max = 1_000_000) => z.coerce.number().finite().min(min).max(max);
const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional();

export const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(200) });
export const vehicleSchema = z.object({
  registration_number: shortText(24).transform((value) => value.toUpperCase()),
  vehicle_type: z.enum(['van','truck','tractor','trailer']), make: shortText(60), model: shortText(60),
  year: numeric(1980, 2100), capacity_kg: numeric(1, 1000000), odometer_km: numeric(0, 10000000).default(0),
  status: z.enum(['available','on_trip','maintenance','inactive']).default('available')
});
export const driverSchema = z.object({ full_name: shortText(120), license_number: shortText(40).transform((value) => value.toUpperCase()), phone: shortText(32), email: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional().transform((value) => value || null), license_expires_on: z.string().date(), status: z.enum(['available','on_trip','on_leave','inactive']).default('available') });
export const shipmentSchema = z.object({ tracking_number: shortText(32).transform((value) => value.toUpperCase()), customer_name: shortText(120), description: shortText(500), origin: shortText(180), destination: shortText(180), weight_kg: numeric(0.01, 1000000), status: z.enum(['pending','assigned','in_transit','delivered','delayed','cancelled']).default('pending'), expected_delivery: z.string().datetime().nullable().optional() });
export const tripSchema = z.object({ trip_code: shortText(24).transform((value) => value.toUpperCase()), start_location: shortText(180), end_location: shortText(180), planned_start: z.string().datetime(), shipment_ids: z.array(z.coerce.number().int().positive()).max(100).default([]) });
export const tripAssignmentSchema = z.object({ vehicle_id: z.coerce.number().int().positive(), driver_id: z.coerce.number().int().positive() });
export const maintenanceSchema = z.object({ vehicle_id: z.coerce.number().int().positive(), service_type: shortText(100), notes: z.string().trim().max(1000).nullable().optional(), service_date: z.string().date(), cost: numeric(0, 100000000), odometer_km: numeric(0, 10000000).nullable().optional() });
export const expenseSchema = z.object({ vehicle_id: optionalId, trip_id: optionalId, category: z.enum(['fuel','toll','repair','other']), vendor: shortText(120), description: z.string().trim().max(300).nullable().optional(), amount: numeric(0, 100000000), quantity: numeric(0, 1000000).nullable().optional(), unit: z.string().trim().max(20).nullable().optional(), incurred_at: z.string().datetime() });
export const incidentSchema = z.object({ vehicle_id: optionalId, driver_id: optionalId, trip_id: optionalId, summary: shortText(180), description: shortText(5000), severity: z.enum(['low','medium','high','critical']), incident_status: z.enum(['open','investigating','resolved']).default('open'), occurred_at: z.string().datetime() });
export const userSchema = z.object({ full_name: shortText(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(200), role: z.enum(['admin','operations']) });
export const statusSchema = z.object({ status: z.string().min(1).max(32) });
export const searchSchema = z.object({ query: shortText(500, 8), limit: z.coerce.number().int().min(1).max(20).default(5) });

export function positiveId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid record id.');
  return id;
}
