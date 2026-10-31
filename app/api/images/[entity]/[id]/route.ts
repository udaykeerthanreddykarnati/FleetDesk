import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { errorResponse, HttpError } from '@/lib/http';
import { positiveId } from '@/lib/validation';
import { imageMimeFromBytes, MAX_IMAGE_BYTES, safeImageFilename } from '@/lib/image-validation';

const IMAGE_TABLES = {
  vehicles: { table: 'vehicle_images', foreignKey: 'vehicle_id' },
  shipments: { table: 'shipment_images', foreignKey: 'shipment_id' },
  incidents: { table: 'incident_images', foreignKey: 'incident_id' }
} as const;

export async function GET(_request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  try {
    await requireUser(); const { entity, id: rawId } = await context.params;
    if (!(entity in IMAGE_TABLES)) throw new HttpError('Unknown image type.', 404);
    const target = IMAGE_TABLES[entity as keyof typeof IMAGE_TABLES]; const id = positiveId(rawId);
    const [row] = await query<{ image_data: Buffer; mime_type: string; filename: string }[]>(`SELECT image_data,mime_type,filename FROM ${target.table} WHERE ${target.foreignKey}=?`, [id]);
    if (!row) return new Response(null, { status: 404 });
    return new Response(Uint8Array.from(row.image_data), { headers: { 'Content-Type': row.mime_type, 'Content-Length': String(row.image_data.length), 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `inline; filename="${row.filename.replace(/["\\\r\n]/g,'_')}"` } });
  } catch (error) { return errorResponse(error); }
}

async function saveImage(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  await requireUser(); const { entity, id: rawId } = await context.params;
  if (!(entity in IMAGE_TABLES)) throw new HttpError('Unknown image type.', 404);
  const target = IMAGE_TABLES[entity as keyof typeof IMAGE_TABLES]; const id = positiveId(rawId);
  const form = await request.formData(); const candidate = form.get('file');
  if (!(candidate instanceof File)) throw new HttpError('Choose an image file first.');
  if (!candidate.size || candidate.size > MAX_IMAGE_BYTES) throw new HttpError('Image must be between 1 byte and 5 MB.');
  const bytes = Buffer.from(await candidate.arrayBuffer()); const mime = imageMimeFromBytes(bytes);
  if (!mime) throw new HttpError('Use a PNG, JPEG, GIF, or WebP image.');
  const safeName = safeImageFilename(candidate.name);
  const description = String(form.get('description') || '').trim().slice(0,200) || null;
  await execute(`INSERT INTO ${target.table} (${target.foreignKey},filename,mime_type,file_size,image_data,description) VALUES (?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE filename=VALUES(filename),mime_type=VALUES(mime_type),file_size=VALUES(file_size),image_data=VALUES(image_data),description=VALUES(description),uploaded_at=CURRENT_TIMESTAMP`, [id,safeName,mime,bytes.length,bytes,description]);
  return NextResponse.json({ ok: true, filename: safeName, mime_type: mime, file_size: bytes.length }, { status: 201 });
}
export async function POST(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  try { return await saveImage(request,context); } catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  try { return await saveImage(request,context); } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  try {
    await requireUser(); const { entity, id: rawId } = await context.params;
    if (!(entity in IMAGE_TABLES)) throw new HttpError('Unknown image type.', 404);
    const target = IMAGE_TABLES[entity as keyof typeof IMAGE_TABLES]; await execute(`DELETE FROM ${target.table} WHERE ${target.foreignKey}=?`, [positiveId(rawId)]);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
