import { pool } from '../lib/db';
import { syncPendingVectorJobs } from '../lib/vector';

async function main(){
  const result=await syncPendingVectorJobs(1000);
  console.log(`Vector job summary: ${result.synced} synced, ${result.failed} failed, ${result.remaining} remaining.`);
  if(result.failed)process.exitCode=1;
}
main().catch((error)=>{console.error(error);process.exitCode=1;}).finally(()=>pool.end());
