export class EventData {
  id?: number;
  version?: number;
  createdAt?: number;

  constructor(
    public type: string,
    public aggregateType: string,
    public aggregateId: string,
    public payload: any,
  ) { }
}
