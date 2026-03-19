import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import PropertyDetailClient from "./PropertyDetailClient";

interface PropertyDetailPageProps {
  params: {
    propertyId: string;
  };
}

async function getProperty(propertyId: string, userId: string) {
  const result = await db.query(
    `SELECT 
      p.id,
      p.name,
      p.address,
      p.city,
      p.state,
      p.zip_code,
      p.country,
      p.property_type,
      p.description,
      p.total_units,
      p.year_built,
      p.square_footage,
      p.amenities,
      p.images,
      p.status,
      p.created_at,
      p.updated_at,
      COUNT(DISTINCT u.id) AS occupied_units,
      COUNT(DISTINCT m.id) AS open_maintenance_requests,
      COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.monthly_rent ELSE 0 END), 0) AS monthly_revenue
    FROM properties p
    LEFT JOIN units u ON u.property_id = p.id AND u.status = 'occupied'
    LEFT JOIN maintenance_requests m ON m.property_id = p.id AND m.status IN ('open', 'in_progress')
    LEFT JOIN leases l ON l.property_id = p.id AND l.status = 'active'
    WHERE p.id = $1 AND p.owner_id = $2
    GROUP BY p.id`,
    [propertyId, userId],
  );

  return result.rows[0] || null;
}

async function getPropertyUnits(propertyId: string, userId: string) {
  const result = await db.query(
    `SELECT 
      u.id,
      u.unit_number,
      u.floor,
      u.bedrooms,
      u.bathrooms,
      u.square_footage,
      u.monthly_rent,
      u.status,
      u.description,
      t.id AS tenant_id,
      t.first_name AS tenant_first_name,
      t.last_name AS tenant_last_name,
      t.email AS tenant_email,
      t.phone AS tenant_phone,
      l.id AS lease_id,
      l.start_date AS lease_start,
      l.end_date AS lease_end,
      l.monthly_rent AS lease_rent,
      l.status AS lease_status
    FROM units u
    LEFT JOIN leases l ON l.unit_id = u.id AND l.status = 'active'
    LEFT JOIN tenants t ON t.id = l.tenant_id
    JOIN properties p ON p.id = u.property_id AND p.owner_id = $2
    WHERE u.property_id = $1
    ORDER BY u.unit_number ASC`,
    [propertyId, userId],
  );

  return result.rows;
}

async function getRecentMaintenanceRequests(
  propertyId: string,
  userId: string,
) {
  const result = await db.query(
    `SELECT 
      m.id,
      m.title,
      m.description,
      m.priority,
      m.status,
      m.category,
      m.created_at,
      m.updated_at,
      u.unit_number,
      t.first_name AS tenant_first_name,
      t.last_name AS tenant_last_name
    FROM maintenance_requests m
    LEFT JOIN units u ON u.id = m.unit_id
    LEFT JOIN tenants t ON t.id = m.tenant_id
    JOIN properties p ON p.id = m.property_id AND p.owner_id = $2
    WHERE m.property_id = $1
    ORDER BY m.created_at DESC
    LIMIT 10`,
    [propertyId, userId],
  );

  return result.rows;
}

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    notFound();
  }

  const { propertyId } = params;

  const [property, units, maintenanceRequests] = await Promise.all([
    getProperty(propertyId, session.user.id),
    getPropertyUnits(propertyId, session.user.id),
    getRecentMaintenanceRequests(propertyId, session.user.id),
  ]);

  if (!property) {
    notFound();
  }

  return (
    <PropertyDetailClient
      property={property}
      units={units}
      maintenanceRequests={maintenanceRequests}
    />
  );
}
