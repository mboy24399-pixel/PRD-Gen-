import Dexie,{type Table} from 'dexie';
import type {PRDState} from './store';
export type SavedProject={id:string;name:string;updatedAt:string;state:Partial<PRDState>};
class PRDDatabase extends Dexie{projects!:Table<SavedProject,string>;constructor(){super('prd-forge-local');this.version(1).stores({projects:'id,updatedAt,name'});}}
export const db=new PRDDatabase();
export async function saveProject(state:PRDState,name:string,id=crypto.randomUUID()){const copy=JSON.parse(JSON.stringify(state));delete copy.set;delete copy.next;delete copy.prev;delete copy.applyDomainRouting;delete copy.toggleFeature;delete copy.addTable;delete copy.addRoute;delete copy.reset;delete copy.estimate;const row={id,name:name||state.product||'Untitled PRD',updatedAt:new Date().toISOString(),state:copy};await db.projects.put(row);return row;}
export async function listProjects(){return db.projects.orderBy('updatedAt').reverse().toArray();}
export async function loadProject(id:string){return db.projects.get(id);}
export async function deleteProject(id:string){return db.projects.delete(id);}
