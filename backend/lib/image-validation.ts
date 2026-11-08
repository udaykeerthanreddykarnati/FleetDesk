import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function imageMimeFromBytes(input: Uint8Array): string | null {
  const bytes=Buffer.from(input);
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
  return null;
}
export function safeImageFilename(input:string):string {
  return basename(input).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,180)||`upload-${randomUUID()}`;
}
