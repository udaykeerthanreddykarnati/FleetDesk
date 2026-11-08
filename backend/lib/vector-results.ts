export type VectorMatch={incident_id:string|number;distance:number};
export type MysqlIncident={id:number;incident_status:string;summary:string;severity:string;occurred_at:Date|string};
export function mergeVectorMatches(matches:VectorMatch[],incidents:MysqlIncident[]){
  const byId=new Map(incidents.map((incident)=>[incident.id,incident]));
  return matches.flatMap((match)=>{const incident=byId.get(Number(match.incident_id));if(!incident)return[];const distance=Number(match.distance);return[{...incident,distance,similarity:Math.max(0,Math.min(1,1-distance))}];});
}
