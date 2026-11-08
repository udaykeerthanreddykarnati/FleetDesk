const shipmentTransitions:Record<string,string[]>={pending:['assigned','cancelled'],assigned:['in_transit','delayed','cancelled'],in_transit:['delivered','delayed','cancelled'],delayed:['in_transit','cancelled'],delivered:[],cancelled:[]};
const tripTransitions:Record<string,string[]>={planned:['cancelled'],assigned:['in_progress','cancelled'],in_progress:['completed']};
export function canTransitionShipment(from:string,to:string){return shipmentTransitions[from]?.includes(to)??false;}
export function canTransitionTrip(from:string,to:string){return tripTransitions[from]?.includes(to)??false;}
